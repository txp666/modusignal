import { assetUrl } from "./asset-url.js";
import { loadAppPages } from "./page-loader.js";
import {
  createTransportSession,
  DEFAULT_TRANSPORT_ID,
  getTransportDescriptor,
  listTransports,
} from "./transports/registry.js";
import {
  AOMASTER_MAX_STEP_SEQUENCE,
  buildDefaultStepSequence,
  describeAomasterSummary,
  createAOMasterReadCommand,
  formatSetpoint,
  generateWaveformPreview,
  getAomasterWaveformLabel,
  normalizeAomasterWaveState,
  normalizeStepSequence,
  resetAomasterRxBuffer,
} from "./devices/aomaster.js";
import {
  describeModbusSummary,
  getModbusMode,
  resetModbusRxBuffer,
} from "./devices/modbus-device.js";
import { isReadFunctionCode } from "./modbus/modbus.js";
import {
  buildManualPayload,
  bytesToHex,
  createDeviceSetOutputCommand,
  CUSTOM_DEVICE_ID,
  DEFAULT_AOMASTER_CONFIG,
  DEFAULT_CUSTOM_CONFIG,
  DEFAULT_DEVICE_ID,
  DEFAULT_MODBUS_CONFIG,
  getDeviceProfile,
  getModeConfig,
  listDeviceLibrary,
  MODBUS_DEVICE_ID,
  MODUSIGNAL_APP,
  normalizeAomasterConfig,
  normalizeCustomConfig,
  normalizeModbusConfig,
  parseDeviceTelemetry,
  resolveLineEnding,
} from "./protocols.js";
import {
  DEFAULT_CHART_CONFIG,
  getChartPointSettings as resolveChartPointSettings,
  normalizeChartConfig,
} from "./chart-config.js";

const CUSTOM_CONFIG_STORAGE_KEY = "modusignal.customDevice.v1";
const MODBUS_CONFIG_STORAGE_KEY = "modusignal.modbusDevice.v1";
const AOMASTER_CONFIG_STORAGE_KEY = "modusignal.aomasterDevice.v1";
const CHART_CONFIG_STORAGE_KEY = "modusignal.chart.v1";
const AOMASTER_VALUE_DISPLAY_STORAGE_KEY = "modusignal.aomasterValueDisplayMode.v1";

const DEVICE_PAGE_IDS = [DEFAULT_DEVICE_ID, CUSTOM_DEVICE_ID, MODBUS_DEVICE_ID];

/** @type {Record<string, HTMLElement | HTMLElement[] | null>} */
const elements = {};

function cacheElements() {
  Object.assign(elements, {
    appShell: document.querySelector(".app-shell"),
    deviceShell: document.querySelector("#deviceShell"),
    secureState: document.querySelector("#secureState"),
    connectButton: document.querySelector("#connectButton"),
    disconnectButton: document.querySelector("#disconnectButton"),
    connectionState: document.querySelector("#connectionState"),
    deviceLibrary: document.querySelector("#deviceLibrary"),
    pages: [...document.querySelectorAll("[data-page-id]")],
    customDeviceNavName: document.querySelector("#customDeviceNavName"),
    githubLink: document.querySelector("#githubLink"),
    newDeviceRequestLink: document.querySelector("#newDeviceRequestLink"),
    deviceRequestTemplate: document.querySelector("#deviceRequestTemplate"),
    copyRequestTemplate: document.querySelector("#copyRequestTemplate"),
    footerCopyright: document.querySelector("#footerCopyright"),
    footerLicenseLink: document.querySelector("#footerLicenseLink"),
    footerVersion: document.querySelector("#footerVersion"),
    transportSelect: document.querySelector("#transportSelect"),
    transportFields: document.querySelector("#transportFields"),
    modeRow: document.querySelector("#aomasterPage .mode-row"),
    outputModeSelect: document.querySelector("#outputModeSelect"),
    waveformRow: document.querySelector("#waveformRow"),
    waveformSelect: document.querySelector("#waveformSelect"),
    aomasterValueDisplayMode: [...document.querySelectorAll('input[name="aomasterValueDisplayMode"]')],
    constantSetpointBlock: document.querySelector("#constantSetpointBlock"),
    waveformParamsBlock: document.querySelector("#waveformParamsBlock"),
    waveAnalogParams: document.querySelector("#waveAnalogParams"),
    stepSequenceBlock: document.querySelector("#stepSequenceBlock"),
    stepSequenceList: document.querySelector("#stepSequenceList"),
    addStepButton: document.querySelector("#addStepButton"),
    stepDwellMs: document.querySelector("#stepDwellMs"),
    stepLoops: document.querySelector("#stepLoops"),
    waveLow: document.querySelector("#waveLow"),
    waveHigh: document.querySelector("#waveHigh"),
    wavePeriodMs: document.querySelector("#wavePeriodMs"),
    waveDuty: document.querySelector("#waveDuty"),
    waveDutyField: document.querySelector("#waveDutyField"),
    setpointLabel: document.querySelector("#setpointLabel"),
    setpointReadout: document.querySelector("#setpointReadout"),
    setpointSlider: document.querySelector("#setpointSlider"),
    setpointInput: document.querySelector("#setpointInput"),
    setpointUnit: document.querySelector("#setpointUnit"),
    aomasterSlaveId: document.querySelector("#aomasterSlaveId"),
    aomasterPollIntervalMs: document.querySelector("#aomasterPollIntervalMs"),
    saveAomasterConfig: document.querySelector("#saveAomasterConfig"),
    resetAomasterConfig: document.querySelector("#resetAomasterConfig"),
    customDeviceName: document.querySelector("#customDeviceName"),
    customDeviceType: document.querySelector("#customDeviceType"),
    customChannelLabel: document.querySelector("#customChannelLabel"),
    customUnit: document.querySelector("#customUnit"),
    customMin: document.querySelector("#customMin"),
    customMax: document.querySelector("#customMax"),
    customStep: document.querySelector("#customStep"),
    customDefaultValue: document.querySelector("#customDefaultValue"),
    customCommandFormat: document.querySelector("#customCommandFormat"),
    customCommandLineEnding: document.querySelector("#customCommandLineEnding"),
    customCommandTemplate: document.querySelector("#customCommandTemplate"),
    customParserType: document.querySelector("#customParserType"),
    customParserFieldName: document.querySelector("#customParserFieldName"),
    customParserUnit: document.querySelector("#customParserUnit"),
    customParserGroup: document.querySelector("#customParserGroup"),
    customParserRegex: document.querySelector("#customParserRegex"),
    customParserScale: document.querySelector("#customParserScale"),
    customParserOffset: document.querySelector("#customParserOffset"),
    customParserSample: document.querySelector("#customParserSample"),
    customParserPreview: document.querySelector("#customParserPreview"),
    saveCustomConfig: document.querySelector("#saveCustomConfig"),
    resetCustomConfig: document.querySelector("#resetCustomConfig"),
    testCustomParser: document.querySelector("#testCustomParser"),
    modbusSlaveId: document.querySelector("#modbusSlaveId"),
    modbusFunctionCode: document.querySelector("#modbusFunctionCode"),
    modbusAddress: document.querySelector("#modbusAddress"),
    modbusQuantity: document.querySelector("#modbusQuantity"),
    modbusDataType: document.querySelector("#modbusDataType"),
    modbusByteOrder: document.querySelector("#modbusByteOrder"),
    modbusScale: document.querySelector("#modbusScale"),
    modbusOffset: document.querySelector("#modbusOffset"),
    modbusFieldName: document.querySelector("#modbusFieldName"),
    modbusUnit: document.querySelector("#modbusUnit"),
    modbusPollIntervalMs: document.querySelector("#modbusPollIntervalMs"),
    saveModbusConfig: document.querySelector("#saveModbusConfig"),
    resetModbusConfig: document.querySelector("#resetModbusConfig"),
    telemetryChart: document.querySelector("#telemetryChart"),
    chartValue: document.querySelector("#chartValue"),
    chartPanelSummary: document.querySelector("#chartPanelSummary"),
    singleChartBlock: document.querySelector("#singleChartBlock"),
    dualChartBlock: document.querySelector("#dualChartBlock"),
    setpointChartCanvas: document.querySelector("#setpointChart"),
    actualChartCanvas: document.querySelector("#actualChart"),
    setpointChartValue: document.querySelector("#setpointChartValue"),
    actualChartValue: document.querySelector("#actualChartValue"),
    clearChart: document.querySelector("#clearChart"),
    chartPointCount: document.querySelector("#chartPointCount"),
    visibleChartPointCount: document.querySelector("#visibleChartPointCount"),
    saveChartConfig: document.querySelector("#saveChartConfig"),
    resetChartConfig: document.querySelector("#resetChartConfig"),
    singleChartPointCount: document.querySelector("#singleChartPointCount"),
    singleChartVisiblePointCount: document.querySelector("#singleChartVisiblePointCount"),
    dualChartPointCount: document.querySelector("#dualChartPointCount"),
    dualChartVisiblePointCount: document.querySelector("#dualChartVisiblePointCount"),
    serialLog: document.querySelector("#serialLog"),
    clearLog: document.querySelector("#clearLog"),
    sendFormat: document.querySelector("#sendFormat"),
    lineEnding: document.querySelector("#lineEnding"),
    manualCommand: document.querySelector("#manualCommand"),
    sendManual: document.querySelector("#sendManual"),
  });
}

