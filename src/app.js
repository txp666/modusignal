import i18n, { initI18n } from "./i18n.js";
import { loadLatestHartLinkRelease } from "../hartlink-studio/release.js";
import { mountChartCurveSections } from "./debug-curve-section.js";
import { loadAppPages } from "./page-loader.js";
import { createLogController } from "./ui/log-controller.js";
import { collectAppElements } from "./ui/app-elements.js";
import { createSidebarController } from "./ui/sidebar-controller.js";
import { createDeviceNavigationUi } from "./ui/device-navigation-ui.js";
import { createChartCsvController } from "./monitoring/chart-csv-controller.js";
import { createChartController } from "./monitoring/chart-controller.js";
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
import { createAomasterController } from "./features/aomaster/aomaster-controller.js";
import { createTransportController } from "./core/transport-controller.js";
import { createPollingController } from "./core/polling-controller.js";
import { createSessionEventController } from "./core/session-event-controller.js";
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
  resetAomasterRxBuffer,
} from "./devices/aomaster.js";
import { resetCustomRxBuffer } from "./devices/custom-device.js";
import {
  describeModbusSummary,
  getModbusMode,
  resetModbusRxBuffer,
} from "./devices/modbus-device.js";
import {
  createHartPollCommand,
  DEFAULT_HART_CONFIG,
  describeHartSummary,
  getHartMode,
  HART_DEVICE_ID,
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
import { describeMqttSummary } from "./devices/mqtt-device.js";
import { describeWebSocketSummary } from "./devices/websocket-device.js";
import {
  readDebugCurveConfigForm,
} from "./debug-curve-form.js";
import { isReadFunctionCode } from "./modbus/modbus.js";
import {
  buildManualPayload,
  bytesToHex,
  createDeviceSetOutputCommand,
  CUSTOM_DEVICE_ID,
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

const CUSTOM_CONFIG_STORAGE_KEY = "modusignal.customDevice.v1";
const HART_CONFIG_STORAGE_KEY = "modusignal.hartDevice.v1";
const WEBSOCKET_CONFIG_STORAGE_KEY = "modusignal.websocketDevice.v1";
const MQTT_CONFIG_STORAGE_KEY = "modusignal.mqttDevice.v1";
const AOMASTER_INTERFRAME_DELAY_MS = 20;

/** @type {Record<string, HTMLElement | HTMLElement[] | null>} */
const elements = {};

let customConfig = loadCustomConfigSnapshot(CUSTOM_CONFIG_STORAGE_KEY);
let modbusConfig = loadModbusConfigSnapshot();
let hartConfig = loadHartConfig();
let websocketConfig = loadMessageConfig(
  WEBSOCKET_CONFIG_STORAGE_KEY,
  DEFAULT_WEBSOCKET_CONFIG,
  normalizeWebSocketConfig,
);
let mqttConfig = loadMessageConfig(MQTT_CONFIG_STORAGE_KEY, DEFAULT_MQTT_CONFIG, normalizeMqttConfig);
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
let chartController = null;
let websocketConfigUi = null;
let mqttConfigUi = null;
let aomasterWaveformUi = null;
let aomasterController = null;
let transportController = null;
let pollingController = null;
let debugCurveController = null;
let customConfigUi = null;
let messageDebugController = null;
let sessionEventController = null;

const state = {
  pageId: "home",
  deviceId: DEFAULT_DEVICE_ID,
  transportId: DEFAULT_TRANSPORT_ID,
  mode: "current",
  setpoint: 12,
  waveform: "constant",
  aomasterValueDisplayMode: "value",
  waveLow: 4,
  waveHigh: 20,
  wavePeriodMs: 1000,
  waveDuty: 50,
  stepSequence: [4, 8, 12, 16, 20],
  stepDwellMs: 500,
  stepLoops: 1,
  pollingActive: false,
};

let latestHartLinkRelease = null;

boot();

async function boot() {
  initI18n();
  try {
    await loadAppPages();
    i18n.apply(document.body);
    mountChartCurveSections();
    Object.assign(elements, collectAppElements());
    void refreshHartLinkReleaseSummary();
    initializeChartController();
    initializeAomasterController();
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
  aomasterController.populateConfigForm();
  chartController.populateConfigForm();
  aomasterController.syncDisplayControls();
  chartController.updatePointLabels();
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
      requestChartResize: chartController.requestResize,
      updateSetpoint,
      sendDeviceCommand,
      sendManualCommand,
      copyRequestTemplate,
      sendWebSocketQuickMessage: messageDebugController.sendWebsocketQuickMessage,
      sendMqttQuickMessage: messageDebugController.sendMqttQuickMessage,
      loadMessageIntoManualSender: messageDebugController.loadIntoManualSender,
      resetRxLogCoalesce,
      appendLog,
      clearAllCharts: chartController.clearAll,
      selectDevice,
      navigateToPage,
      updateDeviceUi,
      updateSetpointUi,
      setAomasterValueDisplayMode: aomasterController.setDisplayMode,
      testDeviceParser,
      updateModbusDraftConfig,
      saveModbusConfig,
      resetModbusConfig,
      updateHartDraftConfig,
      saveHartConfig,
      resetHartConfig,
      readWebsocketHeartbeatPreset: messageDebugController.readWebsocketHeartbeatPreset,
      readMqttHeartbeatPreset: messageDebugController.readMqttHeartbeatPreset,
      getAomasterConfigControls: aomasterController.getConfigControls,
      updateAomasterDraftConfig: aomasterController.updateDraftConfig,
      saveAomasterConfig: aomasterController.saveConfig,
      resetAomasterConfig: aomasterController.resetConfig,
      bindChartConfigEvents: chartController.bindConfigEvents,
    },
  });
  await transportController.setTransport(state.transportId);
  deviceNavigationUi.updatePage();
  safeUpdateDeviceUi();
  void chartController.init();
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

function renderHartLinkReleaseSummary() {
  if (!latestHartLinkRelease) return;

  const language = i18n.getLanguage();
  const version = latestHartLinkRelease.version;
  const kicker = document.querySelector("[data-hartlink-release-kicker]");
  const download = document.querySelector("[data-hartlink-release-download]");
  if (kicker) {
    kicker.textContent = language === "en" ? `Desktop software · v${version}` : `桌面软件 · v${version}`;
  }
  if (download) {
    download.textContent = language === "en" ? `Download ${version}` : `下载 ${version}`;
  }
}

async function refreshHartLinkReleaseSummary() {
  try {
    latestHartLinkRelease = await loadLatestHartLinkRelease();
    renderHartLinkReleaseSummary();
  } catch (error) {
    console.warn("Unable to refresh the HARTLink Studio release summary", error);
  }
}

function refreshAllDynamicUi() {
  deviceNavigationUi.renderLibrary();
  deviceNavigationUi.renderHomeCards();
  updateDeviceUi();
  transportController.updateConnectionUi(Boolean(session?.connected));
  pollingController.updateUi();
  updateSetpointUi();
  chartController.syncCurvePanelUi();
  deviceNavigationUi.updatePage();
  transportController.populateSelect();
  transportController.renderFields();
  chartController.updatePointLabels();
  customConfigUi.populate(customConfig);
  modbusConfigUi.populateConfigForm(modbusConfig);
  hartWorkspaceController.refreshLocalizedOptions();
  hartConfigUi.populateConfigForm(hartConfig);
  websocketConfigUi.populate(websocketConfig);
  mqttConfigUi.populate(mqttConfig);
  aomasterController.populateConfigForm();
  aomasterController.syncDisplayControls();
  renderHartLinkReleaseSummary();
}

function initializeChartController() {
  chartController = createChartController({
    elements,
    state,
    getConfigs: () => ({ customConfig, modbusConfig, hartConfig, websocketConfig, mqttConfig }),
    isDevicePageActive: () => deviceNavigationUi?.isDevicePageActive() ?? false,
    getHartSeriesDefs: () => hartMonitorController?.buildSeriesDefs() ?? [],
    clearAomasterCharts: () => aomasterWaveformUi?.clearCharts(),
    updateHartVariableCards: (variables) => hartMonitorController?.updateVariableCards(variables),
    getCsvController: () => chartCsvController,
    safeUpdateDeviceUi,
    appendLog,
  });
}

function initializeAomasterController() {
  aomasterController = createAomasterController({
    elements,
    state,
    getCustomConfig: () => customConfig,
    getModbusConfig: () => modbusConfig,
    getSession: () => session,
    getPollingController: () => pollingController,
    getWaveformUi: () => aomasterWaveformUi,
    getChartController: () => chartController,
    updateDeviceUi,
    updateSetpointUi,
    appendLog,
  });
}

function initializeInfrastructureControllers() {
  debugCurveController = createDebugCurveController({ elements });
  logController = createLogController({
    getLogElement: () => elements.serialLog,
    bytesToHex,
  });
  sessionEventController = createSessionEventController({
    elements,
    state,
    getConfigs: () => ({
      customConfig,
      modbusConfig,
      hartConfig,
      websocketConfig,
      mqttConfig,
      aomasterConfig: aomasterController.getConfig(),
    }),
    setHartConfig: (config) => {
      hartConfig = config;
    },
    getControllers: () => ({
      aomasterController,
      chartController,
      hartConfigUi,
      hartMonitorController,
      hartSessionController,
      hartWorkspaceController,
      messageDebugController,
      pollingController,
      transportController,
    }),
    updateHartDeviceInfo,
    updateDeviceUi,
    queueRxLogDisplay,
    finalizeRxLogCoalesce,
    appendLog,
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
    syncChartPanel: chartController.syncCurvePanelUi,
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
    getConfigs: () => ({
      customConfig,
      modbusConfig,
      hartConfig,
      websocketConfig,
      mqttConfig,
      aomasterConfig: aomasterController.getConfig(),
    }),
    sendDeviceCommand,
    sendHartPoll: sendHartPollCommand,
    sendAomasterPoll: aomasterController.sendReadCommand,
    appendLog,
  });
  const sharedMessageConfigOptions = {
    elements,
    state,
    syncCurveRows: debugCurveController.syncRows,
    syncChartPanel: chartController.syncCurvePanelUi,
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
    getSetpointChart: () => chartController.getCharts().setpointChart,
    getActualChart: () => chartController.getCharts().actualChart,
    getActualMode: aomasterController.getActualMode,
    resetActualMode: aomasterController.resetActualMode,
    isPercentMode: aomasterController.isPercentMode,
    getDisplayStep: aomasterController.getDisplayStep,
    formatDisplayNumber: aomasterController.formatDisplayNumber,
    readDisplayNumber: aomasterController.readDisplayNumber,
    getDisplayNumber: aomasterController.getDisplayNumber,
    getDisplayUnit: aomasterController.getDisplayUnit,
    formatDisplayValue: aomasterController.formatDisplayValue,
    formatDisplaySequence: aomasterController.formatDisplaySequence,
    updateSetpointUi,
    applyChartPointCountConfig: chartController.applyPointCountConfig,
    getChartPointCount: chartController.getPointCount,
    requestChartResize: chartController.requestResize,
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
    bindSessionEvents: sessionEventController.bind,
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
    ensureChart: chartController.ensureHartChart,
    getChart: () => chartController.getCharts().hartChart,
    updateWorkspaceFromTelemetry: (telemetry) => hartWorkspaceController.updateFromTelemetry(telemetry),
    syncChartPanel: chartController.syncCurvePanelUi,
  });
}

