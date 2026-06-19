import {
  DEFAULT_CALIBRATION,
  FRAME_FLAGS,
  USB_CONFIG,
  WAVE_FRAME,
  WaveFrameParser,
  commandLine,
} from "./protocol.js";
import { WavePlot } from "./plot.js";

const SAMPLE_BUFFER_SECONDS = 10;
const MAX_SAMPLE_RATE = 100000;
const SAMPLE_CAPACITY = SAMPLE_BUFFER_SECONDS * MAX_SAMPLE_RATE;
const TIME_WINDOWS = [0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10];
const DRAW_INTERVAL_MS = 33;

const MODE_LABELS = Object.freeze({
  FAKE_RAMP: "递增计数",
  FAKE_SINE: "正弦波",
  FAKE_SQUARE: "方波",
  FAKE_PULSE: "阶跃脉冲",
  FAKE_NOISE: "随机噪声",
  ADC: "ADS8866 ADC",
});

const STATE_LABELS = Object.freeze({
  BOOT: "启动",
  USB_WAIT: "等待 USB",
  IDLE: "空闲",
  RUNNING: "采集中",
  FAULT: "故障",
});

const dom = {
  connectionLabel: document.querySelector("#connectionLabel"),
  connectBtn: document.querySelector("#connectBtn"),
  disconnectBtn: document.querySelector("#disconnectBtn"),
  startBtn: document.querySelector("#startBtn"),
  stopBtn: document.querySelector("#stopBtn"),
  sampleRateSelect: document.querySelector("#sampleRateSelect"),
  modeSelect: document.querySelector("#modeSelect"),
  timeWindowSelect: document.querySelector("#timeWindowSelect"),
  zoomInBtn: document.querySelector("#zoomInBtn"),
  zoomOutBtn: document.querySelector("#zoomOutBtn"),
  panLeftBtn: document.querySelector("#panLeftBtn"),
  panRightBtn: document.querySelector("#panRightBtn"),
  latestBtn: document.querySelector("#latestBtn"),
  autoScaleToggle: document.querySelector("#autoScaleToggle"),
  gridToggle: document.querySelector("#gridToggle"),
  cursorToggle: document.querySelector("#cursorToggle"),
  yMinInput: document.querySelector("#yMinInput"),
  yMaxInput: document.querySelector("#yMaxInput"),
  zeroCodeInput: document.querySelector("#zeroCodeInput"),
  gainInput: document.querySelector("#gainInput"),
  zeroNowBtn: document.querySelector("#zeroNowBtn"),
  applyCalBtn: document.querySelector("#applyCalBtn"),
  pauseViewBtn: document.querySelector("#pauseViewBtn"),
  clearBtn: document.querySelector("#clearBtn"),
  exportCsvBtn: document.querySelector("#exportCsvBtn"),
  exportPngBtn: document.querySelector("#exportPngBtn"),
  clearLogBtn: document.querySelector("#clearLogBtn"),
  logOutput: document.querySelector("#logOutput"),
  viewLabel: document.querySelector("#viewLabel"),
  cursorLabel: document.querySelector("#cursorLabel"),
  stateValue: document.querySelector("#stateValue"),
  sampleRateValue: document.querySelector("#sampleRateValue"),
  modeValue: document.querySelector("#modeValue"),
  seqValue: document.querySelector("#seqValue"),
  droppedValue: document.querySelector("#droppedValue"),
  usbRateValue: document.querySelector("#usbRateValue"),
  codeValue: document.querySelector("#codeValue"),
  avgValue: document.querySelector("#avgValue"),
  minMaxValue: document.querySelector("#minMaxValue"),
  ppValue: document.querySelector("#ppValue"),
  iavgValue: document.querySelector("#iavgValue"),
  iminMaxValue: document.querySelector("#iminMaxValue"),
  ippValue: document.querySelector("#ippValue"),
  cursorAValue: document.querySelector("#cursorAValue"),
  cursorBValue: document.querySelector("#cursorBValue"),
  cursorTimeValue: document.querySelector("#cursorTimeValue"),
  cursorDeltaValue: document.querySelector("#cursorDeltaValue"),
};

