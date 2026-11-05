import i18n from "../../i18n.js";
import {
  listDebugCurveControlElements,
  populateDebugCurveConfigForm,
  readDebugCurveConfigForm,
  syncDebugCurveModeFields,
} from "../../debug-curve-form.js";
import {
  CUSTOM_DEVICE_ID,
  DEFAULT_CUSTOM_CONFIG,
  getModeConfig,
  normalizeCustomConfig,
} from "../../protocols.js";

export function loadCustomConfig(storageKey) {
  try {
    const saved = localStorage.getItem(storageKey);
    return normalizeCustomConfig(saved ? JSON.parse(saved) : DEFAULT_CUSTOM_CONFIG);
  } catch {
    return normalizeCustomConfig(DEFAULT_CUSTOM_CONFIG);
  }
}

export function createCustomConfigUi(options) {
  const {
    elements,
    state,
    storageKey,
    getConfig,
    setConfig,
    getModbusConfig,
    syncCurveRows,
    syncChartPanel,
    renderNavigation,
    updateDeviceUi,
    appendLog,
  } = options;

  function read() {
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

  function populate(config = getConfig()) {
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
    syncCurveRows("custom", normalized);
    if (elements.customParserPreview) elements.customParserPreview.textContent = i18n("curve.waitingTest");
  }

  function updateDraft() {
    const config = read();
    setConfig(config);
    syncDebugCurveModeFields("custom", config.parserMode, elements, config);
    syncCurveRows("custom", config);
    if (state.deviceId === CUSTOM_DEVICE_ID) {
      state.mode = "custom";
      const mode = getModeConfig(state.mode, state.deviceId, config, getModbusConfig());
      state.setpoint = Math.min(mode.max, Math.max(mode.min, state.setpoint));
    }
    syncChartPanel();
    updateDeviceUi();
  }

  function save() {
    const config = read();
    setConfig(config);
    localStorage.setItem(storageKey, JSON.stringify(config));
    populate(config);
    renderNavigation();
    updateDeviceUi();
    appendLog("info", i18n("log.device"), i18n("settings.saved.custom"));
  }

  function reset() {
    const config = normalizeCustomConfig(DEFAULT_CUSTOM_CONFIG);
    setConfig(config);
    localStorage.setItem(storageKey, JSON.stringify(config));
    populate(config);
    renderNavigation();
    if (state.deviceId === CUSTOM_DEVICE_ID) state.setpoint = config.defaultValue;
    updateDeviceUi();
    appendLog("info", i18n("log.device"), i18n("settings.reset.custom"));
  }

  function getControls() {
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

  return { getControls, populate, read, reset, save, updateDraft };
}
