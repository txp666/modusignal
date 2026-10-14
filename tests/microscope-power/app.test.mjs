import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import * as protocol from "../../pages/devices/microscope-power/protocol.js";
import { CommandTransport } from "../../pages/devices/microscope-power/commands.js";
import { CaptureTimeline } from "../../pages/devices/microscope-power/timeline.js";
import { SampleStatistics } from "../../pages/devices/microscope-power/statistics.js";
import { LowPassMeasurements } from "../../pages/devices/microscope-power/lowpass.js";
import { EnergyStatistics } from "../../pages/devices/microscope-power/energy.js";
import { WavePlot, aggregateTimeBuckets } from "../../pages/devices/microscope-power/plot.js";

const tick = () => new Promise((resolve) => setImmediate(resolve));
const encoder = new TextEncoder();
// Imported WavePlot runs in the host realm; use the same window in the VM.
globalThis.window = { devicePixelRatio: 1, confirm: () => true };

class UsbDevice {
  constructor() {
    this.vendorId = protocol.USB_CONFIG.vendorId;
    this.productId = protocol.USB_CONFIG.productId;
    this.opened = false;
    this.configuration = null;
    this.writes = [];
    this.reads = [];
    this.packets = [];
    this.closeCount = 0;
    this.keepReadPendingOnClose = false;
    this.onCommand = (command) => command === "GET_STATUS"
      ? "STATUS state=IDLE srate=100000 range=10 auto_range=1 fw=test\n" : "OK\n";
  }
  async open() { this.opened = true; }
  async reset() {}
  async selectConfiguration(value) { this.configuration = { configurationValue: value }; }
  async claimInterface() {}
  async controlTransferOut() { return { status: "ok" }; }
  async releaseInterface() {}
  async close() {
    this.opened = false;
    this.closeCount += 1;
    if (!this.keepReadPendingOnClose) for (const read of this.reads.splice(0)) read.reject(new Error("closed"));
  }
  async transferOut(endpoint, payload) {
    assert.equal(endpoint, protocol.USB_CONFIG.endpointOut);
    const command = new TextDecoder().decode(payload).trim();
    this.writes.push(command);
    const reply = await this.onCommand(command);
    if (typeof reply === "string") this.emit(reply);
    return reply && typeof reply === "object" ? reply : { status: "ok", bytesWritten: payload.length };
  }
  transferIn(endpoint) {
    assert.equal(endpoint, protocol.USB_CONFIG.endpointIn);
    if (this.packets.length) return Promise.resolve(this.packets.shift());
    return new Promise((resolve, reject) => this.reads.push({ resolve, reject }));
  }
  emit(bytes) {
    if (typeof bytes === "string") bytes = encoder.encode(bytes);
    const packet = { status: "ok", data: new DataView(bytes.buffer, bytes.byteOffset, bytes.length) };
    if (this.reads.length) this.reads.shift().resolve(packet);
    else this.packets.push(packet);
  }
}

function frame(seq, t0Us, sampleRate = 100000, flags = protocol.FRAME_FLAGS.adcData, code = 100) {
  const bytes = new Uint8Array(protocol.WAVE_FRAME.bytes);
  const data = new DataView(bytes.buffer);
  data.setUint16(0, protocol.WAVE_FRAME.magic, true);
  data.setUint16(2, seq, true);
  data.setUint32(4, t0Us, true);
  data.setUint32(8, sampleRate, true);
  data.setUint16(12, protocol.WAVE_FRAME.sampleCount, true);
  data.setUint16(14, flags, true);
  for (let i = 0; i < 256; i += 1) data.setUint16(16 + i * 2, code, true);
  return bytes;
}

function appHarness(t, { fetch: fetchRelease } = {}) {
  const html = readFileSync(new URL("../../pages/devices/microscope-power/index.html", import.meta.url), "utf8");
  const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]));
  const elements = new Map();
  const downloads = [];
  const usbListeners = new Map();
  const devices = [];
  const fetches = [];
  const drawCommands = [];
  const windowListeners = new Map();
  globalThis.window.addEventListener = (type, callback) => windowListeners.set(type, callback);
  let renderCalls = 0;
  const context2d = new Proxy({}, { get(target, name) {
    return target[name] ?? ((...args) => { renderCalls += 1; drawCommands.push({ name, args, fillStyle: target.fillStyle }); });
  } });
  const defaults = {
    sampleRateSelect: "100000", manualRangeSelect: "10", zeroLowUaInput: "0", zeroHighUaInput: "0",
    senseLowOhmInput: "1", senseHighOhmInput: "10", yMinInput: "-100", yMaxInput: "100",
    lowpassCutoffSelect: "1000", lowpassCutoffInput: "1000",
    measurementVoltageInput: "",
  };
  function element(id) {
    if (!elements.has(id)) {
      const listeners = new Map();
      const capturedPointers = new Set();
      elements.set(id, {
        value: defaults[id] ?? "", checked: ["autoRangeToggle", "useDeviceVoltageToggle"].includes(id), textContent: "", disabled: false,
        classList: { toggle(name, enabled) { this[name] = enabled; } }, addEventListener: (type, callback) => listeners.set(type, callback),
        trigger: (type, event = {}) => listeners.get(type)?.(event),
        getBoundingClientRect() { return this.rect ?? { width: 800, height: 400, left: 0, top: 0 }; },
        getContext: () => context2d, setPointerCapture: (id) => capturedPointers.add(id),
        hasPointerCapture: (id) => capturedPointers.has(id),
        releasePointerCapture: (id) => {
          if (capturedPointers.delete(id)) listeners.get("lostpointercapture")?.({ pointerId: id });
        },
        click() {}, remove() {},
        replaceChildren(...children) { this.children = children; this.textContent = children.map((child) => child.textContent).join(""); },
      });
    }
    return elements.get(id);
  }
  const sandbox = {
    ...protocol, CommandTransport, CaptureTimeline, SampleStatistics, LowPassMeasurements, EnergyStatistics, WavePlot,
    TextEncoder, TextDecoder, Uint16Array, Uint8Array, DataView, ArrayBuffer, Blob,
    window: globalThis.window, console,
    fetch: async (url, options) => {
      fetches.push({ url, options });
      return fetchRelease ? fetchRelease(url, options) : { ok: true, json: async () => ({ tag_name: "v1.0.0" }) };
    },
    performance: { now: () => 1000 }, requestAnimationFrame() {}, setTimeout, clearTimeout,
    URL: { createObjectURL: (blob) => { downloads.push(blob); return "blob:test"; }, revokeObjectURL() {} },
    document: { querySelector: (selector) => {
      assert.ok(ids.has(selector.slice(1)), `App references missing page element ${selector}`);
      return element(selector.slice(1));
    }, activeElement: null,
      createElement: () => element("download"), body: { appendChild() {} } },
    navigator: { usb: {
      requestDevice: async () => { assert.ok(devices.length); return devices.shift(); },
      addEventListener: (type, callback) => usbListeners.set(type, callback),
    } },
  };
  const context = vm.createContext(sandbox);
  // Only remove module imports; evaluate the complete application, including its
  // startup code, event wiring and first animation frame, with real modules.
  const source = readFileSync(new URL("../../pages/devices/microscope-power/app.js", import.meta.url), "utf8")
    .replace(/^import[\s\S]*?;\n/gm, "");
  vm.runInContext(source, context, { filename: "pages/devices/microscope-power/app.js" });
  const evaluate = (code) => vm.runInContext(code, context);
  t.after(async () => { await evaluate("cleanupDevice()"); });
  return {
    element, evaluate, downloads, fetches, drawCommands, get renderCalls() { return renderCalls; },
    blur: () => windowListeners.get("blur")?.(),
    connect: async (device) => { devices.push(device); await element("connectBtn").trigger("click"); },
    enqueueDevice: (device) => devices.push(device),
    state: () => evaluate("({state, sampleRate, droppedFrames, availableSamples, acceptFrames, actionBusy, connected: Boolean(device?.opened)})"),
  };
}

async function gestureCapture(app, count = 80, intervalUs = 3500) {
  const device = new UsbDevice();
  await app.connect(device);
  await app.element("startBtn").trigger("click");
  for (let seq = 0; seq < count; seq += 1) {
    device.emit(frame(seq, 100000 + seq * intervalUs, 100000,
      seq === 0 ? protocol.FRAME_FLAGS.streamStart : 0, 100 + seq));
  }
  await tick();
  app.evaluate("visibleSeconds=0.1; setManualYRange(-100,100); plot.draw(buildPlotSource())");
  return device;
}

function pointerPoint(app, x, y, { pointerId = 1, button = 0 } = {}) {
  const geometry = app.evaluate("plot.getPlotGeometry()");
  return { pointerId, button, clientX: geometry.left + x * geometry.width,
    clientY: geometry.top + y * geometry.height, preventDefault() {} };
}

