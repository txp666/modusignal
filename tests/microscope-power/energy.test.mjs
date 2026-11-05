import assert from "node:assert/strict";
import test from "node:test";
import { EnergyStatistics } from "../../pages/devices/microscope-power/energy.js";
import { CaptureTimeline } from "../../pages/devices/microscope-power/timeline.js";
import { FRAME_FLAGS } from "../../pages/devices/microscope-power/protocol.js";

const identity = { zero: 0, scale: 1 };
const entry = (time, count, period, gap = false) => ({ time, count, period, gap });
function close(actual, expected, tolerance = 1e-12) {
  assert.ok(Math.abs(actual - expected) <= tolerance * Math.max(1, Math.abs(expected)), `${actual} != ${expected}`);
}

test("3.3 V at 10 mA for one second gives 0.033 J and 0.033 W", () => {
  const energy = new EnergyStatistics();
  assert.equal(energy.append(new Uint16Array(256).fill(10000), identity, entry(0, 256, 1 / 256), 3.3), energy);
  const result = energy.snapshot(3.3);
  assert.equal(result.count, 256);
  close(result.durationSeconds, 1);
  close(result.chargeMicroampSeconds, 10000);
  close(result.energyJoules, 0.033);
  close(result.averageWatts, 0.033);
  close(result.lastWatts, 0.033);
  assert.equal(result.estimatedTail, true);
  assert.equal(result.gapCount, 0);
  assert.equal(result.missingSeconds, 0);
});

test("frame-specific periods and range calibrations integrate each received sample", () => {
  const energy = new EnergyStatistics();
  // First frame: 10 and 30 µA for 0.25 s each, then 20 and 40 µA for 0.5 s each.
  energy.append([110, 130], { zero: 100, scale: 1 }, entry(0, 2, 0.25), 5);
  energy.append([1200, 1400], { zero: 1000, scale: 0.1 }, entry(0.5, 2, 0.5), 5);
  const result = energy.snapshot(5);
  assert.equal(result.count, 4);
  close(result.durationSeconds, 1.5);
  close(result.chargeMicroampSeconds, 40);
  close(result.energyJoules, 0.0002);
  close(result.averageWatts, 0.0002 / 1.5);
  close(result.lastWatts, 0.0002);
});

test("a corrected pending period is read on snapshots and finalized exactly once", () => {
  const energy = new EnergyStatistics();
  const first = entry(0, 256, 1 / 256);
  energy.append(new Uint16Array(256).fill(10000), identity, first, 3.3);
  close(energy.snapshot(3.3).energyJoules, 0.033);
  first.period = 2 / 256;
  for (let i = 0; i < 4; i += 1) {
    close(energy.snapshot(3.3).energyJoules, 0.066);
    close(energy.snapshot(3.3).durationSeconds, 2);
  }
  energy.append(new Uint16Array(256).fill(20000), identity, entry(2, 256, 1 / 256), 3.3);
  const final = energy.snapshot(3.3);
  close(final.durationSeconds, 3);
  close(final.chargeMicroampSeconds, 40000);
  close(final.energyJoules, 0.132);
  assert.equal(final.count, 512);
  for (let i = 0; i < 4; i += 1) assert.deepEqual(energy.snapshot(3.3), final);
});

test("first-frame gap is ignored and later missing intervals never contribute charge", () => {
  const energy = new EnergyStatistics();
  energy.append([10], identity, entry(10, 1, 1, true), 3.3);
  assert.equal(energy.snapshot(1).gapCount, 0);
  energy.append([20], identity, entry(13, 1, 0.5, true), 3.3);
  let result = energy.snapshot(1);
  close(result.durationSeconds, 1.5);
  close(result.chargeMicroampSeconds, 20);
  close(result.missingSeconds, 2);
  assert.equal(result.gapCount, 1);
  energy.append([20], identity, entry(14.5, 1, 0.5, true), 3.3);
  result = energy.snapshot(1);
  close(result.durationSeconds, 2);
  close(result.chargeMicroampSeconds, 30);
  close(result.missingSeconds, 3);
  assert.equal(result.gapCount, 2);
});

