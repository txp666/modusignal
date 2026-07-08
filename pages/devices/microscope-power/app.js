import {
  DEFAULT_CALIBRATION,
  FRAME_FLAGS,
  USB_CONFIG,
  WAVE_FRAME,
  WaveFrameParser,
  commandLine,
} from "./protocol.js";
import { WavePlot } from "./plot.js?v=20260708-zero2";

const SAMPLE_BUFFER_SECONDS = 120;
const MAX_SAMPLE_RATE = 100000;
const SAMPLE_CAPACITY = SAMPLE_BUFFER_SECONDS * MAX_SAMPLE_RATE;
const DRAW_INTERVAL_MS = 33;
const STATS_INTERVAL_MS = 100;
const MIN_VISIBLE_SAMPLES = 2;
const MAX_STATS_SCAN = 50000;
const ADS_REF_MV = 2500;
const FRONTEND_GAIN = 50;
const RANGE_LOW_OHM = 1;
const RANGE_HIGH_OHM = 10;

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
  bootloaderBtn: document.querySelector("#bootloaderBtn"),
  startBtn: document.querySelector("#startBtn"),
  stopBtn: document.querySelector("#stopBtn"),
  sampleRateSelect: document.querySelector("#sampleRateSelect"),
  timeWindowSelect: document.querySelector("#timeWindowSelect"),
  zoomInBtn: document.querySelector("#zoomInBtn"),
  zoomOutBtn: document.querySelector("#zoomOutBtn"),
  panLeftBtn: document.querySelector("#panLeftBtn"),
  panRightBtn: document.querySelector("#panRightBtn"),
  latestBtn: document.querySelector("#latestBtn"),
  pauseViewBtn: document.querySelector("#pauseViewBtn"),
  autoScaleToggle: document.querySelector("#autoScaleToggle"),
  autoRangeToggle: document.querySelector("#autoRangeToggle"),
  manualRangeSelect: document.querySelector("#manualRangeSelect"),
  gridToggle: document.querySelector("#gridToggle"),
  envelopeToggle: document.querySelector("#envelopeToggle"),
  smoothToggle: document.querySelector("#smoothToggle"),
  cursorToggle: document.querySelector("#cursorToggle"),
  yMinInput: document.querySelector("#yMinInput"),
  yMaxInput: document.querySelector("#yMaxInput"),
  zoomYInBtn: document.querySelector("#zoomYInBtn"),
  zoomYOutBtn: document.querySelector("#zoomYOutBtn"),
  panUpBtn: document.querySelector("#panUpBtn"),
  panDownBtn: document.querySelector("#panDownBtn"),
  resetYBtn: document.querySelector("#resetYBtn"),
  zeroLowCodeInput: document.querySelector("#zeroLowCodeInput"),
  zeroHighCodeInput: document.querySelector("#zeroHighCodeInput"),
  senseLowOhmInput: document.querySelector("#senseLowOhmInput"),
  senseHighOhmInput: document.querySelector("#senseHighOhmInput"),
  largeRangeValue: document.querySelector("#largeRangeValue"),
  smallRangeValue: document.querySelector("#smallRangeValue"),
  zeroNowBtn: document.querySelector("#zeroNowBtn"),
  applyCalBtn: document.querySelector("#applyCalBtn"),
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
  rangeValue: document.querySelector("#rangeValue"),
  seqValue: document.querySelector("#seqValue"),
  droppedValue: document.querySelector("#droppedValue"),
  usbRateValue: document.querySelector("#usbRateValue"),
  codeValue: document.querySelector("#codeValue"),
  avgValue: document.querySelector("#avgValue"),
  minMaxValue: document.querySelector("#minMaxValue"),
  ppValue: document.querySelector("#ppValue"),
  rmsValue: document.querySelector("#rmsValue"),
  rippleValue: document.querySelector("#rippleValue"),
  iavgValue: document.querySelector("#iavgValue"),
  iminMaxValue: document.querySelector("#iminMaxValue"),
  ippValue: document.querySelector("#ippValue"),
  metricNow: document.querySelector("#metricNow"),
  metricAvg: document.querySelector("#metricAvg"),
  metricPp: document.querySelector("#metricPp"),
  metricRms: document.querySelector("#metricRms"),
  cursorAValue: document.querySelector("#cursorAValue"),
  cursorBValue: document.querySelector("#cursorBValue"),
  cursorTimeValue: document.querySelector("#cursorTimeValue"),
  cursorDeltaValue: document.querySelector("#cursorDeltaValue"),
};

const ringBuffer = new Uint16Array(SAMPLE_CAPACITY);
const rangeBuffer = new Uint8Array(SAMPLE_CAPACITY);
const plot = new WavePlot(document.querySelector("#waveCanvas"));

