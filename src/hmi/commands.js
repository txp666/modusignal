// What a .uidp control sends: the command encoders of PyQt UI Designer's command_runtime.py and
// the per-widget wiring of preview_interface.py (_wire_commands / _apply_template). Commands read
// the widget's own properties as the file has them (no registry defaults). Pure: no DOM.

import { parsePyFloat, parsePyInt, toInteger } from "./py-values.js";
import { buildModbusAsciiFrame, buildModbusFrame, buildModbusTcpFrame, concatBytes, hexToBytes } from "./parsers.js";

export class CommandError extends Error {
  constructor(code, message, args = []) {
    super(message);
    this.code = code;
    this.args = args;
  }
}

const NEWLINES = { 无: "", "\\r\\n": "\r\n", "\\n": "\n", "\\r": "\r" };
const PLACEHOLDER = "{value}";

const prop = (props, name, fallback) => {
  const value = props?.[name];
  return value === undefined || value === null ? fallback : value;
};

const textProp = (props, name, fallback) => String(prop(props, name, fallback));

// -- HEX ------------------------------------------------------------------------------------

/** HEX text as bytes: whitespace ignored, an odd digit count gets a leading 0, anything else is an error. */
export function commandHex(text) {
  let compact = String(text).replace(/\s+/g, "");
  if (compact.length % 2) compact = `0${compact}`;
  if (!/^[0-9A-Fa-f]*$/.test(compact)) {
    throw new CommandError("hexInvalid", "HEX 格式错误，请检查内容、帧头和帧尾");
  }
  return hexToBytes(compact);
}

export function commandHexFrame(command, header = "", tail = "") {
  return concatBytes(commandHex(header), commandHex(command), commandHex(tail));
}

const PACK_TYPES = {
  uint8: [1, 0, 0xff], int8: [1, -0x80, 0x7f], uint16: [2, 0, 0xffff], int16: [2, -0x8000, 0x7fff],
  uint32: [4, 0, 0xffffffff], int32: [4, -0x80000000, 0x7fffffff], float32: [4],
};

function packValue(value, type, bigEndian) {
  const [size, low, high] = PACK_TYPES[type];
  const out = new Uint8Array(size);
  const view = new DataView(out.buffer);
  if (type === "float32") {
    const number = typeof value === "number" ? value : parsePyFloat(value);
    const single = number === null ? NaN : Math.fround(number);
    if (!Number.isFinite(number) || !Number.isFinite(single)) throw new CommandError("valueRange", "数值无效或超出数据类型范围");
    view.setFloat32(0, number, !bigEndian);
    return out;
  }
  const number = typeof value === "number" ? Math.trunc(value) : parsePyInt(value);
  if (number === null || !Number.isFinite(number) || number < low || number > high) {
    throw new CommandError("valueRange", "数值无效或超出数据类型范围");
  }
  const bits = number < 0 ? number + 2 ** (8 * size) : number;
  for (let i = 0; i < size; i += 1) {
    const shift = bigEndian ? 8 * (size - 1 - i) : 8 * i;
    out[i] = Math.floor(bits / 2 ** shift) & 0xff;
  }
  return out;
}

