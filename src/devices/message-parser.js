import i18n from "../i18n.js";
import { parseJsonCurveTelemetry, describeJsonCurveSummary } from "./json-curve-config.js";
import {
  describeHexCurveSummary,
  describeModbusCurveSummary,
  parseHexCurveTelemetry,
  parseModbusCurveTelemetry,
} from "./binary-curve-config.js";
import { createByteFrameBuffer } from "../framing/frame-parser.js";
import {
  createFramingRxState,
  DEFAULT_FRAMING_FIELDS,
  describeFramingSummary,
  extractLatestFramedPayload,
  normalizeFramingConfig,
  resetFramingRxState,
} from "../framing/framing-rx.js";

export const DEFAULT_BINARY_PARSER_FIELDS = {
  ...DEFAULT_FRAMING_FIELDS,
  hexByteOffset: 0,
  hexDataType: "uint16",
  hexByteOrder: "AB",
  hexScale: 1,
  hexOffset: 0,
  modbusSlaveId: 1,
  modbusFunctionCode: 3,
  modbusDataType: "uint16",
  modbusByteOrder: "AB",
  modbusScale: 1,
  modbusOffset: 0,
};

export function normalizeMessageFormat(value) {
  return value === "hex" || value === "ascii" ? value : "json";
}

export function normalizeParserMode(value) {
  if (value === "hex" || value === "modbus") {
    return value;
  }
  return "json";
}

export function normalizeDataType(value) {
  return value === "int16" || value === "float32" ? value : "uint16";
}

export function normalizeByteOrder(value, dataType) {
  if (normalizeDataType(dataType) === "float32") {
    return ["AB", "ABCD", "DCBA", "BADC", "CDAB"].includes(value) ? value : "AB";
  }

  return value === "BA" ? "BA" : "AB";
}

export function normalizeReadFunctionCode(value) {
  return Number(value) === 4 ? 4 : 3;
}

export function buildDebugMessage(format, message, helpers) {
  const normalizedFormat = normalizeMessageFormat(format);
  const content = String(message ?? "");

  if (normalizedFormat === "hex") {
    return helpers.parseHexPayload(content);
  }

  if (normalizedFormat === "json") {
    const trimmed = content.trim();
    if (!trimmed) {
      throw new Error(i18n("protocol.jsonMsgNotEmpty"));
    }

    try {
      JSON.parse(trimmed);
    } catch (error) {
      throw new Error(`${i18n("protocol.jsonInvalid")}：${error.message}`);
    }

    return trimmed;
  }

  return content;
}

export function createModbusRxBuffer() {
  return createByteFrameBuffer();
}

export function resetModbusRxBuffer(state) {
  if (state) {
    state.bytes = new Uint8Array(0);
  }
}

export function parseHexTelemetry(text, bytes, config, parseHexPayload, defaults) {
  return parseHexCurveTelemetry(text, bytes, config, parseHexPayload, defaults);
}

export function parseModbusTelemetry(text, bytes, config, bufferState, parseHexPayload, defaults) {
  return parseModbusCurveTelemetry(text, bytes, config, bufferState, parseHexPayload, defaults);
}

export function parseDebugTelemetry(text, bytes, config, parseNumericTelemetry, options = {}) {
  const parserMode = normalizeParserMode(config.parserMode);
  const jsonDefaults = options.jsonDefaults;
  const bufferState = options.modbusBuffer;
  const parseHexPayload = options.parseHexPayload;
  const framingState = options.framingState;

  let payloadText = text;
  let payloadBytes = bytes;

  if (framingState && normalizeFramingConfig(config, parserMode).frameMode !== "none") {
    const framed = extractLatestFramedPayload(text, bytes, { ...config, parserMode }, framingState, parseHexPayload);
    if (!framed) {
      return null;
    }
    payloadText = framed.text;
    payloadBytes = framed.bytes;
  } else if (normalizeFramingConfig(config, parserMode).frameCrcMode === "modbus" && bytes instanceof Uint8Array) {
    const framed = extractLatestFramedPayload(text, bytes, { ...config, parserMode, frameMode: "none" }, framingState, parseHexPayload);
    if (!framed?.bytes) {
      return null;
    }
    payloadText = framed.text;
    payloadBytes = framed.bytes;
  }

  if (parserMode === "hex") {
    try {
      return parseHexTelemetry(payloadText, payloadBytes, config, parseHexPayload, jsonDefaults);
    } catch {
      return null;
    }
  }

  if (parserMode === "modbus") {
    try {
      return parseModbusTelemetry(payloadText, payloadBytes, config, bufferState ?? createModbusRxBuffer(), parseHexPayload, jsonDefaults);
    } catch {
      return null;
    }
  }

  return parseJsonCurveTelemetry(payloadText ?? (payloadBytes ? new TextDecoder().decode(payloadBytes) : ""), config, parseNumericTelemetry, jsonDefaults);
}

export function createDebugFramingState(config) {
  return createFramingRxState(config);
}

export function resetDebugFramingState(state, config) {
  resetFramingRxState(state, config);
}

export function describeDebugParserSummary(config, jsonDefaults, label = "JSON") {
  const parserMode = normalizeParserMode(config.parserMode);
  const framing = describeFramingSummary(config, parserMode);

  if (parserMode === "hex") {
    return `${framing} · HEX ${describeHexCurveSummary(config, jsonDefaults)}`;
  }

  if (parserMode === "modbus") {
    return `${framing} · Modbus ${describeModbusCurveSummary(config, jsonDefaults)}`;
  }

  return `${framing} · ${label} ${describeJsonCurveSummary(config, jsonDefaults)}`;
}
