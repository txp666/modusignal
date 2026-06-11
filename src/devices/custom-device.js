const textEncoder = new TextEncoder();

export const CUSTOM_DEVICE_ID = "custom";
export const CUSTOM_DEFAULT_BAUD_RATE = 115200;

/** 自定义设备常用串口参数：115200 8N1 */
export const CUSTOM_TRANSPORT_DEFAULTS = {
  baudRate: CUSTOM_DEFAULT_BAUD_RATE,
  parity: "none",
  dataBits: 8,
  stopBits: 1,
  flowControl: "none",
};

export const DEFAULT_CUSTOM_CONFIG = {
  name: "自定义设备",
  type: "通用串口设备",
  channelLabel: "设定值",
  unit: "",
  min: 0,
  max: 100,
  step: 0.1,
  defaultValue: 50,
  pollIntervalMs: 500,
  commandFormat: "ascii",
  commandTemplate: "SET {value}",
  commandLineEnding: "\\r\\n",
  parser: {
    type: "autoNumber",
    fieldName: "测量值",
    unit: "",
    regex: "([-+]?\\d+(?:\\.\\d+)?)",
    group: 1,
    scale: 1,
    offset: 0,
  },
};

export function normalizeCustomConfig(config = {}) {
  const merged = {
    ...DEFAULT_CUSTOM_CONFIG,
    ...config,
    parser: {
      ...DEFAULT_CUSTOM_CONFIG.parser,
      ...(config.parser ?? {}),
    },
  };

  const min = toFiniteNumber(merged.min, DEFAULT_CUSTOM_CONFIG.min);
  const max = toFiniteNumber(merged.max, DEFAULT_CUSTOM_CONFIG.max);
  const safeMin = Math.min(min, max);
  const safeMax = Math.max(min, max);
  const step = Math.max(toFiniteNumber(merged.step, DEFAULT_CUSTOM_CONFIG.step), 0.000001);
  const defaultValue = clamp(toFiniteNumber(merged.defaultValue, DEFAULT_CUSTOM_CONFIG.defaultValue), safeMin, safeMax);

  return {
    name: String(merged.name || DEFAULT_CUSTOM_CONFIG.name),
    type: String(merged.type || DEFAULT_CUSTOM_CONFIG.type),
    channelLabel: String(merged.channelLabel || DEFAULT_CUSTOM_CONFIG.channelLabel),
    unit: String(merged.unit ?? ""),
    min: safeMin,
    max: safeMax,
    step,
    defaultValue,
    pollIntervalMs: Math.max(0, Math.trunc(toFiniteNumber(merged.pollIntervalMs, DEFAULT_CUSTOM_CONFIG.pollIntervalMs))),
    commandFormat: merged.commandFormat === "hex" ? "hex" : "ascii",
    commandTemplate: String(merged.commandTemplate || DEFAULT_CUSTOM_CONFIG.commandTemplate),
    commandLineEnding: normalizeLineEndingValue(merged.commandLineEnding),
    parser: {
      type: merged.parser.type === "regex" ? "regex" : "autoNumber",
      fieldName: String(merged.parser.fieldName || DEFAULT_CUSTOM_CONFIG.parser.fieldName),
      unit: String(merged.parser.unit ?? ""),
      regex: String(merged.parser.regex || DEFAULT_CUSTOM_CONFIG.parser.regex),
      group: Math.max(0, Math.trunc(toFiniteNumber(merged.parser.group, DEFAULT_CUSTOM_CONFIG.parser.group))),
      scale: toFiniteNumber(merged.parser.scale, DEFAULT_CUSTOM_CONFIG.parser.scale),
      offset: toFiniteNumber(merged.parser.offset, DEFAULT_CUSTOM_CONFIG.parser.offset),
    },
  };
}

export function createCustomProfile(config) {
  const normalized = normalizeCustomConfig(config);

  return {
    id: CUSTOM_DEVICE_ID,
    name: normalized.name,
    type: normalized.type,
    protocolStatus: "custom",
    modes: {
      custom: {
        label: normalized.channelLabel,
        unit: normalized.unit,
        min: normalized.min,
        max: normalized.max,
        step: normalized.step,
        presets: {
          min: normalized.min,
          mid: roundToStep((normalized.min + normalized.max) / 2, normalized.step),
          max: normalized.max,
        },
      },
    },
  };
}

export function createCustomSetOutputCommand(state, config, helpers) {
  const normalized = normalizeCustomConfig(config);
  const modeConfig = createCustomProfile(normalized).modes.custom;
  const value = clamp(toFiniteNumber(state.setpoint, normalized.defaultValue), modeConfig.min, modeConfig.max);
  const rendered = renderCommandTemplate(normalized.commandTemplate, {
    value,
    unit: modeConfig.unit,
    mode: state.mode,
  });

  try {
    const bytes =
      normalized.commandFormat === "hex"
        ? helpers.parseHexPayload(rendered)
        : textEncoder.encode(`${rendered}${helpers.resolveLineEnding(normalized.commandLineEnding)}`);

    return {
      supported: true,
      preview:
        normalized.commandFormat === "hex"
          ? helpers.bytesToHex(bytes)
          : JSON.stringify(`${rendered}${helpers.resolveLineEnding(normalized.commandLineEnding)}`),
      bytes,
    };
  } catch (error) {
    return {
      supported: false,
      preview: error.message,
      bytes: null,
    };
  }
}

export function parseCustomTelemetry(text, config, parseNumericTelemetry) {
  const normalized = normalizeCustomConfig(config);
  const parser = normalized.parser;
  let rawValue = null;

  if (parser.type === "regex") {
    let match = null;
    try {
      match = text.match(new RegExp(parser.regex));
    } catch {
      return null;
    }

    if (!match) {
      return null;
    }
    rawValue = Number(match[parser.group] ?? match[0]);
  } else {
    rawValue = parseNumericTelemetry(text);
  }

  if (!Number.isFinite(rawValue)) {
    return null;
  }

  return {
    fieldName: parser.fieldName,
    unit: parser.unit,
    value: rawValue * parser.scale + parser.offset,
    rawValue,
  };
}

export function renderCommandTemplate(template, values) {
  return String(template).replace(/\{value(?::(\d+))?\}|\{unit\}|\{mode\}/g, (match, precision) => {
    if (match === "{unit}") {
      return values.unit ?? "";
    }

    if (match === "{mode}") {
      return values.mode ?? "";
    }

    if (precision !== undefined) {
      return Number(values.value).toFixed(Number(precision));
    }

    return String(values.value);
  });
}

function normalizeLineEndingValue(value) {
  if (value === "\\n" || value === "\n") {
    return "\\n";
  }

  if (value === "\\r\\n" || value === "\r\n") {
    return "\\r\\n";
  }

  return "";
}

function toFiniteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function roundToStep(value, step) {
  const precision = Math.max(0, String(step).split(".")[1]?.length ?? 0);
  return Number((Math.round(value / step) * step).toFixed(precision));
}