const ringBuffer = new Uint16Array(SAMPLE_CAPACITY);
const plot = new WavePlot(document.querySelector("#waveCanvas"));

let device = null;
let reading = false;
let writeIndex = 0;
let availableSamples = 0;
let totalSamplesWritten = 0;
let sampleRate = 50000;
let currentMode = "FAKE_RAMP";
let lastSeq = null;
let droppedFrames = 0;
let bytesReceived = 0;
let bytesWindowStart = performance.now();
let bytesAtWindowStart = 0;
let lastStats = emptyStats();
let state = "IDLE";

let visibleSeconds = 2;
let viewOffsetSamples = 0;
let displayPaused = false;
let autoScale = true;
let showGrid = true;
let cursorEnabled = false;
let nextCursorName = "a";
let activeDrag = null;
let lastDrawAt = 0;
const cursors = {
  a: { serial: null },
  b: { serial: null },
};

const parser = new WaveFrameParser({
  onFrame: handleFrame,
  onText: handleText,
});

function emptyStats() {
  return {
    last: 0,
    avg: 0,
    min: 0,
    max: 0,
    pp: 0,
    count: 0,
  };
}

function appendLog(text) {
  const now = new Date().toLocaleTimeString();
  const lines = `${dom.logOutput.textContent}${now} ${text}\n`.split("\n").slice(-100);
  dom.logOutput.textContent = lines.join("\n");
  dom.logOutput.scrollTop = dom.logOutput.scrollHeight;
}

function setConnectedUi(connected) {
  dom.connectionLabel.textContent = connected ? "已连接" : "未连接";
  dom.connectionLabel.classList.toggle("connected", connected);
  dom.connectBtn.disabled = connected;
  dom.disconnectBtn.disabled = !connected;
  dom.startBtn.disabled = !connected;
  dom.stopBtn.disabled = !connected;
  dom.zeroNowBtn.disabled = !connected;
  dom.applyCalBtn.disabled = !connected;
}

function setState(nextState) {
  state = nextState;
  dom.stateValue.textContent = STATE_LABELS[state] || state;
}

async function connectDevice() {
  if (!("usb" in navigator)) {
    appendLog("当前浏览器不支持 WebUSB，请使用 Chrome 或 Edge。");
    return;
  }

  try {
    device = await navigator.usb.requestDevice({
      filters: [{ vendorId: USB_CONFIG.vendorId }],
    });

    await device.open();
    if (!device.configuration) {
      await device.selectConfiguration(1);
    }

    await device.claimInterface(USB_CONFIG.interfaceNumber);
    await device.controlTransferOut({
      requestType: "class",
      recipient: "interface",
      request: 0x22,
      value: 1,
      index: USB_CONFIG.interfaceNumber,
    });

    resetCaptureState();
    setConnectedUi(true);
    setState("IDLE");
    appendLog(`已连接设备 VID=0x${USB_CONFIG.vendorId.toString(16)} PID=0x${USB_CONFIG.productId.toString(16)}`);
    reading = true;
    readLoop();
    sendCommand("GET_STATUS").catch((err) => appendLog(err.message));
  } catch (err) {
    appendLog(`连接失败：${err.message}`);
    await cleanupDevice();
  }
}

async function disconnectDevice() {
  try {
    await sendCommand("STOP");
  } catch {
  }
  await cleanupDevice();
}

async function cleanupDevice() {
  reading = false;

  if (device) {
    try {
      if (device.opened) {
        await device.controlTransferOut({
          requestType: "class",
          recipient: "interface",
          request: 0x22,
          value: 0,
          index: USB_CONFIG.interfaceNumber,
        });
        await device.releaseInterface(USB_CONFIG.interfaceNumber);
        await device.close();
      }
    } catch {
    }
  }

  device = null;
  parser.reset();
  setConnectedUi(false);
  setState("IDLE");
}