test("left rectangle drag zooms actual device time and Y, prioritizes selection over cursors and redraws its overlay", async (t) => {
  const app = appHarness(t);
  await gestureCapture(app);
  app.evaluate("cursorEnabled=true; cursors.a.serial=buildPlotSource().windowInfo.startSerial+100; plot.draw(buildPlotSource())");
  const before = app.evaluate("buildPlotSource()");
  const cursor = app.evaluate("cursors.a.serial");
  const canvas = app.element("waveCanvas");
  const first = pointerPoint(app, 0.8, 0.75);
  const last = pointerPoint(app, 0.2, 0.25);
  const startSerial = before.windowInfo.startSerial + before.timeToOffset(before.timeStart + 0.2 * (before.timeEnd - before.timeStart));
  const endExclusive = before.windowInfo.startSerial + before.timeToOffset(before.timeStart + 0.8 * (before.timeEnd - before.timeStart));
  canvas.trigger("pointerdown", first);
  assert.equal(canvas.hasPointerCapture(1), true);
  canvas.trigger("pointermove", last);
  assert.ok(app.evaluate("plot.selectionBox !== null"));
  const overlaysBefore = app.drawCommands.filter((call) => call.name === "strokeRect").length;
  app.evaluate("animationLoop(2200)");
  assert.equal(app.drawCommands.filter((call) => call.name === "strokeRect").length, overlaysBefore + 1);
  assert.equal(app.evaluate("cursors.a.serial"), cursor);
  canvas.trigger("pointerup", last);
  const after = app.evaluate("buildPlotSource()");
  assert.equal(after.windowInfo.startSerial, startSerial);
  assert.equal(after.windowInfo.endSerial, endExclusive - 1);
  assert.ok(after.visibleSamples < before.visibleSamples);
  assert.equal(after.yRange.min, -50);
  assert.equal(after.yRange.max, 50);
  assert.equal(app.evaluate("displayPaused"), true);
  assert.equal(app.evaluate("plot.selectionBox"), null);
  assert.equal(app.evaluate("activeDrag"), null);
  assert.equal(canvas.hasPointerCapture(1), false);
  assert.equal(app.evaluate("cursors.a.serial"), cursor);
});

test("right drag pans in real time and current even with cursors enabled, without drifting as frames arrive", async (t) => {
  const app = appHarness(t);
  const device = await gestureCapture(app);
  app.evaluate("cursorEnabled=true; cursors.a.serial=buildPlotSource().windowInfo.startSerial+100");
  const before = app.evaluate("buildPlotSource()");
  const cursor = app.evaluate("cursors.a.serial");
  const canvas = app.element("waveCanvas");
  const first = pointerPoint(app, 0.4, 0.4, { button: 2 });
  const last = pointerPoint(app, 0.65, 0.5, { button: 2 });
  const targetTime = before.timeEnd - 0.25 * (before.timeEnd - before.timeStart);
  const expectedEnd = app.evaluate(`timeline.lowerBound(${targetTime},getOldestSerial(),totalSamplesWritten)-1`);
  canvas.trigger("pointerdown", first);
  assert.equal(canvas.classList["is-panning"], true);
  canvas.trigger("pointermove", last);
  const panned = app.evaluate("buildPlotSource()");
  assert.equal(panned.windowInfo.endSerial, expectedEnd);
  assert.ok(Math.abs(panned.yRange.min + 80) < 1e-9);
  assert.ok(Math.abs(panned.yRange.max - 120) < 1e-9);
  const offset = app.evaluate("viewOffsetSamples");
  for (let seq = 80; seq < 90; seq += 1) device.emit(frame(seq, 100000 + seq * 3500, 100000, 0, 100 + seq));
  await tick();
  assert.equal(app.evaluate("buildPlotSource().windowInfo.endSerial"), expectedEnd);
  assert.equal(app.evaluate("viewOffsetSamples"), offset + 2560);
  canvas.trigger("pointermove", last);
  assert.equal(app.evaluate("buildPlotSource().windowInfo.endSerial"), expectedEnd);
  canvas.trigger("pointerup", last);
  assert.equal(canvas.classList["is-panning"], false);
  assert.equal(app.evaluate("cursors.a.serial"), cursor);
  assert.equal(app.evaluate("displayPaused"), true);
  let prevented = 0;
  canvas.trigger("contextmenu", { preventDefault() { prevented += 1; } });
  assert.equal(prevented, 1);
});

test("a stationary right gesture freezes its serial window and time bounds while the last frame period is revised", async (t) => {
  const app = appHarness(t);
  const device = await gestureCapture(app, 1);
  const before = app.evaluate("buildPlotSource()");
  const canvas = app.element("waveCanvas");
  const point = pointerPoint(app, 0.5, 0.5, { button: 2 });
  canvas.trigger("pointerdown", point);
  device.emit(frame(1, 105120, 100000, protocol.FRAME_FLAGS.timingOverrun, 200));
  await tick();
  app.evaluate("animationLoop(2200)");
  const during = app.evaluate("buildPlotSource()");
  assert.equal(during.windowInfo.startSerial, before.windowInfo.startSerial);
  assert.equal(during.windowInfo.endSerial, before.windowInfo.endSerial);
  assert.equal(during.timeStart, before.timeStart);
  assert.equal(during.timeEnd, before.timeEnd);
  assert.equal(during.readVisibleTime(255), before.timeStart + 255 / 100000);
  assert.equal(during.timeToOffset(0.00128), 128);
  assert.equal(aggregateTimeBuckets(during, 512).reduce((count, bucket) => count + bucket.count, 0), 256);
  // A repeated zero-distance move must not refresh the gesture's snapshot.
  canvas.trigger("pointermove", point);
  assert.equal(app.evaluate("buildPlotSource().timeEnd"), before.timeEnd);
  canvas.trigger("pointercancel", { pointerId: 1 });
});

test("left clicks set alternating A/B cursors without zooming or pausing, while drag never moves a cursor", async (t) => {
  const app = appHarness(t);
  await gestureCapture(app);
  app.evaluate("cursorEnabled=true");
  const canvas = app.element("waveCanvas");
  const before = app.evaluate("buildPlotSource()");
  for (const [ratio, name] of [[0.2, "a"], [0.7, "b"]]) {
    const point = pointerPoint(app, ratio, 0.5);
    canvas.trigger("pointerdown", point);
    canvas.trigger("pointerup", point);
    assert.equal(app.evaluate(`cursors.${name}.serial`), before.windowInfo.startSerial +
      before.timeToOffset(before.timeStart + ratio * (before.timeEnd - before.timeStart)));
  }
  assert.equal(app.evaluate("visibleSeconds"), 0.1);
  assert.equal(app.evaluate("displayPaused"), false);
  assert.equal(app.evaluate("buildPlotSource().yRange.min"), -100);
  const cursorA = app.evaluate("cursors.a.serial");
  const x = app.evaluate("plot.sampleOffsetToClientX(cursors.a.serial-buildPlotSource().windowInfo.startSerial)");
  const first = { ...pointerPoint(app, 0.2, 0.4), clientX: x };
  canvas.trigger("pointerdown", first);
  canvas.trigger("pointermove", { ...first, clientY: first.clientY + 40 });
  canvas.trigger("pointerup", { ...first, clientY: first.clientY + 40 });
  assert.equal(app.evaluate("cursors.a.serial"), cursorA);
  assert.equal(app.evaluate("visibleSeconds"), 0.1);
});

test("a cursor click selects the frozen sample even when acquisition advances before pointerup", async (t) => {
  const app = appHarness(t);
  const device = await gestureCapture(app);
  app.evaluate("cursorEnabled=true");
  const before = app.evaluate("buildPlotSource()");
  const point = pointerPoint(app, 0.5, 0.5);
  const expected = before.windowInfo.startSerial + before.timeToOffset((before.timeStart + before.timeEnd) / 2);
  const canvas = app.element("waveCanvas");
  canvas.trigger("pointerdown", point);
  device.emit(frame(80, 380000, 100000, 0, 180));
  await tick();
  canvas.trigger("pointerup", point);
  assert.equal(app.evaluate("cursors.a.serial"), expected);
  assert.equal(app.evaluate("displayPaused"), false);
  assert.equal(app.evaluate("viewOffsetSamples"), 0);
});