let chart = null;
let setpointChart = null;
let actualChart = null;
let allCharts = [];
let chartsReady = false;
let chartConfigEventsBound = false;
let customConfig = loadCustomConfig();
let modbusConfig = loadModbusConfig();
let aomasterConfig = loadAomasterConfig();
let chartConfig = loadChartConfig();
let session = null;
let modbusPollTimer = null;
let aomasterPollTimer = null;

const state = {
  pageId: "home",
  deviceId: DEFAULT_DEVICE_ID,
  transportId: DEFAULT_TRANSPORT_ID,
  mode: "current",
  setpoint: 12,
  waveform: "constant",
  aomasterValueDisplayMode: loadAomasterValueDisplayMode(),
  waveLow: 4,
  waveHigh: 20,
  wavePeriodMs: 1000,
  waveDuty: 50,
  stepSequence: [4, 8, 12, 16, 20],
  stepDwellMs: 500,
  stepLoops: 1,
};

boot();

async function boot() {
  try {
    await loadAppPages();
    cacheElements();
    initialize();
  } catch (error) {
    console.error("应用启动失败", error);
    document.body.insertAdjacentHTML(
      "beforeend",
      `<div class="boot-error" role="alert">页面加载失败：${error.message}</div>`,
    );
  }
}

function initialize() {
  if (elements.githubLink) {
    elements.githubLink.href = MODUSIGNAL_APP.githubUrl;
  }
  if (elements.newDeviceRequestLink) {
    elements.newDeviceRequestLink.href = MODUSIGNAL_APP.newDeviceRequestUrl;
  }
  renderFooterCopyright();
  if (elements.footerLicenseLink) {
    elements.footerLicenseLink.textContent = MODUSIGNAL_APP.licenseName;
    elements.footerLicenseLink.href = MODUSIGNAL_APP.licenseUrl;
  }
  if (elements.footerVersion) {
    elements.footerVersion.textContent = MODUSIGNAL_APP.assetVersion;
  }
  populateCustomConfigForm(customConfig);
  populateModbusConfigForm(modbusConfig);
  populateAomasterConfigForm(aomasterConfig);
  populateChartConfigForm(chartConfig);
  syncAomasterValueDisplayControls();
  updateChartPointLabels();
  populateTransportSelect();
  renderDeviceLibrary();
  renderHomeDeviceCards();
  bindEvents();
  setTransport(state.transportId);
  updatePageUi();
  safeUpdateDeviceUi();
  void initMonitoringCharts();
  appendLog(
    "info",
    "系统",
    `${MODUSIGNAL_APP.name} 已就绪，当前设备：${getDeviceProfile(state.deviceId, customConfig, modbusConfig).name}`,
  );
}

function on(element, eventName, handler) {
  if (element) {
    element.addEventListener(eventName, handler);
  }
}

function safeUpdateDeviceUi() {
  try {
    updateDeviceUi();
  } catch (error) {
    console.error("updateDeviceUi failed", error);
  }
}

async function initMonitoringCharts() {
  try {
    const { EchartsLiveChart } = await import("./echarts-charts.js");
    const chartPointSettings = getChartPointSettings();
    chart = new EchartsLiveChart(elements.telemetryChart, {
      maxPoints: chartPointSettings.totalPointCount,
      visiblePoints: chartPointSettings.visiblePointCount,
      color: "#0f766e",
      areaColor: "rgba(15, 118, 110, 0.12)",
      emptyText: "连接设备并开启轮询后显示实时曲线",
      title: "实时曲线",
    });
    setpointChart = new EchartsLiveChart(elements.setpointChartCanvas, {
      maxPoints: chartPointSettings.totalPointCount,
      visiblePoints: chartPointSettings.visiblePointCount,
      color: "#2563eb",
      areaColor: "rgba(37, 99, 235, 0.12)",
      emptyText: "调整设定值以预览曲线",
      title: "设定预览",
    });
    actualChart = new EchartsLiveChart(elements.actualChartCanvas, {
      maxPoints: chartPointSettings.totalPointCount,
      visiblePoints: chartPointSettings.visiblePointCount,
      color: "#0f766e",
      areaColor: "rgba(15, 118, 110, 0.12)",
      emptyText: "连接设备并开启轮询后显示实时输出",
      title: "实时输出",
    });
    allCharts = [chart, setpointChart, actualChart];
    chartsReady = true;
    bindChartResize();
    safeUpdateDeviceUi();
    requestChartResize();
  } catch (error) {
    chartsReady = false;
    console.error("initMonitoringCharts failed", error);
    if (elements.chartPanelSummary) {
      elements.chartPanelSummary.textContent = `图表模块加载失败：${error.message}`;
    }
  }
}

function getChartPointSettings() {
  return resolveChartPointSettings(chartConfig);
}

function getChartPointCount() {
  return getChartPointSettings().totalPointCount;
}

function applyChartPointCountConfig() {
  const chartPointSettings = getChartPointSettings();
  allCharts.filter(Boolean).forEach((item) => {
    item.setMaxPoints?.(chartPointSettings.totalPointCount);
    item.setVisiblePoints?.(chartPointSettings.visiblePointCount);
  });
  updateChartPointLabels();
}

function updateChartPointLabels() {
  const chartPointSettings = getChartPointSettings();
  const { totalPointCount, visiblePointCount } = chartPointSettings;
  if (elements.singleChartPointCount) {
    elements.singleChartPointCount.textContent = String(totalPointCount);
  }
  if (elements.singleChartVisiblePointCount) {
    elements.singleChartVisiblePointCount.textContent = String(visiblePointCount);
  }
  if (elements.dualChartPointCount) {
    elements.dualChartPointCount.textContent = String(totalPointCount);
  }
  if (elements.dualChartVisiblePointCount) {
    elements.dualChartVisiblePointCount.textContent = String(visiblePointCount);
  }
  if (elements.chartPointCount) {
    elements.chartPointCount.value = String(totalPointCount);
    elements.chartPointCount.title = "手动设置曲线总采样点数，点数越高历史越长";
  }
  if (elements.visibleChartPointCount) {
    elements.visibleChartPointCount.value = String(visiblePointCount);
    elements.visibleChartPointCount.max = String(totalPointCount);
    elements.visibleChartPointCount.title = "当前窗口显示点数，曲线可左右滑动查看总点数历史";
  }
  if (elements.chartPanelSummary) {
    elements.chartPanelSummary.textContent =
      state.deviceId === DEFAULT_DEVICE_ID
        ? `ECharts 曲线预览设定波形，并跟踪轮询回读的实际输出；保留 ${totalPointCount} 个采样点，当前显示 ${visiblePointCount} 个。`
        : `ECharts 曲线自动解析设备回读数值；保留 ${totalPointCount} 个采样点，当前显示 ${visiblePointCount} 个。`;
  }
}

function bindEvents() {
  on(elements.connectButton, "click", connect);
  on(elements.disconnectButton, "click", disconnect);
  on(elements.transportSelect, "change", (event) => setTransport(event.target.value));
  on(elements.deviceShell, "input", (event) => {
    if (event.target.matches('[data-field="setpointSlider"]')) {
      updateSetpoint(Number(event.target.value));
    }
  });
  on(elements.deviceShell, "change", (event) => {
    if (event.target.matches('[data-field="setpointInput"]')) {
      updateSetpoint(Number(event.target.value));
    }
  });
  on(elements.deviceShell, "click", (event) => {
    if (event.target.closest('[data-field="sendDriverCommand"]')) {
      sendDeviceCommand();
      return;
    }

    const preset = event.target.closest("[data-preset]");
    if (!preset) {
      return;
    }

    const config = getModeConfig(state.mode, state.deviceId, customConfig, modbusConfig);
    updateSetpoint(config.presets[preset.dataset.preset]);
  });
  on(elements.sendManual, "click", sendManualCommand);
  on(elements.copyRequestTemplate, "click", copyRequestTemplate);
  on(elements.clearLog, "click", () => {
    elements.serialLog.innerHTML = "";
    appendLog("info", "系统", "日志已清空");
  });
  on(elements.clearChart, "click", () => {
    clearAllCharts();
    appendLog("info", "系统", "曲线已清空");
  });

  on(elements.appShell, "click", (event) => {
    const target = event.target.closest("[data-page-target]");
    if (!target) {
      return;
    }

    if (target.dataset.deviceId) {
      selectDevice(target.dataset.deviceId);
      return;
    }

    navigateToPage(target.dataset.pageTarget);
  });

  on(elements.outputModeSelect, "change", () => {
    state.mode = elements.outputModeSelect.value;
    applyAomasterModeDefaults();
    clearAomasterCharts();
    syncAomasterChartRanges();
    updateDeviceUi();
  });

  on(elements.waveformSelect, "change", () => {
    state.waveform = elements.waveformSelect.value;
    if (state.waveform === "step" && state.stepSequence.length < 2) {
      state.stepSequence = buildDefaultStepSequence(state.mode);
    }
    updateAomasterWaveformUi();
    renderStepSequenceList();
    refreshAomasterPreviewChart();
    updateSetpointUi();
  });

  elements.aomasterValueDisplayMode?.forEach((control) => {
    control.addEventListener("change", () => {
      if (control.checked) {
        setAomasterValueDisplayMode(control.value);
      }
    });
  });

  getAomasterWaveControls().filter(Boolean).forEach((control) => {
    control.addEventListener("input", updateAomasterWaveDraft);
    control.addEventListener("change", updateAomasterWaveDraft);
  });

  document.querySelectorAll("[data-wave-preset]").forEach((button) => {
    button.addEventListener("click", () => {
      applyAomasterWavePreset(button.dataset.wavePreset);
    });
  });

  on(elements.addStepButton, "click", () => {
    addAomasterStepPoint();
  });

  document.querySelectorAll("[data-step-preset]").forEach((button) => {
    button.addEventListener("click", () => {
      applyAomasterStepPreset(button.dataset.stepPreset);
    });
  });

  getCustomConfigControls().filter(Boolean).forEach((control) => {
    control.addEventListener("input", updateCustomDraftConfig);
    control.addEventListener("change", updateCustomDraftConfig);
  });

  on(elements.saveCustomConfig, "click", saveCustomConfig);
  on(elements.resetCustomConfig, "click", resetCustomConfig);
  on(elements.testCustomParser, "click", testCustomParser);

  getModbusConfigControls().filter(Boolean).forEach((control) => {
    control.addEventListener("input", updateModbusDraftConfig);
    control.addEventListener("change", updateModbusDraftConfig);
  });

  on(elements.saveModbusConfig, "click", saveModbusConfig);
  on(elements.resetModbusConfig, "click", resetModbusConfig);

  getAomasterConfigControls().filter(Boolean).forEach((control) => {
    control.addEventListener("input", updateAomasterDraftConfig);
    control.addEventListener("change", updateAomasterDraftConfig);
  });

  on(elements.saveAomasterConfig, "click", saveAomasterConfig);
  on(elements.resetAomasterConfig, "click", resetAomasterConfig);

  bindChartConfigEvents();
}

