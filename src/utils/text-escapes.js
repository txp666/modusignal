// One escape syntax for typing bytes (command editor) and showing them (log Text view):
// \r \n \t \\ and \xHH. Everything else is plain UTF-8 text.
const NAMED_ESCAPES = { r: 0x0d, n: 0x0a, t: 0x09, "\\": 0x5c };
const NAMED_BYTES = { 0x0d: "\\r", 0x0a: "\\n", 0x09: "\\t", 0x5c: "\\\\" };
const HEX = "0123456789ABCDEF";

export class TextEscapeError extends Error {
  constructor(sequence, index) {
    super(`Invalid escape ${sequence} at ${index}`);
    this.sequence = sequence;
    this.index = index;
  }
}

/** Encodes text to bytes, turning escapes into the bytes they name. Throws TextEscapeError. */
export function encodeEscapedText(text) {
  const encoder = new TextEncoder();
  const out = [];
  let literalStart = 0;
  const flushLiteral = (end) => {
    if (end > literalStart) out.push(...encoder.encode(text.slice(literalStart, end)));
  };
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] !== "\\") continue;
    flushLiteral(index);
    const next = text[index + 1];
    if (next !== undefined && Object.hasOwn(NAMED_ESCAPES, next)) {
      out.push(NAMED_ESCAPES[next]);
      index += 1;
    } else if (next === "x" && /^[\dA-Fa-f]{2}$/.test(text.slice(index + 2, index + 4))) {
      out.push(Number.parseInt(text.slice(index + 2, index + 4), 16));
      index += 3;
    } else {
      throw new TextEscapeError(text.slice(index, next === "x" ? index + 4 : index + 2), index);
    }
    literalStart = index + 1;
  }
  flushLiteral(text.length);
  return Uint8Array.from(out);
}

// Length of a well-formed UTF-8 sequence at index (RFC 3629: no overlongs or surrogates), else 0.
function utf8SequenceLength(bytes, index) {
  const lead = bytes[index];
  let length = 0;
  let min = 0x80;
  let max = 0xbf;
  if (lead >= 0xc2 && lead <= 0xdf) length = 2;
  else if (lead >= 0xe0 && lead <= 0xef) {
    length = 3;
    if (lead === 0xe0) min = 0xa0;
    if (lead === 0xed) max = 0x9f;
  } else if (lead >= 0xf0 && lead <= 0xf4) {
    length = 4;
    if (lead === 0xf0) min = 0x90;
    if (lead === 0xf4) max = 0x8f;
  } else return 0;
  if (index + length > bytes.length) return 0;
  if (bytes[index + 1] < min || bytes[index + 1] > max) return 0;
  for (let offset = 2; offset < length; offset += 1) {
    if (bytes[index + offset] < 0x80 || bytes[index + offset] > 0xbf) return 0;
  }
  return length;
}

/** True when every byte is printable UTF-8 text, \r, \n or \t; a sequence cut off at the end still counts. */
export function isPrintableText(bytes) {
  for (let index = 0; index < bytes.length;) {
    const byte = bytes[index];
    if ((byte >= 0x20 && byte < 0x7f) || byte === 0x0d || byte === 0x0a || byte === 0x09) {
      index += 1;
      continue;
    }
    const length = utf8SequenceLength(bytes, index);
    if (length) {
      index += length;
      continue;
    }
    return isTruncatedSequence(bytes, index);
  }
  return true;
}

// A multi-byte lead followed only by continuation bytes, ending before the sequence does.
function isTruncatedSequence(bytes, index) {
  const lead = bytes[index];
  const length = lead >= 0xc2 && lead <= 0xdf ? 2 : lead >= 0xe0 && lead <= 0xef ? 3 : lead >= 0xf0 && lead <= 0xf4 ? 4 : 0;
  if (!length || index + length <= bytes.length) return false;
  for (let next = index + 1; next < bytes.length; next += 1) {
    if (bytes[next] < 0x80 || bytes[next] > 0xbf) return false;
  }
  return true;
}

/**
 * Shows bytes as readable text: valid UTF-8 as characters, line endings and other
 * control or invalid bytes as escapes. With breakLines, a visual line break follows
 * each \n that is not the last byte (display only; it is not part of the escape syntax).
 */
export function bytesToEscapedText(bytes, { breakLines = false } = {}) {
  let out = "";
  for (let index = 0; index < bytes.length;) {
    const byte = bytes[index];
    if (Object.hasOwn(NAMED_BYTES, byte)) {
      out += NAMED_BYTES[byte];
      if (breakLines && byte === 0x0a && index + 1 < bytes.length) out += "\n";
      index += 1;
    } else if (byte >= 0x20 && byte < 0x7f) {
      out += String.fromCharCode(byte);
      index += 1;
    } else {
      const length = utf8SequenceLength(bytes, index);
      if (length) {
        let codePoint = byte & (0xff >> (length + 1));
        for (let offset = 1; offset < length; offset += 1) codePoint = (codePoint << 6) | (bytes[index + offset] & 0x3f);
        out += String.fromCodePoint(codePoint);
        index += length;
      } else {
        out += `\\x${HEX[byte >> 4]}${HEX[byte & 15]}`;
        index += 1;
      }
    }
  }
  return out;
}
