// The .uidp project model: validation by FluentHMIRuntime --check's rules, the widget tree,
// property defaults, new ids, the link settings a transport uses, and the built-in example.
// The document is kept as parsed, so everything the page does not know is written back as it
// was. Pure: no DOM.

import industrialCatalog from "./industrial-catalog.js";
import { createParser } from "./parsers.js";
import { WIDGET_TYPES } from "./widget-registry.js";
import { MODBUS_AREAS, PARSE_MODES } from "./binding.js";
import { childTab, currentTab } from "./layout.js";

export const FORMAT_VERSION = "1.0";

/** The widget types the page edits and runs; every other type is a placeholder kept as it is. */
export const SUPPORTED_TYPES = new Set([
  ...industrialCatalog.map((item) => item.type),
  "PushButton", "Label", "LineEdit", "ComboBox", "ToggleSwitch", "Slider", "SpinBox",
  "LEDIndicator", "NumericDisplay", "ProgressBar", "ProgressRingDisplay", "GaugeMeter",
  "RealtimeChart", "DataTable", "GroupBox", "CardContainer", "TabWidget", "HBoxLayout", "VBoxLayout", "FlexLayout", "Separator",
  "SerialConfigCard", "TcpConfigCard", "MqttConfigCard", "DataRecvCard", "DataSendCard", "LogBox",
]);
export const CONTAINER_TYPES = new Set(["GroupBox", "CardContainer", "TabWidget", "HBoxLayout", "VBoxLayout", "FlexLayout"]);
export const LINK_CARD_TYPES = ["SerialConfigCard", "TcpConfigCard", "MqttConfigCard"];
/** The modusignal transport each link card connects with. */
export const TRANSPORT_FOR_CARD = { SerialConfigCard: "serial", TcpConfigCard: "websocket", MqttConfigCard: "mqtt" };
export const PROJECT_PARSER = "项目设置";
export const COMMAND_TYPES = new Set(["PushButton", "ToggleSwitch", "Slider", "SpinBox", "LineEdit", "ComboBox"]);

/** The palette: groups in order, each with the supported types it lists. */
export const PALETTE = [
  { id: "basic", types: ["PushButton", "Label", "LineEdit", "ComboBox", "ToggleSwitch", "Slider", "SpinBox"] },
  { id: "display", types: ["LEDIndicator", "NumericDisplay", "ProgressBar", "ProgressRingDisplay"] },
  { id: "chart", types: ["RealtimeChart", "GaugeMeter", "DataTable"] },
  { id: "container", types: ["GroupBox", "CardContainer", "TabWidget", "HBoxLayout", "VBoxLayout", "FlexLayout", "Separator"] },
  { id: "comm", types: [...LINK_CARD_TYPES, "DataRecvCard", "DataSendCard", "LogBox"] },
  { id: "industrialEquipment", types: industrialCatalog.filter((item) => item.group === "equipment").map((item) => item.type) },
  { id: "industrialInstrument", types: industrialCatalog.filter((item) => item.group === "instrument").map((item) => item.type) },
  ...["automotive", "diy", "embedded"].map((id) => ({ id, types: industrialCatalog.filter((item) => item.group === id).map((item) => item.type) })),
];

export class ProjectError extends Error {
  constructor(code, message, args = []) {
    super(message);
    this.code = code;
    this.args = args;
  }
}

const fail = (code, message, args = []) => {
  throw new ProjectError(code, message, args);
};
const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const isStrictInt = (value) => typeof value === "number" && Number.isFinite(value) && Number.isInteger(value);

export function widgetMeta(type) {
  return WIDGET_TYPES[type] ?? null;
}

export function isSupported(widget) {
  return SUPPORTED_TYPES.has(widget?.type);
}

function validateCardParser(item, projectParser, projectConfig) {
  if (!["SerialConfigCard", "TcpConfigCard", "MqttConfigCard", "UdpConfigCard"].includes(item.type)) return;
  const props = isObject(item.properties) ? item.properties : {};
  if (!Object.hasOwn(props, "parserConfig")) return;
  const id = String(item.id ?? "");
  if (!isObject(props.parserConfig)) fail("cardConfig", `卡片 ${id} 的 parserConfig 必须是对象`, [id]);
  let mode = props.defaultParser ?? PROJECT_PARSER;
  if (mode === PROJECT_PARSER) mode = projectParser;
  try {
    createParser(mode, cardParserConfig(mode, props.parserConfig, projectParser, projectConfig));
  } catch (error) {
    fail("cardParser", `卡片 ${id}: ${error.message}`, [id, error]);
  }
}