function bindSessionEvents(target) {
  target.addEventListener("connected", () => {
    updateConnectionUi(true);
    updateModbusPolling();
    updateAomasterPolling();
    appendLog("info", "连接", "已连接");
  });

  target.addEventListener("disconnected", () => {
    stopModbusPolling();
    stopAomasterPolling();
    resetModbusRxBuffer();
    resetAomasterRxBuffer();
    updateConnectionUi(false);
    appendLog("info", "连接", "已断开");
  });

  target.addEventListener("rx", (event) => {
    const { bytes, text } = event.detail;
    const useHexDisplay = state.deviceId === MODBUS_DEVICE_ID || state.deviceId === DEFAULT_DEVICE_ID;
    const display = useHexDisplay ? bytesToHex(bytes) : text.trim() ? text : bytesToHex(bytes);
    appendLog("rx", "RX", display);

    const telemetry = parseDeviceTelemetry(
      state.deviceId,
      text,
      customConfig,
      modbusConfig,
      bytes,
      state,
      aomasterConfig,
    );
    if (telemetry) {
      if (state.deviceId === DEFAULT_DEVICE_ID) {
        actualChart?.add(getAomasterDisplayNumber(telemetry.value));
        const formatted = formatAomasterDisplayValue(telemetry.value);
        elements.actualChartValue.textContent = `${telemetry.fieldName} ${formatted}`;
      } else {
        chart?.add(telemetry.value);
        const formatted = `${telemetry.value.toFixed(3)}${telemetry.unit ? ` ${telemetry.unit}` : ""}`;
        elements.chartValue.textContent = `${telemetry.fieldName} ${formatted}`;
      }
    }
  });

  target.addEventListener("tx", (event) => {
    appendLog("tx", "TX", bytesToHex(event.detail.bytes));
  });

  target.addEventListener("error", (event) => {
    appendLog("error", "错误", event.detail.error?.message ?? String(event.detail.error));
  });
}

async function setTransport(transportId) {
  if (session && session.connected) {
    await session.disconnect().catch((error) => appendLog("error", "连接", error.message));
  }

  state.transportId = getTransportDescriptor(transportId).id;
  elements.transportSelect.value = state.transportId;
  session = createTransportSession(state.transportId);
  bindSessionEvents(session);
  renderTransportFields();
  updateSecureState();
  updateConnectionUi(false);
}

function populateTransportSelect() {
  elements.transportSelect.innerHTML = "";
  listTransports().forEach((descriptor) => {
    const option = document.createElement("option");
    option.value = descriptor.id;
    option.textContent = descriptor.label;
    elements.transportSelect.append(option);
  });
  elements.transportSelect.value = state.transportId;
}

function renderTransportFields() {
  const descriptor = getTransportDescriptor(state.transportId);
  elements.transportFields.innerHTML = "";

  descriptor.fields.forEach((field) => {
    const label = document.createElement("label");
    label.textContent = field.label;

    const control = field.type === "select" ? document.createElement("select") : document.createElement("input");
    control.dataset.fieldKey = field.key;
    control.dataset.fieldType = typeof field.default === "number" ? "number" : "string";

    if (field.type === "select") {
      (field.options ?? []).forEach((option) => {
        const value = typeof option === "object" ? option.value : option;
        const text = typeof option === "object" ? option.label : String(option);
        const el = document.createElement("option");
        el.value = String(value);
        el.textContent = text;
        if (value === field.default) {
          el.selected = true;
        }
        control.append(el);
      });
    } else {
      control.type = field.type === "number" ? "number" : "text";
      control.value = field.default ?? "";
    }

    label.append(control);
    elements.transportFields.append(label);
  });
}

function readTransportOptions() {
  const options = {};
  elements.transportFields.querySelectorAll("[data-field-key]").forEach((control) => {
    const { fieldKey, fieldType } = control.dataset;
    options[fieldKey] = fieldType === "number" ? Number(control.value) : control.value;
  });
  return options;
}

function selectDevice(deviceId) {
  stopModbusPolling();
  stopAomasterPolling();
  resetModbusRxBuffer();
  resetAomasterRxBuffer();
  state.deviceId = deviceId;
  state.pageId = deviceId;

  if (deviceId === CUSTOM_DEVICE_ID) {
    state.mode = "custom";
    state.setpoint = normalizeCustomConfig(customConfig).defaultValue;
  } else if (deviceId === MODBUS_DEVICE_ID) {
    const normalized = normalizeModbusConfig(modbusConfig);
    state.mode = getModbusMode(normalized.functionCode);
    const config = getModeConfig(state.mode, deviceId, customConfig, modbusConfig);
    state.setpoint = config.presets.mid;
  } else {
    state.mode = elements.outputModeSelect?.value || "current";
    applyAomasterModeDefaults(false);
  }

  clearAllCharts();
  syncAomasterChartRanges();
  updatePageUi();
  updateDeviceUi();
  updateModbusPolling();
  updateAomasterPolling();
  appendLog("info", "设备", `已切换到 ${getDeviceProfile(state.deviceId, customConfig, modbusConfig).name}`);
}

function navigateToPage(pageId) {
  if (pageId === DEFAULT_DEVICE_ID || pageId === CUSTOM_DEVICE_ID || pageId === MODBUS_DEVICE_ID) {
    selectDevice(pageId);
    return;
  }

  state.pageId = pageId === "request" ? "request" : "home";
  updatePageUi();
  updateDeviceUi();
}

function updateSecureState() {
  const descriptor = getTransportDescriptor(state.transportId);

  if (descriptor.requiresSecureContext && !window.isSecureContext) {
    elements.secureState.textContent = "需要 HTTPS 或 localhost";
    elements.secureState.classList.add("warning");
    elements.connectButton.disabled = true;
    return;
  }

  if (!descriptor.isSupported()) {
    elements.secureState.textContent = `当前环境不支持${descriptor.label}`;
    elements.secureState.classList.add("warning");
    elements.connectButton.disabled = true;
    return;
  }

  elements.secureState.textContent = `${descriptor.label} 可用`;
  elements.secureState.classList.remove("warning");
}

function transportReady() {
  const descriptor = getTransportDescriptor(state.transportId);
  return descriptor.isSupported() && (!descriptor.requiresSecureContext || window.isSecureContext);
}

