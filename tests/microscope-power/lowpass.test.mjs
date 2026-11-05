import assert from "node:assert/strict";
import test from "node:test";
import { LowPassMeasurements, lowPassAlpha } from "../../pages/devices/microscope-power/lowpass.js";
import { SampleStatistics } from "../../pages/devices/microscope-power/statistics.js";
import { CaptureTimeline } from "../../pages/devices/microscope-power/timeline.js";
import { FRAME_FLAGS } from "../../pages/devices/microscope-power/protocol.js";

const identity = [{ zero: 0, scale: 1 }, { zero: 0, scale: 1 }];

function capture(capacity = 4096, frameSize = 256) {
  const raw = new SampleStatistics(new Uint16Array(capacity), new Uint8Array(capacity), frameSize);
  const timeline = new CaptureTimeline(capacity, frameSize);
  return { raw, timeline, filter: new LowPassMeasurements(raw, timeline) };
}

function append(model, values, { time, rate = 100000, range = 1, gap = false, timingOverrun = false, seq } = {}) {
  const start = model.raw.totalWritten;
  const previous = model.timeline.previous;
  const t0Us = time ?? (previous ? model.timeline.lastRawUs + previous.count * 1e6 / previous.rate : 0);
  const flags = (range === 10 ? FRAME_FLAGS.range10Ohm : 0) | (gap ? FRAME_FLAGS.gapBefore : 0) |
    (timingOverrun ? FRAME_FLAGS.timingOverrun : 0);
  model.raw.append(values, range);
  model.timeline.append({ t0Us, sampleRate: rate, count: values.length, flags, seq }, start);
}

function retainedValues(model) {
  const { raw, filter } = model;
  return Array.from({ length: raw.available }, (_, i) => filter.statistics.codes[(raw.totalWritten - raw.available + i) % raw.capacity]);
}

function reference(model, cutoffHz) {
  const { raw, timeline } = model;
  const start = raw.totalWritten - raw.available;
  let value = NaN;
  let range = null;
  let rate = null;
  const values = [];
  for (let serial = start; serial < raw.totalWritten; serial += 1) {
    const frame = timeline.frameAt(serial);
    const code = raw.codes[serial % raw.capacity];
    const nextRange = raw.ranges[serial % raw.capacity];
    const reset = !Number.isFinite(value) || nextRange !== range || frame.rate !== rate ||
      (serial === frame.startSerial && frame.gap);
    const period = serial === frame.startSerial && !reset
      ? timeline.timeAt(serial) - timeline.timeAt(serial - 1) : frame.period;
    value = reset ? code : value + lowPassAlpha(cutoffHz, period) * (code - value);
    range = nextRange;
    rate = frame.rate;
    values.push(value);
  }
  return values;
}

function compareValues(actual, expected, tolerance = 1e-9) {
  assert.equal(actual.length, expected.length);
  for (let i = 0; i < actual.length; i += 1) {
    assert.ok(Math.abs(actual[i] - expected[i]) < tolerance, `sample ${i}: ${actual[i]} != ${expected[i]}`);
  }
}

test("cutoff coefficient has an exact digital -3 dB point, including near Nyquist", () => {
  for (const normalizedCutoff of [0.00001, 0.01, 0.1, 0.3, 0.45]) {
    const alpha = lowPassAlpha(normalizedCutoff * 100000, 1 / 100000);
    const pole = 1 - alpha;
    const omega = 2 * Math.PI * normalizedCutoff;
    const real = alpha + pole * (1 - Math.cos(omega));
    const imaginary = pole * Math.sin(omega);
    const gainSquared = alpha ** 2 / (real ** 2 + imaginary ** 2);
    assert.ok(Math.abs(gainSquared - 0.5) < 1e-8);
  }
  assert.equal(lowPassAlpha(100000, 1 / 100000), lowPassAlpha(45000, 1 / 100000));
  for (const [cutoff, period] of [[0, 1e-5], [-1, 1e-5], [Infinity, 1e-5], [1, 0], [1, NaN]]) {
    assert.throws(() => lowPassAlpha(cutoff, period), /Invalid low-pass/);
  }
});

