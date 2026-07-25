import i18n from "../../i18n.js";
import { getHartStandardRequestFields, normalizeHartConfig } from "../../devices/hart-device.js";
import { formatHartDeviceSummary, validateHartTrimValue } from "../../hart/hart.js";

const EMPTY_CALIBRATION_STATE = () => ({
  awaitingGuidelines: false,
  deviceVariable: null,
  guidelines: null,
  lastTrimValues: { low: null, high: null },
});

export function createHartWorkspaceController({
  elements,
  getConfig,
  setConfig,
  isConnected,
  isAddressScanActive,
  readConfigForm,
  populateConfigForm,
  updateDeviceUi,
  sendSearchCommand,
  sendDeviceCommand,
}) {
  let workspace = "general";
  let calibrationState = EMPTY_CALIBRATION_STATE();

  function switchWorkspace(nextWorkspace) {
    const next = ["general", "settings", "calibration"].includes(nextWorkspace) ? nextWorkspace : "general";
    workspace = next;
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

  function setSelectValue(select, value, fallbackLabel = null) {
    if (!select || value === null || value === undefined) return;
    const stringValue = String(value);
    if (![...select.options].some((option) => option.value === stringValue)) {
      const option = document.createElement("option");
      option.value = stringValue;
      option.textContent = fallbackLabel ?? stringValue;
      select.append(option);
    }
    select.value = stringValue;
  }

  function populateControls(config = getConfig()) {
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

    const transferSelect = elements.hartSettingsTransferFunction;
    if (transferSelect && transferSelect.options.length === 0) {
      const transferField = getHartStandardRequestFields(47).find((entry) => entry.key === "transfer_function");
      transferField?.options.forEach((entry) => {
        const option = document.createElement("option");
        option.value = entry.value;
        option.textContent = entry.label;
        transferSelect.append(option);
      });
    }
    if (elements.hartSettingsDate && !elements.hartSettingsDate.value) {
      elements.hartSettingsDate.value = new Date().toISOString().slice(0, 10);
    }
    if (elements.hartSettingsPollAddress && !elements.hartSettingsPollAddress.dataset.initialized) {
      elements.hartSettingsPollAddress.value = String(normalized.pollAddress);
      elements.hartSettingsPollAddress.dataset.initialized = "true";
    }
    switchWorkspace(workspace);
    updateUi();
  }

  function refreshLocalizedOptions() {
    const unitValue = elements.hartSettingsUnit?.value;
    const transferValue = elements.hartSettingsTransferFunction?.value;
    elements.hartSettingsUnit?.replaceChildren();
    elements.hartSettingsTransferFunction?.replaceChildren();
    populateControls(getConfig());
    setSelectValue(elements.hartSettingsUnit, unitValue);
    setSelectValue(elements.hartSettingsTransferFunction, transferValue);
  }

  function updateUi() {
    const connected = isConnected();
    elements.hartWorkspaceActions.forEach((button) => {
      const action = button.dataset.hartWorkspaceAction;
      let enabled = connected && !isAddressScanActive();
      if (action === "trim-low-pv") enabled = enabled && [1, 3].includes(calibrationState.guidelines?.supportedTrimPoints);
      if (action === "trim-high-pv") enabled = enabled && [2, 3].includes(calibrationState.guidelines?.supportedTrimPoints);
      button.disabled = !enabled;
    });
  }

  function setStatus(element, text, stateName = "info") {
    if (!element) return;
    element.textContent = text || i18n("hart.workspace.ready");
    element.dataset.state = stateName;
  }

  function readNumber(element, label, minimum = -Infinity, maximum = Infinity) {
    const value = Number(element?.value);
    if (!Number.isFinite(value) || value < minimum || value > maximum) {
      throw new Error(`${label}${i18n("hart.input.range").replace("{min}", minimum).replace("{max}", maximum)}`);
    }
    return String(value);
  }

  async function sendWorkspaceCommand(command, values = {}, statusElement = null) {
    if (!isConnected()) throw new Error(i18n("hart.workspace.connectFirst"));
    if (command !== 0 && !normalizeHartConfig(getConfig()).device.discovered) throw new Error(i18n("hart.searchFirst"));

    if (command === 0) {
      setStatus(statusElement, i18n("hart.workspace.sending").replace("{command}", "0"));
      await sendSearchCommand();
      return;
    }

    const commandKey = String(command);
    const current = readConfigForm();
    const nextConfig = normalizeHartConfig({
      ...current,
      commandMode: "preset",
      command,
      standardCommandValues: {
        ...current.standardCommandValues,
        [commandKey]: Object.fromEntries(Object.entries(values).map(([key, value]) => [key, String(value)])),
      },
    });
    setConfig(nextConfig);
    populateConfigForm(nextConfig);
    updateDeviceUi();
    setStatus(statusElement, i18n("hart.workspace.sending").replace("{command}", String(command)));
    await sendDeviceCommand();
  }

  async function handleAction(action) {
    const settingsStatus = elements.hartSettingsStatus;
    const calibrationStatus = elements.hartCalibrationStatus;
    switch (action) {
      case "read-identity": return sendWorkspaceCommand(0, {}, settingsStatus);
      case "read-sensor": return sendWorkspaceCommand(14, {}, elements.hartSettingsMeasurementStatus);
      case "read-config": return sendWorkspaceCommand(15, {}, elements.hartSettingsMeasurementStatus);
      case "write-unit": return sendWorkspaceCommand(44, { unit_code: elements.hartSettingsUnit?.value }, settingsStatus);
      case "write-range":
        return sendWorkspaceCommand(35, {
          unit_code: elements.hartSettingsUnit?.value,
          upper_range: readNumber(elements.hartSettingsUpperRange, i18n("hart.input.upperRange")),
          lower_range: readNumber(elements.hartSettingsLowerRange, i18n("hart.input.lowerRange")),
        }, settingsStatus);
      case "write-damping":
        return sendWorkspaceCommand(34, {
          damping_seconds: readNumber(elements.hartSettingsDamping, i18n("hart.input.dampingSeconds"), 0),
        }, settingsStatus);
      case "write-transfer": return sendWorkspaceCommand(47, { transfer_function: elements.hartSettingsTransferFunction?.value }, settingsStatus);
      case "read-message": return sendWorkspaceCommand(12, {}, settingsStatus);
      case "write-message": return sendWorkspaceCommand(17, { message: elements.hartSettingsMessage?.value ?? "" }, settingsStatus);
      case "read-tag": return sendWorkspaceCommand(13, {}, settingsStatus);
      case "write-tag":
        return sendWorkspaceCommand(18, {
          tag: elements.hartSettingsTag?.value ?? "",
          descriptor: elements.hartSettingsDescriptor?.value ?? "",
          date: elements.hartSettingsDate?.value ?? "",
        }, settingsStatus);
      case "read-assembly": return sendWorkspaceCommand(16, {}, settingsStatus);
      case "write-assembly":
        return sendWorkspaceCommand(19, {
          final_assembly_number: readNumber(elements.hartSettingsAssembly, i18n("hart.input.finalAssemblyNumber"), 0, 0xffffff),
        }, settingsStatus);
      case "write-address":
        return sendWorkspaceCommand(6, {
          polling_address: readNumber(elements.hartSettingsPollAddress, i18n("hart.input.pollAddress"), 0, 63),
          loop_current_mode: elements.hartSettingsLoopMode?.value ?? "1",
        }, settingsStatus);
      case "read-burst": return sendWorkspaceCommand(105, { burst_message: elements.hartSettingsBurstMessage?.value ?? "0" }, settingsStatus);
      case "write-burst":
        return sendWorkspaceCommand(108, {
          burst_command: elements.hartSettingsBurstCommand?.value ?? "1",
          burst_message: elements.hartSettingsBurstMessage?.value ?? "0",
        }, settingsStatus);
      case "enable-burst":
      case "disable-burst":
        return sendWorkspaceCommand(109, {
          burst_control: action === "enable-burst" ? "1" : "0",
          burst_message: elements.hartSettingsBurstMessage?.value ?? "0",
        }, settingsStatus);
      case "fixed-preset": return sendWorkspaceCommand(40, { fixed_current: elements.hartCalibrationPresetCurrent?.value ?? "4" }, calibrationStatus);
      case "fixed-custom":
        return sendWorkspaceCommand(40, {
          fixed_current: readNumber(elements.hartCalibrationCustomCurrent, i18n("hart.calibration.customCurrent"), 0, 30),
        }, calibrationStatus);
      case "fixed-exit": return sendWorkspaceCommand(40, { fixed_current: "0" }, calibrationStatus);
      case "output-low": return sendWorkspaceCommand(40, { fixed_current: "4" }, calibrationStatus);
      case "output-high": return sendWorkspaceCommand(40, { fixed_current: "20" }, calibrationStatus);
      case "trim-low-current":
        return sendWorkspaceCommand(45, {
          measured_current: readNumber(elements.hartCalibrationLowCurrent, i18n("hart.input.measuredCurrent"), 0, 30),
        }, calibrationStatus);
      case "trim-high-current":
        return sendWorkspaceCommand(46, {
          measured_current: readNumber(elements.hartCalibrationHighCurrent, i18n("hart.input.measuredCurrent"), 0, 30),
        }, calibrationStatus);
      case "pv-zero": return sendWorkspaceCommand(43, {}, calibrationStatus);
      case "read-trim-guidelines":
        calibrationState = { ...EMPTY_CALIBRATION_STATE(), awaitingGuidelines: true };
        updateUi();
        setStatus(elements.hartCalibrationGuidelines, i18n("hart.calibration.readingMapping"));
        return sendWorkspaceCommand(50, {}, calibrationStatus);
      case "trim-low-pv":
      case "trim-high-pv": {
        const guidelines = calibrationState.guidelines;
        if (!guidelines) throw new Error(i18n("hart.calibration.readGuidelinesFirst"));
        const upper = action === "trim-high-pv";
        const editor = upper ? elements.hartCalibrationHighValue : elements.hartCalibrationLowValue;
        const trimValue = readNumber(editor, upper ? i18n("hart.calibration.appliedHigh") : i18n("hart.calibration.appliedLow"));
        validateHartTrimValue(trimValue, upper ? 2 : 1, guidelines, upper ? calibrationState.lastTrimValues.low : calibrationState.lastTrimValues.high);
        return sendWorkspaceCommand(82, {
          device_variable: guidelines.deviceVariable,
          trim_point: upper ? 2 : 1,
          unit_code: guidelines.unitCode,
          trim_value: trimValue,
        }, calibrationStatus);
      }
      default: return undefined;
    }
  }

  function updateFromDiscovery() {
    const normalized = normalizeHartConfig(getConfig());
    if (elements.hartSettingsPollAddress) elements.hartSettingsPollAddress.value = String(normalized.pollAddress);
    setStatus(elements.hartSettingsStatus, formatHartDeviceSummary(normalized.device), "success");
    calibrationState = EMPTY_CALIBRATION_STATE();
    updateUi();
  }

  function updateFromTelemetry(telemetry) {
    const { command, fields } = telemetry ?? {};
    if (!Number.isFinite(command)) return;
    const summary = telemetry.commandLines?.join("\n") || telemetry.commandSummary || `${i18n("hart.command")} ${command}`;

    if ([6, 12, 13, 14, 15, 16, 17, 18, 19, 34, 35, 44, 47, 105, 108, 109].includes(command)) {
      setStatus(elements.hartSettingsStatus, summary, telemetry.isError ? "error" : "success");
    }
    if ([14, 15, 34, 35, 44, 47].includes(command)) {
      setStatus(elements.hartSettingsMeasurementStatus, summary, telemetry.isError ? "error" : "success");
    }
    if (!telemetry.isError && fields) {
      if ((command === 12 || command === 17) && elements.hartSettingsMessage) elements.hartSettingsMessage.value = fields.message ?? "";
      if (command === 13 || command === 18) {
        if (elements.hartSettingsTag) elements.hartSettingsTag.value = fields.tag ?? "";
        if (elements.hartSettingsDescriptor) elements.hartSettingsDescriptor.value = fields.descriptor ?? "";
        if (elements.hartSettingsDate && fields.date) elements.hartSettingsDate.value = fields.date;
      }
      if ((command === 16 || command === 19) && elements.hartSettingsAssembly) elements.hartSettingsAssembly.value = String(fields.assemblyNumber ?? 0);
      if (command === 6) {
        if (elements.hartSettingsPollAddress) elements.hartSettingsPollAddress.value = String(fields.pollingAddress ?? 0);
        if (elements.hartSettingsLoopMode) elements.hartSettingsLoopMode.value = String(fields.loopCurrentMode ?? 1);
      }
      if ([14, 15, 35, 44].includes(command)) setSelectValue(elements.hartSettingsUnit, fields.unitCode, `${fields.unitCode} · ${fields.unit ?? ""}`);
      if (command === 15 || command === 35) {
        if (elements.hartSettingsUpperRange && Number.isFinite(fields.upper)) elements.hartSettingsUpperRange.value = String(fields.upper);
        if (elements.hartSettingsLowerRange && Number.isFinite(fields.lower)) elements.hartSettingsLowerRange.value = String(fields.lower);
      }
      if (command === 15 || command === 34) {
        const damping = command === 34 ? fields.value : fields.damping;
        if (elements.hartSettingsDamping && Number.isFinite(damping)) elements.hartSettingsDamping.value = String(damping);
      }
      if (command === 15 || command === 47) setSelectValue(elements.hartSettingsTransferFunction, fields.transferFunction, `${fields.transferFunction}`);
      if (command === 105 || command === 108) setSelectValue(elements.hartSettingsBurstCommand, fields.burstCommand, `Cmd ${fields.burstCommand}`);
      if ([105, 108, 109].includes(command) && elements.hartSettingsBurstMessage && Number.isInteger(fields.burstMessage)) {
        elements.hartSettingsBurstMessage.value = String(fields.burstMessage);
      }
    }

    if ([40, 43, 45, 46, 50, 81, 82].includes(command)) {
      setStatus(elements.hartCalibrationStatus, summary, telemetry.isError ? "error" : "success");
    }
    if (command === 50 && calibrationState.awaitingGuidelines && !telemetry.isError) {
      const deviceVariable = fields?.pv;
      if (!Number.isInteger(deviceVariable) || deviceVariable >= 244) {
        calibrationState.awaitingGuidelines = false;
        setStatus(elements.hartCalibrationGuidelines, i18n("hart.calibration.invalidPvMapping").replace("{code}", String(deviceVariable)), "error");
        return;
      }
      calibrationState.deviceVariable = deviceVariable;
      setStatus(elements.hartCalibrationGuidelines, i18n("hart.calibration.readingGuidelines").replace("{code}", String(deviceVariable)));
      void sendWorkspaceCommand(81, { device_variable: deviceVariable }, elements.hartCalibrationStatus).catch((error) => {
        calibrationState.awaitingGuidelines = false;
        setStatus(elements.hartCalibrationGuidelines, error.message, "error");
      });
      return;
    }
    if (command === 81) {
      calibrationState.awaitingGuidelines = false;
      if (!telemetry.isError && fields) {
        calibrationState.guidelines = fields;
        calibrationState.lastTrimValues = { low: null, high: null };
        setStatus(elements.hartCalibrationGuidelines, summary, "success");
        if (elements.hartCalibrationLowValue && Number.isFinite(fields.minimumLower)) {
          elements.hartCalibrationLowValue.placeholder = `${fields.minimumLower}…${fields.maximumLower} ${fields.unit}`;
        }
        if (elements.hartCalibrationHighValue && Number.isFinite(fields.minimumUpper)) {
          elements.hartCalibrationHighValue.placeholder = `${fields.minimumUpper}…${fields.maximumUpper} ${fields.unit}`;
        }
      }
      updateUi();
    }
    if (command === 82 && !telemetry.isError && fields) {
      if (fields.trimPoint === 1) calibrationState.lastTrimValues.low = fields.value;
      if (fields.trimPoint === 2) calibrationState.lastTrimValues.high = fields.value;
    }
  }

  return {
    handleAction,
    populateControls,
    refreshLocalizedOptions,
    switchWorkspace,
    updateFromDiscovery,
    updateFromTelemetry,
    updateUi,
  };
}