function updateDeviceUi() {
  syncChartConfigElements();
  bindChartConfigEvents();
  updateChartPointLabels();
  const profile = getDeviceProfile(state.deviceId, customConfig, modbusConfig);
  const isCustom = state.deviceId === CUSTOM_DEVICE_ID;
  const isModbus = state.deviceId === MODBUS_DEVICE_ID;
  const isAomaster = state.deviceId === DEFAULT_DEVICE_ID;
  const normalizedModbus = normalizeModbusConfig(modbusConfig);
  const modbusIsRead = isModbus && isReadFunctionCode(normalizedModbus.functionCode);

  if (elements.customDeviceNavName) {
    elements.customDeviceNavName.textContent = normalizeCustomConfig(customConfig).name;
  }

  const setpointRow = queryDeviceField("setpointRow");
  const presetRow = queryDeviceField("presetRow");
  if (setpointRow) {
    setpointRow.hidden = modbusIsRead;
  }
  if (presetRow) {
    presetRow.hidden = modbusIsRead;
  }

  if (elements.singleChartBlock) {
    elements.singleChartBlock.hidden = isAomaster;
  }
  if (elements.dualChartBlock) {
    elements.dualChartBlock.hidden = !isAomaster;
  }
  if (elements.chartPanelSummary) {
    const chartPointSettings = getChartPointSettings();
    elements.chartPanelSummary.textContent = isAomaster
      ? `ECharts 曲线预览设定波形，并跟踪轮询回读的实际输出；保留 ${chartPointSettings.totalPointCount} 个采样点，当前显示 ${chartPointSettings.visiblePointCount} 个。`
      : `ECharts 曲线自动解析设备回读数值；保留 ${chartPointSettings.totalPointCount} 个采样点，当前显示 ${chartPointSettings.visiblePointCount} 个。`;
  }

  const summary = queryDeviceField("deviceSummary");
  if (summary) {
    if (isCustom) {
      summary.textContent = `${profile.name}；设定范围、发送模板和回包解析可在本页配置。`;
    } else if (isModbus) {
      summary.textContent = describeModbusSummary(modbusConfig);
    } else if (isAomaster) {
      summary.textContent = describeAomasterSummary(aomasterConfig);
    } else {
      summary.textContent = profile.name;
    }
  }

  document.querySelectorAll("[data-device-id]").forEach((button) => {
    button.classList.toggle("active", button.dataset.deviceId === state.deviceId && isDevicePageActive());
  });

  if (isAomaster) {
    syncAomasterValueDisplayControls();
    populateOutputModeSelect();
    if (elements.outputModeSelect) {
      elements.outputModeSelect.value = state.mode;
      elements.outputModeSelect.disabled = false;
      elements.outputModeSelect.title = "";
    }
    if (elements.waveformSelect) {
      elements.waveformSelect.value = state.mode === "frequency" ? "constant" : state.waveform;
    }
    if (state.mode === "frequency") {
      state.waveform = "constant";
    }
    populateAomasterWaveformForm();
    updateAomasterWaveformUi();
    syncAomasterChartRanges();
    refreshAomasterPreviewChart();
  }

  if (!isAomaster && chart) {
    const chartConfig = getModeConfig(state.mode, state.deviceId, customConfig, modbusConfig);
    chart.setMeta({ title: "实时曲线", unit: chartConfig.unit });
  }

  requestChartResize();
  updateSetpointUi();
}

function updatePageUi() {
  const isDevice = isDevicePageActive();

  elements.pages = [...document.querySelectorAll("[data-page-id]")];
  elements.deviceShell.classList.toggle("active", isDevice);

  elements.pages.forEach((page) => {
    if (page.classList.contains("device-page")) {
      page.classList.toggle("active", isDevice && page.dataset.pageId === state.deviceId);
      return;
    }

    page.classList.toggle("active", !isDevice && page.dataset.pageId === state.pageId);
  });

  document.querySelectorAll("[data-page-target]").forEach((target) => {
    const targetPage = target.dataset.pageTarget;
    const isActive =
      targetPage === state.pageId ||
      (isDevice && target.dataset.deviceId === state.deviceId);
    target.classList.toggle("active", isActive);
  });
}

function createDeviceIcon(entry) {
  const icon = document.createElement("span");
  icon.setAttribute("aria-hidden", "true");

  if (entry.profile.image) {
    icon.className = "device-icon has-image";
    const image = document.createElement("img");
    image.src = assetUrl(entry.profile.image);
    image.alt = "";
    icon.append(image);
  } else {
    icon.className = "device-icon";
    icon.textContent = entry.profile.name.slice(0, 1).toUpperCase();
  }

  return icon;
}

function renderDeviceLibrary() {
  elements.deviceLibrary.innerHTML = "";

  listDeviceLibrary(customConfig).forEach((entry) => {
    const button = document.createElement("button");
    button.className = "device-item";
    button.type = "button";
    button.dataset.pageTarget = entry.pageTarget;
    button.dataset.deviceId = entry.deviceId;

    const icon = createDeviceIcon(entry);

    const text = document.createElement("span");
    const title = document.createElement("strong");
    title.textContent = entry.profile.name;

    if (entry.deviceId === CUSTOM_DEVICE_ID) {
      title.id = "customDeviceNavName";
      elements.customDeviceNavName = title;
    }

    const subtitle = document.createElement("small");
    subtitle.textContent =
      entry.deviceId === CUSTOM_DEVICE_ID ? "模板发送 / 自定义解析" : entry.profile.type;

    text.append(title, subtitle);
    button.append(icon, text);
    elements.deviceLibrary.append(button);
  });
}

function renderHomeDeviceCards() {
  const grid = document.querySelector("#homeDeviceGrid");
  if (!grid) {
    return;
  }

  grid.innerHTML = "";

  listDeviceLibrary(customConfig).forEach((entry) => {
    const button = document.createElement("button");
    button.className = "home-card";
    button.type = "button";
    button.dataset.pageTarget = entry.pageTarget;
    button.dataset.deviceId = entry.deviceId;

    const body = document.createElement("span");
    body.className = "home-card-body";

    const title = document.createElement("strong");
    title.textContent = entry.profile.name;

    const summary = document.createElement("span");
    if (entry.deviceId === DEFAULT_DEVICE_ID) {
      summary.textContent = "阶跃/斜坡/方波等波形输出，双曲线预览与 20 ms 回读。";
    } else if (entry.deviceId === MODBUS_DEVICE_ID) {
      summary.textContent = "RTU 寄存器读写，支持轮询读取与曲线显示。";
    } else {
      summary.textContent = "用模板发送和解析规则快速适配未知串口设备。";
    }

    body.append(title, summary);
    button.append(createDeviceIcon(entry), body);
    grid.append(button);
  });

  const requestButton = document.createElement("button");
  requestButton.className = "home-card";
  requestButton.type = "button";
  requestButton.dataset.pageTarget = "request";

  const requestIcon = document.createElement("span");
  requestIcon.className = "device-icon";
  requestIcon.setAttribute("aria-hidden", "true");
  requestIcon.textContent = "R";

  const requestBody = document.createElement("span");
  requestBody.className = "home-card-body";

  const requestTitle = document.createElement("strong");
  requestTitle.textContent = "新增设备请求";

  const requestSummary = document.createElement("span");
  requestSummary.textContent = "整理设备资料、协议、截图和期望 UI，方便贡献设备驱动。";

  requestBody.append(requestTitle, requestSummary);
  requestButton.append(requestIcon, requestBody);
  grid.append(requestButton);
}

function isDevicePageActive() {
  return DEVICE_PAGE_IDS.includes(state.pageId);
}

function queryDeviceField(name) {
  const page = document.querySelector(`.device-page[data-page-id="${state.deviceId}"]`);
  if (!page) {
    return null;
  }

  return page.querySelector(`[data-field="${name}"]`) ?? page.querySelector(`#${name}`);
}

function isAomasterPercentMode() {
  return state.deviceId === DEFAULT_DEVICE_ID && state.aomasterValueDisplayMode === "percent";
}

function getAomasterPercentValue(value, mode = state.mode) {
  const config = getModeConfig(mode, DEFAULT_DEVICE_ID, customConfig, modbusConfig);
  const span = config.max - config.min;
  if (!Number.isFinite(span) || span === 0) {
    return 0;
  }
  return ((Number(value) - config.min) / span) * 100;
}

function getAomasterValueFromPercent(percent, mode = state.mode) {
  const config = getModeConfig(mode, DEFAULT_DEVICE_ID, customConfig, modbusConfig);
  const span = config.max - config.min;
  const bounded = Math.min(100, Math.max(0, Number(percent)));
  return config.min + (span * bounded) / 100;
}

function getAomasterDisplayNumber(value, mode = state.mode) {
  return isAomasterPercentMode() ? getAomasterPercentValue(value, mode) : Number(value);
}

function readAomasterDisplayNumber(value, mode = state.mode) {
  return isAomasterPercentMode() ? getAomasterValueFromPercent(value, mode) : Number(value);
}

function getAomasterDisplayStep(mode = state.mode) {
  const config = getModeConfig(mode, DEFAULT_DEVICE_ID, customConfig, modbusConfig);
  return isAomasterPercentMode() ? 0.1 : config.step;
}

function getAomasterDisplayDecimals(mode = state.mode) {
  return isAomasterPercentMode() ? 1 : decimalPlaces(getModeConfig(mode, DEFAULT_DEVICE_ID, customConfig, modbusConfig).step);
}

function formatAomasterDisplayNumber(value, mode = state.mode) {
  return getAomasterDisplayNumber(value, mode).toFixed(getAomasterDisplayDecimals(mode));
}

function formatAomasterDisplayValue(value, mode = state.mode) {
  const config = getModeConfig(mode, DEFAULT_DEVICE_ID, customConfig, modbusConfig);
  return isAomasterPercentMode()
    ? `${formatAomasterDisplayNumber(value, mode)} %`
    : `${formatSetpoint(mode, value)} ${config.unit}`;
}

function formatAomasterDisplaySequence(sequence, mode = state.mode) {
  return sequence.map((value) => formatAomasterDisplayNumber(value, mode)).join(" → ");
}

