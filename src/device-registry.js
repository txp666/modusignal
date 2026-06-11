import {
  AOMASTER_DEVICE_ID,
  AOMASTER_PROFILE,
  createAOMasterSetOutputCommand,
  parseAOMasterTelemetry,
} from "./devices/aomaster.js";
import {
  createCustomProfile,
  createCustomSetOutputCommand,
  CUSTOM_DEVICE_ID,
  parseCustomTelemetry,
} from "./devices/custom-device.js";
import {
  createModbusProfile,
  createModbusSetOutputCommand,
  MODBUS_DEVICE_ID,
  MODBUS_PROFILE,
  parseModbusTelemetry,
} from "./devices/modbus-device.js";
import {
  createHartSetOutputCommand,
  HART_DEVICE_ID,
  HART_PROFILE,
  parseHartTelemetry,
} from "./devices/hart-device.js";
import {
  createMqttSetOutputCommand,
  MQTT_DEVICE_ID,
  MQTT_PROFILE,
  parseMqttTelemetry,
} from "./devices/mqtt-device.js";
import {
  createWebSocketSetOutputCommand,
  WEBSOCKET_DEVICE_ID,
  WEBSOCKET_PROFILE,
  parseWebSocketTelemetry,
} from "./devices/websocket-device.js";

/**
 * 设备注册表：新增设备时在此追加一条 entry，并补充 pagePath。
 * protocols.js 通过 lookup 分发 profile / 命令 / 遥测；page-loader 按 pagePath 加载 HTML。
 */
export const DEVICE_REGISTRY = [
  {
    id: AOMASTER_DEVICE_ID,
    pagePath: "pages/devices/aomaster.html",
    profile: AOMASTER_PROFILE,
    getProfile: () => AOMASTER_PROFILE,
    createCommand: (state, ctx, helpers) => createAOMasterSetOutputCommand(state, ctx.aomasterConfig, helpers),
    parseTelemetry: (text, bytes, ctx, helpers) => parseAOMasterTelemetry(bytes, ctx.aomasterConfig, ctx.deviceState?.mode),
  },
  {
    id: MODBUS_DEVICE_ID,
    pagePath: "pages/devices/modbus.html",
    profile: MODBUS_PROFILE,
    getProfile: (ctx) => createModbusProfile(ctx.modbusConfig),
    createCommand: (state, ctx, helpers) => createModbusSetOutputCommand(state, ctx.modbusConfig, helpers),
    parseTelemetry: (text, bytes, ctx) => parseModbusTelemetry(bytes, ctx.modbusConfig),
  },
  {
    id: HART_DEVICE_ID,
    pagePath: "pages/devices/hart.html",
    profile: HART_PROFILE,
    getProfile: () => HART_PROFILE,
    createCommand: (state, ctx, helpers) => createHartSetOutputCommand(state, ctx.hartConfig, helpers),
    parseTelemetry: (text, bytes, ctx) => parseHartTelemetry(bytes, ctx.hartConfig),
  },
  {
    id: CUSTOM_DEVICE_ID,
    pagePath: "pages/devices/custom.html",
    getProfile: (ctx) => createCustomProfile(ctx.customConfig),
    createCommand: (state, ctx, helpers) => createCustomSetOutputCommand(state, ctx.customConfig, helpers),
    parseTelemetry: (text, bytes, ctx, helpers) =>
      parseCustomTelemetry(text, ctx.customConfig, helpers.parseNumericTelemetry, bytes, helpers),
  },
  {
    id: MQTT_DEVICE_ID,
    pagePath: "pages/devices/mqtt.html",
    profile: MQTT_PROFILE,
    getProfile: () => MQTT_PROFILE,
    createCommand: (state, ctx, helpers) => createMqttSetOutputCommand(state, ctx.mqttConfig, helpers),
    parseTelemetry: (text, bytes, ctx, helpers) =>
      parseMqttTelemetry(text, bytes, ctx.mqttConfig, helpers.parseNumericTelemetry, helpers),
  },
  {
    id: WEBSOCKET_DEVICE_ID,
    pagePath: "pages/devices/websocket.html",
    profile: WEBSOCKET_PROFILE,
    getProfile: () => WEBSOCKET_PROFILE,
    createCommand: (state, ctx, helpers) => createWebSocketSetOutputCommand(state, ctx.websocketConfig, helpers),
    parseTelemetry: (text, bytes, ctx, helpers) =>
      parseWebSocketTelemetry(text, bytes, ctx.websocketConfig, helpers.parseNumericTelemetry, helpers),
  },
];

export const DEVICE_REGISTRY_BY_ID = Object.fromEntries(DEVICE_REGISTRY.map((entry) => [entry.id, entry]));

export const DEVICE_PAGE_IDS = DEVICE_REGISTRY.map((entry) => entry.id);

export const DEVICE_PROFILES = Object.fromEntries(
  DEVICE_REGISTRY.filter((entry) => entry.profile).map((entry) => [entry.id, entry.profile]),
);

export function getDeviceRegistryEntry(deviceId) {
  return DEVICE_REGISTRY_BY_ID[deviceId] ?? null;
}

export function listRegisteredDevicePagePaths() {
  return DEVICE_REGISTRY.map((entry) => entry.pagePath);
}