test("storage is lazy, raw capture is preserved and a DC input has no zero startup", () => {
  const model = capture();
  assert.equal(model.filter.statistics, null);
  append(model, new Uint16Array(256).fill(42000), { range: 10 });
  const rawBefore = model.raw.codes.slice();
  const rangesBefore = model.raw.ranges.slice();
  assert.equal(model.filter.sync(1), model.filter);
  assert.ok(model.filter.statistics.codes instanceof Float64Array);
  assert.deepEqual(model.raw.codes, rawBefore);
  assert.deepEqual(model.raw.ranges, rangesBefore);
  assert.equal(model.filter.statistics.query(0, 256, identity).min, 42000);
  assert.equal(model.filter.statistics.query(0, 256, identity).rms, 0);
  const generation = model.filter.generation;
  model.filter.sync(1);
  assert.equal(model.filter.generation, generation);
  assert.throws(() => model.filter.sync(NaN), /Invalid low-pass/);
});

test("a one-sample impulse is causal, monotonic after the peak and survives frame boundaries", () => {
  const model = capture(2048);
  for (let batch = 0; batch < 4; batch += 1) {
    const samples = new Uint16Array(256).fill(1000);
    if (batch === 0) samples[255] = 11000;
    append(model, samples);
    model.filter.sync(1000);
  }
  const values = retainedValues(model);
  assert.ok(values.slice(0, 255).every((value) => value === 1000));
  assert.ok(values[255] > 1000 && values[255] < 11000);
  for (let i = 256; i < values.length; i += 1) {
    assert.ok(values[i] <= values[i - 1]);
    assert.ok(values[i] >= 1000);
  }
  compareValues(values, reference(model, 1000));
});

test("measured timestamps correct only the tentative frame, matching a batch reference", () => {
  const model = capture();
  for (let i = 0; i < 3; i += 1) {
    append(model, Uint16Array.from({ length: 256 }, (_, j) => 20000 + ((i * 256 + j) * 131) % 17000),
      { time: [0, 3500, 7100][i], seq: i });
    model.filter.sync(100);
    compareValues(retainedValues(model), reference(model, 100));
  }
  const frozen = retainedValues(model).slice(0, 512);
  append(model, new Uint16Array(256).fill(25000), { time: 10700, seq: 3 });
  model.filter.sync(100);
  compareValues(retainedValues(model).slice(0, 512), frozen);
  compareValues(retainedValues(model), reference(model, 100));
});

test("a frame's first pole step uses the preceding frame interval, then its own measured interval", () => {
  const model = capture();
  append(model, new Uint16Array(256).fill(10000), { time: 0, seq: 0 });
  const next = new Uint16Array(256).fill(20000);
  append(model, next, { time: 2560, seq: 1 });
  model.filter.sync(1000);
  // The next timestamp revises frame 1 to 20 µs per point while the final
  // point of frame 0 remains exactly 10 µs before frame 1's first point.
  append(model, new Uint16Array(256).fill(20000), { time: 7680, seq: 2, timingOverrun: true });
  model.filter.sync(1000);
  const values = retainedValues(model);
  const first = 10000 + lowPassAlpha(1000, 0.00001) * 10000;
  const second = first + lowPassAlpha(1000, 0.00002) * (20000 - first);
  assert.ok(Math.abs(values[256] - first) < 1e-9);
  assert.ok(Math.abs(values[257] - second) < 1e-9);
  assert.ok(Math.abs(model.filter.samplePeriodAt(256) - 0.00001) < 1e-15);
  assert.equal(model.filter.samplePeriodAt(257), 0.00002);
  assert.equal(model.filter.samplePeriodAt(0), 0.00001);
  compareValues(values, reference(model, 1000));
});

