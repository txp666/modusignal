// The property panel of the canvas editor: the project (name, canvas, frame format) when nothing is
// selected, else the selected widget's id, geometry, properties, data binding and command. Every edit
// goes through ctx.change(mutate, options), which records undo and redraws.

import i18n from "../../i18n.js";
import { BIND_PROPERTIES, CURVE_FIELDS, MAX_CURVES, curveCount, defaultCurveName } from "../../hmi/binding.js";
import {
  HEX_CHECKSUMS, HEX_ENDIANS, HEX_FIELD_TYPES, HEX_LENGTH_COVERS, LINE_ENCODINGS, MODBUS_PARSERS, PARSER_TYPES, createParser,
} from "../../hmi/parsers.js";
import {
  BINDING_DEFAULTS, COMMAND_TYPES, PROJECT_PARSER, bindingValue, cardParserConfig, geometryOf,
  isSupported, propDef, propValue, setBindingField, setProp, widgetMeta,
} from "../../hmi/uidp.js";
import { LABEL_OVERRIDES } from "../../hmi/widget-registry.js";
import { FREE_LAYOUT, clampTabIndex, currentTab, tabNames } from "../../hmi/layout.js";
import { parserErrorText } from "./canvas-messages.js";

const COMMAND_PROPS = new Set([
  "commandMode", "command", "commandTemplate", "commandJsonNewline", "frameHeader", "frameTail", "dataType",
  "byteOrder", "commandNewline", "mbSlave", "mbFunc", "mbAddress", "mbDataType", "mbRegOrder", "mbValue",
  "canId", "canFd", "canCycle", "onCommand", "offCommand", "sendOnChange", "sendOnEnter", "sendOnSelect", "commands",
]);
const CURVE_EDITOR_PROPS = /^curve(?!Count$)|^currentCurve$/;
const RAW_DATA_TYPES = ["uint8", "int8", "uint16", "int16", "uint32", "int32", "float32", "ASCII"];
const MB_DATA_TYPES = ["uint16", "int16", "uint32", "int32", "float32"];
const MB_ORDERS = ["大端(AB CD)", "小端(CD AB)"];
const MB_AREAS = ["保持寄存器", "输入寄存器", "线圈", "离散输入"];
const PARSE_MODES = ["键值匹配", "JSON路径", "HEX字节提取", "Modbus"];
const PARSE_MODE_FIELDS = {
  键值匹配: ["key"],
  JSON路径: ["jsonPath"],
  HEX字节提取: ["byteOffset", "dataType", "byteOrder", "frameHeader", "frameTail"],
  Modbus: ["mbArea", "mbRegIndex", "mbDataType", "mbRegOrder", "mbFcFilter", "mbSlaveFilter", "mbPeriod"],
};

export const widgetName = (type) => i18n(`hmi.widget.${type}`, widgetMeta(type)?.name ?? type);
export const optionLabel = (value) => i18n(`hmi.opt.${value}`, String(value));

function propLabel(type, name, fallback) {
  if (LABEL_OVERRIDES.has(`${type}.${name}`)) return i18n(`hmi.prop.${type}.${name}`, fallback);
  return i18n(`hmi.prop.${name}`, fallback);
}

// -- small form builders ------------------------------------------------------------------

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function field(labelText, control, hint) {
  const wrap = el("label", "hmi-field");
  wrap.append(el("span", "hmi-field-label", labelText), control);
  if (hint) wrap.title = hint;
  return wrap;
}

function textInput(value, onInput, { multiline = false, placeholder = "" } = {}) {
  const input = el(multiline ? "textarea" : "input");
  if (!multiline) input.type = "text";
  else input.rows = 3;
  input.value = value ?? "";
  input.placeholder = placeholder;
  input.spellcheck = false;
  input.addEventListener("input", () => {
    if (multiline) fitTextarea(input);
    onInput(input.value);
  });
  return input;
}

const TEXTAREA_MIN_LINES = 3;
const TEXTAREA_MAX_LINES = 10;