let device = null;
let reading = false;
let writeIndex = 0;
let availableSamples = 0;
let totalSamplesWritten = 0;
let sampleRate = 100000;
let lastSeq = null;
let droppedFrames = 0;
let currentRangeOhm = RANGE_HIGH_OHM;
let autoRange = true;
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
let showEnvelope = false;
let smoothDisplay = true;
let cursorEnabled = false;
let nextCursorName = "a";
let activeDrag = null;
let lastDrawAt = 0;
let lastStatsUiAt = 0;
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
    rms: 0,
    ppPercent: 0,
    lastCode: 0,
    avgCode: 0,
    minCode: 0,
    maxCode: 0,
    ppCode: 0,
    rangeOhm: currentRangeOhm,
    displayMin: 0,
    displayMax: 0,
    count: 0,
    scannedCount: 0,
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
  dom.bootloaderBtn.disabled = !connected;
  dom.startBtn.disabled = !connected;
  dom.stopBtn.disabled = !connected;
  dom.zeroNowBtn.disabled = !connected;
  dom.applyCalBtn.disabled = !connected;
  dom.autoRangeToggle.disabled = !connected;
  setRangeUiEnabled(connected);
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
  await sendCommand("START");
  resetCaptureState();
  sampleRate = Number(dom.sampleRateSelect.value);
  setState("RUNNING");
  appendLog("开始采集。");
}

async function stopCapture() {
  await sendCommand("STOP");
  setState("IDLE");
  appendLog("采集已停止。");
}

async function enterBootloader() {
  if (!device || !device.opened) {
    appendLog("设备未连接。");
    return;
  }

  const confirmed = window.confirm("设备将停止采集并重启到 BOOTSEL/U盘升级模式。之后把新的 UF2 拷贝到 Pico 盘符即可。继续？");
  if (!confirmed) {
    return;
  }

  try {
    await sendCommand("STOP");
  } catch {
  }
  await sendCommand("BOOTSEL");
  appendLog("已请求进入 BOOTSEL 升级模式，等待设备断开。");
  reading = false;
  setTimeout(() => cleanupDevice(), 300);
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
    if (fields.dropped) droppedFrames = Number(fields.dropped);
    if (fields.range) {
      currentRangeOhm = Number(fields.range) === RANGE_HIGH_OHM ? RANGE_HIGH_OHM : RANGE_LOW_OHM;
      dom.manualRangeSelect.value = String(currentRangeOhm);
    }
    if (fields.zero1) dom.zeroLowCodeInput.value = fields.zero1;
    if (fields.zero10) dom.zeroHighCodeInput.value = fields.zero10;
    if (fields.zero && !fields.zero1 && !fields.zero10) {
      zeroInputForRange(currentRangeOhm).value = fields.zero;
    }
    if (fields.sense1_mohm) {
      dom.senseLowOhmInput.value = formatInputNumber(Number(fields.sense1_mohm) / 1000);
    }
    if (fields.sense10_mohm) {
      dom.senseHighOhmInput.value = formatInputNumber(Number(fields.sense10_mohm) / 1000);
    }
    if (fields.auto_range) {
      autoRange = fields.auto_range === "1";
      dom.autoRangeToggle.checked = autoRange;
      setRangeUiEnabled(device && device.opened);
    }
  }
}

function handleFrame(frame) {
  if (frame.magic !== WAVE_FRAME.magic || frame.count !== WAVE_FRAME.sampleCount) {
    return;
  }

  sampleRate = frame.sampleRate;

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

  currentRangeOhm = frame.flags & FRAME_FLAGS.range10Ohm ? RANGE_HIGH_OHM : RANGE_LOW_OHM;
  autoRange = Boolean(frame.flags & FRAME_FLAGS.autoRange);
  dom.autoRangeToggle.checked = autoRange;
  dom.manualRangeSelect.value = String(currentRangeOhm);
  setRangeUiEnabled(device && device.opened);

  lastStats = appendSamples(frame.samples, currentRangeOhm);
}

