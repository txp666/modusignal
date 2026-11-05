import {
  DEFAULT_CALIBRATION,
  FRAME_FLAGS,
  USB_CONFIG,
  WAVE_FRAME,
  WaveFrameParser,
} from "./protocol.js?v=__ASSET_VERSION__";
import { CommandTransport } from "./commands.js?v=__ASSET_VERSION__";
import { CaptureTimeline } from "./timeline.js?v=__ASSET_VERSION__";
import { WavePlot } from "./plot.js?v=__ASSET_VERSION__";
import { SampleStatistics } from "./statistics.js?v=__ASSET_VERSION__";
import { LowPassMeasurements } from "./lowpass.js?v=__ASSET_VERSION__";
import { EnergyStatistics } from "./energy.js?v=__ASSET_VERSION__";

const SAMPLE_BUFFER_SECONDS = 120;
const MAX_SAMPLE_RATE = 100000;
const SAMPLE_CAPACITY = SAMPLE_BUFFER_SECONDS * MAX_SAMPLE_RATE;
const DRAW_INTERVAL_MS = 33;
const STATS_INTERVAL_MS = 100;
const MIN_VISIBLE_SAMPLES = 2;
const ADS_REF_MV = 2500;
const FRONTEND_GAIN = 50;
const VOLTAGE_MAX_AGE_US = 1500000;
const RANGE_LOW_OHM = 1;
const RANGE_HIGH_OHM = 10;
const FIRMWARE_RELEASE_API_URL = "https://api.github.com/repos/txp666/MicroScope-Power/releases/latest";
const FIRMWARE_RELEASE_LIST_API_URL = "https://api.github.com/repos/txp666/MicroScope-Power/releases?per_page=5";
const FIRMWARE_RELEASES_URL = "https://github.com/txp666/MicroScope-Power/releases";

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
  lowpassToggle: document.querySelector("#lowpassToggle"),
  lowpassCutoffSelect: document.querySelector("#lowpassCutoffSelect"),
  lowpassCutoffInput: document.querySelector("#lowpassCutoffInput"),
  lowpassCustomField: document.querySelector("#lowpassCustomField"),
  filterStateValue: document.querySelector("#filterStateValue"),
  cursorToggle: document.querySelector("#cursorToggle"),
  yMinInput: document.querySelector("#yMinInput"),
  yMaxInput: document.querySelector("#yMaxInput"),
  zoomYInBtn: document.querySelector("#zoomYInBtn"),
  zoomYOutBtn: document.querySelector("#zoomYOutBtn"),
  panUpBtn: document.querySelector("#panUpBtn"),
  panDownBtn: document.querySelector("#panDownBtn"),
  resetYBtn: document.querySelector("#resetYBtn"),
  zeroLowUaInput: document.querySelector("#zeroLowUaInput"),
  zeroHighUaInput: document.querySelector("#zeroHighUaInput"),
  senseLowOhmInput: document.querySelector("#senseLowOhmInput"),
  senseHighOhmInput: document.querySelector("#senseHighOhmInput"),
  largeRangeValue: document.querySelector("#largeRangeValue"),
  smallRangeValue: document.querySelector("#smallRangeValue"),
  zeroNowBtn: document.querySelector("#zeroNowBtn"),
  applyCalBtn: document.querySelector("#applyCalBtn"),
  clearBtn: document.querySelector("#clearBtn"),
  exportCsvBtn: document.querySelector("#exportCsvBtn"),
  exportRawCsvBtn: document.querySelector("#exportRawCsvBtn"),
  exportPngBtn: document.querySelector("#exportPngBtn"),
  clearLogBtn: document.querySelector("#clearLogBtn"),
  logOutput: document.querySelector("#logOutput"),
  viewLabel: document.querySelector("#viewLabel"),
  cursorLabel: document.querySelector("#cursorLabel"),
  stateValue: document.querySelector("#stateValue"),
  firmwareValue: document.querySelector("#firmwareValue"),
  firmwareUpdateRow: document.querySelector("#firmwareUpdateRow"),
  firmwareUpdateValue: document.querySelector("#firmwareUpdateValue"),
  sampleRateValue: document.querySelector("#sampleRateValue"),
  modeValue: document.querySelector("#modeValue"),
  rangeValue: document.querySelector("#rangeValue"),
  seqValue: document.querySelector("#seqValue"),
  droppedValue: document.querySelector("#droppedValue"),
  usbRateValue: document.querySelector("#usbRateValue"),
  currentValue: document.querySelector("#currentValue"),
  avgValue: document.querySelector("#avgValue"),
  minMaxValue: document.querySelector("#minMaxValue"),
  ppValue: document.querySelector("#ppValue"),
  rmsValue: document.querySelector("#rmsValue"),
  rawRmsValue: document.querySelector("#rawRmsValue"),
  rippleValue: document.querySelector("#rippleValue"),
  metricNow: document.querySelector("#metricNow"),
  metricAvg: document.querySelector("#metricAvg"),
  metricPp: document.querySelector("#metricPp"),
  metricRms: document.querySelector("#metricRms"),
  metricRmsLabel: document.querySelector("#metricRmsLabel"),
  measurementVoltageInput: document.querySelector("#measurementVoltageInput"),
  useDeviceVoltageToggle: document.querySelector("#useDeviceVoltageToggle"),
  voltageSourceValue: document.querySelector("#voltageSourceValue"),
  metricPower: document.querySelector("#metricPower"),
  metricEnergy: document.querySelector("#metricEnergy"),
  powerNowValue: document.querySelector("#powerNowValue"),
  powerAvgValue: document.querySelector("#powerAvgValue"),
  energyJValue: document.querySelector("#energyJValue"),
  energyWhValue: document.querySelector("#energyWhValue"),
  energyDurationValue: document.querySelector("#energyDurationValue"),
  energyGapValue: document.querySelector("#energyGapValue"),
  energyCoverageValue: document.querySelector("#energyCoverageValue"),
  resetEnergyBtn: document.querySelector("#resetEnergyBtn"),
  exportEnergyBtn: document.querySelector("#exportEnergyBtn"),
  cursorAValue: document.querySelector("#cursorAValue"),
  cursorBValue: document.querySelector("#cursorBValue"),
  cursorTimeValue: document.querySelector("#cursorTimeValue"),
  cursorDeltaValue: document.querySelector("#cursorDeltaValue"),
};

const ringBuffer = new Uint16Array(SAMPLE_CAPACITY);
const rangeBuffer = new Uint8Array(SAMPLE_CAPACITY);
const timeline = new CaptureTimeline(SAMPLE_CAPACITY);
const sampleStatistics = new SampleStatistics(ringBuffer, rangeBuffer);
const lowpassMeasurements = new LowPassMeasurements(sampleStatistics, timeline);
const energyStatistics = new EnergyStatistics();
let measurementVoltageV = null;
let energyCalibrationKey = null;
let energyLastReceivedAt = -Infinity;
let useDeviceVoltage = true;
let deviceVoltageHistory = [];
let windowStatsCache = null;
const plot = new WavePlot(document.querySelector("#waveCanvas"));

let device = null;
let reading = false;
let commandTransport = null;
let actionBusy = false;
let acceptFrames = false;
let statusPollPending = false;
let nextStatusPollAt = 0;
let adcReadErrors = 0;
let timingOverruns = 0;
let writeIndex = 0;
let availableSamples = 0;
let totalSamplesWritten = 0;
let sampleRate = 100000;
let lastSeq = null;
let droppedFrames = 0;
let currentRangeOhm = RANGE_HIGH_OHM;
const zeroInputSenseOhms = {
  [RANGE_LOW_OHM]: DEFAULT_CALIBRATION.senseLowOhm,
  [RANGE_HIGH_OHM]: DEFAULT_CALIBRATION.senseHighOhm,
};
let autoRange = true;
let bytesReceived = 0;
let bytesWindowStart = performance.now();
let bytesAtWindowStart = 0;
let lastStats = emptyStats();
let state = "IDLE";
let lastCheckedFirmwareVersion = "";
let firmwareCheckGeneration = 0;

