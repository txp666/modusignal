import i18n from "../i18n.js";
import {
  getHartStandardRequestFields,
  HART_UNIVERSAL_COMMANDS,
  normalizeHartConfig,
} from "../devices/hart-device.js";
import { getHartCommandLabel } from "./hart.js";

export function createHartConfigUi({ elements, getConfig, populateWorkspaceControls, updateDeviceInfo }) {
  function syncCommandModeUi(config = getConfig()) {
    const normalized = normalizeHartConfig(config);
    const isCustom = normalized.commandMode === "custom";

    if (elements.hartCommandMode) elements.hartCommandMode.value = normalized.commandMode;
    if (elements.hartPresetCommandField) elements.hartPresetCommandField.hidden = isCustom;
    if (elements.hartCustomCommandField) elements.hartCustomCommandField.hidden = !isCustom;
    if (elements.hartCustomCommandDataField) elements.hartCustomCommandDataField.hidden = !isCustom;
    if (elements.hartStandardCommandSection) elements.hartStandardCommandSection.hidden = isCustom;
    if (elements.hartCustomCommand) elements.hartCustomCommand.value = String(normalized.customCommand);
  }

  function readStandardCommandValues() {
    const valuesByCommand = { ...normalizeHartConfig(getConfig()).standardCommandValues };
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

  function renderStandardCommandFields(config = getConfig(), force = false) {
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

  function populateCommandSelect(selectedCommand = getConfig().command) {
    if (!elements.hartCommand) return;

    const normalized = normalizeHartConfig({ ...getConfig(), command: selectedCommand });
    elements.hartCommand.replaceChildren();
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
      option.selected = entry.value === normalized.command;
      elements.hartCommand.lastElementChild.append(option);
    });
  }

  function readChartSeriesFromControls() {
    const chartSeries = { ...normalizeHartConfig(getConfig()).chartSeries };
    elements.hartChartSeriesInputs.forEach((input) => {
      const key = input.dataset.hartSeries;
      if (key) chartSeries[key] = input.checked;
    });
    return chartSeries;
  }

  function readConfigForm() {
    const current = getConfig();
    if (!elements.hartPollAddress) return normalizeHartConfig(current);

    return normalizeHartConfig({
      ...current,
      pollAddress: elements.hartPollAddress.value,
      masterType: elements.hartMasterType?.value ?? current.masterType,
      pollMode: elements.hartPollMode?.value ?? current.pollMode,
      commandMode: elements.hartCommandMode?.value ?? current.commandMode,
      command: elements.hartCommand?.value ?? current.command,
      customCommand: elements.hartCustomCommand?.value ?? current.customCommand,
      customCommandData: elements.hartCustomCommandData?.value ?? "",
      standardCommandValues: readStandardCommandValues(),
      preambleLength: elements.hartPreambleLength.value,
      scale: elements.hartScale.value,
      offset: elements.hartOffset.value,
      fieldName: elements.hartFieldName.value,
      unit: elements.hartUnit.value,
      pollIntervalMs: elements.hartPollIntervalMs.value,
      chartSeries: readChartSeriesFromControls(),
    });
  }

  function populateConfigForm(config) {
    if (!elements.hartPollAddress) return;

    const normalized = normalizeHartConfig(config);
    populateCommandSelect(normalized.command);
    syncCommandModeUi(normalized);
    elements.hartPollAddress.value = String(normalized.pollAddress);
    if (elements.hartMasterType) elements.hartMasterType.value = normalized.masterType;
    if (elements.hartPollMode) elements.hartPollMode.value = normalized.pollMode;
    elements.hartCommand.value = String(normalized.command);
    if (elements.hartCustomCommandData) elements.hartCustomCommandData.value = normalized.customCommandData;
    renderStandardCommandFields(normalized, true);
    elements.hartPreambleLength.value = String(normalized.preambleLength);
    elements.hartScale.value = String(normalized.scale);
    elements.hartOffset.value = String(normalized.offset);
    elements.hartFieldName.value = normalized.fieldName;
    elements.hartUnit.value = normalized.unit;
    elements.hartPollIntervalMs.value = String(normalized.pollIntervalMs);
    populateWorkspaceControls(normalized);
    updateDeviceInfo();
  }

  function getConfigControls() {
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

  return {
    getConfigControls,
    populateConfigForm,
    readConfigForm,
    renderStandardCommandFields,
    syncCommandModeUi,
  };
}
