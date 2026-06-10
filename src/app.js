import { LiveChart } from "./chart.js";
import {
  createTransportSession,
  DEFAULT_TRANSPORT_ID,
  getTransportDescriptor,
  listTransports,
} from "./transports/registry.js";
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
  DEFAULT_CUSTOM_CONFIG,
  DEFAULT_DEVICE_ID,
  DEFAULT_MODBUS_CONFIG,
  getDeviceProfile,
  getModeConfig,
  listDeviceLibrary,
  MODBUS_DEVICE_ID,
  MODUSIGNAL_APP,
  normalizeCustomConfig,
  normalizeModbusConfig,
  parseDeviceTelemetry,
  resolveLineEnding,
} from "./protocols.js";

const CUSTOM_CONFIG_STORAGE_KEY = "modusignal.customDevice.v1";
const MODBUS_CONFIG_STORAGE_KEY = "modusignal.modbusDevice.v1";

const elements = {
  appShell: document.querySelector(".app-shell"),
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
  transportSelect: document.querySelector("#transportSelect"),
  transportFields: document.querySelector("#transportFields"),
  driverState: document.querySelector("#driverState"),
  selectedDeviceSummary: document.querySelector("#selectedDeviceSummary"),
  aomasterIntroPanel: document.querySelector("#aomasterIntroPanel"),
  modbusConfigPanel: document.querySelector("#modbusConfigPanel"),
  modeRow: document.querySelector("#modeRow"),
  setpointRow: document.querySelector(".setpoint-row"),
  presetRow: document.querySelector(".preset-row"),
  outputModes: [...document.querySelectorAll("input[name='outputMode']")],
  setpointLabel: document.querySelector("#setpointLabel"),
  setpointReadout: document.querySelector("#setpointReadout"),
  setpointSlider: document.querySelector("#setpointSlider"),
  setpointInput: document.querySelector("#setpointInput"),
  setpointUnit: document.querySelector("#setpointUnit"),
  protocolPreview: document.querySelector("#protocolPreview"),
  sendDriverCommand: document.querySelector("#sendDriverCommand"),
  customConfigPanel: document.querySelector("#customConfigPanel"),
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
  clearChart: document.querySelector("#clearChart"),
  serialLog: document.querySelector("#serialLog"),
  clearLog: document.querySelector("#clearLog"),
  sendFormat: document.querySelector("#sendFormat"),
  lineEnding: document.querySelector("#lineEnding"),
  manualCommand: document.querySelector("#manualCommand"),
  sendManual: document.querySelector("#sendManual"),
};

const chart = new LiveChart(elements.telemetryChart);
let customConfig = loadCustomConfig();
let modbusConfig = loadModbusConfig();
let session = null;
let modbusPollTimer = null;

const state = {
  pageId: "home",
  deviceId: DEFAULT_DEVICE_ID,
  transportId: DEFAULT_TRANSPORT_ID,
  mode: "current",
  setpoint: 12,
};

initialize();

function initialize() {
  elements.githubLink.href = MODUSIGNAL_APP.githubUrl;
  elements.newDeviceRequestLink.href = MODUSIGNAL_APP.newDeviceRequestUrl;
  renderFooterCopyright();
  elements.footerLicenseLink.textContent = MODUSIGNAL_APP.licenseName;
  elements.footerLicenseLink.href = MODUSIGNAL_APP.licenseUrl;
  populateCustomConfigForm(customConfig);
  populateModbusConfigForm(modbusConfig);
  populateTransportSelect();
  renderDeviceLibrary();
  setTransport(state.transportId);
  updatePageUi();
  updateDeviceUi();
  bindEvents();
  appendLog(
    "info",
    "系统",
    `${MODUSIGNAL_APP.name} 已就绪，当前设备：${getDeviceProfile(state.deviceId, customConfig, modbusConfig).name}`,
  );
}

