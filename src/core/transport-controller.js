import i18n from "../i18n.js";
import { AOMASTER_DEVICE_ID, AOMASTER_TRANSPORT_DEFAULTS } from "../devices/aomaster.js";
import { CUSTOM_TRANSPORT_DEFAULTS } from "../devices/custom-device.js";
import {
  MODBUS_TRANSPORT_DEFAULTS,
  MODBUS_WEBSOCKET_TRANSPORT_DEFAULTS,
} from "../devices/modbus-device.js";
import { HART_DEVICE_ID, HART_TRANSPORT_DEFAULTS } from "../devices/hart-device.js";
import { MQTT_DEVICE_TRANSPORT_DEFAULTS, MQTT_DEVICE_ID } from "../devices/mqtt-device.js";
import { WEBSOCKET_DEVICE_ID, WEBSOCKET_TRANSPORT_DEFAULTS } from "../devices/websocket-device.js";
import {
  CUSTOM_DEVICE_ID,
  MODBUS_DEVICE_ID,
  getDeviceDefaultTransportId,
  isStandaloneDevice,
} from "../protocols.js";
import {
  DEFAULT_TRANSPORT_ID,
  createTransportSession,
  getTransportDescriptor,
  listTransports,
} from "../transports/registry.js";
import {
  MQTT_CONNECT_DEFAULTS,
  MQTT_TRANSPORT_ID,
  describeMqttUrlWarning,
} from "../transports/mqtt.js";
import {
  WEBSOCKET_CONNECT_DEFAULTS,
  WEBSOCKET_TRANSPORT_ID,
  describeWebSocketUrlWarning,
} from "../transports/websocket.js";