function appendSamples(samples, rangeOhm) {
  const cal = calibration();
  let sum = 0;
  let sumSq = 0;
  let min = Infinity;
  let max = -Infinity;
  let last = 0;
  let codeSum = 0;
  let codeMin = 65535;
  let codeMax = 0;
  let lastCode = 0;

  for (const sample of samples) {
    const currentUa = codeToMicroamps(sample, rangeOhm, cal);
    ringBuffer[writeIndex] = sample;
    rangeBuffer[writeIndex] = rangeOhm === RANGE_HIGH_OHM ? RANGE_HIGH_OHM : RANGE_LOW_OHM;
    writeIndex = (writeIndex + 1) % SAMPLE_CAPACITY;
    availableSamples = Math.min(SAMPLE_CAPACITY, availableSamples + 1);
    totalSamplesWritten += 1;
    sum += currentUa;
    sumSq += currentUa * currentUa;
    if (currentUa < min) min = currentUa;
    if (currentUa > max) max = currentUa;
    last = currentUa;
    codeSum += sample;
    if (sample < codeMin) codeMin = sample;
    if (sample > codeMax) codeMax = sample;
    lastCode = sample;
  }

  if (displayPaused) {
    viewOffsetSamples += samples.length;
    clampViewOffset();
  }

  const avg = sum / samples.length;
  const rms = Math.sqrt(Math.max(0, (sumSq / samples.length) - avg * avg));
  const pp = max - min;

  return {
    last,
    avg,
    min,
    max,
    pp,
    rms,
    ppPercent: Math.abs(avg) > 1e-12 ? Math.abs(pp / avg) * 100 : 0,
    lastCode,
    avgCode: codeSum / samples.length,
    minCode: codeMin,
    maxCode: codeMax,
    ppCode: codeMax - codeMin,
    rangeOhm,
    count: samples.length,
    scannedCount: samples.length,
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

function readRangeByBufferOffset(offsetFromOldest) {
  if (availableSamples <= 0) {
    return currentRangeOhm;
  }

  const safeOffset = Math.max(0, Math.min(availableSamples - 1, offsetFromOldest));
  const oldestIndex = (writeIndex - availableSamples + SAMPLE_CAPACITY) % SAMPLE_CAPACITY;
  return rangeBuffer[(oldestIndex + safeOffset) % SAMPLE_CAPACITY] || currentRangeOhm;
}

function getVisibleWindow() {
  const requestedSamples = Math.max(MIN_VISIBLE_SAMPLES, Math.round(sampleRate * visibleSeconds));
  const visibleSamples = Math.min(availableSamples, requestedSamples);
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

function readVisibleRange(offset, windowInfo = getVisibleWindow()) {
  return readRangeByBufferOffset(windowInfo.startOffset + offset);
}

function readVisibleCurrent(offset, windowInfo = getVisibleWindow()) {
  const code = readVisibleSample(offset, windowInfo);
  const rangeOhm = readVisibleRange(offset, windowInfo);
  return codeToMicroamps(code, rangeOhm);
}

function calibration() {
  return {
    zeroLowCode: Math.round(clampNumber(Number(dom.zeroLowCodeInput.value), 0, 65535, DEFAULT_CALIBRATION.zeroLowCode)),
    zeroHighCode: Math.round(clampNumber(Number(dom.zeroHighCodeInput.value), 0, 65535, DEFAULT_CALIBRATION.zeroHighCode)),
    senseLowOhm: clampNumber(Number(dom.senseLowOhmInput.value), 0.001, 1000000, DEFAULT_CALIBRATION.senseLowOhm),
    senseHighOhm: clampNumber(Number(dom.senseHighOhmInput.value), 0.001, 1000000, DEFAULT_CALIBRATION.senseHighOhm),
  };
}

function clampNumber(value, min, max, fallback) {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, value));
}

function senseOhmForRange(rangeOhm, cal = calibration()) {
  return rangeOhm === RANGE_HIGH_OHM ? cal.senseHighOhm : cal.senseLowOhm;
}

function zeroCodeForRange(rangeOhm, cal = calibration()) {
  return rangeOhm === RANGE_HIGH_OHM ? cal.zeroHighCode : cal.zeroLowCode;
}

function zeroInputForRange(rangeOhm) {
  return rangeOhm === RANGE_HIGH_OHM ? dom.zeroHighCodeInput : dom.zeroLowCodeInput;
}

function microampsPerCode(rangeOhm = currentRangeOhm, cal = calibration()) {
  return (ADS_REF_MV * 1000) / (65536 * FRONTEND_GAIN * senseOhmForRange(rangeOhm, cal));
}

function codeToMicroamps(code, rangeOhm = currentRangeOhm, cal = calibration()) {
  return (code - zeroCodeForRange(rangeOhm, cal)) * microampsPerCode(rangeOhm, cal);
}

function formatUa(value) {
  return `${value.toFixed(3)} uA`;
}

function formatInputNumber(value) {
  if (Math.abs(value) >= 1000) {
    return value.toFixed(3).replace(/\.?0+$/, "");
  }
  return value.toFixed(6).replace(/\.?0+$/, "");
}

function computeWindowStats(windowInfo) {
  if (windowInfo.count <= 0) {
    return emptyStats();
  }

  const statsStep = Math.max(1, Math.ceil(windowInfo.count / MAX_STATS_SCAN));
  const quantileStep = Math.max(statsStep, Math.ceil(windowInfo.count / 5000));
  const displaySamples = [];
  let min = 65535;
  let max = 0;
  let sum = 0;
  let codeCount = 0;
  let currentMin = Infinity;
  let currentMax = -Infinity;
  let currentSum = 0;
  let currentSumSq = 0;

  for (let i = 0; i < windowInfo.count; i += statsStep) {
    const sample = readVisibleSample(i, windowInfo);
    const rangeOhm = readVisibleRange(i, windowInfo);
    const currentUa = codeToMicroamps(sample, rangeOhm);
    if (sample < min) min = sample;
    if (sample > max) max = sample;
    sum += sample;
    codeCount += 1;
    if (currentUa < currentMin) currentMin = currentUa;
    if (currentUa > currentMax) currentMax = currentUa;
    currentSum += currentUa;
    currentSumSq += currentUa * currentUa;
    if ((i % quantileStep) === 0) {
      displaySamples.push(currentUa);
    }
  }

  const lastOffset = windowInfo.count - 1;
  const lastCode = readVisibleSample(lastOffset, windowInfo);
  const lastRange = readVisibleRange(lastOffset, windowInfo);
  const currentLast = codeToMicroamps(lastCode, lastRange);

  if (codeCount === 0) {
    return emptyStats();
  }

  displaySamples.sort((a, b) => a - b);
  const q05 = displaySamples[Math.floor((displaySamples.length - 1) * 0.05)] ?? currentMin;
  const q95 = displaySamples[Math.floor((displaySamples.length - 1) * 0.95)] ?? currentMax;
  const avgUa = currentSum / codeCount;
  const rmsUa = Math.sqrt(Math.max(0, (currentSumSq / codeCount) - avgUa * avgUa));
  const ppUa = currentMax - currentMin;

  return {
    last: currentLast,
    avg: avgUa,
    min: currentMin,
    max: currentMax,
    pp: ppUa,
    rms: rmsUa,
    ppPercent: Math.abs(avgUa) > 1e-12 ? Math.abs(ppUa / avgUa) * 100 : 0,
    lastCode,
    avgCode: sum / codeCount,
    minCode: min,
    maxCode: max,
    ppCode: max - min,
    rangeOhm: currentRangeOhm,
    displayMin: q05,
    displayMax: q95,
    count: windowInfo.count,
    scannedCount: codeCount,
  };
}

function yRangeFromStats(stats) {
  if (!autoScale || stats.count <= 0) {
    const min = clampNumber(Number(dom.yMinInput.value), -1000000000, 1000000000, -100);
    const max = clampNumber(Number(dom.yMaxInput.value), min + 0.001, 1000000000, 100);
    return { min, max };
  }

  const displayMin = Number.isFinite(stats.displayMin) ? stats.displayMin : stats.min;
  const displayMax = Number.isFinite(stats.displayMax) ? stats.displayMax : stats.max;

  if (displayMin === displayMax) {
    const center = displayMin;
    const span = Math.max(1, Math.abs(center) * 0.1);
    return {
      min: center - span,
      max: center + span,
    };
  }

  const span = displayMax - displayMin;
  const margin = Math.max(microampsPerCode(currentRangeOhm) * 8, span * 0.08);
  return {
    min: displayMin - margin,
    max: displayMax + margin,
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
    showEnvelope,
    smoothDisplay,
    cursorEnabled,
    cursors: cursorViews,
    yRange,
    stats,
    windowInfo,
    readVisibleSample: (offset) => readVisibleCurrent(offset, windowInfo),
    readVisibleCode: (offset) => readVisibleSample(offset, windowInfo),
    readVisibleRange: (offset) => readVisibleRange(offset, windowInfo),
  };
}

function updateStats(seq = lastSeq, stats = lastStats) {
  dom.sampleRateValue.textContent = `${sampleRate} SPS`;
  dom.modeValue.textContent = "ADS8866 ADC";
  dom.rangeValue.textContent = `${currentRangeOhm} Ω${autoRange ? " 自动" : " 手动"}`;
  dom.seqValue.textContent = seq === null ? "-" : String(seq);
  dom.droppedValue.textContent = String(droppedFrames);
  dom.codeValue.textContent = formatUa(stats.last);
  dom.avgValue.textContent = stats.count > 0 ? formatUa(stats.avg) : "0.000 uA";
  dom.minMaxValue.textContent = `${formatUa(stats.min)} / ${formatUa(stats.max)}`;
  dom.ppValue.textContent = formatUa(Math.abs(stats.pp));
  dom.rmsValue.textContent = formatUa(stats.rms);
  dom.rippleValue.textContent = `${stats.ppPercent.toFixed(4)} %`;
  dom.iavgValue.textContent = String(Math.round(stats.lastCode));
  dom.iminMaxValue.textContent = `${Math.round(stats.minCode)} / ${Math.round(stats.maxCode)}`;
  dom.ippValue.textContent = `${microampsPerCode(currentRangeOhm).toFixed(6)} uA/code`;
  dom.metricNow.textContent = formatUa(stats.last);
  dom.metricAvg.textContent = stats.count > 0 ? formatUa(stats.avg) : "0.000 uA";
  dom.metricPp.textContent = formatUa(Math.abs(stats.pp));
  dom.metricRms.textContent = formatUa(stats.rms);
  updateRangeReadouts();
}

function updateRangeReadouts() {
  const cal = calibration();
  dom.largeRangeValue.textContent = rangeTextForRange(RANGE_LOW_OHM, cal);
  dom.smallRangeValue.textContent = rangeTextForRange(RANGE_HIGH_OHM, cal);
}

function rangeTextForRange(rangeOhm, cal) {
  const uaPerCode = microampsPerCode(rangeOhm, cal);
  const zero = zeroCodeForRange(rangeOhm, cal);
  const lowUa = -zero * uaPerCode;
  const highUa = (65535 - zero) * uaPerCode;
  const maxAbsUa = Math.max(Math.abs(lowUa), Math.abs(highUa));
  if (maxAbsUa >= 1000) {
    return `${(lowUa / 1000).toFixed(3)} .. ${(highUa / 1000).toFixed(3)} mA`;
  }
  return `${lowUa.toFixed(2)} .. ${highUa.toFixed(2)} uA`;
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
  const followText = viewOffsetSamples === 0 ? "跟随最新" : `回看 ${formatSeconds(offsetSeconds)}`;
  dom.viewLabel.textContent = `窗口 ${formatSeconds(windowSeconds)}，${followText}，Y ${source.yRange.min.toFixed(3)}..${source.yRange.max.toFixed(3)} uA`;
}

function updateCursorPanel(source) {
  const views = source.cursors;
  const a = cursorInfoFromView(views.a, source);
  const b = cursorInfoFromView(views.b, source);

  dom.cursorAValue.textContent = a ? `${a.timeText}, ${formatUa(a.currentUa)}, ${a.code} code` : "-";
  dom.cursorBValue.textContent = b ? `${b.timeText}, ${formatUa(b.currentUa)}, ${b.code} code` : "-";

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
  const dCurrent = b.currentUa - a.currentUa;
  dom.cursorLabel.textContent = `A-B: ΔT ${formatSeconds(dt)}，ΔCode ${dCode}`;
  dom.cursorTimeValue.textContent = `${formatSeconds(dt)} / ${frequency.toFixed(2)} Hz`;
  dom.cursorDeltaValue.textContent = `${dCode} code / ${formatUa(dCurrent)}`;
}

function cursorInfoFromView(view, source) {
  if (!view || view.sampleOffset === null) {
    return null;
  }

  const serial = source.windowInfo.startSerial + view.sampleOffset;
  const currentUa = source.readVisibleSample(view.sampleOffset);
  const code = source.readVisibleCode(view.sampleOffset);
  const t = (serial - source.windowInfo.startSerial) / Math.max(1, sampleRate);
  return {
    serial,
    code,
    currentUa,
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
  return `${seconds.toFixed(3)} s`;
}

function resetCaptureState() {
  writeIndex = 0;
  availableSamples = 0;
  totalSamplesWritten = 0;
  rangeBuffer.fill(0);
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
  syncPauseButton();
  updateStats(null, lastStats);
}

async function applyCalibration(logResult = true) {
  const cal = calibration();
  dom.zeroLowCodeInput.value = String(cal.zeroLowCode);
  dom.zeroHighCodeInput.value = String(cal.zeroHighCode);
  dom.senseLowOhmInput.value = String(cal.senseLowOhm);
  dom.senseHighOhmInput.value = String(cal.senseHighOhm);

  if (device && device.opened) {
    await sendCommand(`SET_SENSE_MOHM_RANGE 1 ${Math.round(cal.senseLowOhm * 1000)}`);
    await sendCommand(`SET_SENSE_MOHM_RANGE 10 ${Math.round(cal.senseHighOhm * 1000)}`);
    await sendCommand(`SET_ZERO_CODE_RANGE 1 ${cal.zeroLowCode}`);
    await sendCommand(`SET_ZERO_CODE_RANGE 10 ${cal.zeroHighCode}`);
    await sendCommand(`SET_AUTO_RANGE ${dom.autoRangeToggle.checked ? 1 : 0}`);
    if (!dom.autoRangeToggle.checked) {
      await sendCommand(`SET_RANGE ${dom.manualRangeSelect.value}`);
    }
    if (logResult) {
      appendLog("校准参数已应用。");
    }
  }
}

async function zeroNow() {
  const rangeOhm = currentRangeOhm;
  const zero = Math.round(codeAverageForRange(rangeOhm));
  zeroInputForRange(rangeOhm).value = String(clampNumber(zero, 0, 65535, 0));
  await applyCalibration();
}

function codeAverageForRange(rangeOhm) {
  if (lastStats.count > 0 && lastStats.rangeOhm === rangeOhm) {
    return lastStats.avgCode;
  }

  const windowInfo = getVisibleWindow();
  if (windowInfo.count <= 0) {
    return lastStats.avgCode || 0;
  }

  const step = Math.max(1, Math.ceil(windowInfo.count / MAX_STATS_SCAN));
  let sum = 0;
  let count = 0;
  for (let i = 0; i < windowInfo.count; i += step) {
    if (readVisibleRange(i, windowInfo) !== rangeOhm) {
      continue;
    }
    sum += readVisibleSample(i, windowInfo);
    count += 1;
  }

  return count > 0 ? sum / count : (lastStats.avgCode || 0);
}

function clearBuffer() {
  writeIndex = 0;
  availableSamples = 0;
  totalSamplesWritten = 0;
  rangeBuffer.fill(0);
  viewOffsetSamples = 0;
  displayPaused = false;
  cursors.a.serial = null;
  cursors.b.serial = null;
  nextCursorName = "a";
  lastStats = emptyStats();
  syncPauseButton();
  updateStats(null, lastStats);
  appendLog("本地波形缓存已清空。");
}

function minVisibleSeconds() {
  return Math.max(MIN_VISIBLE_SAMPLES / Math.max(1, sampleRate), 1 / MAX_SAMPLE_RATE);
}

function maxVisibleSeconds() {
  return SAMPLE_BUFFER_SECONDS;
}

function syncTimeWindowInput() {
  if (document.activeElement === dom.timeWindowSelect) {
    return;
  }
  dom.timeWindowSelect.value = formatInputNumber(visibleSeconds);
}

function setVisibleSecondsPreservingAnchor(seconds, anchorSerial = null, anchorRatio = 0.5) {
  visibleSeconds = clampNumber(seconds, minVisibleSeconds(), maxVisibleSeconds(), 2);

  if (availableSamples > 0 && anchorSerial !== null) {
    const visibleSamples = Math.min(
      availableSamples,
      Math.max(MIN_VISIBLE_SAMPLES, Math.round(sampleRate * visibleSeconds)),
    );
    const oldestSerial = getOldestSerial();
    const maxStartOffset = Math.max(0, availableSamples - visibleSamples);
    const desiredStartOffset = Math.round(anchorSerial - oldestSerial - anchorRatio * Math.max(0, visibleSamples - 1));
    const startOffset = Math.max(0, Math.min(maxStartOffset, desiredStartOffset));
    viewOffsetSamples = Math.max(0, availableSamples - startOffset - visibleSamples);
  }

  clampViewOffset();
  displayPaused = viewOffsetSamples > 0;
  syncPauseButton();
  syncTimeWindowInput();
}

function setVisibleSecondsFromInput(seconds) {
  const source = getVisibleWindow();
  const anchorRatio = viewOffsetSamples > 0 ? 0.5 : 1;
  const anchorSerial = source.count > 0
    ? source.startSerial + Math.round(anchorRatio * Math.max(0, source.count - 1))
    : null;
  setVisibleSecondsPreservingAnchor(seconds, anchorSerial, anchorRatio);
}

function zoomTimeAround(factor, clientX = null) {
  const before = getVisibleWindow();
  const ratio = clientX === null ? 0.5 : (plot.clientXToPlotRatio(clientX) ?? 0.5);
  const anchorSerial = before.count > 0
    ? before.startSerial + Math.round(ratio * Math.max(0, before.count - 1))
    : null;
  setVisibleSecondsPreservingAnchor(visibleSeconds * factor, anchorSerial, ratio);
}

function panByFraction(fraction) {
  const visibleSamples = Math.max(MIN_VISIBLE_SAMPLES, Math.round(sampleRate * visibleSeconds));
  viewOffsetSamples += Math.round(visibleSamples * fraction);
  clampViewOffset();
  displayPaused = viewOffsetSamples > 0;
  syncPauseButton();
}

function showLatest() {
  viewOffsetSamples = 0;
  displayPaused = false;
  syncPauseButton();
}

function togglePauseView() {
  displayPaused = !displayPaused;
  if (!displayPaused) {
    viewOffsetSamples = 0;
  }
  syncPauseButton();
}

function syncPauseButton() {
  dom.pauseViewBtn.textContent = displayPaused ? "继续显示" : "暂停显示";
}

function clampViewOffset() {
  const visibleSamples = Math.min(
    availableSamples,
    Math.max(MIN_VISIBLE_SAMPLES, Math.round(sampleRate * visibleSeconds)),
  );
  const maxOffset = Math.max(0, availableSamples - visibleSamples);
  viewOffsetSamples = Math.max(0, Math.min(maxOffset, viewOffsetSamples));
}

function setManualYEnabled(enabled) {
  dom.yMinInput.disabled = !enabled;
  dom.yMaxInput.disabled = !enabled;
}

function setManualYRange(min, max) {
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
    return;
  }

  autoScale = false;
  dom.autoScaleToggle.checked = false;
  setManualYEnabled(true);
  dom.yMinInput.value = formatInputNumber(min);
  dom.yMaxInput.value = formatInputNumber(max);
}

function resetYScale() {
  autoScale = true;
  dom.autoScaleToggle.checked = true;
  setManualYEnabled(false);
}

function zoomYAround(factor, clientY = null) {
  const source = buildPlotSource();
  const yRange = source.yRange;
  const anchor = clientY === null ? (yRange.min + yRange.max) / 2 : (plot.clientYToValue(clientY) ?? ((yRange.min + yRange.max) / 2));
  const min = anchor - (anchor - yRange.min) * factor;
  const max = anchor + (yRange.max - anchor) * factor;
  setManualYRange(min, max);
}

function panYByFraction(fraction) {
  const source = buildPlotSource();
  const span = source.yRange.max - source.yRange.min;
  const shift = span * fraction;
  setManualYRange(source.yRange.min + shift, source.yRange.max + shift);
}

function setRangeUiEnabled(connected) {
  dom.manualRangeSelect.disabled = !connected || dom.autoRangeToggle.checked;
}

function setCursorAtClientX(clientX, cursorName = nextCursorName) {
  const windowInfo = getVisibleWindow();
  const offset = plot.clientXToSampleOffset(clientX);
  if (offset === null || windowInfo.count <= 0) {
    return;
  }

  const safeOffset = Math.max(0, Math.min(windowInfo.count - 1, offset));
  cursors[cursorName].serial = windowInfo.startSerial + safeOffset;
  nextCursorName = cursorName === "a" ? "b" : "a";
}

function nearestCursor(clientX) {
  if (!cursorEnabled) {
    return null;
  }

  const views = getCursorViews(getVisibleWindow());
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

  const rows = ["index,time_s,range_ohm,adc_code,current_uA"];
  for (let i = 0; i < source.visibleSamples; i += 1) {
    const code = source.readVisibleCode(i);
    const rangeOhm = source.readVisibleRange(i);
    const currentUa = source.readVisibleSample(i);
    const time = i / Math.max(1, sampleRate);
    rows.push(`${i},${time.toFixed(9)},${rangeOhm},${code},${currentUa.toFixed(6)}`);
  }

  const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" });
  downloadBlob(blob, `pico-power-scope-${timestampForFile()}.csv`);
  appendLog(`已导出当前窗口 CSV：${source.visibleSamples} 点。`);
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

    if (now - lastStatsUiAt >= STATS_INTERVAL_MS) {
      updateCursorPanel(source);
      updateStats(lastSeq, source.stats.count > 0 ? source.stats : lastStats);
      lastStatsUiAt = now;
    }

    lastDrawAt = now;
  }

  requestAnimationFrame(animationLoop);
}

