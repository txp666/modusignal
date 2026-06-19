import { MODUSIGNAL_APP } from "./config.js";
import i18n from "./i18n.js";
import {
  AOMASTER_DEVICE_ID,
  DEFAULT_AOMASTER_CONFIG,
  normalizeAomasterConfig,
} from "./devices/aomaster.js";
import {
  CUSTOM_DEVICE_ID,
  DEFAULT_CUSTOM_CONFIG,
  normalizeCustomConfig,
} from "./devices/custom-device.js";
import {
  DEFAULT_MODBUS_CONFIG,
  MODBUS_DEVICE_ID,
  normalizeModbusConfig,
} from "./devices/modbus-device.js";
import {
  DEFAULT_HART_CONFIG,
  HART_DEVICE_ID,
  normalizeHartConfig,
} from "./devices/hart-device.js";
import {
  DEFAULT_MQTT_CONFIG,
  MQTT_DEVICE_ID,
  normalizeMqttConfig,
} from "./devices/mqtt-device.js";
import {
  DEFAULT_WEBSOCKET_CONFIG,
  WEBSOCKET_DEVICE_ID,
  normalizeWebSocketConfig,
} from "./devices/websocket-device.js";
import {
  DEVICE_PAGE_IDS,
  DEVICE_PROFILES,
  DEVICE_REGISTRY,
  getDeviceRegistryEntry,
} from "./device-registry.js";

export {
  CUSTOM_DEVICE_ID,
  DEFAULT_AOMASTER_CONFIG,
  DEFAULT_CUSTOM_CONFIG,
  DEFAULT_MODBUS_CONFIG,
  MODBUS_DEVICE_ID,
  MODUSIGNAL_APP,
  normalizeAomasterConfig,
  normalizeCustomConfig,
  normalizeModbusConfig,
};

export {
  DEFAULT_HART_CONFIG,
  HART_DEVICE_ID,
  normalizeHartConfig,
} from "./devices/hart-device.js";

export {
  DEFAULT_MQTT_CONFIG,
  MQTT_DEVICE_ID,
  normalizeMqttConfig,
} from "./devices/mqtt-device.js";

export {
  DEFAULT_WEBSOCKET_CONFIG,
  WEBSOCKET_DEVICE_ID,
  normalizeWebSocketConfig,
} from "./devices/websocket-device.js";

export {
  DEVICE_PAGE_IDS,
  DEVICE_PROFILES,
  DEVICE_REGISTRY,
  getDeviceRegistryEntry,
  isStandaloneDevice,
} from "./device-registry.js";

export {
  MICROSCOPE_POWER_DEVICE_ID,
} from "./devices/microscope-power.js";

export const DEFAULT_DEVICE_ID = AOMASTER_DEVICE_ID;

function buildDeviceContext({
  customConfig = DEFAULT_CUSTOM_CONFIG,
  modbusConfig = DEFAULT_MODBUS_CONFIG,
  aomasterConfig = DEFAULT_AOMASTER_CONFIG,
  hartConfig = DEFAULT_HART_CONFIG,
  websocketConfig = DEFAULT_WEBSOCKET_CONFIG,
  mqttConfig = DEFAULT_MQTT_CONFIG,
  deviceState = null,
} = {}) {
  return {
    customConfig,
    modbusConfig,
    aomasterConfig,
    hartConfig,
    websocketConfig,
    mqttConfig,
    deviceState,
  };
}

function buildCommandHelpers() {
  return {
    bytesToHex,
    parseHexPayload,
    resolveLineEnding,
  };
}

function buildParseHelpers() {
  return {
    bytesToHex,
    parseHexPayload,
    parseNumericTelemetry,
  };
}

export function getDeviceProfile(
  deviceId = DEFAULT_DEVICE_ID,
  customConfig = DEFAULT_CUSTOM_CONFIG,
  modbusConfig = DEFAULT_MODBUS_CONFIG,
) {
  const entry = getDeviceRegistryEntry(deviceId);
  if (entry?.getProfile) {
    return entry.getProfile(buildDeviceContext({ customConfig, modbusConfig }));
  }

  return DEVICE_PROFILES[DEFAULT_DEVICE_ID];
}

export function listDeviceLibrary(customConfig = DEFAULT_CUSTOM_CONFIG, modbusConfig = DEFAULT_MODBUS_CONFIG) {
  const ctx = buildDeviceContext({ customConfig, modbusConfig });
  const entries = DEVICE_REGISTRY.map((entry) => ({
    deviceId: entry.id,
    pageTarget: entry.id,
    profile: entry.getProfile(ctx),
  }));

  return entries.sort((left, right) => {
    const leftHasImage = Boolean(left.profile.image);
    const rightHasImage = Boolean(right.profile.image);

    if (leftHasImage !== rightHasImage) {
      return leftHasImage ? -1 : 1;
    }

    return left.profile.name.localeCompare(right.profile.name, "zh-CN");
  });
}