async function startCapture() {
  await applyCalibration(false);
  await sendCommand(`SRATE ${dom.sampleRateSelect.value}`);
  await sendCommand(`MODE ${dom.modeSelect.value}`);
  await sendCommand("START");
  resetCaptureState();
  sampleRate = Number(dom.sampleRateSelect.value);
  currentMode = dom.modeSelect.value;
  setState("RUNNING");
  appendLog("开始采集。");
}

async function stopCapture() {
  await sendCommand("STOP");
  setState("IDLE");
  appendLog("采集已停止。");
}

async function sendCommand(text) {
  if (!device || !device.opened) {
    throw new Error("设备未连接");
  }

  const payload = new TextEncoder().encode(commandLine(text));
  await device.transferOut(USB_CONFIG.endpointOut, payload);
}

async function readLoop() {
  while (reading && device && device.opened) {
    try {
      const result = await device.transferIn(USB_CONFIG.endpointIn, 2048);
      if (result.status !== "ok" || !result.data) {
        continue;
      }

      const bytes = new Uint8Array(result.data.buffer, result.data.byteOffset, result.data.byteLength);
      bytesReceived += bytes.length;
      parser.push(bytes);
    } catch (err) {
      if (reading) {
        appendLog(`读取中断：${err.message}`);
      }
      break;
    }
  }

  if (reading) {
    await cleanupDevice();
  }
}

function handleText(text) {
  appendLog(text);

  if (text.startsWith("STATUS ")) {
    const fields = Object.fromEntries(
      text
        .slice("STATUS ".length)
        .split(/\s+/)
        .map((part) => part.split("="))
        .filter((pair) => pair.length === 2),
    );

    if (fields.state) setState(fields.state);
    if (fields.srate) sampleRate = Number(fields.srate);
    if (fields.mode) currentMode = fields.mode;
    if (fields.dropped) droppedFrames = Number(fields.dropped);
    if (fields.zero) dom.zeroCodeInput.value = fields.zero;
    if (fields.gain) dom.gainInput.value = fields.gain;
  }
}

function handleFrame(frame) {
  if (frame.magic !== WAVE_FRAME.magic || frame.count !== WAVE_FRAME.sampleCount) {
    return;
  }

  sampleRate = frame.sampleRate;
  if (frame.flags & FRAME_FLAGS.adcData) {
    currentMode = "ADC";
  }

  if (lastSeq !== null) {
    const delta = (frame.seq - lastSeq) & 0xffff;
    if (delta > 1) {
      droppedFrames += delta - 1;
    }
  }
  lastSeq = frame.seq;

  if (frame.flags & FRAME_FLAGS.overflow) {
    droppedFrames += 1;
  }

  lastStats = appendSamples(frame.samples);
}

function appendSamples(samples) {
  let sum = 0;
  let min = 65535;
  let max = 0;
  let last = 0;

  for (const sample of samples) {
    ringBuffer[writeIndex] = sample;
    writeIndex = (writeIndex + 1) % SAMPLE_CAPACITY;
    availableSamples = Math.min(SAMPLE_CAPACITY, availableSamples + 1);
    totalSamplesWritten += 1;
    sum += sample;
    if (sample < min) min = sample;
    if (sample > max) max = sample;
    last = sample;
  }

  if (displayPaused) {
    viewOffsetSamples += samples.length;
    clampViewOffset();
  }

  return {
    last,
    avg: sum / samples.length,
    min,
    max,
    pp: max - min,
    count: samples.length,
  };
}

function getOldestSerial() {
  return totalSamplesWritten - availableSamples;
}

function readByBufferOffset(offsetFromOldest) {
  if (availableSamples <= 0) {
    return 0;
  }

  const safeOffset = Math.max(0, Math.min(availableSamples - 1, offsetFromOldest));
  const oldestIndex = (writeIndex - availableSamples + SAMPLE_CAPACITY) % SAMPLE_CAPACITY;
  return ringBuffer[(oldestIndex + safeOffset) % SAMPLE_CAPACITY];
}

