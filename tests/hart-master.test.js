import test from "node:test";
import assert from "node:assert/strict";
import { interpretHartFrame, normalizeHartConfig, validateHartCommandData } from "../src/devices/hart-device.js";
import {
  createHartMaster,
  describeHartTimeout,
  describeHartTransaction,
  RX_IDLE_MS,
  RX_MAX_EXTRA_MS,
} from "../src/features/hart/hart-master-controller.js";
import {
  buildHartFrame,
  extractHartFrames,
  matchHartResponse,
  parseHartFrame,
  parseHartRequest,
} from "../src/hart/hart.js";
import i18n from "../src/i18n.js";

const DEVICE = { discovered: true, expandedDeviceType: 0x60a1, deviceId: 0x123456 };
const flush = () => new Promise((resolve) => setImmediate(resolve));

function floatBytes(value) {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setFloat32(0, value, false);
  return [...bytes];
}

/** A slave frame as it arrives on the line, preambles included. */
function slaveFrame({
  command, data = [], responseCode = 0, status = 0, pollAddress = null, deviceId = DEVICE.deviceId, burst = false, master = 0x80,
}) {
  const address = pollAddress === null
    ? [((DEVICE.expandedDeviceType >> 8) & 0x3f) | master, DEVICE.expandedDeviceType & 0xff, deviceId >> 16, (deviceId >> 8) & 0xff, deviceId & 0xff]
    : [master | pollAddress];
  const type = burst ? 0x01 : 0x06;
  const body = [(pollAddress === null ? 0x80 : 0) | type, ...address, command, data.length + 2, responseCode, status, ...data];
  const checksum = body.reduce((value, byte) => value ^ byte, 0);
  return Uint8Array.from([0xff, 0xff, 0xff, 0xff, 0xff, ...body, checksum]);
}

const parse = (bytes) => extractHartFrames(bytes).frames[0];

const COMMAND_3_DATA = [
  ...floatBytes(12), 32, ...floatBytes(25), 32, ...floatBytes(21.5), 7, ...floatBytes(1.013), 57, ...floatBytes(49),
];

