import i18n from "../../i18n.js";
import {
  createAOMasterReadCommand,
  formatSetpoint,
  resetAomasterRxBuffer,
} from "../../devices/aomaster.js";
import {
  DEFAULT_AOMASTER_CONFIG,
  DEFAULT_DEVICE_ID,
  getModeConfig,
  normalizeAomasterConfig,
} from "../../protocols.js";

const CONFIG_STORAGE_KEY = "modusignal.aomasterDevice.v1";
const DISPLAY_MODE_STORAGE_KEY = "modusignal.aomasterValueDisplayMode.v1";

function decimalPlaces(step) {
  const text = String(step);
  return Math.min(6, Math.max(0, text.includes(".") ? text.split(".")[1].length : 0));
}

function loadConfig() {
  try {
    const saved = localStorage.getItem(CONFIG_STORAGE_KEY);
    return normalizeAomasterConfig(saved ? JSON.parse(saved) : DEFAULT_AOMASTER_CONFIG);
  } catch {
    return normalizeAomasterConfig(DEFAULT_AOMASTER_CONFIG);
  }
}

function loadDisplayMode() {
  try {
    return localStorage.getItem(DISPLAY_MODE_STORAGE_KEY) === "percent" ? "percent" : "value";
  } catch {
    return "value";
  }
}

