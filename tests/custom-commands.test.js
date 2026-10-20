import test from "node:test";
import assert from "node:assert/strict";
import { buildCustomCommand, parseCommandLibrary, serializeCommandLibrary, mergeCommandLibraries } from "../src/features/custom/command-library.js";
import { createCommandRunner } from "../src/features/custom/command-runner.js";
import { createDeviceSetOutputCommand } from "../src/protocols.js";

const textCommand = { name: "Version", format: "ascii", payload: "READ?", lineEnding: "\\r\\n", checksum: "none" };
const hexCommand = { name: "Read registers", format: "hex", payload: "01 03 00 00 00 02", lineEnding: "", checksum: "modbus" };

test("preview includes UTF-8 bytes and every supported line ending", () => {
  assert.equal(buildCustomCommand(textCommand).hex, "52 45 41 44 3F 0D 0A");
  for (const [lineEnding, expected] of [["", ""], ["\\r", "0D"], ["\\n", "0A"], ["\\r\\n", "0D 0A"]]) {
    assert.equal(buildCustomCommand({ ...textCommand, payload: "中", lineEnding }).hex, `E4 B8 AD${expected ? ` ${expected}` : ""}`);
  }
});

test("CRC16 follows Modbus low-byte-first vectors and HEX ignores text endings", () => {
  assert.equal(buildCustomCommand(hexCommand).hex, "01 03 00 00 00 02 C4 0B");
  assert.equal(buildCustomCommand({ ...textCommand, payload: "123456789", lineEnding: "", checksum: "modbus" }).checksumHex, "37 4B");
  assert.equal(buildCustomCommand({ ...hexCommand, lineEnding: "\\r\\n" }).hex, "01 03 00 00 00 02 C4 0B");
});

test("SUM8 wraps, XOR8 is bytewise, and text endings participate in checksums", () => {
  const command = { ...hexCommand, payload: "FF 02", checksum: "sum8" };
  assert.equal(buildCustomCommand(command).hex, "FF 02 01");
  assert.equal(buildCustomCommand({ ...command, checksum: "xor8" }).hex, "FF 02 FD");
  assert.equal(buildCustomCommand({ ...textCommand, payload: "A", lineEnding: "\\r", checksum: "sum8" }).hex, "41 0D 4E");
});

test("malformed payloads and unknown options are rejected before any send", () => {
  for (const patch of [{ payload: "" }, { payload: "x".repeat(8193) }, { format: "binary" }, { checksum: "crc" }, { lineEnding: "oops" }]) {
    assert.throws(() => buildCustomCommand({ ...textCommand, ...patch }));
  }
  for (const payload of ["01 3G", "01 123", " "]) assert.throws(() => buildCustomCommand({ ...hexCommand, payload }));
});

test("saved library round trips without extra fields and merges without duplicates", () => {
  const saved = parseCommandLibrary(serializeCommandLibrary([{ ...textCommand, unexpected: "ignored" }, hexCommand]));
  assert.deepEqual(saved, [textCommand, hexCommand]);
  assert.deepEqual(mergeCommandLibraries(saved, [textCommand]), saved);
  assert.equal(mergeCommandLibraries(saved, [{ ...textCommand, payload: "NEW?" }]).length, 3);
});

test("import validates the whole file and does not mutate existing commands on error", () => {
  const current = [textCommand];
  const exported = JSON.parse(serializeCommandLibrary(current));
  for (const invalid of ["bad json", "null", "[]", JSON.stringify({ ...exported, version: 2 }),
    JSON.stringify({ ...exported, commands: [textCommand, { ...hexCommand, payload: "ZZ" }] }),
    JSON.stringify({ ...exported, commands: Array(51).fill(textCommand) })]) {
    assert.throws(() => parseCommandLibrary(invalid));
  }
  assert.throws(() => mergeCommandLibraries(current, [{ ...hexCommand, name: "" }]));
  assert.deepEqual(current, [textCommand]);
  assert.throws(() => serializeCommandLibrary(Array(50).fill({ ...textCommand, payload: "中".repeat(8192) })));
});