dom.connectBtn.addEventListener("click", () => connectDevice());
dom.disconnectBtn.addEventListener("click", () => disconnectDevice());
dom.bootloaderBtn.addEventListener("click", () => enterBootloader().catch((err) => appendLog(err.message)));
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

dom.zoomInBtn.addEventListener("click", () => zoomTimeAround(0.5));
dom.zoomOutBtn.addEventListener("click", () => zoomTimeAround(2));
dom.panLeftBtn.addEventListener("click", () => panByFraction(0.25));
dom.panRightBtn.addEventListener("click", () => panByFraction(-0.25));
dom.latestBtn.addEventListener("click", () => showLatest());
dom.zoomYInBtn.addEventListener("click", () => zoomYAround(0.7));
dom.zoomYOutBtn.addEventListener("click", () => zoomYAround(1.4));
dom.panUpBtn.addEventListener("click", () => panYByFraction(-0.2));
dom.panDownBtn.addEventListener("click", () => panYByFraction(0.2));
dom.resetYBtn.addEventListener("click", () => resetYScale());

dom.sampleRateSelect.addEventListener("change", () => {
  sampleRate = Number(dom.sampleRateSelect.value);
  visibleSeconds = clampNumber(visibleSeconds, minVisibleSeconds(), maxVisibleSeconds(), 2);
  clampViewOffset();
  syncTimeWindowInput();
  if (device && device.opened) {
    sendCommand(`SRATE ${sampleRate}`).catch((err) => appendLog(err.message));
  }
});