const hexOf = (bytes) => [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");

// -- JSON -----------------------------------------------------------------------------------

const JSON_MAX_DEPTH = 512;
const jsonSpace = (c) => c === " " || c === "\t" || c === "\n" || c === "\r";

class JsonValidator {
  constructor(text) {
    this.text = text;
    this.pos = 0;
  }

  valid() {
    this.skip();
    if (!this.value(0)) return false;
    this.skip();
    return this.pos === this.text.length;
  }

  peek() {
    return this.text[this.pos];
  }

  eat(c) {
    if (this.text[this.pos] !== c) return false;
    this.pos += 1;
    return true;
  }

  skip() {
    while (this.pos < this.text.length && jsonSpace(this.text[this.pos])) this.pos += 1;
  }

  digits() {
    const start = this.pos;
    while (this.pos < this.text.length && this.text[this.pos] >= "0" && this.text[this.pos] <= "9") this.pos += 1;
    return this.pos > start;
  }

  literal(word) {
    if (!this.text.startsWith(word, this.pos)) return false;
    this.pos += word.length;
    return true;
  }

  value(depth) {
    switch (this.peek()) {
      case "{": return this.object(depth);
      case "[": return this.array(depth);
      case "\"": return this.string();
      case "t": return this.literal("true");
      case "f": return this.literal("false");
      case "n": return this.literal("null");
      default: return this.number();
    }
  }

  object(depth) {
    if (depth >= JSON_MAX_DEPTH) return false;
    this.pos += 1;
    this.skip();
    if (this.eat("}")) return true;
    for (;;) {
      this.skip();
      if (this.peek() !== "\"" || !this.string()) return false;
      this.skip();
      if (!this.eat(":")) return false;
      this.skip();
      if (!this.value(depth + 1)) return false;
      this.skip();
      if (this.eat("}")) return true;
      if (!this.eat(",")) return false;
    }
  }

  array(depth) {
    if (depth >= JSON_MAX_DEPTH) return false;
    this.pos += 1;
    this.skip();
    if (this.eat("]")) return true;
    for (;;) {
      this.skip();
      if (!this.value(depth + 1)) return false;
      this.skip();
      if (this.eat("]")) return true;
      if (!this.eat(",")) return false;
    }
  }

  string() {
    this.pos += 1;
    while (this.pos < this.text.length) {
      const c = this.text[this.pos];
      this.pos += 1;
      if (c === "\"") return true;
      if (c.charCodeAt(0) < 0x20) return false;
      if (c !== "\\") continue;
      if (this.pos >= this.text.length) return false;
      const e = this.text[this.pos];
      this.pos += 1;
      if (e === "u") {
        for (let i = 0; i < 4; i += 1) {
          if (!/[0-9a-fA-F]/.test(this.text[this.pos] ?? "")) return false;
          this.pos += 1;
        }
      } else if (!"\"\\/bfnrt".includes(e)) {
        return false;
      }
    }
    return false;
  }

  number() {
    this.eat("-");
    if (!this.eat("0") && !this.digits()) return false;
    if (this.eat(".") && !this.digits()) return false;
    if (this.eat("e") || this.eat("E")) {
      if (!this.eat("+")) this.eat("-");
      if (!this.digits()) return false;
    }
    return true;
  }
}

export function isJson(text) {
  return new JsonValidator(text).valid();
}

/** One pass: drop JSON whitespace outside strings and replace each {value} outside strings; null for one inside a string. */
function fillJson(text, valueJson) {
  let out = "";
  let inString = false;
  let escaped = false;
  for (let i = 0; i < text.length;) {
    const c = text[i];
    const placeholder = valueJson !== null && text.startsWith(PLACEHOLDER, i);
    if (inString) {
      if (placeholder) return null;
      out += c;
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === "\"") inString = false;
      i += 1;
    } else if (placeholder) {
      out += valueJson;
      i += PLACEHOLDER.length;
    } else {
      if (!jsonSpace(c)) {
        out += c;
        inString = c === "\"";
      }
      i += 1;
    }
  }
  return out;
}

/** Python's json.dumps(text, ensure_ascii=False). */
export function jsonString(text) {
  let out = "\"";
  for (const c of text) {
    const code = c.codePointAt(0);
    if (c === "\"") out += "\\\"";
    else if (c === "\\") out += "\\\\";
    else if (code === 0x08) out += "\\b";
    else if (code === 0x0c) out += "\\f";
    else if (code === 0x0a) out += "\\n";
    else if (code === 0x0d) out += "\\r";
    else if (code === 0x09) out += "\\t";
    else if (code < 0x20) out += `\\u${code.toString(16).padStart(4, "0")}`;
    else out += c;
  }
  return `${out}"`;
}

// Python's str.isspace() over the whole text (an empty one counts as blank too).
const blank = (text) => /^[\s\x1c-\x1f\x85]*$/u.test(text);

/** The text a control in JSON mode sends. */
export function jsonCommand(props, value) {
  const template = textProp(props, "commandTemplate", PLACEHOLDER);
  const effective = blank(template) ? PLACEHOLDER : template;
  const shape = fillJson(effective, "null");
  if (shape === null || !isJson(shape)) {
    throw new CommandError("jsonTemplate", `JSON 模板无效: ${template}`, [template]);
  }
  const text = String(value);
  const valueJson = isJson(text) ? fillJson(text, null) : jsonString(text);
  const newline = NEWLINES[textProp(props, "commandJsonNewline", "无")] ?? "";
  return fillJson(effective, valueJson) + newline;
}

// -- Modbus ---------------------------------------------------------------------------------

