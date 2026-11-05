import { decodeRegisterValue, extractRtuFrames, isReadFunctionCode } from "../modbus/modbus.js";
import { resolvePayloadBytes } from "../utils/bytes.js";
import { appendByteFrameBuffer } from "../framing/frame-parser.js";
import {
  JSON_CURVE_SLOTS,
  DEFAULT_JSON_CURVE_CONFIG,
  normalizeJsonCurveConfig,
} from "./json-curve-config.js";

function normalizeDataType(value) {
  return value === "int16" || value === "float32" ? value : "uint16";
}

function normalizeByteOrder(value, dataType) {
  if (normalizeDataType(dataType) === "float32") {
    return ["AB", "ABCD", "DCBA", "BADC", "CDAB"].includes(value) ? value : "AB";
  }

  return value === "BA" ? "BA" : "AB";
}

function normalizeReadFunctionCode(value) {
  return Number(value) === 4 ? 4 : 3;
}

export const HEX_CURVE_SLOT_SPECS = [
  {
    key: "curve1",
    byteOffsetKey: "hexByteOffset",
    dataTypeKey: "hexDataType",
    byteOrderKey: "hexByteOrder",
    scaleKey: "hexScale",
    offsetKey: "hexOffset",
    defaultOffset: 0,
  },
  {
    key: "curve2",
    byteOffsetKey: "curve2HexByteOffset",
    dataTypeKey: "curve2HexDataType",
    byteOrderKey: "curve2HexByteOrder",
    scaleKey: "curve2HexScale",
    offsetKey: "curve2HexOffset",
    defaultOffset: 2,
  },
  {
    key: "curve3",
    byteOffsetKey: "curve3HexByteOffset",
    dataTypeKey: "curve3HexDataType",
    byteOrderKey: "curve3HexByteOrder",
    scaleKey: "curve3HexScale",
    offsetKey: "curve3HexOffset",
    defaultOffset: 4,
  },
  {
    key: "curve4",
    byteOffsetKey: "curve4HexByteOffset",
    dataTypeKey: "curve4HexDataType",
    byteOrderKey: "curve4HexByteOrder",
    scaleKey: "curve4HexScale",
    offsetKey: "curve4HexOffset",
    defaultOffset: 6,
  },
];

export const MODBUS_CURVE_SLOT_SPECS = [
  {
    key: "curve1",
    byteOffsetKey: "modbusByteOffset",
    dataTypeKey: "modbusDataType",
    byteOrderKey: "modbusByteOrder",
    scaleKey: "modbusScale",
    offsetKey: "modbusOffset",
    defaultOffset: 0,
  },
  {
    key: "curve2",
    byteOffsetKey: "curve2ModbusByteOffset",
    dataTypeKey: "curve2ModbusDataType",
    byteOrderKey: "curve2ModbusByteOrder",
    scaleKey: "curve2ModbusScale",
    offsetKey: "curve2ModbusOffset",
    defaultOffset: 2,
  },
  {
    key: "curve3",
    byteOffsetKey: "curve3ModbusByteOffset",
    dataTypeKey: "curve3ModbusDataType",
    byteOrderKey: "curve3ModbusByteOrder",
    scaleKey: "curve3ModbusScale",
    offsetKey: "curve3ModbusOffset",
    defaultOffset: 4,
  },
  {
    key: "curve4",
    byteOffsetKey: "curve4ModbusByteOffset",
    dataTypeKey: "curve4ModbusDataType",
    byteOrderKey: "curve4ModbusByteOrder",
    scaleKey: "curve4ModbusScale",
    offsetKey: "curve4ModbusOffset",
    defaultOffset: 6,
  },
];

export const DEFAULT_BINARY_MULTI_FIELDS = {
  hexByteOffset: 0,
  hexDataType: "uint16",
  hexByteOrder: "AB",
  hexScale: 1,
  hexOffset: 0,
  modbusSlaveId: 1,
  modbusFunctionCode: 3,
  modbusByteOffset: 0,
  modbusDataType: "uint16",
  modbusByteOrder: "AB",
  modbusScale: 1,
  modbusOffset: 0,
  curve2HexByteOffset: 2,
  curve2HexDataType: "uint16",
  curve2HexByteOrder: "AB",
  curve2HexScale: 1,
  curve2HexOffset: 0,
  curve3HexByteOffset: 4,
  curve3HexDataType: "uint16",
  curve3HexByteOrder: "AB",
  curve3HexScale: 1,
  curve3HexOffset: 0,
  curve4HexByteOffset: 6,
  curve4HexDataType: "uint16",
  curve4HexByteOrder: "AB",
  curve4HexScale: 1,
  curve4HexOffset: 0,
  curve2ModbusByteOffset: 2,
  curve2ModbusDataType: "uint16",
  curve2ModbusByteOrder: "AB",
  curve2ModbusScale: 1,
  curve2ModbusOffset: 0,
  curve3ModbusByteOffset: 4,
  curve3ModbusDataType: "uint16",
  curve3ModbusByteOrder: "AB",
  curve3ModbusScale: 1,
  curve3ModbusOffset: 0,
  curve4ModbusByteOffset: 6,
  curve4ModbusDataType: "uint16",
  curve4ModbusByteOrder: "AB",
  curve4ModbusScale: 1,
  curve4ModbusOffset: 0,
};