function getAomasterDisplayUnit() {
  return isAomasterPercentMode() ? "%" : getModeConfig(state.mode, DEFAULT_DEVICE_ID, customConfig, modbusConfig).unit;
}

function updateSetpoint(value) {
  const config = getModeConfig(state.mode, state.deviceId, customConfig, modbusConfig);
  const sourceValue = isAomasterPercentMode() ? getAomasterValueFromPercent(value) : value;
  const bounded = Math.min(config.max, Math.max(config.min, sourceValue));
  state.setpoint = Number.isFinite(bounded) ? bounded : config.presets.mid;
  updateSetpointUi();
}

function updateSetpointUi() {
  const config = getModeConfig(state.mode, state.deviceId, customConfig, modbusConfig);
  const isPercent = isAomasterPercentMode();
  const formatted = isPercent
    ? formatAomasterDisplayNumber(state.setpoint)
    : state.setpoint.toFixed(decimalPlaces(config.step));
  const controlMin = isPercent ? 0 : config.min;
  const controlMax = isPercent ? 100 : config.max;
  const controlStep = isPercent ? getAomasterDisplayStep() : config.step;
  const setpointLabel = queryDeviceField("setpointLabel") ?? elements.setpointLabel;
  const setpointReadout = queryDeviceField("setpointReadout") ?? elements.setpointReadout;
  const setpointUnit = queryDeviceField("setpointUnit") ?? elements.setpointUnit;
  const setpointSlider = queryDeviceField("setpointSlider") ?? elements.setpointSlider;
  const setpointInput = queryDeviceField("setpointInput") ?? elements.setpointInput;
  const protocolPreview = queryDeviceField("protocolPreview");
  const sendDriverCommand = queryDeviceField("sendDriverCommand");
  const driverState = queryDeviceField("driverState");

  if (setpointLabel) {
    setpointLabel.textContent = config.label;
  }
  if (setpointReadout) {
    setpointReadout.textContent = isPercent ? `${formatted} %` : `${formatted}${config.unit ? ` ${config.unit}` : ""}`;
  }
  if (setpointUnit) {
    setpointUnit.textContent = isPercent ? "%" : config.unit || "值";
  }
  if (setpointSlider) {
    setpointSlider.min = String(controlMin);
    setpointSlider.max = String(controlMax);
    setpointSlider.step = String(controlStep);
    setpointSlider.value = formatted;
  }
  if (setpointInput) {
    setpointInput.min = String(controlMin);
    setpointInput.max = String(controlMax);
    setpointInput.step = String(controlStep);
    setpointInput.value = formatted;
  }

  if (state.deviceId === DEFAULT_DEVICE_ID) {
    refreshAomasterPreviewChart();
  }

  const command = createDeviceSetOutputCommand(state.deviceId, state, customConfig, modbusConfig, aomasterConfig);
  if (protocolPreview) {
    protocolPreview.textContent = command.preview;
  }
  if (sendDriverCommand) {
    sendDriverCommand.disabled = !command.supported || !session?.connected;
  }

  if (state.deviceId === MODBUS_DEVICE_ID) {
    const normalized = normalizeModbusConfig(modbusConfig);
    const isRead = isReadFunctionCode(normalized.functionCode);
    if (sendDriverCommand) {
      sendDriverCommand.textContent = isRead ? "读取寄存器" : "写入寄存器";
    }
    if (driverState) {
      driverState.textContent = "Modbus RTU";
      driverState.classList.remove("warning");
    }
    return;
  }

  if (state.deviceId === DEFAULT_DEVICE_ID) {
    if (sendDriverCommand) {
      sendDriverCommand.textContent = "发送设定";
    }
    if (driverState) {
      driverState.textContent = "Modbus RTU";
      driverState.classList.remove("warning");
    }
    return;
  }

  if (sendDriverCommand) {
    sendDriverCommand.textContent = "发送设定";
  }
  if (driverState) {
    driverState.textContent = command.supported ? "模板可发送" : "协议待配置";
    driverState.classList.toggle("warning", !command.supported);
  }
}

function updateConnectionUi(connected) {
  elements.connectButton.disabled = connected || !transportReady();
  elements.disconnectButton.disabled = !connected;
  elements.sendManual.disabled = !connected;
  elements.transportSelect.disabled = connected;
  elements.connectionState.textContent = connected ? "已连接" : "未连接";
  elements.connectionState.classList.toggle("connected", connected);
  updateSetpointUi();
}

function updateCustomDraftConfig() {
  customConfig = readCustomConfigForm();

  if (state.deviceId === CUSTOM_DEVICE_ID) {
    state.mode = "custom";
    const config = getModeConfig(state.mode, state.deviceId, customConfig, modbusConfig);
    state.setpoint = Math.min(config.max, Math.max(config.min, state.setpoint));
  }

  updateDeviceUi();
}

function saveCustomConfig() {
  customConfig = readCustomConfigForm();
  localStorage.setItem(CUSTOM_CONFIG_STORAGE_KEY, JSON.stringify(customConfig));
  populateCustomConfigForm(customConfig);
  renderDeviceLibrary();
  renderHomeDeviceCards();
  updateDeviceUi();
  appendLog("info", "设备", "自定义设备配置已保存");
}

function resetCustomConfig() {
  customConfig = normalizeCustomConfig(DEFAULT_CUSTOM_CONFIG);
  localStorage.setItem(CUSTOM_CONFIG_STORAGE_KEY, JSON.stringify(customConfig));
  populateCustomConfigForm(customConfig);
  renderDeviceLibrary();
  renderHomeDeviceCards();

  if (state.deviceId === CUSTOM_DEVICE_ID) {
    state.setpoint = customConfig.defaultValue;
  }

  updateDeviceUi();
  appendLog("info", "设备", "自定义设备配置已恢复默认");
}

function testCustomParser() {
  customConfig = readCustomConfigForm();
  const telemetry = parseDeviceTelemetry(CUSTOM_DEVICE_ID, elements.customParserSample.value, customConfig);

  if (!telemetry) {
    elements.customParserPreview.textContent = "未解析到数值";
    return;
  }

  elements.customParserPreview.textContent = `${telemetry.fieldName}: ${telemetry.value.toFixed(6)}${telemetry.unit ? ` ${telemetry.unit}` : ""}`;
}

async function copyRequestTemplate() {
  try {
    await navigator.clipboard.writeText(elements.deviceRequestTemplate.value);
    elements.copyRequestTemplate.textContent = "已复制";
    window.setTimeout(() => {
      elements.copyRequestTemplate.textContent = "复制模板";
    }, 1400);
  } catch {
    appendLog("error", "系统", "复制失败，请手动选择模板文本");
  }
}

async function connect() {
  try {
    await session.connect(readTransportOptions());
  } catch (error) {
    appendLog("error", "连接", error.message);
  }
}

async function disconnect() {
  await session.disconnect();
}

async function sendDeviceCommand() {
  try {
    const command = createDeviceSetOutputCommand(state.deviceId, state, customConfig, modbusConfig, aomasterConfig);
    const frames = command.frames ?? (command.bytes ? [command.bytes] : []);
    if (!command.supported || frames.length === 0) {
      appendLog("error", "发送", command.preview || "当前设备没有可发送的驱动命令");
      return;
    }

    for (const frame of frames) {
      await session.write(frame);
    }
  } catch (error) {
    appendLog("error", "发送", error.message);
  }
}

async function sendManualCommand() {
  try {
    const command = elements.manualCommand.value;
    if (!command.trim()) {
      appendLog("error", "发送", "命令不能为空");
      return;
    }

    const payload = buildManualPayload(elements.sendFormat.value, command, resolveLineEnding(elements.lineEnding.value));
    await session.write(payload);
  } catch (error) {
    appendLog("error", "发送", error.message);
  }
}

function loadCustomConfig() {
  try {
    const saved = localStorage.getItem(CUSTOM_CONFIG_STORAGE_KEY);
    return normalizeCustomConfig(saved ? JSON.parse(saved) : DEFAULT_CUSTOM_CONFIG);
  } catch {
    return normalizeCustomConfig(DEFAULT_CUSTOM_CONFIG);
  }
}

function readCustomConfigForm() {
  return normalizeCustomConfig({
    name: elements.customDeviceName.value,
    type: elements.customDeviceType.value,
    channelLabel: elements.customChannelLabel.value,
    unit: elements.customUnit.value,
    min: elements.customMin.value,
    max: elements.customMax.value,
    step: elements.customStep.value,
    defaultValue: elements.customDefaultValue.value,
    commandFormat: elements.customCommandFormat.value,
    commandTemplate: elements.customCommandTemplate.value,
    commandLineEnding: elements.customCommandLineEnding.value,
    parser: {
      type: elements.customParserType.value,
      fieldName: elements.customParserFieldName.value,
      unit: elements.customParserUnit.value,
      regex: elements.customParserRegex.value,
      group: elements.customParserGroup.value,
      scale: elements.customParserScale.value,
      offset: elements.customParserOffset.value,
    },
  });
}

