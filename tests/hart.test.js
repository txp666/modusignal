import assert from "node:assert/strict";
import test from "node:test";

import {
  buildHartFrame,
  parseCommand0Device,
  parseHartCommand33Variables,
  parseHartFrame,
  getHartUnitString,
  verifyHartChecksum,
} from "../src/hart/hart.js";
import {
  createHartSetOutputCommand,
  encodeHartStandardRequestData,
  getHartCommandDefinition,
  getHartStandardRequestFields,
  HART_UNIVERSAL_COMMANDS,
  normalizeHartConfig,
  validateHartCommandData,
} from "../src/devices/hart-device.js";

function withChecksum(body) {
  let checksum = 0;
  body.forEach((byte) => {
    checksum ^= byte;
  });
  return Uint8Array.from([...body, checksum]);
}

function floatBytes(value) {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setFloat32(0, value, false);
  return bytes;
}

const helpers = {
  bytesToHex: (bytes) => [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join(" "),
  parseHexPayload: (text) => Uint8Array.from(text.trim().split(/\s+/).map((part) => Number.parseInt(part, 16))),
};

test("short address supports the full 0-63 polling range", () => {
  const frame = buildHartFrame({ command: 0, pollAddress: 63, preambleLength: 5 });
  assert.equal(frame[5], 0x02);
  assert.equal(frame[6], 0xbf);
  assert.ok(verifyHartChecksum(frame.subarray(5)));
});

test("long address uses the expanded device type and device id", () => {
  const frame = buildHartFrame({
    command: 1,
    preambleLength: 5,
    device: { discovered: true, expandedDeviceType: 0x1234, deviceId: 0xabcdef },
  });
  assert.deepEqual([...frame.subarray(5, 11)], [0x82, 0x92, 0x34, 0xab, 0xcd, 0xef]);
});

test("commands above 255 use command 31 extended framing", () => {
  const frame = buildHartFrame({
    command: 513,
    preambleLength: 5,
    device: { discovered: true, expandedDeviceType: 0x1234, deviceId: 0xabcdef },
    commandData: Uint8Array.from([0xaa]),
  });
  assert.deepEqual([...frame.subarray(11, 16)], [31, 3, 0x02, 0x01, 0xaa]);
});

test("response parser accepts expansion bytes and decodes extended commands", () => {
  const normal = withChecksum([0x26, 0x80, 0xaa, 1, 7, 0, 0, 4, ...floatBytes(1.5)]);
  const parsed = parseHartFrame(normal);
  assert.equal(parsed.expansionByteCount, 1);
  assert.equal(parsed.command, 1);
  assert.equal(parsed.pollAddress, 0);

  const extended = withChecksum([0x06, 0x80, 31, 5, 0, 0, 0x02, 0x01, 0x55]);
  const parsedExtended = parseHartFrame(extended);
  assert.equal(parsedExtended.command, 513);
  assert.deepEqual([...parsedExtended.data], [0x55]);
});

test("command 0 identity is accepted only for successful valid identity data", () => {
  const identity = [0xfe, 0x12, 0x34, 5, 7, 2, 3, 0x29, 0, 0x01, 0x02, 0x03];
  const ok = parseHartFrame(withChecksum([0x06, 0x80, 0, 14, 0, 0, ...identity]));
  assert.equal(parseCommand0Device(ok).expandedDeviceType, 0x1234);

  const error = parseHartFrame(withChecksum([0x06, 0x80, 0, 14, 5, 0, ...identity]));
  assert.equal(parseCommand0Device(error), null);
});

test("standard dynamic variable aliases 246-249 map to PV/SV/TV/QV", () => {
  const data = [];
  [246, 247, 248, 249].forEach((code, index) => data.push(code, 4, ...floatBytes(index + 1)));
  const parsed = parseHartCommand33Variables(Uint8Array.from(data));
  assert.equal(parsed.variables.pv.value, 1);
  assert.equal(parsed.variables.sv.value, 2);
  assert.equal(parsed.variables.tv.value, 3);
  assert.equal(parsed.variables.qv.value, 4);
});

test("engineering units follow Common Table 2 revision 27", () => {
  assert.equal(getHartUnitString(1), "inH₂O");
  assert.equal(getHartUnitString(32), "°C");
  assert.equal(getHartUnitString(33), "°F");
  assert.equal(getHartUnitString(35), "K");
  assert.equal(getHartUnitString(36), "mV");
  assert.equal(getHartUnitString(39), "mA");
  assert.equal(getHartUnitString(57), "%");
  assert.equal(getHartUnitString(58), "V");
  assert.equal(getHartUnitString(237), "MPa");
});

test("unit expansion codes are resolved with Device Variable Classification", () => {
  assert.equal(getHartUnitString(189, 103), "bbl (US)/s");
  assert.equal(getHartUnitString(189, 104), "bbl (US)/min");
  assert.equal(getHartUnitString(189, 105), "bbl (US)/h");
  assert.equal(getHartUnitString(189, 106), "bbl (US)/d");
  assert.match(getHartUnitString(189), /189/);
});

test("command catalog matches HARTLink Studio defaults and validates payloads", () => {
  assert.ok(HART_UNIVERSAL_COMMANDS.some((entry) => entry.value === 50));
  assert.ok(HART_UNIVERSAL_COMMANDS.some((entry) => entry.value === 109));
  assert.equal(HART_UNIVERSAL_COMMANDS.some((entry) => entry.value === 36), false);
  assert.deepEqual([...getHartCommandDefinition(33).defaultData], [246, 247, 248, 249]);
  assert.equal(validateHartCommandData(17, new Uint8Array(0))?.includes("24"), true);
  assert.equal(validateHartCommandData(17, new Uint8Array(24)), null);
});

test("known read commands receive safe defaults and writes require confirmation", () => {
  const device = { discovered: true, expandedDeviceType: 0x1234, deviceId: 0xabcdef };
  const read = createHartSetOutputCommand({}, normalizeHartConfig({ command: 33, device }), helpers);
  assert.equal(read.supported, true);
  assert.deepEqual([...read.commandData], [246, 247, 248, 249]);
  assert.equal(read.requiresConfirmation, false);

  const write = createHartSetOutputCommand(
    {},
    normalizeHartConfig({ command: 44, standardCommandValues: { 44: { unit_code: "4" } }, device }),
    helpers,
  );
  assert.equal(write.supported, true);
  assert.equal(write.requiresConfirmation, true);
  assert.deepEqual([...write.commandData], [4]);
});

test("standard command values are encoded without requiring HEX input", () => {
  assert.deepEqual(
    [...encodeHartStandardRequestData(6, { polling_address: "63", loop_current_mode: "0" })],
    [63, 0],
  );
  assert.deepEqual([...encodeHartStandardRequestData(34, { damping_seconds: "2.5" })], [0x40, 0x20, 0, 0]);
  assert.deepEqual(
    [...encodeHartStandardRequestData(35, { unit_code: "32", upper_range: "100", lower_range: "0" })],
    [32, 0x42, 0xc8, 0, 0, 0, 0, 0, 0],
  );
  assert.deepEqual([...encodeHartStandardRequestData(40, { fixed_current: "12.5" })], [0x41, 0x48, 0, 0]);
  assert.equal(encodeHartStandardRequestData(17, { message: "HELLO" }).length, 24);
  assert.equal(encodeHartStandardRequestData(18, { tag: "TAG1", descriptor: "DEVICE", date: "2026-07-24" }).length, 21);
  assert.equal(getHartStandardRequestFields(43).length, 0);
  assert.equal(getHartStandardRequestFields(82).length, 4);
  const unitField = getHartStandardRequestFields(35).find((entry) => entry.key === "unit_code");
  assert.equal(unitField.type, "unit-select");
  assert.equal(unitField.options.find((entry) => entry.value === "32").label, "32 · °C");
  assert.match(unitField.options.find((entry) => entry.value === "189").label, /扩展单位/);
});

test("invalid engineering values are rejected before a HART frame is built", () => {
  assert.throws(() => encodeHartStandardRequestData(6, { polling_address: "64", loop_current_mode: "1" }), /63/);
  assert.throws(() => encodeHartStandardRequestData(35, { unit_code: "32", upper_range: "abc", lower_range: "0" }));
  assert.throws(() => encodeHartStandardRequestData(18, { tag: "TAG", descriptor: "DEVICE", date: "2026-02-30" }));
});
