import test from "node:test";
import assert from "node:assert/strict";
import { createModbusSetOutputCommand, parseModbusWriteValues } from "../src/devices/modbus-device.js";
import { createModbusMaster, MIN_POLL_GAP_MS } from "../src/features/modbus/modbus-master.js";
import { formatRegisterRows } from "../src/features/modbus/register-table.js";
import {
  appendCrc,
  buildReadRegistersRequest,
  buildWriteMultipleRegistersRequest,
  matchRtuResponse,
  parseRtuRequest,
  parseRtuResponse,
} from "../src/modbus/modbus.js";

const hex = (bytes) => [...bytes].map((byte) => byte.toString(16).toUpperCase().padStart(2, "0")).join(" ");
const helpers = { bytesToHex: hex };
const flush = () => new Promise((resolve) => setImmediate(resolve));

function readResponse(slaveId, functionCode, words) {
  const pdu = [slaveId, functionCode, words.length * 2];
  for (const word of words) pdu.push(word >> 8, word & 0xff);
  return appendCrc(Uint8Array.from(pdu));
}

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
    pending: () => timers.size,
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

function fixture({ timeoutMs = 1000, writeError = null } = {}) {
  const clock = fakeClock();
  const writes = [];
  const transactions = [];
  const master = createModbusMaster({
    write: async (bytes) => {
      if (writeError) throw writeError;
      writes.push(bytes);
    },
    getTimeoutMs: () => timeoutMs,
    onTransaction: (transaction, stats) => transactions.push({ transaction, stats }),
    now: clock.now,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
  });
  return { clock, writes, transactions, master };
}

test("write values accept decimal, negative, hex and 32-bit formats in every word order", () => {
  assert.deepEqual(parseModbusWriteValues("100, -5, 0x1F"), [100, 0xfffb, 0x1f]);
  assert.deepEqual(parseModbusWriteValues("1 2；3", "int16"), [1, 2, 3]);
  assert.deepEqual(parseModbusWriteValues("1.5", "float32", "ABCD"), [0x3fc0, 0x0000]);
  assert.deepEqual(parseModbusWriteValues("1.5", "float32", "CDAB"), [0x0000, 0x3fc0]);
  assert.deepEqual(parseModbusWriteValues("1.5", "float32", "BADC"), [0xc03f, 0x0000]);
  assert.deepEqual(parseModbusWriteValues("1.5", "float32", "DCBA"), [0x0000, 0xc03f]);
  assert.deepEqual(parseModbusWriteValues("-2", "int32", "ABCD"), [0xffff, 0xfffe]);
  assert.deepEqual(parseModbusWriteValues("0x12345678", "int32", "CDAB"), [0x5678, 0x1234]);
  for (const [text, format] of [["", "int16"], ["65536", "int16"], ["-32769", "int16"], ["1.5", "int16"], ["abc", "float32"], ["0x1G", "int32"]]) {
    assert.throws(() => parseModbusWriteValues(text, format), Error, `${format} ${text}`);
  }
  assert.throws(() => parseModbusWriteValues(Array(124).fill("1").join(",")), /123/);
});

test("FC16 writes exactly the entered registers and never zero-pads neighbours", () => {
  const command = createModbusSetOutputCommand({ setpoint: 999 }, {
    slaveId: 1, functionCode: 16, address: 0x10, quantity: 10, writeValues: "1, 2, 3",
  }, helpers);
  assert.equal(command.supported, true);
  assert.deepEqual(parseRtuRequest(command.bytes), { slaveId: 1, functionCode: 16, address: 0x10, quantity: 3 });
  assert.equal(hex(command.bytes.subarray(0, 13)), "01 10 00 10 00 03 06 00 01 00 02 00 03");

  const float = createModbusSetOutputCommand({}, { functionCode: 16, writeValues: "1.5 -1", writeFormat: "float32" }, helpers);
  assert.equal(parseRtuRequest(float.bytes).quantity, 4);
});

test("FC06 writes one 16-bit value and explains when more is entered", () => {
  const command = createModbusSetOutputCommand({}, { slaveId: 2, functionCode: 6, address: 1, writeValues: "-1" }, helpers);
  assert.deepEqual(parseRtuRequest(command.bytes), { slaveId: 2, functionCode: 6, address: 1, quantity: 1, value: 0xffff });
  for (const config of [{ writeValues: "1, 2" }, { writeValues: "1", writeFormat: "float32" }]) {
    const rejected = createModbusSetOutputCommand({}, { functionCode: 6, ...config }, helpers);
    assert.equal(rejected.supported, false);
    assert.match(rejected.preview, /16/);
  }
  assert.equal(createModbusSetOutputCommand({}, { functionCode: 6, writeValues: "" }, helpers).supported, false);
});

