import test from "node:test";
import assert from "node:assert/strict";
import catalog from "../src/hmi/industrial-catalog.js";
import { INDUSTRIAL_CATALOG, industrialDrivers, industrialMotionRate, industrialValue, renderIndustrialSvg } from "../src/hmi/industrial.js";
import { BindingEntry, BIND_PROPERTIES } from "../src/hmi/binding.js";
import { PALETTE, createEmptyProject, createWidget, parseProject, serializeProject, isSupported, propValue, widgetMeta } from "../src/hmi/uidp.js";
import { WIDGET_ICONS } from "../src/features/canvas/widget-icons.js";
import { industrialView } from "../src/features/canvas/industrial-view.js";
import i18n from "../src/i18n.js";

for (const item of catalog) {
  test(`industrial ${item.type}: registry, bindings and UIDP preserve its configuration`, () => {
    const project = createEmptyProject();
    const widget = createWidget(project, item.type, 0, 0);
    assert.ok(isSupported(widget));
    assert.deepEqual(widgetMeta(item.type).size, item.size ?? [160, 140]);
    const groups = PALETTE.filter((group) => group.types.includes(item.type));
    assert.equal(groups.length, 1);
    assert.equal(widgetMeta(item.type).group, groups[0].id);
    assert.equal(BIND_PROPERTIES[item.type], "value");
    if (widgetMeta(item.type).props.some((prop) => prop.name === "value")) assert.deepEqual(propValue(widget, "value"), item.value);
    widget.binding = { key: "v", expression: "value + 0" };
    project.widgets.push(widget);
    assert.deepEqual(parseProject(serializeProject(project)), project);
    const binding = BindingEntry.fromWidget(widget);
    assert.deepEqual(binding.onParsed({ v: item.value }), [item.value]);
    assert.equal(binding.bindingState, "ready");
    assert.deepEqual(binding.onParsed({ v: "bad" }), []);
    assert.equal(binding.bindingState, "invalid");
    assert.deepEqual(binding.onParsed({ v: item.value }), [item.value]);
    assert.equal(binding.bindingState, "ready");
    for (const dark of [false, true]) {
      const svg = renderIndustrialSvg(item, { dark, unit: '<&"' });
      assert.ok(svg.startsWith("<svg"));
      assert.doesNotMatch(svg, /\{\{|NaN|Infinity/);
      assert.doesNotMatch(svg, /<script|onload=|javascript:/i);
    }
    assert.ok(WIDGET_ICONS[item.type].includes("<svg"));
    assert.notEqual(i18n(`hmi.widget.${item.type}`), `hmi.widget.${item.type}`);
  });
}

test("industrial states, bit masks, invalid input and independent drivers", () => {
  assert.equal(INDUSTRIAL_CATALOG.size, catalog.length);
  assert.deepEqual(PALETTE.slice(-3).map((group) => group.id), ["automotive", "diy", "embedded"]);
  for (const item of catalog) {
    if (["state", "bits", "byte", "flags"].includes(item.mode)) {
      assert.equal(industrialValue(item, 0.5), null);
      assert.equal(industrialValue(item, -1), null);
      assert.equal(industrialValue(item, ["byte", "flags"].includes(item.mode) ? item.maximum + 1 : item.mode === "bits" ? 8 : item.states.length), null);
    }
    if (item.mode === "byte") {
      assert.equal(industrialValue(item, item.maximum), item.maximum);
      const sevenBit = item.maximum === 127;
      const bits = industrialDrivers(item, sevenBit ? 0x56 : 0x96, 0, item.maximum);
      assert.deepEqual(Array.from({ length: 8 }, (_, n) => bits[`bit${n}`]), sevenBit ? [0, 1, 1, 0, 1, 0, 1, 0] : [0, 1, 1, 0, 1, 0, 0, 1]);
    }
    const off = industrialDrivers(item, null, item.minimum, item.maximum, 0.4);
    const configuration = new Set(["limitsOn", "lowMark", "highMark", "straight", "elbow", "mirrored", "thickness"]);
    assert.ok(Object.entries(off).filter(([key]) => !configuration.has(key)).every(([key, value]) => value === (key === "phase" ? 0.4 : 0)));
  }
});

test("industrial views wait for real data; animation pauses when hidden/stopped and cancels on destroy", () => {
  const keys = ["document", "window", "IntersectionObserver", "MutationObserver", "requestAnimationFrame", "cancelAnimationFrame"];
  const previous = Object.fromEntries(keys.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const frames = new Map(); let nextId = 0; let intersection;
  class Element {
    children = []; dataset = {}; attrs = {}; style = {};
    append(...nodes) { this.children.push(...nodes); }
    setAttribute(name, value) { this.attrs[name] = value; }
  }
  let visibility;
  globalThis.document = { documentElement: { dataset: {} }, visibilityState: "visible", createElement: () => new Element(), addEventListener: (_, fn) => { visibility = fn; }, removeEventListener() {} };
  globalThis.window = { matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) };
  globalThis.IntersectionObserver = class { constructor(fn) { intersection = fn; } observe() {} disconnect() {} };
  globalThis.MutationObserver = class { observe() {} disconnect() {} };
  globalThis.requestAnimationFrame = (fn) => { frames.set(++nextId, fn); return nextId; };
  globalThis.cancelAnimationFrame = (id) => frames.delete(id);
  try {
    const item = catalog.find((entry) => entry.motion === "signed");
    assert.ok(item);
    const widget = { type: item.type, properties: {} };
    const view = industrialView(widget, { mode: "run" });
    assert.equal(view.el.dataset.state, "waiting");
    assert.equal(frames.size, 0);
    view.setValue(1);
    assert.equal(view.el.dataset.state, "ready");
    assert.equal(frames.size, 0);
    intersection([{ isIntersecting: true }]);
    assert.equal(frames.size, 1);
    document.visibilityState = "hidden"; visibility();
    assert.equal(frames.size, 0);
    document.visibilityState = "visible"; visibility();
    assert.equal(frames.size, 1);
    view.setValue(0);
    assert.equal(frames.size, 0);
    view.setValue(1);
    view.setBindingState("invalid");
    assert.equal(view.el.dataset.state, "invalid");
    assert.equal(frames.size, 0);
    view.setValue(1);
    assert.equal(view.el.dataset.state, "ready");
    view.destroy();
    assert.equal(frames.size, 0);
    const design = industrialView(widget, { mode: "design" });
    assert.equal(design.el.dataset.state, "ready");
    assert.equal(frames.size, 0);
    design.destroy();
    const unsafe = '<img src=x onerror="alert(1)">';
    const escaped = industrialView({ type: "PressureGauge", properties: { title: unsafe, unit: unsafe } }, { mode: "design" });
    assert.equal(escaped.el.children[0].textContent, unsafe);
    assert.doesNotMatch(escaped.el.children[1].innerHTML, /<img/);
    escaped.destroy();
    const currentLanguage = i18n.current;
    try {
      for (const [language, stackText, inputText, outputText] of [["zh", "绿＋红", "输入", "输出"], ["en", "Green + red", "Input", "Output"]]) {
        i18n.current = () => language;
        const stack = industrialView({ type: "StackLight", properties: { value: 5 } }, { mode: "design" });
        assert.equal(stack.el.children[2].textContent, stackText);
        stack.setValue(0);
        assert.equal(stack.el.children[2].textContent, language === "zh" ? "全灭" : "Off");
        stack.destroy();
        const power = industrialView({ type: "PowerMeter", properties: { value: 0 } }, { mode: "design" });
        assert.equal(power.el.children[2].textContent, "0 kW");
        power.setValue(12);
        assert.equal(power.el.children[2].textContent, `12.0 kW · ${inputText}`);
        power.setValue(-12);
        assert.equal(power.el.children[2].textContent, `-12.0 kW · ${outputText}`);
        power.setValue(0);
        assert.equal(power.el.children[2].textContent, "0 kW");
        power.destroy();
        for (const definition of catalog.filter((entry) => entry.mode === "flags")) {
          const flags = industrialView({ type: definition.type, properties: {} }, { mode: "run" });
          assert.equal(flags.el.dataset.state, "waiting");
          flags.setValue(5);
          const labels = language === "en" ? definition.flagsEn : definition.flags;
          assert.equal(flags.el.children[2].textContent, [labels[0], labels[2]].join(language === "en" ? ", " : "、"));
          flags.setValue(0);
          assert.equal(flags.el.children[2].textContent, language === "en" ? definition.clearLabelEn : definition.clearLabel);
          flags.setValue(definition.maximum + 1);
          assert.equal(flags.el.dataset.state, "invalid");
          flags.setValue(5);
          assert.equal(flags.el.dataset.state, "ready");
          flags.destroy();
        }
        const gpioItem = catalog.find((entry) => entry.type === "GpioBank");
        if (gpioItem) {
          const gpio = industrialView({ type: gpioItem.type, properties: { value: 255 } }, { mode: "design" });
          assert.equal(gpio.el.children[2].textContent, "0xFF");
          gpio.setValue(0);
          assert.equal(gpio.el.children[2].textContent, "0x00");
          gpio.setValue(256);
          assert.equal(gpio.el.dataset.state, "invalid");
          gpio.destroy();
        }
      }
    } finally { i18n.current = currentLanguage; }
  } finally {
    for (const [key, descriptor] of Object.entries(previous)) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; }
  }
});

test("industrial bindings support JSON paths, HEX extraction and configured Modbus needs", () => {
  const item = catalog.find((entry) => entry.mode === "number");
  const widget = { id: "meter", type: item.type, properties: {} };
  const json = BindingEntry.fromWidget({ ...widget, binding: { parseMode: "JSON路径", jsonPath: "sensor.value", expression: "value * 0.1" } });
  assert.deepEqual(json.onParsed({ sensor: { value: 125 } }), [12.5]);
  const raw = BindingEntry.fromWidget({ ...widget, binding: { parseMode: "HEX字节提取", dataType: "uint16", byteOrder: "大端(BE)", expression: "value * 0.1" } });
  assert.deepEqual(raw.onRaw(Uint8Array.of(0, 125)), [12.5]);
  const modbus = BindingEntry.fromWidget({ ...widget, binding: { parseMode: "Modbus", mbArea: "保持寄存器", mbRegIndex: 100, mbSlaveFilter: 2, mbPeriod: 700, expression: "value * 0.1" } });
  assert.deepEqual(modbus.modbusNeed(), { slave: 2, table: "hr", address: 100, count: 1, period: 700 });
  assert.deepEqual(modbus.onParsed({ slave: 2, fc: 3, hr100: 125 }), [12.5]);
});

test("industrial runtime delivers ready, invalid and recovery from every browser link source", async () => {
  const { getTransportDescriptor } = await import("../src/transports/registry.js");
  const { createCanvasRuntime } = await import("../src/features/canvas/canvas-runtime.js");
  for (const [transport, type] of [["serial", "SerialConfigCard"], ["websocket", "TcpConfigCard"], ["mqtt", "MqttConfigCard"]]) {
    const descriptor = getTransportDescriptor(transport);
    const original = descriptor.createSession;
    class Session extends EventTarget {
      connected = false;
      async connect() { this.connected = true; }
      async disconnect() { this.connected = false; }
    }
    const session = new Session();
    descriptor.createSession = () => session;
    const values = [], states = [];
    const item = catalog.find((entry) => entry.mode === "number");
    const project = { serial: { parser: "line" }, widgets: [
      { id: "link", type, properties: {} },
      { id: "meter", type: item.type, properties: {}, binding: { key: "v", expression: "value * 0.1" } },
    ] };
    const runtime = createCanvasRuntime({ project, onValue: (_, value) => values.push(value), onBindingState: (_, state) => states.push(state), onCurvePoint() {}, onStatus() {}, notify() {} });
    try {
      runtime.start();
      await runtime.links[0].connect({}, "test");
      for (const v of [125, "bad", 250]) {
        const bytes = new TextEncoder().encode(`v=${v}\n`);
        session.dispatchEvent(new CustomEvent("rx", { detail: { bytes, topic: transport === "mqtt" ? "test" : undefined } }));
      }
      assert.deepEqual(values, [12.5, 25], transport);
      assert.deepEqual(states, ["ready", "invalid", "ready"], transport);
    } finally { await runtime.stop(); descriptor.createSession = original; }
  }
});

test("final equipment templates change with phase and escape editable unit text", () => {
  for (const item of catalog) {
    if (item.motion !== "none") {
      const value = item.mode === "state" ? 1 : 10;
      assert.notEqual(renderIndustrialSvg(item, { value, phase: 0 }), renderIndustrialSvg(item, { value, phase: 0.25 }), item.type);
    }
    const svg = renderIndustrialSvg(item, { unit: '<script>alert("unit")</script>&' });
    assert.doesNotMatch(svg, /<script>|alert\("unit"\)/);
  }
});


test("industrial limits, pipe geometry, feedback modes and speed-dependent motion", () => {
  const get = (type) => INDUSTRIAL_CATALOG.get(type);
  for (const type of ["PressureGauge", "Ammeter", "Voltmeter", "Tank"]) {
    const item = get(type), options = { showLimits: true, lowLimit: 20, highLimit: 80 };
    assert.equal(industrialDrivers(item, 20, 0, 100, 0, options).lowAlarm, 1);
    assert.equal(industrialDrivers(item, 80, 0, 100, 0, options).highAlarm, 1);
    assert.equal(industrialDrivers(item, null, 0, 100, 0, options).lowAlarm, 0);
    assert.equal(industrialDrivers(item, 90, 0, 100, 0, { ...options, showLimits: false }).highAlarm, 0);
    const invalid = industrialDrivers(item, 90, 0, 100, 0, { ...options, lowLimit: 80, highLimit: 20 });
    assert.equal(invalid.limitsOn, 0);
    assert.equal(invalid.highAlarm, 0);
    const marks = industrialDrivers(item, 0, 0, 100, 0, { ...options, lowLimit: -20, highLimit: 120 });
    assert.equal(marks.lowMark, 0); assert.equal(marks.highMark, 1);
  }
  const pipe = get("FlowPipe");
  const normal = renderIndustrialSvg(pipe);
  assert.notEqual(normal, renderIndustrialSvg(pipe, { pipeShape: "直管" }));
  assert.notEqual(normal, renderIndustrialSvg(pipe, { pipeDirection: "镜像布局" }));
  assert.notEqual(renderIndustrialSvg(pipe, { pipeWidth: 8 }), renderIndustrialSvg(pipe, { pipeWidth: 26 }));
  assert.equal(industrialMotionRate(pipe, 0), 0);
  assert.equal(industrialMotionRate(pipe, -100, { minimum: -100, maximum: 100 }), -0.9);
  assert.equal(industrialMotionRate(pipe, 50, { minimum: -100, maximum: 100 }), 0.525);
  assert.equal(industrialMotionRate(get("Pump"), 1), 0.55);
  assert.equal(industrialMotionRate(get("Pump"), 2), 0);
  assert.equal(industrialMotionRate(get("AirCompressor"), 1), 0.55);
  assert.equal(industrialMotionRate(get("AirCompressor"), 3), 0.3);
  assert.equal(industrialMotionRate(get("AirCompressor"), 2), 0);
  const motor = get("Motor"), runBit = { feedbackMode: "运行位" };
  assert.equal(industrialMotionRate(motor, 1, runBit), 0.55);
  assert.equal(industrialValue(motor, 2, runBit), null);
  assert.equal(industrialValue(motor, -1, runBit), null);
  const motorBinding = BindingEntry.fromWidget({ type: "Motor", properties: runBit, binding: { key: "v" } });
  assert.deepEqual(motorBinding.onParsed({ v: 2 }), []);
  assert.equal(motorBinding.bindingState, "invalid");
  assert.deepEqual(motorBinding.onParsed({ v: 1 }), [1]);
  const cylinder = get("Cylinder"), ends = { feedbackMode: "端位状态" };
  assert.equal(industrialValue(cylinder, 3, ends), null);
  assert.equal(industrialDrivers(cylinder, 0, 0, 100, 0, ends).pistonKnown, 0);
  assert.equal(industrialDrivers(cylinder, 1, 0, 100, 0, ends).pistonKnown, 1);
  assert.equal(industrialDrivers(cylinder, 1, 0, 100, 0, ends).level, 0);
  assert.equal(industrialDrivers(cylinder, 2, 0, 100, 0, ends).level, 1);
  assert.equal(industrialDrivers(cylinder, 50, 0, 100).level, 0.5);
});

test("industrial property forms expose specialized options and keep the expression as their last field", async () => {
  const { renderPropertyPanel } = await import("../src/features/canvas/property-panel.js");
  const previous = globalThis.document, language = i18n.current;
  class Element {
    children = []; listeners = {};
    constructor(tag) { this.tagName = tag; }
    append(...nodes) { this.children.push(...nodes); }
    replaceChildren(...nodes) { this.children = nodes; }
    addEventListener(type, listener) { this.listeners[type] = listener; }
    querySelectorAll(tag) { return this.children.flatMap((child) => [...(child.tagName === tag ? [child] : []), ...child.querySelectorAll(tag)]); }
  }
  globalThis.document = { createElement: (tag) => new Element(tag) };
  try {
    for (const lang of ["zh", "en"]) {
      i18n.current = () => lang;
      for (const type of ["PressureGauge", "Tank", "Ammeter", "Voltmeter", "FlowPipe", "Motor", "Cylinder"]) {
        const root = new Element("div");
        const widget = { id: "w", type, properties: {} };
        renderPropertyPanel(root, { project: {}, selected: [widget], canPaste: () => false, change: (fn) => fn() });
        const fields = root.querySelectorAll("label");
        assert.equal(fields.at(-1).children[0].textContent, i18n("hmi.binding.expression"));
        assert.equal(fields.find((node) => node.children[0].textContent === i18n("hmi.prop.decimals")).children[1].max, "6");
        for (const name of type === "FlowPipe" ? ["pipeShape", "pipeDirection", "pipeWidth"] : ["Motor", "Cylinder"].includes(type) ? ["feedbackMode"] : ["showLimits", "lowLimit", "highLimit"]) {
          assert.ok(fields.some((node) => node.children[0].textContent === i18n(`hmi.prop.${name}`)), `${type}.${name}`);
        }
      }
    }
  } finally { globalThis.document = previous; i18n.current = language; }
});