/** A multi-line field as tall as its text: 3 lines at least, 10 at most (then it scrolls). */
export function fitTextarea(input) {
  if (!input.isConnected || !input.getClientRects().length) return;
  const style = getComputedStyle(input);
  const line = Number.parseFloat(style.lineHeight) || 20;
  const frame = Number.parseFloat(style.paddingTop) + Number.parseFloat(style.paddingBottom);
  const border = Number.parseFloat(style.borderTopWidth) + Number.parseFloat(style.borderBottomWidth);
  input.style.height = "0px";
  const content = input.scrollHeight - frame;
  const height = Math.min(TEXTAREA_MAX_LINES * line, Math.max(TEXTAREA_MIN_LINES * line, content));
  input.style.height = `${Math.ceil(height + frame + border)}px`;
  input.style.overflowY = content > TEXTAREA_MAX_LINES * line + 1 ? "auto" : "hidden";
}

function numberInput(value, onCommit, { min, max, integer = true } = {}) {
  const input = el("input");
  input.type = "number";
  if (min !== undefined) input.min = String(min);
  if (max !== undefined) input.max = String(max);
  input.step = integer ? "1" : "any";
  input.value = String(value ?? 0);
  input.addEventListener("change", () => {
    let number = Number(input.value);
    if (!Number.isFinite(number) || input.value.trim() === "") number = Number(value ?? 0);
    if (integer) number = Math.trunc(number);
    if (min !== undefined) number = Math.max(min, number);
    if (max !== undefined) number = Math.min(max, number);
    input.value = String(number);
    onCommit(number);
  });
  return input;
}

function checkbox(value, onChange) {
  const input = el("input");
  input.type = "checkbox";
  input.checked = Boolean(value);
  input.addEventListener("change", () => onChange(input.checked));
  return input;
}

function select(options, value, onChange, label = optionLabel) {
  const control = el("select");
  const values = options.includes(value) || value === undefined ? options : [value, ...options];
  for (const option of values) {
    const node = el("option", "", label(option));
    node.value = String(option);
    control.append(node);
  }
  control.value = String(value);
  control.addEventListener("change", () => {
    const picked = values.find((option) => String(option) === control.value);
    onChange(picked);
  });
  return control;
}

function section(title) {
  const node = el("section", "hmi-panel-section");
  node.append(el("h3", "", title));
  return node;
}

// Escapes for typing control characters into a one-line field: \r \n \t \\.
const escapeText = (text) => String(text).replace(/\\/g, "\\\\").replace(/\r/g, "\\r").replace(/\n/g, "\\n").replace(/\t/g, "\\t");
const unescapeText = (text) => String(text).replace(/\\(\\|r|n|t)/g, (_, c) => ({ "\\": "\\", r: "\r", n: "\n", t: "\t" })[c]);

// -- the parser configuration form ---------------------------------------------------------

