import test from "node:test";
import assert from "node:assert/strict";
import { buildManualSendPayload } from "../src/ui/manual-send-payload.js";

test("shared sender keeps text frames without a checksum and appends one to text or HEX bytes", () => {
  assert.equal(buildManualSendPayload({ format: "ascii", payload: "PING", lineEnding: "\\r" }), "PING\r");
  assert.equal(buildManualSendPayload({ format: "ascii", payload: "PING", lineEnding: "\\r\\n", checksum: "none" }), "PING\r\n");
  assert.equal(buildManualSendPayload({ format: "json", payload: " {\"a\":1} ", lineEnding: "\\r\\n", checksum: "modbus" }), "{\"a\":1}");
  assert.deepEqual([...buildManualSendPayload({ format: "ascii", payload: "PING", lineEnding: "\\r", checksum: "sum8" })],
    [0x50, 0x49, 0x4e, 0x47, 0x0d, 0x3b]);
  assert.deepEqual([...buildManualSendPayload({ format: "hex", payload: "01 03 00 00 00 02", lineEnding: "\\r\\n", checksum: "modbus" })],
    [0x01, 0x03, 0x00, 0x00, 0x00, 0x02, 0xc4, 0x0b]);
  assert.deepEqual([...buildManualSendPayload({ format: "hex", payload: "01 03", lineEnding: "\\r\\n" })], [0x01, 0x03]);
  assert.throws(() => buildManualSendPayload({ format: "hex", payload: "0G", lineEnding: "", checksum: "xor8" }));
});