function bindEvents() {
  elements.connectButton.addEventListener("click", connect);
  elements.disconnectButton.addEventListener("click", disconnect);
  elements.transportSelect.addEventListener("change", (event) => setTransport(event.target.value));
  elements.sendDriverCommand.addEventListener("click", sendDeviceCommand);
  elements.setpointSlider.addEventListener("input", (event) => updateSetpoint(Number(event.target.value)));
  elements.setpointInput.addEventListener("change", (event) => updateSetpoint(Number(event.target.value)));
  elements.sendManual.addEventListener("click", sendManualCommand);
  elements.copyRequestTemplate.addEventListener("click", copyRequestTemplate);
  elements.clearLog.addEventListener("click", () => {
    elements.serialLog.innerHTML = "";
    appendLog("info", "系统", "日志已清空");
  });
  elements.clearChart.addEventListener("click", () => {
    chart.clear();
    elements.chartValue.textContent = "暂无数据";
  });

  elements.appShell.addEventListener("click", (event) => {
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

  elements.outputModes.forEach((input) => {
    input.addEventListener("change", () => {
      if (input.checked) {
        state.mode = input.value;
        const config = getModeConfig(state.mode, state.deviceId, customConfig, modbusConfig);
        state.setpoint = config.presets.mid;
        updateDeviceUi();
      }
    });
  });

  document.querySelectorAll("[data-preset]").forEach((button) => {
    button.addEventListener("click", () => {
      const config = getModeConfig(state.mode, state.deviceId, customConfig, modbusConfig);
      updateSetpoint(config.presets[button.dataset.preset]);
    });
  });

  getCustomConfigControls().forEach((control) => {
    control.addEventListener("input", updateCustomDraftConfig);
    control.addEventListener("change", updateCustomDraftConfig);
  });

  elements.saveCustomConfig.addEventListener("click", saveCustomConfig);
  elements.resetCustomConfig.addEventListener("click", resetCustomConfig);
  elements.testCustomParser.addEventListener("click", testCustomParser);

  getModbusConfigControls().forEach((control) => {
    control.addEventListener("input", updateModbusDraftConfig);
    control.addEventListener("change", updateModbusDraftConfig);
  });

  elements.saveModbusConfig.addEventListener("click", saveModbusConfig);
  elements.resetModbusConfig.addEventListener("click", resetModbusConfig);
}

function bindSessionEvents(target) {
  target.addEventListener("connected", () => {
    updateConnectionUi(true);
    updateModbusPolling();
    appendLog("info", "连接", "已连接");
  });

  target.addEventListener("disconnected", () => {
    stopModbusPolling();
    resetModbusRxBuffer();
    updateConnectionUi(false);
    appendLog("info", "连接", "已断开");
  });

  target.addEventListener("rx", (event) => {
    const { bytes, text } = event.detail;
    const display =
      state.deviceId === MODBUS_DEVICE_ID ? bytesToHex(bytes) : text.trim() ? text : bytesToHex(bytes);
    appendLog("rx", "RX", display);

    const telemetry = parseDeviceTelemetry(state.deviceId, text, customConfig, modbusConfig, bytes);
    if (telemetry) {
      chart.add(telemetry.value);
      elements.chartValue.textContent = `${telemetry.fieldName} ${telemetry.value.toFixed(3)}${telemetry.unit ? ` ${telemetry.unit}` : ""}`;
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
  resetModbusRxBuffer();
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
    state.mode = document.querySelector("input[name='outputMode']:checked")?.value ?? "current";
    const config = getModeConfig(state.mode, deviceId, customConfig, modbusConfig);
    state.setpoint = config.presets.mid;
  }

  chart.clear();
  elements.chartValue.textContent = "暂无数据";
  updatePageUi();
  updateDeviceUi();
  updateModbusPolling();
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
  const profile = getDeviceProfile(state.deviceId, customConfig, modbusConfig);
  const isCustom = state.deviceId === CUSTOM_DEVICE_ID;
  const isModbus = state.deviceId === MODBUS_DEVICE_ID;
  const isAomaster = state.deviceId === DEFAULT_DEVICE_ID;
  const normalizedModbus = normalizeModbusConfig(modbusConfig);
  const modbusIsRead = isModbus && isReadFunctionCode(normalizedModbus.functionCode);

  if (elements.customDeviceNavName) {
    elements.customDeviceNavName.textContent = normalizeCustomConfig(customConfig).name;
  }

  elements.customConfigPanel.hidden = !isCustom;
  elements.modbusConfigPanel.hidden = !isModbus;
  elements.aomasterIntroPanel.hidden = !isAomaster;
  elements.modeRow.hidden = !isAomaster;
  elements.setpointRow.hidden = modbusIsRead;
  elements.presetRow.hidden = modbusIsRead;

  if (isCustom) {
    elements.selectedDeviceSummary.textContent = `当前选择 ${profile.name}；设定范围、发送模板和回包解析规则可在下方配置。`;
  } else if (isModbus) {
    elements.selectedDeviceSummary.textContent = `当前选择 Modbus RTU；${describeModbusSummary(modbusConfig)}。`;
  } else {
    elements.selectedDeviceSummary.textContent = `当前选择 ${profile.name}；协议未定时，参数先记录在页面状态，可通过手动命令调试。`;
  }

  document.querySelectorAll("[data-device-id]").forEach((button) => {
    button.classList.toggle("active", button.dataset.deviceId === state.deviceId && isDevicePageActive());
  });

  if (isAomaster) {
    const selectedMode = elements.outputModes.find((input) => input.value === state.mode) ?? elements.outputModes[0];
    selectedMode.checked = true;
  }

  updateSetpointUi();
}

function updatePageUi() {
  const activePageId = isDevicePageActive() ? "device" : state.pageId;

  elements.pages.forEach((page) => {
    page.classList.toggle("active", page.dataset.pageId === activePageId);
  });

  document.querySelectorAll("[data-page-target]").forEach((target) => {
    const targetPage = target.dataset.pageTarget;
    const isActive =
      targetPage === state.pageId ||
      (isDevicePageActive() && target.dataset.deviceId === state.deviceId);
    target.classList.toggle("active", isActive);
  });
}

function renderDeviceLibrary() {
  elements.deviceLibrary.innerHTML = "";

  listDeviceLibrary(customConfig).forEach((entry) => {
    const button = document.createElement("button");
    button.className = "device-item";
    button.type = "button";
    button.dataset.pageTarget = entry.pageTarget;
    button.dataset.deviceId = entry.deviceId;

    const icon = document.createElement("span");
    icon.setAttribute("aria-hidden", "true");

    if (entry.profile.image) {
      icon.className = "device-icon has-image";
      const image = document.createElement("img");
      image.src = entry.profile.image;
      image.alt = "";
      icon.append(image);
    } else {
      icon.className = "device-icon";
      icon.textContent = entry.profile.name.slice(0, 1).toUpperCase();
    }

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

function isDevicePageActive() {
  return [DEFAULT_DEVICE_ID, CUSTOM_DEVICE_ID, MODBUS_DEVICE_ID].includes(state.pageId);
}

function updateSetpoint(value) {
  const config = getModeConfig(state.mode, state.deviceId, customConfig, modbusConfig);
  const bounded = Math.min(config.max, Math.max(config.min, value));
  state.setpoint = Number.isFinite(bounded) ? bounded : config.presets.mid;
  updateSetpointUi();
}

function updateSetpointUi() {
  const config = getModeConfig(state.mode, state.deviceId, customConfig, modbusConfig);
  const formatted = state.setpoint.toFixed(decimalPlaces(config.step));

  elements.setpointLabel.textContent = config.label;
  elements.setpointReadout.textContent = `${formatted}${config.unit ? ` ${config.unit}` : ""}`;
  elements.setpointUnit.textContent = config.unit || "值";
  elements.setpointSlider.min = String(config.min);
  elements.setpointSlider.max = String(config.max);
  elements.setpointSlider.step = String(config.step);
  elements.setpointSlider.value = String(state.setpoint);
  elements.setpointInput.min = String(config.min);
  elements.setpointInput.max = String(config.max);
  elements.setpointInput.step = String(config.step);
  elements.setpointInput.value = formatted;

  const command = createDeviceSetOutputCommand(state.deviceId, state, customConfig, modbusConfig);
  elements.protocolPreview.textContent = command.preview;
  elements.sendDriverCommand.disabled = !command.supported || !session?.connected;

  if (state.deviceId === MODBUS_DEVICE_ID) {
    const normalized = normalizeModbusConfig(modbusConfig);
    const isRead = isReadFunctionCode(normalized.functionCode);
    elements.sendDriverCommand.textContent = isRead ? "读取寄存器" : "写入寄存器";
    elements.driverState.textContent = "Modbus RTU";
    elements.driverState.classList.remove("warning");
    return;
  }

  elements.sendDriverCommand.textContent = "发送设定";
  elements.driverState.textContent = command.supported ? "模板可发送" : "协议待配置";
  elements.driverState.classList.toggle("warning", !command.supported);
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
  updateDeviceUi();
  appendLog("info", "设备", "自定义设备配置已保存");
}

function resetCustomConfig() {
  customConfig = normalizeCustomConfig(DEFAULT_CUSTOM_CONFIG);
  localStorage.setItem(CUSTOM_CONFIG_STORAGE_KEY, JSON.stringify(customConfig));
  populateCustomConfigForm(customConfig);

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
    const command = createDeviceSetOutputCommand(state.deviceId, state, customConfig, modbusConfig);
    if (!command.supported || !command.bytes) {
      appendLog("error", "发送", command.preview || "当前设备没有可发送的驱动命令");
      return;
    }

    await session.write(command.bytes);
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
  elements.serialLog.append(line);
  elements.serialLog.scrollTop = elements.serialLog.scrollHeight;

  while (elements.serialLog.children.length > 400) {
    elements.serialLog.firstElementChild?.remove();
  }
}