test("packet batching does not change the filtered history or final pole state", () => {
  const streamed = capture();
  const batched = capture();
  for (let frame = 0; frame < 6; frame += 1) {
    const samples = Uint16Array.from({ length: 256 }, (_, i) => 28000 + ((frame * 256 + i) * 713) % 8000);
    const timing = { time: frame * 3670, seq: frame };
    append(streamed, samples, timing);
    append(batched, samples, timing);
    streamed.filter.sync(10);
    if (frame % 3 === 2) batched.filter.sync(10);
  }
  compareValues(retainedValues(streamed), retainedValues(batched));
  assert.deepEqual(streamed.filter.state, batched.filter.state);
});

test("live ring wrap retains the pole history and appending rereads at most two frames", () => {
  const wrapped = capture(768);
  const complete = capture(4096);
  for (let frame = 0; frame < 12; frame += 1) {
    const samples = Uint16Array.from({ length: 256 }, (_, i) => 40000 + ((frame * 256 + i) * 127) % 10000);
    const timing = { time: frame * 3700, seq: frame };
    append(wrapped, samples, timing);
    append(complete, samples, timing);
    const codes = wrapped.raw.codes;
    let reads = 0;
    wrapped.raw.codes = new Proxy(codes, { get(target, property) {
      if (/^\d+$/.test(String(property))) reads += 1;
      return target[property];
    } });
    wrapped.filter.sync(1);
    wrapped.raw.codes = codes;
    complete.filter.sync(1);
    assert.ok(reads <= 512, `frame ${frame} read ${reads} raw samples`);
    const oldest = wrapped.raw.totalWritten - wrapped.raw.available;
    const expected = Array.from({ length: wrapped.raw.available }, (_, i) => complete.filter.statistics.codes[oldest + i]);
    compareValues(retainedValues(wrapped), expected);
  }
});

test("revising a tentative period without another sample refreshes measurements and revision", () => {
  const model = capture();
  append(model, Uint16Array.from({ length: 256 }, (_, i) => 10000 + i * 10));
  model.filter.sync(100);
  const before = model.filter.statistics.query(0, 256, identity);
  const revision = model.filter.revision;
  model.timeline.previous.period = 1 / 75000;
  model.filter.sync(100);
  compareValues(retainedValues(model), reference(model, 100));
  assert.ok(model.filter.statistics.query(0, 256, identity).last > before.last);
  assert.ok(model.filter.revision > revision);
  assert.equal(model.filter.statistics.totalWritten, 256);
});

test("a real gap, range change and sample-rate change seed fresh data and split the plot", () => {
  const model = capture();
  append(model, new Uint16Array(256).fill(1000), { time: 0 });
  append(model, new Uint16Array(256).fill(10000), { time: 2560, range: 10 });
  append(model, new Uint16Array(256).fill(20000), { time: 5120, range: 10, rate: 50000 });
  append(model, new Uint16Array(256).fill(30000), { time: 20000, range: 10, rate: 50000, gap: true });
  model.filter.sync(1);
  const values = retainedValues(model);
  assert.equal(values[0], 1000);
  assert.equal(values[256], 10000);
  assert.equal(values[512], 20000);
  assert.equal(values[768], 30000);
  assert.equal(model.filter.samplePeriodAt(256), model.timeline.frameAt(256).period);
  assert.equal(model.filter.samplePeriodAt(512), model.timeline.frameAt(512).period);
  assert.equal(model.filter.samplePeriodAt(768), model.timeline.frameAt(768).period);
  assert.deepEqual(model.filter.segments(100, 900), [
    { startOffset: 0, endOffset: 156 }, { startOffset: 156, endOffset: 412 },
    { startOffset: 412, endOffset: 668 }, { startOffset: 668, endOffset: 900 },
  ]);
  compareValues(values, reference(model, 1));
});

test("a large cutoff is clamped to the measured rate, with nominal rate as a fallback", () => {
  const model = capture();
  append(model, new Uint16Array(256).fill(100), { rate: 10000 });
  model.timeline.previous.period = NaN;
  model.filter.sync(45000);
  assert.equal(model.filter.effectiveCutoffHz, 4500);
  assert.equal(model.filter.samplePeriod, 0.0001);
  append(model, new Uint16Array(256).fill(200), { time: 40000, rate: 10000 });
  model.filter.sync(45000);
  assert.equal(model.filter.effectiveCutoffHz, 0.45 / (0.04 / 256));
});

