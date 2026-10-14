import assert from "node:assert/strict";
import test from "node:test";
import { SampleStatistics } from "../../pages/devices/microscope-power/statistics.js";
import { aggregateVisibleBuckets } from "../../pages/devices/microscope-power/plot.js";

const identity = [{ zero: 0, scale: 1 }, { zero: 0, scale: 1 }];

function index(capacity, blockSize = 256) {
  return new SampleStatistics(new Uint16Array(capacity), new Uint8Array(capacity), blockSize);
}

function close(actual, expected, label) {
  assert.ok(Math.abs(actual - expected) <= 1e-8 * Math.max(1, Math.abs(expected)), `${label}: ${actual} != ${expected}`);
}

function expectedStats(samples, conversion) {
  const values = samples.map(({ code, range }) => (code - conversion[range === 10 ? 1 : 0].zero) * conversion[range === 10 ? 1 : 0].scale);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  return {
    count: samples.length,
    min: Math.min(...values),
    max: Math.max(...values),
    avg,
    rms: Math.sqrt(values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / values.length),
    avgCode: samples.reduce((sum, sample) => sum + sample.code, 0) / samples.length,
    last: values.at(-1),
    lastCode: samples.at(-1).code,
    rangeOhm: samples.at(-1).range,
  };
}

function compare(indexed, samples, conversion) {
  for (const [key, value] of Object.entries(expectedStats(samples, conversion))) close(indexed[key], value, key);
}

test("default 200,000 point window retains every spike and exact moments", () => {
  const stats = index(200000);
  const samples = new Uint16Array(200000);
  for (let i = 1; i < samples.length; i += 4) samples[i] = 1000;
  stats.append(samples, 1);
  const result = stats.query(0, samples.length, identity);
  assert.equal(result.min, 0);
  assert.equal(result.max, 1000);
  assert.equal(result.avg, 250);
  assert.equal(result.count, 200000);
  close(result.rms, Math.sqrt(187500), "AC RMS");
});

test("mixed ranges remain independently calibrated, including partial blocks", () => {
  const stats = index(64, 8);
  stats.append([100, 120, 160, 101, 125], 1);
  stats.append([1000, 1040, 1080, 1020], 10);
  stats.append([135, 155, 115], 1);
  const samples = [100, 120, 160, 101, 125].map((code) => ({ code, range: 1 }))
    .concat([1000, 1040, 1080, 1020].map((code) => ({ code, range: 10 })))
    .concat([135, 155, 115].map((code) => ({ code, range: 1 })));
  for (const conversion of [identity, [{ zero: 115, scale: 0.75 }, { zero: 1025, scale: 0.07 }]]) {
    compare(stats.query(0, 12, conversion), samples, conversion);
    compare(stats.query(2, 8, conversion), samples.slice(2, 10), conversion);
  }
  assert.equal(stats.queryRaw(0, 12)[0].count, 8);
  assert.equal(stats.queryRaw(0, 12)[1].count, 4);
});

test("wrapped windows match brute force after overwriting former extrema", () => {
  const stats = index(37, 8);
  let seed = 5;
  const conversion = [{ zero: 32000, scale: 0.75 }, { zero: 33000, scale: 0.075 }];
  const history = [];
  for (let batch = 0; batch < 25; batch += 1) {
    const samples = Array.from({ length: 5 + batch % 9 }, () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed & 65535;
    });
    const range = batch % 3 ? 1 : 10;
    stats.append(samples, range);
    history.push(...samples.map((code) => ({ code, range })));
    const oldest = Math.max(0, history.length - stats.capacity);
    for (let start = oldest; start < history.length; start += 3) {
      for (let count = 1; count <= history.length - start; count += 5) {
        compare(stats.query(start, count, conversion), history.slice(start, start + count), conversion);
      }
    }
  }
});

