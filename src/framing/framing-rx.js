import { verifyCrc } from "../modbus/modbus.js";
import {
  appendByteFrameBuffer,
  createByteFrameBuffer,
  createLineFrameBuffer,
  extractDelimitedByteFrames,
  parseHexTokenSpec,
} from "./frame-parser.js";
import { resolvePayloadBytes } from "../utils/bytes.js";

export const DEFAULT_FRAMING_FIELDS = {
  frameMode: "none",
  rxLineEnding: "\\r\\n",
  framePrefixHex: "",
  frameSuffixHex: "",
  frameCrcMode: "none",
};

export function normalizeFrameMode(value) {
  if (value === "line" || value === "stxEtx") {
    return value;
  }
  return "none";
}

export function normalizeFrameCrcMode(value, parserMode = "json") {
  if (value === "modbus" || parserMode === "modbus") {
    return "modbus";
  }
  return "none";
}

export function normalizeFramingConfig(config = {}, parserMode = "json") {
  return {
    frameMode: normalizeFrameMode(config.frameMode),
    rxLineEnding: normalizeLineEndingValue(config.rxLineEnding),
    framePrefixHex: String(config.framePrefixHex ?? "").trim(),
    frameSuffixHex: String(config.frameSuffixHex ?? "").trim(),
    frameCrcMode: normalizeFrameCrcMode(config.frameCrcMode, parserMode),
  };
}

export function createFramingRxState(config = DEFAULT_FRAMING_FIELDS) {
  const normalized = normalizeFramingConfig(config);
  return {
    lineBuffer: createLineFrameBuffer(mapLineEndingToDelimiter(normalized.rxLineEnding)),
    byteBuffer: createByteFrameBuffer(),
  };
}

export function resetFramingRxState(state, config = DEFAULT_FRAMING_FIELDS) {
  if (!state) {
    return createFramingRxState(config);
  }

  const normalized = normalizeFramingConfig(config);
  state.lineBuffer = createLineFrameBuffer(mapLineEndingToDelimiter(normalized.rxLineEnding));
  state.byteBuffer = createByteFrameBuffer();
  return state;
}

export function extractLatestFramedPayload(text, bytes, config, state, parseHexPayload) {
  const normalized = normalizeFramingConfig(config, config.parserMode);
  if (normalized.frameMode === "none") {
    if (bytes instanceof Uint8Array && bytes.length > 0) {
      return applyFrameCrc(bytes, normalized);
    }
    return text != null ? { text: String(text), bytes: null } : null;
  }

  if (normalized.frameMode === "line") {
    const chunk = String(text ?? (bytes instanceof Uint8Array ? new TextDecoder().decode(bytes) : ""));
    const frames = state.lineBuffer.push(chunk);
    if (!frames.length) {
      return null;
    }
    return { text: frames[frames.length - 1], bytes: null };
  }

  const chunkBytes = resolvePayloadBytes(text, bytes, parseHexPayload);
  if (!chunkBytes?.length) {
    return null;
  }

  appendByteFrameBuffer(state.byteBuffer, chunkBytes);
  const prefix = normalized.framePrefixHex ? parseHexTokenSpec(normalized.framePrefixHex) : new Uint8Array(0);
  const suffix = normalized.frameSuffixHex ? parseHexTokenSpec(normalized.frameSuffixHex) : new Uint8Array(0);
  const frames = extractDelimitedByteFrames(state.byteBuffer, prefix, suffix);
  if (!frames.length) {
    return null;
  }

  const payload = applyFrameCrc(frames[frames.length - 1], normalized);
  if (!payload) {
    return null;
  }

  return { text: null, bytes: payload };
}

export function describeFramingSummary(config = DEFAULT_FRAMING_FIELDS, parserMode = "json") {
  const normalized = normalizeFramingConfig(config, parserMode);
  if (normalized.frameMode === "line") {
    return `行界 ${normalized.rxLineEnding || "CRLF"}`;
  }
  if (normalized.frameMode === "stxEtx") {
    const prefix = normalized.framePrefixHex || "—";
    const suffix = normalized.frameSuffixHex || "—";
    const crc = normalized.frameCrcMode === "modbus" ? " · CRC16" : "";
    return `帧头尾 ${prefix} / ${suffix}${crc}`;
  }
  if (normalized.frameCrcMode === "modbus" || parserMode === "modbus") {
    return "Modbus CRC16";
  }
  return "整包";
}

function applyFrameCrc(payload, config) {
  if (!(payload instanceof Uint8Array) || payload.length === 0) {
    return payload;
  }

  if (config.frameCrcMode !== "modbus") {
    return payload;
  }

  if (payload.length < 3) {
    return null;
  }

  if (!verifyCrc(payload)) {
    return null;
  }

  return payload.subarray(0, payload.length - 2);
}

function mapLineEndingToDelimiter(value) {
  if (value === "\\n") {
    return "lf";
  }
  if (value === "\\r") {
    return "cr";
  }
  if (value === "\\r\\n") {
    return "crlf";
  }
  return "crlf";
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
  return "\\r\\n";
}