export function normalizeBinaryCurveConfig(config = {}, defaults = DEFAULT_BINARY_MULTI_FIELDS) {
  const merged = {
    ...defaults,
    ...config,
  };
  const normalized = {};

  for (const spec of HEX_CURVE_SLOT_SPECS) {
    const dataType = normalizeDataType(merged[spec.dataTypeKey]);
    normalized[spec.byteOffsetKey] = Math.max(0, Math.trunc(toFiniteNumber(merged[spec.byteOffsetKey], spec.defaultOffset)));
    normalized[spec.dataTypeKey] = dataType;
    normalized[spec.byteOrderKey] = normalizeByteOrder(merged[spec.byteOrderKey], dataType);
    normalized[spec.scaleKey] = toFiniteNumber(merged[spec.scaleKey], defaults[spec.scaleKey] ?? 1);
    normalized[spec.offsetKey] = toFiniteNumber(merged[spec.offsetKey], defaults[spec.offsetKey] ?? 0);
  }

  for (const spec of MODBUS_CURVE_SLOT_SPECS) {
    const dataType = normalizeDataType(merged[spec.dataTypeKey]);
    normalized[spec.byteOffsetKey] = Math.max(0, Math.trunc(toFiniteNumber(merged[spec.byteOffsetKey], spec.defaultOffset)));
    normalized[spec.dataTypeKey] = dataType;
    normalized[spec.byteOrderKey] = normalizeByteOrder(merged[spec.byteOrderKey], dataType);
    normalized[spec.scaleKey] = toFiniteNumber(merged[spec.scaleKey], defaults[spec.scaleKey] ?? 1);
    normalized[spec.offsetKey] = toFiniteNumber(merged[spec.offsetKey], defaults[spec.offsetKey] ?? 0);
  }

  normalized.modbusSlaveId = clamp(Math.trunc(toFiniteNumber(merged.modbusSlaveId, defaults.modbusSlaveId)), 1, 247);
  normalized.modbusFunctionCode = normalizeReadFunctionCode(merged.modbusFunctionCode);

  return normalized;
}

export function listHexChartSeries(config = {}, defaults = DEFAULT_BINARY_MULTI_FIELDS) {
  const normalized = {
    ...normalizeJsonCurveConfig(config, defaults),
    ...normalizeBinaryCurveConfig(config, defaults),
  };

  return buildBinaryChartSeries(normalized, HEX_CURVE_SLOT_SPECS).filter((series) => series.enabled);
}

export function listModbusChartSeries(config = {}, defaults = DEFAULT_BINARY_MULTI_FIELDS) {
  const normalized = {
    ...normalizeJsonCurveConfig(config, defaults),
    ...normalizeBinaryCurveConfig(config, defaults),
  };

  return buildBinaryChartSeries(normalized, MODBUS_CURVE_SLOT_SPECS).filter((series) => series.enabled);
}

export function parseHexCurveTelemetry(text, bytes, config, parseHexPayload, defaults = DEFAULT_BINARY_MULTI_FIELDS) {
  const payload = resolvePayloadBytes(text, bytes, parseHexPayload);
  if (!payload) {
    return null;
  }

  const series = listHexChartSeries(config, defaults);
  if (!series.length) {
    return null;
  }

  const variables = {};
  for (const item of series) {
    try {
      const rawValue = decodeRegisterValue(
        payload.subarray(item.byteOffset),
        item.dataType,
        item.byteOrder,
      );
      if (!Number.isFinite(rawValue)) {
        continue;
      }

      variables[item.key] = {
        fieldName: item.fieldName,
        unit: item.unit,
        rawValue,
        value: rawValue * item.scale + item.offset,
      };
    } catch {
      // Skip invalid curve slot decode.
    }
  }

  return finalizeMultiTelemetry(variables, series);
}