test("empty canvas, axes, middle button and a narrow drag cannot create a zoom or a cursor", async (t) => {
  const app = appHarness(t);
  const canvas = app.element("waveCanvas");
  canvas.trigger("pointerdown", pointerPoint(app, 0.5, 0.5));
  assert.equal(app.evaluate("activeDrag"), null);
  await gestureCapture(app);
  app.evaluate("cursorEnabled=true");
  const inside = pointerPoint(app, 0.5, 0.5);
  canvas.trigger("pointerdown", { ...inside, clientX: 2 });
  assert.equal(app.evaluate("activeDrag"), null);
  canvas.trigger("pointerdown", { ...inside, button: 1 });
  assert.equal(app.evaluate("activeDrag"), null);
  canvas.trigger("pointerdown", inside);
  const narrow = { ...inside, clientX: inside.clientX + 2, clientY: inside.clientY + 40 };
  canvas.trigger("pointermove", narrow);
  canvas.trigger("pointerup", narrow);
  assert.equal(app.evaluate("visibleSeconds"), 0.1);
  assert.equal(app.evaluate("cursors.a.serial"), null);
  assert.equal(app.evaluate("cursors.b.serial"), null);
  assert.equal(app.evaluate("displayPaused"), false);
});

test("pointer cancellation, capture loss, window blur and a fresh stream clear the gesture without applying its rectangle", async (t) => {
  const app = appHarness(t);
  const device = await gestureCapture(app);
  const canvas = app.element("waveCanvas");
  const first = pointerPoint(app, 0.2, 0.2);
  const last = pointerPoint(app, 0.7, 0.7);
  for (const cancel of [
    () => canvas.trigger("pointercancel", { pointerId: 1 }),
    () => canvas.releasePointerCapture(1),
    () => app.blur(),
  ]) {
    canvas.trigger("pointerdown", first);
    canvas.trigger("pointermove", last);
    cancel();
    assert.equal(app.evaluate("activeDrag"), null);
    assert.equal(app.evaluate("plot.selectionBox"), null);
    assert.equal(app.evaluate("visibleSeconds"), 0.1);
    assert.equal(app.evaluate("buildPlotSource().yRange.min"), -100);
    assert.equal(app.evaluate("displayPaused"), false);
    assert.equal(canvas.hasPointerCapture(1), false);
  }
  // A second pointer must not take ownership or commit the first selection.
  canvas.trigger("pointerdown", first);
  canvas.trigger("pointerdown", { ...last, pointerId: 2 });
  canvas.trigger("pointerup", { ...last, pointerId: 2 });
  assert.equal(app.evaluate("activeDrag.pointerId"), 1);
  device.emit(frame(0, 900000, 100000, protocol.FRAME_FLAGS.streamStart, 123));
  await tick();
  assert.equal(app.evaluate("activeDrag"), null);
  assert.equal(app.evaluate("plot.selectionBox"), null);
  canvas.trigger("pointerup", last);
  assert.equal(app.state().availableSamples, 256);
  assert.equal(app.evaluate("visibleSeconds"), 0.1);
});

test("a rectangle wholly inside a missing-data gap cannot zoom an invented interval", async (t) => {
  const app = appHarness(t);
  const device = await gestureCapture(app, 1);
  device.emit(frame(2, 120000, 100000, protocol.FRAME_FLAGS.gapBefore, 200));
  await tick();
  app.evaluate("visibleSeconds=0.1; plot.draw(buildPlotSource())");
  const canvas = app.element("waveCanvas");
  const first = pointerPoint(app, 0.3, 0.2);
  const last = pointerPoint(app, 0.7, 0.8);
  canvas.trigger("pointerdown", first);
  canvas.trigger("pointermove", last);
  canvas.trigger("pointerup", last);
  assert.equal(app.evaluate("visibleSeconds"), 0.1);
  assert.equal(app.evaluate("buildPlotSource().visibleSamples"), 512);
  assert.equal(app.evaluate("buildPlotSource().yRange.min"), -100);
});

test("oldest view clamp uses measured device time rather than the advertised sample rate", async (t) => {
  const app = appHarness(t);
  await gestureCapture(app, 1000);
  app.evaluate("visibleSeconds=2;viewOffsetSamples=1000000;clampViewOffset();plot.draw(buildPlotSource())");
  const source = app.evaluate("buildPlotSource()");
  assert.ok(source.windowInfo.startSerial <= 1);
  assert.ok(source.windowInfo.endSerial < 147000);
  assert.ok(app.evaluate("viewOffsetSamples") > 100000);
  assert.ok(Math.abs(source.timeEnd - source.timeStart - 2) < 0.00002);
});

test("plot hit testing and selection use actual CSS-to-bitmap scale on a small high-DPR canvas", async (t) => {
  const app = appHarness(t);
  await gestureCapture(app);
  globalThis.window.devicePixelRatio = 2;
  t.after(() => { globalThis.window.devicePixelRatio = 1; });
  const canvas = app.element("waveCanvas");
  canvas.rect = { width: 250, height: 100, left: 20, top: 30 };
  app.evaluate("plot.draw(buildPlotSource())");
  assert.equal(app.evaluate("plot.width"), 500);
  assert.equal(app.evaluate("plot.height"), 240);
  const before = app.evaluate("buildPlotSource()");
  const point = pointerPoint(app, 0.4, 0.5);
  assert.ok(Math.abs(app.evaluate(`plot.clientXToPlotRatio(${point.clientX})`) - 0.4) < 1e-12);
  assert.ok(Math.abs(app.evaluate(`plot.clientYToValue(${point.clientY})`)) < 1e-12);
  const first = pointerPoint(app, 0.1, 0.1);
  const last = pointerPoint(app, 0.9, 0.9);
  const startSerial = before.windowInfo.startSerial + before.timeToOffset(before.timeStart + 0.1 * (before.timeEnd - before.timeStart));
  canvas.trigger("pointerdown", first);
  canvas.trigger("pointermove", last);
  canvas.trigger("pointerup", last);
  assert.equal(app.evaluate("buildPlotSource().windowInfo.startSerial"), startSerial);
  assert.ok(Math.abs(app.evaluate("buildPlotSource().yRange.min") + 80) < 1e-9);
  assert.ok(Math.abs(app.evaluate("buildPlotSource().yRange.max") - 80) < 1e-9);
});

test("complete app startup renders and START only enters RUNNING after a complete ACK", async (t) => {
  const app = appHarness(t);
  assert.ok(app.renderCalls > 0);
  assert.equal(app.element("connectBtn").disabled, false);
  const device = new UsbDevice();
  await app.connect(device);
  const respond = device.onCommand;
  device.onCommand = (command) => command === "START" ? undefined : respond(command);
  const action = app.element("startBtn").trigger("click");
  await tick();
  assert.equal(device.writes.at(-1), "START");
  assert.equal(app.state().state, "IDLE");
  assert.equal(app.element("startBtn").disabled, true);
  device.emit("O");
  await tick();
  assert.equal(app.state().state, "IDLE");
  device.emit("K\n");
  await action;
  assert.equal(app.state().state, "RUNNING");
  assert.equal(app.element("stateValue").textContent, "采集中");
  assert.equal(app.element("startBtn").disabled, false);
});

test("background diagnostics preserve unsubmitted calibration and surface timing faults", async (t) => {
  const app = appHarness(t);
  const device = new UsbDevice();
  await app.connect(device);
  app.element("zeroLowUaInput").value = "123";
  app.element("senseLowOhmInput").value = "1.234";
  device.onCommand = () => "STATUS state=IDLE srate=100000 zero1=0 sense1_mohm=1000 adc_errors=2 timing_overruns=3\n";
  app.evaluate("nextStatusPollAt = 0; animationLoop(3000)");
  await tick();
  assert.equal(app.element("zeroLowUaInput").value, "123");
  assert.equal(app.element("senseLowOhmInput").value, "1.234");
  app.evaluate("updateStats()");
  assert.match(app.element("modeValue").textContent, /读取超时 2/);
  assert.match(app.element("modeValue").textContent, /时序超限 3/);
});

test("zero calibration without captured data does not overwrite device settings", async (t) => {
  const app = appHarness(t);
  const device = new UsbDevice();
  await app.connect(device);
  const previousWrites = device.writes.length;
  await app.element("zeroNowBtn").trigger("click");
  assert.equal(device.writes.length, previousWrites);
  assert.match(app.element("logOutput").textContent, /先采集空载数据/);
});

test("zero calibration never substitutes samples from the other current range", async (t) => {
  const app = appHarness(t);
  const device = new UsbDevice();
  await app.connect(device);
  await app.element("startBtn").trigger("click");
  device.emit(frame(0,10000,100000,protocol.FRAME_FLAGS.streamStart | protocol.FRAME_FLAGS.range10Ohm));
  await tick();
  app.evaluate("currentRangeOhm = 1");
  const writes = device.writes.length;
  await app.element("zeroNowBtn").trigger("click");
  assert.equal(device.writes.length,writes);
  assert.match(app.element("logOutput").textContent,/没有当前量程的有效数据/);
});