function initializeChartControllers() {
  chartCsvController = createChartCsvController({
    elements,
    state,
    getConfigs: () => ({ customConfig, modbusConfig, websocketConfig, mqttConfig }),
    getCharts: chartController.getCharts,
    getChartPointSettings: chartController.getPointSettings,
    getAomasterDisplayUnit: aomasterController.getDisplayUnit,
    getAomasterActualMode: aomasterController.getActualMode,
    getHartSeriesDefs: () => hartMonitorController.buildSeriesDefs(),
    shouldUseJsonMultiChart: chartController.shouldUseJsonMultiChart,
    getJsonMultiChartMeta: chartController.getJsonMultiChartMeta,
    ensureHartChart: chartController.ensureHartChart,
    ensureJsonMultiChart: chartController.ensureJsonMultiChart,
    ensureSingleChart: chartController.ensureSingleChart,
    getChartConfig: chartController.getConfig,
    setChartConfig: chartController.setConfig,
    populateChartConfigForm: chartController.populateConfigForm,
    applyChartPointCountConfig: chartController.applyPointCountConfig,
    updateHartVariableCards: (variables) => hartMonitorController.updateVariableCards(variables),
    requestChartResize: chartController.requestResize,
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

  chartController.clearAll();
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
  chartController.bindConfigEvents();
  chartController.updatePointLabels();
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
    chartController.syncCurvePanelUi();
    if (isHart) {
      hartConfigUi.syncCommandModeUi();
      chartController.ensureHartChart();
      hartMonitorController.syncSeriesControls();
      hartMonitorController.updateVariableCards();
    } else if (chartController.shouldUseJsonMultiChart()) {
      chartController.ensureJsonMultiChart();
    } else {
      chartController.ensureSingleChart();
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
      summary.textContent = describeAomasterSummary(aomasterController.getConfig());
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
    chartController.requestResize();
    pollingController.updateUi();
    return;
  }

  if (isAomaster) {
    aomasterController.syncDisplayControls();
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

  const { chart } = chartController.getCharts();
  if (!isAomaster && !isHart && !isMessageDebug && chart) {
    const modeConfig = getModeConfig(state.mode, state.deviceId, customConfig, modbusConfig);
    chart.setMeta({ title: i18n("chart.realTimeChart"), unit: modeConfig.unit });
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

  chartController.requestResize();
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

function updateSetpoint(value) {
  const config = getModeConfig(state.mode, state.deviceId, customConfig, modbusConfig);
  const sourceValue = aomasterController.isPercentMode() ? aomasterController.getValueFromPercent(value) : value;
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
  const isPercent = aomasterController.isPercentMode();
  const formatted = isPercent
    ? aomasterController.formatDisplayNumber(state.setpoint)
    : state.setpoint.toFixed(decimalPlaces(config.step));
  const controlMin = isPercent ? 0 : config.min;
  const controlMax = isPercent ? 100 : config.max;
  const controlStep = isPercent ? aomasterController.getDisplayStep() : config.step;
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
    aomasterController.getConfig(),
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
    aomasterController.getConfig(),
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
      aomasterController.getConfig(),
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
    aomasterController.getConfig(),
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
  chartController.syncCurvePanelUi();

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
