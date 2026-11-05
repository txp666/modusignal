// The frame parsers of a .uidp link (line / hex / modbus / modbus_tcp / modbus_ascii), as
// PyQt UI Designer's protocol_parser.py has them. Reading a byte stream takes two steps:
// frames(bytes) cuts what a link read into raw units, parse(unit) reads the messages in one
// unit. A hex parser that frames by silence has idleTimeout; flush() returns its frame.
// Pure: no DOM.

import {
  PyFloat,
  parsePyFloat,
  parsePyInt,
  pyFloat,
  pySplitWhitespace,
  pyStrip,
} from "./py-values.js";

/** An error a parser setting raises: `message` is FluentHMI's (Chinese) text, `code` + `args` name it. */
export class ParserConfigError extends Error {
  constructor(code, message, args = []) {
    super(message);
    this.code = code;
    this.args = args;
  }
}

const EMPTY = new Uint8Array(0);

export function concatBytes(...parts) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

export function indexOfBytes(haystack, needle, from = 0) {
  if (!needle.length) return Math.min(from, haystack.length);
  outer: for (let i = Math.max(0, from); i <= haystack.length - needle.length; i += 1) {
    for (let j = 0; j < needle.length; j += 1) {
      if (haystack[i + j] !== needle[j]) continue outer;
    }
    return i;
  }
  return -1;
}

function lastIndexOfByte(haystack, byte) {
  for (let i = haystack.length - 1; i >= 0; i -= 1) if (haystack[i] === byte) return i;
  return -1;
}

function startsWithBytes(haystack, needle, at = 0) {
  if (haystack.length - at < needle.length) return false;
  for (let j = 0; j < needle.length; j += 1) if (haystack[at + j] !== needle[j]) return false;
  return true;
}

function endsWithBytes(haystack, needle) {
  return startsWithBytes(haystack, needle, haystack.length - needle.length);
}

export function bytesToHexLower(bytes) {
  let out = "";
  for (const byte of bytes) out += byte.toString(16).padStart(2, "0");
  return out;
}

export function hexToBytes(hex) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i += 1) out[i] = parseInt(hex.slice(2 * i, 2 * i + 2), 16);
  return out;
}

/** The bytes hex text spells, whitespace and case aside ("AA 55" is aa55); null if it is not hex. */
export function hexBytes(text) {
  if (typeof text !== "string") return null;
  const digits = pySplitWhitespace(text).join("");
  if (digits.length % 2 || !/^[0-9A-Fa-f]*$/.test(digits)) return null;
  return hexToBytes(digits);
}

// -- text decoding --------------------------------------------------------------------------

const decoders = {};

function decoder(encoding) {
  decoders[encoding] ??= new TextDecoder(encoding === "gbk" ? "gbk" : "utf-8", { fatal: false });
  return decoders[encoding];
}

/** bytes.decode(encoding, errors="replace") for utf-8, gbk and ascii. */
export function decodeText(bytes, encoding = "utf-8") {
  if (encoding === "ascii") {
    let out = "";
    for (const byte of bytes) out += byte < 0x80 ? String.fromCharCode(byte) : "�";
    return out;
  }
  return decoder(encoding).decode(bytes);
}

let gbkTable = null;

function encodeGbk(text) {
  const out = [];
  for (const char of text) {
    const code = char.codePointAt(0);
    if (code < 0x80) {
      out.push(code);
      continue;
    }
    if (!gbkTable) {
      gbkTable = new Map();
      const gbk = new TextDecoder("gbk");
      for (let lead = 0x81; lead <= 0xfe; lead += 1) {
        for (let trail = 0x40; trail <= 0xfe; trail += 1) {
          if (trail === 0x7f) continue;
          const decoded = gbk.decode(Uint8Array.of(lead, trail));
          if (decoded.length === 1 && decoded !== "�" && !gbkTable.has(decoded)) gbkTable.set(decoded, [lead, trail]);
        }
      }
    }
    out.push(...(gbkTable.get(char) ?? [0x3f]));
  }
  return Uint8Array.from(out);
}

export function encodeText(text, encoding = "utf-8") {
  return encoding === "gbk" ? encodeGbk(text) : new TextEncoder().encode(text);
}

// -- the line parser ------------------------------------------------------------------------

export const LINE_ENCODINGS = ["utf-8", "gbk", "ascii"];
export const LINE_KV_SEPARATORS = ["=", ":"];
const ASCII_SPACE = new Set([0x20, 0x09, 0x0a, 0x0d, 0x0b, 0x0c]);
const JSON_BYTES = new Set([..."+,-.0123456789:Eaeflnrstu \t\n\r"].map((char) => char.charCodeAt(0)));
const NOT_JSON = -1;
const NMEA_TAIL = /\*[0-9A-Fa-f]{2}$/;