test("changing cutoff replays retained history consistently across pan, zoom and calibration", () => {
  const model = capture(4096);
  for (let frame = 0; frame < 6; frame += 1) append(model,
    Uint16Array.from({ length: 256 }, (_, i) => 60000 + ((frame * 256 + i) * 47) % 5000));
  model.filter.sync(1000);
  const first = retainedValues(model);
  model.filter.sync(10);
  compareValues(retainedValues(model), reference(model, 10));
  const generation = model.filter.generation;
  const expected = retainedValues(model);
  model.filter.statistics.query(256, 100, identity);
  model.filter.statistics.query(768, 512, [{ zero: 63000, scale: 0.7 }, { zero: 62000, scale: 0.07 }]);
  model.filter.sync(10);
  assert.equal(model.filter.generation, generation);
  compareValues(retainedValues(model), expected);
  model.filter.sync(1000);
  compareValues(retainedValues(model), first);
});

test("wrapped retained history can be replayed from a nonzero physical position after falling behind", () => {
  const model = capture(768);
  append(model, new Uint16Array(256).fill(10000));
  model.filter.sync(10);
  for (let frame = 1; frame < 5; frame += 1) append(model,
    Uint16Array.from({ length: 256 }, (_, i) => 10000 + frame * 1000 + i));
  assert.equal(model.raw.totalWritten - model.raw.available, 512);
  model.filter.sync(10);
  compareValues(retainedValues(model), reference(model, 10));
  assert.equal(model.filter.statistics.available, model.raw.available);
  assert.equal(model.filter.statistics.totalWritten, model.raw.totalWritten);
  const result = model.filter.statistics.query(0, 100000, identity);
  assert.equal(result.count, 768);
  assert.equal(result.min, 12000);
  assert.ok(result.max < 14255);
  model.filter.sync(100);
  compareValues(retainedValues(model), reference(model, 100));
});

test("a new capture generation and manual reset cannot reuse the previous signal state", () => {
  const model = capture();
  append(model, new Uint16Array(256).fill(62000));
  model.filter.sync(1);
  const allocation = model.filter.statistics.codes;
  model.raw.reset();
  model.timeline.reset();
  append(model, new Uint16Array(256).fill(123));
  model.filter.sync(1);
  assert.equal(model.filter.statistics.query(0, 256, identity).min, 123);
  model.filter.reset();
  assert.equal(model.filter.statistics.codes, allocation);
  model.filter.sync(1);
  assert.equal(model.filter.statistics.query(0, 256, identity).max, 123);
});

test("passband, cutoff and high-frequency attenuation follow the specified one-pole response", () => {
  const rate = 1000;
  const cutoff = 10;
  const frameSize = 100;
  for (const frequency of [1, cutoff, 100]) {
    const model = capture(10000, frameSize);
    for (let frame = 0; frame < 100; frame += 1) {
      append(model, Uint16Array.from({ length: frameSize }, (_, i) =>
        Math.round(30000 + 10000 * Math.sin(2 * Math.PI * frequency * (frame * frameSize + i) / rate))), { rate });
    }
    model.filter.sync(cutoff);
    const input = model.raw.query(5000, 5000, identity);
    const output = model.filter.statistics.query(5000, 5000, identity);
    const alpha = lowPassAlpha(cutoff, 1 / rate);
    const pole = 1 - alpha;
    const expectedGain = alpha / Math.sqrt(1 + pole ** 2 - 2 * pole * Math.cos(2 * Math.PI * frequency / rate));
    assert.ok(Math.abs(output.rms / input.rms - expectedGain) < 1e-5, `${frequency} Hz gain`);
    if (frequency === 1) assert.ok(output.rms / input.rms > 0.99);
    if (frequency === cutoff) assert.ok(Math.abs(output.rms / input.rms - Math.SQRT1_2) < 1e-5);
    if (frequency === 100) assert.ok(output.rms / input.rms < 0.11);
  }
});