function validateModbus(item) {
  const id = String(item.id ?? "");
  const areas = Object.keys(MODBUS_AREAS);
  const badArea = (area) => area !== undefined && area !== null && !areas.includes(area);
  const binding = isObject(item.binding) ? item.binding : {};
  if (binding.parseMode === "Modbus" && badArea(binding.mbArea)) {
    fail("mbArea", `控件 ${id} 的 mbArea 只能是 ${areas.join("、")}`, [id, "mbArea"]);
  }
  const period = binding.mbPeriod;
  if (period !== undefined && period !== null && (!isStrictInt(period) || period < 0 || period > 60000)) {
    fail("mbPeriod", `控件 ${id} 的 mbPeriod 必须是 0–60000 的整数`, [id]);
  }
  if (item.type === "RealtimeChart") {
    const props = isObject(item.properties) ? item.properties : {};
    for (let curve = 0; curve < 8; curve += 1) {
      const area = `_curve_${curve}_mbArea`;
      if (props[`_curve_${curve}_parseMode`] === "Modbus" && badArea(props[area])) {
        fail("mbArea", `控件 ${id} 的 ${area} 只能是 ${areas.join("、")}`, [id, area]);
      }
    }
  }
}

function validateWidgets(items, depth, ids, projectParser, projectConfig) {
  if (!Array.isArray(items) || depth > 64) fail("widgetTree", "无效控件树");
  for (const item of items) {
    if (!isObject(item) || typeof item.type !== "string") fail("widgetType", "控件缺少有效类型");
    if (item.id !== undefined && item.id !== null) {
      if (typeof item.id !== "string" || !item.id || ids.has(item.id)) fail("widgetId", "控件 ID 无效或重复");
      ids.add(item.id);
    }
    if (item.properties !== undefined && !isObject(item.properties)) fail("widgetProps", "控件属性必须是对象");
    validateCardParser(item, projectParser, projectConfig);
    validateModbus(item);
    if (item.binding !== undefined && item.binding !== null && !isObject(item.binding)) fail("widgetBinding", "控件绑定必须是对象");
    if (item.geometry !== undefined && !isObject(item.geometry)) fail("widgetGeometry", "控件位置必须是对象");
    const geometry = item.geometry ?? {};
    for (const key of ["x", "y", "w", "h"]) {
      if (geometry[key] === undefined) continue;
      if (typeof geometry[key] !== "number" || !Number.isFinite(geometry[key])) fail("geometryNumber", "控件位置必须是有限数值");
      if ((key === "w" || key === "h") && geometry[key] <= 0) fail("geometrySize", "控件尺寸必须大于零");
    }
    if (item.tabIndex !== undefined && (!isStrictInt(item.tabIndex) || item.tabIndex < 0)) fail("tabIndex", "无效选项卡索引");
    if (item.children !== undefined) validateWidgets(item.children, depth + 1, ids, projectParser, projectConfig);
  }
}

/** Throws ProjectError where FluentHMIRuntime --check rejects the document (unknown types aside). */
export function validateProject(data) {
  if (!isObject(data)) fail("root", "项目根节点必须是对象");
  if ((data.version ?? FORMAT_VERSION) !== FORMAT_VERSION) fail("version", "不支持的项目版本");
  if (data.appName !== undefined && typeof data.appName !== "string") fail("appName", "应用名称必须是文本");
  if (data.canvas !== undefined && !isObject(data.canvas)) fail("canvas", "画布配置必须是对象");
  const canvas = data.canvas ?? {};
  for (const [name, limit] of [["width", 9999], ["height", 9999], ["gridSize", 1000]]) {
    const value = canvas[name];
    if (value === undefined) continue;
    if (!isStrictInt(value) || value < 1 || value > limit) fail("canvasValue", `无效画布参数: ${name}`, [name]);
  }
  if (data.serial !== undefined && !isObject(data.serial)) fail("serial", "串口配置必须是对象");
  const serial = data.serial ?? {};
  const parser = typeof serial.parser === "string" ? serial.parser : "line";
  const parserConfig = isObject(serial.parserConfig) ? serial.parserConfig : {};
  try {
    createParser(parser, parserConfig);
  } catch (error) {
    fail("parser", error.message, [error]);
  }
  if (data.widgets !== undefined) validateWidgets(data.widgets, 0, new Set(), parser, parserConfig);
}

/** Parses .uidp text; throws ProjectError for text that is no project. */
export function parseProject(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch (error) {
    fail("json", `JSON 格式错误: ${error.message}`, [error.message]);
  }
  validateProject(data);
  return data;
}

/** The file text: two-space JSON, non-ASCII as it is. */
export function serializeProject(project) {
  return `${JSON.stringify(project, null, 2)}\n`;
}

export function createEmptyProject() {
  return {
    version: FORMAT_VERSION,
    appName: "上位机",
    canvas: { width: 1200, height: 800, gridSize: 10 },
    widgets: [{ id: "serialConfigCard_1", type: "SerialConfigCard", geometry: { x: 20, y: 20, w: 360, h: 320 }, properties: {} }],
    serial: { parser: "line", parserConfig: { separator: "," } },
  };
}