dom.timeWindowSelect.addEventListener("change", () => {
  setVisibleSecondsFromInput(Number(dom.timeWindowSelect.value));
});

dom.autoScaleToggle.addEventListener("change", () => {
  autoScale = dom.autoScaleToggle.checked;
  setManualYEnabled(!autoScale);
});

dom.autoRangeToggle.addEventListener("change", () => {
  autoRange = dom.autoRangeToggle.checked;
  setRangeUiEnabled(device && device.opened);
  if (device && device.opened) {
    sendCommand(`SET_AUTO_RANGE ${autoRange ? 1 : 0}`).catch((err) => appendLog(err.message));
  }
});

dom.manualRangeSelect.addEventListener("change", () => {
  currentRangeOhm = Number(dom.manualRangeSelect.value) === RANGE_HIGH_OHM ? RANGE_HIGH_OHM : RANGE_LOW_OHM;
  if (device && device.opened && !dom.autoRangeToggle.checked) {
    sendCommand(`SET_RANGE ${currentRangeOhm}`).catch((err) => appendLog(err.message));
  }
});

dom.zeroLowCodeInput.addEventListener("change", () => {
  const cal = calibration();
  dom.zeroLowCodeInput.value = String(Math.round(cal.zeroLowCode));
  updateRangeReadouts();
});