let visibleSeconds = 2;
let viewOffsetSamples = 0;
let displayPaused = false;
let autoScale = true;
let showGrid = true;
let showEnvelope = true;
let lowpassEnabled = false;
let lowpassCutoffHz = 1000;
let cursorEnabled = false;
let nextCursorName = "a";
let activeDrag = null;
let plotClockRevision = 0;
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
  dom.connectBtn.disabled = connected || actionBusy;
  dom.disconnectBtn.disabled = !connected;
  for (const control of [dom.bootloaderBtn, dom.startBtn, dom.stopBtn,
    dom.zeroNowBtn, dom.applyCalBtn, dom.autoRangeToggle, dom.sampleRateSelect]) {
    control.disabled = !connected || actionBusy;
  }
  setRangeUiEnabled(connected && !actionBusy);
}

async function runDeviceAction(action) {
  if (actionBusy) return;
  actionBusy = true;
  setConnectedUi(Boolean(device?.opened));
  try {
    await action();
  } catch (error) {
    appendLog(error.message);
  } finally {
    actionBusy = false;
    setConnectedUi(Boolean(device?.opened));
  }
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
      filters: [{ vendorId: USB_CONFIG.vendorId, productId: USB_CONFIG.productId }],
    });

    await device.open();
    // A USB bus reset clears stale endpoint replies from an earlier browser
    // session; it does not reboot the RP2040 or reset the output setpoint.
    await device.reset();
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

    const connectedDevice = device;
    commandTransport = new CommandTransport({
      transferOut: (payload) => connectedDevice.transferOut(USB_CONFIG.endpointOut, payload),
      onInvalidated: (error) => {
        appendLog(error.message);
        cleanupDevice(connectedDevice);
      },
    });
    resetCaptureState();
    setConnectedUi(true);
    setState("IDLE");
    appendLog(`已连接设备 VID=0x${USB_CONFIG.vendorId.toString(16)} PID=0x${USB_CONFIG.productId.toString(16)}`);
    reading = true;
    readLoop(connectedDevice);
    await sendCommand("GET_STATUS");
    acceptFrames = state === "RUNNING";
    nextStatusPollAt = performance.now() + (useDeviceVoltage && deviceVoltageHistory.length > 0 ? 500 : 2000);
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

async function cleanupDevice(expectedDevice = device) {
  if (expectedDevice !== device) return;
  const closingDevice = device;
  device = null;
  reading = false;
  acceptFrames = false;
  commandTransport?.disconnect();
  commandTransport = null;
  parser.reset();
  deviceVoltageHistory = [];
  setConnectedUi(false);
  setState("IDLE");
  dom.firmwareValue.textContent = "-";
  lastCheckedFirmwareVersion = "";
  firmwareCheckGeneration += 1;
  setFirmwareUpdateStatus("等待设备");
  updateEnergyStats();

  if (closingDevice?.opened) {
    try {
        await closingDevice.controlTransferOut({
          requestType: "class",
          recipient: "interface",
          request: 0x22,
          value: 0,
          index: USB_CONFIG.interfaceNumber,
        });
    } catch {}
    try { await closingDevice.releaseInterface(USB_CONFIG.interfaceNumber); } catch {}
    try { await closingDevice.close(); } catch {}
  }
}

function setFirmwareUpdateStatus(text, href = "", highlight = false) {
  dom.firmwareUpdateRow.classList.toggle("highlight", highlight);

  if (!href) {
    dom.firmwareUpdateValue.textContent = text;
    return;
  }

  const link = document.createElement("a");
  link.href = href;
  link.target = "_blank";
  link.rel = "noreferrer";
  link.textContent = text;
  dom.firmwareUpdateValue.replaceChildren(link);
}

function parseFirmwareVersion(version) {
  const normalized = String(version ?? "")
    .trim()
    .replace(/^firmware[-_]?/i, "")
    .replace(/^v/i, "")
    .split("+")[0]
    .split("-")[0];
  const match = normalized.match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?$/);

  if (!match) {
    return null;
  }

  return [Number(match[1]), Number(match[2] ?? 0), Number(match[3] ?? 0)];
}

function compareFirmwareVersions(left, right) {
  for (let i = 0; i < 3; i += 1) {
    if (left[i] > right[i]) return 1;
    if (left[i] < right[i]) return -1;
  }

  return 0;
}

function findFirmwareAsset(release) {
  const assets = Array.isArray(release.assets) ? release.assets : [];
  return assets.find((asset) => /\.uf2$/i.test(asset.name))
    ?? assets.find((asset) => /firmware|pico|scope/i.test(asset.name));
}

async function fetchGitHubJson(url) {
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      Accept: "application/vnd.github+json",
    },
  });

  if (!response.ok) {
    const error = new Error(`GitHub ${response.status}`);
    error.status = response.status;
    throw error;
  }

  return response.json();
}

async function fetchLatestFirmwareRelease() {
  try {
    return await fetchGitHubJson(FIRMWARE_RELEASE_API_URL);
  } catch (err) {
    if (err.status !== 404) {
      throw err;
    }
  }

  const releases = await fetchGitHubJson(FIRMWARE_RELEASE_LIST_API_URL);
  return Array.isArray(releases) ? releases.find((release) => !release.draft) : null;
}

async function checkFirmwareUpdate(localVersion) {
  const version = String(localVersion ?? "").trim();
  if (!version || version === "-") {
    setFirmwareUpdateStatus("等待版本");
    return;
  }

  if (version === lastCheckedFirmwareVersion) {
    return;
  }
  lastCheckedFirmwareVersion = version;
  const generation = ++firmwareCheckGeneration;
  setFirmwareUpdateStatus("检查中...");

  try {
    const release = await fetchLatestFirmwareRelease();
    if (generation !== firmwareCheckGeneration) return;
    if (!release) {
      setFirmwareUpdateStatus("无发布版本", FIRMWARE_RELEASES_URL);
      return;
    }

    const latestVersion = release.tag_name || release.name;
    const latest = parseFirmwareVersion(latestVersion);
    const local = parseFirmwareVersion(version);
    const releaseUrl = release.html_url || FIRMWARE_RELEASES_URL;
    const firmwareAsset = findFirmwareAsset(release);
    const downloadUrl = firmwareAsset?.browser_download_url || releaseUrl;

    if (!latestVersion) {
      setFirmwareUpdateStatus("无发布版本", FIRMWARE_RELEASES_URL);
      return;
    }

    if (!local || !latest) {
      setFirmwareUpdateStatus(`最新 ${latestVersion}`, releaseUrl);
      appendLog(`固件版本无法比较：本地 ${version}，最新 ${latestVersion}`);
      return;
    }

    const comparison = compareFirmwareVersions(local, latest);
    if (comparison < 0) {
      setFirmwareUpdateStatus(`有更新 ${latestVersion}`, downloadUrl, true);
      appendLog(`发现固件更新：本地 ${version}，最新 ${latestVersion}`);
    } else if (comparison === 0) {
      setFirmwareUpdateStatus("已是最新", releaseUrl);
    } else {
      setFirmwareUpdateStatus("本地较新", releaseUrl);
    }
  } catch (err) {
    if (generation !== firmwareCheckGeneration) return;
    if (err.status === 404) {
      setFirmwareUpdateStatus("无法公开检查", FIRMWARE_RELEASES_URL);
      appendLog("固件发布仓库或 Release API 未公开，网页无法自动检查。");
      return;
    }

    setFirmwareUpdateStatus("检查失败", FIRMWARE_RELEASES_URL);
    appendLog(`固件更新检查失败：${err.message}`);
  }
}

async function startCapture() {
  if (state === "RUNNING") await stopCapture();
  await applyCalibration(false);
  await sendCommand(`SRATE ${dom.sampleRateSelect.value}`);
  if (useDeviceVoltage && deviceVoltageHistory.length > 0) await sendCommand("GET_STATUS");
  resetCaptureState();
  sampleRate = Number(dom.sampleRateSelect.value);
  acceptFrames = true;
  try {
    await sendCommand("START");
  } catch (error) {
    acceptFrames = false;
    throw error;
  }
  setState("RUNNING");
  appendLog("开始采集。");
}

async function stopCapture() {
  await sendCommand("STOP");
  acceptFrames = false;
  setState("IDLE");
  updateEnergyStats();
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
  if (!device?.opened || !commandTransport) {
    throw new Error("设备未连接");
  }

  return commandTransport.send(text);
}

async function readLoop(readDevice) {
  while (reading && device === readDevice && readDevice.opened) {
    try {
      const result = await readDevice.transferIn(USB_CONFIG.endpointIn, 2048);
      if (device !== readDevice) return;
      if (result.status !== "ok" || !result.data) throw new Error(`USB 接收失败：${result.status}`);

      const bytes = new Uint8Array(result.data.buffer, result.data.byteOffset, result.data.byteLength);
      bytesReceived += bytes.length;
      parser.push(bytes);
    } catch (err) {
      if (reading && device === readDevice) {
        appendLog(`读取中断：${err.message}`);
      }
      break;
    }
  }

  if (reading && device === readDevice) {
    await cleanupDevice(readDevice);
  }
}