test("responses match their request by slave, function, length and write echo", () => {
  const read = parseRtuRequest(buildReadRegistersRequest(1, 3, 0, 2));
  assert.equal(matchRtuResponse(read, parseRtuResponse(readResponse(1, 3, [1, 2]))), true);
  assert.equal(matchRtuResponse(read, parseRtuResponse(readResponse(1, 3, [1]))), false);
  assert.equal(matchRtuResponse(read, parseRtuResponse(readResponse(2, 3, [1, 2]))), false);
  assert.equal(matchRtuResponse(read, parseRtuResponse(readResponse(1, 4, [1, 2]))), false);
  const exception = parseRtuResponse(appendCrc(Uint8Array.of(1, 0x83, 2)));
  assert.deepEqual({ ...exception }, { slaveId: 1, functionCode: 3, exceptionCode: 2 });
  assert.equal(matchRtuResponse(read, exception), true);
  const write = parseRtuRequest(buildWriteMultipleRegistersRequest(1, 8, [1, 2]));
  assert.equal(matchRtuResponse(write, parseRtuResponse(appendCrc(Uint8Array.of(1, 16, 0, 8, 0, 2)))), true);
  assert.equal(matchRtuResponse(write, parseRtuResponse(appendCrc(Uint8Array.of(1, 16, 0, 8, 0, 3)))), false);
  assert.equal(parseRtuRequest(Uint8Array.of(1, 3, 0, 0, 0, 1, 0, 0)), null);
});

test("a read completes on its split response and reports latency", async () => {
  const f = fixture();
  const request = buildReadRegistersRequest(1, 3, 0, 2);
  const result = f.master.send(request);
  await f.clock.advance(15);
  assert.deepEqual(f.writes, [request]);
  const response = readResponse(1, 3, [0x1234, 0xffff]);
  f.master.handleRx(response.subarray(0, 4));
  await f.clock.advance(5);
  f.master.handleRx(response.subarray(4));
  const transaction = await result;
  assert.equal(transaction.status, "ok");
  assert.equal(transaction.latencyMs, 20);
  assert.equal(hex(transaction.response.data), "12 34 FF FF");
  assert.deepEqual(f.master.getStats(), { requests: 1, responses: 1, exceptions: 0, timeouts: 0, lastLatencyMs: 20 });
  assert.equal(f.clock.pending(), 0);
});

test("exception responses and timeouts are reported with their cause", async () => {
  const f = fixture({ timeoutMs: 300 });
  const exception = f.master.send(buildReadRegistersRequest(1, 3, 100, 1));
  await flush();
  f.master.handleRx(appendCrc(Uint8Array.of(1, 0x83, 0x02)));
  assert.equal((await exception).response.exceptionCode, 2);

  const silent = f.master.send(buildReadRegistersRequest(1, 3, 0, 1));
  await f.clock.advance(300);
  assert.deepEqual(await silent, { ...(await silent), status: "timeout", rxBytes: 0, foreignFrames: 0 });

  const garbled = f.master.send(buildReadRegistersRequest(1, 3, 0, 1));
  await flush();
  f.master.handleRx(Uint8Array.of(0x55, 0xaa, 0x12));
  f.master.handleRx(readResponse(9, 3, [1]));
  await f.clock.advance(300);
  const timeout = await garbled;
  assert.equal(timeout.status, "timeout");
  assert.equal(timeout.rxBytes, 10);
  assert.equal(timeout.foreignFrames, 1);
  assert.deepEqual(f.master.getStats(), { requests: 3, responses: 0, exceptions: 1, timeouts: 2, lastLatencyMs: 0 });
  assert.deepEqual(f.transactions.map(({ transaction }) => transaction.status), ["exception", "timeout", "timeout"]);
  f.master.resetStats();
  assert.equal(f.master.getStats().requests, 0);
});

test("requests are serialised: a second send waits for the first exchange", async () => {
  const f = fixture({ timeoutMs: 100 });
  const first = f.master.send(buildReadRegistersRequest(1, 3, 0, 1));
  const second = f.master.send(buildWriteMultipleRegistersRequest(1, 0, [7]));
  await flush();
  assert.equal(f.writes.length, 1);
  f.master.handleRx(readResponse(1, 3, [5]));
  assert.equal((await first).status, "ok");
  await flush();
  assert.equal(f.writes.length, 2);
  f.master.handleRx(appendCrc(Uint8Array.of(1, 16, 0, 0, 0, 1)));
  assert.equal((await second).status, "ok");
});