export function createAomasterController(options) {
  const {
    elements,
    state,
    getCustomConfig,
    getModbusConfig,
    getSession,
    getPollingController,
    getWaveformUi,
    getChartController,
    updateDeviceUi,
    updateSetpointUi,
    appendLog,
  } = options;

  let config = loadConfig();
  let actualMode = null;
  state.aomasterValueDisplayMode = loadDisplayMode();

  const getModeConfiguration = (mode = state.mode) => getModeConfig(
    mode,
    DEFAULT_DEVICE_ID,
    getCustomConfig(),
    getModbusConfig(),
  );

  function getConfig() {
    return config;
  }

  function isPercentMode() {
    return state.deviceId === DEFAULT_DEVICE_ID && state.aomasterValueDisplayMode === "percent";
  }

  function getActualMode() {
    return actualMode || state.mode;
  }

  function resetActualMode() {
    actualMode = null;
  }

  function getPercentValue(value, mode = state.mode) {
    const modeConfig = getModeConfiguration(mode);
    const span = modeConfig.max - modeConfig.min;
    if (!Number.isFinite(span) || span === 0) return 0;
    return ((Number(value) - modeConfig.min) / span) * 100;
  }

  function getValueFromPercent(percent, mode = state.mode) {
    const modeConfig = getModeConfiguration(mode);
    const span = modeConfig.max - modeConfig.min;
    const bounded = Math.min(100, Math.max(0, Number(percent)));
    return modeConfig.min + (span * bounded) / 100;
  }

  function getDisplayNumber(value, mode = state.mode) {
    return isPercentMode() ? getPercentValue(value, mode) : Number(value);
  }

  function readDisplayNumber(value, mode = state.mode) {
    return isPercentMode() ? getValueFromPercent(value, mode) : Number(value);
  }

  function getDisplayStep(mode = state.mode) {
    return isPercentMode() ? 0.1 : getModeConfiguration(mode).step;
  }

  function getDisplayDecimals(mode = state.mode) {
    return isPercentMode() ? 1 : decimalPlaces(getModeConfiguration(mode).step);
  }

  function formatDisplayNumber(value, mode = state.mode) {
    return getDisplayNumber(value, mode).toFixed(getDisplayDecimals(mode));
  }

  function formatDisplayValue(value, mode = state.mode) {
    const modeConfig = getModeConfiguration(mode);
    return isPercentMode()
      ? `${formatDisplayNumber(value, mode)} %`
      : `${formatSetpoint(mode, value)} ${modeConfig.unit}`;
  }

  function formatDisplaySequence(sequence, mode = state.mode) {
    return sequence.map((value) => formatDisplayNumber(value, mode)).join(" → ");
  }

  function getDisplayUnit(mode = state.mode) {
    return isPercentMode() ? "%" : getModeConfiguration(mode).unit;
  }

  function syncDisplayControls() {
    elements.aomasterValueDisplayMode?.forEach((control) => {
      control.checked = control.value === state.aomasterValueDisplayMode;
    });
  }

  function setDisplayMode(mode) {
    const nextMode = mode === "percent" ? "percent" : "value";
    if (state.aomasterValueDisplayMode === nextMode) return;
    state.aomasterValueDisplayMode = nextMode;
    try {
      localStorage.setItem(DISPLAY_MODE_STORAGE_KEY, nextMode);
    } catch {
      // localStorage may be unavailable in restricted browser contexts.
    }
    const waveformUi = getWaveformUi();
    syncDisplayControls();
    waveformUi.populateForm();
    waveformUi.renderStepSequence();
    resetActualMode();
    getChartController().getCharts().actualChart?.clear();
    if (elements.actualChartValue) elements.actualChartValue.textContent = i18n("chart.noData");
    updateSetpointUi();
    waveformUi.syncChartRanges();
    getChartController().requestResize();
  }

  function readConfigForm() {
    return normalizeAomasterConfig({
      slaveId: elements.aomasterSlaveId.value,
      pollIntervalMs: elements.aomasterPollIntervalMs.value,
    });
  }

  function populateConfigForm(nextConfig = config) {
    const normalized = normalizeAomasterConfig(nextConfig);
    elements.aomasterSlaveId.value = String(normalized.slaveId);
    elements.aomasterPollIntervalMs.value = String(normalized.pollIntervalMs);
  }

  function getConfigControls() {
    return [elements.aomasterSlaveId, elements.aomasterPollIntervalMs];
  }

  function updatePollingState() {
    const pollingController = getPollingController();
    if (state.pollingActive && !pollingController.canPoll()) state.pollingActive = false;
    pollingController.updateActive();
  }

  function updateDraftConfig() {
    config = readConfigForm();
    resetAomasterRxBuffer();
    updateDeviceUi();
    updatePollingState();
  }

  function saveConfig() {
    config = readConfigForm();
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
    populateConfigForm();
    updateDeviceUi();
    getPollingController().updateActive();
    appendLog("info", i18n("log.device"), `${i18n("device.aomaster")}${i18n("common.configSavedShort")}`);
  }

  function resetConfig() {
    config = normalizeAomasterConfig(DEFAULT_AOMASTER_CONFIG);
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
    populateConfigForm();
    resetAomasterRxBuffer();
    updateDeviceUi();
    getPollingController().updateActive();
    appendLog("info", i18n("log.device"), `${i18n("device.aomaster")}${i18n("common.configResetShort")}`);
  }

  async function sendReadCommand() {
    const session = getSession();
    if (!session?.connected) return;
    await session.write(createAOMasterReadCommand(config));
  }

  function handleTelemetry(telemetry) {
    const readbackMode = telemetry.mode || state.mode;
    actualMode = readbackMode;
    const actualChart = getChartController().getCharts().actualChart;
    actualChart?.setMeta({ unit: getDisplayUnit(readbackMode) });
    getWaveformUi().syncActualChartRange(readbackMode);
    actualChart?.add(getDisplayNumber(telemetry.value, readbackMode));
    if (elements.actualChartValue) {
      elements.actualChartValue.textContent = `${telemetry.fieldName} ${formatDisplayValue(telemetry.value, readbackMode)}`;
    }
  }

  return {
    formatDisplayNumber,
    formatDisplaySequence,
    formatDisplayValue,
    getActualMode,
    getConfig,
    getConfigControls,
    getDisplayNumber,
    getDisplayStep,
    getDisplayUnit,
    getValueFromPercent,
    handleTelemetry,
    isPercentMode,
    populateConfigForm,
    readDisplayNumber,
    resetActualMode,
    resetConfig,
    saveConfig,
    sendReadCommand,
    setDisplayMode,
    syncDisplayControls,
    updateDraftConfig,
  };
}
