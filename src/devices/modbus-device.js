import {
  buildReadRegistersRequest,
  buildWriteMultipleRegistersRequest,
  buildWriteSingleRegisterRequest,
  extractRtuFrames,
  isReadFunctionCode,
  isWriteFunctionCode,
  parseReadRegistersResponse,
  registersForDataType,
} from "../modbus/modbus.js";

export const MODBUS_DEVICE_ID = "modbus";

export const DEFAULT_MODBUS_CONFIG = {
  slaveId: 1,
  functionCode: 3,
  address: 0,
  quantity: 1,
  dataType: "uint16",
  byteOrder: "AB",
  scale: 1,
  offset: 0,
  fieldName: "寄存器值",
  unit: "",
  pollIntervalMs: 0,
};

let rxBuffer = new Uint8Array(0);

export const MODBUS_PROFILE = {
  id: MODBUS_DEVICE_ID,
  name: "Modbus",
  type: "RTU 寄存器读写",
  image: "./images/modusignal-logo.svg",
  protocolStatus: "ready",
  modes: {
    readHolding: {
      label: "读保持寄存器",
      unit: "",
      min: 0,
      max: 65535,
      step: 1,
      presets: { min: 0, mid: 0, max: 65535 },
    },
    readInput: {
      label: "读输入寄存器",
      unit: "",
      min: 0,
      max: 65535,
      step: 1,
      presets: { min: 0, mid: 0, max: 65535 },
    },
    writeSingle: {
      label: "写入值",
      unit: "",
      min: 0,
      max: 65535,
      step: 1,
      presets: { min: 0, mid: 100, max: 1000 },
    },
    writeMultiple: {
      label: "写入值",
      unit: "",
      min: 0,
      max: 65535,
      step: 1,
      presets: { min: 0, mid: 100, max: 1000 },
    },
  },
};

export function resetModbusRxBuffer() {
  rxBuffer = new Uint8Array(0);
}

export function normalizeModbusConfig(config = {}) {
  const merged = {
    ...DEFAULT_MODBUS_CONFIG,
    ...config,
  };

  const functionCode = normalizeFunctionCode(merged.functionCode);
  const dataType = normalizeDataType(merged.dataType);
  const quantity = Math.max(1, Math.min(125, Math.trunc(toFiniteNumber(merged.quantity, DEFAULT_MODBUS_CONFIG.quantity))));
  const readQuantity = isReadFunctionCode(functionCode) ? Math.max(quantity, registersForDataType(dataType)) : quantity;

  return {
    slaveId: clamp(Math.trunc(toFiniteNumber(merged.slaveId, DEFAULT_MODBUS_CONFIG.slaveId)), 1, 247),
    functionCode,
    address: clamp(Math.trunc(toFiniteNumber(merged.address, DEFAULT_MODBUS_CONFIG.address)), 0, 65535),
    quantity: readQuantity,
    dataType,
    byteOrder: normalizeByteOrder(merged.byteOrder, dataType),
    scale: toFiniteNumber(merged.scale, DEFAULT_MODBUS_CONFIG.scale),
    offset: toFiniteNumber(merged.offset, DEFAULT_MODBUS_CONFIG.offset),
    fieldName: String(merged.fieldName || DEFAULT_MODBUS_CONFIG.fieldName),
    unit: String(merged.unit ?? ""),
    pollIntervalMs: Math.max(0, Math.trunc(toFiniteNumber(merged.pollIntervalMs, DEFAULT_MODBUS_CONFIG.pollIntervalMs))),
  };
}

export function createModbusProfile() {
  return { ...MODBUS_PROFILE };
}

export function getModbusMode(functionCode) {
  if (functionCode === 4) {
    return "readInput";
  }

  if (functionCode === 6) {
    return "writeSingle";
  }

  if (functionCode === 16) {
    return "writeMultiple";
  }

  return "readHolding";
}

export function createModbusSetOutputCommand(state, config, helpers) {
  const normalized = normalizeModbusConfig(config);
  let bytes = null;

  if (isReadFunctionCode(normalized.functionCode)) {
    bytes = buildReadRegistersRequest(
      normalized.slaveId,
      normalized.functionCode,
      normalized.address,
      normalized.quantity,
    );
  } else if (normalized.functionCode === 6) {
    bytes = buildWriteSingleRegisterRequest(normalized.slaveId, normalized.address, state.setpoint);
  } else if (normalized.functionCode === 16) {
    const registerValues = buildWriteValues(state.setpoint, normalized.quantity, normalized.dataType);
    bytes = buildWriteMultipleRegistersRequest(normalized.slaveId, normalized.address, registerValues);
  }

  if (!bytes) {
    return {
      supported: false,
      preview: "不支持的 Modbus 功能码",
      bytes: null,
    };
  }

  return {
    supported: true,
    preview: helpers.bytesToHex(bytes),
    bytes,
  };
}

export function parseModbusTelemetry(bytes, config) {
  if (!bytes || bytes.length === 0) {
    return null;
  }

  const normalized = normalizeModbusConfig(config);
  rxBuffer = concatBytes(rxBuffer, bytes);
  const { frames, remaining } = extractRtuFrames(rxBuffer);
  rxBuffer = remaining;

  for (const frame of frames) {
    if (frame[0] !== normalized.slaveId) {
      continue;
    }

    if (isReadFunctionCode(frame[1])) {
      const telemetry = parseReadRegistersResponse(frame, normalized);
      if (telemetry) {
        return telemetry;
      }
    }
  }

  return null;
}

export function describeModbusSummary(config) {
  const normalized = normalizeModbusConfig(config);
  const action = isReadFunctionCode(normalized.functionCode)
    ? "读取"
    : isWriteFunctionCode(normalized.functionCode)
      ? "写入"
      : "操作";

  return `${action} 从站 ${normalized.slaveId}，功能码 ${normalized.functionCode}，地址 ${normalized.address}`;
}

function buildWriteValues(setpoint, quantity, dataType) {
  if (dataType === "float32") {
    const buffer = new ArrayBuffer(4);
    const view = new DataView(buffer);
    view.setFloat32(0, Number(setpoint), false);
    const bytes = new Uint8Array(buffer);
    return [bytes[0] << 8 | bytes[1], bytes[2] << 8 | bytes[3]];
  }

  const values = [clampUint16(setpoint)];

  while (values.length < quantity) {
    values.push(0);
  }

  return values.slice(0, quantity);
}

function normalizeFunctionCode(value) {
  const code = Math.trunc(Number(value));
  return [3, 4, 6, 16].includes(code) ? code : DEFAULT_MODBUS_CONFIG.functionCode;
}

function normalizeDataType(value) {
  return value === "int16" || value === "float32" ? value : "uint16";
}

function normalizeByteOrder(value, dataType) {
  if (dataType === "float32") {
    return ["ABCD", "DCBA", "BADC", "CDAB"].includes(value) ? value : "ABCD";
  }

  return value === "BA" ? "BA" : "AB";
}

function concatBytes(left, right) {
  const merged = new Uint8Array(left.length + right.length);
  merged.set(left);
  merged.set(right, left.length);
  return merged;
}

function toFiniteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function clampUint16(value) {
  return clamp(Math.trunc(Number(value)), 0, 65535);
}
