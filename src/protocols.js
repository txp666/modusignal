import { MODUSIGNAL_APP } from "./config.js";
import {
  AOMASTER_DEVICE_ID,
  AOMASTER_PROFILE,
  createAOMasterSetOutputCommand,
  DEFAULT_AOMASTER_CONFIG,
  normalizeAomasterConfig,
  parseAOMasterTelemetry,
} from "./devices/aomaster.js";
import {
  createCustomProfile,
  createCustomSetOutputCommand,
  CUSTOM_DEVICE_ID,
  DEFAULT_CUSTOM_CONFIG,
  normalizeCustomConfig,
  parseCustomTelemetry,
} from "./devices/custom-device.js";
import {
  createModbusProfile,
  createModbusSetOutputCommand,
  DEFAULT_MODBUS_CONFIG,
  MODBUS_DEVICE_ID,
  MODBUS_PROFILE,
  normalizeModbusConfig,
  parseModbusTelemetry,
} from "./devices/modbus-device.js";
import {
  createHartSetOutputCommand,
  DEFAULT_HART_CONFIG,
  HART_DEVICE_ID,
  HART_PROFILE,
  normalizeHartConfig,
  parseHartTelemetry,
} from "./devices/hart-device.js";
import {
  createMqttSetOutputCommand,
  DEFAULT_MQTT_CONFIG,
  MQTT_DEVICE_ID,
  MQTT_PROFILE,
  normalizeMqttConfig,
  parseMqttTelemetry,
} from "./devices/mqtt-device.js";
import {
  createWebSocketSetOutputCommand,
  DEFAULT_WEBSOCKET_CONFIG,
  normalizeWebSocketConfig,
  parseWebSocketTelemetry,
  WEBSOCKET_DEVICE_ID,
  WEBSOCKET_PROFILE,
} from "./devices/websocket-device.js";

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

export const DEFAULT_DEVICE_ID = AOMASTER_DEVICE_ID;

export const DEVICE_PROFILES = {
  [AOMASTER_DEVICE_ID]: AOMASTER_PROFILE,
  [MODBUS_DEVICE_ID]: MODBUS_PROFILE,
  [HART_DEVICE_ID]: HART_PROFILE,
  [WEBSOCKET_DEVICE_ID]: WEBSOCKET_PROFILE,
  [MQTT_DEVICE_ID]: MQTT_PROFILE,
};

export function getDeviceProfile(
  deviceId = DEFAULT_DEVICE_ID,
  customConfig = DEFAULT_CUSTOM_CONFIG,
  modbusConfig = DEFAULT_MODBUS_CONFIG,
) {
  if (deviceId === CUSTOM_DEVICE_ID) {
    return createCustomProfile(customConfig);
  }

  if (deviceId === MODBUS_DEVICE_ID) {
    return createModbusProfile(modbusConfig);
  }

  return DEVICE_PROFILES[deviceId] ?? DEVICE_PROFILES[DEFAULT_DEVICE_ID];
}

export function listDeviceLibrary(customConfig = DEFAULT_CUSTOM_CONFIG, modbusConfig = DEFAULT_MODBUS_CONFIG) {
  const entries = [
    ...Object.values(DEVICE_PROFILES).map((profile) => ({
      deviceId: profile.id,
      pageTarget: profile.id,
      profile,
    })),
    {
      deviceId: CUSTOM_DEVICE_ID,
      pageTarget: CUSTOM_DEVICE_ID,
      profile: createCustomProfile(customConfig),
    },
  ];

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
      label: "数值",
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
  if (deviceId === CUSTOM_DEVICE_ID) {
    return createCustomSetOutputCommand(state, customConfig, {
      bytesToHex,
      parseHexPayload,
      resolveLineEnding,
    });
  }

  if (deviceId === MODBUS_DEVICE_ID) {
    return createModbusSetOutputCommand(state, modbusConfig, { bytesToHex });
  }

  if (deviceId === HART_DEVICE_ID) {
    return createHartSetOutputCommand(state, hartConfig, { bytesToHex, parseHexPayload });
  }

  if (deviceId === WEBSOCKET_DEVICE_ID) {
    return createWebSocketSetOutputCommand(state, websocketConfig, {
      bytesToHex,
      parseHexPayload,
    });
  }

  if (deviceId === MQTT_DEVICE_ID) {
    return createMqttSetOutputCommand(state, mqttConfig, {
      bytesToHex,
      parseHexPayload,
    });
  }

  if (deviceId === AOMASTER_DEVICE_ID) {
    return createAOMasterSetOutputCommand(state, aomasterConfig, { bytesToHex });
  }

  return {
    supported: false,
    preview: "未选择可发送的设备驱动",
    bytes: null,
  };
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
  if (deviceId === CUSTOM_DEVICE_ID) {
    return parseCustomTelemetry(text, customConfig, parseNumericTelemetry, bytes, { parseHexPayload });
  }

  if (deviceId === MODBUS_DEVICE_ID) {
    return parseModbusTelemetry(bytes, modbusConfig);
  }

  if (deviceId === HART_DEVICE_ID) {
    return parseHartTelemetry(bytes, hartConfig);
  }

  if (deviceId === WEBSOCKET_DEVICE_ID) {
    return parseWebSocketTelemetry(text, bytes, websocketConfig, parseNumericTelemetry, { parseHexPayload });
  }

  if (deviceId === MQTT_DEVICE_ID) {
    return parseMqttTelemetry(text, bytes, mqttConfig, parseNumericTelemetry, { parseHexPayload });
  }

  if (deviceId === AOMASTER_DEVICE_ID) {
    return parseAOMasterTelemetry(bytes, aomasterConfig, deviceState?.mode);
  }

  return null;
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
      throw new Error("JSON 命令不能为空");
    }

    try {
      JSON.parse(trimmed);
    } catch (error) {
      throw new Error(`JSON 格式无效：${error.message}`);
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
    throw new Error("HEX 命令不能为空");
  }

  const bytes = tokens.map((token) => {
    if (!/^[0-9a-fA-F]{1,2}$/.test(token)) {
      throw new Error(`HEX 字节无效：${token}`);
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
