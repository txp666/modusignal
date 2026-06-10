import { LiveChart } from "./chart.js";
import { SerialSession } from "./serial.js";
import {
  buildManualPayload,
  bytesToHex,
  createDeviceSetOutputCommand,
  CUSTOM_DEVICE_ID,
  DEFAULT_CUSTOM_CONFIG,
  DEFAULT_DEVICE_ID,
  getDeviceProfile,
  getModeConfig,
  MODUSIGNAL_APP,
  normalizeCustomConfig,
  parseDeviceTelemetry,
  resolveLineEnding,
} from "./protocols.js";

const CUSTOM_CONFIG_STORAGE_KEY = "modusignal.customDevice.v1";

const elements = {
  secureState: document.querySelector("#secureState"),
  connectButton: document.querySelector("#connectButton"),
  disconnectButton: document.querySelector("#disconnectButton"),
  connectionState: document.querySelector("#connectionState"),
  pages: [...document.querySelectorAll("[data-page-id]")],
  pageTargets: [...document.querySelectorAll("[data-page-target]")],
  deviceItems: [...document.querySelectorAll("[data-device-id]")],
  customDeviceNavName: document.querySelector("#customDeviceNavName"),
  githubLink: document.querySelector("#githubLink"),
  newDeviceRequestLink: document.querySelector("#newDeviceRequestLink"),
  deviceRequestTemplate: document.querySelector("#deviceRequestTemplate"),
  copyRequestTemplate: document.querySelector("#copyRequestTemplate"),
  baudRate: document.querySelector("#baudRate"),
  dataBits: document.querySelector("#dataBits"),
  stopBits: document.querySelector("#stopBits"),
  parity: document.querySelector("#parity"),
  flowControl: document.querySelector("#flowControl"),
  driverState: document.querySelector("#driverState"),
  selectedDeviceSummary: document.querySelector("#selectedDeviceSummary"),
  aomasterIntroPanel: document.querySelector("#aomasterIntroPanel"),
  modeRow: document.querySelector("#modeRow"),
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

const session = new SerialSession();
const chart = new LiveChart(elements.telemetryChart);
let customConfig = loadCustomConfig();

const state = {
  pageId: "home",
  deviceId: DEFAULT_DEVICE_ID,
  mode: "current",
  setpoint: 12,
};

initialize();

function initialize() {
  elements.githubLink.href = MODUSIGNAL_APP.githubUrl;
  elements.newDeviceRequestLink.href = MODUSIGNAL_APP.newDeviceRequestUrl;
  populateCustomConfigForm(customConfig);
  updateSecureState();
  updatePageUi();
  updateDeviceUi();
  updateConnectionUi(false);
  bindEvents();
  appendLog("info", "系统", `${MODUSIGNAL_APP.name} 已就绪，当前设备：${getDeviceProfile(state.deviceId, customConfig).name}`);
}

function bindEvents() {
  elements.connectButton.addEventListener("click", connectSerial);
  elements.disconnectButton.addEventListener("click", disconnectSerial);
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

  elements.pageTargets.forEach((target) => {
    target.addEventListener("click", () => {
      if (target.dataset.deviceId) {
        selectDevice(target.dataset.deviceId);
      } else {
        navigateToPage(target.dataset.pageTarget);
      }
    });
  });

  elements.outputModes.forEach((input) => {
    input.addEventListener("change", () => {
      if (input.checked) {
        state.mode = input.value;
        const config = getModeConfig(state.mode, state.deviceId, customConfig);
        state.setpoint = config.presets.mid;
        updateDeviceUi();
      }
    });
  });

  document.querySelectorAll("[data-preset]").forEach((button) => {
    button.addEventListener("click", () => {
      const config = getModeConfig(state.mode, state.deviceId, customConfig);
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

  session.addEventListener("connected", () => {
    updateConnectionUi(true);
    appendLog("info", "串口", "已连接");
  });

  session.addEventListener("disconnected", () => {
    updateConnectionUi(false);
    appendLog("info", "串口", "已断开");
  });

  session.addEventListener("rx", (event) => {
    const { bytes, text } = event.detail;
    const display = text.trim() ? text : bytesToHex(bytes);
    appendLog("rx", "RX", display);

    const telemetry = parseDeviceTelemetry(state.deviceId, text, customConfig);
    if (telemetry) {
      chart.add(telemetry.value);
      elements.chartValue.textContent = `${telemetry.fieldName} ${telemetry.value.toFixed(3)}${telemetry.unit ? ` ${telemetry.unit}` : ""}`;
    }
  });

  session.addEventListener("tx", (event) => {
    appendLog("tx", "TX", bytesToHex(event.detail.bytes));
  });

  session.addEventListener("error", (event) => {
    appendLog("error", "错误", event.detail.error?.message ?? String(event.detail.error));
  });
}

function selectDevice(deviceId) {
  state.deviceId = deviceId === CUSTOM_DEVICE_ID ? CUSTOM_DEVICE_ID : DEFAULT_DEVICE_ID;
  state.pageId = state.deviceId;

  if (state.deviceId === CUSTOM_DEVICE_ID) {
    state.mode = "custom";
    state.setpoint = normalizeCustomConfig(customConfig).defaultValue;
  } else {
    state.mode = document.querySelector("input[name='outputMode']:checked")?.value ?? "current";
    const config = getModeConfig(state.mode, state.deviceId, customConfig);
    state.setpoint = config.presets.mid;
  }

  chart.clear();
  elements.chartValue.textContent = "暂无数据";
  updatePageUi();
  updateDeviceUi();
  appendLog("info", "设备", `已切换到 ${getDeviceProfile(state.deviceId, customConfig).name}`);
}

function navigateToPage(pageId) {
  if (pageId === "aomaster" || pageId === CUSTOM_DEVICE_ID) {
    selectDevice(pageId);
    return;
  }

  state.pageId = pageId === "request" ? "request" : "home";
  updatePageUi();
  updateDeviceUi();
}

function updateSecureState() {
  const supported = SerialSession.isSupported();

  if (!window.isSecureContext) {
    elements.secureState.textContent = "需要 HTTPS 或 localhost";
    elements.secureState.classList.add("warning");
    elements.connectButton.disabled = true;
    return;
  }

  if (!supported) {
    elements.secureState.textContent = "浏览器不支持 Web Serial";
    elements.secureState.classList.add("warning");
    elements.connectButton.disabled = true;
    return;
  }

  elements.secureState.textContent = "Web Serial 可用";
  elements.secureState.classList.remove("warning");
}

function updateDeviceUi() {
  const profile = getDeviceProfile(state.deviceId, customConfig);
  const isCustom = state.deviceId === CUSTOM_DEVICE_ID;
  elements.customDeviceNavName.textContent = normalizeCustomConfig(customConfig).name;
  elements.customConfigPanel.hidden = !isCustom;
  elements.aomasterIntroPanel.hidden = isCustom;
  elements.modeRow.hidden = isCustom;
  elements.selectedDeviceSummary.textContent = isCustom
    ? `当前选择 ${profile.name}；设定范围、发送模板和回包解析规则可在下方配置。`
    : `当前选择 ${profile.name}；协议未定时，参数先记录在页面状态，可通过手动命令调试。`;

  elements.deviceItems.forEach((button) => {
    button.classList.toggle("active", button.dataset.deviceId === state.deviceId && isDevicePageActive());
  });

  if (!isCustom) {
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

  elements.pageTargets.forEach((target) => {
    const targetPage = target.dataset.pageTarget;
    const isActive =
      targetPage === state.pageId ||
      (isDevicePageActive() && target.dataset.deviceId === state.deviceId);
    target.classList.toggle("active", isActive);
  });
}

function isDevicePageActive() {
  return state.pageId === DEFAULT_DEVICE_ID || state.pageId === CUSTOM_DEVICE_ID;
}

function updateSetpoint(value) {
  const config = getModeConfig(state.mode, state.deviceId, customConfig);
  const bounded = Math.min(config.max, Math.max(config.min, value));
  state.setpoint = Number.isFinite(bounded) ? bounded : config.presets.mid;
  updateSetpointUi();
}

function updateSetpointUi() {
  const config = getModeConfig(state.mode, state.deviceId, customConfig);
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

  const command = createDeviceSetOutputCommand(state.deviceId, state, customConfig);
  elements.protocolPreview.textContent = command.preview;
  elements.sendDriverCommand.disabled = !command.supported || !session.connected;
  elements.driverState.textContent = command.supported ? "模板可发送" : "协议待配置";
  elements.driverState.classList.toggle("warning", !command.supported);
}

function updateConnectionUi(connected) {
  elements.connectButton.disabled = connected || !window.isSecureContext || !SerialSession.isSupported();
  elements.disconnectButton.disabled = !connected;
  elements.sendManual.disabled = !connected;
  elements.connectionState.textContent = connected ? "已连接" : "未连接";
  elements.connectionState.classList.toggle("connected", connected);
  updateSetpointUi();
}

function updateCustomDraftConfig() {
  customConfig = readCustomConfigForm();

  if (state.deviceId === CUSTOM_DEVICE_ID) {
    state.mode = "custom";
    const config = getModeConfig(state.mode, state.deviceId, customConfig);
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

async function connectSerial() {
  try {
    const options = {
      baudRate: Number(elements.baudRate.value),
      dataBits: Number(elements.dataBits.value),
      stopBits: Number(elements.stopBits.value),
      parity: elements.parity.value,
      flowControl: elements.flowControl.value,
    };
    await session.connect(options);
  } catch (error) {
    appendLog("error", "连接", error.message);
  }
}

async function disconnectSerial() {
  await session.disconnect();
}

async function sendDeviceCommand() {
  try {
    const command = createDeviceSetOutputCommand(state.deviceId, state, customConfig);
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