function populateCustomConfigForm(config) {
  const normalized = normalizeCustomConfig(config);
  elements.customDeviceName.value = normalized.name;
  elements.customDeviceType.value = normalized.type;
  elements.customChannelLabel.value = normalized.channelLabel;
  elements.customUnit.value = normalized.unit;
  elements.customMin.value = String(normalized.min);
  elements.customMax.value = String(normalized.max);
  elements.customStep.value = String(normalized.step);
  elements.customDefaultValue.value = String(normalized.defaultValue);
  elements.customCommandFormat.value = normalized.commandFormat;
  elements.customCommandTemplate.value = normalized.commandTemplate;
  elements.customCommandLineEnding.value = normalized.commandLineEnding;
  elements.customParserType.value = normalized.parser.type;
  elements.customParserFieldName.value = normalized.parser.fieldName;
  elements.customParserUnit.value = normalized.parser.unit;
  elements.customParserRegex.value = normalized.parser.regex;
  elements.customParserGroup.value = String(normalized.parser.group);
  elements.customParserScale.value = String(normalized.parser.scale);
  elements.customParserOffset.value = String(normalized.parser.offset);
  elements.customParserPreview.textContent = "等待测试";
}

function stopModbusPolling() {
  if (modbusPollTimer) {
    clearInterval(modbusPollTimer);
    modbusPollTimer = null;
  }
}

function updateModbusPolling() {
  stopModbusPolling();

  const normalized = normalizeModbusConfig(modbusConfig);
  if (state.deviceId !== MODBUS_DEVICE_ID || !session?.connected) {
    return;
  }

  if (!isReadFunctionCode(normalized.functionCode) || normalized.pollIntervalMs <= 0) {
    return;
  }

  modbusPollTimer = window.setInterval(() => {
    sendDeviceCommand().catch((error) => appendLog("error", "Modbus", error.message));
  }, normalized.pollIntervalMs);
}

function updateModbusDraftConfig() {
  modbusConfig = readModbusConfigForm();

  if (state.deviceId === MODBUS_DEVICE_ID) {
    const normalized = normalizeModbusConfig(modbusConfig);
    state.mode = getModbusMode(normalized.functionCode);
    const config = getModeConfig(state.mode, state.deviceId, customConfig, modbusConfig);
    state.setpoint = Math.min(config.max, Math.max(config.min, state.setpoint));
    resetModbusRxBuffer();
  }

  updateDeviceUi();
  updateModbusPolling();
}

function saveModbusConfig() {
  modbusConfig = readModbusConfigForm();
  localStorage.setItem(MODBUS_CONFIG_STORAGE_KEY, JSON.stringify(modbusConfig));
  populateModbusConfigForm(modbusConfig);
  updateDeviceUi();
  updateModbusPolling();
  appendLog("info", "设备", "Modbus 配置已保存");
}

function resetModbusConfig() {
  modbusConfig = normalizeModbusConfig(DEFAULT_MODBUS_CONFIG);
  localStorage.setItem(MODBUS_CONFIG_STORAGE_KEY, JSON.stringify(modbusConfig));
  populateModbusConfigForm(modbusConfig);
  resetModbusRxBuffer();

  if (state.deviceId === MODBUS_DEVICE_ID) {
    state.mode = getModbusMode(modbusConfig.functionCode);
    state.setpoint = getModeConfig(state.mode, state.deviceId, customConfig, modbusConfig).presets.mid;
  }

  updateDeviceUi();
  updateModbusPolling();
  appendLog("info", "设备", "Modbus 配置已恢复默认");
}

function loadModbusConfig() {
  try {
    const saved = localStorage.getItem(MODBUS_CONFIG_STORAGE_KEY);
    return normalizeModbusConfig(saved ? JSON.parse(saved) : DEFAULT_MODBUS_CONFIG);
  } catch {
    return normalizeModbusConfig(DEFAULT_MODBUS_CONFIG);
  }
}

function readModbusConfigForm() {
  return normalizeModbusConfig({
    slaveId: elements.modbusSlaveId.value,
    functionCode: elements.modbusFunctionCode.value,
    address: elements.modbusAddress.value,
    quantity: elements.modbusQuantity.value,
    dataType: elements.modbusDataType.value,
    byteOrder: elements.modbusByteOrder.value,
    scale: elements.modbusScale.value,
    offset: elements.modbusOffset.value,
    fieldName: elements.modbusFieldName.value,
    unit: elements.modbusUnit.value,
    pollIntervalMs: elements.modbusPollIntervalMs.value,
  });
}

function populateModbusConfigForm(config) {
  const normalized = normalizeModbusConfig(config);
  elements.modbusSlaveId.value = String(normalized.slaveId);
  elements.modbusFunctionCode.value = String(normalized.functionCode);
  elements.modbusAddress.value = String(normalized.address);
  elements.modbusQuantity.value = String(normalized.quantity);
  elements.modbusDataType.value = normalized.dataType;
  elements.modbusByteOrder.value = normalized.byteOrder;
  elements.modbusScale.value = String(normalized.scale);
  elements.modbusOffset.value = String(normalized.offset);
  elements.modbusFieldName.value = normalized.fieldName;
  elements.modbusUnit.value = normalized.unit;
  elements.modbusPollIntervalMs.value = String(normalized.pollIntervalMs);
}

function getModbusConfigControls() {
  return [
    elements.modbusSlaveId,
    elements.modbusFunctionCode,
    elements.modbusAddress,
    elements.modbusQuantity,
    elements.modbusDataType,
    elements.modbusByteOrder,
    elements.modbusScale,
    elements.modbusOffset,
    elements.modbusFieldName,
    elements.modbusUnit,
    elements.modbusPollIntervalMs,
  ];
}

function stopAomasterPolling() {
  if (aomasterPollTimer) {
    clearInterval(aomasterPollTimer);
    aomasterPollTimer = null;
  }
}

function updateAomasterPolling() {
  stopAomasterPolling();

  const normalized = normalizeAomasterConfig(aomasterConfig);
  if (state.deviceId !== DEFAULT_DEVICE_ID || !session?.connected) {
    return;
  }

  if (normalized.pollIntervalMs <= 0) {
    return;
  }

  aomasterPollTimer = window.setInterval(() => {
    sendAomasterReadCommand().catch((error) => appendLog("error", "AOMaster", error.message));
  }, normalized.pollIntervalMs);
}

async function sendAomasterReadCommand() {
  if (!session?.connected) {
    return;
  }

  const bytes = createAOMasterReadCommand(aomasterConfig);
  await session.write(bytes);
}

function updateAomasterDraftConfig() {
  aomasterConfig = readAomasterConfigForm();
  resetAomasterRxBuffer();
  updateDeviceUi();
  updateAomasterPolling();
}

function saveAomasterConfig() {
  aomasterConfig = readAomasterConfigForm();
  localStorage.setItem(AOMASTER_CONFIG_STORAGE_KEY, JSON.stringify(aomasterConfig));
  populateAomasterConfigForm(aomasterConfig);
  updateDeviceUi();
  updateAomasterPolling();
  appendLog("info", "设备", "AOMaster 配置已保存");
}

function resetAomasterConfig() {
  aomasterConfig = normalizeAomasterConfig(DEFAULT_AOMASTER_CONFIG);
  localStorage.setItem(AOMASTER_CONFIG_STORAGE_KEY, JSON.stringify(aomasterConfig));
  populateAomasterConfigForm(aomasterConfig);
  resetAomasterRxBuffer();
  updateDeviceUi();
  updateAomasterPolling();
  appendLog("info", "设备", "AOMaster 配置已恢复默认");
}

function loadAomasterConfig() {
  try {
    const saved = localStorage.getItem(AOMASTER_CONFIG_STORAGE_KEY);
    return normalizeAomasterConfig(saved ? JSON.parse(saved) : DEFAULT_AOMASTER_CONFIG);
  } catch {
    return normalizeAomasterConfig(DEFAULT_AOMASTER_CONFIG);
  }
}

function loadAomasterValueDisplayMode() {
  try {
    return localStorage.getItem(AOMASTER_VALUE_DISPLAY_STORAGE_KEY) === "percent" ? "percent" : "value";
  } catch {
    return "value";
  }
}

function setAomasterValueDisplayMode(mode) {
  const nextMode = mode === "percent" ? "percent" : "value";
  if (state.aomasterValueDisplayMode === nextMode) {
    return;
  }

  state.aomasterValueDisplayMode = nextMode;
  try {
    localStorage.setItem(AOMASTER_VALUE_DISPLAY_STORAGE_KEY, nextMode);
  } catch {
    // localStorage may be unavailable in restricted browser contexts.
  }
  syncAomasterValueDisplayControls();
  populateAomasterWaveformForm();
  renderStepSequenceList();
  actualChart?.clear();
  if (elements.actualChartValue) {
    elements.actualChartValue.textContent = "暂无数据";
  }
  updateSetpointUi();
  syncAomasterChartRanges();
  requestChartResize();
}

function syncAomasterValueDisplayControls() {
  elements.aomasterValueDisplayMode?.forEach((control) => {
    control.checked = control.value === state.aomasterValueDisplayMode;
  });
}

function readAomasterConfigForm() {
  return normalizeAomasterConfig({
    slaveId: elements.aomasterSlaveId.value,
    pollIntervalMs: elements.aomasterPollIntervalMs.value,
  });
}