function handleText(text) {
  if (!statusPollPending || !text.startsWith("STATUS ")) appendLog(text);
  commandTransport?.handleText(text);
  if (text === "ERR FAULT") setState("FAULT");

  if (text.startsWith("STATUS ")) {
    const fields = Object.fromEntries(
      text
        .slice("STATUS ".length)
        .split(/\s+/)
        .map((part) => part.split("="))
        .filter((pair) => pair.length === 2),
    );

    recordDeviceVoltage(fields);

    if (fields.state) setState(fields.state);
    if (fields.fw) {
      dom.firmwareValue.textContent = fields.fw;
      checkFirmwareUpdate(fields.fw);
    }
    adcReadErrors = Number(fields.adc_errors || 0);
    timingOverruns = Number(fields.timing_overruns || 0);
    // Background diagnostics must not replace calibration values being edited.
    if (!statusPollPending) {
      if (fields.srate && availableSamples === 0) {
        sampleRate = Number(fields.srate);
        dom.sampleRateSelect.value = String(sampleRate);
      }
      if (fields.range) {
        currentRangeOhm = Number(fields.range) === RANGE_HIGH_OHM ? RANGE_HIGH_OHM : RANGE_LOW_OHM;
        dom.manualRangeSelect.value = String(currentRangeOhm);
      }
      if (fields.sense1_mohm) {
        dom.senseLowOhmInput.value = formatInputNumber(Number(fields.sense1_mohm) / 1000);
      }
      if (fields.sense10_mohm) {
        dom.senseHighOhmInput.value = formatInputNumber(Number(fields.sense10_mohm) / 1000);
      }
      const cal = calibration();
      if (fields.zero1) cal.zeroLowCode = Number(fields.zero1);
      if (fields.zero10) cal.zeroHighCode = Number(fields.zero10);
      if (fields.zero && !fields.zero1 && !fields.zero10) {
        if (currentRangeOhm === RANGE_HIGH_OHM) cal.zeroHighCode = Number(fields.zero);
        else cal.zeroLowCode = Number(fields.zero);
      }
      syncZeroInputs(cal);
      if (energyCalibrationKey !== null && energyCalibrationKey !== energyCalibrationSignature(calibration())) {
        resetEnergyStats();
      }
      if (fields.auto_range) {
        autoRange = fields.auto_range === "1";
        dom.autoRangeToggle.checked = autoRange;
        setRangeUiEnabled(device?.opened && !actionBusy);
      }
    }
  }
}

function handleFrame(frame) {
  if (!acceptFrames || frame.magic !== WAVE_FRAME.magic || frame.count !== WAVE_FRAME.sampleCount) {
    return;
  }

  if ((frame.flags & FRAME_FLAGS.streamStart) ||
      (availableSamples > 0 && sampleRate !== frame.sampleRate)) {
    resetCaptureState();
    droppedFrames = frame.seq;
  }
  sampleRate = frame.sampleRate;

  if (lastSeq !== null) {
    const delta = (frame.seq - lastSeq) & 0xffff;
    if (delta === 0) return;
    if (delta > 1) {
      droppedFrames += delta - 1;
    }
  }
  lastSeq = frame.seq;

  currentRangeOhm = frame.flags & FRAME_FLAGS.range10Ohm ? RANGE_HIGH_OHM : RANGE_LOW_OHM;
  autoRange = Boolean(frame.flags & FRAME_FLAGS.autoRange);
  if (!actionBusy) {
    dom.autoRangeToggle.checked = autoRange;
    dom.manualRangeSelect.value = String(currentRangeOhm);
  }
  setRangeUiEnabled(device?.opened && !actionBusy);

  timeline.append(frame, totalSamplesWritten, {
    legacyTimingOverruns: timingOverruns > 0 && adcReadErrors === 0,
  });
  const cal = calibration();
  const key = energyCalibrationSignature(cal);
  if (energyCalibrationKey !== key) resetEnergyStats();
  const conversion = statisticsConversion(cal)[currentRangeOhm === RANGE_HIGH_OHM ? 1 : 0];
  energyStatistics.append(frame.samples, conversion, timeline.frameAt(totalSamplesWritten), voltageForFrame(frame));
  energyLastReceivedAt = performance.now();
  lastStats = appendSamples(frame.samples, currentRangeOhm);
}

function appendSamples(samples, rangeOhm) {
  sampleStatistics.append(samples, rangeOhm);
  writeIndex = sampleStatistics.writeIndex;
  availableSamples = sampleStatistics.available;
  totalSamplesWritten = sampleStatistics.totalWritten;

  if (displayPaused) {
    viewOffsetSamples += samples.length;
    if (!activeDrag) clampViewOffset();
  }

  return sampleStatistics.query(totalSamplesWritten - samples.length, samples.length, statisticsConversion(calibration()));
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
  const maxOffset = Math.max(0, availableSamples - MIN_VISIBLE_SAMPLES);
  viewOffsetSamples = Math.max(0, Math.min(maxOffset, viewOffsetSamples));
  const endOffset = availableSamples - viewOffsetSamples;
  const oldestSerial = getOldestSerial();
  const endSerial = oldestSerial + endOffset - 1;
  const endTime = timeline.timeAfter(endSerial);
  const startSerial = availableSamples > 0
    ? timeline.lowerBound(endTime - visibleSeconds, oldestSerial, endSerial + 1)
    : oldestSerial;
  const startOffset = startSerial - oldestSerial;
  const count = Math.max(0, endOffset - startOffset);

  return {
    startOffset,
    count,
    startSerial,
    endSerial,
  };
}

function readVisibleSample(offset, windowInfo = getVisibleWindow()) {
  return readByBufferOffset(windowInfo.startOffset + offset);
}

function readVisibleRange(offset, windowInfo = getVisibleWindow()) {
  return readRangeByBufferOffset(windowInfo.startOffset + offset);
}

function readVisibleCurrent(offset, windowInfo = getVisibleWindow(), cal = calibration()) {
  const code = readVisibleSample(offset, windowInfo);
  const rangeOhm = readVisibleRange(offset, windowInfo);
  return codeToMicroamps(code, rangeOhm, cal);
}

function calibration() {
  return {
    zeroLowCode: zeroOffsetCode(RANGE_LOW_OHM),
    zeroHighCode: zeroOffsetCode(RANGE_HIGH_OHM),
    senseLowOhm: normalizedSenseOhms(dom.senseLowOhmInput.value, DEFAULT_CALIBRATION.senseLowOhm),
    senseHighOhm: normalizedSenseOhms(dom.senseHighOhmInput.value, DEFAULT_CALIBRATION.senseHighOhm),
  };
}

function normalizedSenseOhms(value, fallback) {
  return Math.round(clampNumber(Number(value), 0.001, 1000000, fallback) * 1000) / 1000;
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
  return rangeOhm === RANGE_HIGH_OHM ? dom.zeroHighUaInput : dom.zeroLowUaInput;
}

function microampsPerSenseCode(senseOhm) {
  return (ADS_REF_MV * 1000) / (65536 * FRONTEND_GAIN * senseOhm);
}

function zeroOffsetCode(rangeOhm) {
  const scale = microampsPerSenseCode(zeroInputSenseOhms[rangeOhm]);
  return Math.round(clampNumber(Number(zeroInputForRange(rangeOhm).value) / scale, 0, 65535, 0));
}

function syncZeroInputs(cal) {
  for (const rangeOhm of [RANGE_LOW_OHM, RANGE_HIGH_OHM]) {
    const senseOhm = senseOhmForRange(rangeOhm, cal);
    const scale = microampsPerSenseCode(senseOhm);
    const input = zeroInputForRange(rangeOhm);
    const code = Math.round(clampNumber(zeroCodeForRange(rangeOhm, cal), 0, 65535, 0));
    const precision = Math.min(12, Math.max(3, Math.ceil(-Math.log10(scale))));
    input.value = (code * scale).toFixed(precision).replace(/\.?0+$/, "");
    input.max = String(65535 * scale);
    input.step = String(10 ** -precision);
    zeroInputSenseOhms[rangeOhm] = senseOhm;
  }
}

