import i18n from "../../i18n.js";
import {
  listDebugCurveControlElements,
  populateDebugCurveConfigForm,
  readDebugCurveConfigForm,
} from "../../debug-curve-form.js";
import { DEFAULT_MODBUS_CONFIG, normalizeModbusConfig } from "../../protocols.js";

const STORAGE_KEY = "modusignal.modbusDevice.v1";

export function loadModbusConfig() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return normalizeModbusConfig(saved ? JSON.parse(saved) : DEFAULT_MODBUS_CONFIG);
  } catch {
    return normalizeModbusConfig(DEFAULT_MODBUS_CONFIG);
  }
}

export function persistModbusConfig(config) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeModbusConfig(config)));
}

export function createModbusConfigUi({ elements, syncCurveRows }) {
  function readConfigForm() {
    return normalizeModbusConfig({
      slaveId: elements.modbusSlaveId.value,
      functionCode: elements.modbusFunctionCode.value,
      address: elements.modbusAddress.value,
      quantity: elements.modbusQuantity.value,
      pollIntervalMs: elements.modbusPollIntervalMs.value,
      ...readDebugCurveConfigForm("modbus", elements),
    });
  }

  function populateConfigForm(config) {
    const normalized = normalizeModbusConfig(config);
    elements.modbusSlaveId.value = String(normalized.slaveId);
    elements.modbusFunctionCode.value = String(normalized.functionCode);
    elements.modbusAddress.value = String(normalized.address);
    elements.modbusQuantity.value = String(normalized.quantity);
    elements.modbusPollIntervalMs.value = String(normalized.pollIntervalMs);
    populateDebugCurveConfigForm("modbus", normalized, elements);
    syncCurveRows("modbus", normalized);
    if (elements.modbusParserPreview) elements.modbusParserPreview.textContent = i18n("curve.waitingTest");
  }

  function getConfigControls() {
    return [
      elements.modbusSlaveId,
      elements.modbusFunctionCode,
      elements.modbusAddress,
      elements.modbusQuantity,
      elements.modbusPollIntervalMs,
      ...listDebugCurveControlElements("modbus", elements),
    ];
  }

  return { getConfigControls, populateConfigForm, readConfigForm };
}