test("START ERR and USB stall never advertise successful capture", async (t) => {
  for (const outcome of ["ERR ADC\n", { status: "stall", bytesWritten: 0 }]) {
    await t.test(typeof outcome === "string" ? "device error" : "USB stall", async (t) => {
      const app = appHarness(t);
      const device = new UsbDevice();
      await app.connect(device);
      const respond = device.onCommand;
      device.onCommand = (command) => command === "START" ? outcome : respond(command);
      await app.element("startBtn").trigger("click");
      assert.notEqual(app.state().state, "RUNNING");
      assert.equal(app.state().acceptFrames, false);
      assert.equal(app.state().actionBusy, false);
      assert.doesNotMatch(app.element("logOutput").textContent, /开始采集。/);
      if (typeof outcome === "string") assert.match(app.element("logOutput").textContent, /ERR ADC/);
      else assert.equal(app.state().connected, false);
    });
  }
});

test("sample-rate UI waits for confirmation and creates a fresh sequence/time segment", async (t) => {
  const app = appHarness(t);
  const device = new UsbDevice();
  await app.connect(device);
  await app.element("startBtn").trigger("click");
  device.emit(frame(65400, 100000, 100000, protocol.FRAME_FLAGS.streamStart));
  device.emit(frame(65401, 102560));
  await tick();
  assert.equal(app.state().availableSamples, 512);
  device.onCommand = (command) => command === "SRATE 10000" ? undefined : "OK\n";
  app.element("sampleRateSelect").value = "10000";
  const action = app.element("sampleRateSelect").trigger("change");
  await tick();
  assert.equal(device.writes.at(-1), "SRATE 10000");
  assert.equal(app.state().sampleRate, 100000);
  assert.equal(app.state().availableSamples, 512);
  device.emit("OK\n");
  await action;
  assert.equal(app.state().sampleRate, 10000);
  assert.equal(app.state().availableSamples, 0);
  device.emit(frame(0, 500000, 10000, protocol.FRAME_FLAGS.streamStart));
  device.emit(frame(1, 525600, 10000));
  await tick();
  assert.equal(app.state().droppedFrames, 0);
  assert.equal(app.state().availableSamples, 512);
  const source = app.evaluate("buildPlotSource()");
  assert.equal(source.readVisibleTime(256), 0.0256);
  assert.equal(source.sampleRate, 10000);
});

test("frame gaps reach the real plot source, cursor labels and exported CSV", async (t) => {
  const app = appHarness(t);
  const device = new UsbDevice();
  await app.connect(device);
  await app.element("startBtn").trigger("click");
  device.emit(frame(0, 1000000, 100000, protocol.FRAME_FLAGS.streamStart, 100));
  device.emit(frame(2, 1020000, 100000, protocol.FRAME_FLAGS.gapBefore, 200));
  await tick();
  const source = app.evaluate("buildPlotSource()");
  assert.equal(source.readVisibleTime(256), 0.02);
  assert.equal(source.timeSegments.length, 2);
  assert.equal(source.timeSegments[0].endOffset, 256);
  assert.equal(source.timeSegments[1].startOffset, 256);
  assert.equal(app.state().droppedFrames, 1);
  app.evaluate("cursorEnabled = true; cursors.a.serial = 0; cursors.b.serial = 256; updateCursorPanel(buildPlotSource())");
  assert.match(app.element("cursorTimeValue").textContent, /20\.000 ms \/ 50\.00 Hz/);
  app.element("exportCsvBtn").trigger("click");
  const rows = (await app.downloads.at(-1).text()).split("\n");
  assert.equal(rows[257].split(",")[1], "0.020000000");
  assert.equal(rows[256].split(",")[1], "0.002550000");
  app.evaluate("animationLoop(1200)");
  assert.equal(app.element("droppedValue").textContent, "1");

  device.emit(frame(0, 2000000, 100000, protocol.FRAME_FLAGS.streamStart, 300));
  await tick();
  assert.equal(app.state().availableSamples, 256);
  assert.equal(app.state().droppedFrames, 0);
  assert.equal(app.evaluate("buildPlotSource().readVisibleTime(0)"), 0);
});

test("timing overruns retain a continuous waveform, measured CSV times and every envelope sample", async (t) => {
  const app = appHarness(t);
  const device = new UsbDevice();
  device.onCommand = (command) => command === "GET_STATUS"
    ? "STATUS state=IDLE srate=100000 range=10 fw=0.2.0 adc_errors=0 timing_overruns=100\n" : "OK\n";
  await app.connect(device);
  await app.element("startBtn").trigger("click");
  // Reproduce the legacy firmware's repeated timing flags with no lost frame.
  for(let seq=0;seq<27;seq++) {
    const flags=protocol.FRAME_FLAGS.range10Ohm |
      (seq===0 ? protocol.FRAME_FLAGS.streamStart : protocol.FRAME_FLAGS.gapBefore);
    device.emit(frame(seq,1000000+seq*3480,100000,flags,100+seq));
  }
  await tick();
  const source=app.evaluate("buildPlotSource()");
  assert.equal(source.visibleSamples,27*256);
  assert.equal(source.timeSegments.length,1);
  assert.equal(app.state().droppedFrames,0);
  assert.ok(Math.abs(source.readVisibleTime(256)-0.00348)<1e-12);
  app.evaluate("animationLoop(1200)");
  const buckets=app.evaluate("plot.bucketCache.buckets");
  assert.equal(buckets.reduce((sum,bucket)=>sum+bucket.count,0),source.visibleSamples);
  assert.equal(new Set(buckets.map(bucket=>bucket.segment)).size,1);
  for(let i=1;i<buckets.length;i++) assert.equal(buckets[i].x,buckets[i-1].x+1);
  app.element("exportCsvBtn").trigger("click");
  const rows=(await app.downloads.at(-1).text()).split("\n");
  assert.equal(rows[257].split(",")[1],"0.003480000");
  assert.ok(Number(rows[256].split(",")[1])>0.00346);

  // A later genuine loss must still break a timing-impaired stream.
  device.emit(frame(28,1100000,100000,protocol.FRAME_FLAGS.gapBefore,300));
  await tick();
  assert.equal(app.evaluate("buildPlotSource().timeSegments.length"),2);
  assert.equal(app.state().droppedFrames,1);
});

test("ADC-error diagnostics never treat a missing-sample marker as legacy timing jitter", async (t) => {
  const app=appHarness(t);
  const device=new UsbDevice();
  device.onCommand=(command)=>command==="GET_STATUS"
    ? "STATUS state=IDLE srate=100000 range=10 adc_errors=1 timing_overruns=100\n" : "OK\n";
  await app.connect(device);
  await app.element("startBtn").trigger("click");
  device.emit(frame(0,1000000,100000,protocol.FRAME_FLAGS.streamStart));
  device.emit(frame(1,1003480,100000,protocol.FRAME_FLAGS.gapBefore));
  await tick();
  assert.equal(app.evaluate("buildPlotSource().timeSegments.length"),2);
});

test("rejected rate-change STOP keeps the existing capture and confirmed rate", async (t) => {
  const app = appHarness(t);
  const device = new UsbDevice();
  await app.connect(device);
  await app.element("startBtn").trigger("click");
  device.emit(frame(0, 100000, 100000, protocol.FRAME_FLAGS.streamStart));
  await tick();
  device.onCommand = (command) => command === "STOP" ? "ERR BUSY\n" : "OK\n";
  app.element("sampleRateSelect").value = "10000";
  await app.element("sampleRateSelect").trigger("change");
  assert.equal(app.state().state, "RUNNING");
  assert.equal(app.state().sampleRate, 100000);
  assert.equal(app.element("sampleRateSelect").value, "100000");
  device.emit(frame(1, 102560));
  await tick();
  assert.equal(app.state().availableSamples, 512, "an unsuccessful STOP must not silently discard the still-running stream");
});

test("accepted new rate remains displayed if restarting capture is rejected", async (t) => {
  const app = appHarness(t);
  const device = new UsbDevice();
  await app.connect(device);
  await app.element("startBtn").trigger("click");
  device.onCommand = (command) => command === "START" ? "ERR ADC\n" : "OK\n";
  app.element("sampleRateSelect").value = "10000";
  await app.element("sampleRateSelect").trigger("change");
  assert.equal(app.state().state, "IDLE");
  assert.equal(app.state().acceptFrames, false);
  assert.equal(app.state().sampleRate, 10000);
  assert.equal(app.element("sampleRateSelect").value, "10000", "SRATE was acknowledged even though START failed");
});

test("an old pending USB read cannot mutate or close a new connection", async (t) => {
  const app = appHarness(t);
  const oldDevice = new UsbDevice();
  oldDevice.keepReadPendingOnClose = true;
  await app.connect(oldDevice);
  await app.evaluate("cleanupDevice()");
  assert.equal(oldDevice.reads.length, 1);
  const newDevice = new UsbDevice();
  await app.connect(newDevice);
  oldDevice.emit("STATUS state=FAULT fw=old\n");
  await tick();
  assert.equal(app.state().connected, true);
  assert.equal(app.state().state, "IDLE");
  assert.equal(app.element("firmwareValue").textContent, "test");
  assert.equal(newDevice.closeCount, 0);
  await app.element("startBtn").trigger("click");
  assert.equal(app.state().state, "RUNNING");
});

