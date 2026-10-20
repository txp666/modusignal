import { bytesToEscapedText, isPrintableText } from "../utils/text-escapes.js";

export const LOG_DISPLAY_MODES = ["auto", "hex", "text"];

const pad = (value, length = 2) => String(value).padStart(length, "0");

export function formatLogTime(date = new Date()) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`;
}

const decoder = new TextDecoder();

/**
 * Renders one RX/TX record. "auto" shows HEX for binary protocols (autoHex) and for
 * data that is blank or not printable text, otherwise the text (decoded when the
 * record only has bytes); "hex" and "text" apply to every device.
 */
export function formatLogRecord({ bytes, text, prefix = "", autoHex = false }, mode, bytesToHex) {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(0);
  if (mode === "hex") return prefix + bytesToHex(data);
  if (mode === "text") return prefix + bytesToEscapedText(data, { breakLines: true });
  if (!autoHex && isPrintableText(data)) {
    const value = typeof text === "string" ? text : decoder.decode(data);
    if (value.trim()) return prefix + value;
  }
  return prefix + bytesToHex(data);
}

export function logFileName(date = new Date()) {
  const day = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
  return `modusignal-log-${day}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}.txt`;
}

/** Tab-separated time, direction and payload; extra payload lines are indented under the payload column. */
export function serializeLogEntries(entries, exportedAt = new Date()) {
  const date = `${exportedAt.getFullYear()}-${pad(exportedAt.getMonth() + 1)}-${pad(exportedAt.getDate())}`;
  const lines = [`# ModuSignal log ${date} ${formatLogTime(exportedAt)}`];
  for (const { time, direction, payload } of entries) {
    const [first = "", ...rest] = String(payload).replace(/[\r\n]+$/, "").split(/\r\n|\r|\n/);
    lines.push(`${time}\t${direction}\t${first}`, ...rest.map((line) => `\t\t${line}`));
  }
  return `${lines.join("\n")}\n`;
}