/** The structured form of a parserConfig for `mode`; `set(config)` replaces it. */
function parserConfigForm(container, mode, config, set) {
  const cfg = config && typeof config === "object" && !Array.isArray(config) ? config : {};
  const update = (key, value, coalesce) => set({ ...cfg, [key]: value }, coalesce);
  const get = (key, fallback) => (cfg[key] === undefined ? fallback : cfg[key]);
  if (mode === "line") {
    container.append(
      field(i18n("hmi.parser.separator"), textInput(escapeText(get("separator", ",")), (v) => update("separator", unescapeText(v), "separator"))),
      field(i18n("hmi.parser.terminator"), textInput(escapeText(get("terminator", "\n")), (v) => update("terminator", unescapeText(v), "terminator")), i18n("hmi.parser.escapeHint")),
      field(i18n("hmi.parser.kvSeparator"), select(["=", ":"], get("kvSeparator", "="), (v) => update("kvSeparator", v))),
      field(i18n("hmi.parser.encoding"), select(LINE_ENCODINGS, String(get("encoding", "utf-8")).toLowerCase(), (v) => update("encoding", v))),
    );
  } else if (mode === "hex") {
    const fixed = get("fixedLength", 0);
    container.append(
      field(i18n("hmi.parser.header"), textInput(get("header", "AA55"), (v) => update("header", v, "header"))),
      field(i18n("hmi.parser.footer"), textInput(get("footer", "55AA"), (v) => update("footer", v, "footer"))),
      field(i18n("hmi.parser.lengthOffset"), numberInput(get("lengthOffset", -1), (v) => update("lengthOffset", v), { min: -1, max: 65535 }), i18n("hmi.parser.lengthOffsetHint")),
      field(i18n("hmi.parser.lengthSize"), select([1, 2], get("lengthSize", 1), (v) => update("lengthSize", v), String)),
      field(i18n("hmi.parser.lengthEndian"), select(HEX_ENDIANS, get("lengthEndian", HEX_ENDIANS[0]), (v) => update("lengthEndian", v))),
      field(i18n("hmi.parser.lengthCovers"), select(HEX_LENGTH_COVERS, get("lengthCovers", HEX_LENGTH_COVERS[0]), (v) => update("lengthCovers", v))),
      field(i18n("hmi.parser.fixedLength"), numberInput(fixed, (v) => update("fixedLength", v), { min: 0, max: 65536 }), i18n("hmi.parser.zeroNone")),
      field(i18n("hmi.parser.checksum"), select(Object.keys(HEX_CHECKSUMS), get("checksum", "无"), (v) => update("checksum", v))),
      field(i18n("hmi.parser.checksumStart"), numberInput(get("checksumStart", 0), (v) => update("checksumStart", v), { min: 0, max: 65535 })),
      field(i18n("hmi.parser.checksumEndian"), select(HEX_ENDIANS, get("checksumEndian", HEX_ENDIANS[0]), (v) => update("checksumEndian", v))),
      field(i18n("hmi.parser.idleTimeout"), numberInput(get("idleTimeout", 0), (v) => update("idleTimeout", v), { min: 0, max: 60000 }), i18n("hmi.parser.zeroNone")),
    );
    const fields = Array.isArray(cfg.fields) ? cfg.fields : [];
    const table = el("div", "hmi-fields-table");
    table.append(el("div", "hmi-fields-title", i18n("hmi.parser.fields")));
    const setFields = (next, coalesce) => update("fields", next, coalesce);
    fields.forEach((item, index) => {
      const row = el("div", "hmi-fields-row");
      const entry = Array.isArray(item) ? item : ["", 0, 1, "uint8"];
      const change = (position, value, coalesce) => {
        const next = fields.map((existing) => (Array.isArray(existing) ? [...existing] : existing));
        const copy = [...entry];
        copy[position] = value;
        if (position === 3 && HEX_FIELD_TYPES[value]) copy[2] = HEX_FIELD_TYPES[value];
        next[index] = copy;
        setFields(next, coalesce);
      };
      const name = textInput(entry[0], (v) => change(0, v, `field${index}`));
      name.setAttribute("aria-label", i18n("hmi.parser.fieldName"));
      const offset = numberInput(entry[1], (v) => change(1, v), { min: 0, max: 65535 });
      offset.setAttribute("aria-label", i18n("hmi.parser.fieldOffset"));
      const length = numberInput(entry[2], (v) => change(2, v), { min: 1, max: 65536 });
      length.setAttribute("aria-label", i18n("hmi.parser.fieldLength"));
      const type = select(Object.keys(HEX_FIELD_TYPES), entry[3], (v) => change(3, v), String);
      type.setAttribute("aria-label", i18n("hmi.parser.fieldType"));
      const endian = select(HEX_ENDIANS, entry[4] ?? HEX_ENDIANS[0], (v) => change(4, v));
      endian.setAttribute("aria-label", i18n("hmi.parser.fieldEndian"));
      const remove = el("button", "icon-button", "×");
      remove.type = "button";
      remove.setAttribute("aria-label", i18n("hmi.parser.removeField"));
      remove.addEventListener("click", () => setFields(fields.filter((_, i) => i !== index)));
      row.append(name, offset, length, type, endian, remove);
      table.append(row);
    });
    const add = el("button", "ghost-button", i18n("hmi.parser.addField"));
    add.type = "button";
    add.addEventListener("click", () => setFields([...fields, [`f${fields.length}`, 0, 2, "uint16"]]));
    table.append(add);
    container.append(table);
  } else {
    container.append(el("p", "hmi-panel-note", i18n("hmi.parser.noSettings")));
  }
  try {
    createParser(mode, cfg);
  } catch (error) {
    container.append(el("p", "hmi-panel-error", parserErrorText(error)));
  }
}

// -- the project ---------------------------------------------------------------------------

