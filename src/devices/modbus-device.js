import {
  DEFAULT_BINARY_MULTI_FIELDS,
  decodeModbusReadDataCurves,
  listModbusChartSeries,
  normalizeBinaryCurveConfig,
} from "./binary-curve-config.js";
import {
  normalizeJsonCurveConfig,
} from "./json-curve-config.js";
import {
  buildReadRegistersRequest,
  buildWriteMultipleRegistersRequest,
  buildWriteSingleRegisterRequest,
  extractRtuFrames,
  isReadFunctionCode,
  isWriteFunctionCode,
} from "../modbus/modbus.js";

export const MODBUS_DEVICE_ID = "modbus";
export const MODBUS_DEFAULT_BAUD_RATE = 9600;

/** Modbus RTU 常用串口参数：9600 8N1 */
export const MODBUS_TRANSPORT_DEFAULTS = {
  baudRate: MODBUS_DEFAULT_BAUD_RATE,
  parity: "none",
  dataBits: 8,
  stopBits: 1,
  flowControl: "none",
};

/** Modbus 经 WebSocket 网关时的默认地址 */
export const MODBUS_WEBSOCKET_TRANSPORT_DEFAULTS = {
  url: "ws://127.0.0.1:8080",
};

export const DEFAULT_MODBUS_CONFIG = {
  slaveId: 1,
  functionCode: 3,
  address: 0,
  quantity: 1,
  pollIntervalMs: 500,
  fieldName: "寄存器值",
  unit: "",
  curveSlotCount: 1,
  curve1Enabled: true,
  curve2Enabled: false,
  curve2FieldName: "曲线二",
  curve2Unit: "",
  curve3Enabled: false,
  curve3FieldName: "曲线三",
  curve3Unit: "",
  curve4Enabled: false,
  curve4FieldName: "曲线四",
  curve4Unit: "",
  ...DEFAULT_BINARY_MULTI_FIELDS,
  modbusDataType: "uint16",
  modbusByteOrder: "AB",
  modbusScale: 1,
  modbusOffset: 0,
};

let rxBuffer = new Uint8Array(0);

export const MODBUS_PROFILE = {
  id: MODBUS_DEVICE_ID,
  name: "Modbus",
  type: "RTU 寄存器读写",
  image: "./images/modusignal-logo.svg",
  protocolStatus: "ready",
  defaultTransportId: "serial",
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
  const migrated = migrateLegacyModbusConfig(config);
  const merged = {
    ...DEFAULT_MODBUS_CONFIG,
    ...migrated,
  };

  const functionCode = normalizeFunctionCode(merged.functionCode);
  const slaveId = clamp(Math.trunc(toFiniteNumber(merged.slaveId, DEFAULT_MODBUS_CONFIG.slaveId)), 1, 247);
  const address = clamp(Math.trunc(toFiniteNumber(merged.address, DEFAULT_MODBUS_CONFIG.address)), 0, 65535);
  const userQuantity = Math.max(1, Math.min(125, Math.trunc(toFiniteNumber(merged.quantity, DEFAULT_MODBUS_CONFIG.quantity))));

  const jsonNormalized = normalizeJsonCurveConfig(merged, DEFAULT_MODBUS_CONFIG);
  const binaryNormalized = normalizeBinaryCurveConfig(merged, DEFAULT_MODBUS_CONFIG);
  binaryNormalized.modbusSlaveId = slaveId;
  if (isReadFunctionCode(functionCode)) {
    binaryNormalized.modbusFunctionCode = functionCode;
  }

  const curveConfig = {
    ...jsonNormalized,
    ...binaryNormalized,
    slaveId,
    functionCode,
  };
  const requiredQuantity = computeModbusReadQuantity(curveConfig);
  const quantity = isReadFunctionCode(functionCode) ? Math.max(userQuantity, requiredQuantity) : userQuantity;

  return {
    slaveId,
    functionCode,
    address,
    quantity,
    pollIntervalMs: Math.max(0, Math.trunc(toFiniteNumber(merged.pollIntervalMs, DEFAULT_MODBUS_CONFIG.pollIntervalMs))),
    ...jsonNormalized,
    ...binaryNormalized,
    dataType: binaryNormalized.modbusDataType,
    byteOrder: binaryNormalized.modbusByteOrder,
    scale: binaryNormalized.modbusScale,
    offset: binaryNormalized.modbusOffset,
    fieldName: jsonNormalized.fieldName,
    unit: jsonNormalized.unit,
  };
}

export function listModbusDeviceChartSeries(config = {}) {
  const normalized = normalizeModbusConfig(config);
  return listModbusChartSeries(toModbusCurveConfig(normalized), DEFAULT_MODBUS_CONFIG);
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

    if (!isReadFunctionCode(frame[1]) || frame[1] !== normalized.functionCode) {
      continue;
    }

    const byteCount = frame[2];
    const data = frame.subarray(3, 3 + byteCount);
    const telemetry = decodeModbusReadDataCurves(data, toModbusCurveConfig(normalized), DEFAULT_MODBUS_CONFIG);
    if (telemetry) {
      return telemetry;
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

function toModbusCurveConfig(normalized) {
  return {
    ...normalized,
    modbusSlaveId: normalized.slaveId,
    modbusFunctionCode: normalized.functionCode,
  };
}

function computeModbusReadQuantity(config) {
  const series = listModbusChartSeries(config, DEFAULT_MODBUS_CONFIG);
  let maxBytes = 2;

  for (const item of series) {
    const bytes = item.dataType === "float32" ? 4 : 2;
    maxBytes = Math.max(maxBytes, item.byteOffset + bytes);
  }

  return Math.max(1, Math.ceil(maxBytes / 2));
}

function migrateLegacyModbusConfig(config) {
  if (!config || config.modbusDataType !== undefined) {
    return config;
  }

  const migrated = { ...config };
  if (config.dataType !== undefined) {
    migrated.modbusDataType = config.dataType;
  }
  if (config.byteOrder !== undefined) {
    migrated.modbusByteOrder = config.byteOrder;
  }
  if (config.scale !== undefined) {
    migrated.modbusScale = config.scale;
  }
  if (config.offset !== undefined) {
    migrated.modbusOffset = config.offset;
  }

  return migrated;
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
