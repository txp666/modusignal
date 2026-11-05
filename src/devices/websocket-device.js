import i18n from "../i18n.js";
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

export const WEBSOCKET_DEVICE_ID = "websocket";

export const WEBSOCKET_TRANSPORT_DEFAULTS = {
  url: "ws://127.0.0.1:8080",
};

export const WEBSOCKET_QUICK_MESSAGES = [
  { id: "ping", label: () => i18n("msg.pingJson"), format: "json", message: '{"type":"ping"}' },
  { id: "hello", label: () => i18n("msg.hello"), format: "ascii", message: "Hello WebSocket!" },
  { id: "time", label: () => i18n("msg.timestamp"), format: "json", message: '{"type":"time"}' },
];

export const DEFAULT_WEBSOCKET_CONFIG = {
  pollIntervalMs: 0,
  heartbeatFormat: "json",
  heartbeatMessage: '{"type":"ping"}',
  parserMode: "json",
  ...DEFAULT_JSON_CURVE_CONFIG,
  ...DEFAULT_BINARY_MULTI_FIELDS,
};

export function getWebSocketProfile() {
  return {
    id: WEBSOCKET_DEVICE_ID,
    name: i18n("ws.profile.name"),
    type: i18n("ws.profile.type"),
    protocolStatus: "ready",
    defaultTransportId: "websocket",
    image: "./images/websocket.png",
  };
}

const websocketModbusBuffer = createModbusRxBuffer();
let websocketFramingState = createDebugFramingState(DEFAULT_WEBSOCKET_CONFIG);

export function normalizeWebSocketConfig(config = {}) {
  const merged = {
    ...DEFAULT_WEBSOCKET_CONFIG,
    ...config,
  };

  return {
    pollIntervalMs: Math.max(0, Math.trunc(toFiniteNumber(merged.pollIntervalMs, DEFAULT_WEBSOCKET_CONFIG.pollIntervalMs))),
    heartbeatFormat: normalizeMessageFormat(merged.heartbeatFormat),
    heartbeatMessage: String(merged.heartbeatMessage ?? DEFAULT_WEBSOCKET_CONFIG.heartbeatMessage),
    parserMode: normalizeParserMode(merged.parserMode === "mqtt" ? "json" : merged.parserMode),
    ...normalizeJsonCurveConfig(merged, DEFAULT_WEBSOCKET_CONFIG),
    ...normalizeBinaryCurveConfig(merged, DEFAULT_WEBSOCKET_CONFIG),
    ...normalizeFramingConfig(merged, normalizeParserMode(merged.parserMode === "mqtt" ? "json" : merged.parserMode)),
  };
}

export function listWebSocketChartSeries(config = {}) {
  const normalized = normalizeWebSocketConfig(config);
  if (normalized.parserMode === "hex") {
    return listHexChartSeries(normalized, DEFAULT_WEBSOCKET_CONFIG);
  }
  if (normalized.parserMode === "modbus") {
    return listModbusChartSeries(normalized, DEFAULT_WEBSOCKET_CONFIG);
  }
  return listJsonChartSeries(normalized, DEFAULT_WEBSOCKET_CONFIG);
}

export function buildWebSocketMessage(format, message, helpers) {
  return buildDebugMessage(format, message, helpers);
}

export function createWebSocketSetOutputCommand(_state, config, helpers) {
  const normalized = normalizeWebSocketConfig(config);

  if (!normalized.heartbeatMessage.trim()) {
    return {
      supported: false,
      preview: i18n("ws.noPollMsg"),
      bytes: null,
    };
  }

  try {
    const payload = buildWebSocketMessage(normalized.heartbeatFormat, normalized.heartbeatMessage, helpers);
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

export function parseWebSocketTelemetry(text, bytes, config, parseNumericTelemetry, helpers = {}) {
  return parseDebugTelemetry(text, bytes, normalizeWebSocketConfig(config), parseNumericTelemetry, {
    jsonDefaults: DEFAULT_WEBSOCKET_CONFIG,
    modbusBuffer: websocketModbusBuffer,
    framingState: websocketFramingState,
    parseHexPayload: helpers.parseHexPayload,
  });
}

export function resetWebSocketRxBuffer() {
  resetModbusRxBuffer(websocketModbusBuffer);
  websocketFramingState = resetDebugFramingState(websocketFramingState, DEFAULT_WEBSOCKET_CONFIG);
}

export function describeWebSocketSummary(config) {
  const normalized = normalizeWebSocketConfig(config);
  const interval = normalized.pollIntervalMs > 0 ? `${normalized.pollIntervalMs} ms ${i18n("workbench.polling")}` : i18n("conn.manualMode");
  return `WebSocket ${i18n("ws.profile.type")}；${interval}；${i18n("workbench.showCurves", "解析")} ${describeDebugParserSummary(normalized, DEFAULT_WEBSOCKET_CONFIG, "WS")}`;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function toFiniteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}
