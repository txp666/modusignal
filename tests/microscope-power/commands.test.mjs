import assert from "node:assert/strict";
import test from "node:test";
import { CommandTransport } from "../../pages/devices/microscope-power/commands.js";
import { WaveFrameParser } from "../../pages/devices/microscope-power/protocol.js";

const tick = () => new Promise((resolve) => setImmediate(resolve));
const decode = (bytes) => new TextDecoder().decode(bytes);
function connection(options = {}) {
  const writes = [];
  const errors = [];
  const transport = new CommandTransport({
    transferOut: async (payload) => { writes.push(decode(payload)); return { status: "ok", bytesWritten: payload.length }; },
    onInvalidated: (error) => errors.push(error),
    ...options,
  });
  return { transport, writes, errors };
}

test("commands serialize and await their own complete response", async () => {
  const { transport, writes } = connection();
  const first = transport.send("START");
  const second = transport.send("STOP");
  await tick();
  assert.deepEqual(writes, ["START\n"]);
  assert.equal(transport.handleText("STATUS state=RUNNING"), false);
  transport.handleText("OK");
  assert.equal(await first, "OK");
  await tick();
  assert.deepEqual(writes, ["START\n", "STOP\n"]);
  transport.handleText("OK");
  assert.equal(await second, "OK");
});

test("split/coalesced USB text replies are not acknowledged prematurely", async () => {
  const { transport } = connection();
  const parser = new WaveFrameParser({ onText: (line) => transport.handleText(line) });
  const pending = transport.send("GET_STATUS");
  await tick();
  parser.push(new TextEncoder().encode("STATUS state=ID"));
  assert.equal(transport.pending.response, undefined);
  parser.push(new TextEncoder().encode("LE srate=100000\nOK\n"));
  assert.equal(await pending, "STATUS state=IDLE srate=100000");
});

test("status, zero calibration, ping and bootloader commands require matching replies", async () => {
  for (const [command, expected] of [["GET_STATUS", "STATUS state=IDLE"], ["ZERO_CAL", "STATUS zero=123"],
    ["PING", "OK PONG"], ["BOOTSEL", "OK BOOTSEL"], ["OTA", "OK BOOTSEL"], ["REBOOT_BOOTSEL", "OK BOOTSEL"]]) {
    const { transport } = connection();
    const promise = transport.send(command);
    await tick();
    assert.equal(transport.handleText("OK"), false);
    assert.equal(transport.handleText("OK\nERR FAIL"), false);
    transport.handleText(expected);
    assert.equal(await promise, expected);
  }
});

test("an ERR rejects only the matching command, then releases the queue", async () => {
  const { transport, writes, errors } = connection();
  const first = transport.send("SRATE 123");
  const rejection = assert.rejects(first, /ERR BAD_RATE/);
  const second = transport.send("STOP");
  await tick();
  transport.handleText("ERR BAD_RATE");
  await rejection;
  await tick();
  assert.deepEqual(writes, ["SRATE 123\n", "STOP\n"]);
  transport.handleText("OK");
  await second;
  assert.equal(errors.length, 0);
});

test("ACK cannot resolve before transferOut reports a successful full write", async () => {
  let finishTransfer;
  const { transport } = connection({ transferOut: () => new Promise((resolve) => { finishTransfer = resolve; }) });
  let resolved = false;
  const pending = transport.send("START").then(() => { resolved = true; });
  await tick();
  transport.handleText("OK");
  await tick();
  assert.equal(resolved, false);
  finishTransfer({ status: "ok", bytesWritten: 6 });
  await pending;
  assert.equal(resolved, true);
});

test("short, stalled and failed transfers invalidate the entire command session", async () => {
  for (const result of [{ status: "ok", bytesWritten: 2 }, { status: "stall", bytesWritten: 6 }, undefined, new Error("USB removed")]) {
    const { transport, errors } = connection({ transferOut: async () => { if (result instanceof Error) throw result; return result; } });
    const outcomes = Promise.allSettled([transport.send("START"), transport.send("STOP")]);
    const completed = await outcomes;
    assert.ok(completed.every((r) => r.status === "rejected"));
    assert.equal(errors.length, 1);
    assert.equal(transport.handleText("OK"), false);
    await assert.rejects(transport.send("GET_STATUS"));
  }
});

test("timeout invalidates queued commands so a late ACK cannot acknowledge another command", async () => {
  const { transport, writes, errors } = connection({ timeoutMs: 15 });
  const completed = await Promise.allSettled([transport.send("START"), transport.send("STOP")]);
  assert.ok(completed.every((r) => r.status === "rejected" && /超时/.test(r.reason.message)));
  transport.handleText("OK");
  await assert.rejects(transport.send("GET_STATUS"), /超时/);
  assert.deepEqual(writes, ["START\n"]);
  assert.equal(errors.length, 1);
});

test("disconnect rejects active and queued work, ignoring a late transfer completion", async () => {
  let finishTransfer;
  const { transport, errors } = connection({ transferOut: () => new Promise((resolve) => { finishTransfer = resolve; }) });
  const outcomes = Promise.allSettled([transport.send("START"), transport.send("STOP")]);
  await tick();
  transport.disconnect();
  finishTransfer({ status: "ok", bytesWritten: 6 });
  assert.ok((await outcomes).every((r) => r.status === "rejected"));
  assert.equal(transport.handleText("OK"), false);
  assert.equal(errors.length, 0);
});

test("invalid command input never reaches USB", async () => {
  const { transport, writes } = connection();
  for (const command of ["", "START\nSTOP", "A".repeat(64), "电压"]) await assert.rejects(transport.send(command));
  await assert.rejects(transport.send("STOP", { timeoutMs: 0 }));
  assert.deepEqual(writes, []);
});
