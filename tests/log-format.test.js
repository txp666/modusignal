import test from "node:test";
import assert from "node:assert/strict";
import { formatLogRecord, formatLogTime, logFileName, serializeLogEntries } from "../src/ui/log-format.js";
import { bytesToHex } from "../src/protocols.js";

const text = (value) => new TextEncoder().encode(value);

test("log time has millisecond precision", () => {
  assert.equal(formatLogTime(new Date(2026, 9, 20, 9, 5, 7, 4)), "09:05:07.004");
  assert.equal(formatLogTime(new Date(2026, 9, 20, 23, 59, 59, 999)), "23:59:59.999");
});

test("auto keeps the device default and falls back to HEX for binary or blank data", () => {
  const ok = { bytes: text("OK\r\n"), text: "OK\r\n" };
  assert.equal(formatLogRecord(ok, "auto", bytesToHex), "OK\r\n");
  assert.equal(formatLogRecord({ ...ok, autoHex: true }, "auto", bytesToHex), "4F 4B 0D 0A");
  assert.equal(formatLogRecord({ bytes: Uint8Array.of(1, 3, 0x41), text: "\u0001\u0003A" }, "auto", bytesToHex), "01 03 41");
  assert.equal(formatLogRecord({ bytes: text("\r\n"), text: "\r\n" }, "auto", bytesToHex), "0D 0A");
  // Writes made from bytes carry no text: printable ones are decoded unless the device is binary.
  assert.equal(formatLogRecord({ bytes: text("AT\r") }, "auto", bytesToHex), "AT\r");
  assert.equal(formatLogRecord({ bytes: text("AT\r"), autoHex: true }, "auto", bytesToHex), "41 54 0D");
  assert.equal(formatLogRecord({ bytes: Uint8Array.of(0x41, 0x00) }, "auto", bytesToHex), "41 00");
});

test("HEX and text modes override the device default and keep a topic prefix", () => {
  const record = { bytes: Uint8Array.of(0x41, 0x0a, 0xff), text: "A\n�", prefix: "[dev/1] ", autoHex: true };
  assert.equal(formatLogRecord(record, "hex", bytesToHex), "[dev/1] 41 0A FF");
  assert.equal(formatLogRecord(record, "text", bytesToHex), "[dev/1] A\\n\n\\xFF");
  assert.equal(formatLogRecord({ text: "x" }, "hex", bytesToHex), "");
});

test("saved log is tab separated with continuation lines under the payload", () => {
  const exportedAt = new Date(2026, 9, 20, 14, 3, 22, 50);
  const saved = serializeLogEntries([
    { time: "14:03:21.001", direction: "TX", payload: "READ?\r\n" },
    { time: "14:03:21.020", direction: "RX", payload: "A\\r\\n\nB\\r\\n" },
    { time: "14:03:21.500", direction: "系统", payload: "" },
  ], exportedAt);
  assert.equal(saved, [
    "# ModuSignal log 2026-10-20 14:03:22.050",
    "14:03:21.001\tTX\tREAD?",
    "14:03:21.020\tRX\tA\\r\\n",
    "\t\tB\\r\\n",
    "14:03:21.500\t系统\t",
    "",
  ].join("\n"));
  assert.equal(logFileName(exportedAt), "modusignal-log-20261020-140322.txt");
});