function microampsPerCode(rangeOhm = currentRangeOhm, cal = calibration()) {
  return microampsPerSenseCode(senseOhmForRange(rangeOhm, cal));
}

function codeToMicroamps(code, rangeOhm = currentRangeOhm, cal = calibration()) {
  return (code - zeroCodeForRange(rangeOhm, cal)) * microampsPerCode(rangeOhm, cal);
}

function formatUa(value) {
  return `${value.toFixed(3)} µA`;
}

function energyCalibrationSignature(cal) {
  return `${cal.zeroLowCode}:${cal.zeroHighCode}:${cal.senseLowOhm}:${cal.senseHighOhm}`;
}

function recordDeviceVoltage(fields) {
  if (fields.vout_mv === undefined || fields.vout_t_us === undefined) return;
  if (!/^\d+$/.test(fields.vout_mv) || !/^\d+$/.test(fields.vout_t_us) ||
      fields.vout_age_us !== undefined && !/^\d+$/.test(fields.vout_age_us)) return;
  const mv = Number(fields.vout_mv);
  const tUs = Number(fields.vout_t_us);
  if (!Number.isFinite(mv) || mv < 0 || mv > 6600 || !Number.isInteger(tUs) || tUs < 0 || tUs > 0xffffffff) return;
  const ageUs = Number(fields.vout_age_us || 0);
  if (!Number.isFinite(ageUs) || ageUs < 0 || ageUs > VOLTAGE_MAX_AGE_US) return;
  const previous = deviceVoltageHistory.at(-1);
  if (previous && previous.tUs === tUs) return;
  deviceVoltageHistory.push({ volts: mv / 1000, tUs, receivedAt: performance.now() - ageUs / 1000 });
  if (deviceVoltageHistory.length > 64) deviceVoltageHistory.shift();
  updateEnergyStats();
}

function voltageForFrame(frame) {
  if (!useDeviceVoltage) return measurementVoltageV;
  // Device timestamps select the latest known voltage preceding this frame,
  // even when USB has queued older current frames or the 32-bit timer rolls over.
  for (let i = deviceVoltageHistory.length - 1; i >= 0; i -= 1) {
    const voltage = deviceVoltageHistory[i];
    const ageUs = ((frame.t0Us >>> 0) - voltage.tUs) >>> 0;
    if (ageUs <= VOLTAGE_MAX_AGE_US) return voltage.volts;
  }
  return null;
}

function recentDeviceVoltage() {
  const latest = deviceVoltageHistory.at(-1);
  return latest && performance.now() - latest.receivedAt <= VOLTAGE_MAX_AGE_US / 1000 ? latest : null;
}

function resetEnergyStats() {
  energyStatistics.reset();
  energyCalibrationKey = energyCalibrationSignature(calibration());
  energyLastReceivedAt = -Infinity;
  updateEnergyStats();
}

function formatPower(watts) {
  if (!Number.isFinite(watts)) return "—";
  const magnitude = Math.abs(watts);
  if (magnitude < 0.001) return `${(watts * 1e6).toFixed(3)} µW`;
  if (magnitude < 1) return `${(watts * 1000).toFixed(3)} mW`;
  return `${watts.toFixed(3)} W`;
}

function formatEnergy(joules) {
  if (!Number.isFinite(joules)) return "—";
  const magnitude = Math.abs(joules);
  if (magnitude > 0 && magnitude < 0.001) return `${(joules * 1e6).toFixed(3)} µJ`;
  if (magnitude < 1) return `${(joules * 1000).toFixed(3)} mJ`;
  return `${joules.toFixed(3)} J`;
}

function currentEnergyPower(stats) {
  return device?.opened && state === "RUNNING" && performance.now() - energyLastReceivedAt <= 1500 && (!useDeviceVoltage || recentDeviceVoltage())
    ? stats.lastWatts : null;
}

function updateEnergyStats() {
  const stats = energyStatistics.snapshot(measurementVoltageV);
  const voltage = recentDeviceVoltage();
  dom.useDeviceVoltageToggle.checked = useDeviceVoltage;
  dom.measurementVoltageInput.readOnly = useDeviceVoltage && deviceVoltageHistory.length > 0;
  if (useDeviceVoltage) {
    if (document.activeElement !== dom.measurementVoltageInput) {
      dom.measurementVoltageInput.value = voltage ? voltage.volts.toFixed(3) : "";
    }
    dom.voltageSourceValue.textContent = voltage ? "实测输出 · 约 2 Hz" : deviceVoltageHistory.length ? "实测电压已过期" : "等待设备／可手动填写";
  } else {
    dom.voltageSourceValue.textContent = measurementVoltageV === null ? "请填写供电电压" : `手动恒压 · ${measurementVoltageV} V`;
  }
  const power = formatPower(currentEnergyPower(stats));
  const energy = formatEnergy(stats.energyJoules);
  dom.metricPower.textContent = power;
  dom.powerNowValue.textContent = power;
  dom.powerAvgValue.textContent = formatPower(stats.averageWatts);
  dom.metricEnergy.textContent = energy;
  dom.energyJValue.textContent = energy;
  dom.energyWhValue.textContent = stats.energyJoules === null ? "—" : `${(stats.energyJoules / 3.6).toFixed(6)} mWh`;
  dom.energyDurationValue.textContent = formatSeconds(stats.durationSeconds);
  dom.energyGapValue.textContent = `${stats.gapCount} 次 · ${formatSeconds(stats.missingSeconds)}`;
  dom.energyCoverageValue.textContent = formatSeconds(stats.voltageMissingSeconds);
  dom.metricEnergy.title = `自本次开始或重置以来的估算能量，电压有效覆盖 ${formatSeconds(stats.energyDurationSeconds)}`;
}

function applyMeasurementVoltage() {
  const input = dom.measurementVoltageInput.value.trim();
  const voltage = input === "" ? null : Number(input);
  const valid = voltage === null || Number.isFinite(voltage) && voltage >= 0.01 && voltage <= 6;
  if (!valid) {
    appendLog("请输入 0.01～6 V 的供电电压。");
    dom.measurementVoltageInput.value = measurementVoltageV === null ? "" : String(measurementVoltageV);
    return;
  }
  if (useDeviceVoltage || voltage !== measurementVoltageV) {
    useDeviceVoltage = false;
    measurementVoltageV = voltage;
    resetEnergyStats();
  }
}

function formatHertz(value) {
  return value >= 1000 ? `${Number((value / 1000).toFixed(3))} kHz` : `${Number(value.toFixed(3))} Hz`;
}

function effectiveLowpassCutoff() {
  const measured = availableSamples > 0 ? lowpassMeasurements.effectiveCutoffHz : 0;
  return measured > 0 ? measured : Math.min(lowpassCutoffHz, sampleRate * 0.45);
}

function syncLowpassControls() {
  const custom = dom.lowpassCutoffSelect.value === "custom";
  dom.lowpassCutoffSelect.disabled = !lowpassEnabled;
  dom.lowpassCustomField.hidden = !custom;
  dom.lowpassCutoffInput.disabled = !lowpassEnabled || !custom;
  dom.exportRawCsvBtn.hidden = !lowpassEnabled;
  dom.exportCsvBtn.textContent = lowpassEnabled ? "低通 CSV" : "导出 CSV";
  const effective = effectiveLowpassCutoff();
  dom.filterStateValue.textContent = lowpassEnabled
    ? `${formatHertz(effective)}${effective + 1e-6 < lowpassCutoffHz ? "（受采样率限制）" : ""}`
    : "关闭，原始数据";
  dom.filterStateValue.title = lowpassEnabled
    ? `一阶低通，目标截止频率 ${formatHertz(lowpassCutoffHz)}；按设备时间轴计算，频率不超过实际采样率的 45%。`
    : "曲线、统计与导出使用原始数据。";
}

function refreshLowpassView() {
  windowStatsCache = null;
  const source = buildPlotSource();
  plot.draw(source);
  updateViewLabels(source);
  updateCursorPanel(source);
  updateStats(lastSeq, source.stats, source.rawStats);
}

function applyLowpassCutoff() {
  const input = dom.lowpassCutoffSelect.value === "custom" ? dom.lowpassCutoffInput.value : dom.lowpassCutoffSelect.value;
  lowpassCutoffHz = clampNumber(Number(input), 1, 45000, lowpassCutoffHz);
  dom.lowpassCutoffInput.value = String(lowpassCutoffHz);
  refreshLowpassView();
}