function autoNumber(text) {
  const integer = parsePyInt(text);
  if (integer !== null) return integer;
  const real = parsePyFloat(text);
  if (real !== null) return pyFloat(real);
  return text;
}

// JSON.parse keeps no difference between 1 and 1.0; the source text does, where the engine offers it.
function parseJsonKeepingFloats(text) {
  return JSON.parse(text, function reviver(key, value, context) {
    if (typeof value === "number" && Number.isInteger(value) && context?.source && /[.eE]/.test(context.source)) {
      return new PyFloat(value);
    }
    return value;
  });
}

export class LineParser {
  constructor({ separator = ",", terminator = "\n", kvSeparator = "=", encoding = "utf-8", maxBuffer = 65536 } = {}) {
    if (typeof separator !== "string" || !separator) throw new ParserConfigError("lineSeparator", "行分隔符不能为空");
    if (typeof terminator !== "string" || !terminator) throw new ParserConfigError("lineTerminator", "行结束符不能为空");
    if (typeof kvSeparator !== "string" || !LINE_KV_SEPARATORS.includes(kvSeparator)) {
      throw new ParserConfigError("lineKv", "键值分隔符只能是 = 或 :");
    }
    const lowered = typeof encoding === "string" ? encoding.toLowerCase() : null;
    if (!LINE_ENCODINGS.includes(lowered)) throw new ParserConfigError("lineEncoding", "编码只能是 utf-8、gbk 或 ascii");
    this.type = "line";
    this.idleTimeout = 0;
    this.buf = EMPTY;
    this.sep = separator;
    this.kv = kvSeparator;
    this.encoding = lowered;
    this.terminator = encodeText(terminator, lowered === "gbk" ? "gbk" : "utf-8");
    this.maxBuffer = maxBuffer;
    this.discarding = false;
  }

  static fromConfig(config = {}) {
    const get = (key, fallback) => (Object.hasOwn(config, key) ? config[key] : fallback);
    return new LineParser({
      separator: get("separator", ","),
      terminator: get("terminator", "\n"),
      kvSeparator: get("kvSeparator", "="),
      encoding: get("encoding", "utf-8"),
    });
  }

  reset() {
    this.buf = EMPTY;
    this.discarding = false;
  }

  frames(data) {
    return [data];
  }

  flush() {
    return [];
  }

  parse(data) {
    const results = [];
    const term = this.terminator;
    this.buf = concatBytes(this.buf, data);
    for (;;) {
      if (this.discarding) {
        const at = indexOfBytes(this.buf, term);
        if (at < 0) {
          const keep = term.length - 1;
          this.buf = keep ? this.buf.slice(-keep) : EMPTY;
          break;
        }
        this.buf = this.buf.slice(at + term.length);
        this.discarding = false;
      }
      let start = 0;
      while (start < this.buf.length && ASCII_SPACE.has(this.buf[start])) start += 1;
      this.buf = this.buf.slice(start);
      if (!this.buf.length) break;
      const jsonValue = this.buf[0] === 0x7b || this.buf[0] === 0x5b;
      let size;
      let end;
      if (jsonValue) {
        size = LineParser.jsonSize(this.buf);
        if (size === NOT_JSON) {
          this.discarding = true;
          continue;
        }
        end = size;
      } else {
        const at = indexOfBytes(this.buf, term);
        size = at < 0 ? null : at;
        end = at < 0 ? null : at + term.length;
      }
      if (end === null) {
        if (this.buf.length > this.maxBuffer) {
          this.discarding = true;
          continue;
        }
        break;
      }
      const unit = this.buf.slice(0, size);
      this.buf = this.buf.slice(end);
      let parsed;
      if (jsonValue) {
        if (startsWithBytes(this.buf, term)) this.buf = this.buf.slice(term.length);
        parsed = this.parseJson(unit);
      } else {
        parsed = this.parseRecord(unit);
      }
      if (parsed) results.push(parsed);
    }
    return results;
  }

  static jsonSize(buf) {
    let depth = 0;
    let inString = false;
    for (let index = 0; index < buf.length; index += 1) {
      const byte = buf[index];
      if (inString) {
        if (byte === 0x5c) index += 1;
        else if (byte === 0x22) inString = false;
      } else if (byte === 0x22) {
        inString = true;
      } else if (byte === 0x7b || byte === 0x5b) {
        depth += 1;
      } else if (byte === 0x7d || byte === 0x5d) {
        depth -= 1;
        if (depth === 0) return index + 1;
      } else if (!JSON_BYTES.has(byte)) {
        return NOT_JSON;
      }
    }
    return null;
  }