test("partial STATUS response updates UI only after newline and preserves every field", async (t) => {
  const app = appHarness(t);
  const device = new UsbDevice();
  device.onCommand = () => undefined;
  app.enqueueDevice(device);
  const action = app.element("connectBtn").trigger("click");
  await tick();
  assert.equal(device.writes.at(-1), "GET_STATUS");
  device.emit("STATUS state=IDLE srate=20000 range=1 zero1=321 zero10=");
  await tick();
  assert.equal(app.state().sampleRate, 100000);
  assert.equal(app.element("zeroLowUaInput").value, "0");
  device.emit("654 sense1_mohm=1003 sense10_mohm=9980 auto_range=0 fw=split\n");
  await action;
  assert.equal(app.state().sampleRate, 20000);
  assert.equal(app.element("sampleRateSelect").value, "20000");
  assert.ok(Math.abs(Number(app.element("zeroLowUaInput").value)-321*50000/65536/1.003)<0.001);
  assert.ok(Math.abs(Number(app.element("zeroHighUaInput").value)-654*50000/65536/9.98)<0.001);
  assert.equal(app.evaluate("calibration().zeroLowCode"),321);
  assert.equal(app.evaluate("calibration().zeroHighCode"),654);
  assert.equal(app.element("senseLowOhmInput").value, "1.003");
  assert.equal(app.element("senseHighOhmInput").value, "9.98");
  assert.equal(app.element("manualRangeSelect").value, "1");
  assert.equal(app.element("autoRangeToggle").checked, false);
  assert.equal(app.element("firmwareValue").textContent, "split");
});

test("µA calibration presents device offsets and writes the same ADC integers back", async (t) => {
  const app=appHarness(t);
  const device=new UsbDevice();
  device.onCommand=(command)=>command==="GET_STATUS"
    ? "STATUS state=IDLE srate=100000 range=10 zero1=321 zero10=654 sense1_mohm=1003 sense10_mohm=9980\n" : "OK\n";
  await app.connect(device);
  await app.element("applyCalBtn").trigger("click");
  assert.ok(device.writes.includes("SET_ZERO_CODE_RANGE 1 321"));
  assert.ok(device.writes.includes("SET_ZERO_CODE_RANGE 10 654"));
  assert.ok(device.writes.includes("SET_SENSE_MOHM_RANGE 1 1003"));
  assert.ok(device.writes.includes("SET_SENSE_MOHM_RANGE 10 9980"));
  assert.match(app.element("largeRangeValue").textContent,/µA$/);
  assert.match(app.element("smallRangeValue").textContent,/µA$/);
});

test("changing sense resistance re-expresses the µA zero offset without changing its ADC calibration", async (t) => {
  const app=appHarness(t);
  const device=new UsbDevice();
  device.onCommand=(command)=>command==="GET_STATUS"
    ? "STATUS state=IDLE srate=100000 range=10 zero1=143 zero10=764 sense1_mohm=1000 sense10_mohm=10000\n" : "OK\n";
  await app.connect(device);
  const before=Number(app.element("zeroHighUaInput").value);
  app.element("senseHighOhmInput").value="20.0004";
  app.element("senseHighOhmInput").trigger("input");
  assert.equal(app.element("senseHighOhmInput").value,"20.0004", "typing resistance must not reset the input before commit");
  assert.ok(Math.abs(Number(app.element("zeroHighUaInput").value)-before/2)<0.001);
  app.element("senseHighOhmInput").trigger("change");
  assert.equal(app.element("senseHighOhmInput").value,"20");
  assert.ok(Math.abs(Number(app.element("zeroHighUaInput").value)-before/2)<0.001);
  assert.equal(app.evaluate("calibration().zeroHighCode"),764);
  await app.element("applyCalBtn").trigger("click");
  assert.ok(device.writes.includes("SET_ZERO_CODE_RANGE 10 764"));
  assert.ok(device.writes.includes("SET_SENSE_MOHM_RANGE 10 20000"));
});

test("µA offset editing clamps ADC limits and empty-load zeroing retains exact calibration", async (t) => {
  const app=appHarness(t);
  const device=new UsbDevice();
  await app.connect(device);
  app.element("zeroLowUaInput").value="-100";
  app.element("zeroLowUaInput").trigger("change");
  app.element("zeroHighUaInput").value="999999";
  app.element("zeroHighUaInput").trigger("change");
  assert.equal(app.evaluate("calibration().zeroLowCode"),0);
  assert.equal(app.evaluate("calibration().zeroHighCode"),65535);
  await app.element("startBtn").trigger("click");
  device.emit(frame(0,10000,100000,protocol.FRAME_FLAGS.streamStart|protocol.FRAME_FLAGS.range10Ohm,143));
  await tick();
  await app.element("zeroNowBtn").trigger("click");
  assert.equal(app.evaluate("calibration().zeroHighCode"),143);
  assert.ok(Math.abs(Number(app.element("zeroHighUaInput").value)-143*50000/65536/10)<0.001);
  assert.ok(device.writes.includes("SET_ZERO_CODE_RANGE 10 143"));
});

test("current readouts, cursors and exported data expose µA without ADC-code columns", async (t) => {
  const app=appHarness(t);
  const device=new UsbDevice();
  await app.connect(device);
  await app.element("startBtn").trigger("click");
  device.emit(frame(0,10000,100000,protocol.FRAME_FLAGS.streamStart|protocol.FRAME_FLAGS.range10Ohm,143));
  await tick();
  app.evaluate("cursorEnabled=true; cursors.a.serial=0; cursors.b.serial=100; animationLoop(1200)");
  for(const name of ["currentValue","metricNow","metricAvg","metricPp","metricRms","cursorAValue","cursorBValue","cursorDeltaValue","cursorLabel"]) {
    assert.match(app.element(name).textContent,/µA/);
    assert.doesNotMatch(app.element(name).textContent,/code/i);
  }
  app.element("exportCsvBtn").trigger("click");
  const csv=await app.downloads.at(-1).text();
  assert.equal(csv.split("\n")[0],"index,time_s,range_ohm,current_uA");
  assert.equal(csv.split("\n")[1].split(",").length,4);
});

test("selectable low-pass shares samples with plot, cursors, statistics and CSV while preserving raw export", async (t) => {
  const app = appHarness(t);
  const device = new UsbDevice();
  await app.connect(device);
  await app.element("startBtn").trigger("click");
  for (let seq = 0; seq < 4; seq += 1) {
    const packet = frame(seq, 100000 + seq * 3500, 100000, seq === 0 ? protocol.FRAME_FLAGS.streamStart : 0);
    const data = new DataView(packet.buffer);
    for (let i = 0; i < 256; i += 1) data.setUint16(16 + i * 2, i % 2 ? 1000 : 100, true);
    device.emit(packet);
  }
  await tick();
  app.element("exportCsvBtn").trigger("click");
  const rawCsv = await app.downloads.at(-1).text();
  const raw = app.evaluate("buildPlotSource()");
  app.element("lowpassCutoffSelect").value = "100";
  app.element("lowpassCutoffSelect").trigger("change");
  app.element("lowpassToggle").checked = true;
  app.element("lowpassToggle").trigger("change");
  const filtered = app.evaluate("buildPlotSource()");
  assert.equal(filtered.visibleSamples, raw.visibleSamples);
  assert.ok(filtered.stats.rms < raw.stats.rms * 0.25);
  assert.equal(filtered.stats.last, filtered.readVisibleSample(filtered.visibleSamples - 1));
  assert.equal(filtered.rawStats.rms, raw.stats.rms);
  assert.equal(filtered.smoothDisplay, false);
  assert.equal(app.element("metricRmsLabel").textContent, "低通 RMS");
  assert.equal(app.element("rawRmsValue").textContent, `${raw.stats.rms.toFixed(3)} µA`);
  app.evaluate("cursorEnabled=true; cursors.a.serial=100; cursors.b.serial=500; updateCursorPanel(buildPlotSource())");
  assert.match(app.element("cursorAValue").textContent, new RegExp(`${filtered.readVisibleSample(100).toFixed(3)} µA`));
  app.element("exportCsvBtn").trigger("click");
  const rows = (await app.downloads.at(-1).text()).split("\n");
  assert.equal(rows[0], "index,time_s,range_ohm,current_uA,raw_current_uA,lowpass_cutoff_hz");
  const point = rows[101].split(",");
  assert.equal(Number(point[3]), Number(filtered.readVisibleSample(100).toFixed(6)));
  assert.equal(Number(point[4]), Number(raw.readVisibleSample(100).toFixed(6)));
  assert.equal(Number(point[5]), 100);
  app.element("exportRawCsvBtn").trigger("click");
  assert.equal(await app.downloads.at(-1).text(), rawCsv);
  app.element("lowpassToggle").checked = false;
  app.element("lowpassToggle").trigger("change");
  const restored = app.evaluate("buildPlotSource()");
  assert.equal(restored.stats.rms, raw.stats.rms);
  assert.equal(restored.readVisibleSample(101), raw.readVisibleSample(101));
  assert.equal(app.element("exportRawCsvBtn").hidden, true);
});

