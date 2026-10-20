import test from "node:test";
import assert from "node:assert/strict";
import { createLogController } from "../src/ui/log-controller.js";
import { bytesToHex } from "../src/protocols.js";

const LINE_HEIGHT = 20;

class Node {
  children = [];
  parent = null;
  textContent = "";
  className = "";
  value = "";
  attributes = {};
  handlers = {};
  append(...nodes) { for (const node of nodes) { node.parent = this; this.children.push(node); } }
  get firstElementChild() { return this.children[0] ?? null; }
  remove() { this.parent.children.splice(this.parent.children.indexOf(this), 1); this.parent = null; }
  replaceChildren() { this.children = []; }
  querySelector(selector) { return this.children.find((child) => `.${child.className}` === selector) ?? null; }
  getBoundingClientRect() { return { height: LINE_HEIGHT }; }
  setAttribute(name, value) { this.attributes[name] = value; }
  addEventListener(name, handler) { this.handlers[name] = handler; }
  emit(name) { this.handlers[name]?.(); }
}

class LogNode extends Node {
  scrollTop = 0;
  get scrollHeight() { return this.children.length * LINE_HEIGHT; }
}

function fixture(t, storedMode = null) {
  const previous = Object.fromEntries(["document", "window", "localStorage"].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const stored = new Map(storedMode ? [["modusignal.logDisplayMode", storedMode]] : []);
  const timers = new Map();
  let nextTimer = 0;
  globalThis.document = { createElement: () => new Node() };
  globalThis.window = {
    setTimeout(callback) { timers.set(++nextTimer, callback); return nextTimer; },
    clearTimeout(id) { timers.delete(id); },
  };
  globalThis.localStorage = { getItem: (key) => stored.get(key) ?? null, setItem: (key, value) => stored.set(key, value) };
  t.after(() => {
    for (const [key, descriptor] of Object.entries(previous)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
  const log = new LogNode();
  const elements = Object.fromEntries(["logDisplayMode", "logPauseScroll", "saveLog", "clearLog", "logRxBytes", "logTxBytes"]
    .map((id) => [id, new Node()]));
  const controller = createLogController({ elements, getLogElement: () => log, bytesToHex });
  const payloads = () => log.children.map((line) => line.querySelector(".payload").textContent);
  const idle = () => { for (const [id, callback] of [...timers]) { timers.delete(id); callback(); } };
  return { controller, log, elements, stored, payloads, idle };
}

const text = (value) => new TextEncoder().encode(value);

test("RX chunks share a line until idle, topic messages do not, and both directions are counted", (t) => {
  const f = fixture(t);
  f.controller.queueRx(text("LINE1\r\n"), "LINE1\r\n", false);
  f.controller.queueRx(text("LINE2\r\n"), "LINE2\r\n", false);
  assert.deepEqual(f.payloads(), ["LINE1\r\nLINE2\r\n"]);
  f.idle();
  f.controller.queueRx(Uint8Array.of(1, 3, 0x41), "\u0001\u0003A", false);
  f.controller.queueRx(text("{}"), "{}", false, "[a/b] ");
  f.controller.queueRx(text("{}"), "{}", false, "[a/c] ");
  f.controller.append("tx", "TX", { bytes: text("AT\r"), text: "AT\r" });
  f.controller.append("info", "系统", "plain text line");
  assert.deepEqual(f.payloads(), ["LINE1\r\nLINE2\r\n", "01 03 41", "[a/b] {}", "[a/c] {}", "AT\r", "plain text line"]);
  assert.equal(f.elements.logRxBytes.textContent, "21");
  assert.equal(f.elements.logTxBytes.textContent, "3");
  assert.match(f.log.children[0].querySelector(".time").textContent, /^\d\d:\d\d:\d\d\.\d{3}$/);
});

test("display mode re-renders existing RX/TX lines and is remembered", (t) => {
  const f = fixture(t);
  f.controller.queueRx(text("OK\r\n"), "OK\r\n", false);
  f.controller.append("tx", "TX", { bytes: Uint8Array.of(1, 3), prefix: "[t] " });
  f.elements.logDisplayMode.value = "hex";
  f.elements.logDisplayMode.emit("change");
  assert.deepEqual(f.payloads(), ["4F 4B 0D 0A", "[t] 01 03"]);
  f.controller.setDisplayMode("text");
  assert.deepEqual(f.payloads(), ["OK\\r\\n", "[t] \\x01\\x03"]);
  assert.equal(f.stored.get("modusignal.logDisplayMode"), "text");
  // A chunk arriving after the switch still extends the pending line, in the new mode.
  f.controller.queueRx(text("A"), "A", false);
  assert.deepEqual(f.payloads(), ["OK\\r\\n\nA", "[t] \\x01\\x03"]);
  assert.equal(fixture(t, "text").elements.logDisplayMode.value, "text");
  assert.equal(fixture(t, "bogus").elements.logDisplayMode.value, "auto");
});

test("the log keeps 1000 lines and a paused view stays on the same lines", (t) => {
  const f = fixture(t);
  for (let index = 0; index < 1005; index += 1) f.controller.append("info", "系统", String(index));
  assert.equal(f.log.children.length, 1000);
  assert.equal(f.payloads()[0], "5");
  assert.equal(f.log.scrollTop, f.log.scrollHeight);

  f.elements.logPauseScroll.emit("click");
  assert.equal(f.elements.logPauseScroll.attributes["aria-pressed"], "true");
  assert.equal(f.elements.logPauseScroll.attributes["data-i18n"], "workbench.resumeScroll");
  f.log.scrollTop = 500;
  f.controller.append("info", "系统", "new");
  f.controller.queueRx(text("rx"), "rx", false);
  assert.equal(f.log.scrollTop, 500 - 2 * LINE_HEIGHT);
  assert.equal(f.log.children.length, 1000);

  f.elements.logPauseScroll.emit("click");
  assert.equal(f.elements.logPauseScroll.attributes["aria-pressed"], "false");
  assert.equal(f.log.scrollTop, f.log.scrollHeight);
});

test("clear empties the log and resets the byte counters", (t) => {
  const f = fixture(t);
  f.controller.queueRx(text("abc"), "abc", false);
  f.controller.append("tx", "TX", { bytes: text("xy") });
  f.elements.clearLog.emit("click");
  assert.equal(f.log.children.length, 1);
  assert.equal(f.elements.logRxBytes.textContent, "0");
  assert.equal(f.elements.logTxBytes.textContent, "0");
  // The cleared pending RX line must not be extended.
  f.controller.queueRx(text("d"), "d", false);
  assert.deepEqual(f.payloads().slice(1), ["d"]);
});
