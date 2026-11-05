import i18n from "../i18n.js";
import { buildManualPayload, parseHexPayload, resolveLineEnding } from "../protocols.js";
import { crc16Modbus } from "../modbus/modbus.js";

const CHECKSUMS = ["none", "modbus", "sum8", "xor8"];

function checksumBytes(checksum, body) {
  if (checksum === "modbus") {
    const crc = crc16Modbus(body);
    return [crc & 0xff, crc >> 8];
  }
  if (checksum === "sum8") return [body.reduce((sum, byte) => (sum + byte) & 0xff, 0)];
  if (checksum === "xor8") return [body.reduce((xor, byte) => xor ^ byte, 0)];
  return [];
}

/**
 * The shared workbench sender. JSON and checksum-free text keep the string path so
 * WebSocket and MQTT still send text frames; a checksum always produces bytes, appended
 * after the text line ending (HEX takes no line ending). CRC16 is low byte first.
 */
export function buildManualSendPayload({ format, payload, lineEnding, checksum = "none" }) {
  if (format === "json" || checksum === "none") return buildManualPayload(format, payload, resolveLineEnding(lineEnding));
  if (!CHECKSUMS.includes(checksum)) throw new Error(i18n("workbench.invalidChecksum"));
  const body = format === "hex" ? parseHexPayload(payload) : new TextEncoder().encode(payload + resolveLineEnding(lineEnding));
  const suffix = checksumBytes(checksum, body);
  const bytes = new Uint8Array(body.length + suffix.length);
  bytes.set(body);
  bytes.set(suffix, body.length);
  return bytes;
}