/** The 电机监控 example of uidp-format.md, on a serial link at 115200, with a receive card and a log. */
export function createExampleProject() {
  return {
    version: FORMAT_VERSION,
    appName: "电机监控",
    canvas: { width: 1200, height: 620, gridSize: 10 },
    serial: { parser: "line", parserConfig: { separator: "," } },
    widgets: [
      { type: "Label", id: "title", geometry: { x: 20, y: 10, w: 860, h: 36 }, properties: { text: "电机监控", fontSize: 22, bold: true } },
      { type: "SerialConfigCard", id: "serial", geometry: { x: 20, y: 60, w: 300, h: 290 }, properties: { title: "串口连接", displayMode: "简洁", defaultBaud: "115200" } },
      {
        type: "GaugeMeter", id: "rpm", geometry: { x: 340, y: 60, w: 260, h: 260 },
        properties: { title: "转速", unit: "rpm", maximum: 3000 }, binding: { parseMode: "键值匹配", key: "rpm" },
      },
      {
        type: "LEDIndicator", id: "running_led", geometry: { x: 620, y: 70, w: 260, h: 36 },
        properties: { label: "运行中", on: false }, binding: { parseMode: "键值匹配", key: "running" },
      },
      {
        type: "ToggleSwitch", id: "run", geometry: { x: 620, y: 130, w: 260, h: 36 },
        properties: { label: "电机启停", onCommand: "START", offCommand: "STOP" }, binding: { parseMode: "键值匹配", key: "running" },
      },
      { type: "Label", id: "speed_label", geometry: { x: 620, y: 200, w: 260, h: 28 }, properties: { text: "设定转速（0–3000 rpm）" } },
      {
        type: "Slider", id: "speed", geometry: { x: 620, y: 235, w: 260, h: 36 },
        properties: { minimum: 0, maximum: 3000, value: 0, sendOnChange: true, commandTemplate: "SPEED={value}" },
      },
      {
        type: "RealtimeChart", id: "load_chart", geometry: { x: 20, y: 370, w: 860, h: 230 },
        properties: { title: "负载", curveCount: 1, _curve_0_name: "负载", _curve_0_key: "load" },
      },
      { type: "DataRecvCard", id: "receive", geometry: { x: 900, y: 60, w: 280, h: 290 }, properties: {} },
      { type: "LogBox", id: "log", geometry: { x: 900, y: 370, w: 280, h: 230 }, properties: {} },
    ],
  };
}

// -- the widget tree ----------------------------------------------------------------------

/** Every widget, depth first in document order, with its parent (null at the top) and list. */
export function* walkWidgets(list, parent = null) {
  if (!Array.isArray(list)) return;
  for (const widget of list) {
    if (!isObject(widget)) continue;
    yield { widget, parent, list };
    // A placeholder's children are kept as they are and not shown.
    if (isSupported(widget) && CONTAINER_TYPES.has(widget.type)) yield* walkWidgets(widget.children, widget);
  }
}

/** Every widget of the document, children of placeholders included (for ids). */
export function* walkAllWidgets(list) {
  if (!Array.isArray(list)) return;
  for (const widget of list) {
    if (!isObject(widget)) continue;
    yield widget;
    yield* walkAllWidgets(widget.children);
  }
}

/**
 * Whether a widget is on screen: on the shown page of every TabWidget it sits in. `pageOf(tabs)`
 * gives the page a TabWidget shows (by default its currentTab).
 */
export function isShown(project, widget, pageOf = currentTab) {
  let entry = [...walkWidgets(project.widgets)].find((item) => item.widget === widget);
  while (entry?.parent) {
    const { parent } = entry;
    if (parent.type === "TabWidget" && childTab(parent, entry.widget) !== pageOf(parent)) return false;
    entry = [...walkWidgets(project.widgets)].find((item) => item.widget === parent);
  }
  return true;
}

export function findWidget(project, id) {
  for (const entry of walkWidgets(project.widgets)) if (entry.widget.id === id) return entry;
  return null;
}

/** A new id: the type name with a lower-case first letter, _, and the lowest number not used. */
export function nextWidgetId(project, type, taken = new Set()) {
  const used = new Set(taken);
  for (const widget of walkAllWidgets(project.widgets)) if (typeof widget.id === "string") used.add(widget.id);
  const stem = `${type.charAt(0).toLowerCase()}${type.slice(1)}`;
  let n = 1;
  while (used.has(`${stem}_${n}`)) n += 1;
  return `${stem}_${n}`;
}

