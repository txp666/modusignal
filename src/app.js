import { LiveChart } from "./chart.js";
import { SerialSession } from "./serial.js";
import {
  AOMASTER_PROFILE,
  buildManualPayload,
  bytesToHex,
  createAOMasterSetOutputCommand,
  getModeConfig,
  parseNumericTelemetry,
} from "./protocols.js";

const elements = {
  secureState: document.querySelector("#secureState"),
  connectButton: document.querySelector("#connectButton"),
  disconnectButton: document.querySelector("#disconnectButton"),
  connectionState: document.querySelector("#connectionState"),
  baudRate: document.querySelector("#baudRate"),
  dataBits: document.querySelector("#dataBits"),
  stopBits: document.querySelector("#stopBits"),
  parity: document.querySelector("#parity"),
  flowControl: document.querySelector("#flowControl"),
  driverState: document.querySelector("#driverState"),
  outputModes: [...document.querySelectorAll("input[name='outputMode']")],
  setpointLabel: document.querySelector("#setpointLabel"),
  setpointReadout: document.querySelector("#setpointReadout"),
  setpointSlider: document.querySelector("#setpointSlider"),
  setpointInput: document.querySelector("#setpointInput"),
  setpointUnit: document.querySelector("#setpointUnit"),
  protocolPreview: document.querySelector("#protocolPreview"),
  sendDriverCommand: document.querySelector("#sendDriverCommand"),
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

const state = {
  mode: "current",
  setpoint: 12,
};

initialize();

function initialize() {
  updateSecureState();
  updateSetpointUi();
  updateConnectionUi(false);
  bindEvents();
  appendLog("info", "系统", `${AOMASTER_PROFILE.name} 工作台已就绪`);
}

function bindEvents() {
  elements.connectButton.addEventListener("click", connectSerial);
  elements.disconnectButton.addEventListener("click", disconnectSerial);
  elements.setpointSlider.addEventListener("input", (event) => updateSetpoint(Number(event.target.value)));
  elements.setpointInput.addEventListener("change", (event) => updateSetpoint(Number(event.target.value)));
  elements.sendManual.addEventListener("click", sendManualCommand);
  elements.clearLog.addEventListener("click", () => {
    elements.serialLog.innerHTML = "";
    appendLog("info", "系统", "日志已清空");
  });
  elements.clearChart.addEventListener("click", () => {
    chart.clear();
    elements.chartValue.textContent = "暂无数据";
  });

  elements.outputModes.forEach((input) => {
    input.addEventListener("change", () => {
      if (input.checked) {
        state.mode = input.value;
        const config = getModeConfig(state.mode);
        state.setpoint = config.presets.mid;
        updateSetpointUi();
      }
    });
  });

  document.querySelectorAll("[data-preset]").forEach((button) => {
    button.addEventListener("click", () => {
      const config = getModeConfig(state.mode);
      updateSetpoint(config.presets[button.dataset.preset]);
    });
  });

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

    const telemetry = parseNumericTelemetry(text);
    if (telemetry !== null) {
      chart.add(telemetry);
      elements.chartValue.textContent = `最新值 ${telemetry.toFixed(3)}`;
    }
  });

  session.addEventListener("tx", (event) => {
    appendLog("tx", "TX", bytesToHex(event.detail.bytes));
  });

  session.addEventListener("error", (event) => {
    appendLog("error", "错误", event.detail.error?.message ?? String(event.detail.error));
  });
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

function updateSetpoint(value) {
  const config = getModeConfig(state.mode);
  const bounded = Math.min(config.max, Math.max(config.min, value));
  state.setpoint = Number.isFinite(bounded) ? bounded : config.presets.mid;
  updateSetpointUi();
}

function updateSetpointUi() {
  const config = getModeConfig(state.mode);
  const formatted = state.setpoint.toFixed(3);

  elements.setpointLabel.textContent = config.label;
  elements.setpointReadout.textContent = `${formatted} ${config.unit}`;
  elements.setpointUnit.textContent = config.unit;
  elements.setpointSlider.min = String(config.min);
  elements.setpointSlider.max = String(config.max);
  elements.setpointSlider.step = String(config.step);
  elements.setpointSlider.value = String(state.setpoint);
  elements.setpointInput.min = String(config.min);
  elements.setpointInput.max = String(config.max);
  elements.setpointInput.step = String(config.step);
  elements.setpointInput.value = formatted;

  const command = createAOMasterSetOutputCommand(state);
  elements.protocolPreview.textContent = command.preview;
  elements.sendDriverCommand.disabled = !command.supported || !session.connected;
  elements.driverState.textContent = command.supported ? "协议可发送" : "协议待配置";
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

function resolveLineEnding(value) {
  if (value === "\\n") {
    return "\n";
  }

  if (value === "\\r\\n") {
    return "\r\n";
  }

  return "";
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
