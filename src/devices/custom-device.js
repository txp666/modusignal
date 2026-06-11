import {
  DEFAULT_BINARY_MULTI_FIELDS,
  listHexChartSeries,
  listModbusChartSeries,
  normalizeBinaryCurveConfig,
} from "./binary-curve-config.js";
import {
  DEFAULT_JSON_CURVE_CONFIG,
  listJsonChartSeries,
  normalizeJsonCurveConfig,
} from "./json-curve-config.js";
import {
  createFramingRxState,
  DEFAULT_FRAMING_FIELDS,
  describeFramingSummary,
  extractLatestFramedPayload,
  normalizeFramingConfig,
  resetFramingRxState,
} from "../framing/framing-rx.js";
import {
  createModbusRxBuffer,
  describeDebugParserSummary,
  normalizeParserMode,
  parseDebugTelemetry,
  resetModbusRxBuffer,
} from "./message-parser.js";

const textEncoder = new TextEncoder();

export const CUSTOM_DEVICE_ID = "custom";
export const CUSTOM_DEFAULT_BAUD_RATE = 115200;

export const CUSTOM_TRANSPORT_DEFAULTS = {
  baudRate: CUSTOM_DEFAULT_BAUD_RATE,
  parity: "none",
  dataBits: 8,
  stopBits: 1,
  flowControl: "none",
};

export const DEFAULT_CUSTOM_CONFIG = {
  name: "自定义串口设备",
  type: "自定义串口设备",
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
  parserMode: "json",
  ...DEFAULT_JSON_CURVE_CONFIG,
  ...DEFAULT_BINARY_MULTI_FIELDS,
  ...DEFAULT_FRAMING_FIELDS,
};

let customFramingState = createFramingRxState(DEFAULT_CUSTOM_CONFIG);
const customModbusBuffer = createModbusRxBuffer();

export function normalizeCustomConfig(config = {}) {
  const migrated = migrateLegacyCustomConfig(config);
  const merged = {
    ...DEFAULT_CUSTOM_CONFIG,
    ...migrated,
  };

  const min = toFiniteNumber(merged.min, DEFAULT_CUSTOM_CONFIG.min);
  const max = toFiniteNumber(merged.max, DEFAULT_CUSTOM_CONFIG.max);
  const safeMin = Math.min(min, max);
  const safeMax = Math.max(min, max);
  const step = Math.max(toFiniteNumber(merged.step, DEFAULT_CUSTOM_CONFIG.step), 0.000001);
  const defaultValue = clamp(toFiniteNumber(merged.defaultValue, DEFAULT_CUSTOM_CONFIG.defaultValue), safeMin, safeMax);
  const parserMode = normalizeParserMode(merged.parserMode);

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
    parserMode,
    ...normalizeJsonCurveConfig(merged, DEFAULT_CUSTOM_CONFIG),
    ...normalizeBinaryCurveConfig(merged, DEFAULT_CUSTOM_CONFIG),
    ...normalizeFramingConfig(merged, parserMode),
  };
}

export function resetCustomRxBuffer(config = DEFAULT_CUSTOM_CONFIG) {
  const normalized = normalizeCustomConfig(config);
  customFramingState = resetFramingRxState(customFramingState, normalized);
  resetModbusRxBuffer(customModbusBuffer);
}

export function listCustomChartSeries(config = {}) {
  const normalized = normalizeCustomConfig(config);
  if (normalized.parserMode === "hex") {
    return listHexChartSeries(normalized, DEFAULT_CUSTOM_CONFIG);
  }
  if (normalized.parserMode === "modbus") {
    return listModbusChartSeries(normalized, DEFAULT_CUSTOM_CONFIG);
  }
  return listJsonChartSeries(normalized, DEFAULT_CUSTOM_CONFIG);
}

export function createCustomProfile(config) {
  const normalized = normalizeCustomConfig(config);

  return {
    id: CUSTOM_DEVICE_ID,
    name: normalized.name,
    type: normalized.type,
    protocolStatus: "custom",
    defaultTransportId: "serial",
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

export function parseCustomTelemetry(text, config, parseNumericTelemetry, bytes = null, helpers = {}) {
  const normalized = normalizeCustomConfig(config);
  const framed = extractLatestFramedPayload(
    text,
    bytes,
    normalized,
    customFramingState,
    helpers.parseHexPayload,
  );
  if (!framed) {
    return null;
  }

  const payloadText = framed.text ?? (framed.bytes ? null : "");
  const payloadBytes = framed.bytes;

  return parseDebugTelemetry(payloadText, payloadBytes, normalized, parseNumericTelemetry, {
    jsonDefaults: DEFAULT_CUSTOM_CONFIG,
    modbusBuffer: customModbusBuffer,
    parseHexPayload: helpers.parseHexPayload,
  });
}

export function describeCustomParserSummary(config = DEFAULT_CUSTOM_CONFIG) {
  const normalized = normalizeCustomConfig(config);
  const framing = describeFramingSummary(normalized, normalized.parserMode);
  const parser = describeDebugParserSummary(normalized, DEFAULT_CUSTOM_CONFIG, "JSON");
  return `${framing} · ${parser}`;
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

function migrateLegacyCustomConfig(config) {
  if (!config?.parser || config.parserMode) {
    return config;
  }

  const parser = config.parser;
  let parserMode = "json";
  if (parser.type === "hex") {
    parserMode = "hex";
  }

  return {
    ...config,
    parserMode,
    fieldName: parser.fieldName,
    unit: parser.unit,
    frameMode: parser.frameMode,
    rxLineEnding: parser.rxLineEnding,
    framePrefixHex: parser.framePrefixHex,
    frameSuffixHex: parser.frameSuffixHex,
    hexByteOffset: parser.hexByteOffset,
    hexDataType: parser.hexDataType,
    hexByteOrder: parser.hexByteOrder,
    hexScale: parser.hexScale,
    hexOffset: parser.hexOffset,
    parser: undefined,
  };
}

function normalizeLineEndingValue(value) {
  if (value === "\\n" || value === "\n") {
    return "\\n";
  }
  if (value === "\\r\\n" || value === "\r\n") {
    return "\\r\\n";
  }
  if (value === "\\r" || value === "\r") {
    return "\\r";
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
