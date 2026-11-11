// Data bindings of a .uidp runtime, as PyQt UI Designer's data_binding.py, binding_values.py and
// chart_runtime.py have them: a value is taken from a parsed message (键值匹配 / JSON路径 / Modbus)
// or from the raw frame bytes (HEX字节提取), put through the expression, formatted for display and
// converted for the widget it updates. Pure: no DOM.

import { evaluateExpression } from "./expression.js";
import { concatBytes, decodeText, indexOfBytes } from "./parsers.js";
import {
  displayString,
  formatFixed,
  isFloat,
  isInt,
  isNumber,
  numberOf,
  parsePyInt,
  pyFloat,
  roundSignificant15,
  toInteger,
  toReal,
} from "./py-values.js";

/** The property a binding writes into, per widget type. */
export const BIND_PROPERTIES = {
  Label: "text",
  LEDIndicator: "on",
  NumericDisplay: "value",
  ProgressBar: "value",
  ProgressRingDisplay: "value",
  GaugeMeter: "value",
  ToggleSwitch: "checked",
  Slider: "value",
  SpinBox: "value",
};

export const PARSE_MODES = ["键值匹配", "JSON路径", "HEX字节提取", "Modbus"];
export const MODBUS_AREAS = { 保持寄存器: "hr", 输入寄存器: "ir", 线圈: "co", 离散输入: "di" };
const MODBUS_REGISTERS = { uint16: 1, int16: 1, uint32: 2, int32: 2, float32: 2 };
const RAW_TYPES = { uint8: 1, int8: 1, uint16: 2, int16: 2, uint32: 4, int32: 4, float32: 4 };

/** A binding's own error: the value is rejected and the widget keeps what it shows. */
class Rejected extends Error {}

/** Header / tail text of a binding: spaces dropped, an odd digit count gets a leading 0, not hex is empty. */
export function bindingHex(text) {
  let compact = String(text ?? "").replace(/\s+/g, "");
  if (!compact) return new Uint8Array(0);
  if (compact.length % 2) compact = `0${compact}`;
  if (!/^[0-9A-Fa-f]*$/.test(compact)) return new Uint8Array(0);
  return Uint8Array.from(compact.match(/../g).map((pair) => parseInt(pair, 16)));
}

/** Raw widget bindings are framed by their own header and tail when both are set; else the unit is the frame. */
export class RawFrameBuffer {
  constructor(header, footer, maxBuffer = 65536) {
    this.header = header;
    this.footer = footer;
    this.maxBuffer = maxBuffer;
    this.buf = new Uint8Array(0);
  }

  reset() {
    this.buf = new Uint8Array(0);
  }

  feed(data) {
    if (!this.header.length || !this.footer.length) return [data];
    this.buf = concatBytes(this.buf, data);
    const frames = [];
    while (this.buf.length) {
      const start = indexOfBytes(this.buf, this.header);
      if (start < 0) {
        const keep = this.header.length - 1;
        this.buf = keep ? this.buf.slice(-keep) : new Uint8Array(0);
        break;
      }
      this.buf = this.buf.slice(start);
      let end = indexOfBytes(this.buf, this.footer, this.header.length);
      if (end < 0) {
        if (this.buf.length > this.maxBuffer) {
          this.buf = this.buf.slice(1);
          continue;
        }
        break;
      }
      end += this.footer.length;
      if (end <= this.maxBuffer) frames.push(this.buf.slice(0, end));
      this.buf = this.buf.slice(end);
    }
    return frames;
  }
}

function stripFrame(raw, header, tail) {
  let data = raw;
  if (header.length) {
    const at = indexOfBytes(data, header);
    if (at < 0) return null;
    data = data.slice(at + header.length);
  }
  if (tail.length) {
    const at = indexOfBytes(data, tail);
    if (at < 0) return null;
    data = data.slice(0, at);
  }
  return data;
}