test("a declared gap with no positive missing interval still records a boundary", () => {
  const energy = new EnergyStatistics();
  energy.append([100], identity, entry(0, 1, 1), 3.3);
  energy.append([200], identity, entry(0.75, 1, 0.25, true), 3.3);
  const result = energy.snapshot(1);
  assert.equal(result.gapCount, 1);
  assert.equal(result.missingSeconds, 0);
  close(result.chargeMicroampSeconds, 150);
});

test("capture timeline correction and ring replacement cannot erase accumulated energy", () => {
  const timeline = new CaptureTimeline(8, 4);
  const energy = new EnergyStatistics();
  const samples = new Uint16Array(4).fill(1000);
  for (let frame = 0; frame < 24; frame += 1) {
    const start = frame * 4;
    timeline.append({ t0Us: frame * 6000, sampleRate: 1000, count: 4, flags: 0, seq: frame }, start);
    energy.append(samples, identity, timeline.frameAt(start), 3.3);
  }
  const result = energy.snapshot(3.3);
  assert.equal(timeline.frameAt(0), null);
  assert.equal(result.count, 96);
  close(result.durationSeconds, 0.144);
  close(result.chargeMicroampSeconds, 144);
  close(result.energyJoules, 0.0004752);
});

test("a real timeline range gap keeps nominal tail duration without bridging the settle interval", () => {
  const timeline = new CaptureTimeline(32, 4);
  const energy = new EnergyStatistics();
  timeline.append({ t0Us: 0, sampleRate: 1000, count: 4, flags: 0, seq: 0 }, 0);
  energy.append([1000, 1000, 1000, 1000], identity, timeline.frameAt(0), 3.3);
  timeline.append({ t0Us: 12000, sampleRate: 1000, count: 4, flags: FRAME_FLAGS.gapBefore | FRAME_FLAGS.range10Ohm, seq: 1 }, 4);
  energy.append([10000, 10000, 10000, 10000], { zero: 0, scale: 0.1 }, timeline.frameAt(4), 3.3);
  const result = energy.snapshot(3.3);
  close(result.durationSeconds, 0.008);
  close(result.missingSeconds, 0.008);
  close(result.energyJoules, 0.0000264);
  assert.equal(result.gapCount, 1);
});

test("missing voltage still accumulates charge but snapshots cannot invent historical voltage", () => {
  for (const voltage of [undefined, null, NaN, Infinity, -Infinity, -3.3, "3.3"]) {
    const energy = new EnergyStatistics();
    energy.append([10000], identity, entry(0, 1, 1), voltage);
    const result = energy.snapshot(3.3);
    assert.equal(result.energyJoules, null);
    assert.equal(result.averageWatts, null);
    assert.equal(result.lastWatts, null);
    assert.equal(result.chargeMicroampSeconds, 10000);
    assert.equal(result.durationSeconds, 1);
    assert.equal(result.energyDurationSeconds, 0);
    assert.equal(result.voltageMissingSeconds, 1);
    assert.equal(result.voltageMissingCount, 1);
  }
});

test("each frame's actual voltage determines energy and later voltage cannot rescale history", () => {
  const energy = new EnergyStatistics();
  energy.append([10000], identity, entry(0, 1, 1), 3.3);
  energy.append([20000], identity, entry(1, 1, 2), 5);
  const result = energy.snapshot();
  close(result.durationSeconds, 3);
  close(result.energyDurationSeconds, 3);
  close(result.chargeMicroampSeconds, 50000);
  close(result.energyJoules, 0.233);
  close(result.averageWatts, 0.233 / 3);
  close(result.lastWatts, 0.1);
  assert.equal(result.voltageMissingCount, 0);
  assert.equal(result.voltageMissingSeconds, 0);
  for (const latestVoltage of [null, 0, 1, 3.3, 5, NaN]) {
    assert.deepEqual(energy.snapshot(latestVoltage), result);
  }
});

