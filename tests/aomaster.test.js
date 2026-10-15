import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  AOMASTER_MIN_WAVE_PERIOD_MS,
  AOMASTER_MAX_WAVE_PERIOD_MS,
  buildAomasterRegisterValues,
  buildAomasterWriteFrames,
  createAOMasterReadCommand,
  normalizeAomasterWaveState,
  parseAOMasterTelemetry,
  resetAomasterRxBuffer,
} from "../src/devices/aomaster.js";
import { appendCrc, verifyCrc } from "../src/modbus/modbus.js";

function frameRegister(frame, index) {
  return (frame[7 + index * 2] << 8) | frame[8 + index * 2];
}

test("all periodic waveforms enforce 20..65535 ms at the command boundary", () => {
  for (const waveform of ["ramp", "square", "triangle", "sine"]) {
    for (const [requested, expected] of [[-1, 20], [0, 1000], ["0", 1000], [1, 20], [19, 20], [20, 20], [25, 25], [25.9, 25], [65535, 65535], [65536, 65535], [NaN, 1000]]) {
      const state = { mode: "voltage", waveform, wavePeriodMs: requested };
      assert.equal(normalizeAomasterWaveState(state, state.mode).wavePeriodMs, expected);
      assert.equal(buildAomasterRegisterValues(state)[4], expected);
      const [frame] = buildAomasterWriteFrames(state, 1);
      assert.equal(frameRegister(frame, 4), expected);
      assert.ok(verifyCrc(frame));
    }
  }
});

test("period HTML limits match command limits and allow 25 ms for 40 Hz", () => {
  const html = readFileSync(new URL("../pages/devices/aomaster.html", import.meta.url), "utf8");
  const input = html.match(/<input\b[^>]*id="wavePeriodMs"[^>]*>/)?.[0];
  assert.ok(input);
  assert.match(input, new RegExp(`min="${AOMASTER_MIN_WAVE_PERIOD_MS}"`));
  assert.match(input, new RegExp(`max="${AOMASTER_MAX_WAVE_PERIOD_MS}"`));
  assert.match(input, /step="1"/);
});

test("step timing and infinite loops do not inherit the periodic minimum", () => {
  const state = { mode: "current", waveform: "step", stepSequence: [4, 20], stepDwellMs: 1, stepLoops: 0, wavePeriodMs: 1 };
  const [sequence, header] = buildAomasterWriteFrames(state, 1);
  assert.equal((sequence[2] << 8) | sequence[3], 7);
  assert.deepEqual([frameRegister(sequence, 0), frameRegister(sequence, 1)], [4000, 20000]);
  assert.deepEqual(Array.from({ length: 6 }, (_, index) => frameRegister(header, index)), [0, 1, 2, 1, 0, 0]);
  assert.ok(verifyCrc(sequence));
  assert.ok(verifyCrc(header));
  assert.equal(buildAomasterRegisterValues({ ...state, stepDwellMs: 0 })[3], 1);
  assert.equal(buildAomasterRegisterValues({ ...state, stepDwellMs: 65536 })[3], 65535);
  assert.equal(buildAomasterRegisterValues({ ...state, stepLoops: 65536 })[4], 65535);
});

test("constant output retains zero period in its register header", () => {
  assert.deepEqual(buildAomasterRegisterValues({ mode: "voltage", waveform: "constant", setpoint: 5 }), [1, 0, 5000, 5000, 0, 0]);
});

test("seven-register readback preserves engineering units and identifies command values", () => {
  assert.deepEqual([...createAOMasterReadCommand({ slaveId: 1 })], [1, 3, 0, 0, 0, 7, 4, 8]);
  for (const [code, mode, rawValue, unit] of [[0, "current", 12000, "mA"], [1, "voltage", 5000, "V"]]) {
    resetAomasterRxBuffer();
    const registers = [code, 5, 0, 10000, 20, 500, rawValue];
    const frame = appendCrc(new Uint8Array([1, 3, 14, ...registers.flatMap((value) => [value >> 8, value & 0xff])]));
    const telemetry = parseAOMasterTelemetry(frame, { slaveId: 1 });
    assert.equal(telemetry.mode, mode);
    assert.equal(telemetry.unit, unit);
    assert.equal(telemetry.value, rawValue / 1000);
    assert.match(telemetry.fieldName, /输出指令回读|Output Command Readback/);
  }
});