test("requests sent from the manual sender are matched and timed too", async () => {
  const f = fixture({ timeoutMs: 200 });
  f.master.handleTx(Uint8Array.from([0x30, 0x31]));
  assert.equal(f.master.isBusy(), false);
  f.master.handleTx(buildReadRegistersRequest(3, 4, 10, 1));
  assert.equal(f.master.isBusy(), true);
  await f.clock.advance(12);
  f.master.handleRx(readResponse(3, 4, [42]));
  const [{ transaction }] = f.transactions;
  assert.equal(transaction.source, "manual");
  assert.equal(transaction.status, "ok");
  assert.equal(transaction.latencyMs, 12);
});

test("polling waits for each response, honours the interval and survives timeouts", async () => {
  const f = fixture({ timeoutMs: 150 });
  const request = buildReadRegistersRequest(1, 3, 0, 1);
  let interval = 500;
  f.master.startPolling(() => request, () => interval);
  f.master.startPolling(() => request, () => interval);
  await flush();
  assert.equal(f.writes.length, 1, "a second start must not spawn another loop");

  await f.clock.advance(400);
  assert.equal(f.writes.length, 1, "no new request while the first one is open");
  assert.equal(f.transactions.at(-1).transaction.status, "timeout");
  await f.clock.advance(100);
  assert.equal(f.writes.length, 2, "next request at the interval after the timeout");

  await f.clock.advance(30);
  f.master.handleRx(readResponse(1, 3, [1]));
  interval = 10;
  await f.clock.advance(MIN_POLL_GAP_MS - 1);
  assert.equal(f.writes.length, 2, "an interval below the gap still keeps the line quiet");
  await f.clock.advance(1);
  assert.equal(f.writes.length, 3);

  f.master.stopPolling();
  f.master.handleRx(readResponse(1, 3, [2]));
  await f.clock.advance(1000);
  assert.equal(f.writes.length, 3);
  assert.equal(f.master.isPolling(), false);
});

test("polling stops and reports when the request cannot be written", async () => {
  const f = fixture({ writeError: new Error("port closed") });
  let stoppedWith = null;
  f.master.startPolling(() => buildReadRegistersRequest(1, 3, 0, 1), () => 100, (error) => { stoppedWith = error; });
  await f.clock.advance(1);
  assert.equal(stoppedWith?.message, "port closed");
  assert.equal(f.master.isPolling(), false);
  assert.equal(f.master.getStats().requests, 0);
});

test("reset cancels the open exchange without counting a timeout", async () => {
  const f = fixture();
  const result = f.master.send(buildReadRegistersRequest(1, 3, 0, 1));
  await flush();
  f.master.reset();
  assert.equal((await result).status, "cancelled");
  assert.equal(f.master.getStats().timeouts, 0);
  assert.equal(f.clock.pending(), 0);
});

test("register rows decode 16-bit and 32-bit formats and flag changed values", () => {
  const data = Uint8Array.of(0x3f, 0xc0, 0x00, 0x00, 0xff, 0xfe, 0x00, 0x05, 0x12, 0x34);
  const previous = Uint8Array.of(0x3f, 0xc0, 0x00, 0x01, 0xff, 0xfe);
  const uint = formatRegisterRows(data, 100, { previous });
  assert.deepEqual(uint.map((row) => [row.address, row.hex, row.value, row.changed]), [
    [100, "3FC0", "16320", false], [101, "0000", "0", true], [102, "FFFE", "65534", false],
    [103, "0005", "5", false], [104, "1234", "4660", false],
  ]);
  assert.equal(formatRegisterRows(data, 0, { format: "int16" })[2].value, "-2");
  assert.equal(formatRegisterRows(data, 0, { format: "hex" })[4].value, "0x1234");
  assert.equal(formatRegisterRows(data, 0, { format: "binary" })[3].value, "0000 0000 0000 0101");
  const floats = formatRegisterRows(data, 0, { format: "float32" });
  assert.deepEqual(floats.map((row) => [row.value, row.continued]), [["1.5", false], ["", true], ["NaN", false], ["", true], ["—", false]]);
  assert.equal(formatRegisterRows(data, 0, { format: "int32", wordOrder: "ABCD" })[2].value, "-131067");
  assert.equal(formatRegisterRows(data, 0, { format: "uint32", wordOrder: "CDAB" })[0].value, String(0x00003fc0));
});