test("custom cutoff validates frequency, reprocesses paused history and resets on a new capture", async (t) => {
  const app = appHarness(t);
  const device = new UsbDevice();
  await app.connect(device);
  await app.element("startBtn").trigger("click");
  device.emit(frame(0, 100000, 10000, protocol.FRAME_FLAGS.streamStart, 100));
  device.emit(frame(1, 125600, 10000, 0, 1000));
  await tick();
  app.element("lowpassToggle").checked = true;
  app.element("lowpassToggle").trigger("change");
  app.element("pauseViewBtn").trigger("click");
  app.element("lowpassCutoffSelect").value = "20000";
  app.element("lowpassCutoffSelect").trigger("change");
  assert.match(app.element("filterStateValue").textContent, /4.5 kHz.*受采样率限制/);
  app.element("lowpassCutoffSelect").value = "custom";
  app.element("lowpassCutoffSelect").trigger("change");
  assert.equal(app.element("lowpassCustomField").hidden, false);
  assert.equal(app.element("lowpassCutoffInput").disabled, false);
  app.element("lowpassCutoffInput").value = "0";
  app.element("lowpassCutoffInput").trigger("change");
  assert.equal(app.element("lowpassCutoffInput").value, "1");
  const slow = app.evaluate("buildPlotSource()");
  const slowValue = slow.readVisibleSample(257);
  app.element("lowpassCutoffInput").value = "1000";
  app.element("lowpassCutoffInput").trigger("change");
  const fast = app.evaluate("buildPlotSource()");
  assert.ok(fast.readVisibleSample(257) > slowValue);
  assert.equal(app.evaluate("displayPaused"), true);
  assert.equal(app.state().availableSamples, 512);
  device.emit(frame(0, 500000, 10000, protocol.FRAME_FLAGS.streamStart, 200));
  await tick();
  const restarted = app.evaluate("buildPlotSource()");
  assert.equal(restarted.visibleSamples, 256);
  assert.equal(restarted.stats.rms, 0);
  assert.equal(restarted.readVisibleSample(0), restarted.readRawSample(0));
});

test("low-pass zero calibration still uses the raw ADC mean", async (t) => {
  const app = appHarness(t);
  const device = new UsbDevice();
  await app.connect(device);
  await app.element("startBtn").trigger("click");
  const packet = frame(0, 100000, 100000, protocol.FRAME_FLAGS.streamStart);
  const data = new DataView(packet.buffer);
  for (let i = 0; i < 256; i += 1) data.setUint16(16 + i * 2, i % 2 ? 1000 : 100, true);
  device.emit(packet);
  await tick();
  app.element("lowpassCutoffSelect").value = "100";
  app.element("lowpassCutoffSelect").trigger("change");
  app.element("lowpassToggle").checked = true;
  app.element("lowpassToggle").trigger("change");
  assert.notEqual(Math.round(app.evaluate("buildPlotSource().stats.avgCode")), 550);
  await app.element("zeroNowBtn").trigger("click");
  assert.ok(device.writes.includes("SET_ZERO_CODE_RANGE 1 550"));
});

function energySnapshot(app) {
  return app.evaluate("energyStatistics.snapshot(measurementVoltageV)");
}

function closeEnergy(actual, expected, label) {
  const tolerance = Math.max(1e-12, Math.abs(expected) * 1e-10);
  assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance,
    `${label}: expected ${expected}, received ${actual}`);
}

function setEnergyVoltage(app, value) {
  app.element("measurementVoltageInput").value = value;
  app.element("measurementVoltageInput").trigger("change");
}

async function energyCapture(t, voltage = "3.3") {
  const app = appHarness(t);
  const device = new UsbDevice();
  await app.connect(device);
  if (voltage !== null) setEnergyVoltage(app, voltage);
  await app.element("startBtn").trigger("click");
  return { app, device };
}

test("energy requires an explicitly entered voltage rather than a guessed supply voltage", async (t) => {
  const { app, device } = await energyCapture(t, null);
  assert.equal(app.element("measurementVoltageInput").value, "");
  assert.equal(app.evaluate("measurementVoltageV"), null);
  device.emit(frame(0, 100000, 100000, protocol.FRAME_FLAGS.streamStart, 100));
  await tick();
  app.evaluate("updateEnergyStats()");
  const snapshot = energySnapshot(app);
  assert.equal(snapshot.count, 256);
  assert.equal(snapshot.energyJoules, null);
  assert.equal(snapshot.averageWatts, null);
  assert.equal(snapshot.lastWatts, null);
  for (const id of ["metricPower", "metricEnergy", "powerNowValue", "powerAvgValue", "energyJValue", "energyWhValue"]) {
    assert.doesNotMatch(app.element(id).textContent, /\d+(?:\.\d+)?\s*(?:J|Wh|W)\b/,
      "an unset voltage must not present a numerical power or energy estimate");
  }
});

test("constant raw current integrates in SI units and revises provisional frame duration from device timestamps", async (t) => {
  const { app, device } = await energyCapture(t);
  const currentUa = 100 * 50000 / 65536;
  device.emit(frame(0, 100000, 100000, protocol.FRAME_FLAGS.streamStart, 100));
  await tick();
  let snapshot = energySnapshot(app);
  closeEnergy(snapshot.durationSeconds, 0.00256, "first frame duration");
  closeEnergy(snapshot.chargeMicroampSeconds, currentUa * 0.00256, "first frame charge");
  closeEnergy(snapshot.energyJoules, currentUa * 1e-6 * 3.3 * 0.00256, "first frame joules");
  device.emit(frame(1, 103500, 100000, protocol.FRAME_FLAGS.timingOverrun, 100));
  await tick();
  app.evaluate("updateEnergyStats()");
  snapshot = energySnapshot(app);
  assert.equal(snapshot.count, 512);
  closeEnergy(snapshot.durationSeconds, 0.007, "two measured frame durations");
  closeEnergy(snapshot.chargeMicroampSeconds, currentUa * 0.007, "corrected charge");
  closeEnergy(snapshot.energyJoules, currentUa * 1e-6 * 3.3 * 0.007, "corrected joules");
  closeEnergy(snapshot.averageWatts, currentUa * 1e-6 * 3.3, "average watts");
  closeEnergy(snapshot.lastWatts, currentUa * 1e-6 * 3.3, "instantaneous watts");
  assert.equal(snapshot.gapCount, 0);
  for (const id of ["metricPower", "powerNowValue", "powerAvgValue"]) assert.match(app.element(id).textContent, /W\b/);
  assert.match(app.element("energyJValue").textContent, /J\b/);
  assert.match(app.element("energyWhValue").textContent, /Wh\b/);
});

test("energy uses raw acquisition rather than the low-pass curve or the displayed window", async (t) => {
  const { app, device } = await energyCapture(t);
  device.emit(frame(0, 100000, 100000, protocol.FRAME_FLAGS.streamStart, 100));
  device.emit(frame(1, 103500, 100000, protocol.FRAME_FLAGS.timingOverrun, 1000));
  await tick();
  app.evaluate("updateEnergyStats()");
  const before = energySnapshot(app);
  const powerBefore = app.element("metricPower").textContent;
  const expectedCharge = (100 + 1000) * 50000 / 65536 * 0.0035;
  closeEnergy(before.chargeMicroampSeconds, expectedCharge, "raw step charge");
  closeEnergy(before.energyJoules, expectedCharge * 3.3e-6, "raw step energy");
  app.element("lowpassCutoffSelect").value = "10";
  app.element("lowpassCutoffSelect").trigger("change");
  app.element("lowpassToggle").checked = true;
  app.element("lowpassToggle").trigger("change");
  assert.notEqual(app.evaluate("buildPlotSource().stats.avg"), before.chargeMicroampSeconds / before.durationSeconds);
  app.element("pauseViewBtn").trigger("click");
  app.element("panLeftBtn").trigger("click");
  app.element("zoomInBtn").trigger("click");
  if (!app.evaluate("displayPaused")) app.element("pauseViewBtn").trigger("click");
  app.evaluate("updateEnergyStats()");
  assert.deepEqual(energySnapshot(app), before, "view-only controls cannot replay, trim or filter the integral");
  assert.equal(app.element("metricPower").textContent, powerBefore, "power is independent of the displayed/filtered curve");
  device.emit(frame(2, 107000, 100000, protocol.FRAME_FLAGS.timingOverrun, 200));
  await tick();
  const after = energySnapshot(app);
  assert.equal(app.evaluate("displayPaused"), true);
  assert.equal(after.count, 768, "pausing the display still receives and integrates new samples");
  closeEnergy(after.chargeMicroampSeconds, (100 + 1000 + 200) * 50000 / 65536 * 0.0035, "paused raw charge");
});