  parseJson(unit) {
    let value;
    try {
      value = parseJsonKeepingFloats(decodeText(unit, this.encoding));
    } catch {
      return null;
    }
    if (Array.isArray(value)) value = Object.fromEntries(value.map((item, index) => [String(index), item]));
    return value && typeof value === "object" && !(value instanceof PyFloat) && Object.keys(value).length ? value : null;
  }

  parseRecord(record) {
    let text = pyStrip(decodeText(record, this.encoding));
    if (!text) return null;
    if ((text[0] === "$" || text[0] === "!") && NMEA_TAIL.test(text)) {
      const lead = text.charCodeAt(0);
      const sentence = record.slice(record.indexOf(lead) + 1, lastIndexOfByte(record, 0x2a));
      let check = 0;
      for (const byte of sentence) check ^= byte;
      if (check !== parseInt(text.slice(-2), 16)) return null;
      text = text.slice(1, -3);
    }
    return this.parseLine(text);
  }

  parseLine(text) {
    const parts = text.split(this.sep).map(pyStrip);
    if (parts.some((part) => part.includes(this.kv))) {
      const result = {};
      for (const part of parts) {
        const at = part.indexOf(this.kv);
        if (at < 0) continue;
        result[pyStrip(part.slice(0, at))] = autoNumber(pyStrip(part.slice(at + this.kv.length)));
      }
      return Object.keys(result).length ? result : null;
    }
    const result = {};
    parts.forEach((part, index) => {
      result[`ch${index}`] = autoNumber(part);
    });
    return result;
  }
}

// -- the hex frame parser -------------------------------------------------------------------

export const HEX_ENDIANS = ["大端(BE)", "小端(LE)"];
export const HEX_LENGTH_COVERS = ["数据", "长度字段之后", "整帧"];
export const HEX_CHECKSUMS = { 无: 0, 和校验: 1, 异或: 1, CRC8: 1, "CRC16-Modbus": 2, "CRC16-CCITT": 2 };
export const HEX_FIELD_TYPES = { uint8: 1, int8: 1, uint16: 2, int16: 2, uint32: 4, int32: 4, float32: 4, float64: 8, ASCII: 0, HEX: 0 };
export const HEX_MAX_FRAME = 65536;
export const HEX_MAX_IDLE = 60000;

/** An integer setting, or null. JSON has one kind of number, so 2.0 is 2. */
function whole(value) {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function hexField(item) {
  const entry = Array.isArray(item);
  const name = entry && item.length && typeof item[0] === "string" ? item[0] : "";
  if (entry && (item.length === 4 || item.length === 5)) {
    const offset = whole(item[1]);
    const length = whole(item[2]);
    const dtype = item[3];
    const endian = item.length === 5 ? item[4] : HEX_ENDIANS[0];
    const size = typeof dtype === "string" && Object.hasOwn(HEX_FIELD_TYPES, dtype) ? HEX_FIELD_TYPES[dtype] : null;
    if (offset !== null && offset >= 0 && length !== null && length > 0 && size !== null
      && (size === 0 || size === length) && HEX_ENDIANS.includes(endian)) {
      return [name, offset, length, dtype, endian];
    }
  }
  throw new ParserConfigError("hexField", `无效 HEX 字段: ${name}`, [name]);
}

export function crc16Modbus(data) {
  let crc = 0xffff;
  for (const byte of data) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) crc = crc & 1 ? (crc >>> 1) ^ 0xa001 : crc >>> 1;
  }
  return crc;
}

/** The two CRC bytes of a Modbus RTU frame, low byte first. */
export function modbusCrcBytes(data) {
  const crc = crc16Modbus(data);
  return Uint8Array.of(crc & 0xff, crc >> 8);
}