function formatInputNumber(value) {
  if (Math.abs(value) >= 1000) {
    return value.toFixed(3).replace(/\.?0+$/, "");
  }
  return value.toFixed(6).replace(/\.?0+$/, "");
}

function statisticsConversion(cal) {
  return [RANGE_LOW_OHM, RANGE_HIGH_OHM].map((rangeOhm) => ({
    zero: zeroCodeForRange(rangeOhm, cal),
    scale: microampsPerCode(rangeOhm, cal),
  }));
}

function statisticsKey(windowInfo, cal) {
  return `${sampleStatistics.generation}:${windowInfo.startSerial}:${windowInfo.count}`
    + `:${cal.zeroLowCode}:${cal.zeroHighCode}:${cal.senseLowOhm}:${cal.senseHighOhm}`;
}

function computeWindowStats(windowInfo, conversion, key, measurements = sampleStatistics) {
  if (windowInfo.count <= 0) return emptyStats();
  if (windowStatsCache?.key === key) return windowStatsCache.stats;
  const stats = measurements.query(windowInfo.startSerial, windowInfo.count, conversion);
  windowStatsCache = { key, stats };
  return stats;
}

function yRangeFromStats(stats) {
  if (!autoScale || stats.count <= 0) {
    const min = clampNumber(Number(dom.yMinInput.value), -1000000000, 1000000000, -100);
    const max = clampNumber(Number(dom.yMaxInput.value), min + 0.001, 1000000000, 100);
    return { min, max };
  }

  const displayMin = stats.min;
  const displayMax = stats.max;

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
  if (activeDrag && !dragCaptureIsRetained(activeDrag)) cancelPlotDrag();
  const frozenView = activeDrag;
  const windowInfo = frozenView
    ? { ...frozenView.currentWindowInfo, startOffset: frozenView.currentWindowInfo.startSerial - getOldestSerial() }
    : getVisibleWindow();
  const cal = calibration();
  const conversion = statisticsConversion(cal);
  const requestedCutoffHz = lowpassCutoffHz;
  const lowpass = lowpassEnabled ? lowpassMeasurements.sync(requestedCutoffHz) : null;
  const measurements = lowpass?.statistics || sampleStatistics;
  const dataKey = statisticsKey(windowInfo, cal) + (lowpass ? `:lowpass:${lowpassCutoffHz}:${lowpass.revision}` : ":raw")
    + (frozenView ? `:clock:${frozenView.currentClock.revision}` : "");
  const stats = computeWindowStats(windowInfo, conversion, dataKey, measurements);
  const rawStats = lowpass ? sampleStatistics.query(windowInfo.startSerial, windowInfo.count, conversion) : stats;
  const yRange = activeDrag ? activeDrag.currentYRange : yRangeFromStats(stats);
  const cursorViews = getCursorViews(windowInfo);
  const clock = frozenView?.currentClock || timeline;
  const timeStart = frozenView ? frozenView.currentTimeStart : windowInfo.count ? timeline.timeAt(windowInfo.startSerial) : 0;
  const timeEnd = frozenView ? frozenView.currentTimeEnd : windowInfo.count ? timeline.timeAfter(windowInfo.endSerial) : visibleSeconds;

  return {
    available: availableSamples,
    sampleRate,
    visibleSamples: windowInfo.count,
    viewOffsetSamples,
    showGrid,
    showEnvelope,
    smoothDisplay: false,
    cursorEnabled,
    cursors: cursorViews,
    yRange,
    stats,
    rawStats,
    lowpassEnabled,
    windowInfo,
    dataKey,
    timeStart,
    timeEnd,
    offsetSeconds: windowInfo.count ? timeline.timeAt(totalSamplesWritten - 1) - timeline.timeAt(windowInfo.endSerial) : 0,
    timeSegments: frozenView ? frozenView.currentClock.timeSegments
      : lowpass ? lowpass.segments(windowInfo.startSerial, windowInfo.count) : timeline.segments(windowInfo.startSerial, windowInfo.count),
    readVisibleTime: (offset) => clock.timeAt(windowInfo.startSerial + offset),
    timeToOffset: (time) => clock.lowerBound(time, windowInfo.startSerial, windowInfo.endSerial + 1) - windowInfo.startSerial,
    readVisibleAggregate: (start, end) => {
      const first = Math.max(0, Math.min(windowInfo.count, Math.floor(start)));
      const stop = Math.max(first, Math.min(windowInfo.count, Math.floor(end)));
      return measurements.query(windowInfo.startSerial + first, stop - first, conversion);
    },
    readVisibleSample: (offset) => codeToMicroamps(measurements.codes[(windowInfo.startSerial + offset) % SAMPLE_CAPACITY], readVisibleRange(offset, windowInfo), cal),
    readRawSample: (offset) => readVisibleCurrent(offset, windowInfo, cal),
    readFilterCutoff: (offset) => Math.min(requestedCutoffHz, 0.45 / (lowpass ? lowpass.samplePeriodAt(windowInfo.startSerial + offset) : 1 / sampleRate)),
    readVisibleRange: (offset) => readVisibleRange(offset, windowInfo),
  };
}

function updateStats(seq = lastSeq, stats = null, rawStats = null) {
  if (!stats) {
    const source = buildPlotSource();
    stats = source.stats;
    rawStats = source.rawStats;
  }
  rawStats ||= stats;
  dom.sampleRateValue.textContent = `${sampleRate} SPS`;
  dom.modeValue.textContent = `ADS8866 ADC${adcReadErrors ? ` · 读取超时 ${adcReadErrors}` : ""}${timingOverruns ? ` · 时序超限 ${timingOverruns}` : ""}`;
  dom.rangeValue.textContent = `${currentRangeOhm} Ω${autoRange ? " 自动" : " 手动"}`;
  dom.seqValue.textContent = seq === null ? "-" : String(seq);
  dom.droppedValue.textContent = String(droppedFrames);
  dom.currentValue.textContent = formatUa(stats.last);
  dom.avgValue.textContent = stats.count > 0 ? formatUa(stats.avg) : "0.000 µA";
  dom.minMaxValue.textContent = `${formatUa(stats.min)} / ${formatUa(stats.max)}`;
  dom.ppValue.textContent = formatUa(Math.abs(stats.pp));
  dom.rmsValue.textContent = formatUa(stats.rms);
  dom.rawRmsValue.textContent = formatUa(rawStats.rms);
  dom.rippleValue.textContent = `${stats.ppPercent.toFixed(4)} %`;
  dom.metricNow.textContent = formatUa(stats.last);
  dom.metricAvg.textContent = stats.count > 0 ? formatUa(stats.avg) : "0.000 µA";
  dom.metricPp.textContent = formatUa(Math.abs(stats.pp));
  dom.metricRms.textContent = formatUa(stats.rms);
  dom.metricRmsLabel.textContent = lowpassEnabled ? "低通 RMS" : "RMS 噪声";
  updateEnergyStats();
  syncLowpassControls();
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
  return `${lowUa.toFixed(2)} .. ${highUa.toFixed(2)} µA`;
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
    ? source.timeEnd - source.timeStart
    : visibleSeconds;
  const offsetSeconds = source.offsetSeconds;
  const followText = viewOffsetSamples === 0 ? "跟随最新" : `回看 ${formatSeconds(offsetSeconds)}`;
  const processing = lowpassEnabled ? `，低通 ${formatHertz(effectiveLowpassCutoff())}` : "";
  dom.viewLabel.textContent = `窗口 ${formatSeconds(windowSeconds)}，${followText}${processing}，Y ${source.yRange.min.toFixed(3)}..${source.yRange.max.toFixed(3)} µA`;
  dom.viewLabel.title = dom.viewLabel.textContent;
}