const DEVICE_DEFAULTS = {
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

export function createTransportController(options) {
  const {
    elements,
    state,
    getConfigs,
    getSession,
    setSession,
    bindSessionEvents,
    appendLog,
    updateWebSocketStats,
    updateMqttDebugger,
    updateSetpointUi,
    updatePollingUi,
    updateDeviceUi,
    detectHartLink,
  } = options;
  let transportOptions = {};

  function getDeviceDefaults(deviceId = state.deviceId) {
    const entry = DEVICE_DEFAULTS[deviceId];
    if (!entry) return null;
    const { customConfig, modbusConfig } = getConfigs();
    const preferred = getDeviceDefaultTransportId(deviceId, customConfig, modbusConfig);
    return entry[state.transportId] ?? entry[preferred] ?? entry[DEFAULT_TRANSPORT_ID] ?? null;
  }

  function readOptions() {
    const values = {};
    elements.transportFields.querySelectorAll("[data-field-key]").forEach((control) => {
      const { fieldKey, fieldType } = control.dataset;
      values[fieldKey] = fieldType === "number" ? Number(control.value) : control.value;
    });
    transportOptions = { ...transportOptions, ...values };
    return values;
  }

  function readCurrentField(key) {
    try {
      return String(readOptions()[key] ?? "").trim();
    } catch {
      return "";
    }
  }

  function describeDefaults(deviceId) {
    if (state.transportId === MQTT_TRANSPORT_ID) return i18n("transport.defaults.mqtt");
    if (state.transportId === WEBSOCKET_TRANSPORT_ID) {
      if (deviceId === MODBUS_DEVICE_ID) return i18n("transport.defaults.modbusWs");
      if (deviceId === WEBSOCKET_DEVICE_ID) return i18n("transport.defaults.wsDebug");
      if (deviceId === MQTT_DEVICE_ID) return i18n("transport.defaults.mqttDebug");
      return i18n("transport.defaults.ws");
    }
    if (deviceId === HART_DEVICE_ID) return i18n("transport.defaults.hart");
    if (deviceId === AOMASTER_DEVICE_ID) return i18n("transport.defaults.aomaster");
    if (deviceId === MODBUS_DEVICE_ID) return i18n("transport.defaults.modbus");
    if (deviceId === CUSTOM_DEVICE_ID) return i18n("transport.defaults.custom");
    return i18n("transport.defaults.generic");
  }

  function applyDeviceTransportDefaults(deviceId = state.deviceId) {
    const defaults = getDeviceDefaults(deviceId);
    if (!defaults || !elements.transportFields) return false;
    let changed = false;
    Object.entries(defaults).forEach(([key, value]) => {
      const control = elements.transportFields.querySelector(`[data-field-key="${key}"]`);
      if (!control) return;
      const nextValue = String(value);
      changed ||= control.value !== nextValue;
      transportOptions[key] = value;
      control.value = nextValue;
    });
    if (changed && getSession()?.connected) {
      appendLog(
        "info",
        i18n("log.connect"),
        `${i18n("log.switchedTransport")} ${describeDefaults(deviceId)}${i18n("conn.reconnectHint")}`,
      );
    }
    return changed;
  }

  function setSecureStateText(text) {
    if (!elements.secureState) return;
    elements.secureState.textContent = text;
    elements.secureState.dataset.marquee = text;
  }

  function describeConnectionSummary() {
    const descriptor = getTransportDescriptor(state.transportId);
    const values = readOptions();
    if (state.transportId === MQTT_TRANSPORT_ID) {
      return `${i18n("conn.mqttConnected")} · ${values.brokerUrl} · ${i18n("conn.subscribed")} ${values.subscribeTopic}`;
    }
    if (state.transportId === WEBSOCKET_TRANSPORT_ID) return `${i18n("conn.wsConnected")} · ${values.url}`;
    if (state.transportId === DEFAULT_TRANSPORT_ID) {
      const parity = values.parity === "none" ? "N" : values.parity === "even" ? "E" : "O";
      return `${i18n("conn.serialConnected")} · ${values.baudRate} ${values.dataBits}${parity}${values.stopBits}`;
    }
    return i18n(descriptor.label) + i18n("conn.connected");
  }

  function syncSecureState(connected) {
    if (!elements.secureState) return;
    if (connected) {
      setSecureStateText(describeConnectionSummary());
      elements.secureState.classList.remove("warning");
      elements.secureState.classList.add("connected");
    } else {
      elements.secureState.classList.remove("connected");
      updateSecureState();
    }
  }

  function updateSecureState() {
    if (getSession()?.connected) {
      syncSecureState(true);
      return;
    }
    const descriptor = getTransportDescriptor(state.transportId);
    let warning = "";
    if (descriptor.requiresSecureContext && !window.isSecureContext) warning = i18n("env.needHttps");
    else if (!descriptor.isSupported()) warning = i18n("env.notSupported") + i18n(descriptor.label);
    else if (state.transportId === WEBSOCKET_TRANSPORT_ID) warning = describeWebSocketUrlWarning(readOptions().url);
    else if (state.transportId === MQTT_TRANSPORT_ID) warning = describeMqttUrlWarning(readOptions().brokerUrl);
    if (warning) {
      setSecureStateText(warning);
      elements.secureState.classList.add("warning");
      elements.connectButton.disabled = true;
      return;
    }
    setSecureStateText(i18n(descriptor.label) + i18n("env.available"));
    elements.secureState.classList.remove("warning");
  }

  function transportReady() {
    if (isStandaloneDevice(state.deviceId)) return false;
    const descriptor = getTransportDescriptor(state.transportId);
    return descriptor.isSupported() && (!descriptor.requiresSecureContext || window.isSecureContext);
  }

  function updateConnectionUi(connected) {
    const standalone = isStandaloneDevice(state.deviceId);
    elements.connectButton.disabled = standalone || connected || !transportReady();
    elements.disconnectButton.disabled = !connected;
    elements.sendManual.disabled = !connected;
    elements.transportSelect.disabled = standalone || connected;
    elements.connectionState.textContent = connected ? i18n("nav.connected") : i18n("nav.notConnected");
    elements.connectionState.classList.toggle("connected", connected);
    if (connected) elements.connectionState.title = describeConnectionSummary();
    else elements.connectionState.removeAttribute("title");
    syncSecureState(connected);
    updateSetpointUi();
    updatePollingUi();
    if (connected) updateDeviceUi();
  }

  function renderFields() {
    const descriptor = getTransportDescriptor(state.transportId);
    elements.transportFields.innerHTML = "";
    descriptor.fields.forEach((field) => {
      const label = document.createElement("label");
      label.textContent = i18n(field.label, field.label);
      const control = field.type === "select" ? document.createElement("select") : document.createElement("input");
      control.dataset.fieldKey = field.key;
      control.dataset.fieldType = typeof field.default === "number" ? "number" : "string";
      const defaults = getDeviceDefaults();
      const resolved = defaults?.[field.key] ?? transportOptions[field.key] ?? field.default;
      if (field.type === "select") {
        (field.options ?? []).forEach((entry) => {
          const value = typeof entry === "object" ? entry.value : entry;
          const option = document.createElement("option");
          option.value = String(value);
          option.textContent = typeof entry === "object" ? entry.label : String(entry);
          option.selected = value === resolved;
          control.append(option);
        });
      } else {
        control.type = field.type === "number" ? "number" : "text";
        control.value = resolved ?? "";
      }
      label.append(control);
      elements.transportFields.append(label);
      if (state.transportId === WEBSOCKET_TRANSPORT_ID && field.key === "url") {
        const handler = () => { updateSecureState(); updateWebSocketStats(); };
        control.addEventListener("input", handler);
        control.addEventListener("change", handler);
      }
      if (state.transportId === MQTT_TRANSPORT_ID) {
        const handler = field.key === "brokerUrl"
          ? () => { updateSecureState(); updateMqttDebugger(); }
          : updateMqttDebugger;
        control.addEventListener("input", handler);
        control.addEventListener("change", handler);
      }
    });
    applyDeviceTransportDefaults();
    updateSecureState();
  }

  function populateSelect() {
    elements.transportSelect.innerHTML = "";
    listTransports().forEach((descriptor) => {
      const option = document.createElement("option");
      option.value = descriptor.id;
      option.textContent = i18n(descriptor.label);
      elements.transportSelect.append(option);
    });
    elements.transportSelect.value = state.transportId;
  }

  async function setTransport(transportId) {
    const current = getSession();
    if (current?.connected) {
      await current.disconnect().catch((error) => appendLog("error", i18n("log.connect"), error.message));
    }
    state.transportId = getTransportDescriptor(transportId).id;
    elements.transportSelect.value = state.transportId;
    const next = createTransportSession(state.transportId);
    setSession(next);
    bindSessionEvents(next);
    renderFields();
    updateSecureState();
    updateConnectionUi(false);
  }

  function applyDeviceDefaultTransport(deviceId = state.deviceId) {
    const { customConfig, modbusConfig } = getConfigs();
    const defaultTransportId = getDeviceDefaultTransportId(deviceId, customConfig, modbusConfig);
    if (state.transportId !== defaultTransportId) void setTransport(defaultTransportId);
    else applyDeviceTransportDefaults(deviceId);
  }

  async function connect() {
    try {
      const session = getSession();
      await session.connect(readOptions());
      if (session?.connected) {
        updateConnectionUi(true);
        if (state.deviceId === HART_DEVICE_ID && state.transportId === DEFAULT_TRANSPORT_ID) detectHartLink(session);
      }
    } catch (error) {
      appendLog("error", i18n("log.connect"), error.message);
    }
  }

  async function disconnect() {
    await getSession()?.disconnect();
  }

  return {
    applyDeviceDefaultTransport,
    connect,
    describeConnectionSummary,
    disconnect,
    populateSelect,
    readCurrentField,
    readOptions,
    renderFields,
    setTransport,
    transportReady,
    updateConnectionUi,
    updateSecureState,
  };
}
