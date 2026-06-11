export const WEBSOCKET_DEVICE_ID = "websocket";

export const WEBSOCKET_TRANSPORT_DEFAULTS = {
  url: "ws://127.0.0.1:8080",
};

export const WEBSOCKET_QUICK_MESSAGES = [
  { id: "ping", label: "Ping JSON", format: "json", message: '{"type":"ping"}' },
  { id: "hello", label: "Hello", format: "ascii", message: "Hello WebSocket!" },
  { id: "time", label: "时间戳", format: "json", message: '{"type":"time"}' },
];

export const DEFAULT_WEBSOCKET_CONFIG = {
  pollIntervalMs: 0,
  heartbeatFormat: "json",
  heartbeatMessage: '{"type":"ping"}',
  parserFieldPath: "value",
  fieldName: "数值",
  unit: "",
};

export const WEBSOCKET_PROFILE = {
  id: WEBSOCKET_DEVICE_ID,
  name: "WebSocket 调试",
  type: "WebSocket 消息调试",
  protocolStatus: "ready",
  defaultTransportId: "websocket",
};

export function normalizeWebSocketConfig(config = {}) {
  const merged = {
    ...DEFAULT_WEBSOCKET_CONFIG,
    ...config,
  };

  return {
    pollIntervalMs: Math.max(0, Math.trunc(toFiniteNumber(merged.pollIntervalMs, DEFAULT_WEBSOCKET_CONFIG.pollIntervalMs))),
    heartbeatFormat: normalizeMessageFormat(merged.heartbeatFormat),
    heartbeatMessage: String(merged.heartbeatMessage ?? DEFAULT_WEBSOCKET_CONFIG.heartbeatMessage),
    parserFieldPath: String(merged.parserFieldPath ?? "").trim(),
    fieldName: String(merged.fieldName || DEFAULT_WEBSOCKET_CONFIG.fieldName),
    unit: String(merged.unit ?? ""),
  };
}

export function buildWebSocketMessage(format, message, helpers) {
  const normalizedFormat = normalizeMessageFormat(format);
  const content = String(message ?? "");

  if (normalizedFormat === "hex") {
    return helpers.parseHexPayload(content);
  }

  if (normalizedFormat === "json") {
    const trimmed = content.trim();
    if (!trimmed) {
      throw new Error("JSON 消息不能为空");
    }

    try {
      JSON.parse(trimmed);
    } catch (error) {
      throw new Error(`JSON 格式无效：${error.message}`);
    }

    return trimmed;
  }

  return content;
}

export function createWebSocketSetOutputCommand(_state, config, helpers) {
  const normalized = normalizeWebSocketConfig(config);

  if (!normalized.heartbeatMessage.trim()) {
    return {
      supported: false,
      preview: "未配置轮询消息",
      bytes: null,
    };
  }

  try {
    const payload = buildWebSocketMessage(normalized.heartbeatFormat, normalized.heartbeatMessage, helpers);
    const preview =
      typeof payload === "string"
        ? payload
        : helpers.bytesToHex(payload);

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

export function parseWebSocketTelemetry(text, config, parseNumericTelemetry) {
  const normalized = normalizeWebSocketConfig(config);
  const trimmed = String(text || "").trim();

  if (!trimmed) {
    return null;
  }

  let rawValue = null;

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      rawValue = extractJsonValue(parsed, normalized.parserFieldPath);
    } catch {
      rawValue = null;
    }
  }

  if (!Number.isFinite(rawValue)) {
    rawValue = parseNumericTelemetry(trimmed);
  }

  if (!Number.isFinite(rawValue)) {
    return null;
  }

  return {
    fieldName: normalized.fieldName,
    unit: normalized.unit,
    value: rawValue,
    rawValue,
  };
}

export function describeWebSocketSummary(config) {
  const normalized = normalizeWebSocketConfig(config);
  const interval = normalized.pollIntervalMs > 0 ? `${normalized.pollIntervalMs} ms 轮询` : "手动收发";
  return `WebSocket 调试；${interval}；解析字段 ${normalized.parserFieldPath || "自动数字"}`;
}

function extractJsonValue(source, path) {
  if (!path) {
    return findFirstNumber(source);
  }

  let current = source;
  for (const segment of path.split(".")) {
    if (current == null || segment === "") {
      return null;
    }

    if (Array.isArray(current) && /^\d+$/.test(segment)) {
      current = current[Number(segment)];
      continue;
    }

    if (typeof current === "object") {
      current = current[segment];
      continue;
    }

    return null;
  }

  return toFiniteNumber(current, null);
}

function findFirstNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findFirstNumber(item);
      if (Number.isFinite(found)) {
        return found;
      }
    }
    return null;
  }

  if (value && typeof value === "object") {
    for (const key of Object.keys(value)) {
      const found = findFirstNumber(value[key]);
      if (Number.isFinite(found)) {
        return found;
      }
    }
  }

  return null;
}

function normalizeMessageFormat(value) {
  return value === "hex" || value === "ascii" ? value : "json";
}

function toFiniteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}
