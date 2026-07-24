import i18n, { initI18n } from "./i18n.js";
import { mountChartCurveSections } from "./debug-curve-section.js";
import { loadAppPages } from "./page-loader.js";
import { createLogController } from "./ui/log-controller.js";
import { collectAppElements } from "./ui/app-elements.js";
import { createSidebarController } from "./ui/sidebar-controller.js";
import { createDeviceNavigationUi } from "./ui/device-navigation-ui.js";
import { createChartCsvController } from "./monitoring/chart-csv-controller.js";
import {
  createModbusConfigUi,
  loadModbusConfig as loadModbusConfigSnapshot,
  persistModbusConfig,
} from "./features/modbus/modbus-config-ui.js";
import {
  createMessageConfigUi,
  loadMessageConfig,
} from "./features/message-debug/message-config-ui.js";
import { createAomasterWaveformUi } from "./features/aomaster/aomaster-waveform-ui.js";
import { createTransportController } from "./core/transport-controller.js";
import { createPollingController } from "./core/polling-controller.js";
import { createDebugCurveController } from "./ui/debug-curve-controller.js";
import {
  createCustomConfigUi,
  loadCustomConfig as loadCustomConfigSnapshot,
} from "./features/custom/custom-config-ui.js";
import { bindAppEvents } from "./ui/app-event-bindings.js";
import { createMessageDebugController } from "./features/message-debug/message-debug-controller.js";
import { DEFAULT_TRANSPORT_ID } from "./transports/registry.js";
import {
  AOMASTER_DEVICE_ID,
  describeAomasterSummary,
  createAOMasterReadCommand,
  formatSetpoint,
  resetAomasterRxBuffer,
} from "./devices/aomaster.js";
import {
  listCustomChartSeries,
  resetCustomRxBuffer,
} from "./devices/custom-device.js";
import {
  describeModbusSummary,
  getModbusMode,
  listModbusDeviceChartSeries,
  resetModbusRxBuffer,
} from "./devices/modbus-device.js";
import {
  createHartPollCommand,
  DEFAULT_HART_CONFIG,
  describeHartSummary,
  getHartMode,
  HART_DEVICE_ID,
  HART_VARIABLE_CARDS,
  mergeHartDiscovery,
  normalizeHartConfig,
  resetHartDeviceState,
  resetHartRxBuffer,
} from "./devices/hart-device.js";
import {
  formatHartDeviceSummary,
} from "./hart/hart.js";
import { createHartConfigUi } from "./features/hart/hart-config-ui.js";
import { createHartMonitorController } from "./features/hart/hart-monitor-controller.js";
import { createHartSessionController } from "./features/hart/hart-session-controller.js";
import { createHartWorkspaceController } from "./features/hart/hart-workspace-controller.js";
import {
  describeMqttSummary,
  listMqttChartSeries,
  resetMqttRxBuffer,
} from "./devices/mqtt-device.js";
import {
  describeWebSocketSummary,
  listWebSocketChartSeries,
  resetWebSocketRxBuffer,
} from "./devices/websocket-device.js";
import {
  requestChartCurvePanelResize,
  updateChartCurvePanel,
} from "./chart-curve-panel.js";
import { describeJsonCurveSummary } from "./devices/json-curve-config.js";
import {
  readDebugCurveConfigForm,
} from "./debug-curve-form.js";
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
  DEFAULT_MQTT_CONFIG,
  DEFAULT_WEBSOCKET_CONFIG,
  DEVICE_PAGE_IDS,
  getDeviceProfile,
  isStandaloneDevice,
  getModeConfig,
  MODBUS_DEVICE_ID,
  MODUSIGNAL_APP,
  normalizeAomasterConfig,
  normalizeCustomConfig,
  normalizeModbusConfig,
  normalizeMqttConfig,
  normalizeWebSocketConfig,
  parseDeviceTelemetry,
  parseHexPayload,
  resolveLineEnding,
  MQTT_DEVICE_ID,
  WEBSOCKET_DEVICE_ID,
} from "./protocols.js";
import {
  DEFAULT_CHART_CONFIG,
  getChartPointSettings as resolveChartPointSettings,
  normalizeChartConfig,
} from "./chart-config.js";

const CUSTOM_CONFIG_STORAGE_KEY = "modusignal.customDevice.v1";
const HART_CONFIG_STORAGE_KEY = "modusignal.hartDevice.v1";
const WEBSOCKET_CONFIG_STORAGE_KEY = "modusignal.websocketDevice.v1";
const MQTT_CONFIG_STORAGE_KEY = "modusignal.mqttDevice.v1";
const AOMASTER_CONFIG_STORAGE_KEY = "modusignal.aomasterDevice.v1";
const CHART_CONFIG_STORAGE_KEY = "modusignal.chart.v1";
const AOMASTER_VALUE_DISPLAY_STORAGE_KEY = "modusignal.aomasterValueDisplayMode.v1";
const AOMASTER_INTERFRAME_DELAY_MS = 20;

/** @type {Record<string, HTMLElement | HTMLElement[] | null>} */
const elements = {};

let chart = null;
let hartChart = null;
let jsonMultiChart = null;
let setpointChart = null;
let actualChart = null;
let allCharts = [];
let chartsReady = false;
let chartConfigEventsBound = false;
let EchartsLiveChartClass = null;
let EchartsMultiLiveChartClass = null;
let jsonMultiChartSignature = "";
let customConfig = loadCustomConfigSnapshot(CUSTOM_CONFIG_STORAGE_KEY);
let modbusConfig = loadModbusConfigSnapshot();
let hartConfig = loadHartConfig();
let websocketConfig = loadMessageConfig(
  WEBSOCKET_CONFIG_STORAGE_KEY,
  DEFAULT_WEBSOCKET_CONFIG,
  normalizeWebSocketConfig,
);
let mqttConfig = loadMessageConfig(MQTT_CONFIG_STORAGE_KEY, DEFAULT_MQTT_CONFIG, normalizeMqttConfig);
let aomasterConfig = loadAomasterConfig();
let chartConfig = loadChartConfig();
let session = null;
let hartConfigUi = null;
let hartMonitorController = null;
let hartSessionController = null;
let hartWorkspaceController = null;
let logController = null;
let modbusConfigUi = null;
let sidebarController = null;
let deviceNavigationUi = null;
let chartCsvController = null;
let websocketConfigUi = null;
let mqttConfigUi = null;
let aomasterWaveformUi = null;
let transportController = null;
let pollingController = null;
let debugCurveController = null;
let customConfigUi = null;
let messageDebugController = null;
let aomasterActualMode = null;

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
  pollingActive: false,
};

boot();

async function boot() {
  initI18n();
  try {
    await loadAppPages();
    i18n.apply(document.body);
    mountChartCurveSections();
    Object.assign(elements, collectAppElements());
    initializeInfrastructureControllers();
    initializeHartControllers();
    initializeChartControllers();
    await initialize();
  } catch (error) {
    console.error(i18n("app.bootFailed"), error);
    document.body.insertAdjacentHTML(
      "beforeend",
      `<div class="boot-error" role="alert">${i18n("app.bootError")}${error.message}</div>`,
    );
  }
}