function getVisibleWindow() {
  const visibleSamples = Math.min(availableSamples, Math.max(1, Math.round(sampleRate * visibleSeconds)));
  const maxOffset = Math.max(0, availableSamples - visibleSamples);
  viewOffsetSamples = Math.max(0, Math.min(maxOffset, viewOffsetSamples));
  const endOffset = availableSamples - viewOffsetSamples;
  const startOffset = Math.max(0, endOffset - visibleSamples);
  const count = Math.max(0, endOffset - startOffset);
  const oldestSerial = getOldestSerial();

  return {
    startOffset,
    count,
    startSerial: oldestSerial + startOffset,
    endSerial: oldestSerial + endOffset - 1,
  };
}

function readVisibleSample(offset, windowInfo = getVisibleWindow()) {
  return readByBufferOffset(windowInfo.startOffset + offset);
}

function calibration() {
  return {
    zeroCode: clampNumber(Number(dom.zeroCodeInput.value), 0, 65535, DEFAULT_CALIBRATION.zeroCode),
    gainNaPerCode: clampNumber(Number(dom.gainInput.value), 1, 1000000000, DEFAULT_CALIBRATION.gainNaPerCode),
  };
}

function clampNumber(value, min, max, fallback) {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, value));
}

function codeToMicroamps(code) {
  const cal = calibration();
  return ((code - cal.zeroCode) * cal.gainNaPerCode) / 1000;
}

function formatUa(value) {
  return `${value.toFixed(3)} uA`;
}

function computeWindowStats(windowInfo) {
  if (windowInfo.count <= 0) {
    return emptyStats();
  }

  let min = 65535;
  let max = 0;
  let sum = 0;
  let last = 0;

  for (let i = 0; i < windowInfo.count; i += 1) {
    const sample = readVisibleSample(i, windowInfo);
    if (sample < min) min = sample;
    if (sample > max) max = sample;
    sum += sample;
    last = sample;
  }

  return {
    last,
    avg: sum / windowInfo.count,
    min,
    max,
    pp: max - min,
    count: windowInfo.count,
  };
}

function yRangeFromStats(stats) {
  if (!autoScale || stats.count <= 0) {
    const min = clampNumber(Number(dom.yMinInput.value), 0, 65535, 0);
    const max = clampNumber(Number(dom.yMaxInput.value), min + 1, 65535, 65535);
    return { min, max };
  }

  if (stats.min === stats.max) {
    const center = stats.min;
    const span = 512;
    return {
      min: Math.max(0, center - span),
      max: Math.min(65535, center + span),
    };
  }

  const span = stats.max - stats.min;
  const margin = Math.max(64, Math.round(span * 0.08));
  return {
    min: Math.max(0, stats.min - margin),
    max: Math.min(65535, stats.max + margin),
  };
}

function buildPlotSource() {
  const windowInfo = getVisibleWindow();
  const stats = computeWindowStats(windowInfo);
  const yRange = yRangeFromStats(stats);
  const cursorViews = getCursorViews(windowInfo);

  return {
    available: availableSamples,
    sampleRate,
    visibleSamples: windowInfo.count,
    viewOffsetSamples,
    showGrid,
    cursorEnabled,
    cursors: cursorViews,
    yRange,
    stats,
    windowInfo,
    readVisibleSample: (offset) => readVisibleSample(offset, windowInfo),
  };
}