test("a real missing-data gap is excluded from energy rather than bridged with a guessed current", async (t) => {
  const { app, device } = await energyCapture(t);
  device.emit(frame(0, 100000, 100000, protocol.FRAME_FLAGS.streamStart, 100));
  device.emit(frame(2, 120000, 100000, protocol.FRAME_FLAGS.gapBefore, 200));
  await tick();
  app.evaluate("updateEnergyStats()");
  const snapshot = energySnapshot(app);
  assert.equal(snapshot.count, 512);
  assert.equal(snapshot.gapCount, 1);
  closeEnergy(snapshot.missingSeconds, 0.01744, "missing interval");
  closeEnergy(snapshot.durationSeconds, 0.00512, "captured interval only");
  closeEnergy(snapshot.energyJoules, (100 + 200) * 50000 / 65536 * 0.00256 * 3.3e-6,
    "only actual frame samples contribute energy");
  assert.match(app.element("energyGapValue").textContent, /1/);
});

test("resetting energy preserves raw waveform history and starts from only subsequent frames", async (t) => {
  const { app, device } = await energyCapture(t);
  device.emit(frame(0, 100000, 100000, protocol.FRAME_FLAGS.streamStart, 100));
  device.emit(frame(1, 103500, 100000, protocol.FRAME_FLAGS.timingOverrun, 100));
  await tick();
  const retained = app.state().availableSamples;
  const rawPoint = app.evaluate("buildPlotSource().readRawSample(0)");
  app.element("resetEnergyBtn").trigger("click");
  assert.equal(energySnapshot(app).count, 0);
  assert.ok([null, 0].includes(energySnapshot(app).energyJoules), "no pre-reset energy survives");
  assert.equal(app.state().availableSamples, retained);
  assert.equal(app.evaluate("buildPlotSource().readRawSample(0)"), rawPoint);
  device.emit(frame(2, 107000, 100000, protocol.FRAME_FLAGS.timingOverrun, 200));
  await tick();
  const snapshot = energySnapshot(app);
  assert.equal(snapshot.count, 256, "retained pre-reset frames are not replayed into energy");
  closeEnergy(snapshot.durationSeconds, 0.0035, "new frame duration");
  closeEnergy(snapshot.energyJoules, 200 * 50000 / 65536 * 0.0035 * 3.3e-6, "new frame energy");
  assert.equal(app.state().availableSamples, retained + 256);
});

test("changing the entered voltage starts a new estimate instead of retroactively rescaling earlier energy", async (t) => {
  const { app, device } = await energyCapture(t);
  device.emit(frame(0, 100000, 100000, protocol.FRAME_FLAGS.streamStart, 100));
  await tick();
  assert.ok(energySnapshot(app).energyJoules > 0);
  setEnergyVoltage(app, "5");
  assert.equal(app.evaluate("measurementVoltageV"), 5);
  assert.equal(energySnapshot(app).count, 0);
  assert.ok([null, 0].includes(energySnapshot(app).energyJoules), "new voltage has no accumulated energy yet");
  assert.equal(app.state().availableSamples, 256);
  device.emit(frame(1, 102560, 100000, 0, 200));
  await tick();
  const snapshot = energySnapshot(app);
  assert.equal(snapshot.count, 256);
  closeEnergy(snapshot.energyJoules, 200 * 50000 / 65536 * 0.00256 * 5e-6, "new voltage energy");
  setEnergyVoltage(app, "");
  assert.equal(app.evaluate("measurementVoltageV"), null);
  assert.equal(energySnapshot(app).energyJoules, null);
  assert.equal(energySnapshot(app).count, 0);
});

test("STOP and disconnect preserve the completed energy estimate without integrating wall time or late frames", async (t) => {
  const { app, device } = await energyCapture(t);
  device.emit(frame(0, 100000, 100000, protocol.FRAME_FLAGS.streamStart, 100));
  await tick();
  const before = energySnapshot(app);
  await app.element("stopBtn").trigger("click");
  device.emit(frame(1, 102560, 100000, 0, 200));
  await tick();
  app.evaluate("updateEnergyStats()");
  assert.deepEqual(energySnapshot(app), before, "STOP ignores any delayed data after its acknowledgement");
  await app.element("disconnectBtn").trigger("click");
  device.emit(frame(2, 105120, 100000, 0, 300));
  await tick();
  app.evaluate("animationLoop(5000); updateEnergyStats()");
  assert.equal(app.state().connected, false);
  assert.deepEqual(energySnapshot(app), before, "disconnected rendering cannot accumulate elapsed wall time");
});

test("a fresh stream and clearing capture discard previous energy and gap totals", async (t) => {
  const { app, device } = await energyCapture(t);
  device.emit(frame(0, 100000, 100000, protocol.FRAME_FLAGS.streamStart, 100));
  device.emit(frame(2, 120000, 100000, protocol.FRAME_FLAGS.gapBefore, 200));
  await tick();
  assert.equal(energySnapshot(app).gapCount, 1);
  device.emit(frame(0, 900000, 100000, protocol.FRAME_FLAGS.streamStart, 300));
  await tick();
  let snapshot = energySnapshot(app);
  assert.equal(snapshot.count, 256);
  assert.equal(snapshot.gapCount, 0);
  closeEnergy(snapshot.energyJoules, 300 * 50000 / 65536 * 0.00256 * 3.3e-6, "fresh stream energy");
  app.element("clearBtn").trigger("click");
  assert.equal(app.state().availableSamples, 0);
  assert.equal(energySnapshot(app).count, 0);
  assert.ok([null, 0].includes(energySnapshot(app).energyJoules), "clearing capture removes its energy");
  device.emit(frame(1, 902560, 100000, 0, 400));
  await tick();
  snapshot = energySnapshot(app);
  assert.equal(snapshot.count, 256);
  closeEnergy(snapshot.energyJoules, 400 * 50000 / 65536 * 0.00256 * 3.3e-6, "post-clear energy");
});

test("zeroing and editing current calibration reset energy while preserving waveform samples", async (t) => {
  const { app, device } = await energyCapture(t);
  device.emit(frame(0, 100000, 100000, protocol.FRAME_FLAGS.streamStart, 100));
  await tick();
  assert.ok(energySnapshot(app).energyJoules > 0);
  await app.element("zeroNowBtn").trigger("click");
  assert.equal(app.evaluate("calibration().zeroLowCode"), 100);
  assert.equal(energySnapshot(app).count, 0);
  assert.equal(app.state().availableSamples, 256);
  device.emit(frame(1, 102560, 100000, 0, 200));
  await tick();
  closeEnergy(energySnapshot(app).energyJoules, 100 * 50000 / 65536 * 0.00256 * 3.3e-6, "zero-compensated energy");
  app.element("senseLowOhmInput").value = "2";
  app.element("senseLowOhmInput").trigger("change");
  assert.equal(energySnapshot(app).count, 0);
  assert.equal(app.state().availableSamples, 512);
  device.emit(frame(2, 105120, 100000, 0, 200));
  await tick();
  assert.equal(energySnapshot(app).count, 256);
  closeEnergy(energySnapshot(app).energyJoules, 100 * 50000 / 65536 / 2 * 0.00256 * 3.3e-6,
    "new calibration applies only to subsequent integration");
});

test("device voltage is captured per frame so a later measurement cannot rescale earlier energy", async (t) => {
  const { app, device } = await energyCapture(t, null);
  assert.equal(app.element("useDeviceVoltageToggle").checked, true);
  device.emit("STATUS state=RUNNING srate=100000 range=1 auto_range=0 vout_mv=3300 vout_t_us=100000\n");
  device.emit(frame(0, 100000, 100000, protocol.FRAME_FLAGS.streamStart, 100));
  await tick();
  const currentUa = 100 * 50000 / 65536;
  const first = energySnapshot(app);
  closeEnergy(first.energyJoules, currentUa * 0.00256 * 3.3e-6, "first measured-voltage energy");
  device.emit("STATUS state=RUNNING srate=100000 range=1 auto_range=0 vout_mv=3100 vout_t_us=102560\n");
  device.emit(frame(1, 102560, 100000, 0, 100));
  await tick();
  app.evaluate("updateEnergyStats()");
  const second = energySnapshot(app);
  assert.equal(second.count, 512);
  closeEnergy(second.energyDurationSeconds, 0.00512, "both frames have voltage coverage");
  closeEnergy(second.voltageMissingSeconds, 0, "no voltage samples were missing");
  closeEnergy(second.energyJoules, currentUa * 0.00256 * (3.3 + 3.1) * 1e-6,
    "sum of individually captured frame voltage and charge");
  closeEnergy(second.lastWatts, currentUa * 3.1e-6, "latest power uses latest measured voltage");
  assert.ok(Math.abs(second.energyJoules - currentUa * 0.00512 * 3.1e-6) > 1e-9,
    "latest voltage must not be applied to all historical current");
});

