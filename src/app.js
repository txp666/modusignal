import i18n, { initI18n } from "./i18n.js";
import { assetUrl } from "./asset-url.js";
import { mountChartCurveSections } from "./debug-curve-section.js";
import { loadAppPages } from "./page-loader.js";
import {
  createTransportSession,
  DEFAULT_TRANSPORT_ID,
  getTransportDescriptor,
  listTransports,
} from "./transports/registry.js";
import { describeMqttUrlWarning, MQTT_CONNECT_DEFAULTS, MQTT_TRANSPORT_ID } from "./transports/mqtt.js";
import { describeWebSocketUrlWarning, WEBSOCKET_CONNECT_DEFAULTS, WEBSOCKET_TRANSPORT_ID } from "./transports/websocket.js";
import {
  AOMASTER_DEVICE_ID,
  AOMASTER_MAX_STEP_SEQUENCE,
  AOMASTER_TRANSPORT_DEFAULTS,
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
  CUSTOM_TRANSPORT_DEFAULTS,
  listCustomChartSeries,
  resetCustomRxBuffer,
} from "./devices/custom-device.js";
import {
  describeModbusSummary,
  getModbusMode,
  listModbusDeviceChartSeries,
  MODBUS_WEBSOCKET_TRANSPORT_DEFAULTS,
  MODBUS_TRANSPORT_DEFAULTS,
  resetModbusRxBuffer,
} from "./devices/modbus-device.js";
import {
  createHartPollCommand,
  createHartSearchCommand,
  DEFAULT_HART_CONFIG,
  describeHartSummary,
  getHartMode,
  getHartStandardRequestFields,
  HART_DEVICE_ID,
  HART_TRANSPORT_DEFAULTS,
  HART_UNIVERSAL_COMMANDS,
  HART_VARIABLE_CARDS,
  mergeHartDiscovery,
  normalizeHartConfig,
  resetHartDeviceState,
  resetHartRxBuffer,
} from "./devices/hart-device.js";
import {
  formatHartDeviceSummary,
  getHartCommandLabel,
} from "./hart/hart.js";
import {
  HARTLINK_VERSION_QUERY,
  isHartLinkVersionProbeChunk,
  parseHartLinkVersionResponse,
} from "./hart/hartlink.js";
import {
  buildMqttMessage,
  describeMqttSummary,
  getMqttPublishOptions,
  listMqttChartSeries,
  MQTT_DEVICE_TRANSPORT_DEFAULTS,
  MQTT_QUICK_MESSAGES,
  resetMqttRxBuffer,
} from "./devices/mqtt-device.js";
import {
  buildWebSocketMessage,
  describeWebSocketSummary,
  listWebSocketChartSeries,
  resetWebSocketRxBuffer,
  WEBSOCKET_QUICK_MESSAGES,
  WEBSOCKET_TRANSPORT_DEFAULTS,
} from "./devices/websocket-device.js";
import {
  initChartCurvePanel,
  requestChartCurvePanelResize,
  updateChartCurvePanel,
} from "./chart-curve-panel.js";
import { removeMultiCurveSlot } from "./devices/binary-curve-config.js";
import { describeJsonCurveSummary, JSON_CURVE_SLOTS } from "./devices/json-curve-config.js";
import {
  listBinaryCurveControlElements,
  populateBinaryCurveFormValues,
  listDebugCurveControlElements,
  populateDebugCurveConfigForm,
  populateFramingFormValues,
  readBinaryCurveFormValues,
  readDebugCurveConfigForm,
  readFramingFormValues,
  registerDebugCurveFormElements,
  syncDebugCurveModeFields,
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
  getDeviceDefaultTransportId,
  isStandaloneDevice,
  getModeConfig,
  listDeviceLibrary,
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
const MODBUS_CONFIG_STORAGE_KEY = "modusignal.modbusDevice.v1";
const HART_CONFIG_STORAGE_KEY = "modusignal.hartDevice.v1";
const DEVICE_TRANSPORT_DEFAULTS = {
  [AOMASTER_DEVICE_ID]: {
    serial: AOMASTER_TRANSPORT_DEFAULTS,
    websocket: WEBSOCKET_CONNECT_DEFAULTS,
    mqtt: MQTT_CONNECT_DEFAULTS,
  },
  [CUSTOM_DEVICE_ID]: {
    serial: CUSTOM_TRANSPORT_DEFAULTS,
    websocket: WEBSOCKET_CONNECT_DEFAULTS,
    mqtt: MQTT_CONNECT_DEFAULTS,
  },
  [MODBUS_DEVICE_ID]: {
    serial: MODBUS_TRANSPORT_DEFAULTS,
    websocket: MODBUS_WEBSOCKET_TRANSPORT_DEFAULTS,
    mqtt: MQTT_CONNECT_DEFAULTS,
  },
  [HART_DEVICE_ID]: {
    serial: HART_TRANSPORT_DEFAULTS,
    websocket: WEBSOCKET_CONNECT_DEFAULTS,
    mqtt: MQTT_CONNECT_DEFAULTS,
  },
  [WEBSOCKET_DEVICE_ID]: {
    serial: WEBSOCKET_TRANSPORT_DEFAULTS,
    websocket: WEBSOCKET_TRANSPORT_DEFAULTS,
    mqtt: MQTT_CONNECT_DEFAULTS,
  },
  [MQTT_DEVICE_ID]: {
    serial: MQTT_CONNECT_DEFAULTS,
    websocket: WEBSOCKET_CONNECT_DEFAULTS,
    mqtt: MQTT_DEVICE_TRANSPORT_DEFAULTS,
  },
};

const WEBSOCKET_CONFIG_STORAGE_KEY = "modusignal.websocketDevice.v1";
const MQTT_CONFIG_STORAGE_KEY = "modusignal.mqttDevice.v1";
const AOMASTER_CONFIG_STORAGE_KEY = "modusignal.aomasterDevice.v1";
const CHART_CONFIG_STORAGE_KEY = "modusignal.chart.v1";
const AOMASTER_VALUE_DISPLAY_STORAGE_KEY = "modusignal.aomasterValueDisplayMode.v1";
const SIDEBAR_PANELS_STORAGE_KEY = "modusignal.sidebarPanels.v1";
const MOBILE_LAYOUT_QUERY = "(max-width: 1050px)";
const AOMASTER_INTERFRAME_DELAY_MS = 20;
const HARTLINK_VERSION_DETECT_DELAY_MS = 80;
const HARTLINK_VERSION_DETECT_TIMEOUT_MS = 1200;
const HARTLINK_VERSION_RESPONSE_BUFFER_LIMIT = 512;

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
    deviceLibrarySearch: document.querySelector("#deviceLibrarySearch"),
    pages: [...document.querySelectorAll("[data-page-id]")],
    customDeviceNavName: document.querySelector("#customDeviceNavName"),
    githubLink: document.querySelector("#githubLink"),
    openAomasterProductDialog: document.querySelector("#openAomasterProductDialog"),
    aomasterProductDialog: document.querySelector("#aomasterProductDialog"),
    closeAomasterProductDialog: document.querySelector("#closeAomasterProductDialog"),
    openHartlinkProductDialog: document.querySelector("#openHartlinkProductDialog"),
    hartlinkProductDialog: document.querySelector("#hartlinkProductDialog"),
    closeHartlinkProductDialog: document.querySelector("#closeHartlinkProductDialog"),
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
    saveCustomConfig: document.querySelector("#saveCustomConfig"),
    resetCustomConfig: document.querySelector("#resetCustomConfig"),
    testCustomParser: document.querySelector("#testCustomParser"),
    modbusSlaveId: document.querySelector("#modbusSlaveId"),
    modbusFunctionCode: document.querySelector("#modbusFunctionCode"),
    modbusAddress: document.querySelector("#modbusAddress"),
    modbusQuantity: document.querySelector("#modbusQuantity"),
    modbusPollIntervalMs: document.querySelector("#modbusPollIntervalMs"),
    saveModbusConfig: document.querySelector("#saveModbusConfig"),
    resetModbusConfig: document.querySelector("#resetModbusConfig"),
    testModbusParser: document.querySelector("#testModbusParser"),
    hartPollAddress: document.querySelector("#hartPollAddress"),
    hartMasterType: document.querySelector("#hartMasterType"),
    hartCommand: document.querySelector("#hartCommand"),
    hartCustomCommandData: document.querySelector("#hartCustomCommandData"),
    hartCustomCommandDataField: document.querySelector("#hartCustomCommandDataField"),
    hartStandardCommandSection: document.querySelector("#hartStandardCommandSection"),
    hartStandardCommandFields: document.querySelector("#hartStandardCommandFields"),
    hartPreambleLength: document.querySelector("#hartPreambleLength"),
    hartScale: document.querySelector("#hartScale"),
    hartOffset: document.querySelector("#hartOffset"),
    hartFieldName: document.querySelector("#hartFieldName"),
    hartUnit: document.querySelector("#hartUnit"),
    hartPollIntervalMs: document.querySelector("#hartPollIntervalMs"),
    hartPollMode: document.querySelector("#hartPollMode"),
    hartCommandMode: document.querySelector("#hartCommandMode"),
    hartCustomCommand: document.querySelector("#hartCustomCommand"),
    hartPresetCommandField: document.querySelector("#hartPresetCommandField"),
    hartCustomCommandField: document.querySelector("#hartCustomCommandField"),
    hartFrameChecksum: document.querySelector("#hartFrameChecksum"),
    hartDeviceInfo: document.querySelector("#hartDeviceInfo"),
    hartlinkVersionInfo: document.querySelector("#hartlinkVersionInfo"),
    hartSearchDevice: document.querySelector("#hartSearchDevice"),
    hartScanAddresses: document.querySelector("#hartScanAddresses"),
    hartCommandResponse: document.querySelector("#hartCommandResponse"),
    hartWorkspaceTabs: [...document.querySelectorAll("[data-hart-workspace-tab]")],
    hartWorkspacePanels: [...document.querySelectorAll("[data-hart-workspace-panel]")],
    hartWorkspaceActions: [...document.querySelectorAll("[data-hart-workspace-action]")],
    hartSettingsUnit: document.querySelector("#hartSettingsUnit"),
    hartSettingsDamping: document.querySelector("#hartSettingsDamping"),
    hartSettingsUpperRange: document.querySelector("#hartSettingsUpperRange"),
    hartSettingsLowerRange: document.querySelector("#hartSettingsLowerRange"),
    hartSettingsTransferFunction: document.querySelector("#hartSettingsTransferFunction"),
    hartSettingsMeasurementStatus: document.querySelector("#hartSettingsMeasurementStatus"),
    hartSettingsMessage: document.querySelector("#hartSettingsMessage"),
    hartSettingsTag: document.querySelector("#hartSettingsTag"),
    hartSettingsDescriptor: document.querySelector("#hartSettingsDescriptor"),
    hartSettingsDate: document.querySelector("#hartSettingsDate"),
    hartSettingsAssembly: document.querySelector("#hartSettingsAssembly"),
    hartSettingsPollAddress: document.querySelector("#hartSettingsPollAddress"),
    hartSettingsLoopMode: document.querySelector("#hartSettingsLoopMode"),
    hartSettingsBurstCommand: document.querySelector("#hartSettingsBurstCommand"),
    hartSettingsBurstMessage: document.querySelector("#hartSettingsBurstMessage"),
    hartSettingsStatus: document.querySelector("#hartSettingsStatus"),
    hartCalibrationPresetCurrent: document.querySelector("#hartCalibrationPresetCurrent"),
    hartCalibrationCustomCurrent: document.querySelector("#hartCalibrationCustomCurrent"),
    hartCalibrationLowCurrent: document.querySelector("#hartCalibrationLowCurrent"),
    hartCalibrationHighCurrent: document.querySelector("#hartCalibrationHighCurrent"),
    hartCalibrationGuidelines: document.querySelector("#hartCalibrationGuidelines"),
    hartCalibrationLowValue: document.querySelector("#hartCalibrationLowValue"),
    hartCalibrationHighValue: document.querySelector("#hartCalibrationHighValue"),
    hartCalibrationLowButton: document.querySelector("#hartCalibrationLowButton"),
    hartCalibrationHighButton: document.querySelector("#hartCalibrationHighButton"),
    hartCalibrationStatus: document.querySelector("#hartCalibrationStatus"),
    hartChartSeriesBlock: document.querySelector("#hartChartSeriesBlock"),
    hartChartSeriesInputs: [...document.querySelectorAll("[data-hart-series]")],
    saveHartConfig: document.querySelector("#saveHartConfig"),
    resetHartConfig: document.querySelector("#resetHartConfig"),
    websocketPollIntervalMs: document.querySelector("#websocketPollIntervalMs"),
    websocketHeartbeatFormat: document.querySelector("#websocketHeartbeatFormat"),
    websocketHeartbeatMessage: document.querySelector("#websocketHeartbeatMessage"),
    websocketParserMode: document.querySelector("#websocketParserMode"),
    websocketCurve1Enabled: document.querySelector("#websocketCurve1Enabled"),
    websocketParserFieldPath: document.querySelector("#websocketParserFieldPath"),
    websocketCurve2Enabled: document.querySelector("#websocketCurve2Enabled"),
    websocketCurve2FieldName: document.querySelector("#websocketCurve2FieldName"),
    websocketCurve2FieldPath: document.querySelector("#websocketCurve2FieldPath"),
    websocketCurve2Unit: document.querySelector("#websocketCurve2Unit"),
    websocketCurve3Enabled: document.querySelector("#websocketCurve3Enabled"),
    websocketCurve3FieldName: document.querySelector("#websocketCurve3FieldName"),
    websocketCurve3FieldPath: document.querySelector("#websocketCurve3FieldPath"),
    websocketCurve3Unit: document.querySelector("#websocketCurve3Unit"),
    websocketCurve4Enabled: document.querySelector("#websocketCurve4Enabled"),
    websocketCurve4FieldName: document.querySelector("#websocketCurve4FieldName"),
    websocketCurve4FieldPath: document.querySelector("#websocketCurve4FieldPath"),
    websocketCurve4Unit: document.querySelector("#websocketCurve4Unit"),
    websocketAddCurve: document.querySelector("#websocketAddCurve"),
    websocketFieldName: document.querySelector("#websocketFieldName"),
    websocketUnit: document.querySelector("#websocketUnit"),
    wsQuickSendGrid: document.querySelector("#wsQuickSendGrid"),
    websocketRxCount: document.querySelector("#websocketRxCount"),
    websocketTxCount: document.querySelector("#websocketTxCount"),
    websocketEndpoint: document.querySelector("#websocketEndpoint"),
    websocketHeartbeatPreview: document.querySelector("#websocketHeartbeatPreview"),
    loadWebsocketHeartbeat: document.querySelector("#loadWebsocketHeartbeat"),
    websocketParserSample: document.querySelector("#websocketParserSample"),
    websocketParserPreview: document.querySelector("#websocketParserPreview"),
    testWebsocketParser: document.querySelector("#testWebsocketParser"),
    saveWebsocketConfig: document.querySelector("#saveWebsocketConfig"),
    resetWebsocketConfig: document.querySelector("#resetWebsocketConfig"),
    mqttPollIntervalMs: document.querySelector("#mqttPollIntervalMs"),
    mqttHeartbeatFormat: document.querySelector("#mqttHeartbeatFormat"),
    mqttHeartbeatMessage: document.querySelector("#mqttHeartbeatMessage"),
    mqttParserMode: document.querySelector("#mqttParserMode"),
    mqttCurve1Enabled: document.querySelector("#mqttCurve1Enabled"),
    mqttParserFieldPath: document.querySelector("#mqttParserFieldPath"),
    mqttCurve2Enabled: document.querySelector("#mqttCurve2Enabled"),
    mqttCurve2FieldName: document.querySelector("#mqttCurve2FieldName"),
    mqttCurve2FieldPath: document.querySelector("#mqttCurve2FieldPath"),
    mqttCurve2Unit: document.querySelector("#mqttCurve2Unit"),
    mqttCurve3Enabled: document.querySelector("#mqttCurve3Enabled"),
    mqttCurve3FieldName: document.querySelector("#mqttCurve3FieldName"),
    mqttCurve3FieldPath: document.querySelector("#mqttCurve3FieldPath"),
    mqttCurve3Unit: document.querySelector("#mqttCurve3Unit"),
    mqttCurve4Enabled: document.querySelector("#mqttCurve4Enabled"),
    mqttCurve4FieldName: document.querySelector("#mqttCurve4FieldName"),
    mqttCurve4FieldPath: document.querySelector("#mqttCurve4FieldPath"),
    mqttCurve4Unit: document.querySelector("#mqttCurve4Unit"),
    mqttAddCurve: document.querySelector("#mqttAddCurve"),
    mqttFieldName: document.querySelector("#mqttFieldName"),
    mqttUnit: document.querySelector("#mqttUnit"),
    mqttPublishTopic: document.querySelector("#mqttPublishTopic"),
    mqttPublishQos: document.querySelector("#mqttPublishQos"),
    mqttPublishRetain: document.querySelector("#mqttPublishRetain"),
    mqttQuickSendGrid: document.querySelector("#mqttQuickSendGrid"),
    mqttRxCount: document.querySelector("#mqttRxCount"),
    mqttTxCount: document.querySelector("#mqttTxCount"),
    mqttSubscribeTopic: document.querySelector("#mqttSubscribeTopic"),
    mqttEffectivePublishTopic: document.querySelector("#mqttEffectivePublishTopic"),
    mqttPublishMode: document.querySelector("#mqttPublishMode"),
    mqttPublishPreview: document.querySelector("#mqttPublishPreview"),
    mqttHeartbeatPreview: document.querySelector("#mqttHeartbeatPreview"),
    loadMqttHeartbeat: document.querySelector("#loadMqttHeartbeat"),
    mqttParserSample: document.querySelector("#mqttParserSample"),
    mqttParserPreview: document.querySelector("#mqttParserPreview"),
    testMqttParser: document.querySelector("#testMqttParser"),
    saveMqttConfig: document.querySelector("#saveMqttConfig"),
    resetMqttConfig: document.querySelector("#resetMqttConfig"),
    telemetryChart: document.querySelector("#telemetryChart"),
    chartValue: document.querySelector("#chartValue"),
    chartCurveConfigBlock: document.querySelector("#chartCurveConfigBlock"),
    chartCurveConfigToggle: document.querySelector("#chartCurveConfigToggle"),
    chartCurveConfigBody: document.querySelector("#chartCurveConfigBody"),
    chartCurveConfigSummary: document.querySelector("#chartCurveConfigSummary"),
    chartCurveHelpButton: document.querySelector("#chartCurveHelpButton"),
    chartCurveHelpDialog: document.querySelector("#chartCurveHelpDialog"),
    chartCurveHelpTitle: document.querySelector("#chartCurveHelpTitle"),
    chartCurveHelpContent: document.querySelector("#chartCurveHelpContent"),
    chartCurveHelpClose: document.querySelector("#chartCurveHelpClose"),
    chartCurveAomasterSection: document.querySelector("#chartCurveAomasterSection"),
    chartCurveModbusSection: document.querySelector("#chartCurveModbusSection"),
    chartCurveHartSection: document.querySelector("#chartCurveHartSection"),
    chartCurveCustomSection: document.querySelector("#chartCurveCustomSection"),
    chartCurveWebsocketSection: document.querySelector("#chartCurveWebsocketSection"),
    chartCurveMqttSection: document.querySelector("#chartCurveMqttSection"),
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
    exportChartCsv: document.querySelector("#exportChartCsv"),
    loadChartCsv: document.querySelector("#loadChartCsv"),
    loadChartCsvInput: document.querySelector("#loadChartCsvInput"),
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
    pollState: document.querySelector("#pollState"),
    togglePolling: document.querySelector("#togglePolling"),
  });
  registerDebugCurveFormElements("mqtt", elements);
  registerDebugCurveFormElements("websocket", elements);
  registerDebugCurveFormElements("custom", elements);
  registerDebugCurveFormElements("modbus", elements);
}

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
let customConfig = loadCustomConfig();
let modbusConfig = loadModbusConfig();
let hartConfig = loadHartConfig();
let websocketConfig = loadWebsocketConfig();
let mqttConfig = loadMqttConfig();
let aomasterConfig = loadAomasterConfig();
let chartConfig = loadChartConfig();
let session = null;
let modbusPollTimer = null;
let hartPollTimer = null;
let hartAddressScanActive = false;
let hartLinkVersionProbeTimer = null;
let hartLinkVersionResponseBuffer = "";
let hartLinkVersionState = { status: "idle", version: "", model: "" };
let hartWorkspace = "general";
let hartCalibrationState = {
  awaitingGuidelines: false,
  deviceVariable: null,
  guidelines: null,
};
let aomasterPollTimer = null;
let websocketPollTimer = null;
let mqttPollTimer = null;
let websocketMessageStats = { rx: 0, tx: 0 };
let mqttMessageStats = { rx: 0, tx: 0 };
let aomasterActualMode = null;
let deviceLibrarySearchQuery = "";
/** @type {Record<string, string | number>} */
let transportOptions = {};
const RX_LOG_IDLE_MS = 45;
const CHART_CSV_FORMAT = "modusignal-chart-csv/v1";
const HART_SCAN_ADDRESS_DELAY_MS = 650;
let rxLogFlushTimer = null;
/** @type {Uint8Array | string | null} */
let rxLogBuffer = null;
/** @type {HTMLElement | null} */
let rxLogPendingLine = null;

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
    cacheElements();
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
  populateCustomConfigForm(customConfig);
  populateModbusConfigForm(modbusConfig);
  populateHartConfigForm(hartConfig);
  populateWebsocketConfigForm(websocketConfig);
  populateMqttConfigForm(mqttConfig);
  populateAomasterConfigForm(aomasterConfig);
  populateChartConfigForm(chartConfig);
  syncAomasterValueDisplayControls();
  updateChartPointLabels();
  populateTransportSelect();
  renderDeviceLibrary();
  renderHomeDeviceCards();
  bindEvents();
  await setTransport(state.transportId);
  updatePageUi();
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
  renderDeviceLibrary();
  renderHomeDeviceCards();
  updateDeviceUi();
  updateConnectionUi(Boolean(session?.connected));
  updatePollingUi();
  updateSetpointUi();
  syncChartCurvePanelUi();
  updatePageUi();
  populateTransportSelect();
  renderTransportFields();
  updateChartPointLabels();
  populateCustomConfigForm(customConfig);
  populateModbusConfigForm(modbusConfig);
  populateHartConfigForm(hartConfig);
  populateWebsocketConfigForm(websocketConfig);
  populateMqttConfigForm(mqttConfig);
  populateAomasterConfigForm(aomasterConfig);
  syncAomasterValueDisplayControls();
}

