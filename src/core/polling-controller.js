import i18n from "../i18n.js";
import { isReadFunctionCode } from "../modbus/modbus.js";
import {
  CUSTOM_DEVICE_ID,
  DEFAULT_DEVICE_ID,
  HART_DEVICE_ID,
  MODBUS_DEVICE_ID,
  MQTT_DEVICE_ID,
  WEBSOCKET_DEVICE_ID,
  createDeviceSetOutputCommand,
  isStandaloneDevice,
  normalizeAomasterConfig,
  normalizeModbusConfig,
  normalizeMqttConfig,
  normalizeWebSocketConfig,
} from "../protocols.js";
import { normalizeHartConfig } from "../devices/hart-device.js";

const DEVICE_LABELS = {
  [DEFAULT_DEVICE_ID]: "AOMaster",
  [MODBUS_DEVICE_ID]: "Modbus",
  [HART_DEVICE_ID]: "HART",
  [WEBSOCKET_DEVICE_ID]: "WebSocket",
  [MQTT_DEVICE_ID]: "MQTT",
};

export function createPollingController(options) {
  const { elements, state, getSession, getConfigs, sendDeviceCommand, sendHartPoll, sendAomasterPoll, appendLog } = options;
  const timers = new Map();

  function stop(deviceId) {
    const timer = timers.get(deviceId);
    if (timer) window.clearInterval(timer);
    timers.delete(deviceId);
  }

  function stopAll() {
    [...timers.keys()].forEach(stop);
  }

  function getInterval() {
    const configs = getConfigs();
    if (state.deviceId === MODBUS_DEVICE_ID) return normalizeModbusConfig(configs.modbusConfig).pollIntervalMs;
    if (state.deviceId === HART_DEVICE_ID) return normalizeHartConfig(configs.hartConfig).pollIntervalMs;
    if (state.deviceId === WEBSOCKET_DEVICE_ID) return normalizeWebSocketConfig(configs.websocketConfig).pollIntervalMs;
    if (state.deviceId === MQTT_DEVICE_ID) return normalizeMqttConfig(configs.mqttConfig).pollIntervalMs;
    if (state.deviceId === DEFAULT_DEVICE_ID) return normalizeAomasterConfig(configs.aomasterConfig).pollIntervalMs;
    return 0;
  }

  function canPoll() {
    const session = getSession();
    const configs = getConfigs();
    if (!session?.connected || state.deviceId === CUSTOM_DEVICE_ID || getInterval() <= 0) return false;
    if (state.deviceId === MODBUS_DEVICE_ID) {
      return isReadFunctionCode(normalizeModbusConfig(configs.modbusConfig).functionCode);
    }
    if (state.deviceId === HART_DEVICE_ID) return normalizeHartConfig(configs.hartConfig).device.discovered;
    if (state.deviceId === WEBSOCKET_DEVICE_ID || state.deviceId === MQTT_DEVICE_ID) {
      return createDeviceSetOutputCommand(
        state.deviceId,
        state,
        configs.customConfig,
        configs.modbusConfig,
        configs.aomasterConfig,
        configs.hartConfig,
        configs.websocketConfig,
        configs.mqttConfig,
      ).supported;
    }
    return state.deviceId === DEFAULT_DEVICE_ID;
  }

  function schedule(deviceId, callback, interval) {
    stop(deviceId);
    if (state.deviceId !== deviceId || !getSession()?.connected || !state.pollingActive || interval <= 0) return;
    timers.set(deviceId, window.setInterval(() => {
      callback().catch((error) => appendLog("error", DEVICE_LABELS[deviceId], error.message));
    }, interval));
  }

  function updateActive() {
    const configs = getConfigs();
    const modbus = normalizeModbusConfig(configs.modbusConfig);
    if (isReadFunctionCode(modbus.functionCode)) schedule(MODBUS_DEVICE_ID, sendDeviceCommand, modbus.pollIntervalMs);
    else stop(MODBUS_DEVICE_ID);
    const hart = normalizeHartConfig(configs.hartConfig);
    schedule(HART_DEVICE_ID, sendHartPoll, hart.pollIntervalMs);
    const aomaster = normalizeAomasterConfig(configs.aomasterConfig);
    schedule(DEFAULT_DEVICE_ID, sendAomasterPoll, aomaster.pollIntervalMs);
    const websocket = normalizeWebSocketConfig(configs.websocketConfig);
    if (websocket.heartbeatMessage.trim()) schedule(WEBSOCKET_DEVICE_ID, sendDeviceCommand, websocket.pollIntervalMs);
    else stop(WEBSOCKET_DEVICE_ID);
    const mqtt = normalizeMqttConfig(configs.mqttConfig);
    if (mqtt.heartbeatMessage.trim()) schedule(MQTT_DEVICE_ID, sendDeviceCommand, mqtt.pollIntervalMs);
    else stop(MQTT_DEVICE_ID);
  }

  function updateUi() {
    if (!elements.togglePolling) return;
    if (isStandaloneDevice(state.deviceId)) {
      state.pollingActive = false;
      stopAll();
      elements.pollState?.classList.remove("connected");
      if (elements.pollState) elements.pollState.textContent = i18n("workbench.pollNotSupported");
      elements.togglePolling.disabled = true;
      elements.togglePolling.textContent = i18n("workbench.startPolling");
      return;
    }
    if (state.pollingActive && !canPoll()) {
      state.pollingActive = false;
      stopAll();
    }
    const connected = Boolean(getSession()?.connected);
    const available = canPoll();
    const interval = getInterval();
    if (elements.pollState) {
      elements.pollState.classList.toggle("connected", state.pollingActive && connected);
      const configs = getConfigs();
      if (!connected) elements.pollState.textContent = i18n("nav.notConnected");
      else if (state.deviceId === CUSTOM_DEVICE_ID) elements.pollState.textContent = i18n("workbench.pollNotSupported");
      else if (state.deviceId === MODBUS_DEVICE_ID && !isReadFunctionCode(normalizeModbusConfig(configs.modbusConfig).functionCode)) {
        elements.pollState.textContent = i18n("workbench.pollNeedRead");
      } else if (state.deviceId === HART_DEVICE_ID && !available) elements.pollState.textContent = i18n("workbench.pollNeedSearch");
      else if ((state.deviceId === WEBSOCKET_DEVICE_ID || state.deviceId === MQTT_DEVICE_ID) && !available) {
        elements.pollState.textContent = i18n("workbench.pollNeedConfig");
      } else if (interval <= 0) elements.pollState.textContent = i18n("workbench.pollNeedInterval");
      else if (state.pollingActive) elements.pollState.textContent = `${i18n("workbench.polling")} · ${interval} ms`;
      else elements.pollState.textContent = i18n("workbench.pollStopped");
    }
    elements.togglePolling.disabled = !connected || !available;
    elements.togglePolling.textContent = state.pollingActive ? i18n("workbench.stopPolling") : i18n("workbench.startPolling");
  }

  function toggle() {
    if (!getSession()?.connected || !canPoll()) return;
    state.pollingActive = !state.pollingActive;
    if (state.pollingActive) {
      updateActive();
      appendLog("info", i18n("poll.category"), `${i18n("poll.startedPrefix")} ${getInterval()} ms`);
    } else {
      stopAll();
      appendLog("info", i18n("poll.category"), i18n("poll.stopped"));
    }
    updateUi();
  }

  return { canPoll, getInterval, stopAll, toggle, updateActive, updateUi };
}
