import i18n from "../i18n.js";
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
  encodeRegisterPair,
  extractRtuFrames,
  isReadFunctionCode,
  isWriteFunctionCode,
  MODBUS_WORD_ORDERS,
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

export const MODBUS_WRITE_FORMATS = ["int16", "int32", "float32"];
export const MODBUS_TABLE_FORMATS = ["uint16", "int16", "hex", "binary", "uint32", "int32", "float32"];
const MAX_WRITE_VALUES_LENGTH = 2000;
const MAX_WRITE_REGISTERS = 123;

export const DEFAULT_MODBUS_CONFIG = {
  slaveId: 1,
  functionCode: 3,
  address: 0,
  quantity: 1,
  pollIntervalMs: 500,
  responseTimeoutMs: 1000,
  writeValues: "",
  writeFormat: "int16",
  writeWordOrder: "ABCD",
  tableFormat: "uint16",
  tableWordOrder: "ABCD",
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

export function getModbusProfile() {
  return {
    id: MODBUS_DEVICE_ID,
    name: "Modbus",
    type: i18n("modbus.profile.type"),
    image: "./images/modusignal-logo.svg",
    protocolStatus: "ready",
    defaultTransportId: "serial",
    modes: {
      readHolding: {
        label: i18n("modbus.readHolding"),
        unit: "",
        min: 0,
        max: 65535,
        step: 1,
        presets: { min: 0, mid: 0, max: 65535 },
      },
      readInput: {
        label: i18n("modbus.readInput"),
        unit: "",
        min: 0,
        max: 65535,
        step: 1,
        presets: { min: 0, mid: 0, max: 65535 },
      },
      writeSingle: {
        label: i18n("modbus.writeValue"),
        unit: "",
        min: 0,
        max: 65535,
        step: 1,
        presets: { min: 0, mid: 100, max: 1000 },
      },
      writeMultiple: {
        label: i18n("modbus.writeValue"),
        unit: "",
        min: 0,
        max: 65535,
        step: 1,
        presets: { min: 0, mid: 100, max: 1000 },
      },
    },
  };
}

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
    responseTimeoutMs: clamp(Math.trunc(toFiniteNumber(merged.responseTimeoutMs, DEFAULT_MODBUS_CONFIG.responseTimeoutMs)), 50, 10000),
    writeValues: String(merged.writeValues ?? "").slice(0, MAX_WRITE_VALUES_LENGTH),
    writeFormat: MODBUS_WRITE_FORMATS.includes(merged.writeFormat) ? merged.writeFormat : DEFAULT_MODBUS_CONFIG.writeFormat,
    writeWordOrder: normalizeWordOrder(merged.writeWordOrder),
    tableFormat: MODBUS_TABLE_FORMATS.includes(merged.tableFormat) ? merged.tableFormat : DEFAULT_MODBUS_CONFIG.tableFormat,
    tableWordOrder: normalizeWordOrder(merged.tableWordOrder),
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
  return getModbusProfile();
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

  try {
    if (isReadFunctionCode(normalized.functionCode)) {
      bytes = buildReadRegistersRequest(
        normalized.slaveId,
        normalized.functionCode,
        normalized.address,
        normalized.quantity,
      );
    } else if (normalized.functionCode === 6) {
      const registers = parseModbusWriteValues(normalized.writeValues, normalized.writeFormat, normalized.writeWordOrder);
      if (registers.length !== 1) {
        throw new Error(i18n("modbus.write.singleOnly"));
      }
      bytes = buildWriteSingleRegisterRequest(normalized.slaveId, normalized.address, registers[0]);
    } else if (normalized.functionCode === 16) {
      // The register count always comes from the entered values: never pad, or
      // neighbouring registers would silently be overwritten with zero.
      const registers = parseModbusWriteValues(normalized.writeValues, normalized.writeFormat, normalized.writeWordOrder);
      bytes = buildWriteMultipleRegistersRequest(normalized.slaveId, normalized.address, registers);
    }
  } catch (error) {
    return { supported: false, preview: error.message, bytes: null };
  }

  if (!bytes) {
    return {
      supported: false,
      preview: i18n("modbus.unsupportedFunction"),
      bytes: null,
    };
  }

  return {
    supported: true,
    preview: helpers.bytesToHex(bytes),
    bytes,
  };
}

/**
 * Converts "100, -5, 0x1F" into register words. 16-bit values accept -32768..65535
 * (negatives as two's complement); 32-bit values use two registers in `wordOrder`.
 */
export function parseModbusWriteValues(text, format = "int16", wordOrder = "ABCD") {
  const tokens = String(text ?? "").trim().split(/[\s,，;；]+/).filter(Boolean);
  if (!tokens.length) {
    throw new Error(i18n("modbus.write.empty"));
  }

  const registers = [];
  for (const token of tokens) {
    if (format === "float32") {
      const value = Number(token);
      if (!/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(token) || !Number.isFinite(value) || Math.abs(value) > 3.4028234663852886e38) {
        throw new Error(`${i18n("modbus.write.invalidValue")}: ${token}`);
      }
      registers.push(...encodeRegisterPair(value, "float32", wordOrder));
    } else if (format === "int32") {
      const value = parseIntegerToken(token, -2147483648, 4294967295);
      registers.push(...encodeRegisterPair(value, "uint32", wordOrder));
    } else {
      registers.push(parseIntegerToken(token, -32768, 65535) & 0xffff);
    }
  }

  if (registers.length > MAX_WRITE_REGISTERS) {
    throw new Error(i18n("modbus.write.tooMany"));
  }
  return registers;
}

function parseIntegerToken(token, min, max) {
  const hex = /^0x([0-9a-f]+)$/i.exec(token);
  const value = hex ? parseInt(hex[1], 16) : /^[+-]?\d+$/.test(token) ? Number(token) : NaN;
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new Error(`${i18n("modbus.write.invalidValue")}: ${token}`);
  }
  return value;
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
    const telemetry = decodeModbusDataTelemetry(frame.subarray(3, 3 + byteCount), normalized);
    if (telemetry) {
      return telemetry;
    }
  }

  return null;
}

/** Decodes the configured curves from the data area of a read response. */
export function decodeModbusDataTelemetry(data, config) {
  return decodeModbusReadDataCurves(data, toModbusCurveConfig(normalizeModbusConfig(config)), DEFAULT_MODBUS_CONFIG);
}

export function describeModbusSummary(config) {
  const normalized = normalizeModbusConfig(config);
  const action = isReadFunctionCode(normalized.functionCode)
    ? i18n("modbus.readRegister", "读取")
    : isWriteFunctionCode(normalized.functionCode)
      ? i18n("modbus.writeRegister", "写入")
      : i18n("modbus.operation", "操作");

  return `${action} ${i18n("modbus.slaveId", "从站")} ${normalized.slaveId}，${i18n("modbus.functionCode")} ${normalized.functionCode}，${i18n("modbus.startAddr")} ${normalized.address}`;
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

function normalizeFunctionCode(value) {
  const code = Math.trunc(Number(value));
  return [3, 4, 6, 16].includes(code) ? code : DEFAULT_MODBUS_CONFIG.functionCode;
}

function normalizeWordOrder(value) {
  return MODBUS_WORD_ORDERS.includes(value) ? value : "ABCD";
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