function updateCursorPanel(source) {
  const views = source.cursors;
  const a = cursorInfoFromView(views.a, source);
  const b = cursorInfoFromView(views.b, source);

  dom.cursorAValue.textContent = a ? `${a.timeText}, ${formatUa(a.currentUa)}` : "-";
  dom.cursorBValue.textContent = b ? `${b.timeText}, ${formatUa(b.currentUa)}` : "-";

  if (!cursorEnabled) {
    dom.cursorLabel.textContent = "游标未启用";
    dom.cursorLabel.title = dom.cursorLabel.textContent;
    dom.cursorTimeValue.textContent = "-";
    dom.cursorDeltaValue.textContent = "-";
    return;
  }

  if (!a || !b) {
    dom.cursorLabel.textContent = "点击曲线设置 A/B 游标";
    dom.cursorLabel.title = dom.cursorLabel.textContent;
    dom.cursorTimeValue.textContent = "-";
    dom.cursorDeltaValue.textContent = "-";
    return;
  }

  const dt = Math.abs(b.time - a.time);
  const frequency = dt > 0 ? 1 / dt : 0;
  const dCurrent = b.currentUa - a.currentUa;
  dom.cursorLabel.textContent = `A-B: ΔT ${formatSeconds(dt)}，ΔI ${formatUa(dCurrent)}`;
  dom.cursorLabel.title = dom.cursorLabel.textContent;
  dom.cursorTimeValue.textContent = `${formatSeconds(dt)} / ${frequency.toFixed(2)} Hz`;
  dom.cursorDeltaValue.textContent = formatUa(dCurrent);
}

function cursorInfoFromView(view, source) {
  if (!view || view.sampleOffset === null) {
    return null;
  }

  const serial = source.windowInfo.startSerial + view.sampleOffset;
  const currentUa = source.readVisibleSample(view.sampleOffset);
  const time = source.readVisibleTime(view.sampleOffset);
  const t = time - source.timeStart;
  return {
    serial,
    time,
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
  cancelPlotDrag(false);
  timeline.reset();
  writeIndex = 0;
  availableSamples = 0;
  totalSamplesWritten = 0;
  rangeBuffer.fill(0);
  sampleStatistics.reset();
  lowpassMeasurements.reset();
  windowStatsCache = null;
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
  resetEnergyStats();
  syncPauseButton();
  updateStats(null, lastStats);
}

async function applyCalibration(logResult = true) {
  const cal = calibration();
  syncZeroInputs(cal);
  dom.senseLowOhmInput.value = String(cal.senseLowOhm);
  dom.senseHighOhmInput.value = String(cal.senseHighOhm);
  resetEnergyStats();

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
  if (availableSamples === 0) throw new Error("请先采集空载数据，再进行归零。");
  const rangeOhm = currentRangeOhm;
  const zero = Math.round(codeAverageForRange(rangeOhm));
  if (!Number.isFinite(zero)) throw new Error("没有当前量程的有效数据，请先采集后归零。");
  const cal = calibration();
  if (rangeOhm === RANGE_HIGH_OHM) cal.zeroHighCode = zero;
  else cal.zeroLowCode = zero;
  syncZeroInputs(cal);
  await applyCalibration();
}

function codeAverageForRange(rangeOhm) {
  if (lastStats.count > 0 && lastStats.rangeOhm === rangeOhm) {
    return lastStats.avgCode;
  }

  const windowInfo = getVisibleWindow();
  if (windowInfo.count <= 0) {
    return NaN;
  }

  const ranges = sampleStatistics.queryRaw(windowInfo.startSerial, windowInfo.count);
  const raw = ranges[rangeOhm === RANGE_HIGH_OHM ? 1 : 0];
  return raw.count > 0 ? raw.sum / raw.count : NaN;
}

function clearBuffer() {
  cancelPlotDrag(false);
  timeline.reset();
  writeIndex = 0;
  availableSamples = 0;
  totalSamplesWritten = 0;
  rangeBuffer.fill(0);
  sampleStatistics.reset();
  lowpassMeasurements.reset();
  windowStatsCache = null;
  viewOffsetSamples = 0;
  displayPaused = false;
  cursors.a.serial = null;
  cursors.b.serial = null;
  nextCursorName = "a";
  lastStats = emptyStats();
  resetEnergyStats();
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
  dom.timeWindowSelect.value = Number(visibleSeconds.toPrecision(4)).toString();
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
  dom.pauseViewBtn.textContent = displayPaused ? "继续" : "暂停";
}

function clampViewOffset() {
  const maxOffset = availableSamples > 0 ? totalSamplesWritten - 1 - earliestViewEndSerial() : 0;
  viewOffsetSamples = Math.max(0, Math.min(maxOffset, viewOffsetSamples));
}

function earliestViewEndSerial() {
  const oldest = getOldestSerial();
  if (availableSamples <= MIN_VISIBLE_SAMPLES) return totalSamplesWritten - 1;
  const targetTime = timeline.timeAt(oldest) + visibleSeconds;
  let end = Math.max(oldest + MIN_VISIBLE_SAMPLES - 1,
    timeline.lowerBound(targetTime, oldest, totalSamplesWritten) - 1);
  if (end < totalSamplesWritten - 1 && timeline.timeAfter(end) + 1e-12 < targetTime) end += 1;
  return Math.min(totalSamplesWritten - 1, end);
}

function setViewEndTime(time) {
  const oldest = getOldestSerial();
  const end = Math.max(earliestViewEndSerial(), Math.min(totalSamplesWritten - 1,
    timeline.lowerBound(time, oldest, totalSamplesWritten) - 1));
  viewOffsetSamples = Math.max(0, totalSamplesWritten - end - 1);
  displayPaused = true;
  syncPauseButton();
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

function dragCaptureIsRetained(drag) {
  return drag.generation === sampleStatistics.generation &&
    drag.windowInfo.startSerial >= getOldestSerial() && drag.windowInfo.endSerial < totalSamplesWritten &&
    drag.currentWindowInfo.startSerial >= getOldestSerial() && drag.currentWindowInfo.endSerial < totalSamplesWritten;
}

function capturePlotClock(windowInfo, timeSegments) {
  const frameSize = timeline.frameSize;
  const firstFrame = Math.floor(windowInfo.startSerial / frameSize) * frameSize;
  const entries = [];
  for (let serial = firstFrame; serial <= windowInfo.endSerial; serial += frameSize) {
    const frame = timeline.frameAt(serial);
    entries.push({ startSerial: frame.startSerial, time: frame.time, period: frame.period });
  }
  const frameAt = (serial) => entries[Math.floor((serial - firstFrame) / frameSize)];
  const timeAt = (serial) => {
    const frame = frameAt(serial);
    return frame ? frame.time + (serial - frame.startSerial) * frame.period : NaN;
  };
  return {
    revision: ++plotClockRevision,
    timeSegments: timeSegments.map((segment) => ({ ...segment })),
    timeAt,
    timeAfter: (serial) => {
      const frame = frameAt(serial);
      return frame ? frame.time + (serial - frame.startSerial + 1) * frame.period : NaN;
    },
    lowerBound: (time, start, end) => {
      let lo = start;
      let hi = end;
      while (lo < hi) {
        const mid = Math.floor((lo + hi) / 2);
        if (timeAt(mid) + 1e-12 < time) lo = mid + 1;
        else hi = mid;
      }
      return lo;
    },
  };
}

function cancelPlotDrag(restore = true) {
  const drag = activeDrag;
  activeDrag = null;
  plot.setSelectionBox(null);
  plot.canvas.classList.toggle("is-panning", false);
  if (!drag) return;
  if (restore && drag.generation === sampleStatistics.generation) {
    visibleSeconds = drag.previous.visibleSeconds;
    displayPaused = drag.previous.displayPaused;
    viewOffsetSamples = displayPaused ? Math.max(0, totalSamplesWritten - drag.windowInfo.endSerial - 1) : 0;
    clampViewOffset();
    autoScale = drag.previous.autoScale;
    dom.autoScaleToggle.checked = autoScale;
    dom.yMinInput.value = drag.previous.yMin;
    dom.yMaxInput.value = drag.previous.yMax;
    setManualYEnabled(!autoScale);
    syncPauseButton();
    syncTimeWindowInput();
  }
  if (plot.canvas.hasPointerCapture(drag.pointerId)) plot.canvas.releasePointerCapture(drag.pointerId);
}

function redrawPlotInteraction() {
  const source = buildPlotSource();
  plot.draw(source);
  updateViewLabels(source);
}

function movePlotDrag(event) {
  const drag = activeDrag;
  if (!drag || event.pointerId !== drag.pointerId) return;
  if (!dragCaptureIsRetained(drag)) {
    cancelPlotDrag();
    return;
  }
  if (event.clientX === drag.lastX && event.clientY === drag.lastY) return;
  drag.lastX = event.clientX;
  drag.lastY = event.clientY;
  const dx = event.clientX - drag.startX;
  const dy = event.clientY - drag.startY;
  drag.moved ||= Math.hypot(dx, dy) >= 4;
  drag.endPoint = plot.clientPointToPlot(event.clientX, event.clientY, drag.geometry, true);
  if (!drag.moved) return;
  if (drag.type === "box") {
    plot.setSelectionBox({ x1: drag.startPoint.x, y1: drag.startPoint.y, x2: drag.endPoint.x, y2: drag.endPoint.y });
  } else {
    const timeShift = dx / drag.geometry.width * (drag.timeEnd - drag.timeStart);
    setViewEndTime(drag.timeEnd - timeShift);
    drag.currentWindowInfo = { ...getVisibleWindow() };
    drag.currentTimeStart = timeline.timeAt(drag.currentWindowInfo.startSerial);
    drag.currentTimeEnd = timeline.timeAfter(drag.currentWindowInfo.endSerial);
    const segments = lowpassEnabled ? lowpassMeasurements.segments(drag.currentWindowInfo.startSerial, drag.currentWindowInfo.count)
      : timeline.segments(drag.currentWindowInfo.startSerial, drag.currentWindowInfo.count);
    drag.currentClock = capturePlotClock(drag.currentWindowInfo, segments);
    const shift = dy / drag.geometry.height * (drag.startYRange.max - drag.startYRange.min);
    drag.currentYRange = { min: drag.startYRange.min + shift, max: drag.startYRange.max + shift };
    setManualYRange(drag.currentYRange.min, drag.currentYRange.max);
  }
  redrawPlotInteraction();
}

function applySelectionBox(drag) {
  const { startPoint: first, endPoint: last, geometry } = drag;
  if (!last || Math.abs(last.x - first.x) * geometry.width < 6 || Math.abs(last.y - first.y) * geometry.height < 6) return false;
  const span = drag.timeEnd - drag.timeStart;
  const leftTime = drag.timeStart + Math.min(first.x, last.x) * span;
  const rightTime = drag.timeStart + Math.max(first.x, last.x) * span;
  const firstSerial = drag.windowInfo.startSerial + drag.source.timeToOffset(leftTime);
  const endExclusive = Math.min(drag.windowInfo.endSerial + 1,
    drag.windowInfo.startSerial + drag.source.timeToOffset(rightTime));
  if (endExclusive - firstSerial < MIN_VISIBLE_SAMPLES) return false;
  // Fit the real retained points, including device-time gaps. Nominal SPS must
  // not shift a selected region or enlarge a two-point selection.
  visibleSeconds = Math.min(maxVisibleSeconds(), drag.initialClock.timeAfter(endExclusive - 1) - drag.initialClock.timeAt(firstSerial));
  drag.selectedSerials = { first: firstSerial, endExclusive };
  viewOffsetSamples = Math.max(0, totalSamplesWritten - endExclusive);
  displayPaused = true;
  const ySpan = drag.startYRange.max - drag.startYRange.min;
  setManualYRange(drag.startYRange.max - Math.max(first.y, last.y) * ySpan,
    drag.startYRange.max - Math.min(first.y, last.y) * ySpan);
  syncPauseButton();
  syncTimeWindowInput();
  return true;
}

function exportCsv(rawOnly = false) {
  const source = buildPlotSource();
  if (source.visibleSamples <= 0) {
    appendLog("没有可导出的波形数据。");
    return;
  }

  const filtered = source.lowpassEnabled && !rawOnly;
  const rows = [filtered
    ? "index,time_s,range_ohm,current_uA,raw_current_uA,lowpass_cutoff_hz"
    : "index,time_s,range_ohm,current_uA"];
  for (let i = 0; i < source.visibleSamples; i += 1) {
    const rangeOhm = source.readVisibleRange(i);
    const currentUa = rawOnly ? source.readRawSample(i) : source.readVisibleSample(i);
    const time = source.readVisibleTime(i) - source.timeStart;
    const rawFields = filtered ? `,${source.readRawSample(i).toFixed(6)},${source.readFilterCutoff(i).toFixed(6)}` : "";
    rows.push(`${i},${time.toFixed(9)},${rangeOhm},${currentUa.toFixed(6)}${rawFields}`);
  }

  const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" });
  const mode = filtered ? `lowpass-${lowpassCutoffHz}Hz-` : "";
  downloadBlob(blob, `pico-power-scope-${mode}${timestampForFile()}.csv`);
  appendLog(`已导出当前窗口${filtered ? "低通" : "原始"} CSV：${source.visibleSamples} 点。`);
}

function exportEnergyCsv() {
  const stats = energyStatistics.snapshot(measurementVoltageV);
  if (stats.count === 0) {
    appendLog("没有可导出的功率与能量统计。");
    return;
  }
  const voltage = useDeviceVoltage ? recentDeviceVoltage()?.volts ?? null : measurementVoltageV;
  const fields = {
    voltage_source: useDeviceVoltage ? "measured_voltage_hold" : "manual_constant",
    current_source: "raw_calibrated",
    estimated: "true",
    voltage_V: voltage,
    power_now_W: currentEnergyPower(stats),
    power_average_W: stats.averageWatts,
    energy_J: stats.energyJoules,
    energy_Wh: stats.energyJoules === null ? null : stats.energyJoules / 3600,
    duration_s: stats.durationSeconds,
    energy_duration_s: stats.energyDurationSeconds,
    sample_count: stats.count,
    gap_count: stats.gapCount,
    missing_s: stats.missingSeconds,
    voltage_missing_s: stats.voltageMissingSeconds,
  };
  const csv = `${Object.keys(fields).join(",")}\n${Object.values(fields).map((value) => value === null ? "" : String(value)).join(",")}\n`;
  downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), `pico-power-energy-${timestampForFile()}.csv`);
  appendLog("已导出本次功率与能量统计 CSV。");
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
  if (device?.opened && !actionBusy && !statusPollPending && now >= nextStatusPollAt) {
    const pollDevice = device;
    statusPollPending = true;
    nextStatusPollAt = now + (useDeviceVoltage && deviceVoltageHistory.length > 0 ? 500 : 2000);
    sendCommand("GET_STATUS").catch((error) => {
      if (device === pollDevice) appendLog(error.message);
    }).finally(() => { statusPollPending = false; });
  }

  if (now - lastDrawAt >= DRAW_INTERVAL_MS) {
    const source = buildPlotSource();
    plot.draw(source);
    updateViewLabels(source);

    if (now - lastStatsUiAt >= STATS_INTERVAL_MS) {
      updateCursorPanel(source);
      updateStats(lastSeq, source.stats.count > 0 ? source.stats : lastStats, source.rawStats);
      lastStatsUiAt = now;
    }

    lastDrawAt = now;
  }

  requestAnimationFrame(animationLoop);
}