export const MODBUS_FUNCTIONS = {
  "01 读线圈": 0x01, "02 读离散输入": 0x02, "03 读保持寄存器": 0x03, "04 读输入寄存器": 0x04,
  "05 写单线圈": 0x05, "06 写单寄存器": 0x06, "16 写多个寄存器": 0x10,
};
export const MODBUS_DATA_TYPES = ["uint16", "int16", "uint32", "int32", "float32"];
export const MODBUS_ORDERS = ["大端(AB CD)", "小端(CD AB)"];

/** A value as the 16-bit registers that hold it: one for 16-bit types, two for 32-bit ones. */
export function modbusRegisters(value, dataType = "uint16", regOrder = MODBUS_ORDERS[0]) {
  if (!MODBUS_DATA_TYPES.includes(dataType)) {
    throw new CommandError("modbusType", `未知的 Modbus 数据类型: ${dataType}`, [dataType]);
  }
  const fail = () => new CommandError("modbusValue", `Modbus 值无效或超出 ${dataType} 的范围`, [dataType]);
  const bytes = new Uint8Array(dataType.endsWith("16") ? 2 : 4);
  const view = new DataView(bytes.buffer);
  if (dataType === "float32") {
    const number = typeof value === "number" ? value : parsePyFloat(value);
    if (number === null || !Number.isFinite(number) || !Number.isFinite(Math.fround(number))) throw fail();
    view.setFloat32(0, number);
  } else {
    const number = typeof value === "number" ? (Number.isFinite(value) ? Math.trunc(value) : null) : parsePyInt(value);
    const [, low, high] = PACK_TYPES[dataType];
    if (number === null || number < low || number > high) throw fail();
    if (bytes.length === 2) view.setUint16(0, number < 0 ? number + 0x10000 : number);
    else view.setUint32(0, number < 0 ? number + 0x100000000 : number);
  }
  const registers = [];
  for (let i = 0; i < bytes.length; i += 2) registers.push(view.getUint16(i));
  if (regOrder !== MODBUS_ORDERS[0]) registers.reverse();
  return registers;
}

/** A validated request { slave, func, address, value, registers }. */
export function modbusRequest(slave, func, address, value, dataType = "uint16", regOrder = MODBUS_ORDERS[0]) {
  const ints = [slave, func, address].map(toInteger);
  if (ints.includes(null)) throw new CommandError("modbusInts", "Modbus 地址和值必须是整数");
  [slave, func, address] = ints;
  if (func !== 0x06 && func !== 0x10) {
    value = toInteger(value);
    if (value === null) throw new CommandError("modbusInts", "Modbus 地址和值必须是整数");
  }
  if (slave < 1 || slave > 247 || address < 0 || address > 65535) {
    throw new CommandError("modbusAddress", "Modbus 从站地址或寄存器地址超出范围");
  }
  if (func === 0x06 || func === 0x10) {
    if (func === 0x06 && dataType !== "uint16" && dataType !== "int16") {
      throw new CommandError("modbus32", "32 位数据占两个寄存器，请用 16 写多个寄存器");
    }
    const registers = modbusRegisters(value, dataType, regOrder);
    if (address + registers.length > 65536) throw new CommandError("modbusAddress", "Modbus 从站地址或寄存器地址超出范围");
    return func === 0x06
      ? { slave, func, address, value: registers[0], registers: [] }
      : { slave, func, address, value: registers.length, registers };
  }
  let valid = false;
  if (func === 1 || func === 2) valid = value >= 1 && value <= 2000;
  else if (func === 3 || func === 4) valid = value >= 1 && value <= 125;
  else if (func === 5) valid = value === 0 || value === 0xff00;
  if (!valid) throw new CommandError("modbusRange", "Modbus 值或读取数量超出功能码允许范围");
  return { slave, func, address, value, registers: [] };
}

/** A request framed the way a link parses: MBAP for modbus_tcp (given its transaction), ASCII for modbus_ascii, else RTU. */
export function modbusFrame(request, parserType, transaction = 0) {
  const { slave, func, address, value, registers } = request;
  if (parserType === "modbus_tcp") return buildModbusTcpFrame(slave, func, address, value, value, transaction, registers);
  if (parserType === "modbus_ascii") return buildModbusAsciiFrame(slave, func, address, value, value, registers);
  return buildModbusFrame(slave, func, address, value, value, registers);
}

function modbusFromProps(props, value) {
  return modbusRequest(
    prop(props, "mbSlave", 1),
    MODBUS_FUNCTIONS[textProp(props, "mbFunc", "06 写单寄存器")] ?? 0x06,
    prop(props, "mbAddress", 0),
    value ?? prop(props, "mbValue", 1),
    textProp(props, "mbDataType", "uint16"),
    textProp(props, "mbRegOrder", MODBUS_ORDERS[0]),
  );
}