function updateStats(seq = lastSeq, stats = lastStats) {
  const iavg = codeToMicroamps(stats.avg);
  const imin = codeToMicroamps(stats.min);
  const imax = codeToMicroamps(stats.max);
  const ipp = Math.abs(imax - imin);

  dom.sampleRateValue.textContent = `${sampleRate} SPS`;
  dom.modeValue.textContent = MODE_LABELS[currentMode] || currentMode;
  dom.seqValue.textContent = seq === null ? "-" : String(seq);
  dom.droppedValue.textContent = String(droppedFrames);
  dom.codeValue.textContent = String(Math.round(stats.last));
  dom.avgValue.textContent = stats.count > 0 ? stats.avg.toFixed(1) : "0";
  dom.minMaxValue.textContent = `${Math.round(stats.min)} / ${Math.round(stats.max)}`;
  dom.ppValue.textContent = String(Math.round(stats.pp));
  dom.iavgValue.textContent = formatUa(iavg);
  dom.iminMaxValue.textContent = `${imin.toFixed(3)} / ${imax.toFixed(3)} uA`;
  dom.ippValue.textContent = formatUa(ipp);
}

function updateUsbRate() {
  const now = performance.now();
  const elapsed = (now - bytesWindowStart) / 1000;

  if (elapsed >= 0.5) {
    const rate = (bytesReceived - bytesAtWindowStart) / elapsed / 1024;
    dom.usbRateValue.textContent = `${rate.toFixed(1)} kB/s`;
    bytesWindowStart = now;
    bytesAtWindowStart = bytesReceived;
  }
}

function updateViewLabels(source) {
  const windowSeconds = source.visibleSamples > 0
    ? source.visibleSamples / Math.max(1, sampleRate)
    : visibleSeconds;
  const offsetSeconds = viewOffsetSamples / Math.max(1, sampleRate);
  const followText = viewOffsetSamples === 0 ? "跟随最新" : `回看 ${offsetSeconds.toFixed(3)} s`;
  dom.viewLabel.textContent = `窗口 ${windowSeconds.toFixed(3)} s，${followText}，Y ${source.yRange.min}..${source.yRange.max}`;
}

function updateCursorPanel(source) {
  const views = source.cursors;
  const a = cursorInfoFromView(views.a, source);
  const b = cursorInfoFromView(views.b, source);

  dom.cursorAValue.textContent = a ? `${a.timeText}, ${a.code} code` : "-";
  dom.cursorBValue.textContent = b ? `${b.timeText}, ${b.code} code` : "-";

  if (!cursorEnabled) {
    dom.cursorLabel.textContent = "游标未启用";
    dom.cursorTimeValue.textContent = "-";
    dom.cursorDeltaValue.textContent = "-";
    return;
  }

  if (!a || !b) {
    dom.cursorLabel.textContent = "点击曲线设置 A/B 游标";
    dom.cursorTimeValue.textContent = "-";
    dom.cursorDeltaValue.textContent = "-";
    return;
  }

  const dt = Math.abs(b.serial - a.serial) / Math.max(1, sampleRate);
  const frequency = dt > 0 ? 1 / dt : 0;
  const dCode = b.code - a.code;
  const dCurrent = codeToMicroamps(b.code) - codeToMicroamps(a.code);
  dom.cursorLabel.textContent = `A-B: ΔT ${formatSeconds(dt)}，ΔCode ${dCode}`;
  dom.cursorTimeValue.textContent = `${formatSeconds(dt)} / ${frequency.toFixed(2)} Hz`;
  dom.cursorDeltaValue.textContent = `${dCode} code / ${dCurrent.toFixed(3)} uA`;
}

function cursorInfoFromView(view, source) {
  if (!view || view.sampleOffset === null) {
    return null;
  }

  const serial = source.windowInfo.startSerial + view.sampleOffset;
  const code = source.readVisibleSample(view.sampleOffset);
  const t = (serial - source.windowInfo.startSerial) / Math.max(1, sampleRate);
  return {
    serial,
    code,
    timeText: formatSeconds(t),
  };
}

function getCursorViews(windowInfo) {
  const resolve = (cursor) => {
    if (cursor.serial === null || windowInfo.count <= 0) {
      return { sampleOffset: null };
    }

    const offset = cursor.serial - windowInfo.startSerial;
    if (offset < 0 || offset >= windowInfo.count) {
      return { sampleOffset: null };
    }

    return { sampleOffset: offset };
  };

  return {
    a: resolve(cursors.a),
    b: resolve(cursors.b),
  };
}

