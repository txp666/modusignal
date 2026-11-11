import test from "node:test";
import assert from "node:assert/strict";
import { BindingEntry } from "../src/hmi/binding.js";
import { createEmptyProject, parseProject, serializeProject } from "../src/hmi/uidp.js";
import { createExtendedFeedbackState, extendedFeedbackValue, getBitProfile, setBitProfile, renameBitProfile } from "../src/hmi/extended-feedback.js";
import { createCanvasRuntime } from "../src/features/canvas/canvas-runtime.js";
import { getTransportDescriptor } from "../src/transports/registry.js";

const bound = (type, binding, properties = {}) => ({ id: type, type, properties, binding });

test("shared bit profiles default without persistence; editing and renaming update all references once", () => {
  const project = createEmptyProject();
  project.widgets.push(bound("StatusWordPanel", { key: "bits" }), bound("DigitalTimingChart", { key: "bits" }));
  assert.equal(Object.hasOwn(project, "bitProfiles"), false);
  assert.deepEqual(getBitProfile(project).bits.map((bit) => bit.name), ["B0", "B1", "B2", "B3", "B4", "B5", "B6", "B7"]);
  setBitProfile(project, "default", { width: 16, bits: [{ name: '<&"', color: "#123456" }, { name: "Emergency stop", color: "#228866" }] });
  assert.equal(renameBitProfile(project, "default", "plc"), true);
  assert.equal(project.widgets[1].properties.bitProfile, "plc");
  assert.equal(project.widgets[2].properties.bitProfile, "plc");
  assert.deepEqual(Object.keys(project.bitProfiles), ["plc"]);
  assert.deepEqual(parseProject(serializeProject(project)), project);
  assert.equal(extendedFeedbackValue("StatusWordPanel", 65535, { bitProfile: "plc" }, project), 65535);
  assert.equal(extendedFeedbackValue("StatusWordPanel", 256), null);

});

test("compound key/path feedback preserves numbers, normalizes modes and rejects malformed structures", () => {
  const cells = BindingEntry.fromWidget(bound("BmsCellMatrix", { parseMode: "JSON路径", jsonPath: "pack.cells" }));
  assert.deepEqual(cells.onParsed({ pack: { cells: [3.6, -1, 4.2] } }), [[3.6, -1, 4.2]]);
  for (const value of [[], ["3.6"], [true], [NaN], {}, null]) {
    assert.deepEqual(cells.onParsed({ pack: { cells: value } }), []);
    assert.equal(cells.takeObservations().at(-1).state, "invalid");
  }
  cells.takeObservations(); cells.onParsed({ other: 1 }); assert.deepEqual(cells.takeObservations(), []);
  const timing = BindingEntry.fromWidget(bound("DigitalTimingChart", { parseMode: "Modbus", mbRegIndex: 10, mbSlaveFilter: 1 }));
  assert.deepEqual(timing.onParsed({ slave: 2, fc: 3, hr10: 4 }), []);
  assert.deepEqual(timing.onParsed({ slave: 1, fc: 3, hr11: 4 }), []);
  assert.deepEqual(timing.takeObservations(), []);
  assert.deepEqual(timing.onParsed({ slave: 1, fc: 3, hr10: 4 }), [4]);
  assert.equal(timing.takeObservations().length, 1);
  assert.deepEqual(timing.onParsed({ slave: 1, fc: 3, hr10: "bad" }), []);
  assert.deepEqual(timing.takeObservations(), [{ value: null, state: "invalid" }]);
  const supply = BindingEntry.fromWidget(bound("DcPowerSupply", { key: "supply", expression: "value" }));
  assert.deepEqual(supply.onParsed({ supply: { voltage: -12.5, current: -0.2, mode: " cc " } }), [{ voltage: -12.5, current: -0.2, mode: "CC" }]);
  for (const value of [{ voltage: "12", current: 1, mode: "CV" }, { voltage: 12, current: false, mode: "CV" }, { voltage: 12, current: 1, mode: "OFF" }]) assert.deepEqual(supply.onParsed({ supply: value }), []);
});

test("encoder direction comes from safe cumulative deltas and resets after an invalid observation", () => {
  const model = createExtendedFeedbackState("RotaryEncoder", { pulsesPerTurn: 4 });
  model.observe(-1, "ready"); assert.equal(model.snapshot().direction, "unknown");
  model.observe(0, "ready"); assert.equal(model.snapshot().direction, "forward");
  model.observe(0, "ready"); assert.equal(model.snapshot().direction, "stopped");
  model.observe(-2, "ready"); assert.equal(model.snapshot().direction, "reverse");
  model.observe(null, "invalid"); model.observe(100, "ready"); assert.equal(model.snapshot().direction, "unknown");
  assert.equal(extendedFeedbackValue("RotaryEncoder", Number.MAX_SAFE_INTEGER + 1), null);
  assert.equal(extendedFeedbackValue("RotaryEncoder", 1.5), null);
  assert.equal(extendedFeedbackValue("RotaryEncoder", true), null);
  assert.equal(extendedFeedbackValue("RotaryEncoder", "12"), null);
});

test("timing history retains actual samples and invalid observations", () => {
  const model = createExtendedFeedbackState("DigitalTimingChart");
  model.observe(1, "ready"); model.observe(null, "invalid"); model.observe(0, "ready");
  assert.deepEqual(model.snapshot().samples, [1, null, 0]);
  for (let i = 0; i < 40; i++) model.observe(i, "ready");
  assert.deepEqual(model.snapshot().samples, Array.from({ length: 32 }, (_, i) => i + 8));
  const before = model.snapshot(); model.snapshot(); model.snapshot(); assert.deepEqual(model.snapshot(), before);
});

test("runtime collects hidden timing samples only for real values, retaining 32 with explicit null gaps", async () => {
  const descriptor = getTransportDescriptor("websocket"), original = descriptor.createSession;
  class Session extends EventTarget { connected = false; async connect() { this.connected = true; } async disconnect() { this.connected = false; } }
  const session = new Session(); descriptor.createSession = () => session;
  const project = { widgets: [{ id: "link", type: "TcpConfigCard", properties: {} }, bound("DigitalTimingChart", { key: "v" })], serial: { parser: "line" } };
  const runtime = createCanvasRuntime({ project, isShown: () => false, onValue() {}, onBindingState() {}, onCurvePoint() {}, onStatus() {}, notify() {} });
  const send = (data) => session.dispatchEvent(new CustomEvent("rx", { detail: { bytes: new TextEncoder().encode(JSON.stringify(data) + "\n") } }));
  try {
    runtime.start(); await runtime.links[0].connect({}, "test");
    send({ v: 1 }); send({ v: null }); send({ unrelated: 1 }); send({ v: 2 });
    assert.deepEqual(runtime.feedbackState("DigitalTimingChart").samples, [1, null, 2]);
    for (let i = 0; i < 40; i++) send({ v: i });
    const before = runtime.feedbackState("DigitalTimingChart");
    assert.equal(before.samples.length, 32); assert.equal(before.samples[0], 8);
    runtime.refreshPolling(); runtime.feedbackState("DigitalTimingChart");
    assert.deepEqual(runtime.feedbackState("DigitalTimingChart"), before);
  } finally { await runtime.stop(); descriptor.createSession = original; }
});
