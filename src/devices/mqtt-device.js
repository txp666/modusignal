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
  parserFieldPath: "value",
  fieldName: "数值",
  unit: "",
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

export function normalizeMqttConfig(config = {}) {
  const merged = {
    ...DEFAULT_MQTT_CONFIG,
    ...config,
  };

  return {
    pollIntervalMs: Math.max(0, Math.trunc(toFiniteNumber(merged.pollIntervalMs, DEFAULT_MQTT_CONFIG.pollIntervalMs))),
    heartbeatFormat: normalizeMessageFormat(merged.heartbeatFormat),
    heartbeatMessage: String(merged.heartbeatMessage ?? DEFAULT_MQTT_CONFIG.heartbeatMessage),
    parserFieldPath: String(merged.parserFieldPath ?? "").trim(),
    fieldName: String(merged.fieldName || DEFAULT_MQTT_CONFIG.fieldName),
    unit: String(merged.unit ?? ""),
    publishTopic: String(merged.publishTopic ?? "").trim(),
    publishQos: clampQos(merged.publishQos),
    publishRetain: Boolean(merged.publishRetain),
  };
}

export function buildMqttMessage(format, message, helpers) {
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

export function parseMqttTelemetry(text, config, parseNumericTelemetry) {
  const normalized = normalizeMqttConfig(config);
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

export function describeMqttSummary(config) {
  const normalized = normalizeMqttConfig(config);
  const interval = normalized.pollIntervalMs > 0 ? `${normalized.pollIntervalMs} ms 轮询` : "手动收发";
  const topic = normalized.publishTopic || "侧栏发布主题";
  const qosLabel = normalized.publishRetain ? `QoS ${normalized.publishQos} · 保留` : `QoS ${normalized.publishQos}`;
  return `MQTT 调试；${interval}；发布 ${topic}（${qosLabel}）；解析 ${normalized.parserFieldPath || "自动数字"}`;
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