export function parseModbusCurveTelemetry(text, bytes, config, bufferState, parseHexPayload, defaults = DEFAULT_BINARY_MULTI_FIELDS) {
  const payload = resolvePayloadBytes(text, bytes, parseHexPayload);
  if (!payload || payload.length === 0) {
    return null;
  }

  appendByteFrameBuffer(bufferState, payload);
  const { frames, remainder } = extractRtuFrames(bufferState.bytes);
  bufferState.bytes = remainder;

  const normalized = {
    ...normalizeJsonCurveConfig(config, defaults),
    ...normalizeBinaryCurveConfig(config, defaults),
  };
  const series = listModbusChartSeries(normalized, defaults);
  if (!series.length) {
    return null;
  }

  for (const frame of frames) {
    if (frame[0] !== normalized.modbusSlaveId) {
      continue;
    }

    if (!isReadFunctionCode(frame[1]) || frame[1] !== normalized.modbusFunctionCode) {
      continue;
    }

    const byteCount = frame[2];
    const data = frame.subarray(3, 3 + byteCount);
    const variables = {};

    for (const item of series) {
      try {
        const rawValue = decodeRegisterValue(
          data.subarray(item.byteOffset),
          item.dataType,
          item.byteOrder,
        );
        if (!Number.isFinite(rawValue)) {
          continue;
        }

        variables[item.key] = {
          fieldName: item.fieldName,
          unit: item.unit,
          rawValue,
          value: rawValue * item.scale + item.offset,
        };
      } catch {
        // Skip invalid curve slot decode.
      }
    }

    const telemetry = finalizeMultiTelemetry(variables, series);
    if (telemetry) {
      return telemetry;
    }
  }

  return null;
}

export function decodeModbusReadDataCurves(data, config, defaults = DEFAULT_BINARY_MULTI_FIELDS) {
  const normalized = {
    ...normalizeJsonCurveConfig(config, defaults),
    ...normalizeBinaryCurveConfig(config, defaults),
  };
  const series = listModbusChartSeries(normalized, defaults);
  if (!series.length) {
    return null;
  }

  const variables = {};
  for (const item of series) {
    try {
      const rawValue = decodeRegisterValue(
        data.subarray(item.byteOffset),
        item.dataType,
        item.byteOrder,
      );
      if (!Number.isFinite(rawValue)) {
        continue;
      }

      variables[item.key] = {
        fieldName: item.fieldName,
        unit: item.unit,
        rawValue,
        value: rawValue * item.scale + item.offset,
      };
    } catch {
      // Skip invalid curve slot decode.
    }
  }

  return finalizeMultiTelemetry(variables, series);
}

export function describeHexCurveSummary(config, defaults = DEFAULT_BINARY_MULTI_FIELDS) {
  const series = listHexChartSeries(config, defaults);
  if (series.length > 1) {
    return `多曲线：${series.map((item) => item.fieldName).join(" / ")}`;
  }

  const first = series[0];
  return first ? `偏移 ${first.byteOffset} · ${first.dataType.toUpperCase()} ${first.byteOrder}` : "HEX";
}

export function describeModbusCurveSummary(config, defaults = DEFAULT_BINARY_MULTI_FIELDS) {
  const normalized = normalizeBinaryCurveConfig(config, defaults);
  const series = listModbusChartSeries(config, defaults);
  if (series.length > 1) {
    return `多曲线：${series.map((item) => item.fieldName).join(" / ")}`;
  }

  return `从站 ${normalized.modbusSlaveId} · 功能码 ${normalized.modbusFunctionCode}`;
}

export function removeMultiCurveSlot(config, slotNumber, defaults = DEFAULT_JSON_CURVE_CONFIG) {
  const jsonNormalized = normalizeJsonCurveConfig(config, defaults);
  const binaryDefaults = {
    ...DEFAULT_BINARY_MULTI_FIELDS,
    ...defaults,
  };
  const slotIndex = Math.trunc(Number(slotNumber)) - 1;

  if (slotIndex < 1 || slotIndex >= jsonNormalized.curveSlotCount) {
    return {
      ...jsonNormalized,
      ...normalizeBinaryCurveConfig(config, binaryDefaults),
    };
  }

  const merged = {
    ...binaryDefaults,
    ...defaults,
    ...config,
    ...jsonNormalized,
    ...normalizeBinaryCurveConfig(config, binaryDefaults),
  };

  for (let index = slotIndex; index < jsonNormalized.curveSlotCount - 1; index += 1) {
    shiftBinarySlotFields(merged, index, index + 1);
    shiftJsonSlotFields(merged, index, index + 1, defaults);
  }

  clearBinarySlotFields(merged, jsonNormalized.curveSlotCount - 1, binaryDefaults);
  clearJsonSlotFields(merged, jsonNormalized.curveSlotCount - 1, defaults);
  merged.curveSlotCount = jsonNormalized.curveSlotCount - 1;

  return {
    ...normalizeJsonCurveConfig(merged, defaults),
    ...normalizeBinaryCurveConfig(merged, binaryDefaults),
  };
}