function unpackRaw(payload, offset, dataType, bigEndian) {
  const size = RAW_TYPES[dataType];
  if (!size || offset < 0 || offset + size > payload.length) return null;
  const view = new DataView(payload.buffer, payload.byteOffset + offset, size);
  const little = !bigEndian;
  switch (dataType) {
    case "uint8": return view.getUint8(0);
    case "int8": return view.getInt8(0);
    case "uint16": return view.getUint16(0, little);
    case "int16": return view.getInt16(0, little);
    case "uint32": return view.getUint32(0, little);
    case "int32": return view.getInt32(0, little);
    default: return pyFloat(view.getFloat32(0, little));
  }
}

/** JSON path through parsed data: dot-separated, list indexes may count from the end. */
export function resolvePath(data, path) {
  let node = data;
  for (const part of String(path).split(".")) {
    if (node === null || node === undefined) return null;
    if (Array.isArray(node)) {
      const index = parsePyInt(part);
      if (index === null) return null;
      const at = index < 0 ? node.length + index : index;
      if (at < 0 || at >= node.length) return null;
      node = node[at];
    } else if (typeof node === "object" && !isNumber(node)) {
      node = Object.hasOwn(node, part) ? node[part] : null;
    } else {
      return null;
    }
  }
  return node ?? null;
}

function bindingRegister(value) {
  if (!isInt(value) || value < 0 || value > 65535) throw new Rejected();
  return value;
}

/** One value from a parsed Modbus response, or null when the response does not hold it. */
export function modbusValue(data, address, dataType = "uint16", regOrder = "大端(AB CD)", fcFilter = -1, slaveFilter = -1, area = "保持寄存器") {
  if (slaveFilter >= 0 && data.slave !== slaveFilter) return null;
  const fc = data.fc ?? 0;
  if (fcFilter >= 0 && fc !== fcFilter) return null;
  const table = MODBUS_AREAS[area];
  if (!table) return null;
  if (table === "co" || table === "di") return data[`${table}${address}`] ?? null;
  let r0 = data[`${table}${address}`];
  if (r0 === undefined || r0 === null) return null;
  r0 = bindingRegister(r0);
  if (dataType === "uint16") return r0;
  if (dataType === "int16") return r0 > 32767 ? r0 - 65536 : r0;
  let r1 = data[`${table}${address + 1}`];
  if (r1 === undefined || r1 === null) return null;
  r1 = bindingRegister(r1);
  const [high, low] = regOrder === "大端(AB CD)" ? [r0, r1] : [r1, r0];
  const view = new DataView(new ArrayBuffer(4));
  view.setUint16(0, high);
  view.setUint16(2, low);
  if (dataType === "uint32") return view.getUint32(0);
  if (dataType === "int32") return view.getInt32(0);
  if (dataType === "float32") return pyFloat(view.getFloat32(0));
  return r0;
}

/** What a Modbus binding or curve reads, for the poller: { slave, table, address, count, period }, or null. */
export function modbusNeed(area, address, dataType = "uint16", slaveFilter = -1, period = 0) {
  const table = MODBUS_AREAS[area];
  if (!table) return null;
  const count = table === "co" || table === "di" ? 1 : MODBUS_REGISTERS[dataType] ?? 1;
  const whole = (value, fallback) => toInteger(value) ?? fallback;
  return {
    slave: whole(slaveFilter, -1),
    table,
    address: whole(address, 0),
    count,
    period: Math.max(0, Math.min(60000, whole(period, 0))),
  };
}

// -- conversions --------------------------------------------------------------------------

export function bindingInteger(value) {
  const number = toInteger(value);
  if (number === null || number < -(2 ** 31) || number >= 2 ** 31) throw new Rejected();
  return number;
}

export function bindingFloat(value) {
  const number = toReal(value);
  if (number === null || !Number.isFinite(number)) throw new Rejected();
  return number;
}

