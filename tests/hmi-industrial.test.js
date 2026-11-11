import test from "node:test";
import assert from "node:assert/strict";
import catalog from "../src/hmi/industrial-catalog.js";
import { INDUSTRIAL_CATALOG, industrialDrivers, industrialValue } from "../src/hmi/industrial.js";
import { BindingEntry, BIND_PROPERTIES } from "../src/hmi/binding.js";
import { PALETTE, createEmptyProject, createWidget, parseProject, serializeProject, isSupported, propValue, widgetMeta } from "../src/hmi/uidp.js";
import { WIDGET_ICONS } from "../src/features/canvas/widget-icons.js";
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

test("industrial limit alarms and feedback-mode validation", () => {
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

  }
  const motor = get("Motor"), runBit = { feedbackMode: "运行位" };
  assert.equal(industrialValue(motor, 2, runBit), null);
  assert.equal(industrialValue(motor, -1, runBit), null);
  const motorBinding = BindingEntry.fromWidget({ type: "Motor", properties: runBit, binding: { key: "v" } });
  assert.deepEqual(motorBinding.onParsed({ v: 2 }), []);
  assert.equal(motorBinding.bindingState, "invalid");
  assert.deepEqual(motorBinding.onParsed({ v: 1 }), [1]);
  const cylinder = get("Cylinder"), ends = { feedbackMode: "端位状态" };
  assert.equal(industrialValue(cylinder, 3, ends), null);

});

test("industrial property forms expose specialized options and binding expressions", async () => {
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
        assert.ok(fields.some((node) => node.children[0].textContent === i18n("hmi.binding.expression")));
        assert.equal(fields.find((node) => node.children[0].textContent === i18n("hmi.prop.decimals")).children[1].max, "6");
        for (const name of type === "FlowPipe" ? ["pipeShape", "pipeDirection", "pipeWidth"] : ["Motor", "Cylinder"].includes(type) ? ["feedbackMode"] : ["showLimits", "lowLimit", "highLimit"]) {
          assert.ok(fields.some((node) => node.children[0].textContent === i18n(`hmi.prop.${name}`)), `${type}.${name}`);
        }
      }
    }
  } finally { globalThis.document = previous; i18n.current = language; }
});