export function geometryOf(widget) {
  const meta = widgetMeta(widget.type);
  const g = isObject(widget.geometry) ? widget.geometry : {};
  const num = (value, fallback) => (typeof value === "number" && Number.isFinite(value) ? value : fallback);
  return {
    x: num(g.x, 0),
    y: num(g.y, 0),
    w: num(g.w, meta?.size[0] ?? 120),
    h: num(g.h, meta?.size[1] ?? 40),
  };
}

export function createWidget(project, type, x, y) {
  const meta = widgetMeta(type);
  return {
    id: nextWidgetId(project, type),
    type,
    geometry: { x: Math.round(x), y: Math.round(y), w: meta.size[0], h: meta.size[1] },
    properties: {},
  };
}

// -- properties ---------------------------------------------------------------------------

export function propDef(type, name) {
  return widgetMeta(type)?.props?.find((prop) => prop.name === name) ?? null;
}

/** A property as the widget has it: its value in the file, else the registry default. */
export function propValue(widget, name) {
  const props = isObject(widget.properties) ? widget.properties : {};
  if (props[name] !== undefined && props[name] !== null) return props[name];
  return propDef(widget.type, name)?.default;
}

/** Sets a property; a new one equal to the default is not written. True when the document changed. */
export function setProp(widget, name, value) {
  if (!isObject(widget.properties)) widget.properties = {};
  const props = widget.properties;
  const def = propDef(widget.type, name);
  if (!Object.hasOwn(props, name) && def && JSON.stringify(def.default) === JSON.stringify(value)) return false;
  if (JSON.stringify(props[name]) === JSON.stringify(value)) return false;
  props[name] = value;
  return true;
}

/** Sets a binding field (the binding is created when the widget has none). */
export function setBindingField(widget, name, value) {
  if (!isObject(widget.binding)) widget.binding = { parseMode: BINDING_DEFAULTS.parseMode };
  const binding = widget.binding;
  if (JSON.stringify(binding[name]) === JSON.stringify(value)) return false;
  if (value === "" && name === "expression") delete binding.expression;
  else binding[name] = value;
  return true;
}

export const BINDING_DEFAULTS = {
  parseMode: PARSE_MODES[0], key: "", jsonPath: "", byteOffset: 0, dataType: "uint16", byteOrder: "大端(BE)",
  frameHeader: "", frameTail: "", mbArea: "保持寄存器", mbRegIndex: 0, mbDataType: "uint16", mbRegOrder: "大端(AB CD)",
  mbFcFilter: -1, mbSlaveFilter: -1, mbPeriod: 0, expression: "",
};

export function bindingValue(widget, name) {
  const binding = isObject(widget.binding) ? widget.binding : {};
  return binding[name] ?? BINDING_DEFAULTS[name];
}

// -- links --------------------------------------------------------------------------------

const MODBUS_DEFAULTS = { modbusPeriod: [500, 10, 60000], modbusTimeout: [1000, 10, 60000], modbusSlave: [1, 1, 247] };

function modbusSetting(props, name) {
  const [fallback, low, high] = MODBUS_DEFAULTS[name];
  const value = Number(props?.[name]);
  if (props?.[name] === undefined || props?.[name] === null || typeof props[name] === "boolean" || !Number.isFinite(value)) return fallback;
  return Math.min(Math.max(Math.trunc(value), low), high);
}

/** A card's own parserConfig: {} (or none) keeps the project's when the modes match, else the defaults. */
export function cardParserConfig(mode, config, projectParser, projectConfig) {
  if (isObject(config) && Object.keys(config).length) return config;
  return mode === projectParser ? projectConfig : {};
}

/**
 * The link settings of a link card: its own defaultParser and parserConfig unless it uses the
 * project's (项目设置), and its Modbus polling settings.
 * { parser, parserConfig, period, timeout, slave, slaveRole }
 */
export function cardLinkSettings(project, card) {
  const serial = isObject(project.serial) ? project.serial : {};
  const projectParser = typeof serial.parser === "string" ? serial.parser : "line";
  const projectConfig = isObject(serial.parserConfig) ? serial.parserConfig : {};
  const props = isObject(card.properties) ? card.properties : {};
  const mode = props.defaultParser ?? PROJECT_PARSER;
  const own = mode !== PROJECT_PARSER;
  return {
    parser: own ? mode : projectParser,
    parserConfig: own ? cardParserConfig(mode, props.parserConfig, projectParser, projectConfig) : projectConfig,
    period: modbusSetting(props, "modbusPeriod"),
    timeout: modbusSetting(props, "modbusTimeout"),
    slave: modbusSetting(props, "modbusSlave"),
    slaveRole: card.type !== "MqttConfigCard" && props.modbusRole === "从站",
  };
}

/** The link cards of a project, in document order. */
export function linkCards(project) {
  return [...walkWidgets(project.widgets)].map((entry) => entry.widget).filter((widget) => LINK_CARD_TYPES.includes(widget.type));
}