dom.zeroHighCodeInput.addEventListener("change", () => {
  const cal = calibration();
  dom.zeroHighCodeInput.value = String(Math.round(cal.zeroHighCode));
  updateRangeReadouts();
});

dom.senseLowOhmInput.addEventListener("change", () => {
  const cal = calibration();
  dom.senseLowOhmInput.value = String(cal.senseLowOhm);
  updateRangeReadouts();
});

dom.senseHighOhmInput.addEventListener("change", () => {
  const cal = calibration();
  dom.senseHighOhmInput.value = String(cal.senseHighOhm);
  updateRangeReadouts();
});

dom.gridToggle.addEventListener("change", () => {
  showGrid = dom.gridToggle.checked;
});

dom.envelopeToggle.addEventListener("change", () => {
  showEnvelope = dom.envelopeToggle.checked;
});

dom.smoothToggle.addEventListener("change", () => {
  smoothDisplay = dom.smoothToggle.checked;
});

dom.cursorToggle.addEventListener("change", () => {
  cursorEnabled = dom.cursorToggle.checked;
});

dom.yMinInput.addEventListener("change", () => {
  const min = clampNumber(Number(dom.yMinInput.value), -1000000000, 1000000000, -100);
  const max = clampNumber(Number(dom.yMaxInput.value), min + 0.001, 1000000000, 100);
  setManualYRange(min, max);
});

