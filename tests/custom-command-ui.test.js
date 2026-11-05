import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createCustomCommandUi } from "../src/features/custom/custom-command-ui.js";
import { COMMAND_LIBRARY_KEY, serializeCommandLibrary } from "../src/features/custom/command-library.js";

class Element {
  value = "";
  checked = false;
  disabled = false;
  hidden = false;
  textContent = "";
  className = "";
  children = [];
  attributes = {};
  handlers = {};
  classList = { toggle() {} };
  setAttribute(name, value) { this.attributes[name] = value; }
  addEventListener(name, handler) { this.handlers[name] = handler; }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren() { this.children = []; }
  focus() {}
  closest() { return this.panel; }
  async emit(name, event = {}) { await this.handlers[name]?.(event); }
}

function fixture(t) {
  const previous = Object.fromEntries(["document", "window", "localStorage"].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const stored = new Map();
  let denyStorage = false;
  globalThis.document = { createElement: () => new Element() };
  globalThis.window = new Element();
  globalThis.localStorage = {
    getItem: (key) => stored.get(key) ?? null,
    setItem(key, value) { if (denyStorage) throw new Error("blocked"); stored.set(key, value); },
  };
  t.after(() => {
    for (const [key, descriptor] of Object.entries(previous)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
  const html = readFileSync(new URL("../pages/devices/custom.html", import.meta.url), "utf8");
  const elements = Object.fromEntries([...html.matchAll(/id="(custom[^\"]+)"/g)].map((match) => [match[1], new Element()]));
  const pane = { hidden: false };
  elements.customQuickPayload.panel = pane;
  for (const [key, value] of Object.entries({ Format: "ascii", Ending: "\\r\\n", Checksum: "none", Interval: "1000", Limit: "10" })) {
    elements[`customQuick${key}`].value = value;
  }
  const writes = [];
  const session = { connected: false, async write(bytes) { writes.push([...bytes]); } };
  const logs = [];
  const ui = createCustomCommandUi({ elements, getSession: () => session, isActive: () => true, appendLog: (...args) => logs.push(args) });
  t.after(ui.stop);
  return { e: elements, ui, pane, session, writes, stored, logs, denyStorage() { denyStorage = true; } };
}

// Saved commands render as rows of [load-into-editor button, send button].
function row(f, index) {
  const [load, send] = f.e.customQuickLibrary.children[index].children;
  return { load, send, selected: f.e.customQuickLibrary.children[index].className.includes("selected") };
}

async function saveCommand(f, fields) {
  await f.e.customQuickNew.emit("click");
  for (const [key, value] of Object.entries(fields)) f.e[`customQuick${key}`][key === "Escapes" ? "checked" : "value"] = value;
  await f.e.customQuickSave.emit("click");
}

test("editor preview, saved commands and actual single-send bytes stay aligned", async (t) => {
  const f = fixture(t);
  f.e.customQuickName.value = "Read";
  f.e.customQuickPayload.value = "READ?";
  await f.e.customQuickPayload.emit("input");
  assert.equal(f.e.customQuickPreview.textContent, "52 45 41 44 3F 0D 0A");
  assert.equal(f.e.customQuickSend.disabled, true);
  await f.e.customQuickSave.emit("click");
  assert.equal(JSON.parse(f.stored.get(COMMAND_LIBRARY_KEY)).commands[0].payload, "READ?");
  await f.e.customQuickNew.emit("click");
  assert.equal(f.e.customQuickPayload.value, "");
  assert.equal(row(f, 0).selected, false);
  await row(f, 0).load.emit("click");
  assert.equal(f.e.customQuickPayload.value, "READ?");
  assert.equal(row(f, 0).selected, true);
  assert.equal(row(f, 0).load.attributes["aria-current"], "true");
  f.session.connected = true;
  f.ui.refresh();
  assert.equal(f.e.customQuickSend.disabled, false);
  await f.e.customQuickSend.emit("click");
  assert.deepEqual(f.writes, [[0x52, 0x45, 0x41, 0x44, 0x3f, 13, 10]]);
  assert.match(f.e.customQuickRunStatus.textContent, /1 \/ 1/);
});

test("switching a pane stops the UI runner and an in-flight send cannot restart it", async (t) => {
  const f = fixture(t);
  let finish;
  f.session.connected = true;
  f.session.write = () => new Promise((resolve) => { finish = resolve; });
  f.e.customQuickPayload.value = "A";
  f.ui.refresh();
  await f.e.customQuickStart.emit("click");
  assert.equal(f.e.customQuickPayload.disabled, true);
  assert.equal(f.e.customQuickStop.disabled, false);
  f.pane.hidden = true;
  await f.e.customPage.emit("keydown");
  assert.equal(f.e.customQuickStop.disabled, true);
  assert.equal(f.e.customQuickSend.disabled, true);
  finish(); await Promise.resolve(); await Promise.resolve();
  assert.equal(f.e.customQuickPayload.disabled, false);
  assert.match(f.e.customQuickRunStatus.textContent, /1 \/ 10/);
});

test("failed import or storage leaves the saved library intact", async (t) => {
  const f = fixture(t);
  const library = serializeCommandLibrary([{ name: "AT", payload: "AT", format: "ascii", lineEnding: "\\r", checksum: "none" }]);
  f.e.customQuickFile.files = [{ size: library.length, text: async () => library }];
  await f.e.customQuickFile.emit("change");
  const saved = f.stored.get(COMMAND_LIBRARY_KEY);
  await f.e.customQuickFile.emit("change");
  assert.equal(f.stored.get(COMMAND_LIBRARY_KEY), saved);
  f.e.customQuickFile.files = [{ size: 4, text: async () => "oops" }];
  await f.e.customQuickFile.emit("change");
  assert.equal(f.stored.get(COMMAND_LIBRARY_KEY), saved);
  assert.equal(f.logs.length, 1);
  await row(f, 0).load.emit("click");
  f.denyStorage();
  await f.e.customQuickDelete.emit("click");
  assert.equal(f.e.customQuickLibrary.children.length, 1);
  assert.equal(row(f, 0).selected, true);
  assert.equal(f.stored.get(COMMAND_LIBRARY_KEY), saved);
  assert.equal(f.logs.length, 2);
  assert.deepEqual(f.writes, []);
});

test("each saved row sends its saved bytes in one click without touching the editor", async (t) => {
  const f = fixture(t);
  assert.equal(f.e.customQuickEmpty.hidden, false);
  assert.equal(f.e.customQuickLibrary.hidden, true);
  await saveCommand(f, { Name: "Version", Payload: "VER?", Ending: "\\r" });
  await saveCommand(f, { Name: "Registers", Format: "hex", Payload: "01 03 00 00 00 02", Ending: "", Checksum: "modbus" });
  await saveCommand(f, { Name: "Reset", Payload: "RST\\x01", Ending: "", Escapes: true });
  assert.equal(f.e.customQuickCount.textContent, "3 / 50");
  assert.equal(f.e.customQuickEmpty.hidden, true);
  assert.equal(row(f, 1).load.children[2].textContent, "HEX · 8 B");
  assert.equal(row(f, 1).send.disabled, true);

  await f.e.customQuickNew.emit("click");
  f.e.customQuickPayload.value = "draft in progress";
  f.session.connected = true;
  f.ui.refresh();
  assert.equal(row(f, 1).send.disabled, false);
  await row(f, 1).send.emit("click");
  await row(f, 2).send.emit("click");
  await row(f, 0).send.emit("click");
  assert.deepEqual(f.writes, [[1, 3, 0, 0, 0, 2, 0xc4, 0x0b], [0x52, 0x53, 0x54, 0x01], [0x56, 0x45, 0x52, 0x3f, 0x0d]]);
  assert.equal(f.e.customQuickPayload.value, "draft in progress");
  assert.equal(f.e.customQuickEditorTitle.textContent, "新指令");

  await row(f, 2).load.emit("click");
  assert.equal(f.e.customQuickEscapes.checked, true);
  assert.equal(f.e.customQuickPreview.textContent, "52 53 54 01");
  assert.match(f.e.customQuickEditorTitle.textContent, /Reset$/);
});

test("rows are locked while a timed send runs", async (t) => {
  const f = fixture(t);
  await saveCommand(f, { Name: "Ping", Payload: "PING" });
  f.session.connected = true;
  f.session.write = () => new Promise(() => {});
  f.ui.refresh();
  await f.e.customQuickStart.emit("click");
  assert.equal(row(f, 0).send.disabled, true);
  assert.equal(row(f, 0).load.disabled, true);
});