dom.connectBtn.addEventListener("click", () => runDeviceAction(connectDevice));
dom.disconnectBtn.addEventListener("click", () => disconnectDevice());
dom.bootloaderBtn.addEventListener("click", () => runDeviceAction(enterBootloader));
dom.startBtn.addEventListener("click", () => runDeviceAction(startCapture));
dom.stopBtn.addEventListener("click", () => runDeviceAction(stopCapture));
dom.applyCalBtn.addEventListener("click", () => runDeviceAction(applyCalibration));
dom.zeroNowBtn.addEventListener("click", () => runDeviceAction(zeroNow));
dom.pauseViewBtn.addEventListener("click", () => togglePauseView());
dom.clearBtn.addEventListener("click", () => clearBuffer());
dom.exportCsvBtn.addEventListener("click", () => exportCsv());
dom.exportRawCsvBtn.addEventListener("click", () => exportCsv(true));
dom.measurementVoltageInput.addEventListener("change", () => applyMeasurementVoltage());
dom.useDeviceVoltageToggle.addEventListener("change", () => {
  useDeviceVoltage = dom.useDeviceVoltageToggle.checked;
  if (!useDeviceVoltage) {
    const voltage = Number(dom.measurementVoltageInput.value);
    measurementVoltageV = Number.isFinite(voltage) && voltage >= 0.01 && voltage <= 6 ? voltage : null;
  }
  nextStatusPollAt = 0;
  resetEnergyStats();
});
dom.resetEnergyBtn.addEventListener("click", () => resetEnergyStats());
dom.exportEnergyBtn.addEventListener("click", () => exportEnergyCsv());
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