export function hexChecksum(algorithm, data) {
  if (algorithm === "和校验") return data.reduce((sum, byte) => (sum + byte) & 0xff, 0);
  if (algorithm === "异或") return data.reduce((value, byte) => value ^ byte, 0);
  if (algorithm === "CRC8") {
    let crc = 0;
    for (const byte of data) {
      crc ^= byte;
      for (let i = 0; i < 8; i += 1) crc = crc & 0x80 ? ((crc << 1) ^ 0x07) & 0xff : (crc << 1) & 0xff;
    }
    return crc;
  }
  if (algorithm === "CRC16-Modbus") return crc16Modbus(data);
  if (algorithm === "CRC16-CCITT") {
    let crc = 0xffff;
    for (const byte of data) {
      crc ^= byte << 8;
      for (let i = 0; i < 8; i += 1) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
    return crc;
  }
  return 0;
}

function readUInt(bytes, littleEndian) {
  let value = 0;
  const ordered = littleEndian ? [...bytes].reverse() : bytes;
  for (const byte of ordered) value = value * 256 + byte;
  return value;
}

function hexValue(raw, dtype, endian) {
  const little = endian === HEX_ENDIANS[1];
  if (dtype === "float32" || dtype === "float64") {
    const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
    return pyFloat(dtype === "float32" ? view.getFloat32(0, little) : view.getFloat64(0, little));
  }
  if (dtype === "ASCII") {
    const zero = raw.indexOf(0);
    return decodeText(zero < 0 ? raw : raw.slice(0, zero), "ascii");
  }
  if (dtype === "HEX") return bytesToHexLower(raw);
  const value = readUInt(raw, little);
  if (dtype.startsWith("int") && value >= 2 ** (8 * raw.length - 1)) return value - 2 ** (8 * raw.length);
  return value;
}

export class HexFrameParser {
  constructor({
    header = Uint8Array.of(0xaa, 0x55), footer = Uint8Array.of(0x55, 0xaa), fields = null,
    maxBuffer = HEX_MAX_FRAME, lengthOffset = -1, lengthSize = 1, lengthEndian = HEX_ENDIANS[0],
    lengthCovers = HEX_LENGTH_COVERS[0], fixedLength = 0, checksum = "无", checksumStart = 0,
    checksumEndian = HEX_ENDIANS[0], idleTimeout = 0,
  } = {}) {
    if (footer !== null && footer.length === 0 && lengthOffset !== null && lengthOffset < 0
      && fixedLength === 0 && idleTimeout === 0) {
      throw new ParserConfigError("hexNoFraming", "HEX 帧需要帧尾、长度字段、固定帧长或空闲超时之一来分帧");
    }
    if (header === null || footer === null) throw new ParserConfigError("hexNotHex", "HEX 帧头或帧尾不是十六进制");
    if (fixedLength !== null && fixedLength > 0 && lengthOffset !== null && lengthOffset >= 0) {
      throw new ParserConfigError("hexFixedAndLength", "固定帧长和长度字段只能选一个");
    }
    if (lengthOffset === null || lengthOffset < -1 || (lengthSize !== 1 && lengthSize !== 2)
      || !HEX_ENDIANS.includes(lengthEndian) || !HEX_LENGTH_COVERS.includes(lengthCovers)) {
      throw new ParserConfigError("hexLength", "HEX 长度字段设置无效");
    }
    if (fixedLength === null || fixedLength < 0 || fixedLength > HEX_MAX_FRAME) {
      throw new ParserConfigError("hexFixed", "HEX 固定帧长无效");
    }
    if (typeof checksum !== "string" || !Object.hasOwn(HEX_CHECKSUMS, checksum)
      || checksumStart === null || checksumStart < 0 || !HEX_ENDIANS.includes(checksumEndian)) {
      throw new ParserConfigError("hexChecksum", "HEX 校验设置无效");
    }
    if (idleTimeout === null || idleTimeout < 0 || idleTimeout > HEX_MAX_IDLE) {
      throw new ParserConfigError("hexIdle", "HEX 空闲超时无效");
    }
    if (fields === null || fields === undefined) fields = [];
    if (!Array.isArray(fields)) throw new ParserConfigError("hexField", "无效 HEX 字段: ", [""]);
    this.type = "hex";
    this.fields = fields.map(hexField);
    this.buf = EMPTY;
    this.header = header;
    this.footer = footer;
    this.maxBuffer = maxBuffer;
    this.lengthOffset = lengthOffset;
    this.lengthSize = lengthSize;
    this.lengthLittle = lengthEndian === HEX_ENDIANS[1];
    this.lengthCovers = lengthCovers;
    this.fixedLength = fixedLength;
    this.checksum = checksum;
    this.checksumSize = HEX_CHECKSUMS[checksum];
    this.checksumStart = checksumStart;
    this.checksumLittle = checksumEndian === HEX_ENDIANS[1];
    this.idleTimeout = idleTimeout;
  }

  static fromConfig(config = {}) {
    const get = (key, fallback) => (Object.hasOwn(config, key) ? config[key] : fallback);
    return new HexFrameParser({
      header: hexBytes(get("header", "AA55")),
      footer: hexBytes(get("footer", "55AA")),
      fields: get("fields", []),
      lengthOffset: whole(get("lengthOffset", -1)),
      lengthSize: whole(get("lengthSize", 1)),
      lengthEndian: get("lengthEndian", HEX_ENDIANS[0]),
      lengthCovers: get("lengthCovers", HEX_LENGTH_COVERS[0]),
      fixedLength: whole(get("fixedLength", 0)),
      checksum: get("checksum", "无"),
      checksumStart: whole(get("checksumStart", 0)),
      checksumEndian: get("checksumEndian", HEX_ENDIANS[0]),
      idleTimeout: whole(get("idleTimeout", 0)),
    });
  }

  reset() {
    this.buf = EMPTY;
  }

  get hasEndRule() {
    return Boolean(this.fixedLength || this.lengthOffset >= 0 || this.footer.length);
  }

  frames(data) {
    this.buf = concatBytes(this.buf, data);
    const found = [];
    while (this.buf.length) {
      if (this.header.length) {
        const start = indexOfBytes(this.buf, this.header);
        if (start < 0) {
          const keep = this.header.length - 1;
          this.buf = keep ? this.buf.slice(-keep) : EMPTY;
          break;
        }
        this.buf = this.buf.slice(start);
      }
      const size = this.frameSize();
      if (size === null) {
        if (this.buf.length > this.maxBuffer) {
          this.dropOverflow();
          continue;
        }
        break;
      }
      if (size < 0 || !this.valid(this.buf.slice(0, size))) {
        this.buf = this.buf.slice(1);
        continue;
      }
      const frame = this.buf.slice(0, size);
      this.buf = this.buf.slice(size);
      if (size <= this.maxBuffer) found.push(frame);
    }
    return found;
  }

  dropOverflow() {
    const cut = this.buf.length - this.maxBuffer;
    if (!this.header.length) {
      this.buf = this.buf.slice(cut);
      return;
    }
    const start = indexOfBytes(this.buf, this.header, cut);
    if (start >= 0) {
      this.buf = this.buf.slice(start);
    } else {
      const keep = this.header.length - 1;
      this.buf = keep ? this.buf.slice(-keep) : EMPTY;
    }
  }

  frameSize() {
    const buf = this.buf;
    let size;
    if (this.fixedLength) {
      size = this.fixedLength;
    } else if (this.lengthOffset >= 0) {
      const end = this.lengthOffset + this.lengthSize;
      if (buf.length < end) return null;
      const value = readUInt(buf.slice(this.lengthOffset, end), this.lengthLittle);
      const tail = this.checksumSize + this.footer.length;
      if (this.lengthCovers === "整帧") size = value;
      else if (this.lengthCovers === "长度字段之后") size = end + value;
      else size = end + value + tail;
      if (size < end + tail || size < this.header.length || size > this.maxBuffer) return -1;
    } else if (this.footer.length) {
      const at = indexOfBytes(buf, this.footer, this.header.length);
      return at < 0 ? null : at + this.footer.length;
    } else {
      return null;
    }
    return buf.length >= size ? size : null;
  }

  valid(frame) {
    if (frame.length < this.header.length + this.checksumSize + this.footer.length) return false;
    if (this.footer.length && !endsWithBytes(frame, this.footer)) return false;
    if (!this.checksumSize) return true;
    const at = frame.length - this.footer.length - this.checksumSize;
    if (this.checksumStart > at) return false;
    const sent = readUInt(frame.slice(at, at + this.checksumSize), this.checksumLittle);
    return sent === hexChecksum(this.checksum, frame.slice(this.checksumStart, at));
  }

  flush() {
    const buf = this.buf;
    this.buf = EMPTY;
    if (this.hasEndRule || !buf.length || !startsWithBytes(buf, this.header)) return [];
    return this.valid(buf) ? [buf] : [];
  }

  parse(unit) {
    const end = Math.max(unit.length - this.checksumSize - this.footer.length, 0);
    const payload = unit.slice(this.header.length, end);
    const result = {};
    let any = false;
    for (const [name, offset, length, dtype, endian] of this.fields) {
      if (offset + length <= payload.length) {
        result[name] = hexValue(payload.slice(offset, offset + length), dtype, endian);
        any = true;
      }
    }
    return any ? [result] : [];
  }
}

// -- Modbus ---------------------------------------------------------------------------------

export const MODBUS_PARSERS = ["modbus", "modbus_tcp", "modbus_ascii"];
export const MODBUS_TABLES = { 1: "co", 2: "di", 3: "hr", 4: "ir", 0x17: "hr" };
const MODBUS_FIXED = { 0x05: 4, 0x06: 4, 0x0f: 4, 0x10: 4, 0x07: 1, 0x08: 4, 0x16: 6 };
const MODBUS_COUNTED = { 0x01: false, 0x02: false, 0x03: true, 0x04: true, 0x11: false, 0x17: true };
const MODBUS_EXCEPTIONS = new Set([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x0f, 0x10, 0x11, 0x16, 0x17].map((fc) => fc | 0x80));

/** The size of the response PDU `pdu` starts with: 0 if none starts so, null until its byte count arrives. */
export function modbusPduSize(pdu) {
  if (!pdu.length) return null;
  const fc = pdu[0];
  if (Object.hasOwn(MODBUS_COUNTED, fc)) {
    if (pdu.length < 2) return null;
    const count = pdu[1];
    if (count < 1 || count > 250 || (MODBUS_COUNTED[fc] && count % 2)) return 0;
    return 2 + count;
  }
  if (Object.hasOwn(MODBUS_FIXED, fc)) return 1 + MODBUS_FIXED[fc];
  return MODBUS_EXCEPTIONS.has(fc) ? 2 : 0;
}

export function modbusLrc(data) {
  return -data.reduce((sum, byte) => sum + byte, 0) & 0xff;
}

/** The bytes a Modbus ASCII frame spells, without the LRC; null unless it is one with the right LRC. */
export function modbusAsciiBody(frame) {
  if (frame.length < 3 || frame[0] !== 0x3a || frame[frame.length - 2] !== 0x0d || frame[frame.length - 1] !== 0x0a) return null;
  const digits = String.fromCharCode(...frame.slice(1, -2));
  if (digits.length < 4 || digits.length % 2 || !/^[0-9A-Fa-f]*$/.test(digits)) return null;
  const raw = hexToBytes(digits);
  const body = raw.slice(0, -1);
  return modbusLrc(body) === raw[raw.length - 1] ? body : null;
}

const u16 = (bytes, at) => (bytes[at] << 8) | bytes[at + 1];

/** Read requests recently sent over one link, so a response can be named by register address. */
export class ModbusRequests {
  constructor() {
    this.latest = new Map();
    this.noted = 0;
    this.transactions = new Map();
  }

  note(slave, fc, address, count, transaction = null) {
    if (transaction === null) {
      this.noted += 1;
      this.latest.set(`${slave}:${fc}`, [address, count, this.noted]);
      return;
    }
    if (this.transactions.size >= 256) this.transactions.delete(this.transactions.keys().next().value);
    this.transactions.set(transaction, [slave, fc, address, count]);
  }

  /** Note the read in an outgoing request frame, framed the way the link parses replies. */
  noteFrame(frame, parserType) {
    let body;
    let transaction = null;
    if (parserType === "modbus" && frame.length >= 8) {
      const crc = modbusCrcBytes(frame.slice(0, -2));
      if (crc[0] !== frame[frame.length - 2] || crc[1] !== frame[frame.length - 1]) return;
      body = frame.slice(0, -2);
    } else if (parserType === "modbus_tcp" && frame.length >= 12 && frame[2] === 0 && frame[3] === 0
      && u16(frame, 4) === frame.length - 6) {
      body = frame.slice(6);
      transaction = u16(frame, 0);
    } else if (parserType === "modbus_ascii") {
      body = modbusAsciiBody(frame);
      if (!body || body.length < 6) return;
    } else {
      return;
    }
    const fc = body[1];
    if (([1, 2, 3, 4].includes(fc) && body.length === 6)
      || (fc === 0x17 && body.length >= 11 && body.length === 11 + 2 * u16(body, 8))) {
      this.note(body[0], fc, u16(body, 2), u16(body, 4), transaction);
    }
  }

  take(slave, fc, transaction = null, answered = null) {
    fc &= 0x7f;
    if (transaction === null) {
      const entry = this.latest.get(`${slave}:${fc}`);
      if (!entry) return null;
      const [address, count, number] = entry;
      if (answered) {
        if (answered.get(`${slave}:${fc}`) === number) return null;
        answered.set(`${slave}:${fc}`, number);
      }
      return [address, count];
    }
    const request = this.transactions.get(transaction);
    if (!request || request[0] !== slave || request[1] !== fc) return null;
    return request.slice(2);
  }
}

/** A response PDU body (the bytes after the function code) as the parsers' message. */
export function modbusResponse(slave, fc, data, fields = [], request = null) {
  const result = { slave, fc };
  let values = [];
  if (fc === 0x03 || fc === 0x04 || fc === 0x17) {
    const payload = data.slice(1);
    const regs = [];
    for (let i = 0; i + 1 < payload.length; i += 2) regs.push(u16(payload, i));
    regs.forEach((value, index) => {
      result[index < fields.length ? fields[index] : `reg${index}`] = value;
    });
    if (request && request[1] === regs.length) values = regs;
  } else if (fc === 0x01 || fc === 0x02) {
    const bits = [];
    for (const byte of data.slice(1)) for (let bit = 0; bit < 8; bit += 1) bits.push((byte >> bit) & 1);
    bits.forEach((value, index) => {
      result[index < fields.length ? fields[index] : `coil${index}`] = value;
    });
    if (request && Math.floor((request[1] + 7) / 8) === data.length - 1) values = bits.slice(0, request[1]);
  } else if (fc >= 0x80) {
    result.error = data[0];
    if (request) result.start = request[0];
  } else if (fc === 0x07) {
    result.status = data[0];
  } else if (fc === 0x08) {
    result.subfunction = u16(data, 0);
    result.data = u16(data, 2);
  } else if (fc === 0x11) {
    result.id = data[1];
    result.run = data[2] === 0xff ? 1 : 0;
    result.extra = bytesToHexLower(data.slice(3));
  } else if (fc === 0x16) {
    result.address = u16(data, 0);
    result.andMask = u16(data, 2);
    result.orMask = u16(data, 4);
  } else {
    result.address = u16(data, 0);
    result.value = u16(data, 2);
  }
  if (values.length) {
    const start = request[0];
    result.start = start;
    const table = MODBUS_TABLES[fc];
    values.forEach((value, offset) => {
      result[`${table}${start + offset}`] = value;
    });
  }
  return result;
}

class ModbusRtuParser {
  constructor(fields = [], requests = null) {
    this.type = "modbus";
    this.idleTimeout = 0;
    this.buf = EMPTY;
    this.fields = fields || [];
    this.requests = requests ?? new ModbusRequests();
    this.answered = new Map();
  }

  reset() {
    this.buf = EMPTY;
  }

  frames(data) {
    return [data];
  }

  flush() {
    return [];
  }

  static frameLength(buf) {
    if (buf.length < 3) return null;
    if (buf[0] < 1 || buf[0] > 247) return 0;
    const size = modbusPduSize(buf.slice(1));
    return size ? size + 3 : 0;
  }

  static crcOk(frame) {
    const crc = modbusCrcBytes(frame.slice(0, -2));
    return crc[0] === frame[frame.length - 2] && crc[1] === frame[frame.length - 1];
  }

  parse(data) {
    this.buf = concatBytes(this.buf, data);
    const results = [];
    while (this.buf.length >= 5) {
      const length = ModbusRtuParser.frameLength(this.buf);
      if (!length) {
        this.buf = this.buf.slice(1);
        continue;
      }
      if (this.buf.length < length) {
        let found = false;
        for (let offset = 1; offset < this.buf.length - 4; offset += 1) {
          const tail = this.buf.slice(offset);
          const size = ModbusRtuParser.frameLength(tail);
          if (size && tail.length >= size && ModbusRtuParser.crcOk(tail.slice(0, size))) {
            this.buf = tail;
            found = true;
            break;
          }
        }
        if (found) continue;
        break;
      }
      const frame = this.buf.slice(0, length);
      if (!ModbusRtuParser.crcOk(frame)) {
        this.buf = this.buf.slice(1);
        continue;
      }
      this.buf = this.buf.slice(length);
      const request = this.requests.take(frame[0], frame[1], null, this.answered);
      results.push(modbusResponse(frame[0], frame[1], frame.slice(2, -2), this.fields, request));
    }
    return results;
  }
}

class ModbusTcpParser {
  constructor(fields = [], requests = null) {
    this.type = "modbus_tcp";
    this.idleTimeout = 0;
    this.buf = EMPTY;
    this.fields = fields || [];
    this.requests = requests ?? new ModbusRequests();
  }

  reset() {
    this.buf = EMPTY;
  }

  frames(data) {
    return [data];
  }

  flush() {
    return [];
  }

  static frameLength(buf) {
    if (u16(buf, 2) !== 0) return 0;
    const length = u16(buf, 4);
    const size = modbusPduSize(buf.slice(7));
    if (!size || length !== size + 1) return 0;
    return 6 + length;
  }

  parse(data) {
    this.buf = concatBytes(this.buf, data);
    const results = [];
    while (this.buf.length >= 9) {
      const length = ModbusTcpParser.frameLength(this.buf);
      if (!length) {
        this.buf = this.buf.slice(1);
        continue;
      }
      if (this.buf.length < length) break;
      const frame = this.buf.slice(0, length);
      this.buf = this.buf.slice(length);
      const request = this.requests.take(frame[6], frame[7], u16(frame, 0));
      results.push(modbusResponse(frame[6], frame[7], frame.slice(8), this.fields, request));
    }
    return results;
  }
}

class ModbusAsciiParser {
  static MAX_FRAME = 511;

  constructor(fields = [], requests = null) {
    this.type = "modbus_ascii";
    this.idleTimeout = 0;
    this.buf = EMPTY;
    this.fields = fields || [];
    this.requests = requests ?? new ModbusRequests();
    this.answered = new Map();
  }

  reset() {
    this.buf = EMPTY;
  }

  frames(data) {
    return [data];
  }

  flush() {
    return [];
  }

  parse(data) {
    this.buf = concatBytes(this.buf, data);
    const results = [];
    for (;;) {
      const start = this.buf.indexOf(0x3a);
      if (start < 0) {
        this.buf = EMPTY;
        break;
      }
      this.buf = this.buf.slice(start);
      const end = indexOfBytes(this.buf, Uint8Array.of(0x0d, 0x0a), 1);
      if (end < 0) {
        if (this.buf.length > ModbusAsciiParser.MAX_FRAME) {
          this.buf = this.buf.slice(1);
          continue;
        }
        break;
      }
      const body = modbusAsciiBody(this.buf.slice(0, end + 2));
      if (!body || body.length < 2 || body[0] < 1 || body[0] > 247 || modbusPduSize(body.slice(1)) !== body.length - 1) {
        this.buf = this.buf.slice(1);
        continue;
      }
      this.buf = this.buf.slice(end + 2);
      const request = this.requests.take(body[0], body[1], null, this.answered);
      results.push(modbusResponse(body[0], body[1], body.slice(2), this.fields, request));
    }
    return results;
  }
}

// -- request frames -------------------------------------------------------------------------

/** A Modbus RTU request: FC 01-04 read `count`, 05/06 write `value`, 0x10 write `registers`. */
export function buildModbusFrame(slave, func, address, value = 0, count = 1, registers = []) {
  const pdu = [slave, func, address >> 8, address & 0xff];
  if ([1, 2, 3, 4].includes(func)) {
    pdu.push(count >> 8, count & 0xff);
  } else if (func === 0x10) {
    pdu.push(registers.length >> 8, registers.length & 0xff, 2 * registers.length);
    for (const register of registers) pdu.push(register >> 8, register & 0xff);
  } else {
    pdu.push((value >> 8) & 0xff, value & 0xff);
  }
  const body = Uint8Array.from(pdu);
  return concatBytes(body, modbusCrcBytes(body));
}

export function buildModbusAsciiFrame(slave, func, address, value = 0, count = 1, registers = []) {
  const body = buildModbusFrame(slave, func, address, value, count, registers).slice(0, -2);
  const text = `:${bytesToHexLower(concatBytes(body, Uint8Array.of(modbusLrc(body)))).toUpperCase()}\r\n`;
  return new TextEncoder().encode(text);
}

export function buildModbusTcpFrame(unit, func, address, value = 0, count = 1, transaction = 0, registers = []) {
  const pdu = buildModbusFrame(unit, func, address, value, count, registers).slice(1, -2);
  const body = concatBytes(Uint8Array.of(unit), pdu);
  return concatBytes(Uint8Array.of(transaction >> 8, transaction & 0xff, 0, 0, body.length >> 8, body.length & 0xff), body);
}

// -- creating parsers -----------------------------------------------------------------------

export const PARSER_TYPES = ["line", "hex", "modbus", "modbus_tcp", "modbus_ascii"];

/** A parser for one byte stream; Modbus parsers on one link share that link's requests. */
export function createParser(parserType, config = {}, requests = null) {
  const settings = config && typeof config === "object" && !Array.isArray(config) ? config : {};
  if (parserType === "line") return LineParser.fromConfig(settings);
  if (parserType === "hex") return HexFrameParser.fromConfig(settings);
  const fields = Array.isArray(settings.fields) ? settings.fields : [];
  if (parserType === "modbus") return new ModbusRtuParser(fields, requests);
  if (parserType === "modbus_tcp") return new ModbusTcpParser(fields, requests);
  if (parserType === "modbus_ascii") return new ModbusAsciiParser(fields, requests);
  throw new ParserConfigError("unknownParser", `未知解析模式: ${parserType}`, [String(parserType)]);
}

/** The encoding a link's text arrives in: the line parser's, UTF-8 for every other parser. */
export function textEncoding(parserType, config = {}) {
  if (parserType !== "line") return "utf-8";
  const encoding = config?.encoding ?? "utf-8";
  return typeof encoding === "string" ? encoding.toLowerCase() : "utf-8";
}