function renderProject(root, ctx) {
  const { project } = ctx;
  const general = section(i18n("hmi.panel.project"));
  general.append(field(i18n("hmi.project.appName"), textInput(project.appName ?? "上位机", (v) => ctx.change((p) => { p.appName = v; }, { coalesce: "appName" }))));
  const canvas = project.canvas && typeof project.canvas === "object" ? project.canvas : {};
  const grid = el("div", "hmi-field-grid");
  for (const [key, fallback, max] of [["width", 1200, 9999], ["height", 800, 9999], ["gridSize", 10, 1000]]) {
    grid.append(field(i18n(`hmi.project.${key}`), numberInput(canvas[key] ?? fallback, (v) => ctx.change((p) => {
      p.canvas = { ...(p.canvas ?? {}), [key]: v };
    }), { min: 1, max })));
  }
  general.append(grid);
  root.append(general);

  const protocol = section(i18n("hmi.panel.protocol"));
  protocol.append(el("p", "hmi-panel-note", i18n("hmi.project.protocolNote")));
  const serial = project.serial && typeof project.serial === "object" ? project.serial : {};
  const parser = typeof serial.parser === "string" ? serial.parser : "line";
  protocol.append(field(i18n("hmi.project.parser"), select(PARSER_TYPES, parser, (v) => ctx.change((p) => {
    p.serial = { ...(p.serial ?? {}), parser: v, parserConfig: v === "line" ? { separator: "," } : v === "hex" ? { header: "AA55", footer: "55AA" } : {} };
  }, { panel: true }), String)));
  parserConfigForm(protocol, parser, serial.parserConfig, (config, coalesce) => ctx.change((p) => {
    p.serial = { ...(p.serial ?? {}), parserConfig: config };
  }, { coalesce: coalesce ? `serial.${coalesce}` : undefined, panel: !coalesce }));
  root.append(protocol);
}

// -- a widget ------------------------------------------------------------------------------

/** TabWidget fields: tabLayout edits the current page's _tabLayout_{n}; tabNames keeps pages and children consistent. */
function tabControl(widget, def, ctx) {
  const label = propLabel(widget.type, def.name, def.label);
  if (def.name === "tabLayout") {
    const key = `_tabLayout_${currentTab(widget)}`;
    return field(label, select(def.options, widget.properties?.[key] ?? FREE_LAYOUT, (v) => ctx.change(() => {
      widget.properties ??= {};
      widget.properties[key] = v;
    }, { panel: true })));
  }
  if (def.name === "currentTab") {
    return field(label, numberInput(currentTab(widget), (v) => ctx.change(() => setProp(widget, "currentTab", clampTabIndex(v, tabNames(widget).length)), { panel: true }), { min: 0, max: tabNames(widget).length - 1 }));
  }
  return field(label, textInput(propValue(widget, "tabNames"), (v) => ctx.change(() => {
    setProp(widget, "tabNames", v);
    const count = tabNames(widget).length;
    const props = widget.properties;
    if (props.currentTab !== undefined && props.currentTab !== clampTabIndex(props.currentTab, count)) props.currentTab = clampTabIndex(props.currentTab, count);
    for (const child of Array.isArray(widget.children) ? widget.children : []) {
      if (child?.tabIndex !== undefined && child.tabIndex !== clampTabIndex(child.tabIndex, count)) child.tabIndex = clampTabIndex(child.tabIndex, count);
    }
    for (const key of Object.keys(props)) {
      const page = /^_tabLayout_(\d+)$/.exec(key);
      if (page && Number(page[1]) >= count) delete props[key];
    }
  }, { coalesce: "tabNames" }), { multiline: true }));
}

function propControl(widget, def, ctx) {
  if (widget.type === "TabWidget" && ["tabLayout", "currentTab", "tabNames"].includes(def.name)) return tabControl(widget, def, ctx);
  const value = propValue(widget, def.name);
  const label = propLabel(widget.type, def.name, def.label);
  const set = (next, options = {}) => ctx.change(() => setProp(widget, def.name, next), options);
  const hint = i18n(`hmi.hint.${def.name}`, "") || undefined;
  switch (def.kind) {
    case "bool":
      return field(label, checkbox(value === true || value === "true", (v) => set(v, { panel: true })), hint);
    case "option":
      return field(label, select(def.options, value, (v) => set(v, { panel: true })), hint);
    case "int":
    case "float":
      return field(label, numberInput(value, (v) => set(v), { min: def.min, max: def.max, integer: def.kind === "int" }), hint);
    case "multiline":
      return field(label, textInput(value, (v) => set(v, { coalesce: def.name }), { multiline: true }), hint);
    case "object":
      return null;
    default:
      return field(label, textInput(value, (v) => set(v, { coalesce: def.name })), hint);
  }
}