function formatSeconds(seconds) {
  if (seconds < 0.001) {
    return `${(seconds * 1000000).toFixed(1)} us`;
  }
  if (seconds < 1) {
    return `${(seconds * 1000).toFixed(3)} ms`;
  }
  return `${seconds.toFixed(6)} s`;
}

function resetCaptureState() {
  writeIndex = 0;
  availableSamples = 0;
  totalSamplesWritten = 0;
  lastSeq = null;
  droppedFrames = 0;
  bytesReceived = 0;
  bytesAtWindowStart = 0;
  bytesWindowStart = performance.now();
  viewOffsetSamples = 0;
  displayPaused = false;
  cursors.a.serial = null;
  cursors.b.serial = null;
  nextCursorName = "a";
  lastStats = emptyStats();
  dom.pauseViewBtn.textContent = "暂停显示";
  updateStats(null, lastStats);
}

async function applyCalibration(logResult = true) {
  const cal = calibration();
  dom.zeroCodeInput.value = String(cal.zeroCode);
  dom.gainInput.value = String(cal.gainNaPerCode);

  if (device && device.opened) {
    await sendCommand(`SET_ZERO_CODE ${cal.zeroCode}`);
    await sendCommand(`SET_GAIN_NA_PER_CODE ${cal.gainNaPerCode}`);
    if (logResult) {
      appendLog("校准参数已应用。");
    }
  }
}

async function zeroNow() {
  const stats = buildPlotSource().stats;
  const zero = Math.round(stats.count > 0 ? stats.avg : lastStats.avg);
  dom.zeroCodeInput.value = String(clampNumber(zero, 0, 65535, 0));
  await applyCalibration();
}

function clearBuffer() {
  writeIndex = 0;
  availableSamples = 0;
  totalSamplesWritten = 0;
  viewOffsetSamples = 0;
  cursors.a.serial = null;
  cursors.b.serial = null;
  nextCursorName = "a";
  lastStats = emptyStats();
  updateStats(null, lastStats);
  appendLog("本地波形缓存已清空。");
}

function setVisibleSeconds(seconds) {
  visibleSeconds = clampNumber(seconds, TIME_WINDOWS[0], TIME_WINDOWS[TIME_WINDOWS.length - 1], 2);
  dom.timeWindowSelect.value = String(visibleSeconds);
  clampViewOffset();
}

function zoomTime(direction) {
  const currentIndex = TIME_WINDOWS.findIndex((value) => value === visibleSeconds);
  const fallbackIndex = TIME_WINDOWS.reduce((best, value, index) => (
    Math.abs(value - visibleSeconds) < Math.abs(TIME_WINDOWS[best] - visibleSeconds) ? index : best
  ), 0);
  const index = currentIndex >= 0 ? currentIndex : fallbackIndex;
  const nextIndex = Math.max(0, Math.min(TIME_WINDOWS.length - 1, index + direction));
  setVisibleSeconds(TIME_WINDOWS[nextIndex]);
}

function panByFraction(fraction) {
  const visibleSamples = Math.max(1, Math.round(sampleRate * visibleSeconds));
  viewOffsetSamples += Math.round(visibleSamples * fraction);
  displayPaused = viewOffsetSamples > 0;
  dom.pauseViewBtn.textContent = displayPaused ? "继续显示" : "暂停显示";
  clampViewOffset();
}

function showLatest() {
  viewOffsetSamples = 0;
  displayPaused = false;
  dom.pauseViewBtn.textContent = "暂停显示";
}

function togglePauseView() {
  displayPaused = !displayPaused;
  if (!displayPaused) {
    viewOffsetSamples = 0;
  }
  dom.pauseViewBtn.textContent = displayPaused ? "继续显示" : "暂停显示";
}

function clampViewOffset() {
  const visibleSamples = Math.min(availableSamples, Math.max(1, Math.round(sampleRate * visibleSeconds)));
  const maxOffset = Math.max(0, availableSamples - visibleSamples);
  viewOffsetSamples = Math.max(0, Math.min(maxOffset, viewOffsetSamples));
}