function buildBinaryChartSeries(config, slotSpecs) {
  return slotSpecs.map((spec, index) => {
    const slot = JSON_CURVE_SLOTS[index];
    return {
      key: spec.key,
      enabled: slot.key === "curve1" ? config[slot.enabledKey] !== false : Boolean(config[slot.enabledKey]),
      fieldName: String(config[slot.fieldNameKey] || slot.defaultName),
      unit: String(config[slot.unitKey] ?? ""),
      color: slot.color,
      byteOffset: config[spec.byteOffsetKey],
      dataType: config[spec.dataTypeKey],
      byteOrder: config[spec.byteOrderKey],
      scale: config[spec.scaleKey],
      offset: config[spec.offsetKey],
    };
  }).filter((series) => {
    if (!series.enabled) {
      return false;
    }

    if (series.key === "curve1") {
      return true;
    }

    const slotNumber = Number(series.key.replace("curve", ""));
    return slotNumber <= config.curveSlotCount;
  });
}

function finalizeMultiTelemetry(variables, series) {
  const activeVariables = Object.values(variables);
  if (!activeVariables.length) {
    return null;
  }

  if (series.length > 1 && activeVariables.length > 0) {
    return {
      isMulti: true,
      variables,
    };
  }

  const entry = activeVariables[0];
  return {
    fieldName: entry.fieldName,
    unit: entry.unit,
    value: entry.value,
    rawValue: entry.rawValue,
  };
}

function shiftJsonSlotFields(merged, toIndex, fromIndex, defaults) {
  const toSlot = JSON_CURVE_SLOTS[toIndex];
  const fromSlot = JSON_CURVE_SLOTS[fromIndex];
  merged[toSlot.enabledKey] = merged[fromSlot.enabledKey];
  merged[toSlot.fieldNameKey] = merged[fromSlot.fieldNameKey];
  merged[toSlot.unitKey] = merged[fromSlot.unitKey];
  merged[toSlot.pathKey] = merged[fromSlot.pathKey];
}

function clearJsonSlotFields(merged, slotIndex, defaults) {
  const slot = JSON_CURVE_SLOTS[slotIndex];
  if (slot.key === "curve1") {
    merged[slot.enabledKey] = true;
    return;
  }

  merged[slot.enabledKey] = false;
  merged[slot.fieldNameKey] = defaults[slot.fieldNameKey] ?? slot.defaultName;
  merged[slot.unitKey] = defaults[slot.unitKey] ?? "";
  merged[slot.pathKey] = defaults[slot.pathKey] ?? "";
}

function shiftBinarySlotFields(merged, toIndex, fromIndex) {
  shiftSlotSpecFields(merged, HEX_CURVE_SLOT_SPECS[toIndex], HEX_CURVE_SLOT_SPECS[fromIndex]);
  shiftSlotSpecFields(merged, MODBUS_CURVE_SLOT_SPECS[toIndex], MODBUS_CURVE_SLOT_SPECS[fromIndex]);
}

function clearBinarySlotFields(merged, slotIndex, defaults) {
  clearSlotSpecFields(merged, HEX_CURVE_SLOT_SPECS[slotIndex], defaults);
  clearSlotSpecFields(merged, MODBUS_CURVE_SLOT_SPECS[slotIndex], defaults);
}

function shiftSlotSpecFields(merged, toSpec, fromSpec) {
  merged[toSpec.byteOffsetKey] = merged[fromSpec.byteOffsetKey];
  merged[toSpec.dataTypeKey] = merged[fromSpec.dataTypeKey];
  merged[toSpec.byteOrderKey] = merged[fromSpec.byteOrderKey];
  merged[toSpec.scaleKey] = merged[fromSpec.scaleKey];
  merged[toSpec.offsetKey] = merged[fromSpec.offsetKey];
}

function clearSlotSpecFields(merged, spec, defaults) {
  merged[spec.byteOffsetKey] = defaults[spec.byteOffsetKey] ?? spec.defaultOffset;
  merged[spec.dataTypeKey] = defaults[spec.dataTypeKey] ?? "uint16";
  merged[spec.byteOrderKey] = defaults[spec.byteOrderKey] ?? "AB";
  merged[spec.scaleKey] = defaults[spec.scaleKey] ?? 1;
  merged[spec.offsetKey] = defaults[spec.offsetKey] ?? 0;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function toFiniteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}
