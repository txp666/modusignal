import i18n from "../../i18n.js";
import { buildManualPayload, bytesToHex, parseHexPayload, resolveLineEnding } from "../../protocols.js";
import { crc16Modbus } from "../../modbus/modbus.js";
import { encodeEscapedText, TextEscapeError } from "../../utils/text-escapes.js";

export const COMMAND_LIBRARY_KEY = "modusignal.customCommands.v1";
export const MAX_COMMANDS = 50;
export const MAX_LIBRARY_SIZE = 512 * 1024;
const LIBRARY_FORMAT = "modusignal.custom-commands";
const ENDINGS = { "": "", "\\n": "\n", "\\r": "\r", "\\r\\n": "\r\n" };

export function buildCustomCommand(command) {
  if (!command || typeof command !== "object" ||
      !["ascii", "hex"].includes(command.format) ||
      !Object.hasOwn(ENDINGS, command.lineEnding) ||
      !["none", "modbus", "sum8", "xor8"].includes(command.checksum)) {
    throw new Error(i18n("customTools.invalidCommand"));
  }
  if (typeof command.payload !== "string" || !command.payload.length || command.payload.length > 8192) {
    throw new Error(i18n("customTools.payloadLimit"));
  }
  // HEX is already a byte sequence. Text endings are appended before checksum calculation.
  const body = command.format === "hex" ? parseHexPayload(command.payload)
    : command.escapes === true ? concat(encodeText(command.payload), new TextEncoder().encode(ENDINGS[command.lineEnding]))
      : new TextEncoder().encode(command.payload + ENDINGS[command.lineEnding]);
  let suffix = [];
  if (command.checksum === "modbus") {
    const crc = crc16Modbus(body);
    suffix = [crc & 0xff, crc >> 8];
  } else if (command.checksum === "sum8") {
    suffix = [body.reduce((sum, byte) => (sum + byte) & 0xff, 0)];
  } else if (command.checksum === "xor8") {
    suffix = [body.reduce((xor, byte) => xor ^ byte, 0)];
  }
  const bytes = concat(body, suffix);
  return { bytes, hex: bytesToHex(bytes), checksumHex: bytesToHex(suffix) };
}

function concat(left, right) {
  const bytes = new Uint8Array(left.length + right.length);
  bytes.set(left);
  bytes.set(right, left.length);
  return bytes;
}

function encodeText(payload) {
  try {
    return encodeEscapedText(payload);
  } catch (error) {
    if (error instanceof TextEscapeError) throw new Error(`${i18n("customTools.escapeInvalid")}${error.sequence}`);
    throw error;
  }
}

/**
 * The shared workbench sender. JSON and checksum-free text keep the string path so
 * WebSocket and MQTT still send text frames; a checksum always produces bytes.
 */
export function buildManualSendPayload({ format, payload, lineEnding, checksum = "none" }) {
  if (format === "json" || checksum === "none") return buildManualPayload(format, payload, resolveLineEnding(lineEnding));
  return buildCustomCommand({ format, payload, lineEnding: format === "hex" ? "" : lineEnding, checksum }).bytes;
}

export function validateSavedCommand(command) {
  buildCustomCommand(command);
  if (typeof command.name !== "string" || !command.name.trim() || command.name.trim().length > 60) {
    throw new Error(i18n("customTools.nameRequired"));
  }
  const saved = {
    name: command.name.trim(), format: command.format, payload: command.payload,
    lineEnding: command.format === "hex" ? "" : command.lineEnding, checksum: command.checksum,
  };
  // Optional v1 field, written only when on so existing libraries stay byte-identical.
  if (command.format === "ascii" && command.escapes === true) saved.escapes = true;
  return saved;
}

export function serializeCommandLibrary(commands) {
  if (!Array.isArray(commands) || commands.length > MAX_COMMANDS) throw new Error(i18n("customTools.libraryLimit"));
  const text = JSON.stringify({ format: LIBRARY_FORMAT, version: 1, commands: commands.map(validateSavedCommand) }, null, 2);
  if (new TextEncoder().encode(text).length > MAX_LIBRARY_SIZE) throw new Error(i18n("customTools.fileLimit"));
  return text;
}

export function parseCommandLibrary(text) {
  if (typeof text !== "string" || new TextEncoder().encode(text).length > MAX_LIBRARY_SIZE) {
    throw new Error(i18n("customTools.fileLimit"));
  }
  let data;
  try { data = JSON.parse(text); } catch { throw new Error(i18n("customTools.invalidFile")); }
  if (data?.format !== LIBRARY_FORMAT || data.version !== 1 || !Array.isArray(data.commands)) {
    throw new Error(i18n("customTools.invalidFile"));
  }
  if (data.commands.length > MAX_COMMANDS) throw new Error(i18n("customTools.libraryLimit"));
  return data.commands.map(validateSavedCommand);
}

export function mergeCommandLibraries(current, imported) {
  const merged = current.map(validateSavedCommand);
  const keys = new Set(merged.map((command) => JSON.stringify(command)));
  for (const item of imported) {
    const command = validateSavedCommand(item);
    const key = JSON.stringify(command);
    if (!keys.has(key)) { merged.push(command); keys.add(key); }
  }
  if (merged.length > MAX_COMMANDS) throw new Error(i18n("customTools.libraryLimit"));
  return merged;
}