async function initialize() {
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
  customConfigUi.populate(customConfig);
  modbusConfigUi.populateConfigForm(modbusConfig);
  hartConfigUi.populateConfigForm(hartConfig);
  websocketConfigUi.populate(websocketConfig);
  mqttConfigUi.populate(mqttConfig);
  populateAomasterConfigForm(aomasterConfig);
  populateChartConfigForm(chartConfig);
  syncAomasterValueDisplayControls();
  updateChartPointLabels();
  transportController.populateSelect();
  deviceNavigationUi.renderLibrary();
  deviceNavigationUi.renderHomeCards();
  bindAppEvents({
    elements,
    state,
    getConfigs: () => ({ customConfig, modbusConfig }),
    sidebarController,
    transportController,
    pollingController,
    deviceNavigationUi,
    aomasterWaveformUi,
    customConfigUi,
    modbusConfigUi,
    websocketConfigUi,
    mqttConfigUi,
    debugCurveController,
    hartConfigUi,
    hartSessionController,
    hartWorkspaceController,
    hartMonitorController,
    handlers: {
      requestChartResize,
      updateSetpoint,
      sendDeviceCommand,
      sendManualCommand,
      copyRequestTemplate,
      sendWebSocketQuickMessage: messageDebugController.sendWebsocketQuickMessage,
      sendMqttQuickMessage: messageDebugController.sendMqttQuickMessage,
      loadMessageIntoManualSender: messageDebugController.loadIntoManualSender,
      resetRxLogCoalesce,
      appendLog,
      clearAllCharts,
      selectDevice,
      navigateToPage,
      updateDeviceUi,
      updateSetpointUi,
      setAomasterValueDisplayMode,
      testDeviceParser,
      updateModbusDraftConfig,
      saveModbusConfig,
      resetModbusConfig,
      updateHartDraftConfig,
      saveHartConfig,
      resetHartConfig,
      readWebsocketHeartbeatPreset: messageDebugController.readWebsocketHeartbeatPreset,
      readMqttHeartbeatPreset: messageDebugController.readMqttHeartbeatPreset,
      getAomasterConfigControls,
      updateAomasterDraftConfig,
      saveAomasterConfig,
      resetAomasterConfig,
      bindChartConfigEvents,
    },
  });
  await transportController.setTransport(state.transportId);
  deviceNavigationUi.updatePage();
  safeUpdateDeviceUi();
  void initMonitoringCharts();
  appendLog(
    "info",
    i18n("log.system"),
    `${MODUSIGNAL_APP.name}${i18n("app.ready")}${getDeviceProfile(state.deviceId, customConfig, modbusConfig).name}`,
  );

  // Language switcher
  const langSwitchButton = document.getElementById("langSwitchButton");
  if (langSwitchButton) {
    updateLangSwitchButton(langSwitchButton);
    langSwitchButton.addEventListener("click", () => {
      const current = i18n.getLanguage();
      const next = current === "zh" ? "en" : "zh";
      i18n.setLanguage(next);
      updateLangSwitchButton(langSwitchButton);
      refreshAllDynamicUi();
    });
  }
}

function updateLangSwitchButton(button) {
  button.textContent = i18n("lang.switchTarget");
}

function refreshAllDynamicUi() {
  deviceNavigationUi.renderLibrary();
  deviceNavigationUi.renderHomeCards();
  updateDeviceUi();
  transportController.updateConnectionUi(Boolean(session?.connected));
  pollingController.updateUi();
  updateSetpointUi();
  syncChartCurvePanelUi();
  deviceNavigationUi.updatePage();
  transportController.populateSelect();
  transportController.renderFields();
  updateChartPointLabels();
  customConfigUi.populate(customConfig);
  modbusConfigUi.populateConfigForm(modbusConfig);
  hartWorkspaceController.refreshLocalizedOptions();
  hartConfigUi.populateConfigForm(hartConfig);
  websocketConfigUi.populate(websocketConfig);
  mqttConfigUi.populate(mqttConfig);
  populateAomasterConfigForm(aomasterConfig);
  syncAomasterValueDisplayControls();
}

function initializeInfrastructureControllers() {
  debugCurveController = createDebugCurveController({ elements });
  logController = createLogController({
    getLogElement: () => elements.serialLog,
    bytesToHex,
  });
  modbusConfigUi = createModbusConfigUi({
    elements,
    syncCurveRows: debugCurveController.syncRows,
  });
  sidebarController = createSidebarController();
  deviceNavigationUi = createDeviceNavigationUi({
    elements,
    state,
    getCustomConfig: () => customConfig,
    getModbusConfig: () => modbusConfig,
  });
  customConfigUi = createCustomConfigUi({
    elements,
    state,
    storageKey: CUSTOM_CONFIG_STORAGE_KEY,
    getConfig: () => customConfig,
    setConfig: (config) => { customConfig = config; },
    getModbusConfig: () => modbusConfig,
    syncCurveRows: debugCurveController.syncRows,
    syncChartPanel: syncChartCurvePanelUi,
    renderNavigation: () => {
      deviceNavigationUi.renderLibrary();
      deviceNavigationUi.renderHomeCards();
    },
    updateDeviceUi,
    appendLog,
  });
  pollingController = createPollingController({
    elements,
    state,
    getSession: () => session,
    getConfigs: () => ({ customConfig, modbusConfig, hartConfig, websocketConfig, mqttConfig, aomasterConfig }),
    sendDeviceCommand,
    sendHartPoll: sendHartPollCommand,
    sendAomasterPoll: sendAomasterReadCommand,
    appendLog,
  });
  const sharedMessageConfigOptions = {
    elements,
    state,
    syncCurveRows: debugCurveController.syncRows,
    syncChartPanel: syncChartCurvePanelUi,
    updateDeviceUi,
    canCurrentDevicePoll: pollingController.canPoll,
    updateActivePolling: pollingController.updateActive,
    appendLog,
  };
  websocketConfigUi = createMessageConfigUi({
    ...sharedMessageConfigOptions,
    prefix: "websocket",
    deviceLabelKey: "device.ws",
    storageKey: WEBSOCKET_CONFIG_STORAGE_KEY,
    defaults: DEFAULT_WEBSOCKET_CONFIG,
    normalize: normalizeWebSocketConfig,
    getConfig: () => websocketConfig,
    setConfig: (config) => {
      websocketConfig = config;
    },
    updateDebugger: () => messageDebugController.updateWebsocketDebuggerUi(),
  });
  mqttConfigUi = createMessageConfigUi({
    ...sharedMessageConfigOptions,
    prefix: "mqtt",
    deviceLabelKey: "device.mqtt",
    storageKey: MQTT_CONFIG_STORAGE_KEY,
    defaults: DEFAULT_MQTT_CONFIG,
    normalize: normalizeMqttConfig,
    getConfig: () => mqttConfig,
    setConfig: (config) => {
      mqttConfig = config;
    },
    updateDebugger: () => messageDebugController.updateMqttDebuggerUi(),
  });
  debugCurveController.register("websocket", {
    readForm: websocketConfigUi.read,
    populateForm: websocketConfigUi.populate,
    updateDraft: websocketConfigUi.updateDraft,
    defaults: DEFAULT_WEBSOCKET_CONFIG,
    normalize: normalizeWebSocketConfig,
    assign: (config) => { websocketConfig = config; },
  });
  debugCurveController.register("mqtt", {
    readForm: mqttConfigUi.read,
    populateForm: mqttConfigUi.populate,
    updateDraft: mqttConfigUi.updateDraft,
    defaults: DEFAULT_MQTT_CONFIG,
    normalize: normalizeMqttConfig,
    assign: (config) => { mqttConfig = config; },
  });
  debugCurveController.register("modbus", {
    readForm: modbusConfigUi.readConfigForm,
    populateForm: modbusConfigUi.populateConfigForm,
    updateDraft: updateModbusDraftConfig,
    defaults: DEFAULT_MODBUS_CONFIG,
    normalize: normalizeModbusConfig,
    assign: (config) => { modbusConfig = config; },
  });
  debugCurveController.register("custom", {
    readForm: customConfigUi.read,
    populateForm: customConfigUi.populate,
    updateDraft: customConfigUi.updateDraft,
    defaults: DEFAULT_CUSTOM_CONFIG,
    normalize: normalizeCustomConfig,
    assign: (config) => { customConfig = config; },
  });
  aomasterWaveformUi = createAomasterWaveformUi({
    elements,
    state,
    getCustomConfig: () => customConfig,
    getModbusConfig: () => modbusConfig,
    getSetpointChart: () => setpointChart,
    getActualChart: () => actualChart,
    getActualMode: getAomasterActualMode,
    resetActualMode: () => {
      aomasterActualMode = null;
    },
    isPercentMode: isAomasterPercentMode,
    getDisplayStep: getAomasterDisplayStep,
    formatDisplayNumber: formatAomasterDisplayNumber,
    readDisplayNumber: readAomasterDisplayNumber,
    getDisplayNumber: getAomasterDisplayNumber,
    getDisplayUnit: getAomasterDisplayUnit,
    formatDisplayValue: formatAomasterDisplayValue,
    formatDisplaySequence: formatAomasterDisplaySequence,
    updateSetpointUi,
    applyChartPointCountConfig,
    getChartPointCount,
    requestChartResize,
    appendLog,
  });
  transportController = createTransportController({
    elements,
    state,
    getConfigs: () => ({ customConfig, modbusConfig }),
    getSession: () => session,
    setSession: (nextSession) => {
      session = nextSession;
    },
    bindSessionEvents,
    appendLog,
    updateWebSocketStats: () => messageDebugController?.updateWebsocketStatsUi(),
    updateMqttDebugger: () => messageDebugController?.updateMqttDebuggerUi(),
    updateSetpointUi,
    updatePollingUi: pollingController.updateUi,
    updateDeviceUi,
    detectHartLink: (activeSession) => hartSessionController.detectLinkVersion(activeSession),
  });
  messageDebugController = createMessageDebugController({
    elements,
    getSession: () => session,
    getWebsocketConfig: () => websocketConfig,
    getMqttConfig: () => mqttConfig,
    transportController,
  });
}