function fakeClock() {
  let time = 0;
  let nextId = 0;
  const timers = new Map();
  return {
    now: () => time,
    setTimer(callback, ms) {
      nextId += 1;
      timers.set(nextId, { callback, at: time + ms });
      return nextId;
    },
    clearTimer: (id) => timers.delete(id),
    async advance(ms) {
      const target = time + ms;
      for (;;) {
        await flush();
        const due = [...timers.entries()].filter(([, timer]) => timer.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        timers.delete(due[0]);
        time = due[1].at;
        due[1].callback();
      }
      time = target;
      await flush();
    },
  };
}

function fixture({ timeoutMs = 1000 } = {}) {
  const clock = fakeClock();
  const writes = [];
  const transactions = [];
  const frames = [];
  const master = createHartMaster({
    write: async (bytes) => { writes.push(bytes); },
    getTimeoutMs: () => timeoutMs,
    onTransaction: (transaction) => transactions.push(transaction),
    onFrame: (response) => frames.push(response),
    now: clock.now,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
  });
  return { clock, writes, transactions, frames, master };
}

test("responses match their request by address, master and command", () => {
  const request = parseHartRequest(buildHartFrame({ command: 3, device: DEVICE, preambleLength: 5 }));
  assert.equal(request.command, 3);
  assert.equal(request.addressLength, 5);
  assert.equal(matchHartResponse(request, parse(slaveFrame({ command: 3 }))), true);
  // Bit 6 of the first address byte only reports that the device is in burst mode.
  const inBurstMode = slaveFrame({ command: 3, master: 0xc0 });
  assert.equal(matchHartResponse(request, parse(inBurstMode)), true);
  assert.equal(matchHartResponse(request, parse(slaveFrame({ command: 1 }))), false);
  assert.equal(matchHartResponse(request, parse(slaveFrame({ command: 3, deviceId: 0x654321 }))), false);
  assert.equal(matchHartResponse(request, parse(slaveFrame({ command: 3, master: 0 }))), false);
  assert.equal(matchHartResponse(request, parse(slaveFrame({ command: 3, burst: true }))), false);

  const search = parseHartRequest(buildHartFrame({ command: 0, pollAddress: 2, preambleLength: 8 }));
  assert.equal(search.pollAddress, 2);
  assert.equal(matchHartResponse(search, parse(slaveFrame({ command: 0, pollAddress: 2 }))), true);
  assert.equal(matchHartResponse(search, parse(slaveFrame({ command: 0, pollAddress: 3 }))), false);

  const expanded = parseHartRequest(buildHartFrame({ command: 513, device: DEVICE }));
  assert.equal(expanded.command, 513);
  assert.equal(parseHartRequest(slaveFrame({ command: 3 })), null, "a response is not a request");
  assert.equal(parseHartRequest(new TextEncoder().encode("HARTLINK?\r\n")), null);
});

test("burst messages are parsed, and a stray delimiter cannot hold back a complete frame", () => {
  const burst = parse(slaveFrame({ command: 1, burst: true, data: [32, ...floatBytes(21.5)] }));
  assert.equal(burst.isBurst, true);
  assert.equal(burst.command, 1);

  // 0x86 claims a 240-byte frame; the real response after it is already complete.
  const stray = [0x86, 0x20, 0x01, 0x02, 0x03, 0x04, 0x05, 0xf0];
  const { frames } = extractHartFrames(Uint8Array.from([...stray, ...slaveFrame({ command: 3, data: COMMAND_3_DATA })]));
  assert.equal(frames.length, 1);
  assert.equal(frames[0].command, 3);
});

test("a reply still arriving when the timeout expires is received in full", async () => {
  const f = fixture({ timeoutMs: 300 });
  const result = f.master.send(buildHartFrame({ command: 3, device: DEVICE }));
  const reply = slaveFrame({ command: 3, data: COMMAND_3_DATA });
  await f.clock.advance(250);
  f.master.handleRx(reply.subarray(0, 20));
  await f.clock.advance(RX_IDLE_MS - 1);
  f.master.handleRx(reply.subarray(20));
  const transaction = await result;
  assert.equal(transaction.status, "ok");
  assert.equal(transaction.latencyMs, 250 + RX_IDLE_MS - 1);
});

test("line noise cannot hold an exchange open beyond the extra wait", async () => {
  const f = fixture({ timeoutMs: 300 });
  const result = f.master.send(buildHartFrame({ command: 1, device: DEVICE }));
  for (let elapsed = 0; elapsed < 5000; elapsed += 100) {
    f.master.handleRx(Uint8Array.of(0x00));
    await f.clock.advance(100);
  }
  const transaction = await result;
  assert.equal(transaction.status, "timeout");
  assert.ok(transaction.latencyMs <= 300 + RX_MAX_EXTRA_MS, `gave up after ${transaction.latencyMs} ms`);
  assert.match(describeHartTimeout(transaction, 300), new RegExp(String(transaction.rxBytes)));
});

test("burst messages complete no request but still reach the display", async () => {
  const f = fixture();
  const result = f.master.send(buildHartFrame({ command: 1, device: DEVICE }));
  await flush();
  f.master.handleRx(slaveFrame({ command: 1, burst: true, data: [32, ...floatBytes(21.5)] }));
  assert.equal(f.frames.length, 1);
  assert.equal(f.frames[0].isBurst, true);
  f.master.handleRx(slaveFrame({ command: 1, data: [32, ...floatBytes(22)] }));
  const transaction = await result;
  assert.equal(transaction.status, "ok");
  assert.equal(transaction.foreignFrames, 1);
});

test("error response codes count as errors and warnings do not", async () => {
  const f = fixture();
  const exchange = async (command, responseCode) => {
    const result = f.master.send(buildHartFrame({ command, device: DEVICE }));
    await flush();
    f.master.handleRx(slaveFrame({ command, responseCode }));
    return result;
  };
  const writeProtected = await exchange(35, 7);
  assert.equal(writeProtected.status, "exception");
  assert.match(describeHartTransaction(writeProtected, 1000), /^✗ Cmd 35 .* 0x07 /);
  assert.equal((await exchange(3, 8)).status, "ok", "response code 8 is a warning for Cmd 3");
  assert.equal((await exchange(1, 0x88)).status, "exception", "a communication error");
  assert.deepEqual(f.master.getStats(), { requests: 3, responses: 1, exceptions: 2, timeouts: 0, lastLatencyMs: 0 });
});

test("timeouts name their likely cause", () => {
  const short = parseHartRequest(buildHartFrame({ command: 0, pollAddress: 0 }));
  const long = parseHartRequest(buildHartFrame({ command: 1, device: DEVICE }));
  const timeout = (request, rxBytes = 0, foreignFrames = 0) =>
    describeHartTransaction({ status: "timeout", request, rxBytes, foreignFrames, latencyMs: 1000 }, 1000);
  assert.ok(timeout(short).includes(i18n("hart.timeout.silent")));
  assert.ok(timeout(long).includes(i18n("hart.timeout.silentLong")));
  assert.ok(timeout(long).includes("ID 0x123456"));
  assert.ok(timeout(long, 12).includes("12"));
  assert.ok(timeout(long, 40, 1).includes(i18n("hart.timeout.foreign")));
});

test("response frames become discovery or scaled multi-variable telemetry", () => {
  const identity = [0xfe, 0x60, 0xa1, 5, 7, 1, 3, 0x10, 0, 0x12, 0x34, 0x56, 5, 3, 0, 7, 0, 0, 0x60, 0, 0x60, 1];
  const discovery = interpretHartFrame(parse(slaveFrame({ command: 0, pollAddress: 2, data: identity })), {});
  assert.equal(discovery.isDiscovery, true);
  assert.equal(discovery.pollAddress, 2);
  assert.equal(discovery.device.deviceId, 0x123456);
  assert.ok(discovery.commandLines.length > 0, "the identity is shown when Cmd 0 is sent as a command");

  const config = normalizeHartConfig({ scale: 2, offset: 1, device: DEVICE });
  const dynamic = interpretHartFrame(parse(slaveFrame({ command: 3, data: COMMAND_3_DATA })), config);
  assert.equal(dynamic.isMulti, true);
  assert.equal(dynamic.variables.pv.value, 51);
  assert.equal(dynamic.variables.sv.value, 21.5);
  assert.equal(dynamic.variables.qv.unit, "%");
});

test("payload length errors name the command and sizes in the current language", () => {
  const either = validateHartCommandData(6, new Uint8Array(3));
  assert.match(either, /^6 .*1.*2.*3/);
  const codes = validateHartCommandData(9, new Uint8Array(0));
  assert.match(codes, /8/);
  for (const message of [either, codes, validateHartCommandData(17, new Uint8Array(2))]) {
    assert.doesNotMatch(message, /\{\w+\}/, message);
  }
});