test("partial voltage coverage excludes unknown intervals from energy and its average denominator", () => {
  const energy = new EnergyStatistics();
  energy.append([10000], identity, entry(0, 1, 1));
  energy.append([10000], identity, entry(1, 1, 1), 3.3);
  energy.append([20000], identity, entry(2, 1, 2));
  energy.append([20000], identity, entry(4, 1, 0.5), 0);
  let result = energy.snapshot();
  close(result.durationSeconds, 4.5);
  close(result.chargeMicroampSeconds, 70000);
  close(result.energyDurationSeconds, 1.5);
  close(result.voltageMissingSeconds, 3);
  assert.equal(result.voltageMissingCount, 2);
  close(result.energyJoules, 0.033);
  close(result.averageWatts, 0.022);
  assert.equal(result.lastWatts, 0);
  energy.append([0], identity, entry(4.5, 1, 0.5), null);
  result = energy.snapshot(5);
  close(result.energyJoules, 0.033);
  close(result.averageWatts, 0.022);
  close(result.voltageMissingSeconds, 3.5);
  assert.equal(result.voltageMissingCount, 3);
  assert.equal(result.lastWatts, null);
});

test("an observed zero volts is valid coverage and produces zero signed power", () => {
  const energy = new EnergyStatistics();
  energy.append([0], { zero: 100, scale: 1 }, entry(0, 1, 1), 0);
  const result = energy.snapshot(3.3);
  assert.equal(result.energyJoules, 0);
  assert.equal(result.averageWatts, 0);
  assert.equal(result.lastWatts, 0);
  assert.equal(result.energyDurationSeconds, 1);
  assert.equal(result.voltageMissingCount, 0);
  assert.equal(result.voltageMissingSeconds, 0);
  assert.equal(result.chargeMicroampSeconds, -100);
});

test("pending time corrections revise the missing-voltage duration without inventing energy", () => {
  const energy = new EnergyStatistics();
  const first = entry(0, 4, 0.25);
  energy.append([100, 100, 100, 100], identity, first);
  first.period = 0.5;
  const provisional = energy.snapshot(5);
  assert.equal(provisional.durationSeconds, 2);
  assert.equal(provisional.voltageMissingSeconds, 2);
  assert.equal(provisional.energyJoules, null);
  energy.append([100], identity, entry(2, 1, 1), 3.3);
  const result = energy.snapshot();
  assert.equal(result.chargeMicroampSeconds, 300);
  assert.equal(result.durationSeconds, 3);
  assert.equal(result.energyDurationSeconds, 1);
  assert.equal(result.voltageMissingSeconds, 2);
  assert.equal(result.voltageMissingCount, 4);
  close(result.energyJoules, 0.00033);
  close(result.averageWatts, 0.00033);
});

test("the pending frame keeps its own voltage when its sample period is corrected", () => {
  const energy = new EnergyStatistics();
  const second = entry(1, 1, 1);
  energy.append([10000], identity, entry(0, 1, 1), 3.3);
  energy.append([10000], identity, second, 5);
  close(energy.snapshot().energyJoules, 0.083);
  second.period = 2;
  close(energy.snapshot(0).energyJoules, 0.133);
  energy.append([0], identity, entry(3, 1, 1), 3.3);
  close(energy.snapshot(12).energyJoules, 0.133);
  close(energy.snapshot().energyDurationSeconds, 4);
  close(energy.snapshot().averageWatts, 0.133 / 4);
});

test("signed zero noise cancels rather than acquiring a positive rectification bias", () => {
  const energy = new EnergyStatistics();
  energy.append([999, 1001, 999, 1001], { zero: 1000, scale: 0.1 }, entry(0, 4, 0.25), 3.3);
  const result = energy.snapshot(3.3);
  assert.equal(result.chargeMicroampSeconds, 0);
  assert.equal(result.energyJoules, 0);
  assert.equal(result.averageWatts, 0);
  close(result.lastWatts, 0.00000033);
  energy.append([990], { zero: 1000, scale: 0.1 }, entry(1, 1, 1), 3.3);
  close(energy.snapshot(3.3).chargeMicroampSeconds, -1);
  close(energy.snapshot(3.3).energyJoules, -0.0000033);
});

test("small charge survives cancellation of large positive and negative totals", () => {
  const energy = new EnergyStatistics();
  energy.append([1], { zero: 0, scale: 1e16 }, entry(0, 1, 1), 3.3);
  energy.append([1], identity, entry(1, 1, 1), 3.3);
  energy.append([0], { zero: 1, scale: 1e16 }, entry(2, 1, 1), 3.3);
  assert.equal(energy.snapshot(1).chargeMicroampSeconds, 1);
  assert.equal(energy.snapshot(1).durationSeconds, 3);
});