function setManualRangeEnabled(enabled) {
  dom.yMinInput.disabled = !enabled;
  dom.yMaxInput.disabled = !enabled;
}

function setCursorAtClientX(clientX, cursorName = nextCursorName) {
  const source = buildPlotSource();
  const offset = plot.clientXToSampleOffset(clientX);
  if (offset === null || source.visibleSamples <= 0) {
    return;
  }

  const safeOffset = Math.max(0, Math.min(source.visibleSamples - 1, offset));
  cursors[cursorName].serial = source.windowInfo.startSerial + safeOffset;
  nextCursorName = cursorName === "a" ? "b" : "a";
}

function nearestCursor(clientX) {
  if (!cursorEnabled) {
    return null;
  }

  const source = buildPlotSource();
  const views = source.cursors;
  let best = null;
  let bestDistance = Infinity;

  for (const name of ["a", "b"]) {
    if (views[name].sampleOffset === null) {
      continue;
    }

    const x = plot.sampleOffsetToClientX(views[name].sampleOffset);
    if (x === null) {
      continue;
    }

    const distance = Math.abs(x - clientX);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = name;
    }
  }

  return bestDistance <= 12 ? best : null;
}

function exportCsv() {
  const source = buildPlotSource();
  if (source.visibleSamples <= 0) {
    appendLog("没有可导出的波形数据。");
    return;
  }

  const rows = ["index,time_s,adc_code,current_uA"];
  for (let i = 0; i < source.visibleSamples; i += 1) {
    const code = source.readVisibleSample(i);
    const time = i / Math.max(1, sampleRate);
    rows.push(`${i},${time.toFixed(9)},${code},${codeToMicroamps(code).toFixed(6)}`);
  }

  const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" });
  downloadBlob(blob, `pico-power-scope-${timestampForFile()}.csv`);
  appendLog(`已导出当前窗口 CSV，${source.visibleSamples} 点。`);
}