function fixture() {
  const timers = new Map();
  const writes = [];
  const errors = [];
  let nextId = 0;
  let active = true;
  let session = { connected: true, write: async (bytes) => { writes.push([...bytes]); } };
  const runner = createCommandRunner({
    getSession: () => session, isActive: () => active, onError: (error) => errors.push(error),
    setTimer(callback, delay) { const id = ++nextId; timers.set(id, { callback, delay }); return id; },
    clearTimer(id) { timers.delete(id); },
  });
  return { runner, writes, timers, errors,
    get session() { return session; },
    set session(value) { session = value; },
    leave() { active = false; },
    async fire() {
      const [id, timer] = timers.entries().next().value;
      timers.delete(id); timer.callback();
      await Promise.resolve(); await Promise.resolve();
    },
  };
}

test("timed sends use a payload snapshot and stop after the requested successful count", async () => {
  const f = fixture();
  const bytes = new Uint8Array([1, 2]);
  await f.runner.start(bytes, { interval: 120, limit: 3 });
  bytes[0] = 255;
  assert.equal([...f.timers.values()][0].delay, 120);
  await f.fire(); await f.fire();
  assert.deepEqual(f.writes, [[1, 2], [1, 2], [1, 2]]);
  assert.equal(f.runner.snapshot().reason, "complete");
  assert.equal(f.timers.size, 0);
});

test("slow writes cannot overlap, stop blocks restart until write settles", async () => {
  const f = fixture();
  let finish;
  f.session.write = () => new Promise((resolve) => { finish = resolve; });
  const pending = f.runner.start(new Uint8Array([1]), { limit: 0 });
  assert.equal(f.timers.size, 0);
  assert.throws(() => f.runner.start(new Uint8Array([2])));
  f.runner.stop();
  assert.throws(() => f.runner.start(new Uint8Array([2])));
  finish(); await pending;
  assert.equal(f.runner.snapshot().sent, 1);
  assert.equal(f.runner.snapshot().reason, "stopped");
  assert.equal(f.timers.size, 0);
});

test("leaving, disconnecting or replacing a session prevents the next write", async () => {
  for (const change of [(f) => f.leave(), (f) => { f.session.connected = false; },
    (f) => { f.session = { connected: true, write: () => assert.fail("wrong session") }; }]) {
    const f = fixture();
    await f.runner.start(new Uint8Array([1]), { limit: 0 });
    change(f); await f.fire();
    assert.equal(f.writes.length, 1);
    assert.equal(f.runner.snapshot().active, false);
    assert.equal(f.timers.size, 0);
  }
});

test("stop clears scheduled work; failed writes are not retried", async () => {
  const f = fixture();
  await f.runner.start(new Uint8Array([1]), { limit: 0 });
  f.runner.stop();
  assert.equal(f.timers.size, 0);
  f.session.write = async () => { throw new Error("unplugged"); };
  await f.runner.start(new Uint8Array([1]), { limit: 0 });
  assert.equal(f.runner.snapshot().sent, 0);
  assert.equal(f.runner.snapshot().reason, "failed");
  assert.equal(f.errors[0].message, "unplugged");
  assert.equal(f.timers.size, 0);
});

test("invalid timing or disconnected starts never write", () => {
  const f = fixture();
  for (const options of [{ interval: 0 }, { interval: 49 }, { interval: NaN }, { interval: 100.5 },
    { interval: 60001 }, { limit: -1 }, { limit: 1.5 }, { limit: 100001 }]) {
    assert.throws(() => f.runner.start(new Uint8Array([1]), options));
  }
  f.session.connected = false;
  assert.throws(() => f.runner.start(new Uint8Array([1])));
  assert.deepEqual(f.writes, []);
});

test("custom setpoint templates handle CR and report bad precision without crashing the page", () => {
  const state = { setpoint: 50, mode: "custom" };
  const valid = createDeviceSetOutputCommand("custom", state, { commandTemplate: "SET {value}", commandLineEnding: "\\r" });
  assert.equal(new TextDecoder().decode(valid.bytes), "SET 50\r");
  const invalid = createDeviceSetOutputCommand("custom", state, { commandTemplate: "SET {value:999}" });
  assert.equal(invalid.supported, false);
  assert.equal(invalid.bytes, null);
});