function initializeHartControllers() {
  hartSessionController = createHartSessionController({
    elements,
    getConfig: () => hartConfig,
    setConfig: (config) => {
      hartConfig = config;
    },
    getSession: () => session,
    getDeviceId: () => state.deviceId,
    canProbeLink: () => state.transportId === DEFAULT_TRANSPORT_ID,
    populateConfigForm: (config) => hartConfigUi.populateConfigForm(config),
    updateDeviceUi,
    resetRxBuffer: resetHartRxBuffer,
    bytesToHex,
    appendLog,
  });
  hartWorkspaceController = createHartWorkspaceController({
    elements,
    getConfig: () => hartConfig,
    setConfig: (config) => {
      hartConfig = config;
    },
    isConnected: () => Boolean(session?.connected),
    isAddressScanActive: () => hartSessionController.isAddressScanActive(),
    readConfigForm: () => hartConfigUi.readConfigForm(),
    populateConfigForm: (config) => hartConfigUi.populateConfigForm(config),
    updateDeviceUi,
    sendSearchCommand: () => hartSessionController.sendSearchCommand(),
    sendDeviceCommand,
  });
  hartConfigUi = createHartConfigUi({
    elements,
    getConfig: () => hartConfig,
    populateWorkspaceControls: (config) => hartWorkspaceController.populateControls(config),
    updateDeviceInfo: updateHartDeviceInfo,
  });
  hartMonitorController = createHartMonitorController({
    elements,
    getConfig: () => hartConfig,
    setConfig: (config) => {
      hartConfig = config;
    },
    ensureChart: ensureHartTelemetryChart,
    getChart: () => hartChart,
    updateWorkspaceFromTelemetry: (telemetry) => hartWorkspaceController.updateFromTelemetry(telemetry),
    syncChartPanel: syncChartCurvePanelUi,
  });
}

