import {
  DEFAULT_BINARY_MULTI_FIELDS,
  listHexChartSeries,
  listModbusChartSeries,
  normalizeBinaryCurveConfig,
} from "./binary-curve-config.js";
import {
  buildDebugMessage,
  createDebugFramingState,
  createModbusRxBuffer,
  describeDebugParserSummary,
  normalizeMessageFormat,
  normalizeParserMode,
  parseDebugTelemetry,
  resetDebugFramingState,
  resetModbusRxBuffer,
} from "./message-parser.js";
import { normalizeFramingConfig } from "../framing/framing-rx.js";
import {
  DEFAULT_JSON_CURVE_CONFIG,
  listJsonChartSeries,
  normalizeJsonCurveConfig,
} from "./json-curve-config.js";

export const MQTT_DEVICE_ID = "mqtt";

export const MQTT_DEVICE_TRANSPORT_DEFAULTS = {
  brokerUrl: "wss://broker.emqx.io:8084/mqtt",
  clientId: "modusignal",
  username: "",
  password: "",
  subscribeTopic: "modusignal/rx",
  publishTopic: "modusignal/tx",
};

export const MQTT_QUICK_MESSAGES = [
  {
    id: "hello",
    label: "Hello JSON",
    format: "json",
    message: '{"message":"Hello from modusignal","value":42}',
  },
  { id: "ping", label: "Ping", format: "json", message: '{"type":"ping"}' },
  { id: "sensor", label: "传感器", format: "json", message: '{"sensor":"temp","value":25.6,"unit":"C"}' },
  { id: "text", label: "测试文本", format: "ascii", message: "Hello MQTT!" },
];

export const DEFAULT_MQTT_CONFIG = {
  pollIntervalMs: 0,
  heartbeatFormat: "json",
  heartbeatMessage: '{"type":"ping"}',
  parserMode: "json",
  ...DEFAULT_JSON_CURVE_CONFIG,
  ...DEFAULT_BINARY_MULTI_FIELDS,
  publishTopic: "",
  publishQos: 0,
  publishRetain: false,
};

export const MQTT_PROFILE = {
  id: MQTT_DEVICE_ID,
  name: "MQTT 调试",
  type: "MQTT 消息调试",
  protocolStatus: "ready",
  defaultTransportId: "mqtt",
  image: "./images/mqtt.png",
};

const mqttModbusBuffer = createModbusRxBuffer();
let mqttFramingState = createDebugFramingState(DEFAULT_MQTT_CONFIG);

export function normalizeMqttConfig(config = {}) {
  const merged = {
    ...DEFAULT_MQTT_CONFIG,
    ...config,
  };

  const parserMode = normalizeParserMode(merged.parserMode === "mqtt" ? "json" : merged.parserMode);

  return {
    pollIntervalMs: Math.max(0, Math.trunc(toFiniteNumber(merged.pollIntervalMs, DEFAULT_MQTT_CONFIG.pollIntervalMs))),
    heartbeatFormat: normalizeMessageFormat(merged.heartbeatFormat),
    heartbeatMessage: String(merged.heartbeatMessage ?? DEFAULT_MQTT_CONFIG.heartbeatMessage),
    parserMode,
    publishTopic: String(merged.publishTopic ?? "").trim(),
    publishQos: clampQos(merged.publishQos),
    publishRetain: Boolean(merged.publishRetain),
    ...normalizeJsonCurveConfig(merged, DEFAULT_MQTT_CONFIG),
    ...normalizeBinaryCurveConfig(merged, DEFAULT_MQTT_CONFIG),
    ...normalizeFramingConfig(merged, parserMode),
  };
}

export function listMqttChartSeries(config = {}) {
  const normalized = normalizeMqttConfig(config);
  if (normalized.parserMode === "hex") {
    return listHexChartSeries(normalized, DEFAULT_MQTT_CONFIG);
  }
  if (normalized.parserMode === "modbus") {
    return listModbusChartSeries(normalized, DEFAULT_MQTT_CONFIG);
  }
  return listJsonChartSeries(normalized, DEFAULT_MQTT_CONFIG);
}

export function buildMqttMessage(format, message, helpers) {
  return buildDebugMessage(format, message, helpers);
}

export function createMqttSetOutputCommand(_state, config, helpers) {
  const normalized = normalizeMqttConfig(config);

  if (!normalized.heartbeatMessage.trim()) {
    return {
      supported: false,
      preview: "未配置轮询消息",
      bytes: null,
    };
  }

  try {
    const payload = buildMqttMessage(normalized.heartbeatFormat, normalized.heartbeatMessage, helpers);
    const preview = typeof payload === "string" ? payload : helpers.bytesToHex(payload);

    return {
      supported: true,
      preview,
      bytes: payload,
    };
  } catch (error) {
    return {
      supported: false,
      preview: error.message,
      bytes: null,
    };
  }
}

export function parseMqttTelemetry(text, bytes, config, parseNumericTelemetry, helpers = {}) {
  return parseDebugTelemetry(text, bytes, normalizeMqttConfig(config), parseNumericTelemetry, {
    jsonDefaults: DEFAULT_MQTT_CONFIG,
    modbusBuffer: mqttModbusBuffer,
    framingState: mqttFramingState,
    parseHexPayload: helpers.parseHexPayload,
  });
}

export function resetMqttRxBuffer() {
  resetModbusRxBuffer(mqttModbusBuffer);
  mqttFramingState = resetDebugFramingState(mqttFramingState, DEFAULT_MQTT_CONFIG);
}

export function describeMqttSummary(config) {
  const normalized = normalizeMqttConfig(config);
  const interval = normalized.pollIntervalMs > 0 ? `${normalized.pollIntervalMs} ms 轮询` : "手动收发";
  const topic = normalized.publishTopic || "侧栏发布主题";
  const qosLabel = normalized.publishRetain ? `QoS ${normalized.publishQos} · 保留` : `QoS ${normalized.publishQos}`;
  return `MQTT 调试；${interval}；发布 ${topic}（${qosLabel}）；解析 ${describeDebugParserSummary(normalized, DEFAULT_MQTT_CONFIG, "MQTT")}`;
}

export function getMqttPublishOptions(config, transportPublishTopic = "") {
  const normalized = normalizeMqttConfig(config);
  const topic = normalized.publishTopic || String(transportPublishTopic || "").trim();

  return {
    topic: topic || undefined,
    qos: normalized.publishQos,
    retain: normalized.publishRetain,
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function clampQos(value) {
  const qos = Math.trunc(Number(value));
  if (qos === 1 || qos === 2) {
    return qos;
  }
  return 0;
}

function toFiniteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}