// -- which rows show, as PyQt UI Designer's property_editor.py and Studio's updateVisibility have it.
// A hidden row's value stays in the file.

/** The command rows each send mode shows (_MODE_VISIBILITY; CAN as Studio has it). */
const MODE_VISIBILITY = {
  文本: ["command", "onCommand", "offCommand", "commandNewline", "commandTemplate"],
  HEX: ["command", "onCommand", "offCommand", "commandTemplate", "frameHeader", "frameTail", "dataType", "byteOrder"],
  JSON: ["command", "onCommand", "offCommand", "commandTemplate", "commandJsonNewline"],
  Modbus: ["mbSlave", "mbFunc", "mbAddress", "mbValue", "mbDataType", "mbRegOrder"],
  CAN: ["command", "onCommand", "offCommand", "commandTemplate", "dataType", "byteOrder", "canId", "canFd", "canCycle"],
};
const MODE_FIELDS = new Set(Object.values(MODE_VISIBILITY).flat());
/** The toggle a control sends with; while it is off (and the mode is not Modbus) the command rows hide. */
const SEND_TOGGLES = { LineEdit: "sendOnEnter", ComboBox: "sendOnSelect", Slider: "sendOnChange", SpinBox: "sendOnChange" };
/** A link card's Modbus rows: shown while its own parser is a Modbus one, then by its role. */
const MODBUS_LINK_FIELDS = new Set(["modbusRole", "modbusSlave"]);
const MODBUS_MASTER_FIELDS = new Set(["modbusPeriod", "modbusTimeout"]);
const MODBUS_SLAVE_FIELDS = new Set(["modbusDelay", "modbusExceptions", "slaveCoStart", "slaveCoCount", "slaveDiStart",
  "slaveDiCount", "slaveHrStart", "slaveHrCount", "slaveIrStart", "slaveIrCount", "slaveInit"]);
/** A button's or switch's notification rows, shown while it notifies. */
const NOTIFY_FIELDS = new Set(["notifyTitle", "notifyContent", "notifyType", "notifyDuration"]);

/** Whether a property's row shows for the widget's current settings. */
export function propertyRowVisible(widget, name) {
  const has = (prop) => Boolean(propDef(widget.type, prop));
  if (has("parserConfig") || has("modbusRole")) {
    const modbus = MODBUS_PARSERS.includes(String(propValue(widget, "defaultParser")));
    const slave = String(propValue(widget, "modbusRole")) === "从站";
    if (MODBUS_LINK_FIELDS.has(name)) return modbus;
    if (MODBUS_MASTER_FIELDS.has(name)) return modbus && !slave;
    if (MODBUS_SLAVE_FIELDS.has(name)) return modbus && slave;
  }
  if (has("commandMode") && (MODE_FIELDS.has(name) || name === "commandMode" || name === "commands")) {
    const mode = String(propValue(widget, "commandMode"));
    const toggle = SEND_TOGGLES[widget.type];
    if (toggle && has(toggle) && propValue(widget, toggle) !== true && propValue(widget, toggle) !== "true" && mode !== "Modbus") return false;
    if (name === "commandMode" || name === "commands") return true;
    return (MODE_VISIBILITY[mode] ?? []).includes(name);
  }
  if (has("notify") && NOTIFY_FIELDS.has(name)) {
    const notify = propValue(widget, "notify");
    return notify === true || notify === "true";
  }
  return true;
}

function renderCommand(root, widget, ctx) {
  const command = section(i18n("hmi.panel.command"));
  for (const def of widgetMeta(widget.type).props) {
    if (!COMMAND_PROPS.has(def.name) || !propertyRowVisible(widget, def.name)) continue;
    if (def.name === "commandMode") {
      const value = propValue(widget, "commandMode");
      command.append(field(propLabel(widget.type, def.name, def.label), select(def.options, value, (v) => ctx.change(() => {
        const changed = setProp(widget, "commandMode", v);
        // A HEX command reads dataType from the file: write the default the panel shows.
        const typeDef = propDef(widget.type, "dataType");
        if (v === "HEX" && typeDef && widget.properties.dataType === undefined && typeDef.default !== "HEX字符串") {
          widget.properties.dataType = typeDef.default;
        }
        return changed;
      }, { panel: true }))));
      continue;
    }
    const control = propControl(widget, def, ctx);
    if (control) command.append(control);
  }
  if (String(propValue(widget, "commandMode")) === "CAN") command.append(el("p", "hmi-panel-note", i18n("hmi.command.canNote")));
  root.append(command);
}