dom.sampleRateSelect.addEventListener("change", () => runDeviceAction(async () => {
  const requestedRate = Number(dom.sampleRateSelect.value);
  const restart = state === "RUNNING";
  try {
    if (restart) await stopCapture();
    await sendCommand(`SRATE ${requestedRate}`);
    resetCaptureState();
    sampleRate = requestedRate;
    if (restart) {
      acceptFrames = true;
      await sendCommand("START");
      setState("RUNNING");
    }
    visibleSeconds = clampNumber(visibleSeconds, minVisibleSeconds(), maxVisibleSeconds(), 2);
    syncTimeWindowInput();
    appendLog("采样率已确认，已开始新的采集段。");
  } catch (error) {
    acceptFrames = Boolean(device?.opened) && state === "RUNNING";
    dom.sampleRateSelect.value = String(sampleRate);
    throw error;
  }
}));

dom.timeWindowSelect.addEventListener("change", () => {
  setVisibleSecondsFromInput(Number(dom.timeWindowSelect.value));
});

dom.autoScaleToggle.addEventListener("change", () => {
  autoScale = dom.autoScaleToggle.checked;
  setManualYEnabled(!autoScale);
});

dom.autoRangeToggle.addEventListener("change", () => runDeviceAction(async () => {
  const requested = dom.autoRangeToggle.checked;
  try {
    await sendCommand(`SET_AUTO_RANGE ${requested ? 1 : 0}`);
    autoRange = requested;
  } finally {
    dom.autoRangeToggle.checked = autoRange;
  }
}));

dom.manualRangeSelect.addEventListener("change", () => runDeviceAction(async () => {
  const requested = Number(dom.manualRangeSelect.value) === RANGE_HIGH_OHM ? RANGE_HIGH_OHM : RANGE_LOW_OHM;
  try {
    if (!dom.autoRangeToggle.checked) {
      await sendCommand(`SET_RANGE ${requested}`);
      currentRangeOhm = requested;
    }
  } finally {
    dom.manualRangeSelect.value = String(currentRangeOhm);
  }
}));

dom.zeroLowUaInput.addEventListener("change", () => {
  const cal = calibration();
  syncZeroInputs(cal);
  updateRangeReadouts();
  resetEnergyStats();
});

dom.zeroHighUaInput.addEventListener("change", () => {
  const cal = calibration();
  syncZeroInputs(cal);
  updateRangeReadouts();
  resetEnergyStats();
});

for (const input of [dom.senseLowOhmInput, dom.senseHighOhmInput]) {
  input.addEventListener("input", () => {
    syncZeroInputs(calibration());
    updateRangeReadouts();
    resetEnergyStats();
  });
}

dom.senseLowOhmInput.addEventListener("change", () => {
  const cal = calibration();
  dom.senseLowOhmInput.value = String(cal.senseLowOhm);
  syncZeroInputs(cal);
  updateRangeReadouts();
  resetEnergyStats();
});

dom.senseHighOhmInput.addEventListener("change", () => {
  const cal = calibration();
  dom.senseHighOhmInput.value = String(cal.senseHighOhm);
  syncZeroInputs(cal);
  updateRangeReadouts();
  resetEnergyStats();
});

dom.gridToggle.addEventListener("change", () => {
  showGrid = dom.gridToggle.checked;
});

dom.envelopeToggle.addEventListener("change", () => {
  showEnvelope = dom.envelopeToggle.checked;
});

dom.lowpassToggle.addEventListener("change", () => {
  lowpassEnabled = dom.lowpassToggle.checked;
  refreshLowpassView();
});

dom.lowpassCutoffSelect.addEventListener("change", () => {
  if (dom.lowpassCutoffSelect.value === "custom") dom.lowpassCutoffInput.value = String(lowpassCutoffHz);
  applyLowpassCutoff();
});

dom.lowpassCutoffInput.addEventListener("change", () => {
  dom.lowpassCutoffSelect.value = "custom";
  applyLowpassCutoff();
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
  cancelPlotDrag();

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
  if (activeDrag || event.isPrimary === false || ![0, 2].includes(event.button)) return;
  const source = buildPlotSource();
  plot.draw(source);
  const geometry = plot.getPlotGeometry();
  const point = plot.clientPointToPlot(event.clientX, event.clientY, geometry);
  if (source.visibleSamples <= 0 || !point?.inside) return;
  event.preventDefault();
  const clock = capturePlotClock(source.windowInfo, source.timeSegments);
  const frozenSource = {
    ...source,
    readVisibleTime: (offset) => clock.timeAt(source.windowInfo.startSerial + offset),
    timeToOffset: (time) => clock.lowerBound(time, source.windowInfo.startSerial, source.windowInfo.endSerial + 1) - source.windowInfo.startSerial,
  };
  activeDrag = {
    type: event.button === 2 ? "pan" : "box",
    pointerId: event.pointerId,
    generation: sampleStatistics.generation,
    startX: event.clientX,
    startY: event.clientY,
    lastX: event.clientX, lastY: event.clientY,
    startPoint: point, endPoint: point, geometry, source: frozenSource,
    initialClock: clock, currentClock: clock,
    clickCursorName: cursorEnabled ? nearestCursor(event.clientX) || nextCursorName : null,
    windowInfo: { ...source.windowInfo },
    currentWindowInfo: { ...source.windowInfo },
    timeStart: source.timeStart, timeEnd: source.timeEnd,
    currentTimeStart: source.timeStart, currentTimeEnd: source.timeEnd,
    startYRange: { ...source.yRange }, currentYRange: { ...source.yRange }, moved: false,
    previous: { visibleSeconds, displayPaused, autoScale, yMin: dom.yMinInput.value, yMax: dom.yMaxInput.value },
  };
  // Freeze the gesture's serial endpoint while acquisition continues. Every
  // new frame advances the offset, preserving the same captured samples.
  displayPaused = true;
  viewOffsetSamples = Math.max(0, totalSamplesWritten - source.windowInfo.endSerial - 1);
  if (activeDrag.type === "pan") visibleSeconds = source.timeEnd - source.timeStart;
  syncPauseButton();
  plot.canvas.classList.toggle("is-panning", activeDrag.type === "pan");
  plot.canvas.setPointerCapture(event.pointerId);
});

plot.canvas.addEventListener("pointermove", (event) => {
  movePlotDrag(event);
});

plot.canvas.addEventListener("pointerup", (event) => {
  if (!activeDrag || event.pointerId !== activeDrag.pointerId) return;
  movePlotDrag(event);
  const drag = activeDrag;
  if (!drag) return;
  activeDrag = null;
  plot.setSelectionBox(null);
  plot.canvas.classList.toggle("is-panning", false);
  const applied = drag.type === "box" && drag.moved && applySelectionBox(drag);
  if (applied) {
    // Selection addresses come from the frozen clock. Once the gesture ends,
    // fit those exact samples to the finalized live device timestamps.
    const { first, endExclusive } = drag.selectedSerials;
    visibleSeconds = Math.min(maxVisibleSeconds(), timeline.timeAfter(endExclusive - 1) - timeline.timeAt(first));
  }
  if ((!drag.moved || drag.type === "box") && !applied) {
    activeDrag = drag;
    cancelPlotDrag();
    if (drag.type === "box" && !drag.moved && cursorEnabled) {
      // A click sets A/B; a drag always belongs to rectangle selection, even
      // when it starts directly on a cursor line.
      const cursorName = drag.clickCursorName || nextCursorName;
      const offset = Math.min(drag.windowInfo.count - 1,
        drag.source.timeToOffset(drag.timeStart + drag.startPoint.x * (drag.timeEnd - drag.timeStart)));
      cursors[cursorName].serial = drag.windowInfo.startSerial + offset;
      nextCursorName = cursorName === "a" ? "b" : "a";
    }
  }
  if (plot.canvas.hasPointerCapture(event.pointerId)) plot.canvas.releasePointerCapture(event.pointerId);
  syncTimeWindowInput();
  redrawPlotInteraction();
});

plot.canvas.addEventListener("pointercancel", (event) => {
  if (activeDrag?.pointerId !== event.pointerId) return;
  cancelPlotDrag();
  redrawPlotInteraction();
});

plot.canvas.addEventListener("lostpointercapture", (event) => {
  if (activeDrag?.pointerId !== event.pointerId) return;
  cancelPlotDrag();
  redrawPlotInteraction();
});

plot.canvas.addEventListener("contextmenu", (event) => {
  event.preventDefault();
});

window.addEventListener?.("blur", () => {
  if (!activeDrag) return;
  cancelPlotDrag();
  redrawPlotInteraction();
});

plot.canvas.addEventListener("dblclick", () => {
  cancelPlotDrag(false);
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