// -- one control's command ------------------------------------------------------------------

/**
 * What a control sends for a value, by its commandMode:
 *   { kind: "bytes", bytes, text? }  text for 文本 / JSON (sent as a text frame where a link has them)
 *   { kind: "modbus", request }      framed per link by modbusFrame
 *   { kind: "can" }                  CAN, which a browser cannot send
 * Throws CommandError when the command is invalid.
 */
export function applyTemplate(props, value) {
  const mode = textProp(props, "commandMode", "文本");
  const template = textProp(props, "commandTemplate", PLACEHOLDER);
  if (mode === "Modbus") return { kind: "modbus", request: modbusFromProps(props, value) };
  if (mode === "CAN") return { kind: "can" };
  if (mode === "JSON") {
    const text = jsonCommand(props, value);
    return { kind: "bytes", bytes: new TextEncoder().encode(text), text };
  }
  if (mode === "HEX") {
    const dataType = textProp(props, "dataType", "HEX字符串");
    const header = textProp(props, "frameHeader", "");
    const tail = textProp(props, "frameTail", "");
    if (Object.hasOwn(PACK_TYPES, dataType)) {
      const bigEndian = textProp(props, "byteOrder", "大端(BE)") === "大端(BE)";
      const payload = packValue(value, dataType, bigEndian);
      return { kind: "bytes", bytes: commandHexFrame(template.replaceAll(PLACEHOLDER, hexOf(payload)), header, tail) };
    }
    const command = template.includes(PLACEHOLDER) ? template.replaceAll(PLACEHOLDER, value) : template;
    return { kind: "bytes", bytes: commandHexFrame(command, header, tail) };
  }
  const command = template.includes(PLACEHOLDER) ? template.replaceAll(PLACEHOLDER, value) : template;
  const text = command + (NEWLINES[textProp(props, "commandNewline", "\\r\\n")] ?? "\r\n");
  return { kind: "bytes", bytes: new TextEncoder().encode(text), text };
}

const strip = (value) => String(value ?? "").trim();

/**
 * The command a user action on a control produces, or null when it sends nothing:
 *   PushButton {} · ToggleSwitch { checked } · Slider / SpinBox { value } · LineEdit { text } (Enter)
 *   ComboBox { index, text } (the selected item's text)
 */
export function commandForEvent(type, props, event = {}) {
  const mode = textProp(props, "commandMode", "文本");
  const modbus = mode === "Modbus";
  switch (type) {
    case "PushButton": {
      if (modbus) {
        const settings = { mbFunc: "03 读保持寄存器", ...props };
        if (MODBUS_FUNCTIONS[settings.mbFunc] === 0x05) {
          const value = prop(settings, "mbValue", 1);
          if ((typeof value === "string" ? parsePyInt(value) : value) === 1) settings.mbValue = 0xff00;
        }
        return { kind: "modbus", request: modbusFromProps(settings, null) };
      }
      const command = strip(prop(props, "command", ""));
      return command ? applyTemplate(props, command) : null;
    }
    case "ToggleSwitch": {
      if (modbus) {
        return { kind: "modbus", request: modbusFromProps({ ...props, mbFunc: "05 写单线圈" }, event.checked ? 0xff00 : 0) };
      }
      const command = strip(prop(props, event.checked ? "onCommand" : "offCommand", ""));
      return command ? applyTemplate(props, command) : null;
    }
    case "LineEdit": {
      if (!prop(props, "sendOnEnter", false) && !modbus) return null;
      const text = strip(event.text);
      return text || modbus ? applyTemplate(props, text) : null;
    }
    case "ComboBox": {
      if (!prop(props, "sendOnSelect", false) && !modbus) return null;
      const index = Number(event.index);
      if (!(index >= 0)) return null;
      const lines = textProp(props, "commands", "").split("\n").map((line) => line.trim());
      const items = textProp(props, "items", "选项1\n选项2\n选项3").split("\n");
      const raw = index < lines.length && lines[index] ? lines[index] : (event.text ?? items[index] ?? "");
      return raw ? applyTemplate(props, raw) : null;
    }
    case "Slider":
    case "SpinBox":
      if (!prop(props, "sendOnChange", false) && !modbus) return null;
      return applyTemplate(props, String(event.value));
    default:
      return null;
  }
}