test("out-of-bounds windows intersect retained samples and empty ranges are safe", () => {
  const stats = index(7, 4);
  stats.append([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 1);
  assert.equal(stats.query(0, 3, identity).count, 0);
  assert.equal(stats.query(10, 3, identity).count, 0);
  assert.equal(stats.query(5, 0, identity).count, 0);
  assert.equal(stats.query(-100, 200, identity).count, 7);
  assert.equal(stats.query(-100, 200, identity).avg, 7);
  assert.equal(stats.query(8, 20, identity).avg, 9.5);
  assert.equal(stats.query(NaN, 20, identity).count, 0);
});

test("reset removes stale summaries and changes the render cache generation", () => {
  const stats = index(17, 8);
  stats.append(new Uint16Array(40).fill(65000), 10);
  const previousGeneration = stats.generation;
  stats.reset();
  assert.notEqual(stats.generation, previousGeneration);
  assert.equal(stats.query(0, 17, identity).count, 0);
  stats.append([3, 4, 5], 1);
  const result = stats.query(0, 17, identity);
  assert.equal(result.count, 3);
  assert.equal(result.min, 3);
  assert.equal(result.max, 5);
  assert.equal(result.avg, 4);
});

test("negative conversion scales still report ordered extrema", () => {
  const stats = index(16, 4);
  stats.append([1, 5, 9], 1);
  const result = stats.query(0, 3, [{ zero: 3, scale: -2 }, identity[1]]);
  assert.equal(result.min, -12);
  assert.equal(result.max, 4);
});

test("pixel envelopes include a single spike skipped by the previous stride", () => {
  const stats = index(200000);
  const samples = new Uint16Array(200000);
  samples[1] = 60000;
  stats.append(samples, 1);
  let directReads = 0;
  const source = {
    visibleSamples: samples.length,
    readVisibleAggregate: (start, end) => stats.query(start, end - start, identity),
    readVisibleSample: () => { directReads += 1; throw new Error("must use indexed buckets"); },
  };
  const buckets = aggregateVisibleBuckets(source, 1000);
  assert.equal(buckets[0].max, 60000);
  assert.equal(buckets[0].sum / buckets[0].count, 300);
  assert.equal(buckets.reduce((sum, bucket) => sum + bucket.count, 0), samples.length);
  assert.equal(directReads, 0);
});

test("pixel bucket fallback is exact and zoomed-in buckets stay in bounds", () => {
  const samples = [0, 60000, 0, 0, 7];
  const source = {
    visibleSamples: samples.length,
    readVisibleSample: (offset) => {
      assert.ok(offset >= 0 && offset < samples.length);
      return samples[offset];
    },
  };
  assert.equal(aggregateVisibleBuckets(source, 1)[0].max, 60000);
  assert.equal(aggregateVisibleBuckets(source, 1)[0].sum, 60007);
  assert.equal(aggregateVisibleBuckets(source, 10).length, 10);
  assert.deepEqual(aggregateVisibleBuckets({ visibleSamples: 0 }, 10), []);
});

test("aligned full history queries use summaries, without reading raw samples", () => {
  const stats = index(1024 * 1024);
  stats.append(new Uint16Array(stats.capacity).fill(42), 1);
  stats.codes = new Proxy(stats.codes, { get() { throw new Error("full blocks should use the index"); } });
  // queryRaw avoids query's one intentional read for the final sample.
  const raw = stats.queryRaw(0, stats.capacity);
  assert.equal(raw[0].count, stats.capacity);
  assert.equal(raw[0].min, 42);
  assert.equal(raw[0].max, 42);
  assert.equal(raw[0].sum, 42 * stats.capacity);
});

test("full 12M ring preserves sub-code RMS on a near-full-scale DC level", () => {
  const capacity = 12000000;
  const stats = index(capacity);
  const samples = new Uint16Array(capacity).fill(65534);
  samples[137] = 65535;
  stats.append(samples, 1);
  const conversion = [{ zero: 65534, scale: 1 }, identity[1]];
  const result = stats.query(0, capacity, conversion);
  const expectedRms = Math.sqrt((1 - 1 / capacity) / capacity);
  assert.ok(Math.abs(result.rms - expectedRms) < expectedRms * 1e-7);
  assert.equal(result.max, 1);
  close(result.sumSq, 1, "small signal squared sum");

  // Wrap the physical ring and overwrite the only transient.
  stats.append(new Uint16Array(256).fill(65534), 1);
  const wrapped = stats.query(256, capacity, conversion);
  assert.equal(wrapped.count, capacity);
  assert.equal(wrapped.min, 0);
  assert.equal(wrapped.max, 0);
  assert.equal(wrapped.rms, 0);
  assert.equal(wrapped.sumSq, 0);
});

test("fractional filtered codes preserve extrema and tiny AC RMS at a large DC level", () => {
  const stats = new SampleStatistics(new Float64Array(1024), new Uint8Array(1024), 32);
  const values = Float64Array.from({ length: 1024 }, (_, i) => 65500 + (i % 2 ? 0.00001 : -0.00001));
  stats.append(values, 10);
  const result = stats.query(0, 1024, [{ zero: 0, scale: 1 }, { zero: 65500, scale: 1 }]);
  assert.equal(result.minCode, values[0]);
  assert.equal(result.maxCode, values[1]);
  assert.ok(result.rms > 0);
  assert.ok(Math.abs(result.rms - 0.00001) < 1e-10);
  assert.ok(Math.abs(result.avg) < 1e-9);
});

test("replay from a nonzero serial indexes sparse physical slots and wrap correctly", () => {
  const stats = new SampleStatistics(new Float64Array(17).fill(65000), new Uint8Array(17).fill(10), 4);
  stats.reset(13);
  stats.append([10.25, 11.25, 12.25, 13.25, 14.25, 15.25, 16.25, 17.25], 1);
  assert.equal(stats.totalWritten, 21);
  assert.equal(stats.available, 8);
  assert.equal(stats.writeIndex, 4);
  const result = stats.query(0, 100, identity);
  assert.equal(result.count, 8);
  assert.equal(result.min, 10.25);
  assert.equal(result.max, 17.25);
  assert.equal(result.avg, 13.75);
  assert.equal(stats.query(13, 3, identity).avg, 11.25);
  assert.equal(stats.query(17, 4, identity).avg, 15.75);
  assert.throws(() => stats.reset(-1), /starting sample/);
});

test("replacing retained fractional samples refreshes wrapped blocks without moving the ring", () => {
  const stats = new SampleStatistics(new Float64Array(17), new Uint8Array(17), 4);
  stats.reset(13);
  const values = [10, 11, 12, 13, 14, 15, 16, 17].map((code) => ({ code, range: 1 }));
  stats.append(values.map((s) => s.code), 1);
  const generation = stats.generation;
  stats.replace(15, [5.125, 6.125, 7.125, 8.125], 10);
  values.splice(2, 4, ...[5.125, 6.125, 7.125, 8.125].map((code) => ({ code, range: 10 })));
  compare(stats.query(13, 8, identity), values, identity);
  assert.equal(stats.totalWritten, 21);
  assert.equal(stats.available, 8);
  assert.equal(stats.writeIndex, 4);
  assert.ok(stats.generation > generation);
  assert.throws(() => stats.replace(12, [1]), /outside retained/);
  assert.throws(() => stats.replace(20, [1, 2]), /outside retained/);
});