export function bindingBoolean(value) {
  if (typeof value === "string") {
    const token = value.trim().toLowerCase();
    if (["true", "on", "yes"].includes(token)) return true;
    if (["false", "off", "no"].includes(token)) return false;
  }
  return bindingFloat(value) !== 0;
}

export function bindingLed(value, onValue = "1", offValue = "0") {
  const text = displayString(value).trim();
  if (text === onValue) return true;
  if (text === offValue) return false;
  try {
    return bindingFloat(value) === bindingFloat(onValue);
  } catch (error) {
    if (!(error instanceof Rejected)) throw error;
    return bindingBoolean(value);
  }
}

/** A number with a fixed count of decimals (text, half to even); "自动" keeps 15 significant digits. */
export function bindingDecimals(value, places = "自动") {
  if (places === "自动" || places === "" || places === null || places === undefined || typeof value === "boolean") {
    if (isFloat(value) && Number.isFinite(numberOf(value))) return pyFloat(roundSignificant15(numberOf(value)));
    return value;
  }
  const number = toReal(value);
  const digits = parsePyInt(String(places));
  if (number === null || digits === null || digits < 0 || !Number.isFinite(number)) return value;
  return formatFixed(number, digits);
}

function radixText(magnitude, radix, width) {
  return magnitude.toString(radix).toUpperCase().padStart(width, "0");
}

export function formatDisplay(value, displayFormat = "自动", decimals = "自动") {
  if (displayFormat === "自动") return bindingDecimals(value, decimals);
  let num;
  if (typeof value === "boolean") num = value ? 1n : 0n;
  else if (isInt(value)) num = BigInt(value);
  else {
    const real = toReal(value);
    if (real === null || !Number.isFinite(real)) return value;
    num = BigInt(Math.trunc(real));
  }
  const negative = num < 0n;
  const magnitude = negative ? -num : num;
  const sign = negative ? "-" : "";
  if (displayFormat === "十六进制(HEX)") return `${sign}0x${radixText(magnitude, 16, 2)}`;
  if (displayFormat === "二进制(BIN)") return `${sign}0b${radixText(magnitude, 2, 8)}`;
  if (displayFormat === "十进制") return num.toString();
  return value;
}

/** The value a widget takes for a bound value (Label text, a switch's state, a slider's integer…). */
export function toWidgetValue(type, value, props = {}) {
  switch (type) {
    case "ToggleSwitch": return bindingBoolean(value);
    case "Slider":
    case "SpinBox":
    case "ProgressBar":
    case "ProgressRingDisplay": return bindingInteger(value);
    case "GaugeMeter": return bindingFloat(value);
    case "LEDIndicator": return bindingLed(value, String(props.onValue ?? "1"), String(props.offValue ?? "0"));
    case "Label": return displayString(value);
    default: return value;
  }
}

// -- one binding --------------------------------------------------------------------------

const int = (value, fallback) => toInteger(value) ?? fallback;

/** Whether a binding has what its parse mode needs; others do nothing. */
export function bindingConfigured(binding) {
  if (!binding || typeof binding !== "object") return false;
  const mode = binding.parseMode ?? "键值匹配";
  return (mode === "键值匹配" && Boolean(binding.key))
    || (mode === "JSON路径" && Boolean(binding.jsonPath))
    || mode === "HEX字节提取" || mode === "Modbus";
}

export class BindingEntry {
  /** The binding of a widget (its JSON), or null when it has none that is configured. */
  static fromWidget(widget) {
    const binding = widget?.binding;
    if (!bindingConfigured(binding)) return null;
    return new BindingEntry(widget);
  }

