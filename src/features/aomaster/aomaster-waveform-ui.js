import i18n from "../../i18n.js";
import {
  AOMASTER_MAX_STEP_SEQUENCE,
  buildDefaultStepSequence,
  generateWaveformPreview,
  getAomasterWaveformLabel,
  normalizeAomasterWaveState,
  normalizeStepSequence,
} from "../../devices/aomaster.js";
import { DEFAULT_DEVICE_ID, getDeviceProfile, getModeConfig } from "../../protocols.js";

export function createAomasterWaveformUi(options) {
  const {
    elements,
    state,
    getCustomConfig,
    getModbusConfig,
    getSetpointChart,
    getActualChart,
    getActualMode,
    resetActualMode,
    isPercentMode,
    getDisplayStep,
    formatDisplayNumber,
    readDisplayNumber,
    getDisplayNumber,
    getDisplayUnit,
    formatDisplayValue,
    formatDisplaySequence,
    updateSetpointUi,
    applyChartPointCountConfig,
    getChartPointCount,
    requestChartResize,
    appendLog,
  } = options;

  function getModeConfiguration(mode = state.mode) {
    return getModeConfig(mode, DEFAULT_DEVICE_ID, getCustomConfig(), getModbusConfig());
  }

  function applyModeDefaults() {
    const config = getModeConfiguration();
    state.setpoint = config.presets.mid;
    state.waveLow = config.min;
    state.waveHigh = config.max;
    state.stepSequence = buildDefaultStepSequence(state.mode);
    populateForm();
    renderStepSequence();
  }

  function populateForm() {
    const waveState = normalizeAomasterWaveState(state, state.mode);
    Object.assign(state, waveState);
    const config = getModeConfiguration();
    if (elements.waveLow) {
      elements.waveLow.min = isPercentMode() ? "0" : String(config.min);
      elements.waveLow.max = isPercentMode() ? "100" : String(config.max);
      elements.waveLow.step = String(getDisplayStep());
      elements.waveLow.value = formatDisplayNumber(waveState.waveLow);
    }
    if (elements.waveHigh) {
      elements.waveHigh.min = isPercentMode() ? "0" : String(config.min);
      elements.waveHigh.max = isPercentMode() ? "100" : String(config.max);
      elements.waveHigh.step = String(getDisplayStep());
      elements.waveHigh.value = formatDisplayNumber(waveState.waveHigh);
    }
    if (elements.wavePeriodMs) elements.wavePeriodMs.value = String(waveState.wavePeriodMs);
    if (elements.waveDuty) elements.waveDuty.value = String(waveState.waveDuty);
    if (elements.waveformSelect) elements.waveformSelect.value = waveState.waveform;
    if (elements.stepDwellMs) elements.stepDwellMs.value = String(waveState.stepDwellMs);
    if (elements.stepLoops) elements.stepLoops.value = String(waveState.stepLoops);
    renderStepSequence();
  }

  function renderStepSequence() {
    if (!elements.stepSequenceList) return;
    const config = getModeConfiguration();
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
      input.min = isPercentMode() ? "0" : String(config.min);
      input.max = isPercentMode() ? "100" : String(config.max);
      input.step = String(getDisplayStep());
      input.value = formatDisplayNumber(value);
      input.addEventListener("input", updateDraft);
      input.addEventListener("change", updateDraft);
      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.textContent = i18n("curve.delete");
      removeButton.disabled = sequence.length <= 2;
      removeButton.addEventListener("click", () => removeStepPoint(index));
      row.append(label, input, removeButton);
      elements.stepSequenceList.append(row);
    });
  }

  function readStepSequence() {
    return [...elements.stepSequenceList.querySelectorAll("[data-step-value]")]
      .map((input) => readDisplayNumber(input.value));
  }

  function addStepPoint() {
    if (state.stepSequence.length >= AOMASTER_MAX_STEP_SEQUENCE) {
      appendLog("error", i18n("step.category"), i18n("step.maxPoints").replace("{max}", AOMASTER_MAX_STEP_SEQUENCE));
      return;
    }
    state.stepSequence = [...state.stepSequence, getModeConfiguration().presets.mid];
    renderStepSequence();
    refreshPreview();
    updateSetpointUi();
  }

  function removeStepPoint(index) {
    if (state.stepSequence.length <= 2) return;
    state.stepSequence = state.stepSequence.filter((_, stepIndex) => stepIndex !== index);
    renderStepSequence();
    refreshPreview();
    updateSetpointUi();
  }

  function applyStepPreset(preset) {
    const config = getModeConfiguration();
    const span = (config.max - config.min) / 4;
    if (preset === "five") state.stepSequence = buildDefaultStepSequence(state.mode);
    else if (preset === "up-down") {
      state.stepSequence = [config.min, config.min + span, config.min + span * 2, config.max, config.presets.mid, config.min];
    } else if (preset === "pulse") {
      state.stepSequence = [config.min, config.max, config.min, config.max, config.min];
      state.stepDwellMs = 200;
    }
    populateForm();
    updateUi();
    refreshPreview();
    updateSetpointUi();
  }

  function updateUi() {
    const constant = state.waveform === "constant";
    const step = state.waveform === "step";
    elements.waveformSelect.disabled = false;
    elements.constantSetpointBlock.hidden = !constant;
    elements.waveformParamsBlock.hidden = constant;
    elements.waveAnalogParams.hidden = step;
    elements.stepSequenceBlock.hidden = !step;
    elements.waveDutyField.hidden = state.waveform !== "square";
  }

  function updateDraft() {
    state.waveform = elements.waveformSelect.value;
    state.waveLow = readDisplayNumber(elements.waveLow.value);
    state.waveHigh = readDisplayNumber(elements.waveHigh.value);
    state.wavePeriodMs = Number(elements.wavePeriodMs.value);
    state.waveDuty = Number(elements.waveDuty.value);
    state.stepDwellMs = Number(elements.stepDwellMs.value);
    state.stepLoops = Number(elements.stepLoops.value);
    if (state.waveform === "step") state.stepSequence = readStepSequence();
    Object.assign(state, normalizeAomasterWaveState(state, state.mode));
    populateForm();
    updateUi();
    refreshPreview();
    updateSetpointUi();
  }

  function applyWavePreset(preset) {
    const config = getModeConfiguration();
    if (preset === "min-max") {
      state.waveLow = config.min;
      state.waveHigh = config.max;
    } else if (preset === "mid") {
      const span = (config.max - config.min) / 4;
      state.waveLow = config.presets.mid - span;
      state.waveHigh = config.presets.mid + span;
    } else if (preset === "narrow") {
      const span = (config.max - config.min) / 10;
      state.waveLow = config.presets.mid - span;
      state.waveHigh = config.presets.mid + span;
      state.waveDuty = 10;
    }
    populateForm();
    refreshPreview();
    updateSetpointUi();
  }

  function refreshPreview() {
    const setpointChart = getSetpointChart();
    if (state.deviceId !== DEFAULT_DEVICE_ID || !setpointChart) return;
    applyChartPointCountConfig();
    const values = generateWaveformPreview(state, getChartPointCount()).map((value) => getDisplayNumber(value));
    setpointChart.setPoints(values);
    setpointChart.setMeta({ unit: getDisplayUnit() });
    syncChartRanges();
    if (state.waveform === "constant") {
      elements.setpointChartValue.textContent = `${i18n("chart.setpointPrefix")} ${formatDisplayValue(state.setpoint)}`;
    } else if (state.waveform === "step") {
      const loops = state.stepLoops === 0 ? i18n("aomaster.infiniteLoop") : `${state.stepLoops}${i18n("num.times")}`;
      elements.setpointChartValue.textContent = `${i18n("chart.stepLabel")} ${formatDisplaySequence(state.stepSequence)} ${getDisplayUnit()} · ${state.stepDwellMs}${i18n("num.msStep")} · ${loops}`;
    } else {
      elements.setpointChartValue.textContent = `${getAomasterWaveformLabel(state.waveform)} ${formatDisplayNumber(state.waveLow)}~${formatDisplayNumber(state.waveHigh)} ${getDisplayUnit()}`;
    }
    getActualChart()?.setMeta({ unit: getDisplayUnit(getActualMode()) });
    requestChartResize();
  }

  function getWaveControls() {
    return [elements.waveformSelect, elements.waveLow, elements.waveHigh, elements.wavePeriodMs, elements.waveDuty, elements.stepDwellMs, elements.stepLoops];
  }

  function populateOutputModes() {
    if (!elements.outputModeSelect) return;
    const profile = getDeviceProfile(DEFAULT_DEVICE_ID, getCustomConfig(), getModbusConfig());
    const currentValue = state.mode;
    elements.outputModeSelect.innerHTML = "";
    Object.entries(profile.modes).forEach(([modeId, modeConfig]) => {
      const option = document.createElement("option");
      option.value = modeId;
      option.textContent = modeConfig.label;
      elements.outputModeSelect.append(option);
    });
    state.mode = profile.modes[currentValue] ? currentValue : Object.keys(profile.modes)[0] ?? "current";
    elements.outputModeSelect.value = state.mode;
  }

  function syncChartRanges() {
    const setpointChart = getSetpointChart();
    const actualChart = getActualChart();
    if (!setpointChart || !actualChart) return;
    if (isPercentMode()) {
      setpointChart.setRange(0, 100);
      syncActualChartRange();
      return;
    }
    const config = getModeConfiguration();
    const min = state.waveform === "step" ? Math.min(...state.stepSequence)
      : state.waveform === "constant" ? config.min : Math.min(state.waveLow, state.waveHigh);
    const max = state.waveform === "step" ? Math.max(...state.stepSequence)
      : state.waveform === "constant" ? config.max : Math.max(state.waveLow, state.waveHigh);
    setpointChart.setRange(min, max);
    syncActualChartRange();
  }

  function syncActualChartRange(mode = getActualMode()) {
    const actualChart = getActualChart();
    if (!actualChart) return;
    if (isPercentMode()) actualChart.setRange(0, 100);
    else {
      const config = getModeConfiguration(mode);
      actualChart.setRange(config.min, config.max);
    }
  }

  function clearCharts() {
    resetActualMode();
    getSetpointChart()?.clear();
    getActualChart()?.clear();
    elements.setpointChartValue.textContent = i18n("workbench.noSetpoint");
    elements.actualChartValue.textContent = i18n("chart.noData");
  }

  return {
    addStepPoint,
    applyModeDefaults,
    applyStepPreset,
    applyWavePreset,
    clearCharts,
    getWaveControls,
    populateForm,
    populateOutputModes,
    refreshPreview,
    renderStepSequence,
    syncActualChartRange,
    syncChartRanges,
    updateDraft,
    updateUi,
  };
}