function bindingFieldControl(widget, name, ctx, label) {
  const value = bindingValue(widget, name);
  const set = (next, options = {}) => ctx.change(() => setBindingField(widget, name, next), options);
  switch (name) {
    case "key": return field(label, textInput(value, (v) => set(v.trim(), { coalesce: "binding.key" }), { placeholder: "temperature" }));
    case "jsonPath": return field(label, textInput(value, (v) => set(v.trim(), { coalesce: "binding.jsonPath" }), { placeholder: "data.sensors.0.temp" }));
    case "byteOffset": return field(label, numberInput(value, (v) => set(v), { min: 0, max: 9999 }));
    case "dataType": return field(label, select(RAW_DATA_TYPES, value, (v) => set(v, { panel: true }), String));
    case "byteOrder": return field(label, select(HEX_ENDIANS, value, (v) => set(v)));
    case "frameHeader": return field(label, textInput(value, (v) => set(v.trim(), { coalesce: "binding.frameHeader" }), { placeholder: "AA 55" }));
    case "frameTail": return field(label, textInput(value, (v) => set(v.trim(), { coalesce: "binding.frameTail" }), { placeholder: "0D 0A" }));
    case "mbArea": return field(label, select(MB_AREAS, value, (v) => set(v)));
    case "mbRegIndex": return field(label, numberInput(value, (v) => set(v), { min: 0, max: 65535 }));
    case "mbDataType": return field(label, select(MB_DATA_TYPES, value, (v) => set(v), String));
    case "mbRegOrder": return field(label, select(MB_ORDERS, value, (v) => set(v)));
    case "mbFcFilter": return field(label, numberInput(value, (v) => set(v), { min: -1, max: 255 }), i18n("hmi.binding.filterHint"));
    case "mbSlaveFilter": return field(label, numberInput(value, (v) => set(v), { min: -1, max: 247 }), i18n("hmi.binding.filterHint"));
    case "mbPeriod": return field(label, numberInput(value, (v) => set(v), { min: 0, max: 60000 }), i18n("hmi.binding.periodHint"));
    default: return null;
  }
}

function renderBinding(root, widget, ctx) {
  const binding = section(i18n("hmi.panel.binding"));
  const mode = bindingValue(widget, "parseMode");
  binding.append(field(i18n("hmi.binding.parseMode"), select(PARSE_MODES, mode, (v) => ctx.change(() => setBindingField(widget, "parseMode", v), { panel: true }))));
  for (const name of PARSE_MODE_FIELDS[mode] ?? []) {
    const control = bindingFieldControl(widget, name, ctx, i18n(`hmi.binding.${name}`));
    if (control) binding.append(control);
  }
  binding.append(field(i18n("hmi.binding.expression"), textInput(bindingValue(widget, "expression"), (v) => ctx.change(() => setBindingField(widget, "expression", v.trim()), { coalesce: "binding.expression" }), { placeholder: "value * 0.1" }), i18n("hmi.binding.expressionHint")));
  if (widget.binding && typeof widget.binding === "object" && Object.keys(widget.binding).length) {
    const clear = el("button", "ghost-button", i18n("hmi.binding.clear"));
    clear.type = "button";
    clear.addEventListener("click", () => ctx.change(() => {
      delete widget.binding;
      return true;
    }, { panel: true }));
    binding.append(clear);
  }
  root.append(binding);
}