export function getModeConfig(
  mode,
  deviceId = DEFAULT_DEVICE_ID,
  customConfig = DEFAULT_CUSTOM_CONFIG,
  modbusConfig = DEFAULT_MODBUS_CONFIG,
) {
  const profile = getDeviceProfile(deviceId, customConfig, modbusConfig);
  const modes = profile.modes;

  if (!modes) {
    return {
      label: i18n("chart.singleCurve"),
      unit: "",
      min: 0,
      max: 100,
      step: 1,
      presets: { low: 0, mid: 50, high: 100 },
    };
  }

  return modes[mode] ?? modes.custom ?? modes.current ?? modes.readHolding;
}

export function getDeviceDefaultTransportId(
  deviceId = DEFAULT_DEVICE_ID,
  customConfig = DEFAULT_CUSTOM_CONFIG,
  modbusConfig = DEFAULT_MODBUS_CONFIG,
) {
  return getDeviceProfile(deviceId, customConfig, modbusConfig).defaultTransportId ?? "serial";
}

export function createDeviceSetOutputCommand(
  deviceId,
  state,
  customConfig = DEFAULT_CUSTOM_CONFIG,
  modbusConfig = DEFAULT_MODBUS_CONFIG,
  aomasterConfig = DEFAULT_AOMASTER_CONFIG,
  hartConfig = DEFAULT_HART_CONFIG,
  websocketConfig = DEFAULT_WEBSOCKET_CONFIG,
  mqttConfig = DEFAULT_MQTT_CONFIG,
) {
  const entry = getDeviceRegistryEntry(deviceId);
  if (!entry?.createCommand) {
    return {
      supported: false,
      preview: i18n("protocol.noDeviceDriver"),
      bytes: null,
    };
  }

  return entry.createCommand(
    state,
    buildDeviceContext({ customConfig, modbusConfig, aomasterConfig, hartConfig, websocketConfig, mqttConfig }),
    buildCommandHelpers(),
  );
}

export function parseDeviceTelemetry(
  deviceId,
  text,
  customConfig = DEFAULT_CUSTOM_CONFIG,
  modbusConfig = DEFAULT_MODBUS_CONFIG,
  bytes = null,
  deviceState = null,
  aomasterConfig = DEFAULT_AOMASTER_CONFIG,
  hartConfig = DEFAULT_HART_CONFIG,
  websocketConfig = DEFAULT_WEBSOCKET_CONFIG,
  mqttConfig = DEFAULT_MQTT_CONFIG,
) {
  const entry = getDeviceRegistryEntry(deviceId);
  if (!entry?.parseTelemetry) {
    return null;
  }

  return entry.parseTelemetry(
    text,
    bytes,
    buildDeviceContext({
      customConfig,
      modbusConfig,
      aomasterConfig,
      hartConfig,
      websocketConfig,
      mqttConfig,
      deviceState,
    }),
    buildParseHelpers(),
  );
}

export function parseNumericTelemetry(text) {
  const normalized = text.replace(/,/g, " ");
  const matches = normalized.match(/[+-]?(?:\d+\.?\d*|\.\d+)/g);

  if (!matches || matches.length === 0) {
    return null;
  }

  const value = Number(matches[matches.length - 1]);
  return Number.isFinite(value) ? value : null;
}

export function buildManualPayload(format, command, lineEnding) {
  if (format === "hex") {
    return parseHexPayload(command);
  }

  if (format === "json") {
    const trimmed = command.trim();
    if (!trimmed) {
      throw new Error(i18n("protocol.jsonNotEmpty"));
    }

    try {
      JSON.parse(trimmed);
    } catch (error) {
      throw new Error(i18n("protocol.jsonInvalid") + ": " + error.message);
    }

    return trimmed;
  }

  return `${command}${lineEnding}`;
}

export function parseHexPayload(input) {
  const tokens = input
    .trim()
    .replace(/0x/gi, "")
    .split(/[\s,;:-]+/)
    .filter(Boolean);

  if (tokens.length === 0) {
    throw new Error(i18n("protocol.hexNotEmpty"));
  }

  const bytes = tokens.map((token) => {
    if (!/^[0-9a-fA-F]{1,2}$/.test(token)) {
      throw new Error(i18n("protocol.hexByteInvalid") + ": " + token);
    }

    return Number.parseInt(token, 16);
  });

  return new Uint8Array(bytes);
}

export function bytesToHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0").toUpperCase()).join(" ");
}

export function resolveLineEnding(value) {
  if (value === "\\n") {
    return "\n";
  }

  if (value === "\\r\\n") {
    return "\r\n";
  }

  return "";
}