  constructor(widget) {
    const binding = widget.binding;
    const props = widget.properties ?? {};
    this.widgetId = widget.id;
    this.type = widget.type;
    this.prop = BIND_PROPERTIES[widget.type] ?? "text";
    this.parseMode = binding.parseMode ?? "键值匹配";
    this.key = String(binding.key ?? "");
    this.jsonPath = String(binding.jsonPath ?? "");
    this.byteOffset = int(binding.byteOffset, 0);
    this.dataType = String(binding.dataType ?? "uint16");
    this.byteOrder = String(binding.byteOrder ?? "大端(BE)");
    this.expression = binding.expression ? String(binding.expression) : "";
    this.frameHeader = bindingHex(binding.frameHeader ?? "");
    this.frameTail = bindingHex(binding.frameTail ?? "");
    this.rawFrames = new RawFrameBuffer(this.frameHeader, this.frameTail);
    this.mbRegIndex = int(binding.mbRegIndex, 0);
    this.mbSlaveFilter = int(binding.mbSlaveFilter, -1);
    this.mbDataType = String(binding.mbDataType ?? "uint16");
    this.mbRegOrder = String(binding.mbRegOrder ?? "大端(AB CD)");
    this.mbFcFilter = int(binding.mbFcFilter, -1);
    this.mbArea = String(binding.mbArea ?? "保持寄存器");
    this.mbPeriod = int(binding.mbPeriod, 0);
    this.displayFormat = String(props.displayFormat ?? "自动");
    this.decimals = String(props.decimals ?? "自动");
    this.props = props;
  }

  get usesRaw() {
    return this.parseMode === "HEX字节提取";
  }

  modbusNeed() {
    if (this.parseMode !== "Modbus") return null;
    return modbusNeed(this.mbArea, this.mbRegIndex, this.mbDataType, this.mbSlaveFilter, this.mbPeriod);
  }

  resetStream() {
    this.rawFrames.reset();
  }

  extractFromParsed(data) {
    if (this.parseMode === "键值匹配") return Object.hasOwn(data, this.key) ? data[this.key] : null;
    if (this.parseMode === "JSON路径") return resolvePath(data, this.jsonPath);
    if (this.parseMode === "Modbus") {
      return modbusValue(data, this.mbRegIndex, this.mbDataType, this.mbRegOrder, this.mbFcFilter, this.mbSlaveFilter, this.mbArea);
    }
    return null;
  }

  extractFromRaw(raw) {
    const payload = stripFrame(raw, this.frameHeader, this.frameTail);
    if (payload === null) return null;
    if (this.dataType === "ASCII") {
      if (this.byteOffset < 0 || this.byteOffset > payload.length) return null;
      let end = payload.indexOf(0, this.byteOffset);
      if (end < 0) end = payload.length;
      return decodeText(payload.slice(this.byteOffset, end), "ascii");
    }
    return unpackRaw(payload, this.byteOffset, this.dataType, this.byteOrder === "大端(BE)");
  }

  evaluate(raw) {
    if (!this.expression) return raw;
    const result = evaluateExpression(this.expression, raw);
    return result === undefined ? raw : result;
  }

  format(value) {
    if (this.prop !== "text" && this.prop !== "value") return value;
    return formatDisplay(value, this.displayFormat, this.decimals);
  }

  /** The value the widget takes for an extracted one; throws Rejected for one it cannot show. */
  push(raw) {
    return toWidgetValue(this.type, this.format(this.evaluate(raw)), this.props);
  }

  /** The values the widget takes for one parsed message (none or one). */
  onParsed(data) {
    if (this.usesRaw) return [];
    try {
      const value = this.extractFromParsed(data);
      return value === null || value === undefined ? [] : [this.push(value)];
    } catch (error) {
      if (error instanceof Rejected) return [];
      throw error;
    }
  }

  /** The values the widget takes for one raw unit (one per frame the binding finds in it). */
  onRaw(raw) {
    if (!this.usesRaw) return [];
    const out = [];
    for (const frame of this.rawFrames.feed(raw)) {
      const value = this.extractFromRaw(frame);
      if (value === null || value === undefined) continue;
      try {
        out.push(this.push(value));
      } catch (error) {
        if (!(error instanceof Rejected)) throw error;
      }
    }
    return out;
  }
}

// -- chart curves -------------------------------------------------------------------------