function renderCurves(root, widget, ctx) {
  const curves = section(i18n("hmi.panel.curves"));
  const count = curveCount(widget.properties ?? {});
  curves.append(field(propLabel(widget.type, "curveCount", "曲线数量"), numberInput(count, (v) => ctx.change(() => setProp(widget, "curveCount", v), { panel: true }), { min: 1, max: MAX_CURVES })));
  for (let i = 0; i < count; i += 1) {
    const box = el("fieldset", "hmi-curve");
    const prefix = `_curve_${i}_`;
    const get = (name) => widget.properties?.[`${prefix}${name}`] ?? (name === "name" ? defaultCurveName(i) : CURVE_FIELDS[name]);
    const set = (name, value, options = {}) => ctx.change(() => {
      widget.properties ??= {};
      if (JSON.stringify(widget.properties[`${prefix}${name}`]) === JSON.stringify(value)) return false;
      widget.properties[`${prefix}${name}`] = value;
      return true;
    }, options);
    box.append(el("legend", "", `${i18n("hmi.curve.title")} ${i + 1}`));
    box.append(field(i18n("hmi.curve.name"), textInput(get("name"), (v) => set("name", v, { coalesce: `${prefix}name` }))));
    const mode = get("parseMode");
    box.append(field(i18n("hmi.binding.parseMode"), select(PARSE_MODES, mode, (v) => set("parseMode", v, { panel: true }))));
    if (mode === "键值匹配") {
      box.append(field(i18n("hmi.binding.key"), textInput(get("key"), (v) => set("key", v.trim(), { coalesce: `${prefix}key` }), { placeholder: i18n("hmi.curve.keyPlaceholder") })));
    } else if (mode === "JSON路径") {
      box.append(field(i18n("hmi.binding.jsonPath"), textInput(get("jsonPath"), (v) => set("jsonPath", v.trim(), { coalesce: `${prefix}jsonPath` }))));
    } else if (mode === "HEX字节提取") {
      box.append(
        field(i18n("hmi.binding.byteOffset"), numberInput(get("byteOffset"), (v) => set("byteOffset", v), { min: 0, max: 9999 })),
        field(i18n("hmi.binding.dataType"), select(RAW_DATA_TYPES.slice(0, 7), get("dataType"), (v) => set("dataType", v), String)),
        field(i18n("hmi.binding.byteOrder"), select(HEX_ENDIANS, get("byteOrder"), (v) => set("byteOrder", v))),
        field(i18n("hmi.binding.frameHeader"), textInput(get("frameHeader"), (v) => set("frameHeader", v.trim(), { coalesce: `${prefix}frameHeader` }))),
        field(i18n("hmi.binding.frameTail"), textInput(get("frameTail"), (v) => set("frameTail", v.trim(), { coalesce: `${prefix}frameTail` }))),
      );
    } else if (mode === "Modbus") {
      box.append(
        field(i18n("hmi.binding.mbArea"), select(MB_AREAS, get("mbArea"), (v) => set("mbArea", v))),
        field(i18n("hmi.binding.mbRegIndex"), numberInput(get("regIndex"), (v) => set("regIndex", v), { min: 0, max: 65535 })),
        field(i18n("hmi.binding.mbDataType"), select(MB_DATA_TYPES, get("mbDataType"), (v) => set("mbDataType", v), String)),
        field(i18n("hmi.binding.mbRegOrder"), select(MB_ORDERS, get("mbRegOrder"), (v) => set("mbRegOrder", v))),
        field(i18n("hmi.binding.mbFcFilter"), numberInput(get("mbFcFilter"), (v) => set("mbFcFilter", v), { min: -1, max: 255 })),
        field(i18n("hmi.binding.mbSlaveFilter"), numberInput(get("mbSlaveFilter"), (v) => set("mbSlaveFilter", v), { min: -1, max: 247 })),
      );
    }
    curves.append(box);
  }
  root.append(curves);
}

function renderCardParser(root, widget, ctx) {
  const mode = String(propValue(widget, "defaultParser"));
  if (mode === PROJECT_PARSER) return;
  const box = section(i18n("hmi.panel.cardParser"));
  // A Modbus mode has nothing to set: the section shows its title alone.
  if (MODBUS_PARSERS.includes(mode)) {
    root.append(box);
    return;
  }
  const projectParser = ctx.project.serial?.parser ?? "line";
  const own = widget.properties?.parserConfig;
  const effective = cardParserConfig(mode, own, projectParser, ctx.project.serial?.parserConfig ?? {});
  if (!own || !Object.keys(own).length) box.append(el("p", "hmi-panel-note", i18n(mode === projectParser ? "hmi.card.configFromProject" : "hmi.card.configDefault")));
  parserConfigForm(box, mode, effective, (config, coalesce) => ctx.change(() => {
    widget.properties ??= {};
    widget.properties.parserConfig = config;
    return true;
  }, { coalesce: coalesce ? `card.${coalesce}` : undefined, panel: !coalesce }));
  root.append(box);
}