function populateAomasterConfigForm(config) {
  const normalized = normalizeAomasterConfig(config);
  elements.aomasterSlaveId.value = String(normalized.slaveId);
  elements.aomasterPollIntervalMs.value = String(normalized.pollIntervalMs);
}

function getAomasterConfigControls() {
  return [elements.aomasterSlaveId, elements.aomasterPollIntervalMs];
}

function updateChartDraftConfig() {
  chartConfig = readChartConfigForm();
  applyChartPointCountConfig();
}

function saveChartConfig() {
  chartConfig = readChartConfigForm();
  localStorage.setItem(CHART_CONFIG_STORAGE_KEY, JSON.stringify(chartConfig));
  populateChartConfigForm(chartConfig);
  applyChartPointCountConfig();
  appendLog("info", "曲线", "曲线缩放配置已保存");
}

function resetChartConfig() {
  chartConfig = normalizeChartConfig(DEFAULT_CHART_CONFIG);
  localStorage.setItem(CHART_CONFIG_STORAGE_KEY, JSON.stringify(chartConfig));
  populateChartConfigForm(chartConfig);
  applyChartPointCountConfig();
  appendLog("info", "曲线", "曲线缩放配置已恢复默认");
}

function loadChartConfig() {
  try {
    const saved = localStorage.getItem(CHART_CONFIG_STORAGE_KEY);
    if (saved) {
      return normalizeChartConfig(JSON.parse(saved));
    }

    const legacyAomaster = localStorage.getItem(AOMASTER_CONFIG_STORAGE_KEY);
    if (legacyAomaster) {
      const parsed = JSON.parse(legacyAomaster);
      if (parsed.chartPointCount != null || parsed.visibleChartPointCount != null) {
        return normalizeChartConfig({
          chartPointCount: parsed.chartPointCount,
          visibleChartPointCount: parsed.visibleChartPointCount,
        });
      }
    }

    return normalizeChartConfig(DEFAULT_CHART_CONFIG);
  } catch {
    return normalizeChartConfig(DEFAULT_CHART_CONFIG);
  }
}

function readChartConfigForm() {
  syncChartConfigElements();
  if (!elements.chartPointCount || !elements.visibleChartPointCount) {
    return normalizeChartConfig(chartConfig);
  }

  return normalizeChartConfig({
    chartPointCount: elements.chartPointCount.value,
    visibleChartPointCount: elements.visibleChartPointCount.value,
  });
}

function populateChartConfigForm(config) {
  syncChartConfigElements();
  const normalized = normalizeChartConfig(config);
  if (!elements.chartPointCount || !elements.visibleChartPointCount) {
    return;
  }

  elements.chartPointCount.value = String(normalized.chartPointCount);
  elements.visibleChartPointCount.value = String(normalized.visibleChartPointCount);
  elements.visibleChartPointCount.max = String(normalized.chartPointCount);
}

function syncChartConfigElements() {
  elements.chartPointCount = document.querySelector("#chartPointCount");
  elements.visibleChartPointCount = document.querySelector("#visibleChartPointCount");
  elements.saveChartConfig = document.querySelector("#saveChartConfig");
  elements.resetChartConfig = document.querySelector("#resetChartConfig");
}

function bindChartConfigEvents() {
  syncChartConfigElements();
  if (chartConfigEventsBound) {
    return;
  }

  const controls = getChartConfigControls();
  if (controls.length === 0) {
    return;
  }

  controls.forEach((control) => {
    control.addEventListener("input", updateChartDraftConfig);
    control.addEventListener("change", updateChartDraftConfig);
  });
  on(elements.saveChartConfig, "click", saveChartConfig);
  on(elements.resetChartConfig, "click", resetChartConfig);
  chartConfigEventsBound = true;
}

function getChartConfigControls() {
  return [elements.chartPointCount, elements.visibleChartPointCount].filter(Boolean);
}

function getCustomConfigControls() {
  return [
    elements.customDeviceName,
    elements.customDeviceType,
    elements.customChannelLabel,
    elements.customUnit,
    elements.customMin,
    elements.customMax,
    elements.customStep,
    elements.customDefaultValue,
    elements.customCommandFormat,
    elements.customCommandLineEnding,
    elements.customCommandTemplate,
    elements.customParserType,
    elements.customParserFieldName,
    elements.customParserUnit,
    elements.customParserGroup,
    elements.customParserRegex,
    elements.customParserScale,
    elements.customParserOffset,
  ];
}

function applyAomasterModeDefaults(resetWaveform = true) {
  const config = getModeConfig(state.mode, DEFAULT_DEVICE_ID, customConfig, modbusConfig);
  state.setpoint = config.presets.mid;
  state.waveLow = config.min;
  state.waveHigh = config.max;
  state.stepSequence = buildDefaultStepSequence(state.mode);
  if (resetWaveform && state.mode === "frequency") {
    state.waveform = "constant";
  }
  populateAomasterWaveformForm();
  renderStepSequenceList();
}

function populateAomasterWaveformForm() {
  const config = getModeConfig(state.mode, DEFAULT_DEVICE_ID, customConfig, modbusConfig);
  const waveState = normalizeAomasterWaveState(state, state.mode);
  state.setpoint = waveState.setpoint;
  state.waveLow = waveState.waveLow;
  state.waveHigh = waveState.waveHigh;
  state.wavePeriodMs = waveState.wavePeriodMs;
  state.waveDuty = waveState.waveDuty;
  state.waveform = waveState.waveform;
  state.stepSequence = waveState.stepSequence;
  state.stepDwellMs = waveState.stepDwellMs;
  state.stepLoops = waveState.stepLoops;

  if (elements.waveLow) {
    elements.waveLow.min = isAomasterPercentMode() ? "0" : String(config.min);
    elements.waveLow.max = isAomasterPercentMode() ? "100" : String(config.max);
    elements.waveLow.step = String(getAomasterDisplayStep());
    elements.waveLow.value = formatAomasterDisplayNumber(waveState.waveLow);
  }
  if (elements.waveHigh) {
    elements.waveHigh.min = isAomasterPercentMode() ? "0" : String(config.min);
    elements.waveHigh.max = isAomasterPercentMode() ? "100" : String(config.max);
    elements.waveHigh.step = String(getAomasterDisplayStep());
    elements.waveHigh.value = formatAomasterDisplayNumber(waveState.waveHigh);
  }
  if (elements.wavePeriodMs) {
    elements.wavePeriodMs.value = String(waveState.wavePeriodMs);
  }
  if (elements.waveDuty) {
    elements.waveDuty.value = String(waveState.waveDuty);
  }
  if (elements.waveformSelect) {
    elements.waveformSelect.value = waveState.waveform;
  }
  if (elements.stepDwellMs) {
    elements.stepDwellMs.value = String(waveState.stepDwellMs);
  }
  if (elements.stepLoops) {
    elements.stepLoops.value = String(waveState.stepLoops);
  }
  renderStepSequenceList();
}

function renderStepSequenceList() {
  if (!elements.stepSequenceList) {
    return;
  }

  const config = getModeConfig(state.mode, DEFAULT_DEVICE_ID, customConfig, modbusConfig);
  const sequence = normalizeStepSequence(state.stepSequence, state.mode);
  state.stepSequence = sequence;
  elements.stepSequenceList.innerHTML = "";

  sequence.forEach((value, index) => {
    const row = document.createElement("div");
    row.className = "step-sequence-item";

    const label = document.createElement("strong");
    label.textContent = `#${index + 1}`;

    const input = document.createElement("input");
    input.type = "number";
    input.dataset.stepValue = String(index);
    input.min = isAomasterPercentMode() ? "0" : String(config.min);
    input.max = isAomasterPercentMode() ? "100" : String(config.max);
    input.step = String(getAomasterDisplayStep());
    input.value = formatAomasterDisplayNumber(value);
    input.addEventListener("input", updateAomasterWaveDraft);
    input.addEventListener("change", updateAomasterWaveDraft);

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.textContent = "删除";
    removeButton.disabled = sequence.length <= 2;
    removeButton.addEventListener("click", () => {
      removeAomasterStepPoint(index);
    });

    row.append(label, input, removeButton);
    elements.stepSequenceList.append(row);
  });
}

function readStepSequenceFromForm() {
  return [...elements.stepSequenceList.querySelectorAll("[data-step-value]")].map((input) =>
    readAomasterDisplayNumber(input.value),
  );
}

function addAomasterStepPoint() {
  if (state.stepSequence.length >= AOMASTER_MAX_STEP_SEQUENCE) {
    appendLog("error", "阶跃", `最多支持 ${AOMASTER_MAX_STEP_SEQUENCE} 个阶跃点`);
    return;
  }

  const config = getModeConfig(state.mode, DEFAULT_DEVICE_ID, customConfig, modbusConfig);
  state.stepSequence = [...state.stepSequence, config.presets.mid];
  renderStepSequenceList();
  refreshAomasterPreviewChart();
  updateSetpointUi();
}

function removeAomasterStepPoint(index) {
  if (state.stepSequence.length <= 2) {
    return;
  }

  state.stepSequence = state.stepSequence.filter((_, stepIndex) => stepIndex !== index);
  renderStepSequenceList();
  refreshAomasterPreviewChart();
  updateSetpointUi();
}

