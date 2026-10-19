import assert from "node:assert/strict";
import test from "node:test";
import { buildModbusCurveSectionHtml } from "../src/debug-curve-section.js";
import { DEFAULT_MODBUS_CONFIG, parseModbusTelemetry, resetModbusRxBuffer } from "../src/devices/modbus-device.js";

test("the Modbus parser's built-in example decodes with the default configuration", () => {
  const html = buildModbusCurveSectionHtml();
  const sample = html.match(/id="modbusParserSample"[^>]*value="([^"]+)"/)[1];
  const bytes = Uint8Array.from(sample.split(" ").map((byte) => parseInt(byte, 16)));
  resetModbusRxBuffer();
  const result = parseModbusTelemetry(bytes, DEFAULT_MODBUS_CONFIG);
  assert.equal(result?.value, 100);
});