test("energy summary CSV states SI units and its manual voltage/raw-current estimate sources", async (t) => {
  const { app, device } = await energyCapture(t);
  device.emit(frame(0, 100000, 100000, protocol.FRAME_FLAGS.streamStart, 100));
  await tick();
  app.element("exportEnergyBtn").trigger("click");
  const csv = await app.downloads.at(-1).text();
  const [header, row, ...extraRows] = csv.trim().split(/\r?\n/);
  assert.equal(extraRows.length, 0, "a cumulative summary contains one snapshot row");
  const fields = header.replace(/^\uFEFF/, "").split(",");
  assert.deepEqual(fields, ["voltage_source", "current_source", "estimated", "voltage_V", "power_now_W",
    "power_average_W", "energy_J", "energy_Wh", "duration_s", "energy_duration_s", "sample_count", "gap_count",
    "missing_s", "voltage_missing_s"]);
  const cells = row.split(",");
  assert.equal(cells.length, fields.length);
  const summary = Object.fromEntries(fields.map((field, index) => [field, cells[index]]));
  assert.equal(summary.voltage_source, "manual_constant");
  assert.equal(summary.current_source, "raw_calibrated");
  assert.equal(summary.estimated, "true");
  assert.equal(Number(summary.voltage_V), 3.3);
  assert.equal(Number(summary.sample_count), 256);
  assert.equal(Number(summary.gap_count), 0);
  const snapshot = energySnapshot(app);
  for (const [field, expected] of [["power_now_W", snapshot.lastWatts], ["power_average_W", snapshot.averageWatts],
    ["energy_J", snapshot.energyJoules], ["energy_Wh", snapshot.energyJoules / 3600],
    ["duration_s", snapshot.durationSeconds], ["energy_duration_s", snapshot.energyDurationSeconds],
    ["missing_s", 0], ["voltage_missing_s", 0]]) {
    closeEnergy(Number(summary[field]), expected, `CSV ${field}`);
  }
});

test("voltage selection survives timer rollover and never applies a future voltage to queued frames", async (t) => {
  const { app, device } = await energyCapture(t, null);
  device.emit("STATUS state=RUNNING vout_mv=3300 vout_t_us=4294965000\n");
  device.emit(frame(0, 4294966000, 100000, protocol.FRAME_FLAGS.streamStart, 100));
  device.emit("STATUS state=RUNNING vout_mv=3100 vout_t_us=3000\n");
  device.emit(frame(1, 1264, 100000, 0, 100));
  device.emit(frame(2, 3824, 100000, 0, 100));
  await tick();
  const stats = energySnapshot(app);
  closeEnergy(stats.energyJoules, 100 * 50000 / 65536 * 0.00256 * (3.3 + 3.3 + 3.1) * 1e-6,
    "the queued second frame uses the older valid voltage");
  assert.equal(stats.voltageMissingCount, 0);
});

test("expired voltage excludes energy coverage while a genuine zero-volt measurement remains valid", async (t) => {
  const { app, device } = await energyCapture(t, null);
  device.emit("STATUS state=RUNNING vout_mv=3300 vout_t_us=1000000\n");
  device.emit(frame(0, 2600001, 100000, protocol.FRAME_FLAGS.streamStart, 100));
  await tick();
  let stats = energySnapshot(app);
  assert.equal(stats.energyJoules, null);
  assert.equal(stats.voltageMissingCount, 256);
  device.emit("STATUS state=RUNNING vout_mv=0 vout_t_us=2602561\n");
  device.emit(frame(1, 2602561, 100000, 0, 100));
  await tick();
  stats = energySnapshot(app);
  assert.equal(stats.energyJoules, 0);
  closeEnergy(stats.energyDurationSeconds, 0.00256, "zero volts still cover the new frame");
  closeEnergy(stats.voltageMissingSeconds, 0.00256, "expired interval stays excluded");
});

test("background refresh preserves manual voltage entry and rejects empty telemetry fields", async (t) => {
  const app = appHarness(t);
  const input = app.element("measurementVoltageInput");
  input.value = "3.3";
  app.evaluate("document.activeElement = dom.measurementVoltageInput; updateEnergyStats()");
  assert.equal(input.value, "3.3", "typing must not be cleared by the 100 ms UI refresh");
  input.trigger("change");
  assert.equal(app.evaluate("measurementVoltageV"), 3.3);
  app.evaluate("recordDeviceVoltage({vout_mv:'',vout_t_us:'0'})");
  assert.equal(app.evaluate("deviceVoltageHistory.length"), 0);
});

test("firmware update check survives the upstream sync and links the UF2 asset once per version", async (t) => {
  const download = "https://github.com/txp666/MicroScope-Power/releases/download/v1.1.0/pico_power_scope.uf2";
  const app = appHarness(t, { fetch: async () => ({ ok: true, json: async () => ({
    tag_name: "v1.1.0", html_url: "https://github.com/txp666/MicroScope-Power/releases/tag/v1.1.0",
    assets: [{ name: "pico_power_scope.uf2", browser_download_url: download }],
  }) }) });
  const device = new UsbDevice();
  device.onCommand = (command) => command === "GET_STATUS" ? "STATUS state=IDLE srate=100000 fw=1.0.0\n" : "OK\n";
  await app.connect(device);
  await tick();
  assert.equal(app.element("firmwareUpdateValue").textContent, "有更新 v1.1.0");
  assert.equal(app.element("firmwareUpdateValue").children[0].href, download);
  assert.equal(app.element("firmwareUpdateRow").classList.highlight, true);
  assert.equal(app.fetches[0].url, "https://api.github.com/repos/txp666/MicroScope-Power/releases/latest");
  assert.equal(app.fetches[0].options.cache, "no-store");
  device.emit("STATUS state=IDLE fw=1.0.0\n");
  await tick();
  assert.equal(app.fetches.length, 1);
  await app.element("startBtn").trigger("click");
  assert.equal(app.state().state, "RUNNING");
});

test("firmware update check falls back from missing latest release to a published release", async (t) => {
  const app = appHarness(t, { fetch: async (url) => url.endsWith("/latest")
    ? { ok: false, status: 404 }
    : { ok: true, json: async () => [
      { draft: true, tag_name: "v9.0.0" }, { draft: false, tag_name: "v1.0.0" },
    ] },
  });
  const device = new UsbDevice();
  device.onCommand = () => "STATUS state=IDLE fw=1.0.0\n";
  await app.connect(device);
  await tick();
  assert.equal(app.element("firmwareUpdateValue").textContent, "已是最新");
  assert.equal(app.fetches.length, 2);
  assert.match(app.fetches[1].url, /\/releases\?per_page=5$/);
});

test("a previous connection's firmware lookup cannot replace the new connection's result", async (t) => {
  for (const failure of [false, true]) {
    await t.test(failure ? "late failure" : "late success", async (t) => {
      let resolveOld;
      let rejectOld;
      const oldResponse = new Promise((resolve, reject) => { resolveOld = resolve; rejectOld = reject; });
      let calls = 0;
      const app = appHarness(t, { fetch: () => ++calls === 1 ? oldResponse
        : Promise.resolve({ ok: true, json: async () => ({ tag_name: "v1.0.0" }) }),
      });
      const oldDevice = new UsbDevice();
      oldDevice.onCommand = () => "STATUS state=IDLE fw=1.0.0\n";
      await app.connect(oldDevice);
      assert.equal(app.element("firmwareUpdateValue").textContent, "检查中...");
      await app.evaluate("cleanupDevice()");
      assert.equal(app.element("firmwareUpdateValue").textContent, "等待设备");
      const newDevice = new UsbDevice();
      newDevice.onCommand = oldDevice.onCommand;
      await app.connect(newDevice);
      await tick();
      assert.equal(app.element("firmwareUpdateValue").textContent, "已是最新");
      if (failure) rejectOld(new Error("old lookup failed"));
      else resolveOld({ ok: true, json: async () => ({ tag_name: "v9.0.0" }) });
      await tick();
      assert.equal(app.element("firmwareUpdateValue").textContent, "已是最新");
      assert.equal(app.element("firmwareUpdateRow").classList.highlight, false);
      assert.doesNotMatch(app.element("logOutput").textContent, /old lookup failed|发现固件更新/);
      assert.equal(app.state().connected, true);
    });
  }
});