function applyAomasterStepPreset(preset) {
  const config = getModeConfig(state.mode, DEFAULT_DEVICE_ID, customConfig, modbusConfig);
  const span = (config.max - config.min) / 4;

  if (preset === "five") {
    state.stepSequence = buildDefaultStepSequence(state.mode);
  } else if (preset === "up-down") {
    state.stepSequence = [
      config.min,
      config.min + span,
      config.min + span * 2,
      config.max,
      config.presets.mid,
      config.min,
    ];
  } else if (preset === "pulse") {
    state.stepSequence = [config.min, config.max, config.min, config.max, config.min];
    state.stepDwellMs = 200;
  }

  populateAomasterWaveformForm();
  updateAomasterWaveformUi();
  refreshAomasterPreviewChart();
  updateSetpointUi();
}

function updateAomasterWaveformUi() {
  const isFrequency = state.mode === "frequency";
  const isConstant = state.waveform === "constant";
  const isStep = state.waveform === "step";
  elements.waveformSelect.disabled = isFrequency;
  elements.constantSetpointBlock.hidden = !isConstant;
  elements.waveformParamsBlock.hidden = isConstant;
  elements.waveAnalogParams.hidden = isStep;
  elements.stepSequenceBlock.hidden = !isStep;
  elements.waveDutyField.hidden = state.waveform !== "square";
}

function updateAomasterWaveDraft() {
  state.waveform = elements.waveformSelect.value;
  state.waveLow = readAomasterDisplayNumber(elements.waveLow.value);
  state.waveHigh = readAomasterDisplayNumber(elements.waveHigh.value);
  state.wavePeriodMs = Number(elements.wavePeriodMs.value);
  state.waveDuty = Number(elements.waveDuty.value);
  state.stepDwellMs = Number(elements.stepDwellMs.value);
  state.stepLoops = Number(elements.stepLoops.value);
  if (state.waveform === "step") {
    state.stepSequence = readStepSequenceFromForm();
  }
  const waveState = normalizeAomasterWaveState(state, state.mode);
  state.waveLow = waveState.waveLow;
  state.waveHigh = waveState.waveHigh;
  state.wavePeriodMs = waveState.wavePeriodMs;
  state.waveDuty = waveState.waveDuty;
  state.stepSequence = waveState.stepSequence;
  state.stepDwellMs = waveState.stepDwellMs;
  state.stepLoops = waveState.stepLoops;
  populateAomasterWaveformForm();
  updateAomasterWaveformUi();
  refreshAomasterPreviewChart();
  updateSetpointUi();
}

function applyAomasterWavePreset(preset) {
  const config = getModeConfig(state.mode, DEFAULT_DEVICE_ID, customConfig, modbusConfig);
  if (preset === "min-max") {
    state.waveLow = config.min;
    state.waveHigh = config.max;
  } else if (preset === "mid") {
    const span = (config.max - config.min) / 4;
    state.waveLow = config.presets.mid - span;
    state.waveHigh = config.presets.mid + span;
  } else if (preset === "narrow") {
    const center = config.presets.mid;
    const span = (config.max - config.min) / 10;
    state.waveLow = center - span;
    state.waveHigh = center + span;
    state.waveDuty = 10;
  }
  populateAomasterWaveformForm();
  refreshAomasterPreviewChart();
  updateSetpointUi();
}

function refreshAomasterPreviewChart() {
  if (state.deviceId !== DEFAULT_DEVICE_ID || !setpointChart) {
    return;
  }

  applyChartPointCountConfig();
  const previewValues = generateWaveformPreview(state, getChartPointCount()).map((value) =>
    getAomasterDisplayNumber(value),
  );
  setpointChart.setPoints(previewValues);
  setpointChart.setMeta({ unit: getAomasterDisplayUnit() });
  syncAomasterChartRanges();

  if (state.waveform === "constant") {
    elements.setpointChartValue.textContent = `设定 ${formatAomasterDisplayValue(state.setpoint)}`;
  } else if (state.waveform === "step") {
    const loopLabel = state.stepLoops === 0 ? "无限循环" : `${state.stepLoops} 次`;
    elements.setpointChartValue.textContent = `阶跃 ${formatAomasterDisplaySequence(state.stepSequence)} ${getAomasterDisplayUnit()} · ${state.stepDwellMs} ms/步 · ${loopLabel}`;
  } else {
    elements.setpointChartValue.textContent = `${getAomasterWaveformLabel(state.waveform)} ${formatAomasterDisplayNumber(state.waveLow)}~${formatAomasterDisplayNumber(state.waveHigh)} ${getAomasterDisplayUnit()}`;
  }

  if (actualChart) {
    actualChart.setMeta({ unit: getAomasterDisplayUnit() });
  }

  requestChartResize();
}

function bindChartResize() {
  window.addEventListener("resize", requestChartResize);
  if (typeof ResizeObserver !== "undefined") {
    const observer = new ResizeObserver(() => requestChartResize());
    observer.observe(elements.deviceShell);
    const chartHosts = document.querySelectorAll(
      "#telemetryChart, #setpointChart, #actualChart, .chart-panel-body",
    );
    chartHosts.forEach((host) => observer.observe(host));
  }
}

let chartResizeTimer = null;

function requestChartResize() {
  if (!chartsReady || !allCharts.length) {
    return;
  }

  if (chartResizeTimer) {
    window.cancelAnimationFrame(chartResizeTimer);
  }
  chartResizeTimer = window.requestAnimationFrame(() => {
    allCharts.filter(Boolean).forEach((item) => item.resize());
    window.requestAnimationFrame(() => {
      allCharts.filter(Boolean).forEach((item) => item.resize());
    });
  });
}

function getAomasterWaveControls() {
  return [
    elements.waveformSelect,
    elements.waveLow,
    elements.waveHigh,
    elements.wavePeriodMs,
    elements.waveDuty,
    elements.stepDwellMs,
    elements.stepLoops,
  ];
}

function populateOutputModeSelect() {
  if (!elements.outputModeSelect) {
    return;
  }

  const profile = getDeviceProfile(DEFAULT_DEVICE_ID, customConfig, modbusConfig);
  const currentValue = state.mode;

  elements.outputModeSelect.innerHTML = "";
  Object.entries(profile.modes).forEach(([modeId, modeConfig]) => {
    const option = document.createElement("option");
    option.value = modeId;
    option.textContent = modeConfig.label;
    elements.outputModeSelect.append(option);
  });

  if (profile.modes[currentValue]) {
    elements.outputModeSelect.value = currentValue;
  } else {
    state.mode = Object.keys(profile.modes)[0] ?? "current";
    elements.outputModeSelect.value = state.mode;
  }
}

function syncAomasterChartRanges() {
  if (!setpointChart || !actualChart) {
    return;
  }

  if (isAomasterPercentMode()) {
    setpointChart.setRange(0, 100);
    actualChart.setRange(0, 100);
    return;
  }

  const config = getModeConfig(state.mode, DEFAULT_DEVICE_ID, customConfig, modbusConfig);
  const min =
    state.waveform === "step"
      ? Math.min(...state.stepSequence)
      : state.waveform === "constant"
        ? config.min
        : Math.min(state.waveLow, state.waveHigh);
  const max =
    state.waveform === "step"
      ? Math.max(...state.stepSequence)
      : state.waveform === "constant"
        ? config.max
        : Math.max(state.waveLow, state.waveHigh);
  setpointChart.setRange(min, max);
  actualChart.setRange(min, max);
}

function clearAomasterCharts() {
  setpointChart?.clear();
  actualChart?.clear();
  elements.setpointChartValue.textContent = "暂无设定";
  elements.actualChartValue.textContent = "暂无数据";
}

function clearAllCharts() {
  chart?.clear();
  clearAomasterCharts();
  elements.chartValue.textContent = "暂无数据";
  requestChartResize();
}

function decimalPlaces(step) {
  const text = String(step);
  return Math.min(6, Math.max(0, text.includes(".") ? text.split(".")[1].length : 0));
}

function renderFooterCopyright() {
  const year = new Date().getFullYear();
  elements.footerCopyright.textContent = `© ${year} `;

  const authorLink = document.createElement("a");
  authorLink.href = MODUSIGNAL_APP.copyrightUrl;
  authorLink.textContent = MODUSIGNAL_APP.copyrightHolder;
  authorLink.target = "_blank";
  authorLink.rel = "noreferrer";
  elements.footerCopyright.append(authorLink);
}

function appendLog(kind, direction, payload) {
  const line = document.createElement("div");
  line.className = `log-line ${kind}`;

  const time = document.createElement("span");
  time.className = "time";
  time.textContent = new Date().toLocaleTimeString("zh-CN", { hour12: false });

  const dir = document.createElement("span");
  dir.className = "dir";
  dir.textContent = direction;

  const content = document.createElement("span");
  content.className = "payload";
  content.textContent = payload;

  line.append(time, dir, content);
  if (!elements.serialLog) {
    return;
  }

  elements.serialLog.append(line);
  elements.serialLog.scrollTop = elements.serialLog.scrollHeight;

  while (elements.serialLog.children.length > 400) {
    elements.serialLog.firstElementChild?.remove();
  }
}