function on(element, eventName, handler) {
  if (element) {
    element.addEventListener(eventName, handler);
  }
}

function openProductDialog(dialog) {
  if (!dialog) {
    return;
  }

  if (typeof dialog.showModal === "function") {
    dialog.showModal();
  } else {
    dialog.setAttribute("open", "");
  }
}

function closeProductDialog(dialog) {
  if (!dialog) {
    return;
  }

  if (typeof dialog.close === "function") {
    dialog.close();
  } else {
    dialog.removeAttribute("open");
  }
}

function bindProductDialog(openButton, dialog, closeButton) {
  on(openButton, "click", () => openProductDialog(dialog));
  on(closeButton, "click", () => closeProductDialog(dialog));
  on(dialog, "click", (event) => {
    if (event.target === dialog || event.target.closest("[data-page-target]")) {
      closeProductDialog(dialog);
    }
  });
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

function buildHartChartSeriesDefs(config = hartConfig) {
  const normalized = normalizeHartConfig(config);
  return HART_VARIABLE_CARDS.map((card) => ({
    key: card.key,
    name: card.label,
    unit: card.defaultUnit,
    color: card.color,
    areaColor: `${card.color}1f`,
    visible: normalized.chartSeries[card.key],
  }));
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
    series: buildHartChartSeriesDefs(),
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

function syncHartChartSeriesControls() {
  if (!elements.hartChartSeriesBlock) {
    return;
  }

  const normalized = normalizeHartConfig(hartConfig);
  elements.hartChartSeriesInputs.forEach((input) => {
    const key = input.dataset.hartSeries;
    if (key) {
      input.checked = Boolean(normalized.chartSeries[key]);
    }
  });
}

function updateHartVariableCards(variables = {}) {
  const cards = document.querySelectorAll("#hartVariableCards [data-hart-card]");
  cards.forEach((card) => {
    const key = card.dataset.hartCard;
    const readout = card.querySelector(".hart-value-readout");
    const unit = card.querySelector(".hart-value-unit");
    const entry = variables[key];

    if (!readout || !unit) {
      return;
    }

    if (!entry || !Number.isFinite(entry.value)) {
      readout.textContent = "--";
      unit.textContent = HART_VARIABLE_CARDS.find((item) => item.key === key)?.defaultUnit ?? "";
      return;
    }

    readout.textContent = entry.value.toFixed(3);
    unit.textContent = entry.unit || HART_VARIABLE_CARDS.find((item) => item.key === key)?.defaultUnit || "";
  });
}

function updateHartCommandResponse(telemetry) {
  if (!elements.hartCommandResponse) {
    return;
  }

  if (!telemetry?.commandSummary) {
    return;
  }

  const lines = telemetry.commandLines?.length ? telemetry.commandLines : [telemetry.commandSummary];
  elements.hartCommandResponse.textContent = lines.join("\n");
}

function handleHartTelemetry(telemetry) {
  updateHartCommandResponse(telemetry);
  updateHartWorkspaceFromTelemetry(telemetry);

  if (telemetry?.isMulti && telemetry.variables) {
    updateHartVariableCards(telemetry.variables);
    const sample = Object.fromEntries(
      Object.entries(telemetry.variables).map(([key, entry]) => [key, entry.value]),
    );
    ensureHartTelemetryChart();
    hartChart?.addSample(sample);

    const summary = Object.entries(telemetry.variables)
      .map(([key, entry]) => {
        const label = HART_VARIABLE_CARDS.find((item) => item.key === key)?.label ?? key;
        return `${label} ${entry.value.toFixed(3)}${entry.unit ? ` ${entry.unit}` : ""}`;
      })
      .join(" · ");
    if (elements.chartValue) {
      elements.chartValue.textContent = summary || i18n("chart.noData");
    }
    return;
  }

  if (telemetry && Number.isFinite(telemetry.value)) {
    ensureHartTelemetryChart();
    const sample = { pv: telemetry.value };
    hartChart?.addSample(sample);
    updateHartVariableCards({ pv: { value: telemetry.value, unit: telemetry.unit } });
    if (elements.chartValue) {
      elements.chartValue.textContent = `${telemetry.fieldName} ${telemetry.value.toFixed(3)}${telemetry.unit ? ` ${telemetry.unit}` : ""}`;
    }
  } else if (telemetry?.isCommandResult && telemetry.commandSummary) {
    if (elements.chartValue) {
      elements.chartValue.textContent = telemetry.commandSummary;
    }
  }
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

function handleHartChartSeriesChange(event) {
  const key = event.target.dataset.hartSeries;
  if (!key) {
    return;
  }

  hartConfig = normalizeHartConfig({
    ...hartConfig,
    chartSeries: {
      ...normalizeHartConfig(hartConfig).chartSeries,
      [key]: event.target.checked,
    },
  });
  hartChart?.setSeriesVisible(key, event.target.checked);
  syncChartCurvePanelUi();
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
    isDevicePage: isDevicePageActive(),
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

function getLastFiniteValue(values = []) {
  for (let index = values.length - 1; index >= 0; index -= 1) {
    const value = Number(values[index]);
    if (Number.isFinite(value)) {
      return value;
    }
  }

  return null;
}

function getFiniteSeriesExtent(seriesGroups = []) {
  let min = Infinity;
  let max = -Infinity;
  let hasValue = false;

  seriesGroups.forEach((series) => {
    (series ?? []).forEach((value) => {
      const number = Number(value);
      if (!Number.isFinite(number)) {
        return;
      }

      hasValue = true;
      if (number < min) {
        min = number;
      }
      if (number > max) {
        max = number;
      }
    });
  });

  return hasValue ? { min, max } : null;
}

function getSingleChartCsvSeriesMeta() {
  if (state.deviceId === WEBSOCKET_DEVICE_ID) {
    const normalized = normalizeWebSocketConfig(websocketConfig);
    return {
      key: "value",
      name: normalized.fieldName || "value",
      unit: normalized.unit || "",
    };
  }

  if (state.deviceId === MQTT_DEVICE_ID) {
    const normalized = normalizeMqttConfig(mqttConfig);
    return {
      key: "value",
      name: normalized.fieldName || "value",
      unit: normalized.unit || "",
    };
  }

  const config = getModeConfig(state.mode, state.deviceId, customConfig, modbusConfig);
  return {
    key: "value",
    name: config.fieldName || chart?.title || "value",
    unit: config.unit || chart?.unit || "",
  };
}

function resolveCurrentChartCsvTarget() {
  if (state.deviceId === DEFAULT_DEVICE_ID) {
    return {
      kind: "dual",
      title: i18n("chart.aomasterDual"),
      charts: {
        setpoint: setpointChart,
        actual: actualChart,
      },
      series: [
        { key: "setpoint", name: i18n("chart.setpointPreview"), unit: getAomasterDisplayUnit() },
        { key: "actual", name: i18n("chart.realTimeOutput"), unit: getAomasterDisplayUnit(getAomasterActualMode()) },
      ],
    };
  }

  if (state.deviceId === HART_DEVICE_ID) {
    ensureHartTelemetryChart();
    return {
      kind: "multi",
      title: i18n("chart.hartVar"),
      chart: hartChart,
      series: hartChart?.getSeriesDefs?.() ?? buildHartChartSeriesDefs(),
    };
  }

  if (shouldUseJsonMultiChart()) {
    ensureJsonMultiTelemetryChart();
    const meta = getJsonMultiChartMeta();
    return {
      kind: "multi",
      title: meta.title,
      chart: jsonMultiChart,
      series: jsonMultiChart?.getSeriesDefs?.() ?? meta.seriesDefs,
    };
  }

  ensureSingleTelemetryChart();
  return {
    kind: "single",
    title: chart?.title || i18n("chart.realTimeChart"),
    chart,
    series: [getSingleChartCsvSeriesMeta()],
  };
}

function buildChartCsvContextFromTarget(target) {
  if (target.kind === "single") {
    const [series] = target.series;
    return {
      kind: target.kind,
      title: target.title,
      series: [
        {
          ...series,
          values: target.chart?.getPoints?.() ?? [],
        },
      ],
    };
  }

  if (target.kind === "dual") {
    return {
      kind: target.kind,
      title: target.title,
      series: [
        {
          ...target.series[0],
          values: target.charts.setpoint?.getPoints?.() ?? [],
        },
        {
          ...target.series[1],
          values: target.charts.actual?.getPoints?.() ?? [],
        },
      ],
    };
  }

  const valuesMap = target.chart?.getSeriesValues?.() ?? {};
  return {
    kind: target.kind,
    title: target.title,
    series: target.series.map((series) => ({
      ...series,
      values: valuesMap[series.key] ?? [],
    })),
  };
}

function escapeCsvCell(value) {
  const text = value == null ? "" : String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function buildChartCsvText(context) {
  const pointCount = Math.max(0, ...context.series.map((series) => series.values.length));
  const metadata = {
    format: CHART_CSV_FORMAT,
    deviceId: state.deviceId,
    chartKind: context.kind,
    title: context.title,
    exportedAt: new Date().toISOString(),
    series: context.series.map(({ key, name, unit }) => ({ key, name, unit })),
  };
  const lines = [
    `# ${CHART_CSV_FORMAT}`,
    `# ${JSON.stringify(metadata)}`,
    ["index", ...context.series.map((series) => series.key)].map(escapeCsvCell).join(","),
  ];

  for (let rowIndex = 0; rowIndex < pointCount; rowIndex += 1) {
    lines.push(
      [
        rowIndex + 1,
        ...context.series.map((series) => {
          const value = series.values[rowIndex];
          return Number.isFinite(value) ? value : "";
        }),
      ]
        .map(escapeCsvCell)
        .join(","),
    );
  }

  return { text: lines.join("\n"), pointCount };
}

function buildChartCsvFilename() {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const deviceId = String(state.deviceId || "chart").replace(/[^a-z0-9_-]/gi, "-");
  return `modusignal-${deviceId}-${stamp}.csv`;
}

function triggerChartCsvDownload(filename, text) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function exportChartCsv() {
  const target = resolveCurrentChartCsvTarget();
  const context = buildChartCsvContextFromTarget(target);
  const { text, pointCount } = buildChartCsvText(context);
  triggerChartCsvDownload(buildChartCsvFilename(), text);
  appendLog("info", i18n("log.chart"), i18n("chart.csvExport") + `: ${context.series.length} ${i18n("num.curves", "curves")}, ${pointCount} ${i18n("num.points", "points")}`);
}

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (character === "," && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }

    current += character;
  }

  values.push(current);
  return values;
}

function parseChartCsvText(text) {
  const normalized = String(text || "").replace(/^\uFEFF/, "");
  const rows = [];
  let metadata = null;

  normalized.split(/\r?\n/).forEach((rawLine) => {
    const line = rawLine.trimEnd();
    if (!line.trim()) {
      return;
    }

    if (line.startsWith("#")) {
      const comment = line.slice(1).trim();
      if (comment.startsWith("{")) {
        try {
          metadata = JSON.parse(comment);
        } catch {
          // Ignore non-JSON metadata comments.
        }
      }
      return;
    }

    rows.push(parseCsvLine(line));
  });

  if (!rows.length || rows[0].length < 2) {
    throw new Error(i18n("chart.csvNeedCols"));
  }

  const seriesKeys = rows[0]
    .slice(1)
    .map((key, index) => String(key || `series${index + 1}`).trim());
  const seriesData = Object.fromEntries(seriesKeys.map((key) => [key, []]));

  rows.slice(1).forEach((row) => {
    if (row.every((cell) => !String(cell || "").trim())) {
      return;
    }

    seriesKeys.forEach((key, index) => {
      const cell = String(row[index + 1] ?? "").trim();
      const value = cell === "" ? null : Number(cell);
      seriesData[key].push(Number.isFinite(value) ? value : null);
    });
  });

  return {
    metadata,
    seriesKeys,
    seriesData,
    pointCount: Math.max(0, ...Object.values(seriesData).map((values) => values.length)),
  };
}

function ensureChartCapacityForImport(pointCount) {
  const chartPointSettings = getChartPointSettings();
  if (pointCount <= chartPointSettings.totalPointCount) {
    return;
  }

  chartConfig = normalizeChartConfig({
    ...chartConfig,
    chartPointCount: pointCount,
    visibleChartPointCount: Math.min(chartPointSettings.visiblePointCount, pointCount),
  });
  populateChartConfigForm(chartConfig);
  applyChartPointCountConfig();
}

function resolveImportedSeriesKey(parsed, targetSeries, fallbackIndex) {
  if (parsed.seriesData[targetSeries.key]) {
    return targetSeries.key;
  }

  const metadataSeries = parsed.metadata?.series?.find(
    (series) => series?.key === targetSeries.key || series?.name === targetSeries.name,
  );
  if (metadataSeries?.key && parsed.seriesData[metadataSeries.key]) {
    return metadataSeries.key;
  }

  const byName = parsed.seriesKeys.find((key) => key === targetSeries.name);
  if (byName && parsed.seriesData[byName]) {
    return byName;
  }

  return parsed.seriesKeys[fallbackIndex] ?? null;
}

function formatImportedSingleReadout(series, values, pointCount) {
  const lastValue = getLastFiniteValue(values);
  if (!Number.isFinite(lastValue)) {
    return `${i18n("chart.csvLoaded")} ${pointCount} ${i18n("num.points", "points")}`;
  }

  return `${series.name} ${lastValue.toFixed(3)}${series.unit ? ` ${series.unit}` : ""} · ${i18n("num.totalPointsPrefix")} ${pointCount} ${i18n("num.points", "points")}`;
}

function formatImportedDualReadout(values, unit, pointCount) {
  const lastValue = getLastFiniteValue(values);
  if (!Number.isFinite(lastValue)) {
    return `${i18n("chart.csvLoaded")} ${pointCount} ${i18n("num.points", "points")}`;
  }

  return i18n("chart.latest")
    .replace("{value}", `${lastValue.toFixed(3)}${unit ? ` ${unit}` : ""}`)
    .replace("{points}", pointCount);
}

function formatImportedMultiReadout(seriesDefs, seriesData, pointCount) {
  const summary = seriesDefs
    .map((series) => {
      const lastValue = getLastFiniteValue(seriesData[series.key] ?? []);
      if (!Number.isFinite(lastValue)) {
        return null;
      }

      return `${series.name} ${lastValue.toFixed(3)}${series.unit ? ` ${series.unit}` : ""}`;
    })
    .filter(Boolean)
    .join(" · ");

  return summary || `${i18n("chart.csvLoaded")} ${pointCount} ${i18n("num.points")}`;
}

function importChartCsv(parsed, sourceName = "CSV") {
  const target = resolveCurrentChartCsvTarget();
  ensureChartCapacityForImport(parsed.pointCount);

  if (target.kind === "single") {
    const [series] = target.series;
    const sourceKey = resolveImportedSeriesKey(parsed, series, 0);
    const rawValues = sourceKey ? parsed.seriesData[sourceKey] ?? [] : [];
    const values = rawValues.filter((value) => Number.isFinite(value));
    target.chart?.setPoints(values);
    if (elements.chartValue) {
      elements.chartValue.textContent = formatImportedSingleReadout(series, values, parsed.pointCount);
    }
  } else if (target.kind === "dual") {
    const setpointSeries = target.series[0];
    const actualSeries = target.series[1];
    const setpointKey = resolveImportedSeriesKey(parsed, setpointSeries, 0);
    const actualKey = resolveImportedSeriesKey(parsed, actualSeries, 1);
    const setpointValues = (setpointKey ? parsed.seriesData[setpointKey] ?? [] : []).filter((value) =>
      Number.isFinite(value),
    );
    const actualValues = (actualKey ? parsed.seriesData[actualKey] ?? [] : []).filter((value) =>
      Number.isFinite(value),
    );

    target.charts.setpoint?.setPoints(setpointValues);
    target.charts.actual?.setPoints(actualValues);
    target.charts.setpoint?.setMeta({ unit: setpointSeries.unit });
    target.charts.actual?.setMeta({ unit: actualSeries.unit });

    const extent = getFiniteSeriesExtent([setpointValues, actualValues]);
    if (extent) {
      target.charts.setpoint?.setRange(extent.min, extent.max);
      target.charts.actual?.setRange(extent.min, extent.max);
    }

    if (elements.setpointChartValue) {
      elements.setpointChartValue.textContent = formatImportedDualReadout(
        setpointValues,
        setpointSeries.unit,
        parsed.pointCount,
      );
    }
    if (elements.actualChartValue) {
      elements.actualChartValue.textContent = formatImportedDualReadout(
        actualValues,
        actualSeries.unit,
        parsed.pointCount,
      );
    }
  } else {
    const importedSeriesData = Object.fromEntries(
      target.series.map((series, index) => {
        const sourceKey = resolveImportedSeriesKey(parsed, series, index);
        return [series.key, sourceKey ? parsed.seriesData[sourceKey] ?? [] : []];
      }),
    );

    target.chart?.setSeriesData(importedSeriesData);
    if (elements.chartValue) {
      elements.chartValue.textContent = formatImportedMultiReadout(
        target.series,
        importedSeriesData,
        parsed.pointCount,
      );
    }

    if (state.deviceId === HART_DEVICE_ID) {
      updateHartVariableCards(
        Object.fromEntries(
          target.series
            .map((series) => {
              const lastValue = getLastFiniteValue(importedSeriesData[series.key] ?? []);
              if (!Number.isFinite(lastValue)) {
                return null;
              }

              return [series.key, { value: lastValue, unit: series.unit || "" }];
            })
            .filter(Boolean),
        ),
      );
    }
  }

  requestChartResize();
  appendLog("info", i18n("log.chart"), i18n("log.curveLoaded")
    .replace("{name}", sourceName)
    .replace("{series}", target.series.length)
    .replace("{points}", parsed.pointCount));
}

function openChartCsvPicker() {
  elements.loadChartCsvInput?.click();
}

async function loadChartCsv(event) {
  const [file] = Array.from(event.target?.files ?? []);
  if (!file) {
    return;
  }

  try {
    const text = await file.text();
    const parsed = parseChartCsvText(text);
    importChartCsv(parsed, file.name);
  } catch (error) {
    appendLog("error", i18n("log.chart"), error.message);
  } finally {
    event.target.value = "";
  }
}

function bindEvents() {
  bindSidebarPanelCollapse();
  initChartCurvePanel({
    elements,
    getDeviceId: () => state.deviceId,
    onVisibilityChange: () => requestChartResize(),
  });
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
    const hartWorkspaceTab = event.target.closest("[data-hart-workspace-tab]");
    if (hartWorkspaceTab) {
      switchHartWorkspace(hartWorkspaceTab.dataset.hartWorkspaceTab);
      return;
    }

    const hartWorkspaceAction = event.target.closest("[data-hart-workspace-action]");
    if (hartWorkspaceAction) {
      handleHartWorkspaceAction(hartWorkspaceAction.dataset.hartWorkspaceAction).catch((error) =>
        appendLog("error", "HART", error.message),
      );
      return;
    }

    if (event.target.closest('[data-field="sendDriverCommand"]')) {
      sendDeviceCommand();
      return;
    }

    const quickSend = event.target.closest("[data-ws-quick-send]");
    if (quickSend) {
      const preset = WEBSOCKET_QUICK_MESSAGES.find((item) => item.id === quickSend.dataset.wsQuickSend);
      if (preset) {
        sendWebSocketQuickMessage(preset).catch((error) => appendLog("error", i18n("log.send"), error.message));
      }
      return;
    }

    const quickLoad = event.target.closest("[data-ws-load-preset]");
    if (quickLoad) {
      const preset = WEBSOCKET_QUICK_MESSAGES.find((item) => item.id === quickLoad.dataset.wsLoadPreset);
      if (preset) {
        loadMessageIntoManualSender(preset);
      }
      return;
    }

    const mqttQuickSend = event.target.closest("[data-mqtt-quick-send]");
    if (mqttQuickSend) {
      const preset = MQTT_QUICK_MESSAGES.find((item) => item.id === mqttQuickSend.dataset.mqttQuickSend);
      if (preset) {
        sendMqttQuickMessage(preset).catch((error) => appendLog("error", i18n("log.send"), error.message));
      }
      return;
    }

    const mqttQuickLoad = event.target.closest("[data-mqtt-load-preset]");
    if (mqttQuickLoad) {
      const preset = MQTT_QUICK_MESSAGES.find((item) => item.id === mqttQuickLoad.dataset.mqttLoadPreset);
      if (preset) {
        loadMessageIntoManualSender(preset);
      }
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
  bindProductDialog(elements.openAomasterProductDialog, elements.aomasterProductDialog, elements.closeAomasterProductDialog);
  bindProductDialog(elements.openHartlinkProductDialog, elements.hartlinkProductDialog, elements.closeHartlinkProductDialog);
  on(elements.clearLog, "click", () => {
    resetRxLogCoalesce();
    elements.serialLog.innerHTML = "";
    appendLog("info", i18n("log.system"), i18n("log.logCleared"));
  });
  on(elements.clearChart, "click", () => {
    clearAllCharts();
    appendLog("info", i18n("log.system"), i18n("log.chartCleared"));
  });
  on(elements.togglePolling, "click", togglePolling);

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
  on(elements.testCustomParser, "click", () => testDeviceParser(CUSTOM_DEVICE_ID));

  getModbusConfigControls().filter(Boolean).forEach((control) => {
    control.addEventListener("input", updateModbusDraftConfig);
    control.addEventListener("change", updateModbusDraftConfig);
  });

  on(elements.saveModbusConfig, "click", saveModbusConfig);
  on(elements.resetModbusConfig, "click", resetModbusConfig);
  on(elements.testModbusParser, "click", () => testDeviceParser(MODBUS_DEVICE_ID));
  on(elements.modbusAddCurve, "click", () => handleAddDebugCurve("modbus"));
  bindDebugCurveConfigActions("modbus");

  on(elements.deviceLibrarySearch, "input", handleDeviceLibrarySearchInput);

  getHartConfigControls().filter(Boolean).forEach((control) => {
    control.addEventListener("input", updateHartDraftConfig);
    control.addEventListener("change", updateHartDraftConfig);
  });
  on(elements.hartStandardCommandFields, "input", updateHartDraftConfig);
  on(elements.hartStandardCommandFields, "change", updateHartDraftConfig);

  on(elements.saveHartConfig, "click", saveHartConfig);
  on(elements.resetHartConfig, "click", resetHartConfig);

  getWebsocketConfigControls().filter(Boolean).forEach((control) => {
    control.addEventListener("input", updateWebSocketDraftConfig);
    control.addEventListener("change", updateWebSocketDraftConfig);
  });

  on(elements.saveWebsocketConfig, "click", saveWebsocketConfig);
  on(elements.resetWebsocketConfig, "click", resetWebsocketConfig);
  on(elements.loadWebsocketHeartbeat, "click", () => loadMessageIntoManualSender(readWebsocketHeartbeatPreset()));
  on(elements.testWebsocketParser, "click", () => testDeviceParser(WEBSOCKET_DEVICE_ID));
  on(elements.websocketAddCurve, "click", () => handleAddDebugCurve("websocket"));

  getMqttConfigControls().filter(Boolean).forEach((control) => {
    control.addEventListener("input", updateMqttDraftConfig);
    control.addEventListener("change", updateMqttDraftConfig);
  });

  on(elements.saveMqttConfig, "click", saveMqttConfig);
  on(elements.resetMqttConfig, "click", resetMqttConfig);
  on(elements.loadMqttHeartbeat, "click", () => loadMessageIntoManualSender(readMqttHeartbeatPreset()));
  on(elements.testMqttParser, "click", () => testDeviceParser(MQTT_DEVICE_ID));
  on(elements.mqttAddCurve, "click", () => handleAddDebugCurve("mqtt"));
  bindDebugCurveConfigActions("mqtt");
  bindDebugCurveConfigActions("websocket");
  bindDebugCurveConfigActions("custom");
  on(elements.customAddCurve, "click", () => handleAddDebugCurve("custom"));

  on(elements.hartSearchDevice, "click", () => {
    sendHartSearchCommand().catch((error) => appendLog("error", "HART", error.message));
  });
  on(elements.hartScanAddresses, "click", () => {
    scanHartAddresses().catch((error) => appendLog("error", "HART", error.message));
  });
  elements.hartChartSeriesInputs.forEach((input) => {
    input.addEventListener("change", handleHartChartSeriesChange);
  });

  getAomasterConfigControls().filter(Boolean).forEach((control) => {
    control.addEventListener("input", updateAomasterDraftConfig);
    control.addEventListener("change", updateAomasterDraftConfig);
  });

  on(elements.saveAomasterConfig, "click", saveAomasterConfig);
  on(elements.resetAomasterConfig, "click", resetAomasterConfig);

  bindChartConfigEvents();
}

function isMobileLayout() {
  return window.matchMedia(MOBILE_LAYOUT_QUERY).matches;
}

function getSidebarPanels() {
  return [...document.querySelectorAll(".sidebar-panel[data-sidebar-panel]")].flatMap((panel) => {
    const panelId = panel.dataset.sidebarPanel;
    const toggle = panel.querySelector(".sidebar-collapse-toggle");
    if (!toggle || !panelId) {
      return [];
    }

    return [{ panel, panelId, toggle }];
  });
}

function applySidebarPanelLayout({ persistOnDesktop = false } = {}) {
  const saved = loadSidebarPanelState();
  const mobile = isMobileLayout();

  getSidebarPanels().forEach(({ panel, panelId, toggle }) => {
    const collapsed = mobile ? true : saved[panelId] === true;
    setSidebarPanelCollapsed(panel, toggle, collapsed);
  });

  if (persistOnDesktop && !mobile) {
    persistSidebarPanelState();
  }
}

function bindSidebarPanelCollapse() {
  applySidebarPanelLayout();

  getSidebarPanels().forEach(({ panel, toggle }) => {
    toggle.addEventListener("click", () => {
      setSidebarPanelCollapsed(panel, toggle, !panel.classList.contains("collapsed"));
      if (!isMobileLayout()) {
        persistSidebarPanelState();
      }
    });
  });

  window.matchMedia(MOBILE_LAYOUT_QUERY).addEventListener("change", () => {
    applySidebarPanelLayout();
  });
}

function setSidebarPanelCollapsed(panel, toggle, collapsed) {
  panel.classList.toggle("collapsed", collapsed);
  toggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
  toggle.title = collapsed ? i18n("panel.expand") : i18n("panel.collapse");
  toggle.textContent = collapsed ? "▸" : "▾";

  const label = panel.querySelector("h2")?.textContent?.trim() || i18n("panel.default");
  toggle.setAttribute("aria-label", collapsed ? `${i18n("panel.expand")}${label}` : `${i18n("panel.collapse")}${label}`);
}

function loadSidebarPanelState() {
  try {
    const saved = localStorage.getItem(SIDEBAR_PANELS_STORAGE_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
}

function persistSidebarPanelState() {
  const state = {};
  document.querySelectorAll(".sidebar-panel[data-sidebar-panel]").forEach((panel) => {
    if (panel.dataset.sidebarPanel) {
      state[panel.dataset.sidebarPanel] = panel.classList.contains("collapsed");
    }
  });
  localStorage.setItem(SIDEBAR_PANELS_STORAGE_KEY, JSON.stringify(state));
}

function bindSessionEvents(target) {
  target.addEventListener("connected", () => {
    resetWebSocketMessageStats();
    resetMqttMessageStats();
    resetMqttRxBuffer();
    resetWebSocketRxBuffer();
    resetCustomRxBuffer(customConfig);
    updateConnectionUi(true);
    updateActivePolling();
    appendLog("info", i18n("log.connect"), describeConnectionSummary());
  });

  target.addEventListener("disconnected", () => {
    state.pollingActive = false;
    stopAllPolling();
    resetModbusRxBuffer();
    resetHartRxBuffer();
    resetHartLinkVersionProbe();
    resetAomasterRxBuffer();
    resetMqttRxBuffer();
    resetWebSocketRxBuffer();
    resetCustomRxBuffer(customConfig);
    finalizeRxLogCoalesce();
    updateConnectionUi(false);
    resetWebSocketMessageStats();
    resetMqttMessageStats();
    appendLog("info", i18n("log.connect"), i18n("log.disconnected"));
  });

  target.addEventListener("rx", (event) => {
    const { bytes, text, topic } = event.detail;
    const hartLinkProbeChunk =
      state.deviceId === HART_DEVICE_ID && state.transportId === DEFAULT_TRANSPORT_ID
        ? handleHartLinkVersionProbeRx(text)
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
      websocketMessageStats.rx += 1;
      updateWebSocketMessageStatsUi();
    }

    if (state.deviceId === MQTT_DEVICE_ID) {
      mqttMessageStats.rx += 1;
      updateMqttMessageStatsUi();
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
        populateHartConfigForm(hartConfig);
        updateHartDeviceInfo();
        updateHartWorkspaceFromDiscovery(telemetry);
        appendLog("info", "HART", formatHartDeviceSummary(hartConfig.device));
        updateDeviceUi();
        return;
      }

      if (state.deviceId === DEFAULT_DEVICE_ID) {
        const readbackMode = telemetry.mode || state.mode;
        aomasterActualMode = readbackMode;
        actualChart?.setMeta({ unit: getAomasterDisplayUnit(readbackMode) });
        syncAomasterActualChartRange(readbackMode);
        actualChart?.add(getAomasterDisplayNumber(telemetry.value, readbackMode));
        const formatted = formatAomasterDisplayValue(telemetry.value, readbackMode);
        elements.actualChartValue.textContent = `${telemetry.fieldName} ${formatted}`;
      } else if (state.deviceId === HART_DEVICE_ID) {
        handleHartTelemetry(telemetry);
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
      websocketMessageStats.tx += 1;
      updateWebSocketMessageStatsUi();
    }

    if (state.deviceId === MQTT_DEVICE_ID) {
      mqttMessageStats.tx += 1;
      updateMqttMessageStatsUi();
    }
  });

  target.addEventListener("error", (event) => {
    appendLog("error", i18n("log.error"), event.detail.error?.message ?? String(event.detail.error));
  });
}

async function setTransport(transportId) {
  if (session && session.connected) {
    await session.disconnect().catch((error) => appendLog("error", i18n("log.connect"), error.message));
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
    option.textContent = i18n(descriptor.label);
    elements.transportSelect.append(option);
  });
  elements.transportSelect.value = state.transportId;
}

function getDeviceTransportDefaults(deviceId = state.deviceId) {
  const entry = DEVICE_TRANSPORT_DEFAULTS[deviceId];
  if (!entry) {
    return null;
  }

  if (Object.prototype.hasOwnProperty.call(entry, DEFAULT_TRANSPORT_ID)) {
    const preferredTransportId = getDeviceDefaultTransportId(deviceId, customConfig, modbusConfig);
    return entry[state.transportId] ?? entry[preferredTransportId] ?? entry[DEFAULT_TRANSPORT_ID] ?? null;
  }

  return entry;
}

function applyDeviceDefaultTransport(deviceId = state.deviceId) {
  const defaultTransportId = getDeviceDefaultTransportId(deviceId, customConfig, modbusConfig);

  if (state.transportId !== defaultTransportId) {
    void setTransport(defaultTransportId);
    return;
  }

  applyDeviceTransportDefaults(deviceId);
}

function resolveTransportFieldDefault(field) {
  const deviceDefaults = getDeviceTransportDefaults();
  if (deviceDefaults?.[field.key] !== undefined) {
    return deviceDefaults[field.key];
  }

  if (transportOptions[field.key] !== undefined) {
    return transportOptions[field.key];
  }

  return field.default;
}

function renderTransportFields() {
  const descriptor = getTransportDescriptor(state.transportId);
  elements.transportFields.innerHTML = "";

  descriptor.fields.forEach((field) => {
    const label = document.createElement("label");
    label.textContent = i18n(field.label, field.label);

    const control = field.type === "select" ? document.createElement("select") : document.createElement("input");
    control.dataset.fieldKey = field.key;
    control.dataset.fieldType = typeof field.default === "number" ? "number" : "string";
    const resolvedDefault = resolveTransportFieldDefault(field);

    if (field.type === "select") {
      (field.options ?? []).forEach((option) => {
        const value = typeof option === "object" ? option.value : option;
        const text = typeof option === "object" ? option.label : String(option);
        const el = document.createElement("option");
        el.value = String(value);
        el.textContent = text;
        if (value === resolvedDefault) {
          el.selected = true;
        }
        control.append(el);
      });
    } else {
      control.type = field.type === "number" ? "number" : "text";
      control.value = resolvedDefault ?? "";
    }

    label.append(control);
    elements.transportFields.append(label);

    if (state.transportId === WEBSOCKET_TRANSPORT_ID && field.key === "url") {
      control.addEventListener("input", updateWebSocketTransportDraft);
      control.addEventListener("change", updateWebSocketTransportDraft);
    }

    if (state.transportId === MQTT_TRANSPORT_ID && field.key === "brokerUrl") {
      control.addEventListener("input", updateMqttTransportDraft);
      control.addEventListener("change", updateMqttTransportDraft);
    } else if (state.transportId === MQTT_TRANSPORT_ID) {
      control.addEventListener("input", updateMqttDebuggerUi);
      control.addEventListener("change", updateMqttDebuggerUi);
    }
  });

  applyDeviceTransportDefaults();
  updateSecureState();
}

function readTransportOptions() {
  const options = {};
  elements.transportFields.querySelectorAll("[data-field-key]").forEach((control) => {
    const { fieldKey, fieldType } = control.dataset;
    options[fieldKey] = fieldType === "number" ? Number(control.value) : control.value;
  });
  transportOptions = { ...transportOptions, ...options };
  return options;
}

function describeDeviceTransportDefaults(deviceId) {
  if (state.transportId === MQTT_TRANSPORT_ID) {
    return i18n("transport.defaults.mqtt");
  }

  if (state.transportId === WEBSOCKET_TRANSPORT_ID) {
    if (deviceId === MODBUS_DEVICE_ID) {
      return i18n("transport.defaults.modbusWs");
    }
    if (deviceId === WEBSOCKET_DEVICE_ID) {
      return i18n("transport.defaults.wsDebug");
    }
    if (deviceId === MQTT_DEVICE_ID) {
      return i18n("transport.defaults.mqttDebug");
    }
    return i18n("transport.defaults.ws");
  }

  if (deviceId === HART_DEVICE_ID) {
    return i18n("transport.defaults.hart");
  }
  if (deviceId === AOMASTER_DEVICE_ID) {
    return i18n("transport.defaults.aomaster");
  }
  if (deviceId === MODBUS_DEVICE_ID) {
    return i18n("transport.defaults.modbus");
  }
  if (deviceId === CUSTOM_DEVICE_ID) {
    return i18n("transport.defaults.custom");
  }
  return i18n("transport.defaults.generic");
}

function applyDeviceTransportDefaults(deviceId = state.deviceId) {
  const defaults = getDeviceTransportDefaults(deviceId);
  if (!defaults) {
    return false;
  }

  if (!elements.transportFields) {
    return false;
  }

  let changed = false;
  for (const [key, value] of Object.entries(defaults)) {
    const control = elements.transportFields.querySelector(`[data-field-key="${key}"]`);
    if (!control) {
      continue;
    }

    const nextValue = String(value);
    if (control.value !== nextValue) {
      changed = true;
    }

    transportOptions[key] = value;
    control.value = nextValue;
  }

  if (changed && session?.connected) {
    appendLog("info", i18n("log.connect"), `${i18n("log.switchedTransport")} ${describeDeviceTransportDefaults(deviceId)}${i18n("conn.reconnectHint")}`);
  }

  return changed;
}

function selectDevice(deviceId) {
  resetHartLinkVersionProbe();
  const standalone = isStandaloneDevice(deviceId);
  state.pollingActive = false;
  stopAllPolling();
  resetModbusRxBuffer();
  resetHartRxBuffer();
  resetAomasterRxBuffer();
  state.deviceId = deviceId;
  state.pageId = deviceId;

  if (standalone && session?.connected) {
    void disconnect().catch((error) => appendLog("error", i18n("log.connect"), error.message));
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
    applyAomasterModeDefaults();
  }

  if (!standalone) {
    applyDeviceDefaultTransport(deviceId);
  }

  clearAllCharts();
  if (!standalone) {
    syncAomasterChartRanges();
  }
  updatePageUi();
  updateDeviceUi();
  updateActivePolling();
  updatePollingUi();
  applySidebarPanelLayout();
  resetViewportScroll();
  appendLog("info", i18n("log.device"), `${i18n("log.switchedTo")} ${getDeviceProfile(state.deviceId, customConfig, modbusConfig).name}`);

  if (deviceId === HART_DEVICE_ID && state.transportId === DEFAULT_TRANSPORT_ID && session?.connected) {
    void detectHartLinkVersion(session);
  }
}

function navigateToPage(pageId) {
  if (DEVICE_PAGE_IDS.includes(pageId)) {
    selectDevice(pageId);
    return;
  }

  state.pageId = pageId === "request" ? "request" : "home";
  updatePageUi();
  updateDeviceUi();
  applySidebarPanelLayout();
  resetViewportScroll();
}

function resetViewportScroll() {
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
}

function updateSecureState() {
  if (session?.connected) {
    syncSecureState(true);
    return;
  }

  const descriptor = getTransportDescriptor(state.transportId);

  if (descriptor.requiresSecureContext && !window.isSecureContext) {
    setSecureStateText(i18n("env.needHttps"));
    elements.secureState.classList.add("warning");
    elements.connectButton.disabled = true;
    return;
  }

  if (!descriptor.isSupported()) {
    setSecureStateText(i18n("env.notSupported") + i18n(descriptor.label));
    elements.secureState.classList.add("warning");
    elements.connectButton.disabled = true;
    return;
  }

  if (state.transportId === WEBSOCKET_TRANSPORT_ID) {
    const wsWarning = describeWebSocketUrlWarning(readTransportOptions().url);
    if (wsWarning) {
      setSecureStateText(wsWarning);
      elements.secureState.classList.add("warning");
      return;
    }
  }

  if (state.transportId === MQTT_TRANSPORT_ID) {
    const mqttWarning = describeMqttUrlWarning(readTransportOptions().brokerUrl);
    if (mqttWarning) {
      setSecureStateText(mqttWarning);
      elements.secureState.classList.add("warning");
      return;
    }
  }

  setSecureStateText(i18n(descriptor.label) + i18n("env.available"));
  elements.secureState.classList.remove("warning");
}

function setSecureStateText(text) {
  if (!elements.secureState) {
    return;
  }

  elements.secureState.textContent = text;
  elements.secureState.dataset.marquee = text;
}

function updateWebSocketTransportDraft() {
  updateSecureState();
  updateWebSocketMessageStatsUi();
}

function updateMqttTransportDraft() {
  updateSecureState();
  updateMqttDebuggerUi();
}

function transportReady() {
  if (isStandaloneDevice(state.deviceId)) {
    return false;
  }

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
      syncHartCommandModeUi();
      ensureHartTelemetryChart();
      syncHartChartSeriesControls();
      updateHartVariableCards();
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
    button.classList.toggle("active", button.dataset.deviceId === state.deviceId && isDevicePageActive());
  });

  if (isStandalone) {
    requestChartResize();
    updatePollingUi();
    return;
  }

  if (isAomaster) {
    syncAomasterValueDisplayControls();
    populateOutputModeSelect();
    if (elements.outputModeSelect) {
      elements.outputModeSelect.value = state.mode;
      elements.outputModeSelect.disabled = false;
      elements.outputModeSelect.title = "";
    }
    if (elements.waveformSelect) {
      elements.waveformSelect.value = state.waveform;
    }
    populateAomasterWaveformForm();
    updateAomasterWaveformUi();
    syncAomasterChartRanges();
    refreshAomasterPreviewChart();
  }

  if (!isAomaster && !isHart && !isMessageDebug && chart) {
    const chartConfig = getModeConfig(state.mode, state.deviceId, customConfig, modbusConfig);
    chart.setMeta({ title: i18n("chart.realTimeChart"), unit: chartConfig.unit });
  }

  if (isHart) {
    updateHartDeviceInfo();
  }

  if (isWebsocket) {
    renderWebSocketQuickSends();
    updateWebSocketDebuggerUi();
    if (elements.sendFormat) {
      elements.sendFormat.value = "json";
    }
    if (elements.lineEnding) {
      elements.lineEnding.value = "";
    }
  }

  if (isMqtt) {
    renderMqttQuickSends();
    updateMqttDebuggerUi();
    if (elements.sendFormat) {
      elements.sendFormat.value = "json";
    }
    if (elements.lineEnding) {
      elements.lineEnding.value = "";
    }
  }

  requestChartResize();
  updateSetpointUi();
  updatePollingUi();
}

function updatePageUi() {
  const isDevice = isDevicePageActive();
  const isStandalone = isDevice && isStandaloneDevice(state.deviceId);

  elements.pages = [...document.querySelectorAll("[data-page-id]")];
  elements.appShell?.classList.toggle("standalone-device", isStandalone);
  elements.deviceShell.classList.toggle("active", isDevice);
  elements.deviceShell.classList.toggle("standalone", isStandalone);

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

function getDeviceLibraryEntries() {
  return listDeviceLibrary(customConfig, modbusConfig);
}

function matchesDeviceLibrarySearch(entry, query) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  const haystack = [entry.deviceId, entry.profile.id, entry.profile.name, entry.profile.type]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(normalized);
}

function filterDeviceLibraryEntries(entries, query = deviceLibrarySearchQuery) {
  return entries.filter((entry) => matchesDeviceLibrarySearch(entry, query));
}

function handleDeviceLibrarySearchInput(event) {
  deviceLibrarySearchQuery = event.target.value;
  renderDeviceLibrary();
}

function renderDeviceLibrary() {
  elements.deviceLibrary.innerHTML = "";

  const entries = filterDeviceLibraryEntries(getDeviceLibraryEntries());
  if (entries.length === 0) {
    const empty = document.createElement("p");
    empty.className = "device-library-empty";
    empty.textContent = deviceLibrarySearchQuery.trim()
      ? i18n("device.noMatch")
      : i18n("device.libraryEmpty");
    elements.deviceLibrary.append(empty);
    return;
  }

  entries.forEach((entry) => {
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
      entry.deviceId === CUSTOM_DEVICE_ID ? i18n("custom.cardDesc") : entry.profile.type;

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

  getDeviceLibraryEntries().forEach((entry) => {
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
      summary.textContent = i18n("home.aomasterCardDesc");
    } else if (entry.deviceId === MODBUS_DEVICE_ID) {
      summary.textContent = i18n("home.modbusCardDesc");
    } else if (entry.deviceId === HART_DEVICE_ID) {
      summary.textContent = i18n("home.hartCardDesc");
    } else if (entry.deviceId === WEBSOCKET_DEVICE_ID) {
      summary.textContent = i18n("home.card.websocket");
    } else if (entry.deviceId === MQTT_DEVICE_ID) {
      summary.textContent = i18n("home.mqttCardDesc");
    } else if (isStandaloneDevice(entry.deviceId)) {
      summary.textContent = i18n("home.microscopePowerCardDesc");
    } else {
      summary.textContent = i18n("home.customCardDesc");
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
  requestTitle.textContent = i18n("home.requestDevice");

  const requestSummary = document.createElement("span");
  requestSummary.textContent = i18n("home.requestCardDesc");

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
    refreshAomasterPreviewChart();
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
    updateHartWorkspaceUi();
    if (sendDriverCommand) {
      sendDriverCommand.textContent = i18n("driver.sendCommand");
    }
    if (elements.hartSearchDevice) {
      elements.hartSearchDevice.disabled = !session?.connected || hartAddressScanActive;
    }
    if (elements.hartScanAddresses) {
      elements.hartScanAddresses.disabled = !session?.connected || hartAddressScanActive;
      elements.hartScanAddresses.textContent = hartAddressScanActive ? i18n("hart.scanning") : i18n("hart.scanAddresses");
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

function describeConnectionSummary() {
  const descriptor = getTransportDescriptor(state.transportId);
  const options = readTransportOptions();

  if (state.transportId === MQTT_TRANSPORT_ID) {
    return i18n("conn.mqttConnected") + ` · ${options.brokerUrl} · ` + i18n("conn.subscribed") + ` ${options.subscribeTopic}`;
  }

  if (state.transportId === WEBSOCKET_TRANSPORT_ID) {
    return i18n("conn.wsConnected") + ` · ${options.url}`;
  }

  if (state.transportId === DEFAULT_TRANSPORT_ID) {
    const parity = options.parity === "none" ? "N" : options.parity === "even" ? "E" : "O";
    return i18n("conn.serialConnected") + ` · ${options.baudRate} ${options.dataBits}${parity}${options.stopBits}`;
  }

  return i18n(descriptor.label) + i18n("conn.connected");
}

function syncSecureState(connected) {
  if (!elements.secureState) {
    return;
  }

  if (connected) {
    setSecureStateText(describeConnectionSummary());
    elements.secureState.classList.remove("warning");
    elements.secureState.classList.add("connected");
    return;
  }

  elements.secureState.classList.remove("connected");
  updateSecureState();
}

function updateConnectionUi(connected) {
  const standalone = isStandaloneDevice(state.deviceId);
  elements.connectButton.disabled = standalone || connected || !transportReady();
  elements.disconnectButton.disabled = !connected;
  elements.sendManual.disabled = !connected;
  elements.transportSelect.disabled = standalone || connected;
  elements.connectionState.textContent = connected ? i18n("nav.connected") : i18n("nav.notConnected");
  elements.connectionState.classList.toggle("connected", connected);
  if (connected) {
    elements.connectionState.title = describeConnectionSummary();
  } else {
    elements.connectionState.removeAttribute("title");
  }
  syncSecureState(connected);
  updateSetpointUi();
  updatePollingUi();
  if (connected) {
    updateDeviceUi();
  }
}

function updateCustomDraftConfig() {
  customConfig = readCustomConfigForm();
  syncDebugCurveModeFields("custom", customConfig.parserMode, elements, customConfig);
  syncDebugCurveConfigRows("custom", customConfig);

  if (state.deviceId === CUSTOM_DEVICE_ID) {
    state.mode = "custom";
    const config = getModeConfig(state.mode, state.deviceId, customConfig, modbusConfig);
    state.setpoint = Math.min(config.max, Math.max(config.min, state.setpoint));
  }

  syncChartCurvePanelUi();
  updateDeviceUi();
}

function saveCustomConfig() {
  customConfig = readCustomConfigForm();
  localStorage.setItem(CUSTOM_CONFIG_STORAGE_KEY, JSON.stringify(customConfig));
  populateCustomConfigForm(customConfig);
  renderDeviceLibrary();
  renderHomeDeviceCards();
  updateDeviceUi();
  appendLog("info", i18n("log.device"), i18n("settings.saved.custom"));
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
  appendLog("info", i18n("log.device"), i18n("settings.reset.custom"));
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

async function connect() {
  try {
    await session.connect(readTransportOptions());
    if (session?.connected) {
      updateConnectionUi(true);
      if (state.deviceId === HART_DEVICE_ID && state.transportId === DEFAULT_TRANSPORT_ID) {
        void detectHartLinkVersion(session);
      }
    }
  } catch (error) {
    appendLog("error", i18n("log.connect"), error.message);
  }
}

async function disconnect() {
  await session.disconnect();
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

    const writeOptions = state.deviceId === MQTT_DEVICE_ID ? readMqttWriteOptions() : undefined;
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
      await session.write(payload, readMqttWriteOptions());
      return;
    }

    await session.write(payload);
  } catch (error) {
    appendLog("error", i18n("log.send"), error.message);
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
    ...readDebugCurveConfigForm("custom", elements),
  });
}

function populateCustomConfigForm(config) {
  const normalized = normalizeCustomConfig(config);
  elements.customDeviceName.value = normalized.name || i18n("custom.customProfile.name");
  elements.customDeviceType.value = normalized.type || i18n("custom.profile.type");
  elements.customChannelLabel.value = normalized.channelLabel;
  elements.customUnit.value = normalized.unit;
  elements.customMin.value = String(normalized.min);
  elements.customMax.value = String(normalized.max);
  elements.customStep.value = String(normalized.step);
  elements.customDefaultValue.value = String(normalized.defaultValue);
  elements.customCommandFormat.value = normalized.commandFormat;
  elements.customCommandTemplate.value = normalized.commandTemplate;
  elements.customCommandLineEnding.value = normalized.commandLineEnding;
  populateDebugCurveConfigForm("custom", normalized, elements);
  syncDebugCurveConfigRows("custom", normalized);
  if (elements.customParserPreview) {
    elements.customParserPreview.textContent = i18n("curve.waitingTest");
  }
}

function stopModbusPolling() {
  if (modbusPollTimer) {
    clearInterval(modbusPollTimer);
    modbusPollTimer = null;
  }
}

function stopHartPolling() {
  if (hartPollTimer) {
    clearInterval(hartPollTimer);
    hartPollTimer = null;
  }
}

function stopAomasterPolling() {
  if (aomasterPollTimer) {
    clearInterval(aomasterPollTimer);
    aomasterPollTimer = null;
  }
}

function stopWebSocketPolling() {
  if (websocketPollTimer) {
    clearInterval(websocketPollTimer);
    websocketPollTimer = null;
  }
}

function stopMqttPolling() {
  if (mqttPollTimer) {
    clearInterval(mqttPollTimer);
    mqttPollTimer = null;
  }
}

function stopAllPolling() {
  stopModbusPolling();
  stopHartPolling();
  stopAomasterPolling();
  stopWebSocketPolling();
  stopMqttPolling();
}

function getCurrentPollIntervalMs() {
  if (state.deviceId === MODBUS_DEVICE_ID) {
    return normalizeModbusConfig(modbusConfig).pollIntervalMs;
  }

  if (state.deviceId === HART_DEVICE_ID) {
    return normalizeHartConfig(hartConfig).pollIntervalMs;
  }

  if (state.deviceId === WEBSOCKET_DEVICE_ID) {
    return normalizeWebSocketConfig(websocketConfig).pollIntervalMs;
  }

  if (state.deviceId === MQTT_DEVICE_ID) {
    return normalizeMqttConfig(mqttConfig).pollIntervalMs;
  }

  if (state.deviceId === DEFAULT_DEVICE_ID) {
    return normalizeAomasterConfig(aomasterConfig).pollIntervalMs;
  }

  return 0;
}

function canCurrentDevicePoll() {
  if (!session?.connected || state.deviceId === CUSTOM_DEVICE_ID) {
    return false;
  }

  const interval = getCurrentPollIntervalMs();
  if (interval <= 0) {
    return false;
  }

  if (state.deviceId === MODBUS_DEVICE_ID) {
    return isReadFunctionCode(normalizeModbusConfig(modbusConfig).functionCode);
  }

  if (state.deviceId === HART_DEVICE_ID) {
    return normalizeHartConfig(hartConfig).device.discovered;
  }

  if (state.deviceId === WEBSOCKET_DEVICE_ID) {
    return createDeviceSetOutputCommand(
      WEBSOCKET_DEVICE_ID,
      state,
      customConfig,
      modbusConfig,
      aomasterConfig,
      hartConfig,
      websocketConfig,
      mqttConfig,
    ).supported;
  }

  if (state.deviceId === MQTT_DEVICE_ID) {
    return createDeviceSetOutputCommand(
      MQTT_DEVICE_ID,
      state,
      customConfig,
      modbusConfig,
      aomasterConfig,
      hartConfig,
      websocketConfig,
      mqttConfig,
    ).supported;
  }

  return state.deviceId === DEFAULT_DEVICE_ID;
}

function updateActivePolling() {
  updateModbusPolling();
  updateHartPolling();
  updateAomasterPolling();
  updateWebSocketPolling();
  updateMqttPolling();
}

function updatePollingUi() {
  if (!elements.togglePolling) {
    return;
  }

  if (isStandaloneDevice(state.deviceId)) {
    state.pollingActive = false;
    stopAllPolling();
    if (elements.pollState) {
      elements.pollState.classList.remove("connected");
      elements.pollState.textContent = i18n("workbench.pollNotSupported");
    }
    elements.togglePolling.disabled = true;
    elements.togglePolling.textContent = i18n("workbench.startPolling");
    return;
  }

  if (state.pollingActive && !canCurrentDevicePoll()) {
    state.pollingActive = false;
    stopAllPolling();
  }

  const connected = Boolean(session?.connected);
  const canPoll = canCurrentDevicePoll();
  const interval = getCurrentPollIntervalMs();

  if (elements.pollState) {
    elements.pollState.classList.toggle("connected", state.pollingActive && connected);

    if (!connected) {
      elements.pollState.textContent = i18n("nav.notConnected");
    } else if (state.deviceId === CUSTOM_DEVICE_ID) {
      elements.pollState.textContent = i18n("workbench.pollNotSupported");
    } else if (state.deviceId === MODBUS_DEVICE_ID && !isReadFunctionCode(normalizeModbusConfig(modbusConfig).functionCode)) {
      elements.pollState.textContent = i18n("workbench.pollNeedRead");
    } else if (state.deviceId === HART_DEVICE_ID && !canPoll) {
      elements.pollState.textContent = i18n("workbench.pollNeedSearch");
    } else if (state.deviceId === WEBSOCKET_DEVICE_ID && !canPoll) {
      elements.pollState.textContent = i18n("workbench.pollNeedConfig");
    } else if (state.deviceId === MQTT_DEVICE_ID && !canPoll) {
      elements.pollState.textContent = i18n("workbench.pollNeedConfig");
    } else if (interval <= 0) {
      elements.pollState.textContent = i18n("workbench.pollNeedInterval");
    } else if (state.pollingActive) {
      elements.pollState.textContent = i18n("workbench.polling") + ` · ${interval} ms`;
    } else {
      elements.pollState.textContent = i18n("workbench.pollStopped");
    }
  }

  elements.togglePolling.disabled = !connected || !canPoll;
  elements.togglePolling.textContent = state.pollingActive ? i18n("workbench.stopPolling") : i18n("workbench.startPolling");
}

function togglePolling() {
  if (!session?.connected || !canCurrentDevicePoll()) {
    return;
  }

  state.pollingActive = !state.pollingActive;

  if (state.pollingActive) {
    updateActivePolling();
    appendLog("info", i18n("poll.category"), `${i18n("poll.startedPrefix")} ${getCurrentPollIntervalMs()} ms`);
  } else {
    stopAllPolling();
    appendLog("info", i18n("poll.category"), i18n("poll.stopped"));
  }

  updatePollingUi();
}

function updateModbusPolling() {
  stopModbusPolling();

  const normalized = normalizeModbusConfig(modbusConfig);
  if (state.deviceId !== MODBUS_DEVICE_ID || !session?.connected || !state.pollingActive) {
    return;
  }

  if (!isReadFunctionCode(normalized.functionCode) || normalized.pollIntervalMs <= 0) {
    return;
  }

  modbusPollTimer = window.setInterval(() => {
    sendDeviceCommand().catch((error) => appendLog("error", "Modbus", error.message));
  }, normalized.pollIntervalMs);
}

function updateWebSocketPolling() {
  stopWebSocketPolling();

  const normalized = normalizeWebSocketConfig(websocketConfig);
  if (state.deviceId !== WEBSOCKET_DEVICE_ID || !session?.connected || !state.pollingActive) {
    return;
  }

  if (normalized.pollIntervalMs <= 0 || !normalized.heartbeatMessage.trim()) {
    return;
  }

  websocketPollTimer = window.setInterval(() => {
    sendDeviceCommand().catch((error) => appendLog("error", "WebSocket", error.message));
  }, normalized.pollIntervalMs);
}

function updateWebSocketDraftConfig() {
  websocketConfig = readWebsocketConfigForm();
  updateWebSocketParserConfigUi(websocketConfig);
  updateDeviceUi();
  if (state.pollingActive && !canCurrentDevicePoll()) {
    state.pollingActive = false;
  }
  updateActivePolling();
}

function saveWebsocketConfig() {
  websocketConfig = readWebsocketConfigForm();
  localStorage.setItem(WEBSOCKET_CONFIG_STORAGE_KEY, JSON.stringify(websocketConfig));
  populateWebsocketConfigForm(websocketConfig);
  updateDeviceUi();
  updateActivePolling();
  appendLog("info", i18n("log.device"), `${i18n("device.ws")}${i18n("common.configSavedShort")}`);
}

function resetWebsocketConfig() {
  websocketConfig = normalizeWebSocketConfig(DEFAULT_WEBSOCKET_CONFIG);
  localStorage.setItem(WEBSOCKET_CONFIG_STORAGE_KEY, JSON.stringify(websocketConfig));
  populateWebsocketConfigForm(websocketConfig);
  updateDeviceUi();
  updateActivePolling();
  appendLog("info", i18n("log.device"), `${i18n("device.ws")}${i18n("common.configResetShort")}`);
}

function loadWebsocketConfig() {
  try {
    const saved = localStorage.getItem(WEBSOCKET_CONFIG_STORAGE_KEY);
    return normalizeWebSocketConfig(saved ? JSON.parse(saved) : DEFAULT_WEBSOCKET_CONFIG);
  } catch {
    return normalizeWebSocketConfig(DEFAULT_WEBSOCKET_CONFIG);
  }
}

function syncDebugCurveConfigRows(prefix, config) {
  const normalized =
    prefix === "mqtt"
      ? normalizeMqttConfig(config)
      : prefix === "websocket"
        ? normalizeWebSocketConfig(config)
        : prefix === "modbus"
          ? normalizeModbusConfig(config)
          : normalizeCustomConfig(config);
  const field = elements[`${prefix}CurveConfigBlock`];
  const addButton = elements[`${prefix}AddCurve`];

  field?.querySelectorAll(".curve-config-row[data-curve-slot]").forEach((row) => {
    const slot = Number(row.dataset.curveSlot);
    row.hidden = slot > normalized.curveSlotCount;
  });

  if (addButton) {
    addButton.hidden = normalized.curveSlotCount >= JSON_CURVE_SLOTS.length;
  }
}

function getDebugCurvePrefixHandlers(prefix) {
  if (prefix === "mqtt") {
    return {
      readForm: readMqttConfigForm,
      populateForm: populateMqttConfigForm,
      updateDraft: updateMqttDraftConfig,
      defaults: DEFAULT_MQTT_CONFIG,
      normalize: normalizeMqttConfig,
      assign: (config) => {
        mqttConfig = config;
      },
    };
  }

  if (prefix === "websocket") {
    return {
      readForm: readWebsocketConfigForm,
      populateForm: populateWebsocketConfigForm,
      updateDraft: updateWebSocketDraftConfig,
      defaults: DEFAULT_WEBSOCKET_CONFIG,
      normalize: normalizeWebSocketConfig,
      assign: (config) => {
        websocketConfig = config;
      },
    };
  }

  if (prefix === "modbus") {
    return {
      readForm: readModbusConfigForm,
      populateForm: populateModbusConfigForm,
      updateDraft: updateModbusDraftConfig,
      defaults: DEFAULT_MODBUS_CONFIG,
      normalize: normalizeModbusConfig,
      assign: (config) => {
        modbusConfig = config;
      },
    };
  }

  return {
    readForm: readCustomConfigForm,
    populateForm: populateCustomConfigForm,
    updateDraft: updateCustomDraftConfig,
    defaults: DEFAULT_CUSTOM_CONFIG,
    normalize: normalizeCustomConfig,
    assign: (config) => {
      customConfig = config;
    },
  };
}

function handleRemoveDebugCurve(prefix, slotNumber) {
  const handlers = getDebugCurvePrefixHandlers(prefix);
  const config = handlers.readForm();
  const nextConfig = removeMultiCurveSlot(config, slotNumber, handlers.defaults);
  handlers.assign(handlers.normalize(nextConfig));
  handlers.populateForm(handlers.normalize(nextConfig));
  handlers.updateDraft();
}

function handleAddDebugCurve(prefix) {
  const handlers = getDebugCurvePrefixHandlers(prefix);
  const config = handlers.readForm();

  if (config.curveSlotCount >= JSON_CURVE_SLOTS.length) {
    return;
  }

  const nextSlot = JSON_CURVE_SLOTS[config.curveSlotCount];
  if (!nextSlot) {
    return;
  }

  const nextConfig = {
    ...config,
    curveSlotCount: config.curveSlotCount + 1,
    [nextSlot.enabledKey]: true,
  };

  handlers.assign(handlers.normalize(nextConfig));
  handlers.populateForm(handlers.normalize(nextConfig));
  handlers.updateDraft();
}

function bindDebugCurveConfigActions(prefix) {
  const field = elements[`${prefix}CurveConfigBlock`];
  if (!field || field.dataset.curveActionsBound === "true") {
    return;
  }

  field.dataset.curveActionsBound = "true";
  field.addEventListener("click", (event) => {
    const removeButton = event.target.closest("[data-remove-curve-slot]");
    if (!removeButton) {
      return;
    }

    const slotNumber = Number(removeButton.dataset.removeCurveSlot);
    if (!Number.isFinite(slotNumber)) {
      return;
    }

    handleRemoveDebugCurve(prefix, slotNumber);
  });
}

function populateWebsocketConfigForm(config = websocketConfig) {
  const normalized = normalizeWebSocketConfig(config);
  if (elements.websocketPollIntervalMs) {
    elements.websocketPollIntervalMs.value = String(normalized.pollIntervalMs);
  }
  if (elements.websocketHeartbeatFormat) {
    elements.websocketHeartbeatFormat.value = normalized.heartbeatFormat;
  }
  if (elements.websocketHeartbeatMessage) {
    elements.websocketHeartbeatMessage.value = normalized.heartbeatMessage;
  }
  if (elements.websocketParserMode) {
    elements.websocketParserMode.value = normalized.parserMode;
  }
  if (elements.websocketCurve1Enabled) {
    elements.websocketCurve1Enabled.checked = normalized.curve1Enabled;
  }
  if (elements.websocketParserFieldPath) {
    elements.websocketParserFieldPath.value = normalized.parserFieldPath;
  }
  if (elements.websocketCurve2Enabled) {
    elements.websocketCurve2Enabled.checked = normalized.curve2Enabled;
  }
  if (elements.websocketCurve2FieldName) {
    elements.websocketCurve2FieldName.value = normalized.curve2FieldName;
  }
  if (elements.websocketCurve2FieldPath) {
    elements.websocketCurve2FieldPath.value = normalized.curve2FieldPath;
  }
  if (elements.websocketCurve2Unit) {
    elements.websocketCurve2Unit.value = normalized.curve2Unit;
  }
  if (elements.websocketCurve3Enabled) {
    elements.websocketCurve3Enabled.checked = normalized.curve3Enabled;
  }
  if (elements.websocketCurve3FieldName) {
    elements.websocketCurve3FieldName.value = normalized.curve3FieldName;
  }
  if (elements.websocketCurve3FieldPath) {
    elements.websocketCurve3FieldPath.value = normalized.curve3FieldPath;
  }
  if (elements.websocketCurve3Unit) {
    elements.websocketCurve3Unit.value = normalized.curve3Unit;
  }
  if (elements.websocketCurve4Enabled) {
    elements.websocketCurve4Enabled.checked = normalized.curve4Enabled;
  }
  if (elements.websocketCurve4FieldName) {
    elements.websocketCurve4FieldName.value = normalized.curve4FieldName;
  }
  if (elements.websocketCurve4FieldPath) {
    elements.websocketCurve4FieldPath.value = normalized.curve4FieldPath;
  }
  if (elements.websocketCurve4Unit) {
    elements.websocketCurve4Unit.value = normalized.curve4Unit;
  }
  if (elements.websocketFieldName) {
    elements.websocketFieldName.value = normalized.fieldName;
  }
  if (elements.websocketUnit) {
    elements.websocketUnit.value = normalized.unit;
  }
  populateBinaryCurveFormValues("websocket", normalized, elements);
  populateFramingFormValues("websocket", normalized, elements);
  updateWebSocketParserConfigUi(normalized);
  syncDebugCurveConfigRows("websocket", normalized);
  updateWebSocketDebuggerUi();
}

function readWebsocketConfigForm() {
  return normalizeWebSocketConfig({
    pollIntervalMs: elements.websocketPollIntervalMs?.value,
    heartbeatFormat: elements.websocketHeartbeatFormat?.value,
    heartbeatMessage: elements.websocketHeartbeatMessage?.value,
    parserMode: elements.websocketParserMode?.value,
    curve1Enabled: elements.websocketCurve1Enabled?.checked,
    parserFieldPath: elements.websocketParserFieldPath?.value,
    curve2Enabled: elements.websocketCurve2Enabled?.checked,
    curve2FieldName: elements.websocketCurve2FieldName?.value,
    curve2FieldPath: elements.websocketCurve2FieldPath?.value,
    curve2Unit: elements.websocketCurve2Unit?.value,
    curve3Enabled: elements.websocketCurve3Enabled?.checked,
    curve3FieldName: elements.websocketCurve3FieldName?.value,
    curve3FieldPath: elements.websocketCurve3FieldPath?.value,
    curve3Unit: elements.websocketCurve3Unit?.value,
    curve4Enabled: elements.websocketCurve4Enabled?.checked,
    curve4FieldName: elements.websocketCurve4FieldName?.value,
    curve4FieldPath: elements.websocketCurve4FieldPath?.value,
    curve4Unit: elements.websocketCurve4Unit?.value,
    fieldName: elements.websocketFieldName?.value,
    unit: elements.websocketUnit?.value,
    ...readBinaryCurveFormValues("websocket", elements),
    ...readFramingFormValues("websocket", elements),
  });
}

function updateWebSocketParserConfigUi(config = websocketConfig) {
  const normalized = normalizeWebSocketConfig(config);
  syncDebugCurveModeFields("websocket", normalized.parserMode, elements, normalized);
  syncChartCurvePanelUi();
}

function getWebsocketConfigControls() {
  return [
    elements.websocketPollIntervalMs,
    elements.websocketHeartbeatFormat,
    elements.websocketHeartbeatMessage,
    elements.websocketParserMode,
    elements.websocketCurve1Enabled,
    elements.websocketParserFieldPath,
    elements.websocketCurve2Enabled,
    elements.websocketCurve2FieldName,
    elements.websocketCurve2FieldPath,
    elements.websocketCurve2Unit,
    elements.websocketCurve3Enabled,
    elements.websocketCurve3FieldName,
    elements.websocketCurve3FieldPath,
    elements.websocketCurve3Unit,
    elements.websocketCurve4Enabled,
    elements.websocketCurve4FieldName,
    elements.websocketCurve4FieldPath,
    elements.websocketCurve4Unit,
    elements.websocketFieldName,
    elements.websocketUnit,
    ...listBinaryCurveControlElements("websocket", elements),
    elements.websocketFrameMode,
    elements.websocketRxLineEnding,
    elements.websocketFramePrefixHex,
    elements.websocketFrameSuffixHex,
    elements.websocketFrameCrcMode,
  ];
}

function renderWebSocketQuickSends() {
  if (!elements.wsQuickSendGrid) {
    return;
  }

  renderDebugTemplateCards(elements.wsQuickSendGrid, WEBSOCKET_QUICK_MESSAGES, {
    sendAttribute: "data-ws-quick-send",
    loadAttribute: "data-ws-load-preset",
    connected: Boolean(session?.connected),
  });
}

async function sendWebSocketQuickMessage(preset) {
  if (!session?.connected) {
    throw new Error(i18n("common.connectFirst.ws"));
  }

  const payload = buildWebSocketMessage(preset.format, preset.message, { parseHexPayload });
  await session.write(payload);
}

function readWebsocketHeartbeatPreset() {
  const normalized = normalizeWebSocketConfig(websocketConfig);
  return {
    id: "websocket-heartbeat",
    label: i18n("ws.pollMessage"),
    format: normalized.heartbeatFormat,
    message: normalized.heartbeatMessage,
  };
}

function resetWebSocketMessageStats() {
  websocketMessageStats = { rx: 0, tx: 0 };
  updateWebSocketMessageStatsUi();
}

function updateWebSocketMessageStatsUi() {
  if (elements.websocketRxCount) {
    elements.websocketRxCount.textContent = String(websocketMessageStats.rx);
  }
  if (elements.websocketTxCount) {
    elements.websocketTxCount.textContent = String(websocketMessageStats.tx);
  }
  if (elements.websocketEndpoint) {
    elements.websocketEndpoint.textContent = readCurrentTransportField("url") || "—";
  }
}

function updateWebSocketDebuggerUi() {
  updateWebSocketMessageStatsUi();
  updatePayloadPreview(
    elements.websocketHeartbeatPreview,
    normalizeWebSocketConfig(websocketConfig).heartbeatFormat,
    normalizeWebSocketConfig(websocketConfig).heartbeatMessage,
    buildWebSocketMessage,
  );
}

function readMqttWriteOptions() {
  return getMqttPublishOptions(mqttConfig, readTransportOptions().publishTopic);
}

function resetMqttMessageStats() {
  mqttMessageStats = { rx: 0, tx: 0 };
  updateMqttMessageStatsUi();
}

function updateMqttMessageStatsUi() {
  if (elements.mqttRxCount) {
    elements.mqttRxCount.textContent = String(mqttMessageStats.rx);
  }
  if (elements.mqttTxCount) {
    elements.mqttTxCount.textContent = String(mqttMessageStats.tx);
  }
  if (elements.mqttSubscribeTopic) {
    const topic = session?.connected ? readTransportOptions().subscribeTopic : "—";
    elements.mqttSubscribeTopic.textContent = topic || "—";
  }
  if (elements.mqttEffectivePublishTopic) {
    const options = readMqttWriteOptions();
    elements.mqttEffectivePublishTopic.textContent = options.topic || "—";
  }
  if (elements.mqttPublishMode) {
    const options = readMqttWriteOptions();
    elements.mqttPublishMode.textContent = `QoS ${options.qos}${options.retain ? " · retain" : ""}`;
  }
}

function updateMqttPolling() {
  stopMqttPolling();

  const normalized = normalizeMqttConfig(mqttConfig);
  if (state.deviceId !== MQTT_DEVICE_ID || !session?.connected || !state.pollingActive) {
    return;
  }

  if (normalized.pollIntervalMs <= 0 || !normalized.heartbeatMessage.trim()) {
    return;
  }

  mqttPollTimer = window.setInterval(() => {
    sendDeviceCommand().catch((error) => appendLog("error", "MQTT", error.message));
  }, normalized.pollIntervalMs);
}

function updateMqttDraftConfig() {
  mqttConfig = readMqttConfigForm();
  updateMqttParserConfigUi(mqttConfig);
  updateDeviceUi();
  if (state.pollingActive && !canCurrentDevicePoll()) {
    state.pollingActive = false;
  }
  updateActivePolling();
}

function saveMqttConfig() {
  mqttConfig = readMqttConfigForm();
  localStorage.setItem(MQTT_CONFIG_STORAGE_KEY, JSON.stringify(mqttConfig));
  populateMqttConfigForm(mqttConfig);
  updateDeviceUi();
  updateActivePolling();
  appendLog("info", i18n("log.device"), `${i18n("device.mqtt")}${i18n("common.configSavedShort")}`);
}

function resetMqttConfig() {
  mqttConfig = normalizeMqttConfig(DEFAULT_MQTT_CONFIG);
  localStorage.setItem(MQTT_CONFIG_STORAGE_KEY, JSON.stringify(mqttConfig));
  populateMqttConfigForm(mqttConfig);
  updateDeviceUi();
  updateActivePolling();
  appendLog("info", i18n("log.device"), `${i18n("device.mqtt")}${i18n("common.configResetShort")}`);
}

function loadMqttConfig() {
  try {
    const saved = localStorage.getItem(MQTT_CONFIG_STORAGE_KEY);
    return normalizeMqttConfig(saved ? JSON.parse(saved) : DEFAULT_MQTT_CONFIG);
  } catch {
    return normalizeMqttConfig(DEFAULT_MQTT_CONFIG);
  }
}

function populateMqttConfigForm(config = mqttConfig) {
  const normalized = normalizeMqttConfig(config);
  if (elements.mqttPollIntervalMs) {
    elements.mqttPollIntervalMs.value = String(normalized.pollIntervalMs);
  }
  if (elements.mqttHeartbeatFormat) {
    elements.mqttHeartbeatFormat.value = normalized.heartbeatFormat;
  }
  if (elements.mqttHeartbeatMessage) {
    elements.mqttHeartbeatMessage.value = normalized.heartbeatMessage;
  }
  if (elements.mqttParserMode) {
    elements.mqttParserMode.value = normalized.parserMode;
  }
  if (elements.mqttCurve1Enabled) {
    elements.mqttCurve1Enabled.checked = normalized.curve1Enabled;
  }
  if (elements.mqttParserFieldPath) {
    elements.mqttParserFieldPath.value = normalized.parserFieldPath;
  }
  if (elements.mqttCurve2Enabled) {
    elements.mqttCurve2Enabled.checked = normalized.curve2Enabled;
  }
  if (elements.mqttCurve2FieldName) {
    elements.mqttCurve2FieldName.value = normalized.curve2FieldName;
  }
  if (elements.mqttCurve2FieldPath) {
    elements.mqttCurve2FieldPath.value = normalized.curve2FieldPath;
  }
  if (elements.mqttCurve2Unit) {
    elements.mqttCurve2Unit.value = normalized.curve2Unit;
  }
  if (elements.mqttCurve3Enabled) {
    elements.mqttCurve3Enabled.checked = normalized.curve3Enabled;
  }
  if (elements.mqttCurve3FieldName) {
    elements.mqttCurve3FieldName.value = normalized.curve3FieldName;
  }
  if (elements.mqttCurve3FieldPath) {
    elements.mqttCurve3FieldPath.value = normalized.curve3FieldPath;
  }
  if (elements.mqttCurve3Unit) {
    elements.mqttCurve3Unit.value = normalized.curve3Unit;
  }
  if (elements.mqttCurve4Enabled) {
    elements.mqttCurve4Enabled.checked = normalized.curve4Enabled;
  }
  if (elements.mqttCurve4FieldName) {
    elements.mqttCurve4FieldName.value = normalized.curve4FieldName;
  }
  if (elements.mqttCurve4FieldPath) {
    elements.mqttCurve4FieldPath.value = normalized.curve4FieldPath;
  }
  if (elements.mqttCurve4Unit) {
    elements.mqttCurve4Unit.value = normalized.curve4Unit;
  }
  if (elements.mqttFieldName) {
    elements.mqttFieldName.value = normalized.fieldName;
  }
  if (elements.mqttUnit) {
    elements.mqttUnit.value = normalized.unit;
  }
  populateBinaryCurveFormValues("mqtt", normalized, elements);
  populateFramingFormValues("mqtt", normalized, elements);
  if (elements.mqttPublishTopic) {
    elements.mqttPublishTopic.value = normalized.publishTopic;
  }
  if (elements.mqttPublishQos) {
    elements.mqttPublishQos.value = String(normalized.publishQos);
  }
  if (elements.mqttPublishRetain) {
    elements.mqttPublishRetain.checked = normalized.publishRetain;
  }
  updateMqttParserConfigUi(normalized);
  syncDebugCurveConfigRows("mqtt", normalized);
  updateMqttDebuggerUi();
}

function readMqttConfigForm() {
  return normalizeMqttConfig({
    pollIntervalMs: elements.mqttPollIntervalMs?.value,
    heartbeatFormat: elements.mqttHeartbeatFormat?.value,
    heartbeatMessage: elements.mqttHeartbeatMessage?.value,
    parserMode: elements.mqttParserMode?.value,
    curve1Enabled: elements.mqttCurve1Enabled?.checked,
    parserFieldPath: elements.mqttParserFieldPath?.value,
    curve2Enabled: elements.mqttCurve2Enabled?.checked,
    curve2FieldName: elements.mqttCurve2FieldName?.value,
    curve2FieldPath: elements.mqttCurve2FieldPath?.value,
    curve2Unit: elements.mqttCurve2Unit?.value,
    curve3Enabled: elements.mqttCurve3Enabled?.checked,
    curve3FieldName: elements.mqttCurve3FieldName?.value,
    curve3FieldPath: elements.mqttCurve3FieldPath?.value,
    curve3Unit: elements.mqttCurve3Unit?.value,
    curve4Enabled: elements.mqttCurve4Enabled?.checked,
    curve4FieldName: elements.mqttCurve4FieldName?.value,
    curve4FieldPath: elements.mqttCurve4FieldPath?.value,
    curve4Unit: elements.mqttCurve4Unit?.value,
    fieldName: elements.mqttFieldName?.value,
    unit: elements.mqttUnit?.value,
    ...readBinaryCurveFormValues("mqtt", elements),
    ...readFramingFormValues("mqtt", elements),
    publishTopic: elements.mqttPublishTopic?.value,
    publishQos: elements.mqttPublishQos?.value,
    publishRetain: elements.mqttPublishRetain?.checked,
  });
}

function updateMqttParserConfigUi(config = mqttConfig) {
  const normalized = normalizeMqttConfig(config);
  syncDebugCurveModeFields("mqtt", normalized.parserMode, elements, normalized);
  syncChartCurvePanelUi();
}

function getMqttConfigControls() {
  return [
    elements.mqttPollIntervalMs,
    elements.mqttHeartbeatFormat,
    elements.mqttHeartbeatMessage,
    elements.mqttParserMode,
    elements.mqttCurve1Enabled,
    elements.mqttParserFieldPath,
    elements.mqttCurve2Enabled,
    elements.mqttCurve2FieldName,
    elements.mqttCurve2FieldPath,
    elements.mqttCurve2Unit,
    elements.mqttCurve3Enabled,
    elements.mqttCurve3FieldName,
    elements.mqttCurve3FieldPath,
    elements.mqttCurve3Unit,
    elements.mqttCurve4Enabled,
    elements.mqttCurve4FieldName,
    elements.mqttCurve4FieldPath,
    elements.mqttCurve4Unit,
    elements.mqttFieldName,
    elements.mqttUnit,
    ...listBinaryCurveControlElements("mqtt", elements),
    elements.mqttFrameMode,
    elements.mqttRxLineEnding,
    elements.mqttFramePrefixHex,
    elements.mqttFrameSuffixHex,
    elements.mqttFrameCrcMode,
    elements.mqttPublishTopic,
    elements.mqttPublishQos,
    elements.mqttPublishRetain,
  ];
}

function renderMqttQuickSends() {
  if (!elements.mqttQuickSendGrid) {
    return;
  }

  renderDebugTemplateCards(elements.mqttQuickSendGrid, MQTT_QUICK_MESSAGES, {
    sendAttribute: "data-mqtt-quick-send",
    loadAttribute: "data-mqtt-load-preset",
    connected: Boolean(session?.connected),
  });
}

async function sendMqttQuickMessage(preset) {
  if (!session?.connected) {
    throw new Error(i18n("common.connectFirst.mqtt"));
  }

  const payload = buildMqttMessage(preset.format, preset.message, { parseHexPayload });
  await session.write(payload, readMqttWriteOptions());
}

function readMqttHeartbeatPreset() {
  const normalized = normalizeMqttConfig(mqttConfig);
  return {
    id: "mqtt-heartbeat",
    label: i18n("mqtt.pollMessage"),
    format: normalized.heartbeatFormat,
    message: normalized.heartbeatMessage,
  };
}

function updateMqttDebuggerUi() {
  updateMqttMessageStatsUi();

  const options = readMqttWriteOptions();
  if (elements.mqttPublishPreview) {
    elements.mqttPublishPreview.textContent = `${options.topic || i18n("common.notConfigured")} · QoS ${options.qos}${options.retain ? " · retain" : ""}`;
  }

  const normalized = normalizeMqttConfig(mqttConfig);
  updatePayloadPreview(elements.mqttHeartbeatPreview, normalized.heartbeatFormat, normalized.heartbeatMessage, buildMqttMessage);
}

function renderDebugTemplateCards(container, presets, options) {
  container.innerHTML = "";
  presets.forEach((preset) => {
    const card = document.createElement("article");
    card.className = "debug-template-card";

    const header = document.createElement("div");
    header.className = "debug-template-heading";

    const title = document.createElement("strong");
    title.textContent = preset.label;

    const format = document.createElement("span");
    format.textContent = preset.format.toUpperCase();

    const preview = document.createElement("code");
    preview.textContent = preset.message;

    const actions = document.createElement("div");
    actions.className = "debug-template-actions";

    const loadButton = document.createElement("button");
    loadButton.type = "button";
    loadButton.className = "ghost-button";
    loadButton.setAttribute(options.loadAttribute, preset.id);
    loadButton.textContent = i18n("common.fill");

    const sendButton = document.createElement("button");
    sendButton.type = "button";
    sendButton.setAttribute(options.sendAttribute, preset.id);
    sendButton.textContent = i18n("workbench.send");
    sendButton.disabled = !options.connected;

    header.append(title, format);
    actions.append(loadButton, sendButton);
    card.append(header, preview, actions);
    container.append(card);
  });
}

function loadMessageIntoManualSender(preset) {
  if (elements.sendFormat) {
    elements.sendFormat.value = preset.format;
  }
  if (elements.lineEnding) {
    elements.lineEnding.value = "";
  }
  if (elements.manualCommand) {
    elements.manualCommand.value = preset.message;
    elements.manualCommand.focus();
  }
}

function updatePayloadPreview(target, format, message, builder) {
  if (!target) {
    return;
  }

  try {
    const payload = builder(format, message, { parseHexPayload });
    target.textContent = typeof payload === "string" ? payload : bytesToHex(payload);
    target.classList.remove("error");
  } catch (error) {
    target.textContent = error.message;
    target.classList.add("error");
  }
}

const PARSER_TEST_SPECS = {
  [CUSTOM_DEVICE_ID]: {
    readForm: () => {
      customConfig = readCustomConfigForm();
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
      modbusConfig = readModbusConfigForm();
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
      websocketConfig = readWebsocketConfigForm();
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
      mqttConfig = readMqttConfigForm();
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

function readCurrentTransportField(key) {
  try {
    return String(readTransportOptions()[key] ?? "").trim();
  } catch {
    return "";
  }
}

function updateModbusDraftConfig() {
  modbusConfig = readModbusConfigForm();
  syncDebugCurveConfigRows("modbus", modbusConfig);
  syncChartCurvePanelUi();

  if (state.deviceId === MODBUS_DEVICE_ID) {
    const normalized = normalizeModbusConfig(modbusConfig);
    state.mode = getModbusMode(normalized.functionCode);
    const config = getModeConfig(state.mode, state.deviceId, customConfig, modbusConfig);
    state.setpoint = Math.min(config.max, Math.max(config.min, state.setpoint));
    resetModbusRxBuffer();
  }

  updateDeviceUi();
  if (state.pollingActive && !canCurrentDevicePoll()) {
    state.pollingActive = false;
  }
  updateActivePolling();
}

function saveModbusConfig() {
  modbusConfig = readModbusConfigForm();
  localStorage.setItem(MODBUS_CONFIG_STORAGE_KEY, JSON.stringify(modbusConfig));
  populateModbusConfigForm(modbusConfig);
  updateDeviceUi();
  updateActivePolling();
  appendLog("info", i18n("log.device"), `${i18n("device.modbus")}${i18n("common.configSavedShort")}`);
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
  updateActivePolling();
  appendLog("info", i18n("log.device"), `${i18n("device.modbus")}${i18n("common.configResetShort")}`);
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
    pollIntervalMs: elements.modbusPollIntervalMs.value,
    ...readDebugCurveConfigForm("modbus", elements),
  });
}

function populateModbusConfigForm(config) {
  const normalized = normalizeModbusConfig(config);
  elements.modbusSlaveId.value = String(normalized.slaveId);
  elements.modbusFunctionCode.value = String(normalized.functionCode);
  elements.modbusAddress.value = String(normalized.address);
  elements.modbusQuantity.value = String(normalized.quantity);
  elements.modbusPollIntervalMs.value = String(normalized.pollIntervalMs);
  populateDebugCurveConfigForm("modbus", normalized, elements);
  syncDebugCurveConfigRows("modbus", normalized);
  if (elements.modbusParserPreview) {
    elements.modbusParserPreview.textContent = i18n("curve.waitingTest");
  }
}

function getModbusConfigControls() {
  return [
    elements.modbusSlaveId,
    elements.modbusFunctionCode,
    elements.modbusAddress,
    elements.modbusQuantity,
    elements.modbusPollIntervalMs,
    ...listDebugCurveControlElements("modbus", elements),
  ];
}

function updateHartPolling() {
  stopHartPolling();

  const normalized = normalizeHartConfig(hartConfig);
  if (state.deviceId !== HART_DEVICE_ID || !session?.connected || !state.pollingActive) {
    return;
  }

  if (normalized.pollIntervalMs <= 0) {
    return;
  }

  hartPollTimer = window.setInterval(() => {
    sendHartPollCommand().catch((error) => appendLog("error", "HART", error.message));
  }, normalized.pollIntervalMs);
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
  hartConfig = readHartConfigForm();
  syncHartCommandModeUi(hartConfig);
  renderHartStandardCommandFields(hartConfig);

  if (state.deviceId === HART_DEVICE_ID) {
    const normalized = normalizeHartConfig(hartConfig);
    state.mode = getHartMode(normalized.activeCommand);
    const config = getModeConfig(state.mode, state.deviceId, customConfig, modbusConfig);
    state.setpoint = Math.min(config.max, Math.max(config.min, state.setpoint));
    resetHartRxBuffer();
  }

  updateDeviceUi();
  if (state.pollingActive && !canCurrentDevicePoll()) {
    state.pollingActive = false;
  }
  updateActivePolling();
}

function saveHartConfig() {
  hartConfig = readHartConfigForm();
  localStorage.setItem(HART_CONFIG_STORAGE_KEY, JSON.stringify(hartConfig));
  populateHartConfigForm(hartConfig);
  updateDeviceUi();
  updateActivePolling();
  appendLog("info", i18n("log.device"), `${i18n("device.hart")}${i18n("common.configSavedShort")}`);
}

function resetHartConfig() {
  hartConfig = resetHartDeviceState(DEFAULT_HART_CONFIG);
  localStorage.setItem(HART_CONFIG_STORAGE_KEY, JSON.stringify(hartConfig));
  populateHartConfigForm(hartConfig);
  resetHartRxBuffer();

  if (state.deviceId === HART_DEVICE_ID) {
    state.mode = getHartMode(normalizeHartConfig(hartConfig).activeCommand);
    state.setpoint = getModeConfig(state.mode, state.deviceId, customConfig, modbusConfig).presets.mid;
  }

  updateDeviceUi();
  updateActivePolling();
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

function switchHartWorkspace(workspace) {
  const next = ["general", "settings", "calibration"].includes(workspace) ? workspace : "general";
  hartWorkspace = next;
  document.querySelector("#hartPage")?.classList.toggle("hart-workspace-expanded", next !== "general");
  elements.hartWorkspaceTabs.forEach((button) => {
    const active = button.dataset.hartWorkspaceTab === next;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });
  elements.hartWorkspacePanels.forEach((panel) => {
    panel.hidden = panel.dataset.hartWorkspacePanel !== next;
  });
}

function populateHartWorkspaceControls(config = hartConfig) {
  const normalized = normalizeHartConfig(config);
  const unitSelect = elements.hartSettingsUnit;
  if (unitSelect && unitSelect.options.length === 0) {
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = i18n("hart.selectUnit");
    placeholder.disabled = true;
    placeholder.selected = true;
    unitSelect.append(placeholder);
    const unitField = getHartStandardRequestFields(35).find((entry) => entry.key === "unit_code");
    unitField?.options.forEach((entry) => {
      const option = document.createElement("option");
      option.value = entry.value;
      option.textContent = entry.label;
      unitSelect.append(option);
    });
  }
  if (elements.hartSettingsDate && !elements.hartSettingsDate.value) {
    elements.hartSettingsDate.value = new Date().toISOString().slice(0, 10);
  }
  if (elements.hartSettingsPollAddress && !elements.hartSettingsPollAddress.dataset.initialized) {
    elements.hartSettingsPollAddress.value = String(normalized.pollAddress);
    elements.hartSettingsPollAddress.dataset.initialized = "true";
  }
  switchHartWorkspace(hartWorkspace);
  updateHartWorkspaceUi();
}

function updateHartWorkspaceUi() {
  const connected = Boolean(session?.connected);
  elements.hartWorkspaceActions.forEach((button) => {
    const action = button.dataset.hartWorkspaceAction;
    let enabled = connected && !hartAddressScanActive;
    if (action === "trim-low-pv") {
      enabled = enabled && [1, 3].includes(hartCalibrationState.guidelines?.supportedTrimPoints);
    }
    if (action === "trim-high-pv") {
      enabled = enabled && [2, 3].includes(hartCalibrationState.guidelines?.supportedTrimPoints);
    }
    button.disabled = !enabled;
  });
}

function setHartWorkspaceStatus(element, text, stateName = "info") {
  if (!element) return;
  element.textContent = text || i18n("hart.workspace.ready");
  element.dataset.state = stateName;
}

function readHartWorkspaceNumber(element, label, minimum = -Infinity, maximum = Infinity) {
  const value = Number(element?.value);
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    throw new Error(`${label}${i18n("hart.input.range").replace("{min}", minimum).replace("{max}", maximum)}`);
  }
  return String(value);
}

async function sendHartWorkspaceCommand(command, values = {}, statusElement = null) {
  if (!session?.connected) throw new Error(i18n("hart.workspace.connectFirst"));
  if (command !== 0 && !normalizeHartConfig(hartConfig).device.discovered) {
    throw new Error(i18n("hart.searchFirst"));
  }

  if (command === 0) {
    setHartWorkspaceStatus(statusElement, i18n("hart.workspace.sending").replace("{command}", "0"));
    await sendHartSearchCommand();
    return;
  }

  const commandKey = String(command);
  const current = readHartConfigForm();
  hartConfig = normalizeHartConfig({
    ...current,
    commandMode: "preset",
    command,
    standardCommandValues: {
      ...current.standardCommandValues,
      [commandKey]: Object.fromEntries(Object.entries(values).map(([key, value]) => [key, String(value)])),
    },
  });
  populateHartConfigForm(hartConfig);
  updateDeviceUi();
  setHartWorkspaceStatus(statusElement, i18n("hart.workspace.sending").replace("{command}", String(command)));
  await sendDeviceCommand();
}

async function handleHartWorkspaceAction(action) {
  const settingsStatus = elements.hartSettingsStatus;
  const calibrationStatus = elements.hartCalibrationStatus;
  switch (action) {
    case "read-identity":
      return sendHartWorkspaceCommand(0, {}, settingsStatus);
    case "read-sensor":
      return sendHartWorkspaceCommand(14, {}, elements.hartSettingsMeasurementStatus);
    case "read-config":
      return sendHartWorkspaceCommand(15, {}, elements.hartSettingsMeasurementStatus);
    case "write-unit":
      return sendHartWorkspaceCommand(44, { unit_code: elements.hartSettingsUnit?.value }, settingsStatus);
    case "write-range":
      return sendHartWorkspaceCommand(
        35,
        {
          unit_code: elements.hartSettingsUnit?.value,
          upper_range: readHartWorkspaceNumber(elements.hartSettingsUpperRange, i18n("hart.input.upperRange")),
          lower_range: readHartWorkspaceNumber(elements.hartSettingsLowerRange, i18n("hart.input.lowerRange")),
        },
        settingsStatus,
      );
    case "write-damping":
      return sendHartWorkspaceCommand(
        34,
        { damping_seconds: readHartWorkspaceNumber(elements.hartSettingsDamping, i18n("hart.input.dampingSeconds"), 0) },
        settingsStatus,
      );
    case "write-transfer":
      return sendHartWorkspaceCommand(47, { transfer_function: elements.hartSettingsTransferFunction?.value }, settingsStatus);
    case "read-message":
      return sendHartWorkspaceCommand(12, {}, settingsStatus);
    case "write-message":
      return sendHartWorkspaceCommand(17, { message: elements.hartSettingsMessage?.value ?? "" }, settingsStatus);
    case "read-tag":
      return sendHartWorkspaceCommand(13, {}, settingsStatus);
    case "write-tag":
      return sendHartWorkspaceCommand(
        18,
        {
          tag: elements.hartSettingsTag?.value ?? "",
          descriptor: elements.hartSettingsDescriptor?.value ?? "",
          date: elements.hartSettingsDate?.value ?? "",
        },
        settingsStatus,
      );
    case "read-assembly":
      return sendHartWorkspaceCommand(16, {}, settingsStatus);
    case "write-assembly":
      return sendHartWorkspaceCommand(
        19,
        { final_assembly_number: readHartWorkspaceNumber(elements.hartSettingsAssembly, i18n("hart.input.finalAssemblyNumber"), 0, 0xffffff) },
        settingsStatus,
      );
    case "write-address":
      return sendHartWorkspaceCommand(
        6,
        {
          polling_address: readHartWorkspaceNumber(elements.hartSettingsPollAddress, i18n("hart.input.pollAddress"), 0, 63),
          loop_current_mode: elements.hartSettingsLoopMode?.value ?? "1",
        },
        settingsStatus,
      );
    case "read-burst":
      return sendHartWorkspaceCommand(105, { burst_message: elements.hartSettingsBurstMessage?.value ?? "0" }, settingsStatus);
    case "write-burst":
      return sendHartWorkspaceCommand(
        108,
        {
          burst_command: elements.hartSettingsBurstCommand?.value ?? "1",
          burst_message: elements.hartSettingsBurstMessage?.value ?? "0",
        },
        settingsStatus,
      );
    case "enable-burst":
    case "disable-burst":
      return sendHartWorkspaceCommand(
        109,
        {
          burst_control: action === "enable-burst" ? "1" : "0",
          burst_message: elements.hartSettingsBurstMessage?.value ?? "0",
        },
        settingsStatus,
      );
    case "fixed-preset":
      return sendHartWorkspaceCommand(40, { fixed_current: elements.hartCalibrationPresetCurrent?.value ?? "4" }, calibrationStatus);
    case "fixed-custom":
      return sendHartWorkspaceCommand(
        40,
        { fixed_current: readHartWorkspaceNumber(elements.hartCalibrationCustomCurrent, i18n("hart.calibration.customCurrent"), 0, 30) },
        calibrationStatus,
      );
    case "fixed-exit":
      return sendHartWorkspaceCommand(40, { fixed_current: "0" }, calibrationStatus);
    case "output-low":
      return sendHartWorkspaceCommand(40, { fixed_current: "4" }, calibrationStatus);
    case "output-high":
      return sendHartWorkspaceCommand(40, { fixed_current: "20" }, calibrationStatus);
    case "trim-low-current":
      return sendHartWorkspaceCommand(
        45,
        { measured_current: readHartWorkspaceNumber(elements.hartCalibrationLowCurrent, i18n("hart.input.measuredCurrent"), 0, 30) },
        calibrationStatus,
      );
    case "trim-high-current":
      return sendHartWorkspaceCommand(
        46,
        { measured_current: readHartWorkspaceNumber(elements.hartCalibrationHighCurrent, i18n("hart.input.measuredCurrent"), 0, 30) },
        calibrationStatus,
      );
    case "pv-zero":
      return sendHartWorkspaceCommand(43, {}, calibrationStatus);
    case "read-trim-guidelines":
      hartCalibrationState = { awaitingGuidelines: true, deviceVariable: null, guidelines: null };
      updateHartWorkspaceUi();
      setHartWorkspaceStatus(elements.hartCalibrationGuidelines, i18n("hart.calibration.readingMapping"));
      return sendHartWorkspaceCommand(50, {}, calibrationStatus);
    case "trim-low-pv":
    case "trim-high-pv": {
      const guidelines = hartCalibrationState.guidelines;
      if (!guidelines) throw new Error(i18n("hart.calibration.readGuidelinesFirst"));
      const upper = action === "trim-high-pv";
      const editor = upper ? elements.hartCalibrationHighValue : elements.hartCalibrationLowValue;
      return sendHartWorkspaceCommand(
        82,
        {
          device_variable: guidelines.deviceVariable,
          trim_point: upper ? 2 : 1,
          unit_code: guidelines.unitCode,
          trim_value: readHartWorkspaceNumber(editor, upper ? i18n("hart.calibration.appliedHigh") : i18n("hart.calibration.appliedLow")),
        },
        calibrationStatus,
      );
    }
    default:
      return undefined;
  }
}

function updateHartWorkspaceFromDiscovery(telemetry) {
  const normalized = normalizeHartConfig(hartConfig);
  if (elements.hartSettingsPollAddress) elements.hartSettingsPollAddress.value = String(normalized.pollAddress);
  setHartWorkspaceStatus(elements.hartSettingsStatus, formatHartDeviceSummary(normalized.device), "success");
  hartCalibrationState = { awaitingGuidelines: false, deviceVariable: null, guidelines: null };
  updateHartWorkspaceUi();
}

function updateHartWorkspaceFromTelemetry(telemetry) {
  const { command, fields } = telemetry ?? {};
  if (!Number.isFinite(command)) return;
  const summary = telemetry.commandLines?.join("\n") || telemetry.commandSummary || `${i18n("hart.command")} ${command}`;

  if ([6, 12, 13, 14, 15, 16, 17, 18, 19, 34, 35, 44, 47, 105, 108, 109].includes(command)) {
    setHartWorkspaceStatus(elements.hartSettingsStatus, summary, telemetry.isError ? "error" : "success");
  }
  if ([14, 15, 34, 35, 44, 47].includes(command)) {
    setHartWorkspaceStatus(elements.hartSettingsMeasurementStatus, summary, telemetry.isError ? "error" : "success");
  }
  if (!telemetry.isError && fields) {
    if ((command === 12 || command === 17) && elements.hartSettingsMessage) elements.hartSettingsMessage.value = fields.message ?? "";
    if (command === 13 || command === 18) {
      if (elements.hartSettingsTag) elements.hartSettingsTag.value = fields.tag ?? "";
      if (elements.hartSettingsDescriptor) elements.hartSettingsDescriptor.value = fields.descriptor ?? "";
      if (elements.hartSettingsDate && fields.date) elements.hartSettingsDate.value = fields.date;
    }
    if (command === 16 && elements.hartSettingsAssembly) elements.hartSettingsAssembly.value = String(fields.assemblyNumber ?? 0);
    if (command === 6) {
      if (elements.hartSettingsPollAddress) elements.hartSettingsPollAddress.value = String(fields.pollingAddress ?? 0);
      if (elements.hartSettingsLoopMode) elements.hartSettingsLoopMode.value = String(fields.loopCurrentMode ?? 1);
    }
    if (command === 14) {
      if (elements.hartSettingsUnit) elements.hartSettingsUnit.value = String(fields.unitCode ?? "");
    }
    if (command === 15) {
      if (elements.hartSettingsUnit) elements.hartSettingsUnit.value = String(fields.unitCode ?? "");
      if (elements.hartSettingsUpperRange && Number.isFinite(fields.upper)) elements.hartSettingsUpperRange.value = String(fields.upper);
      if (elements.hartSettingsLowerRange && Number.isFinite(fields.lower)) elements.hartSettingsLowerRange.value = String(fields.lower);
      if (elements.hartSettingsDamping && Number.isFinite(fields.damping)) elements.hartSettingsDamping.value = String(fields.damping);
      if (elements.hartSettingsTransferFunction) elements.hartSettingsTransferFunction.value = String(fields.transferFunction ?? 0);
    }
  }

  if ([40, 43, 45, 46, 50, 81, 82].includes(command)) {
    setHartWorkspaceStatus(elements.hartCalibrationStatus, summary, telemetry.isError ? "error" : "success");
  }
  if (command === 50 && hartCalibrationState.awaitingGuidelines && !telemetry.isError) {
    const deviceVariable = fields?.pv;
    if (!Number.isInteger(deviceVariable) || deviceVariable >= 244) {
      hartCalibrationState.awaitingGuidelines = false;
      setHartWorkspaceStatus(elements.hartCalibrationGuidelines, i18n("hart.calibration.invalidPvMapping").replace("{code}", String(deviceVariable)), "error");
      return;
    }
    hartCalibrationState.deviceVariable = deviceVariable;
    setHartWorkspaceStatus(elements.hartCalibrationGuidelines, i18n("hart.calibration.readingGuidelines").replace("{code}", String(deviceVariable)));
    void sendHartWorkspaceCommand(81, { device_variable: deviceVariable }, elements.hartCalibrationStatus).catch((error) => {
      hartCalibrationState.awaitingGuidelines = false;
      setHartWorkspaceStatus(elements.hartCalibrationGuidelines, error.message, "error");
    });
    return;
  }
  if (command === 81) {
    hartCalibrationState.awaitingGuidelines = false;
    if (!telemetry.isError && fields) {
      hartCalibrationState.guidelines = fields;
      setHartWorkspaceStatus(elements.hartCalibrationGuidelines, summary, "success");
      if (elements.hartCalibrationLowValue && Number.isFinite(fields.minimumLower)) {
        elements.hartCalibrationLowValue.placeholder = `${fields.minimumLower}…${fields.maximumLower} ${fields.unit}`;
      }
      if (elements.hartCalibrationHighValue && Number.isFinite(fields.minimumUpper)) {
        elements.hartCalibrationHighValue.placeholder = `${fields.minimumUpper}…${fields.maximumUpper} ${fields.unit}`;
      }
    }
    updateHartWorkspaceUi();
  }
}

function syncHartCommandModeUi(config = hartConfig) {
  const normalized = normalizeHartConfig(config);
  const isCustom = normalized.commandMode === "custom";

  if (elements.hartCommandMode) {
    elements.hartCommandMode.value = normalized.commandMode;
  }
  if (elements.hartPresetCommandField) {
    elements.hartPresetCommandField.hidden = isCustom;
  }
  if (elements.hartCustomCommandField) {
    elements.hartCustomCommandField.hidden = !isCustom;
  }
  if (elements.hartCustomCommandDataField) {
    elements.hartCustomCommandDataField.hidden = !isCustom;
  }
  if (elements.hartStandardCommandSection) {
    elements.hartStandardCommandSection.hidden = isCustom;
  }
  if (elements.hartCustomCommand) {
    elements.hartCustomCommand.value = String(normalized.customCommand);
  }
}

function readHartStandardCommandValues() {
  const valuesByCommand = { ...normalizeHartConfig(hartConfig).standardCommandValues };
  const container = elements.hartStandardCommandFields;
  const renderedCommand = container?.dataset.command;
  if (!container || renderedCommand === undefined) return valuesByCommand;

  const values = { ...(valuesByCommand[renderedCommand] ?? {}) };
  container.querySelectorAll("[data-hart-command-value]").forEach((control) => {
    values[control.dataset.hartCommandValue] = control.value;
  });
  valuesByCommand[renderedCommand] = values;
  return valuesByCommand;
}

function renderHartStandardCommandFields(config = hartConfig, force = false) {
  const container = elements.hartStandardCommandFields;
  if (!container) return;

  const normalized = normalizeHartConfig(config);
  const commandKey = String(normalized.command);
  if (!force && container.dataset.command === commandKey && container.childElementCount > 0) return;

  const fields = getHartStandardRequestFields(normalized.command, {
    ...normalized.device,
    pollAddress: normalized.pollAddress,
  });
  const savedValues = normalized.standardCommandValues[commandKey] ?? {};
  container.replaceChildren();
  container.dataset.command = commandKey;

  if (fields.length === 0) {
    const empty = document.createElement("p");
    empty.className = "hart-standard-empty";
    empty.textContent = i18n("hart.noRequestValues");
    container.append(empty);
    return;
  }

  fields.forEach((definition) => {
    const label = document.createElement("label");
    const caption = document.createElement("span");
    caption.textContent = definition.label;
    label.append(caption);

    const isSelect = definition.type === "select" || definition.type === "unit-select";
    const control = document.createElement(isSelect ? "select" : "input");
    control.dataset.hartCommandValue = definition.key;
    if (isSelect) {
      if (definition.type === "unit-select") {
        const placeholder = document.createElement("option");
        placeholder.value = "";
        placeholder.textContent = i18n("hart.selectUnit");
        placeholder.disabled = true;
        control.append(placeholder);
      }
      definition.options.forEach((entry) => {
        const item = document.createElement("option");
        item.value = entry.value;
        item.textContent = entry.label;
        control.append(item);
      });
    } else {
      control.type = definition.type === "decimal-list" ? "text" : definition.type;
      if (definition.min !== undefined) control.min = String(definition.min);
      if (definition.max !== undefined) control.max = String(definition.max);
      if (definition.step !== undefined) control.step = String(definition.step);
      if (definition.maxLength !== undefined) control.maxLength = definition.maxLength;
      if (definition.type === "decimal-list") control.placeholder = "246, 247, 248, 249";
    }
    control.value = String(savedValues[definition.key] ?? definition.defaultValue ?? "");
    label.append(control);
    container.append(label);
  });
}

function populateHartCommandSelect(selectedCommand = hartConfig.command) {
  if (!elements.hartCommand) {
    return;
  }

  const normalized = normalizeHartConfig({ ...hartConfig, command: selectedCommand });
  elements.hartCommand.innerHTML = "";

  let currentGroup = null;
  HART_UNIVERSAL_COMMANDS.forEach((entry) => {
    const category = entry.category === "common" ? i18n("hart.cmdGroup.common") : i18n("hart.cmdGroup.universal");
    const direction = entry.kind === "write" ? i18n("hart.cmdGroup.write") : i18n("hart.cmdGroup.read");
    const groupName = `${category} · ${direction}`;
    if (groupName !== currentGroup) {
      currentGroup = groupName;
      const optgroup = document.createElement("optgroup");
      optgroup.label = groupName;
      elements.hartCommand.append(optgroup);
    }

    const option = document.createElement("option");
    option.value = String(entry.value);
    option.textContent = getHartCommandLabel(entry.value);
    if (entry.value === normalized.command) {
      option.selected = true;
    }
    elements.hartCommand.lastElementChild.append(option);
  });
}

function readHartChartSeriesFromControls() {
  const chartSeries = { ...normalizeHartConfig(hartConfig).chartSeries };
  elements.hartChartSeriesInputs.forEach((input) => {
    const key = input.dataset.hartSeries;
    if (key) {
      chartSeries[key] = input.checked;
    }
  });
  return chartSeries;
}

function readHartConfigForm() {
  if (!elements.hartPollAddress) {
    return normalizeHartConfig(hartConfig);
  }

  return normalizeHartConfig({
    ...hartConfig,
    pollAddress: elements.hartPollAddress.value,
    masterType: elements.hartMasterType?.value ?? hartConfig.masterType,
    pollMode: elements.hartPollMode?.value ?? hartConfig.pollMode,
    commandMode: elements.hartCommandMode?.value ?? hartConfig.commandMode,
    command: elements.hartCommand?.value ?? hartConfig.command,
    customCommand: elements.hartCustomCommand?.value ?? hartConfig.customCommand,
    customCommandData: elements.hartCustomCommandData?.value ?? "",
    standardCommandValues: readHartStandardCommandValues(),
    preambleLength: elements.hartPreambleLength.value,
    scale: elements.hartScale.value,
    offset: elements.hartOffset.value,
    fieldName: elements.hartFieldName.value,
    unit: elements.hartUnit.value,
    pollIntervalMs: elements.hartPollIntervalMs.value,
    chartSeries: readHartChartSeriesFromControls(),
  });
}

function populateHartConfigForm(config) {
  if (!elements.hartPollAddress) {
    return;
  }

  const normalized = normalizeHartConfig(config);
  populateHartCommandSelect(normalized.command);
  syncHartCommandModeUi(normalized);
  elements.hartPollAddress.value = String(normalized.pollAddress);
  if (elements.hartMasterType) {
    elements.hartMasterType.value = normalized.masterType;
  }
  if (elements.hartPollMode) {
    elements.hartPollMode.value = normalized.pollMode;
  }
  elements.hartCommand.value = String(normalized.command);
  if (elements.hartCustomCommandData) {
    elements.hartCustomCommandData.value = normalized.customCommandData;
  }
  renderHartStandardCommandFields(normalized, true);
  elements.hartPreambleLength.value = String(normalized.preambleLength);
  elements.hartScale.value = String(normalized.scale);
  elements.hartOffset.value = String(normalized.offset);
  elements.hartFieldName.value = normalized.fieldName;
  elements.hartUnit.value = normalized.unit;
  elements.hartPollIntervalMs.value = String(normalized.pollIntervalMs);
  populateHartWorkspaceControls(normalized);
  updateHartDeviceInfo();
}

function updateHartDeviceInfo() {
  if (!elements.hartDeviceInfo) {
    return;
  }

  elements.hartDeviceInfo.textContent = `${i18n("hart.devicePrefix")}${formatHartDeviceSummary(normalizeHartConfig(hartConfig).device)}`;
  updateHartLinkVersionInfo();
}

function clearHartLinkVersionProbeTimer() {
  if (hartLinkVersionProbeTimer) {
    window.clearTimeout(hartLinkVersionProbeTimer);
    hartLinkVersionProbeTimer = null;
  }
}

function updateHartLinkVersionInfo() {
  if (!elements.hartlinkVersionInfo) {
    return;
  }

  const { status, version, model } = hartLinkVersionState;
  const translationKey =
    status === "detecting"
      ? "hart.hartlinkDetecting"
      : status === "detected"
        ? "hart.hartlinkDetected"
        : status === "not-detected"
          ? "hart.hartlinkNotDetected"
          : status === "error"
            ? "hart.hartlinkProbeFailed"
            : "hart.hartlinkWaiting";

  elements.hartlinkVersionInfo.dataset.state = status;
  elements.hartlinkVersionInfo.textContent = i18n(translationKey)
    .replace("{version}", version)
    .replace("{model}", model);
}

function setHartLinkVersionState(status, details = {}) {
  hartLinkVersionState = {
    status,
    version: details.version ?? "",
    model: details.model ?? "",
  };
  updateHartLinkVersionInfo();
}

function resetHartLinkVersionProbe(status = "idle") {
  clearHartLinkVersionProbeTimer();
  hartLinkVersionResponseBuffer = "";
  setHartLinkVersionState(status);
}

function handleHartLinkVersionProbeRx(text) {
  if (hartLinkVersionState.status !== "detecting" || !isHartLinkVersionProbeChunk(text)) {
    return false;
  }

  hartLinkVersionResponseBuffer = `${hartLinkVersionResponseBuffer}${text}`.slice(
    -HARTLINK_VERSION_RESPONSE_BUFFER_LIMIT,
  );
  const detected = parseHartLinkVersionResponse(hartLinkVersionResponseBuffer);
  if (!detected) {
    return true;
  }

  clearHartLinkVersionProbeTimer();
  hartLinkVersionResponseBuffer = "";
  resetHartRxBuffer();
  setHartLinkVersionState("detected", detected);
  appendLog(
    "info",
    "HARTLink",
    i18n("hart.hartlinkDetectedLog")
      .replace("{version}", detected.version)
      .replace("{model}", detected.model),
  );
  return true;
}

async function detectHartLinkVersion(targetSession = session) {
  resetHartLinkVersionProbe("detecting");
  resetHartRxBuffer();
  await wait(HARTLINK_VERSION_DETECT_DELAY_MS);

  if (
    targetSession !== session ||
    !targetSession?.connected ||
    state.deviceId !== HART_DEVICE_ID ||
    state.transportId !== DEFAULT_TRANSPORT_ID
  ) {
    resetHartLinkVersionProbe();
    return;
  }

  try {
    await targetSession.write(HARTLINK_VERSION_QUERY);
  } catch (error) {
    if (targetSession === session && targetSession?.connected) {
      resetHartLinkVersionProbe("error");
      appendLog("warning", "HARTLink", `${i18n("hart.hartlinkProbeFailed")}: ${error.message}`);
    }
    return;
  }

  if (hartLinkVersionState.status !== "detecting") {
    return;
  }

  hartLinkVersionProbeTimer = window.setTimeout(() => {
    hartLinkVersionProbeTimer = null;
    if (hartLinkVersionState.status !== "detecting") {
      return;
    }
    hartLinkVersionResponseBuffer = "";
    resetHartRxBuffer();
    setHartLinkVersionState("not-detected");
    appendLog("info", "HARTLink", i18n("hart.hartlinkNotDetectedLog"));
  }, HARTLINK_VERSION_DETECT_TIMEOUT_MS);
}

async function sendHartSearchCommand(pollAddress = normalizeHartConfig(hartConfig).pollAddress) {
  if (!session?.connected) {
    return;
  }

  resetHartRxBuffer();
  const searchConfig = normalizeHartConfig({ ...hartConfig, pollAddress, command: 0 });
  const command = createHartSearchCommand(searchConfig, { bytesToHex });
  await session.write(command.bytes);
}

async function scanHartAddresses() {
  if (!session?.connected || hartAddressScanActive) {
    return;
  }

  const originalConfig = normalizeHartConfig(hartConfig);
  hartAddressScanActive = true;
  resetHartRxBuffer();
  updateDeviceUi();
  appendLog("info", "HART", i18n("hart.scanStarted"));

  try {
    for (let address = 0; address <= 15; address += 1) {
      if (!hartAddressScanActive || !session?.connected) {
        break;
      }

      hartConfig = normalizeHartConfig({
        ...hartConfig,
        pollAddress: address,
        device: { ...DEFAULT_HART_CONFIG.device },
      });
      populateHartConfigForm(hartConfig);
      updateDeviceUi();
      await sendHartSearchCommand(address);

      const startedAt = Date.now();
      while (Date.now() - startedAt < HART_SCAN_ADDRESS_DELAY_MS) {
        if (!hartAddressScanActive || !session?.connected) {
          break;
        }
        if (normalizeHartConfig(hartConfig).device.discovered) {
          appendLog("info", "HART", i18n("hart.scanFound").replace("{address}", String(normalizeHartConfig(hartConfig).pollAddress)));
          return;
        }
        await wait(50);
      }
    }

    if (!normalizeHartConfig(hartConfig).device.discovered) {
      hartConfig = originalConfig;
      populateHartConfigForm(hartConfig);
      appendLog("warning", "HART", i18n("hart.scanNotFound"));
    }
  } finally {
    hartAddressScanActive = false;
    updateDeviceUi();
  }
}

function getHartConfigControls() {
  return [
    elements.hartPollAddress,
    elements.hartMasterType,
    elements.hartPollMode,
    elements.hartCommandMode,
    elements.hartCommand,
    elements.hartCustomCommand,
    elements.hartCustomCommandData,
    elements.hartPreambleLength,
    elements.hartScale,
    elements.hartOffset,
    elements.hartFieldName,
    elements.hartUnit,
    elements.hartPollIntervalMs,
  ];
}

function updateAomasterPolling() {
  stopAomasterPolling();

  const normalized = normalizeAomasterConfig(aomasterConfig);
  if (state.deviceId !== DEFAULT_DEVICE_ID || !session?.connected || !state.pollingActive) {
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
  if (state.pollingActive && !canCurrentDevicePoll()) {
    state.pollingActive = false;
  }
  updateActivePolling();
}

function saveAomasterConfig() {
  aomasterConfig = readAomasterConfigForm();
  localStorage.setItem(AOMASTER_CONFIG_STORAGE_KEY, JSON.stringify(aomasterConfig));
  populateAomasterConfigForm(aomasterConfig);
  updateDeviceUi();
  updateActivePolling();
  appendLog("info", i18n("log.device"), `${i18n("device.aomaster")}${i18n("common.configSavedShort")}`);
}

function resetAomasterConfig() {
  aomasterConfig = normalizeAomasterConfig(DEFAULT_AOMASTER_CONFIG);
  localStorage.setItem(AOMASTER_CONFIG_STORAGE_KEY, JSON.stringify(aomasterConfig));
  populateAomasterConfigForm(aomasterConfig);
  resetAomasterRxBuffer();
  updateDeviceUi();
  updateActivePolling();
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
  populateAomasterWaveformForm();
  renderStepSequenceList();
  aomasterActualMode = null;
  actualChart?.clear();
  if (elements.actualChartValue) {
    elements.actualChartValue.textContent = i18n("chart.noData");
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
  on(elements.exportChartCsv, "click", exportChartCsv);
  on(elements.loadChartCsv, "click", openChartCsvPicker);
  on(elements.loadChartCsvInput, "change", loadChartCsv);
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
    ...listDebugCurveControlElements("custom", elements),
  ];
}

function applyAomasterModeDefaults() {
  const config = getModeConfig(state.mode, DEFAULT_DEVICE_ID, customConfig, modbusConfig);
  state.setpoint = config.presets.mid;
  state.waveLow = config.min;
  state.waveHigh = config.max;
  state.stepSequence = buildDefaultStepSequence(state.mode);
  populateAomasterWaveformForm();
  renderStepSequenceList();
}

function populateAomasterWaveformForm() {
  const waveState = normalizeAomasterWaveState(state, state.mode);
  state.mode = waveState.mode;
  const config = getModeConfig(state.mode, DEFAULT_DEVICE_ID, customConfig, modbusConfig);
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
    removeButton.textContent = i18n("curve.delete");
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
    appendLog("error", i18n("step.category"), i18n("step.maxPoints").replace("{max}", AOMASTER_MAX_STEP_SEQUENCE));
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
  const isConstant = state.waveform === "constant";
  const isStep = state.waveform === "step";
  elements.waveformSelect.disabled = false;
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
    elements.setpointChartValue.textContent = `${i18n("chart.setpointPrefix")} ${formatAomasterDisplayValue(state.setpoint)}`;
  } else if (state.waveform === "step") {
    const loopLabel = state.stepLoops === 0 ? i18n("aomaster.infiniteLoop") : `${state.stepLoops}${i18n("num.times")}`;
    elements.setpointChartValue.textContent = `${i18n("chart.stepLabel")} ${formatAomasterDisplaySequence(state.stepSequence)} ${getAomasterDisplayUnit()} · ${state.stepDwellMs}${i18n("num.msStep")} · ${loopLabel}`;
  } else {
    elements.setpointChartValue.textContent = `${getAomasterWaveformLabel(state.waveform)} ${formatAomasterDisplayNumber(state.waveLow)}~${formatAomasterDisplayNumber(state.waveHigh)} ${getAomasterDisplayUnit()}`;
  }

  if (actualChart) {
    actualChart.setMeta({ unit: getAomasterDisplayUnit(getAomasterActualMode()) });
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
    syncAomasterActualChartRange();
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
  syncAomasterActualChartRange();
}

function syncAomasterActualChartRange(mode = getAomasterActualMode()) {
  if (!actualChart) {
    return;
  }

  if (isAomasterPercentMode()) {
    actualChart.setRange(0, 100);
    return;
  }

  const config = getModeConfig(mode, DEFAULT_DEVICE_ID, customConfig, modbusConfig);
  actualChart.setRange(config.min, config.max);
}

function clearAomasterCharts() {
  aomasterActualMode = null;
  setpointChart?.clear();
  actualChart?.clear();
  elements.setpointChartValue.textContent = i18n("workbench.noSetpoint");
  elements.actualChartValue.textContent = i18n("chart.noData");
}

function clearAllCharts() {
  chart?.clear();
  hartChart?.clear();
  jsonMultiChart?.clear();
  clearAomasterCharts();
  elements.chartValue.textContent = i18n("chart.noData");
  updateHartVariableCards();
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

function concatLogBytes(left, right) {
  const merged = new Uint8Array(left.length + right.length);
  merged.set(left);
  merged.set(right, left.length);
  return merged;
}

function resetRxLogCoalesce() {
  if (rxLogFlushTimer) {
    window.clearTimeout(rxLogFlushTimer);
    rxLogFlushTimer = null;
  }
  rxLogBuffer = null;
  rxLogPendingLine = null;
}

function finalizeRxLogCoalesce() {
  if (rxLogFlushTimer) {
    window.clearTimeout(rxLogFlushTimer);
    rxLogFlushTimer = null;
  }
  rxLogBuffer = null;
  rxLogPendingLine = null;
}

function queueRxLogDisplay(bytes, text, useHexDisplay) {
  if (useHexDisplay) {
    rxLogBuffer =
      rxLogBuffer instanceof Uint8Array ? concatLogBytes(rxLogBuffer, bytes) : bytes.slice();
  } else if (text.trim()) {
    rxLogBuffer = typeof rxLogBuffer === "string" ? rxLogBuffer + text : text;
  } else {
    rxLogBuffer =
      rxLogBuffer instanceof Uint8Array ? concatLogBytes(rxLogBuffer, bytes) : bytes.slice();
  }

  const payload =
    useHexDisplay && rxLogBuffer instanceof Uint8Array
      ? bytesToHex(rxLogBuffer)
      : typeof rxLogBuffer === "string"
        ? rxLogBuffer
        : bytesToHex(rxLogBuffer);

  if (rxLogPendingLine) {
    const content = rxLogPendingLine.querySelector(".payload");
    if (content) {
      content.textContent = payload;
    }
  } else {
    rxLogPendingLine = appendLog("rx", "RX", payload, { returnLine: true });
  }

  if (rxLogFlushTimer) {
    window.clearTimeout(rxLogFlushTimer);
  }
  rxLogFlushTimer = window.setTimeout(finalizeRxLogCoalesce, RX_LOG_IDLE_MS);
}

function appendLog(kind, direction, payload, options = {}) {
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
    return options.returnLine ? line : undefined;
  }

  elements.serialLog.append(line);
  elements.serialLog.scrollTop = elements.serialLog.scrollHeight;

  while (elements.serialLog.children.length > 400) {
    elements.serialLog.firstElementChild?.remove();
  }

  return options.returnLine ? line : undefined;
}