function exportPng() {
  plot.canvas.toBlob((blob) => {
    if (!blob) {
      appendLog("保存图片失败。");
      return;
    }
    downloadBlob(blob, `pico-power-scope-${timestampForFile()}.png`);
  }, "image/png");
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function timestampForFile() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function animationLoop(now = performance.now()) {
  updateUsbRate();

  if (now - lastDrawAt >= DRAW_INTERVAL_MS) {
    const source = buildPlotSource();
    plot.draw(source);
    updateViewLabels(source);
    updateCursorPanel(source);
    updateStats(lastSeq, source.stats.count > 0 ? source.stats : lastStats);
    lastDrawAt = now;
  }

  requestAnimationFrame(animationLoop);
}

dom.connectBtn.addEventListener("click", () => connectDevice());
dom.disconnectBtn.addEventListener("click", () => disconnectDevice());
dom.startBtn.addEventListener("click", () => startCapture().catch((err) => appendLog(err.message)));
dom.stopBtn.addEventListener("click", () => stopCapture().catch((err) => appendLog(err.message)));
dom.applyCalBtn.addEventListener("click", () => applyCalibration().catch((err) => appendLog(err.message)));
dom.zeroNowBtn.addEventListener("click", () => zeroNow().catch((err) => appendLog(err.message)));
dom.pauseViewBtn.addEventListener("click", () => togglePauseView());
dom.clearBtn.addEventListener("click", () => clearBuffer());
dom.exportCsvBtn.addEventListener("click", () => exportCsv());
dom.exportPngBtn.addEventListener("click", () => exportPng());
dom.clearLogBtn.addEventListener("click", () => {
  dom.logOutput.textContent = "";
});

dom.zoomInBtn.addEventListener("click", () => zoomTime(-1));
dom.zoomOutBtn.addEventListener("click", () => zoomTime(1));
dom.panLeftBtn.addEventListener("click", () => panByFraction(0.25));
dom.panRightBtn.addEventListener("click", () => panByFraction(-0.25));
dom.latestBtn.addEventListener("click", () => showLatest());

dom.sampleRateSelect.addEventListener("change", () => {
  sampleRate = Number(dom.sampleRateSelect.value);
  clampViewOffset();
  if (device && device.opened) {
    sendCommand(`SRATE ${sampleRate}`).catch((err) => appendLog(err.message));
  }
});

dom.modeSelect.addEventListener("change", () => {
  currentMode = dom.modeSelect.value;
  if (device && device.opened) {
    sendCommand(`MODE ${currentMode}`).catch((err) => appendLog(err.message));
  }
});

dom.timeWindowSelect.addEventListener("change", () => {
  setVisibleSeconds(Number(dom.timeWindowSelect.value));
});

dom.autoScaleToggle.addEventListener("change", () => {
  autoScale = dom.autoScaleToggle.checked;
  setManualRangeEnabled(!autoScale);
});

dom.gridToggle.addEventListener("change", () => {
  showGrid = dom.gridToggle.checked;
});

dom.cursorToggle.addEventListener("change", () => {
  cursorEnabled = dom.cursorToggle.checked;
});

dom.yMinInput.addEventListener("change", () => {
  const min = clampNumber(Number(dom.yMinInput.value), 0, 65534, 0);
  const max = clampNumber(Number(dom.yMaxInput.value), min + 1, 65535, 65535);
  dom.yMinInput.value = String(min);
  dom.yMaxInput.value = String(max);
});

dom.yMaxInput.addEventListener("change", () => {
  const min = clampNumber(Number(dom.yMinInput.value), 0, 65534, 0);
  const max = clampNumber(Number(dom.yMaxInput.value), min + 1, 65535, 65535);
  dom.yMinInput.value = String(min);
  dom.yMaxInput.value = String(max);
});

plot.canvas.addEventListener("wheel", (event) => {
  event.preventDefault();
  if (event.shiftKey) {
    panByFraction(event.deltaY > 0 ? 0.15 : -0.15);
  } else {
    zoomTime(event.deltaY > 0 ? 1 : -1);
  }
}, { passive: false });

plot.canvas.addEventListener("pointerdown", (event) => {
  plot.canvas.setPointerCapture(event.pointerId);

  if (cursorEnabled) {
    const cursorName = nearestCursor(event.clientX) || nextCursorName;
    setCursorAtClientX(event.clientX, cursorName);
    activeDrag = { type: "cursor", cursorName };
    return;
  }

  activeDrag = {
    type: "pan",
    startX: event.clientX,
    startOffset: viewOffsetSamples,
  };
});

plot.canvas.addEventListener("pointermove", (event) => {
  if (!activeDrag) {
    return;
  }

  if (activeDrag.type === "cursor") {
    setCursorAtClientX(event.clientX, activeDrag.cursorName);
    return;
  }

  if (activeDrag.type === "pan" && plot.metrics) {
    const dx = event.clientX - activeDrag.startX;
    const samplesPerCssPx = buildPlotSource().visibleSamples / Math.max(1, plot.metrics.plotWidth / plot.metrics.dpr);
    viewOffsetSamples = activeDrag.startOffset + Math.round(dx * samplesPerCssPx);
    displayPaused = viewOffsetSamples > 0;
    dom.pauseViewBtn.textContent = displayPaused ? "继续显示" : "暂停显示";
    clampViewOffset();
  }
});

plot.canvas.addEventListener("pointerup", (event) => {
  if (plot.canvas.hasPointerCapture(event.pointerId)) {
    plot.canvas.releasePointerCapture(event.pointerId);
  }
  activeDrag = null;
});

plot.canvas.addEventListener("pointercancel", () => {
  activeDrag = null;
});

navigator.usb?.addEventListener("disconnect", (event) => {
  if (device && event.device === device) {
    appendLog("设备已断开。");
    cleanupDevice();
  }
});

setConnectedUi(false);
setManualRangeEnabled(false);
updateStats(null, lastStats);
animationLoop();