export const MAX_CURVES = 8;
export const CURVE_FIELDS = {
  expression: "", parseMode: "键值匹配", key: "", jsonPath: "", byteOffset: 0, dataType: "float32", byteOrder: "大端(BE)",
  frameHeader: "", frameTail: "", regIndex: 0, mbDataType: "uint16", mbRegOrder: "大端(AB CD)",
  mbFcFilter: -1, mbSlaveFilter: -1, mbArea: "保持寄存器",
};

export function defaultCurveName(index) {
  return `曲线${index + 1}`;
}

export function curveCount(props = {}) {
  return Math.max(1, Math.min(MAX_CURVES, toInteger(props.curveCount ?? 1) ?? 1));
}

/** The curves of a RealtimeChart's flat _curve_{i}_{field} properties. */
export function curveConfigs(props = {}) {
  const cfgs = [];
  for (let i = 0; i < curveCount(props); i += 1) {
    const cfg = { ...CURVE_FIELDS, name: props[`_curve_${i}_name`] ?? defaultCurveName(i) };
    for (const field of Object.keys(CURVE_FIELDS)) {
      const stored = props[`_curve_${i}_${field}`];
      if (stored !== undefined && stored !== null) cfg[field] = stored;
    }
    cfgs.push(cfg);
  }
  return cfgs;
}

/** One chart curve: numbers from parsed messages or raw units. */
export class CurveEntry {
  constructor(cfg) {
    this.cfg = cfg;
    this.header = bindingHex(cfg.frameHeader);
    this.tail = bindingHex(cfg.frameTail);
    this.rawFrames = new RawFrameBuffer(this.header, this.tail);
  }

  resetStream() {
    this.rawFrames.reset();
  }

  modbusNeed() {
    if (this.cfg.parseMode !== "Modbus") return null;
    return modbusNeed(this.cfg.mbArea, this.cfg.regIndex, this.cfg.mbDataType, this.cfg.mbSlaveFilter, 0);
  }

  // Transform once after extraction, before the sample reaches the chart/history.
  sample(raw) {
    const original = toReal(raw);
    if (original === null || !Number.isFinite(original)) return [];
    if (!this.cfg.expression) return [original];
    // Numeric text is a float, while actual integers retain bitwise expression semantics.
    const input = typeof raw === "string" ? pyFloat(original) : raw;
    const result = evaluateExpression(this.cfg.expression, input);
    const number = result === null || result === undefined ? null : toReal(result);
    return [number === null || !Number.isFinite(number) ? original : number];
  }

  onParsed(data) {
    const { cfg } = this;
    let value = null;
    try {
      if (cfg.parseMode === "键值匹配") {
        const key = cfg.key || cfg.name || "";
        if (key && Object.hasOwn(data, key)) value = data[key];
      } else if (cfg.parseMode === "JSON路径") {
        if (cfg.jsonPath) value = resolvePath(data, cfg.jsonPath);
      } else if (cfg.parseMode === "Modbus") {
        value = modbusValue(data, int(cfg.regIndex, 0), cfg.mbDataType, cfg.mbRegOrder, int(cfg.mbFcFilter, -1), int(cfg.mbSlaveFilter, -1), cfg.mbArea);
      }
    } catch (error) {
      if (error instanceof Rejected) return [];
      throw error;
    }
    return value === null || value === undefined ? [] : this.sample(value);
  }

  onRaw(raw) {
    const { cfg } = this;
    if (cfg.parseMode !== "HEX字节提取" || !RAW_TYPES[cfg.dataType]) return [];
    const out = [];
    const offset = int(cfg.byteOffset, 0);
    for (const frame of this.rawFrames.feed(raw)) {
      const payload = stripFrame(frame, this.header, this.tail);
      if (payload === null) continue;
      const value = unpackRaw(payload, offset, cfg.dataType, cfg.byteOrder === "大端(BE)");
      if (value !== null) out.push(...this.sample(value));
    }
    return out;
  }
}