dom.yMaxInput.addEventListener("change", () => {
  const min = clampNumber(Number(dom.yMinInput.value), -1000000000, 1000000000, -100);
  const max = clampNumber(Number(dom.yMaxInput.value), min + 0.001, 1000000000, 100);
  setManualYRange(min, max);
});

plot.canvas.addEventListener("wheel", (event) => {
  event.preventDefault();

  if (event.ctrlKey || event.altKey) {
    const factor = Math.exp(Math.max(-0.5, Math.min(0.5, event.deltaY * 0.0015)));
    zoomYAround(factor, event.clientY);
    return;
  }

  if (event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    panByFraction(delta > 0 ? -0.12 : 0.12);
    return;
  }

  const factor = Math.exp(Math.max(-0.5, Math.min(0.5, event.deltaY * 0.0015)));
  zoomTimeAround(factor, event.clientX);
}, { passive: false });

plot.canvas.addEventListener("pointerdown", (event) => {
  plot.canvas.setPointerCapture(event.pointerId);

  if (cursorEnabled) {
    const cursorName = nearestCursor(event.clientX) || nextCursorName;
    setCursorAtClientX(event.clientX, cursorName);
    activeDrag = { type: "cursor", cursorName };
    return;
  }

  const source = buildPlotSource();
  activeDrag = {
    type: "pan",
    startX: event.clientX,
    startY: event.clientY,
    startOffset: viewOffsetSamples,
    startYRange: source.yRange,
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
    const dy = event.clientY - activeDrag.startY;
    const visibleSamples = Math.max(1, plot.metrics.visibleSamples);
    const samplesPerCssPx = visibleSamples / Math.max(1, plot.metrics.plotWidth / plot.metrics.dpr);
    viewOffsetSamples = activeDrag.startOffset + Math.round(dx * samplesPerCssPx);
    clampViewOffset();
    displayPaused = viewOffsetSamples > 0;
    syncPauseButton();

    if (Math.abs(dy) >= 2) {
      const valuePerCssPx = (activeDrag.startYRange.max - activeDrag.startYRange.min)
        / Math.max(1, plot.metrics.plotHeight / plot.metrics.dpr);
      const shift = dy * valuePerCssPx;
      setManualYRange(activeDrag.startYRange.min + shift, activeDrag.startYRange.max + shift);
    }
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

plot.canvas.addEventListener("dblclick", () => {
  showLatest();
  resetYScale();
});

navigator.usb?.addEventListener("disconnect", (event) => {
  if (device && event.device === device) {
    appendLog("设备已断开。");
    cleanupDevice();
  }
});

setConnectedUi(false);
setManualYEnabled(false);
syncTimeWindowInput();
updateRangeReadouts();
updateStats(null, lastStats);
animationLoop();