function renderWidget(root, widget, ctx) {
  const head = section(`${widgetName(widget.type)} · ${widget.type}`);
  const idInput = textInput(widget.id ?? "", () => {});
  idInput.addEventListener("change", () => {
    const next = idInput.value.trim();
    const error = ctx.renameWidget(widget, next);
    idInput.setCustomValidity(error ?? "");
    if (error) {
      idInput.reportValidity();
      idInput.value = widget.id ?? "";
    }
  });
  head.append(field("ID", idInput));
  const geometry = geometryOf(widget);
  const grid = el("div", "hmi-field-grid");
  for (const key of ["x", "y", "w", "h"]) {
    const min = key === "w" || key === "h" ? 1 : -9999;
    grid.append(field(i18n(`hmi.geometry.${key}`), numberInput(geometry[key], (v) => ctx.change(() => {
      widget.geometry = { ...geometryOf(widget), ...(widget.geometry ?? {}), [key]: v };
      return true;
    }), { min, max: 9999 })));
  }
  head.append(grid);
  root.append(head);

  if (!isSupported(widget)) {
    const raw = section(i18n("hmi.panel.placeholder"));
    raw.append(el("p", "hmi-panel-note", i18n("hmi.placeholder.note")));
    const pre = el("pre", "hmi-json", JSON.stringify(widget, null, 2));
    raw.append(pre);
    root.append(raw);
    return;
  }

  const props = section(i18n("hmi.panel.properties"));
  for (const def of widgetMeta(widget.type).props) {
    if (COMMAND_TYPES.has(widget.type) && COMMAND_PROPS.has(def.name)) continue;
    if (widget.type === "RealtimeChart" && (CURVE_EDITOR_PROPS.test(def.name) || def.name === "curveCount")) continue;
    if (!propertyRowVisible(widget, def.name)) continue;
    const control = propControl(widget, def, ctx);
    if (control) props.append(control);
  }
  root.append(props);
  if (["SerialConfigCard", "TcpConfigCard", "MqttConfigCard"].includes(widget.type)) {
    renderCardParser(root, widget, ctx);
    if (propValue(widget, "modbusRole") === "从站") root.append(el("p", "hmi-panel-note", i18n("hmi.card.slaveNote")));
  }
  if (widget.type === "RealtimeChart") renderCurves(root, widget, ctx);
  if (BIND_PROPERTIES[widget.type]) renderBinding(root, widget, ctx);
  if (COMMAND_TYPES.has(widget.type)) renderCommand(root, widget, ctx);
}

/**
 * ctx: project, selected (widgets), change(mutate, { panel, coalesce }),
 * renameWidget(widget, id) → error text or null
 */
export function renderPropertyPanel(root, ctx) {
  root.replaceChildren();
  if (!ctx.selected.length) {
    renderProject(root, ctx);
  } else {
    // The selection's own actions, above its properties.
    const actions = el("div", "hmi-panel-actions");
    for (const [key, run, enabled] of [
      ["hmi.action.delete", ctx.removeSelected, true],
      ["hmi.action.copy", ctx.copySelection, true],
      ["hmi.action.paste", ctx.paste, ctx.canPaste()],
    ]) {
      const button = el("button", key === "hmi.action.delete" ? "ghost-button hmi-danger" : "ghost-button", i18n(key));
      button.type = "button";
      button.disabled = !enabled;
      button.addEventListener("click", () => run());
      actions.append(button);
    }
    root.append(actions);
  }
  if (ctx.selected.length > 1) {
    const multi = section(i18n("hmi.panel.multi").replace("{count}", String(ctx.selected.length)));
    multi.append(el("p", "hmi-panel-note", i18n("hmi.panel.multiHint")));
    root.append(multi);
  } else if (ctx.selected.length === 1) {
    renderWidget(root, ctx.selected[0], ctx);
  }
  root.querySelectorAll("textarea").forEach(fitTextarea);
}

export { BINDING_DEFAULTS };