function initializeChartControllers() {
  chartCsvController = createChartCsvController({
    elements,
    state,
    getConfigs: () => ({ customConfig, modbusConfig, websocketConfig, mqttConfig }),
    getCharts: () => ({ chart, hartChart, jsonMultiChart, setpointChart, actualChart }),
    getChartPointSettings,
    getAomasterDisplayUnit,
    getAomasterActualMode,
    getHartSeriesDefs: () => hartMonitorController.buildSeriesDefs(),
    shouldUseJsonMultiChart,
    getJsonMultiChartMeta,
    ensureHartChart: ensureHartTelemetryChart,
    ensureJsonMultiChart: ensureJsonMultiTelemetryChart,
    ensureSingleChart: ensureSingleTelemetryChart,
    getChartConfig: () => chartConfig,
    setChartConfig: (config) => {
      chartConfig = config;
    },
    populateChartConfigForm,
    applyChartPointCountConfig,
    updateHartVariableCards: (variables) => hartMonitorController.updateVariableCards(variables),
    requestChartResize,
    appendLog,
  });
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
    const { EchartsLiveChart, EchartsMultiLiveChart } = await import("./echarts-charts.js");
    EchartsLiveChartClass = EchartsLiveChart;
    EchartsMultiLiveChartClass = EchartsMultiLiveChart;
    const chartPointSettings = getChartPointSettings();
    chart = new EchartsLiveChart(elements.telemetryChart, {
      maxPoints: chartPointSettings.totalPointCount,
      visiblePoints: chartPointSettings.visiblePointCount,
      color: "#0f766e",
      areaColor: "rgba(15, 118, 110, 0.12)",
      emptyText: i18n("chart.emptyText"),
      title: i18n("chart.realTimeChart"),
    });
    setpointChart = new EchartsLiveChart(elements.setpointChartCanvas, {
      maxPoints: chartPointSettings.totalPointCount,
      visiblePoints: chartPointSettings.visiblePointCount,
      color: "#2563eb",
      areaColor: "rgba(37, 99, 235, 0.12)",
      emptyText: i18n("chart.emptySetpoint"),
      title: i18n("chart.setpointPreview"),
    });
    actualChart = new EchartsLiveChart(elements.actualChartCanvas, {
      maxPoints: chartPointSettings.totalPointCount,
      visiblePoints: chartPointSettings.visiblePointCount,
      color: "#0f766e",
      areaColor: "rgba(15, 118, 110, 0.12)",
      emptyText: i18n("chart.emptyActual"),
      title: i18n("chart.realTimeOutput"),
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
      elements.chartPanelSummary.textContent = `${i18n("chart.moduleLoadFailed")}${error.message}`;
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

function buildJsonMultiChartSeriesDefs(config, listSeriesFn) {
  return listSeriesFn(config).map((series) => ({
    key: series.key,
    name: series.fieldName,
    unit: series.unit,
    color: series.color,
    areaColor: `${series.color}1f`,
    visible: true,
  }));
}

function buildMqttChartSeriesDefs(config = mqttConfig) {
  return buildJsonMultiChartSeriesDefs(config, listMqttChartSeries);
}

function buildWebsocketChartSeriesDefs(config = websocketConfig) {
  return buildJsonMultiChartSeriesDefs(config, listWebSocketChartSeries);
}

function buildCustomChartSeriesDefs(config = customConfig) {
  return buildJsonMultiChartSeriesDefs(config, listCustomChartSeries);
}

function buildModbusChartSeriesDefs(config = modbusConfig) {
  return buildJsonMultiChartSeriesDefs(config, listModbusDeviceChartSeries);
}

function shouldUseMqttMultiChart(config = mqttConfig) {
  return buildMqttChartSeriesDefs(config).length > 1;
}

function shouldUseWebsocketMultiChart(config = websocketConfig) {
  return buildWebsocketChartSeriesDefs(config).length > 1;
}

function shouldUseCustomMultiChart(config = customConfig) {
  return buildCustomChartSeriesDefs(config).length > 1;
}

function shouldUseModbusMultiChart(config = modbusConfig) {
  return buildModbusChartSeriesDefs(config).length > 1;
}

function shouldUseJsonMultiChart() {
  if (state.deviceId === MQTT_DEVICE_ID) {
    return shouldUseMqttMultiChart();
  }

  if (state.deviceId === WEBSOCKET_DEVICE_ID) {
    return shouldUseWebsocketMultiChart();
  }

  if (state.deviceId === CUSTOM_DEVICE_ID) {
    return shouldUseCustomMultiChart();
  }

  if (state.deviceId === MODBUS_DEVICE_ID) {
    return shouldUseModbusMultiChart();
  }

  return false;
}

function buildJsonMultiChartSignature(seriesDefs) {
  return JSON.stringify(
    seriesDefs.map((series) => ({
      key: series.key,
      name: series.name,
      color: series.color,
    })),
  );
}

function getJsonMultiChartMeta() {
  if (state.deviceId === WEBSOCKET_DEVICE_ID) {
    return {
      title: i18n("chart.wsChart"),
      emptyText: i18n("chart.wsEmpty"),
      seriesDefs: buildWebsocketChartSeriesDefs(),
    };
  }

  if (state.deviceId === CUSTOM_DEVICE_ID) {
    return {
      title: i18n("chart.serialChart"),
      emptyText: i18n("chart.serialEmpty"),
      seriesDefs: buildCustomChartSeriesDefs(),
    };
  }

  if (state.deviceId === MODBUS_DEVICE_ID) {
    return {
      title: i18n("chart.modbusChart"),
      emptyText: i18n("chart.modbusEmpty"),
      seriesDefs: buildModbusChartSeriesDefs(),
    };
  }

  return {
    title: i18n("chart.mqttChart"),
    emptyText: i18n("chart.mqttEmpty"),
    seriesDefs: buildMqttChartSeriesDefs(),
  };
}

function ensureHartTelemetryChart() {
  if (!chartsReady || !EchartsMultiLiveChartClass || !elements.telemetryChart) {
    return;
  }

  if (hartChart) {
    hartChart.setVisibleMap(normalizeHartConfig(hartConfig).chartSeries);
    return;
  }

  chart?.dispose();
  chart = null;
  jsonMultiChart?.dispose();
  jsonMultiChart = null;
  jsonMultiChartSignature = "";

  const chartPointSettings = getChartPointSettings();
  hartChart = new EchartsMultiLiveChartClass(elements.telemetryChart, {
    maxPoints: chartPointSettings.totalPointCount,
    visiblePoints: chartPointSettings.visiblePointCount,
    emptyText: i18n("chart.emptyText"),
    title: i18n("chart.hartVar"),
    series: hartMonitorController.buildSeriesDefs(),
  });
  allCharts = [hartChart, setpointChart, actualChart].filter(Boolean);
  applyChartPointCountConfig();
}

function ensureJsonMultiTelemetryChart() {
  if (!chartsReady || !EchartsMultiLiveChartClass || !elements.telemetryChart) {
    return;
  }

  const { title, emptyText, seriesDefs } = getJsonMultiChartMeta();
  const nextSignature = buildJsonMultiChartSignature(seriesDefs);
  if (jsonMultiChart && jsonMultiChartSignature === nextSignature) {
    return;
  }

  chart?.dispose();
  chart = null;
  hartChart?.dispose();
  hartChart = null;
  jsonMultiChart?.dispose();
  jsonMultiChart = null;

  const chartPointSettings = getChartPointSettings();
  jsonMultiChart = new EchartsMultiLiveChartClass(elements.telemetryChart, {
    maxPoints: chartPointSettings.totalPointCount,
    visiblePoints: chartPointSettings.visiblePointCount,
    emptyText,
    title,
    series: seriesDefs,
  });
  jsonMultiChartSignature = nextSignature;
  allCharts = [jsonMultiChart, setpointChart, actualChart].filter(Boolean);
  applyChartPointCountConfig();
}

function ensureSingleTelemetryChart() {
  if (!chartsReady || !EchartsLiveChartClass || !elements.telemetryChart) {
    return;
  }

  if (chart) {
    return;
  }

  hartChart?.dispose();
  hartChart = null;
  jsonMultiChart?.dispose();
  jsonMultiChart = null;
  jsonMultiChartSignature = "";

  const chartPointSettings = getChartPointSettings();
  chart = new EchartsLiveChartClass(elements.telemetryChart, {
    maxPoints: chartPointSettings.totalPointCount,
    visiblePoints: chartPointSettings.visiblePointCount,
    color: "#0f766e",
    areaColor: "rgba(15, 118, 110, 0.12)",
    emptyText: i18n("chart.emptyText"),
    title: i18n("chart.realTimeChart"),
  });
  allCharts = [chart, setpointChart, actualChart].filter(Boolean);
  applyChartPointCountConfig();
}

function handleJsonMultiTelemetry(telemetry) {
  if (telemetry?.isMulti && telemetry.variables) {
    ensureJsonMultiTelemetryChart();
    const sample = Object.fromEntries(
      Object.entries(telemetry.variables).map(([key, entry]) => [key, entry.value]),
    );
    jsonMultiChart?.addSample(sample);

    if (elements.chartValue) {
      elements.chartValue.textContent = Object.values(telemetry.variables)
        .map((entry) => `${entry.fieldName} ${entry.value.toFixed(3)}${entry.unit ? ` ${entry.unit}` : ""}`)
        .join(" · ");
    }
    return;
  }

  if (telemetry && Number.isFinite(telemetry.value)) {
    chart?.add(telemetry.value);
    if (elements.chartValue) {
      elements.chartValue.textContent = `${telemetry.fieldName} ${telemetry.value.toFixed(3)}${telemetry.unit ? ` ${telemetry.unit}` : ""}`;
    }
  }
}

function describeChartPanelSummary(totalPointCount, visiblePointCount) {
  if (state.deviceId === DEFAULT_DEVICE_ID) {
    return i18n("chart.aomasterDesc").replace("{total}", totalPointCount).replace("{visible}", visiblePointCount);
  }

  if (state.deviceId === HART_DEVICE_ID) {
    return i18n("chart.hartDesc").replace("{total}", totalPointCount).replace("{visible}", visiblePointCount);
  }

  if (state.deviceId === MODBUS_DEVICE_ID) {
    return shouldUseModbusMultiChart()
      ? i18n("chart.modbusMultiDesc").replace("{total}", totalPointCount).replace("{visible}", visiblePointCount)
      : i18n("chart.modbusSingleDesc").replace("{total}", totalPointCount).replace("{visible}", visiblePointCount);
  }

  if (state.deviceId === WEBSOCKET_DEVICE_ID) {
    return shouldUseWebsocketMultiChart()
      ? i18n("chart.wsMultiDesc").replace("{total}", totalPointCount).replace("{visible}", visiblePointCount)
      : i18n("chart.wsSingleDesc").replace("{total}", totalPointCount).replace("{visible}", visiblePointCount);
  }

  if (state.deviceId === MQTT_DEVICE_ID) {
    return shouldUseMqttMultiChart()
      ? i18n("chart.mqttMultiDesc").replace("{total}", totalPointCount).replace("{visible}", visiblePointCount)
      : i18n("chart.mqttSingleDesc").replace("{total}", totalPointCount).replace("{visible}", visiblePointCount);
  }

  if (state.deviceId === CUSTOM_DEVICE_ID) {
    return shouldUseCustomMultiChart()
      ? i18n("chart.customMultiDesc").replace("{total}", totalPointCount).replace("{visible}", visiblePointCount)
      : i18n("chart.customSingleDesc").replace("{total}", totalPointCount).replace("{visible}", visiblePointCount);
  }

  return i18n("chart.defaultDesc").replace("{total}", totalPointCount).replace("{visible}", visiblePointCount);
}

function describeChartCurveConfigSummary() {
  if (state.deviceId === DEFAULT_DEVICE_ID) {
    return i18n("chart.dualCurve");
  }

  if (state.deviceId === MODBUS_DEVICE_ID) {
    const series = listModbusDeviceChartSeries(modbusConfig);
    if (series.length > 1) {
      return i18n("chart.modbusCurveCount").replace("{count}", series.length);
    }
    const normalized = normalizeModbusConfig(modbusConfig);
    return `${i18n("chart.singleCurve")} · ${normalized.fieldName || i18n("chart.registryValue")}`;
  }

  if (state.deviceId === HART_DEVICE_ID) {
    const normalized = normalizeHartConfig(hartConfig);
    const labels = HART_VARIABLE_CARDS.filter((card) => normalized.chartSeries[card.key]).map((card) => card.label);
    return labels.length ? labels.join(" / ") : i18n("chart.notSelected");
  }

  if (state.deviceId === CUSTOM_DEVICE_ID) {
    const normalized = normalizeCustomConfig(customConfig);
    const series = listCustomChartSeries(customConfig);
    if (series.length > 1) {
      const modeLabel = normalized.parserMode === "hex" ? "HEX" : normalized.parserMode === "modbus" ? "Modbus" : "JSON";
      return i18n("chart.multiCurveCount").replace("{count}", series.length).replace("{mode}", modeLabel);
    }
    if (normalized.parserMode === "hex") {
      return `${i18n("chart.singleCurve")} · HEX ${i18n("chart.hexRaw").split(" · ").pop()}`;
    }
    if (normalized.parserMode === "modbus") {
      return `${i18n("chart.singleCurve")} · ${i18n("chart.modbusPayload").split(" · ").pop()}`;
    }
    return describeJsonCurveSummary(normalized, DEFAULT_CUSTOM_CONFIG);
  }

  if (state.deviceId === WEBSOCKET_DEVICE_ID) {
    const normalized = normalizeWebSocketConfig(websocketConfig);
    const series = listWebSocketChartSeries(websocketConfig);
    if (series.length > 1) {
      const modeLabel = normalized.parserMode === "hex" ? "HEX" : normalized.parserMode === "modbus" ? "Modbus" : "JSON";
      return i18n("chart.multiCurveCount").replace("{count}", series.length).replace("{mode}", modeLabel);
    }
    if (normalized.parserMode === "hex") {
      return `${i18n("chart.singleCurve")} · HEX ${i18n("chart.hexRaw").split(" · ").pop()}`;
    }
    if (normalized.parserMode === "modbus") {
      return `${i18n("chart.singleCurve")} · ${i18n("chart.modbusPayload").split(" · ").pop()}`;
    }
    return describeJsonCurveSummary(normalized, DEFAULT_WEBSOCKET_CONFIG);
  }

  if (state.deviceId === MQTT_DEVICE_ID) {
    const normalized = normalizeMqttConfig(mqttConfig);
    const series = listMqttChartSeries(mqttConfig);
    if (series.length > 1) {
      const modeLabel = normalized.parserMode === "hex" ? "HEX" : normalized.parserMode === "modbus" ? "Modbus" : "JSON";
      return i18n("chart.multiCurveCount").replace("{count}", series.length).replace("{mode}", modeLabel);
    }
    if (normalized.parserMode === "hex") {
      return `${i18n("chart.singleCurve")} · HEX ${i18n("chart.hexRaw").split(" · ").pop()}`;
    }
    if (normalized.parserMode === "modbus") {
      return `${i18n("chart.singleCurve")} · ${i18n("chart.modbusPayload").split(" · ").pop()}`;
    }
    return describeJsonCurveSummary(normalized, DEFAULT_MQTT_CONFIG);
  }

  return i18n("chart.singleCurve");
}

function syncChartCurvePanelUi() {
  updateChartCurvePanel({
    elements,
    deviceId: state.deviceId,
    isDevicePage: deviceNavigationUi.isDevicePageActive(),
    summary: describeChartCurveConfigSummary(),
  });
  requestChartCurvePanelResize();
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
    elements.chartPointCount.title = i18n("workbench.totalPointsTitle");
  }
  if (elements.visibleChartPointCount) {
    elements.visibleChartPointCount.value = String(visiblePointCount);
    elements.visibleChartPointCount.max = String(totalPointCount);
    elements.visibleChartPointCount.title = i18n("workbench.displayPointsTitle");
  }
  if (elements.chartPanelSummary) {
    elements.chartPanelSummary.textContent = describeChartPanelSummary(totalPointCount, visiblePointCount);
  }
}

function bindSessionEvents(target) {
  target.addEventListener("connected", () => {
    messageDebugController.resetStats();
    resetMqttRxBuffer();
    resetWebSocketRxBuffer();
    resetCustomRxBuffer(customConfig);
    transportController.updateConnectionUi(true);
    pollingController.updateActive();
    appendLog("info", i18n("log.connect"), transportController.describeConnectionSummary());
  });

  target.addEventListener("disconnected", () => {
    state.pollingActive = false;
    pollingController.stopAll();
    resetModbusRxBuffer();
    resetHartRxBuffer();
    hartSessionController.resetLinkProbe();
    resetAomasterRxBuffer();
    resetMqttRxBuffer();
    resetWebSocketRxBuffer();
    resetCustomRxBuffer(customConfig);
    finalizeRxLogCoalesce();
    transportController.updateConnectionUi(false);
    messageDebugController.resetStats();
    appendLog("info", i18n("log.connect"), i18n("log.disconnected"));
  });

  target.addEventListener("rx", (event) => {
    const { bytes, text, topic } = event.detail;
    const hartLinkProbeChunk =
      state.deviceId === HART_DEVICE_ID && state.transportId === DEFAULT_TRANSPORT_ID
        ? hartSessionController.handleLinkProbeRx(text)
        : false;
    const useHexDisplay =
      state.deviceId === MODBUS_DEVICE_ID ||
      state.deviceId === HART_DEVICE_ID ||
      state.deviceId === DEFAULT_DEVICE_ID;
    const rxPayload = topic ? `[${topic}] ${text ?? bytesToHex(bytes)}` : text ?? bytesToHex(bytes);
    queueRxLogDisplay(bytes, rxPayload, useHexDisplay && !topic && !hartLinkProbeChunk);

    if (hartLinkProbeChunk) {
      return;
    }

    if (state.deviceId === WEBSOCKET_DEVICE_ID) {
      messageDebugController.increment("websocket", "rx");
    }

    if (state.deviceId === MQTT_DEVICE_ID) {
      messageDebugController.increment("mqtt", "rx");
    }

    const telemetry = parseDeviceTelemetry(
      state.deviceId,
      text,
      customConfig,
      modbusConfig,
      bytes,
      state,
      aomasterConfig,
      hartConfig,
      websocketConfig,
      mqttConfig,
    );
    if (telemetry) {
      if (state.deviceId === HART_DEVICE_ID && telemetry.isDiscovery) {
        hartConfig = mergeHartDiscovery(hartConfig, telemetry);
        hartConfigUi.populateConfigForm(hartConfig);
        updateHartDeviceInfo();
        hartWorkspaceController.updateFromDiscovery(telemetry);
        appendLog("info", "HART", formatHartDeviceSummary(hartConfig.device));
        updateDeviceUi();
        return;
      }

      if (state.deviceId === DEFAULT_DEVICE_ID) {
        const readbackMode = telemetry.mode || state.mode;
        aomasterActualMode = readbackMode;
        actualChart?.setMeta({ unit: getAomasterDisplayUnit(readbackMode) });
        aomasterWaveformUi.syncActualChartRange(readbackMode);
        actualChart?.add(getAomasterDisplayNumber(telemetry.value, readbackMode));
        const formatted = formatAomasterDisplayValue(telemetry.value, readbackMode);
        elements.actualChartValue.textContent = `${telemetry.fieldName} ${formatted}`;
      } else if (state.deviceId === HART_DEVICE_ID) {
        hartMonitorController.handleTelemetry(telemetry);
      } else if (
        state.deviceId === MQTT_DEVICE_ID ||
        state.deviceId === WEBSOCKET_DEVICE_ID ||
        state.deviceId === CUSTOM_DEVICE_ID ||
        state.deviceId === MODBUS_DEVICE_ID
      ) {
        handleJsonMultiTelemetry(telemetry);
      } else {
        chart?.add(telemetry.value);
        const formatted = `${telemetry.value.toFixed(3)}${telemetry.unit ? ` ${telemetry.unit}` : ""}`;
        elements.chartValue.textContent = `${telemetry.fieldName} ${formatted}`;
      }
    }
  });

  target.addEventListener("tx", (event) => {
    finalizeRxLogCoalesce();
    const { bytes, text, topic, qos, retain } = event.detail;
    let payload = text ?? bytesToHex(bytes);
    if (topic) {
      const flags = [];
      if (qos) {
        flags.push(`QoS${qos}`);
      }
      if (retain) {
        flags.push("retain");
      }
      payload = `[${topic}${flags.length ? ` ${flags.join(" ")}` : ""}] ${payload}`;
    }
    appendLog("tx", "TX", payload);

    if (state.deviceId === WEBSOCKET_DEVICE_ID) {
      messageDebugController.increment("websocket", "tx");
    }

    if (state.deviceId === MQTT_DEVICE_ID) {
      messageDebugController.increment("mqtt", "tx");
    }
  });

  target.addEventListener("error", (event) => {
    appendLog("error", i18n("log.error"), event.detail.error?.message ?? String(event.detail.error));
  });
}

function selectDevice(deviceId) {
  hartSessionController.resetLinkProbe();
  const standalone = isStandaloneDevice(deviceId);
  state.pollingActive = false;
  pollingController.stopAll();
  resetModbusRxBuffer();
  resetHartRxBuffer();
  resetAomasterRxBuffer();
  state.deviceId = deviceId;
  state.pageId = deviceId;

  if (standalone && session?.connected) {
    void transportController.disconnect().catch((error) => appendLog("error", i18n("log.connect"), error.message));
  }

  if (deviceId === CUSTOM_DEVICE_ID) {
    state.mode = "custom";
    state.setpoint = normalizeCustomConfig(customConfig).defaultValue;
  } else if (deviceId === MODBUS_DEVICE_ID) {
    const normalized = normalizeModbusConfig(modbusConfig);
    state.mode = getModbusMode(normalized.functionCode);
    const config = getModeConfig(state.mode, deviceId, customConfig, modbusConfig);
    state.setpoint = config.presets.mid;
  } else if (deviceId === HART_DEVICE_ID) {
    const normalized = normalizeHartConfig(hartConfig);
    state.mode = getHartMode(normalized.activeCommand);
    const config = getModeConfig(state.mode, deviceId, customConfig, modbusConfig);
    state.setpoint = config.presets.mid;
  } else if (!standalone && deviceId !== WEBSOCKET_DEVICE_ID && deviceId !== MQTT_DEVICE_ID) {
    state.mode = elements.outputModeSelect?.value || "current";
    aomasterWaveformUi.applyModeDefaults();
  }

  if (!standalone) {
    transportController.applyDeviceDefaultTransport(deviceId);
  }

  clearAllCharts();
  if (!standalone) {
    aomasterWaveformUi.syncChartRanges();
  }
  deviceNavigationUi.updatePage();
  updateDeviceUi();
  pollingController.updateActive();
  pollingController.updateUi();
  sidebarController.applyLayout();
  resetViewportScroll();
  appendLog("info", i18n("log.device"), `${i18n("log.switchedTo")} ${getDeviceProfile(state.deviceId, customConfig, modbusConfig).name}`);

  if (deviceId === HART_DEVICE_ID && state.transportId === DEFAULT_TRANSPORT_ID && session?.connected) {
    void hartSessionController.detectLinkVersion(session);
  }
}

function navigateToPage(pageId) {
  if (DEVICE_PAGE_IDS.includes(pageId)) {
    selectDevice(pageId);
    return;
  }

  state.pageId = pageId === "request" ? "request" : "home";
  deviceNavigationUi.updatePage();
  updateDeviceUi();
  sidebarController.applyLayout();
  resetViewportScroll();
}

function resetViewportScroll() {
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
}

function updateDeviceUi() {
  syncChartConfigElements();
  bindChartConfigEvents();
  updateChartPointLabels();
  const profile = getDeviceProfile(state.deviceId, customConfig, modbusConfig);
  const isCustom = state.deviceId === CUSTOM_DEVICE_ID;
  const isModbus = state.deviceId === MODBUS_DEVICE_ID;
  const isHart = state.deviceId === HART_DEVICE_ID;
  const isWebsocket = state.deviceId === WEBSOCKET_DEVICE_ID;
  const isMqtt = state.deviceId === MQTT_DEVICE_ID;
  const isMessageDebug = isWebsocket || isMqtt;
  const isAomaster = state.deviceId === DEFAULT_DEVICE_ID;
  const isStandalone = isStandaloneDevice(state.deviceId);
  const normalizedModbus = normalizeModbusConfig(modbusConfig);
  const modbusIsRead = isModbus && isReadFunctionCode(normalizedModbus.functionCode);

  if (elements.customDeviceNavName) {
    elements.customDeviceNavName.textContent = normalizeCustomConfig(customConfig).name;
  }

  const setpointRow = queryDeviceField("setpointRow");
  const presetRow = queryDeviceField("presetRow");
  if (setpointRow) {
    setpointRow.hidden = isStandalone || modbusIsRead || isHart || isMessageDebug;
  }
  if (presetRow) {
    presetRow.hidden = isStandalone || modbusIsRead || isHart || isMessageDebug;
  }

  if (!isStandalone) {
    if (elements.singleChartBlock) {
      elements.singleChartBlock.hidden = isAomaster;
    }
    if (elements.dualChartBlock) {
      elements.dualChartBlock.hidden = !isAomaster;
    }
    syncChartCurvePanelUi();
    if (isHart) {
      hartConfigUi.syncCommandModeUi();
      ensureHartTelemetryChart();
      hartMonitorController.syncSeriesControls();
      hartMonitorController.updateVariableCards();
    } else if (
      (isMqtt && shouldUseMqttMultiChart()) ||
      (isWebsocket && shouldUseWebsocketMultiChart()) ||
      (isCustom && shouldUseCustomMultiChart()) ||
      (isModbus && shouldUseModbusMultiChart())
    ) {
      ensureJsonMultiTelemetryChart();
    } else {
      ensureSingleTelemetryChart();
    }
    if (elements.chartPanelSummary) {
      const chartPointSettings = getChartPointSettings();
      elements.chartPanelSummary.textContent = describeChartPanelSummary(
        chartPointSettings.totalPointCount,
        chartPointSettings.visiblePointCount,
      );
    }
  }

  const summary = queryDeviceField("deviceSummary");
  if (summary) {
    if (isCustom) {
      summary.textContent = `${profile.name}${i18n("custom.deviceConfigDescSummary")}`;
    } else if (isModbus) {
      summary.textContent = describeModbusSummary(modbusConfig);
    } else if (isHart) {
      summary.textContent = describeHartSummary(hartConfig);
    } else if (isWebsocket) {
      summary.textContent = describeWebSocketSummary(websocketConfig);
    } else if (isMqtt) {
      summary.textContent = describeMqttSummary(mqttConfig);
    } else if (isAomaster) {
      summary.textContent = describeAomasterSummary(aomasterConfig);
    } else {
      summary.textContent = profile.name;
    }
  }

  document.querySelectorAll("[data-device-id]").forEach((button) => {
    button.classList.toggle(
      "active",
      button.dataset.deviceId === state.deviceId && deviceNavigationUi.isDevicePageActive(),
    );
  });

  if (isStandalone) {
    requestChartResize();
    pollingController.updateUi();
    return;
  }

  if (isAomaster) {
    syncAomasterValueDisplayControls();
    aomasterWaveformUi.populateOutputModes();
    if (elements.outputModeSelect) {
      elements.outputModeSelect.value = state.mode;
      elements.outputModeSelect.disabled = false;
      elements.outputModeSelect.title = "";
    }
    if (elements.waveformSelect) {
      elements.waveformSelect.value = state.waveform;
    }
    aomasterWaveformUi.populateForm();
    aomasterWaveformUi.updateUi();
    aomasterWaveformUi.syncChartRanges();
    aomasterWaveformUi.refreshPreview();
  }

  if (!isAomaster && !isHart && !isMessageDebug && chart) {
    const chartConfig = getModeConfig(state.mode, state.deviceId, customConfig, modbusConfig);
    chart.setMeta({ title: i18n("chart.realTimeChart"), unit: chartConfig.unit });
  }

  if (isHart) {
    updateHartDeviceInfo();
  }

  if (isWebsocket) {
    messageDebugController.renderWebsocketQuickSends();
    messageDebugController.updateWebsocketDebuggerUi();
    if (elements.sendFormat) {
      elements.sendFormat.value = "json";
    }
    if (elements.lineEnding) {
      elements.lineEnding.value = "";
    }
  }

  if (isMqtt) {
    messageDebugController.renderMqttQuickSends();
    messageDebugController.updateMqttDebuggerUi();
    if (elements.sendFormat) {
      elements.sendFormat.value = "json";
    }
    if (elements.lineEnding) {
      elements.lineEnding.value = "";
    }
  }

  requestChartResize();
  updateSetpointUi();
  pollingController.updateUi();
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

function getAomasterActualMode() {
  return aomasterActualMode || state.mode;
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

function getAomasterDisplayUnit(mode = state.mode) {
  return isAomasterPercentMode() ? "%" : getModeConfig(mode, DEFAULT_DEVICE_ID, customConfig, modbusConfig).unit;
}

function updateSetpoint(value) {
  const config = getModeConfig(state.mode, state.deviceId, customConfig, modbusConfig);
  const sourceValue = isAomasterPercentMode() ? getAomasterValueFromPercent(value) : value;
  const bounded = Math.min(config.max, Math.max(config.min, sourceValue));
  state.setpoint = Number.isFinite(bounded) ? bounded : config.presets.mid;
  updateSetpointUi();
}

function updateSetpointUi() {
  if (state.deviceId === WEBSOCKET_DEVICE_ID || state.deviceId === MQTT_DEVICE_ID) {
    updateMessageDebugCommandUi();
    return;
  }

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
    setpointUnit.textContent = isPercent ? "%" : config.unit || i18n("common.val");
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
    aomasterWaveformUi.refreshPreview();
  }

  const command = createDeviceSetOutputCommand(
    state.deviceId,
    state,
    customConfig,
    modbusConfig,
    aomasterConfig,
    hartConfig,
    websocketConfig,
    mqttConfig,
  );
  if (protocolPreview) {
    protocolPreview.textContent = command.preview;
  }
  if (state.deviceId === HART_DEVICE_ID && elements.hartFrameChecksum) {
    if (command.supported && Number.isFinite(command.checksum)) {
      elements.hartFrameChecksum.textContent = `0x${command.checksum.toString(16).toUpperCase().padStart(2, "0")}${i18n("hart.xorAuto")}`;
    } else if (command.supported && command.bytes?.length) {
      const checksum = command.bytes[command.bytes.length - 1];
      elements.hartFrameChecksum.textContent = `0x${checksum.toString(16).toUpperCase().padStart(2, "0")}${i18n("hart.xorAuto")}`;
    } else {
      elements.hartFrameChecksum.textContent = "--";
    }
  }
  if (sendDriverCommand) {
    sendDriverCommand.disabled = !command.supported || !session?.connected;
  }

  if (state.deviceId === MODBUS_DEVICE_ID) {
    const normalized = normalizeModbusConfig(modbusConfig);
    const isRead = isReadFunctionCode(normalized.functionCode);
    if (sendDriverCommand) {
      sendDriverCommand.textContent = isRead ? i18n("driver.readRegister") : i18n("driver.writeRegister");
    }
    if (driverState) {
      driverState.textContent = i18n("driver.modbusRtu");
      driverState.classList.remove("warning");
    }
    return;
  }

  if (state.deviceId === HART_DEVICE_ID) {
    updateHartDeviceInfo();
    hartWorkspaceController.updateUi();
    if (sendDriverCommand) {
      sendDriverCommand.textContent = i18n("driver.sendCommand");
    }
    if (elements.hartSearchDevice) {
      elements.hartSearchDevice.disabled = !session?.connected || hartSessionController.isAddressScanActive();
    }
    if (elements.hartScanAddresses) {
      elements.hartScanAddresses.disabled = !session?.connected || hartSessionController.isAddressScanActive();
      elements.hartScanAddresses.textContent = hartSessionController.isAddressScanActive() ? i18n("hart.scanning") : i18n("hart.scanAddresses");
    }
    if (driverState) {
      driverState.textContent = normalizeHartConfig(hartConfig).device.discovered ? i18n("driver.hartIdentified") : i18n("driver.hartNotSearched");
      driverState.classList.toggle("warning", !normalizeHartConfig(hartConfig).device.discovered);
    }
    return;
  }

  if (state.deviceId === DEFAULT_DEVICE_ID) {
    if (sendDriverCommand) {
      sendDriverCommand.textContent = i18n("driver.sendSetting");
    }
    if (driverState) {
      driverState.textContent = i18n("driver.modbusRtu");
      driverState.classList.remove("warning");
    }
    return;
  }

  if (sendDriverCommand) {
    sendDriverCommand.textContent = i18n("driver.sendSetting");
  }
  if (driverState) {
    driverState.textContent = command.supported ? i18n("driver.templateReady") : i18n("driver.protocolPending");
    driverState.classList.toggle("warning", !command.supported);
  }
}

function updateMessageDebugCommandUi() {
  const protocolPreview = queryDeviceField("protocolPreview");
  const sendDriverCommand = queryDeviceField("sendDriverCommand");
  const driverState = queryDeviceField("driverState");
  const command = createDeviceSetOutputCommand(
    state.deviceId,
    state,
    customConfig,
    modbusConfig,
    aomasterConfig,
    hartConfig,
    websocketConfig,
    mqttConfig,
  );

  if (protocolPreview) {
    protocolPreview.textContent = command.preview;
  }
  if (sendDriverCommand) {
    sendDriverCommand.textContent = i18n("driver.sendPollMsg");
    sendDriverCommand.disabled = !command.supported || !session?.connected;
  }
  if (driverState) {
    const label = state.deviceId === MQTT_DEVICE_ID ? i18n("driver.mqttDebug") : i18n("driver.wsDebug");
    driverState.textContent = command.supported ? label : i18n("driver.configPollMsg");
    driverState.classList.toggle("warning", !command.supported);
  }
}

async function copyRequestTemplate() {
  try {
    await navigator.clipboard.writeText(elements.deviceRequestTemplate.value);
    elements.copyRequestTemplate.textContent = i18n("common.copied");
    window.setTimeout(() => {
      elements.copyRequestTemplate.textContent = i18n("request.copyTemplate");
    }, 1400);
  } catch {
    appendLog("error", i18n("log.system"), i18n("request.copyFailed"));
  }
}

async function sendDeviceCommand() {
  try {
    const command = createDeviceSetOutputCommand(
      state.deviceId,
      state,
      customConfig,
      modbusConfig,
      aomasterConfig,
      hartConfig,
      websocketConfig,
      mqttConfig,
    );
    const frames = command.frames ?? (command.bytes ? [command.bytes] : []);
    if (!command.supported || frames.length === 0) {
      appendLog("error", i18n("log.send"), command.preview || i18n("common.noDriverCmd"));
      return;
    }

    if (
      state.deviceId === HART_DEVICE_ID &&
      command.requiresConfirmation &&
      !window.confirm(`${i18n("hart.writeConfirm")}\n\n${command.preview}`)
    ) {
      appendLog("info", i18n("log.send"), i18n("hart.writeCancelled"));
      return;
    }

    const writeOptions = state.deviceId === MQTT_DEVICE_ID ? messageDebugController.readMqttWriteOptions() : undefined;
    const interframeDelayMs = state.deviceId === AOMASTER_DEVICE_ID ? AOMASTER_INTERFRAME_DELAY_MS : 0;
    for (let index = 0; index < frames.length; index++) {
      const frame = frames[index];
      await session.write(frame, writeOptions);
      if (interframeDelayMs > 0 && index + 1 < frames.length) {
        await wait(interframeDelayMs);
      }
    }
  } catch (error) {
    appendLog("error", i18n("log.send"), error.message);
  }
}

async function sendManualCommand() {
  try {
    const command = elements.manualCommand.value;
    if (!command.trim()) {
      appendLog("error", i18n("log.send"), i18n("common.cmdNotEmpty"));
      return;
    }

    const payload = buildManualPayload(elements.sendFormat.value, command, resolveLineEnding(elements.lineEnding.value));
    if (state.deviceId === MQTT_DEVICE_ID) {
      await session.write(payload, messageDebugController.readMqttWriteOptions());
      return;
    }

    await session.write(payload);
  } catch (error) {
    appendLog("error", i18n("log.send"), error.message);
  }
}

const PARSER_TEST_SPECS = {
  [CUSTOM_DEVICE_ID]: {
    readForm: () => {
      customConfig = customConfigUi.read();
      return customConfig;
    },
    sampleKey: "customParserSample",
    previewKey: "customParserPreview",
    prepareSample(sample, config) {
      resetCustomRxBuffer(config);
      try {
        return { text: null, bytes: parseHexPayload(sample) };
      } catch {
        return { text: sample, bytes: null };
      }
    },
  },
  [MODBUS_DEVICE_ID]: {
    readForm: () => {
      modbusConfig = modbusConfigUi.readConfigForm();
      return modbusConfig;
    },
    sampleKey: "modbusParserSample",
    previewKey: "modbusParserPreview",
    prepareSample(sample) {
      resetModbusRxBuffer();
      try {
        return { text: null, bytes: parseHexPayload(sample) };
      } catch {
        return null;
      }
    },
  },
  [WEBSOCKET_DEVICE_ID]: {
    readForm: () => {
      websocketConfig = websocketConfigUi.read();
      return websocketConfig;
    },
    sampleKey: "websocketParserSample",
    previewKey: "websocketParserPreview",
    prepareSample(sample) {
      return { text: sample, bytes: null };
    },
  },
  [MQTT_DEVICE_ID]: {
    readForm: () => {
      mqttConfig = mqttConfigUi.read();
      return mqttConfig;
    },
    sampleKey: "mqttParserSample",
    previewKey: "mqttParserPreview",
    prepareSample(sample) {
      return { text: sample, bytes: null };
    },
  },
};

function testDeviceParser(deviceId) {
  const spec = PARSER_TEST_SPECS[deviceId];
  if (!spec) {
    return;
  }

  const config = spec.readForm();
  const sample = elements[spec.sampleKey]?.value ?? "";
  const prepared = spec.prepareSample(sample, config);

  if (!prepared) {
    renderParserPreview(elements[spec.previewKey], null);
    return;
  }

  const telemetry = parseDeviceTelemetry(
    deviceId,
    prepared.text,
    customConfig,
    modbusConfig,
    prepared.bytes,
    state,
    aomasterConfig,
    hartConfig,
    websocketConfig,
    mqttConfig,
  );

  renderParserPreview(elements[spec.previewKey], telemetry);
}

function renderParserPreview(target, telemetry) {
  if (!target) {
    return;
  }

  if (!telemetry) {
    target.textContent = i18n("chart.notParsed");
    target.classList.add("warning");
    return;
  }

  if (telemetry.isMulti && telemetry.variables) {
    target.textContent = Object.values(telemetry.variables)
      .map((entry) => `${entry.fieldName}: ${entry.value.toFixed(6)}${entry.unit ? ` ${entry.unit}` : ""}`)
      .join(" · ");
    target.classList.remove("warning");
    return;
  }

  target.textContent = `${telemetry.fieldName}: ${telemetry.value.toFixed(6)}${telemetry.unit ? ` ${telemetry.unit}` : ""}`;
  target.classList.remove("warning");
}

function updateModbusDraftConfig() {
  modbusConfig = modbusConfigUi.readConfigForm();
  debugCurveController.syncRows("modbus", modbusConfig);
  syncChartCurvePanelUi();

  if (state.deviceId === MODBUS_DEVICE_ID) {
    const normalized = normalizeModbusConfig(modbusConfig);
    state.mode = getModbusMode(normalized.functionCode);
    const config = getModeConfig(state.mode, state.deviceId, customConfig, modbusConfig);
    state.setpoint = Math.min(config.max, Math.max(config.min, state.setpoint));
    resetModbusRxBuffer();
  }

  updateDeviceUi();
  if (state.pollingActive && !pollingController.canPoll()) {
    state.pollingActive = false;
  }
  pollingController.updateActive();
}

function saveModbusConfig() {
  modbusConfig = modbusConfigUi.readConfigForm();
  persistModbusConfig(modbusConfig);
  modbusConfigUi.populateConfigForm(modbusConfig);
  updateDeviceUi();
  pollingController.updateActive();
  appendLog("info", i18n("log.device"), `${i18n("device.modbus")}${i18n("common.configSavedShort")}`);
}

function resetModbusConfig() {
  modbusConfig = normalizeModbusConfig(DEFAULT_MODBUS_CONFIG);
  persistModbusConfig(modbusConfig);
  modbusConfigUi.populateConfigForm(modbusConfig);
  resetModbusRxBuffer();

  if (state.deviceId === MODBUS_DEVICE_ID) {
    state.mode = getModbusMode(modbusConfig.functionCode);
    state.setpoint = getModeConfig(state.mode, state.deviceId, customConfig, modbusConfig).presets.mid;
  }

  updateDeviceUi();
  pollingController.updateActive();
  appendLog("info", i18n("log.device"), `${i18n("device.modbus")}${i18n("common.configResetShort")}`);
}

async function sendHartPollCommand() {
  if (!session?.connected) {
    return;
  }

  const command = createHartPollCommand(hartConfig, { bytesToHex, parseHexPayload });
  if (!command.supported || !command.bytes) {
    return;
  }

  await session.write(command.bytes);
}

function updateHartDraftConfig() {
  hartConfig = hartConfigUi.readConfigForm();
  hartConfigUi.syncCommandModeUi(hartConfig);
  hartConfigUi.renderStandardCommandFields(hartConfig);

  if (state.deviceId === HART_DEVICE_ID) {
    const normalized = normalizeHartConfig(hartConfig);
    state.mode = getHartMode(normalized.activeCommand);
    const config = getModeConfig(state.mode, state.deviceId, customConfig, modbusConfig);
    state.setpoint = Math.min(config.max, Math.max(config.min, state.setpoint));
    resetHartRxBuffer();
  }

  updateDeviceUi();
  if (state.pollingActive && !pollingController.canPoll()) {
    state.pollingActive = false;
  }
  pollingController.updateActive();
}

function saveHartConfig() {
  hartConfig = hartConfigUi.readConfigForm();
  localStorage.setItem(HART_CONFIG_STORAGE_KEY, JSON.stringify(hartConfig));
  hartConfigUi.populateConfigForm(hartConfig);
  updateDeviceUi();
  pollingController.updateActive();
  appendLog("info", i18n("log.device"), `${i18n("device.hart")}${i18n("common.configSavedShort")}`);
}

function resetHartConfig() {
  hartConfig = resetHartDeviceState(DEFAULT_HART_CONFIG);
  localStorage.setItem(HART_CONFIG_STORAGE_KEY, JSON.stringify(hartConfig));
  hartConfigUi.populateConfigForm(hartConfig);
  resetHartRxBuffer();

  if (state.deviceId === HART_DEVICE_ID) {
    state.mode = getHartMode(normalizeHartConfig(hartConfig).activeCommand);
    state.setpoint = getModeConfig(state.mode, state.deviceId, customConfig, modbusConfig).presets.mid;
  }

  updateDeviceUi();
  pollingController.updateActive();
  appendLog("info", i18n("log.device"), `${i18n("device.hart")}${i18n("common.configResetShort")}`);
}

function loadHartConfig() {
  try {
    const saved = localStorage.getItem(HART_CONFIG_STORAGE_KEY);
    return normalizeHartConfig(saved ? JSON.parse(saved) : DEFAULT_HART_CONFIG);
  } catch {
    return normalizeHartConfig(DEFAULT_HART_CONFIG);
  }
}

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function updateHartDeviceInfo() {
  if (!elements.hartDeviceInfo) {
    return;
  }

  elements.hartDeviceInfo.textContent = `${i18n("hart.devicePrefix")}${formatHartDeviceSummary(normalizeHartConfig(hartConfig).device)}`;
  hartSessionController.updateLinkInfo();
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
  if (state.pollingActive && !pollingController.canPoll()) {
    state.pollingActive = false;
  }
  pollingController.updateActive();
}

function saveAomasterConfig() {
  aomasterConfig = readAomasterConfigForm();
  localStorage.setItem(AOMASTER_CONFIG_STORAGE_KEY, JSON.stringify(aomasterConfig));
  populateAomasterConfigForm(aomasterConfig);
  updateDeviceUi();
  pollingController.updateActive();
  appendLog("info", i18n("log.device"), `${i18n("device.aomaster")}${i18n("common.configSavedShort")}`);
}

function resetAomasterConfig() {
  aomasterConfig = normalizeAomasterConfig(DEFAULT_AOMASTER_CONFIG);
  localStorage.setItem(AOMASTER_CONFIG_STORAGE_KEY, JSON.stringify(aomasterConfig));
  populateAomasterConfigForm(aomasterConfig);
  resetAomasterRxBuffer();
  updateDeviceUi();
  pollingController.updateActive();
  appendLog("info", i18n("log.device"), `${i18n("device.aomaster")}${i18n("common.configResetShort")}`);
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
  aomasterWaveformUi.populateForm();
  aomasterWaveformUi.renderStepSequence();
  aomasterActualMode = null;
  actualChart?.clear();
  if (elements.actualChartValue) {
    elements.actualChartValue.textContent = i18n("chart.noData");
  }
  updateSetpointUi();
  aomasterWaveformUi.syncChartRanges();
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
  appendLog("info", i18n("log.chart"), i18n("chart.scaleConfigSaved"));
}

function resetChartConfig() {
  chartConfig = normalizeChartConfig(DEFAULT_CHART_CONFIG);
  localStorage.setItem(CHART_CONFIG_STORAGE_KEY, JSON.stringify(chartConfig));
  populateChartConfigForm(chartConfig);
  applyChartPointCountConfig();
  appendLog("info", i18n("log.chart"), i18n("chart.scaleConfigReset"));
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
  elements.exportChartCsv = document.querySelector("#exportChartCsv");
  elements.loadChartCsv = document.querySelector("#loadChartCsv");
  elements.loadChartCsvInput = document.querySelector("#loadChartCsvInput");
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
  on(elements.exportChartCsv, "click", chartCsvController.exportCsv);
  on(elements.loadChartCsv, "click", chartCsvController.openPicker);
  on(elements.loadChartCsvInput, "change", chartCsvController.loadFile);
  chartConfigEventsBound = true;
}

function getChartConfigControls() {
  return [elements.chartPointCount, elements.visibleChartPointCount].filter(Boolean);
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

function clearAllCharts() {
  chart?.clear();
  hartChart?.clear();
  jsonMultiChart?.clear();
  aomasterWaveformUi.clearCharts();
  elements.chartValue.textContent = i18n("chart.noData");
  hartMonitorController.updateVariableCards();
  requestChartResize();
}

function decimalPlaces(step) {
  const text = String(step);
  return Math.min(6, Math.max(0, text.includes(".") ? text.split(".")[1].length : 0));
}

function renderFooterCopyright() {
  const year = new Date().getFullYear();
  elements.footerCopyright.textContent = `© ${year} `;

  const siteLink = document.createElement("a");
  siteLink.href = MODUSIGNAL_APP.siteUrl;
  siteLink.textContent = new URL(MODUSIGNAL_APP.siteUrl).host;
  siteLink.rel = "home";
  elements.footerCopyright.append(siteLink);
}

function resetRxLogCoalesce() {
  logController.resetRxCoalesce();
}

function finalizeRxLogCoalesce() {
  logController.finalizeRxCoalesce();
}

function queueRxLogDisplay(bytes, text, useHexDisplay) {
  logController.queueRx(bytes, text, useHexDisplay);
}

function appendLog(kind, direction, payload, options = {}) {
  return logController.append(kind, direction, payload, options);
}