test("sample and conversion mutation cannot rewrite previously received charge", () => {
  const energy = new EnergyStatistics();
  const samples = new Uint16Array([100, 200]);
  const conversion = { zero: 50, scale: 2 };
  energy.append(samples, conversion, entry(0, 2, 0.5), 3.3);
  const expected = energy.snapshot(3.3);
  samples.fill(65535);
  conversion.zero = 0;
  conversion.scale = 1e6;
  assert.deepEqual(energy.snapshot(3.3), expected);
});

test("invalid sample, conversion and frame parameters leave every accumulated field intact", () => {
  const energy = new EnergyStatistics();
  energy.append([10], identity, entry(0, 1, 1), 3.3);
  energy.append([20], identity, entry(1, 1, 1), 3.3);
  const expected = energy.snapshot(3.3);
  const cases = [
    [null, identity, entry(2, 1, 1)],
    [new DataView(new ArrayBuffer(2)), identity, entry(2, 1, 1)],
    [[NaN], identity, entry(2, 1, 1)],
    [[Infinity], identity, entry(2, 1, 1)],
    [[-1], identity, entry(2, 1, 1)],
    [[65536], identity, entry(2, 1, 1)],
    [[0.5], identity, entry(2, 1, 1)],
    [[1], null, entry(2, 1, 1)],
    [[1], { zero: NaN, scale: 1 }, entry(2, 1, 1)],
    [[1], { zero: 0, scale: Infinity }, entry(2, 1, 1)],
    [[65535], { zero: 0, scale: Number.MAX_VALUE }, entry(2, 1, 1)],
    [[1], identity, null],
    [[], identity, entry(2, 0, 1)],
    [[1], identity, entry(2, 2, 1)],
    [[1], identity, entry(NaN, 1, 1)],
    [[1], identity, entry(-1, 1, 1)],
    [[1], identity, entry(2, 1, 0)],
    [[1], identity, entry(2, 1, Infinity)],
    [[1], identity, { ...entry(2, 1, 1), gap: "true" }],
  ];
  for (const args of cases) {
    assert.throws(() => energy.append(...args), /Invalid/);
    assert.deepEqual(energy.snapshot(3.3), expected);
  }
});

test("duplicate frame objects, duplicate timestamps and time restarts never count twice", () => {
  const energy = new EnergyStatistics();
  const first = entry(0, 1, 1);
  const second = entry(1, 1, 1);
  energy.append([10], identity, first, 3.3);
  energy.append([20], identity, second, 3.3);
  const expected = energy.snapshot(1);
  for (const repeated of [first, second, entry(1, 1, 1), entry(0, 1, 1)]) {
    assert.throws(() => energy.append([20], identity, repeated), /must increase/);
    assert.deepEqual(energy.snapshot(1), expected);
  }
  energy.reset();
  energy.append([5], identity, entry(0, 1, 1), 3.3);
  assert.equal(energy.snapshot(1).chargeMicroampSeconds, 5);
});

test("an invalid external pending period is rejected without committing stale data", () => {
  const energy = new EnergyStatistics();
  const first = entry(0, 1, 1);
  energy.append([10], identity, first, 3.3);
  const expected = energy.snapshot(1);
  first.period = NaN;
  assert.throws(() => energy.snapshot(1), /Invalid sample period/);
  assert.throws(() => energy.append([20], identity, entry(1, 1, 1)), /Invalid sample period/);
  first.period = 1;
  assert.deepEqual(energy.snapshot(1), expected);
});

test("reset clears pending time, missing intervals, compensated totals and power state", () => {
  const energy = new EnergyStatistics();
  energy.append([10], identity, entry(0, 1, 1), 3.3);
  energy.append([20], identity, entry(3, 1, 1, true), 3.3);
  assert.equal(energy.reset(), energy);
  assert.deepEqual(energy.snapshot(3.3), {
    count: 0, durationSeconds: 0, chargeMicroampSeconds: 0,
    energyJoules: null, averageWatts: null, lastWatts: null,
    energyDurationSeconds: 0, voltageMissingSeconds: 0, voltageMissingCount: 0,
    estimatedTail: false, gapCount: 0, missingSeconds: 0,
  });
  assert.equal(energy.snapshot(null).energyJoules, null);
});
