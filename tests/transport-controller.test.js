import test from "node:test";
import assert from "node:assert/strict";
import i18n from "../src/i18n.js";
import { createTransportController } from "../src/core/transport-controller.js";
import { CUSTOM_DEVICE_ID } from "../src/protocols.js";

class Element {
  children = [];
  dataset = {};
  handlers = {};
  textContent = "";
  title = "";
  type = "";
  disabled = false;
  selected = false;
  classList = { add() {}, remove() {}, toggle() {} };
  #value = "";
  constructor(tagName = "div") { this.tagName = tagName.toUpperCase(); }
  // A select's value is its selected option, as in the browser.
  get value() {
    if (this.tagName !== "SELECT") return this.#value;
    return (this.children.find((option) => option.selected) ?? this.children[0])?.value ?? "";
  }
  set value(next) {
    if (this.tagName !== "SELECT") this.#value = String(next);
    else this.children.forEach((option) => { option.selected = option.value === String(next); });
  }
  set innerHTML(_html) { this.children = []; }
  append(...nodes) { this.children.push(...nodes); }
  addEventListener(name, handler) { (this.handlers[name] ??= []).push(handler); }
  removeAttribute(name) { this[name] = ""; }
  descendants() { return this.children.flatMap((child) => [child, ...child.descendants()]); }
  querySelectorAll() { return this.descendants().filter((node) => node.dataset.fieldKey); }
  querySelector(selector) {
    const key = selector.match(/data-field-key="([^"]+)"/)[1];
    return this.querySelectorAll().find((node) => node.dataset.fieldKey === key) ?? null;
  }
}

function fixture(t) {
  const previous = Object.fromEntries(["document", "window"].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  globalThis.document = { createElement: (tagName) => new Element(tagName), documentElement: {}, body: null };
  globalThis.window = { isSecureContext: true, WebSocket: class {} };
  i18n.setLanguage("zh");
  t.after(() => {
    i18n.setLanguage("zh");
    for (const [key, descriptor] of Object.entries(previous)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
  const elements = Object.fromEntries(["transportFields", "transportSelect", "secureState", "connectButton", "disconnectButton", "sendManual", "connectionState"]
    .map((id) => [id, new Element()]));
  const state = { deviceId: CUSTOM_DEVICE_ID, transportId: "serial" };
  const logs = [];
  let session = null;
  const noop = () => {};
  const controller = createTransportController({
    elements,
    state,
    getConfigs: () => ({}),
    getSession: () => session,
    setSession: (next) => { session = next; },
    // Mirrors the app's session-event handler, which logs the summary on "connected".
    bindSessionEvents: (target) => target.addEventListener("connected", () => {
      controller.updateConnectionUi(true);
      logs.push(controller.describeConnectionSummary());
    }),
    appendLog: (...args) => logs.push(args),
    updateWebSocketStats: noop,
    updateMqttDebugger: noop,
    updateSetpointUi: noop,
    updatePollingUi: noop,
    updateDeviceUi: noop,
    detectHartLink: noop,
  });
  const field = (key) => elements.transportFields.querySelector(`[data-field-key="${key}"]`);
  const label = (key) => elements.transportFields.children.find((node) => node.children.includes(field(key))).textContent;
  const type = (key, value) => {
    field(key).value = value;
    (field(key).handlers.input ?? []).forEach((handler) => handler());
  };
  // Stand-in for a real socket: the session reports connected with the options it was given.
  const stubConnect = () => {
    session.connect = async (options) => {
      Object.defineProperty(session, "connected", { value: true, configurable: true });
      session.emit("connected", { options: { ...options } });
    };
  };
  // The transport part of the app's language switch (refreshAllDynamicUi).
  const switchLanguage = (language) => {
    i18n.setLanguage(language);
    controller.updateConnectionUi(Boolean(session?.connected));
    controller.localize();
  };
  return { controller, elements, logs, field, label, type, stubConnect, switchLanguage };
}

test("switching language keeps typed WebSocket address and the header follows the live session", async (t) => {
  const f = fixture(t);
  await f.controller.setTransport("websocket");
  assert.equal(f.field("url").value, "ws://127.0.0.1:8080");

  f.type("url", "ws://127.0.0.1:8081");
  f.stubConnect();
  await f.controller.connect();
  assert.equal(f.elements.secureState.textContent, "WebSocket 已连接 · ws://127.0.0.1:8081");
  assert.equal(f.logs.at(-1), "WebSocket 已连接 · ws://127.0.0.1:8081");

  f.switchLanguage("en");
  assert.equal(f.label("url"), "URL");
  assert.equal(f.field("url").value, "ws://127.0.0.1:8081");
  assert.equal(f.elements.secureState.textContent, "WebSocket Connected · ws://127.0.0.1:8081");
  assert.equal(f.elements.connectionState.title, "WebSocket Connected · ws://127.0.0.1:8081");
  assert.ok(!f.logs.some((entry) => Array.isArray(entry)), "re-rendering the labels logs no transport switch");

  // An unsaved edit while connected stays in the form but does not relabel the live session.
  f.type("url", "ws://10.0.0.2:9000");
  f.switchLanguage("zh");
  assert.equal(f.field("url").value, "ws://10.0.0.2:9000");
  assert.equal(f.elements.secureState.textContent, "WebSocket 已连接 · ws://127.0.0.1:8081");
});

test("switching language keeps unsaved serial parameters while disconnected", async (t) => {
  const f = fixture(t);
  await f.controller.setTransport("serial");
  assert.equal(f.field("baudRate").value, "115200");

  f.field("baudRate").value = "9600";
  f.field("parity").value = "even";
  f.field("stopBits").value = "2";
  f.switchLanguage("en");
  assert.equal(f.label("baudRate"), "Baud Rate");
  assert.deepEqual(
    [f.field("baudRate").value, f.field("parity").value, f.field("stopBits").value],
    ["9600", "even", "2"],
  );
  assert.deepEqual(f.controller.readOptions(), { baudRate: 9600, dataBits: 8, stopBits: 2, parity: "even", flowControl: "none" });

  // Choosing a transport still starts from the device defaults.
  await f.controller.setTransport("serial");
  assert.equal(f.field("baudRate").value, "115200");
});
