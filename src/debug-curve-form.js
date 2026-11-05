import { HEX_CURVE_SLOT_SPECS, MODBUS_CURVE_SLOT_SPECS } from "./devices/binary-curve-config.js";

const FRAMING_KEYS = ["frameMode", "rxLineEnding", "framePrefixHex", "frameSuffixHex", "frameCrcMode"];

const JSON_CURVE_FIELD_BINDINGS = [
  { key: "curve1Enabled", suffix: "Curve1Enabled" },
  { key: "fieldName", suffix: "FieldName" },
  { key: "parserFieldPath", suffix: "ParserFieldPath" },
  { key: "unit", suffix: "Unit" },
  { key: "curve2Enabled", suffix: "Curve2Enabled" },
  { key: "curve2FieldName", suffix: "Curve2FieldName" },
  { key: "curve2FieldPath", suffix: "Curve2FieldPath" },
  { key: "curve2Unit", suffix: "Curve2Unit" },
  { key: "curve3Enabled", suffix: "Curve3Enabled" },
  { key: "curve3FieldName", suffix: "Curve3FieldName" },
  { key: "curve3FieldPath", suffix: "Curve3FieldPath" },
  { key: "curve3Unit", suffix: "Curve3Unit" },
  { key: "curve4Enabled", suffix: "Curve4Enabled" },
  { key: "curve4FieldName", suffix: "Curve4FieldName" },
  { key: "curve4FieldPath", suffix: "Curve4FieldPath" },
  { key: "curve4Unit", suffix: "Curve4Unit" },
];

export function toDebugCurveElementId(prefix, configKey) {
  return `${prefix}${configKey.charAt(0).toUpperCase()}${configKey.slice(1)}`;
}

function toDebugCurveDomId(prefix, suffix) {
  return `${prefix}${suffix}`;
}

export function registerDebugCurveFormElements(prefix, elements, root = document) {
  const keys = new Set([
    "modbusSlaveId",
    "modbusFunctionCode",
    ...FRAMING_KEYS,
  ]);

  for (const spec of HEX_CURVE_SLOT_SPECS) {
    keys.add(spec.byteOffsetKey);
    keys.add(spec.dataTypeKey);
    keys.add(spec.byteOrderKey);
    keys.add(spec.scaleKey);
    keys.add(spec.offsetKey);
  }

  for (const spec of MODBUS_CURVE_SLOT_SPECS) {
    keys.add(spec.byteOffsetKey);
    keys.add(spec.dataTypeKey);
    keys.add(spec.byteOrderKey);
    keys.add(spec.scaleKey);
    keys.add(spec.offsetKey);
  }

  for (const key of keys) {
    const elementId = toDebugCurveElementId(prefix, key);
    elements[elementId] = root.querySelector(`#${elementId}`);
  }

  elements[`${prefix}CurveConfigBlock`] = root.querySelector(`#${prefix}CurveConfigBlock`);
  elements[`${prefix}CurveConfigTitle`] = root.querySelector(`#${prefix}CurveConfigTitle`);
  elements[`${prefix}CurveConfigHint`] = root.querySelector(`#${prefix}CurveConfigHint`);
  elements[`${prefix}ModbusSharedFields`] = root.querySelector(`#${prefix}ModbusSharedFields`);
  elements[`${prefix}FramingFields`] = root.querySelector(`#${prefix}FramingFields`);
  elements[`${prefix}RxLineEndingField`] = root.querySelector(`#${prefix}RxLineEndingField`);
  elements[`${prefix}FramePrefixField`] = root.querySelector(`#${prefix}FramePrefixField`);
  elements[`${prefix}FrameSuffixField`] = root.querySelector(`#${prefix}FrameSuffixField`);
  elements[`${prefix}FrameCrcField`] = root.querySelector(`#${prefix}FrameCrcField`);
  elements[`${prefix}ParserMode`] = root.querySelector(`#${prefix}ParserMode`);
  elements[`${prefix}AddCurve`] = root.querySelector(`#${prefix}AddCurve`);
  elements[`${prefix}ParserSample`] = root.querySelector(`#${prefix}ParserSample`);
  elements[`${prefix}ParserPreview`] = root.querySelector(`#${prefix}ParserPreview`);

  for (const binding of JSON_CURVE_FIELD_BINDINGS) {
    elements[toDebugCurveDomId(prefix, binding.suffix)] = root.querySelector(`#${toDebugCurveDomId(prefix, binding.suffix)}`);
  }
}

export function readDebugCurveConfigForm(prefix, elements) {
  const values = {
    parserMode: elements[`${prefix}ParserMode`]?.value,
  };

  for (const binding of JSON_CURVE_FIELD_BINDINGS) {
    const element = elements[toDebugCurveDomId(prefix, binding.suffix)];
    if (!element) {
      continue;
    }
    values[binding.key] = element.type === "checkbox" ? element.checked : element.value;
  }

  return {
    ...values,
    ...readBinaryCurveFormValues(prefix, elements),
    ...readFramingFormValues(prefix, elements),
  };
}

export function populateDebugCurveConfigForm(prefix, config, elements) {
  if (elements[`${prefix}ParserMode`]) {
    elements[`${prefix}ParserMode`].value = config.parserMode;
  }

  for (const binding of JSON_CURVE_FIELD_BINDINGS) {
    const element = elements[toDebugCurveDomId(prefix, binding.suffix)];
    if (!element || config[binding.key] === undefined) {
      continue;
    }
    if (element.type === "checkbox") {
      element.checked = Boolean(config[binding.key]);
    } else {
      element.value = String(config[binding.key]);
    }
  }

  populateBinaryCurveFormValues(prefix, config, elements);
  populateFramingFormValues(prefix, config, elements);
  if (elements[`${prefix}ParserMode`]) {
    syncDebugCurveModeFields(prefix, config.parserMode, elements, config);
  }
}

export function readFramingFormValues(prefix, elements) {
  const values = {};
  for (const key of FRAMING_KEYS) {
    values[key] = getElementValue(prefix, key, elements);
  }
  return values;
}

export function populateFramingFormValues(prefix, config, elements) {
  for (const key of FRAMING_KEYS) {
    setElementValue(prefix, key, config[key], elements);
  }
  syncFramingFieldVisibility(prefix, config, elements);
}

export function listDebugCurveControlElements(prefix, elements) {
  return [
    elements[`${prefix}ParserMode`],
    ...JSON_CURVE_FIELD_BINDINGS.map((binding) => elements[toDebugCurveDomId(prefix, binding.suffix)]),
    ...listBinaryCurveControlElements(prefix, elements),
    ...FRAMING_KEYS.map((key) => elements[toDebugCurveElementId(prefix, key)]),
  ].filter(Boolean);
}

export function readBinaryCurveFormValues(prefix, elements) {
  const values = {};

  for (const spec of HEX_CURVE_SLOT_SPECS) {
    values[spec.byteOffsetKey] = getElementValue(prefix, spec.byteOffsetKey, elements);
    values[spec.dataTypeKey] = getElementValue(prefix, spec.dataTypeKey, elements);
    values[spec.byteOrderKey] = getElementValue(prefix, spec.byteOrderKey, elements);
    values[spec.scaleKey] = getElementValue(prefix, spec.scaleKey, elements);
    values[spec.offsetKey] = getElementValue(prefix, spec.offsetKey, elements);
  }

  for (const spec of MODBUS_CURVE_SLOT_SPECS) {
    values[spec.byteOffsetKey] = getElementValue(prefix, spec.byteOffsetKey, elements);
    values[spec.dataTypeKey] = getElementValue(prefix, spec.dataTypeKey, elements);
    values[spec.byteOrderKey] = getElementValue(prefix, spec.byteOrderKey, elements);
    values[spec.scaleKey] = getElementValue(prefix, spec.scaleKey, elements);
    values[spec.offsetKey] = getElementValue(prefix, spec.offsetKey, elements);
  }

  values.modbusSlaveId = getElementValue(prefix, "modbusSlaveId", elements);
  values.modbusFunctionCode = getElementValue(prefix, "modbusFunctionCode", elements);

  return values;
}

export function populateBinaryCurveFormValues(prefix, config, elements) {
  for (const spec of HEX_CURVE_SLOT_SPECS) {
    setElementValue(prefix, spec.byteOffsetKey, config[spec.byteOffsetKey], elements);
    setElementValue(prefix, spec.dataTypeKey, config[spec.dataTypeKey], elements);
    setElementValue(prefix, spec.byteOrderKey, config[spec.byteOrderKey], elements);
    setElementValue(prefix, spec.scaleKey, config[spec.scaleKey], elements);
    setElementValue(prefix, spec.offsetKey, config[spec.offsetKey], elements);
  }

  for (const spec of MODBUS_CURVE_SLOT_SPECS) {
    setElementValue(prefix, spec.byteOffsetKey, config[spec.byteOffsetKey], elements);
    setElementValue(prefix, spec.dataTypeKey, config[spec.dataTypeKey], elements);
    setElementValue(prefix, spec.byteOrderKey, config[spec.byteOrderKey], elements);
    setElementValue(prefix, spec.scaleKey, config[spec.scaleKey], elements);
    setElementValue(prefix, spec.offsetKey, config[spec.offsetKey], elements);
  }

  setElementValue(prefix, "modbusSlaveId", config.modbusSlaveId, elements);
  setElementValue(prefix, "modbusFunctionCode", config.modbusFunctionCode, elements);
}

export function syncDebugCurveModeFields(prefix, parserMode, elements, config = {}) {
  const block = elements[`${prefix}CurveConfigBlock`];
  block?.querySelectorAll("[data-parser-mode]").forEach((node) => {
    node.hidden = node.dataset.parserMode !== parserMode;
  });

  if (elements[`${prefix}ModbusSharedFields`]) {
    elements[`${prefix}ModbusSharedFields`].hidden = parserMode !== "modbus";
  }

  const headings = {
    json: { title: "JSON 曲线", hint: "支持 data.temp、metrics.0.value 这类路径" },
    hex: { title: "HEX 曲线", hint: "同一条报文内按字节偏移解码多条曲线" },
    modbus: { title: "Modbus 曲线", hint: "同一 RTU 帧内按数据区偏移解码多条曲线" },
  };
  const heading = headings[parserMode] ?? headings.json;
  const titleEl = elements[`${prefix}CurveConfigTitle`];
  const hintEl = elements[`${prefix}CurveConfigHint`];
  if (titleEl) {
    titleEl.textContent = heading.title;
  }
  if (hintEl) {
    hintEl.textContent = heading.hint;
  }

  syncFramingFieldVisibility(prefix, { ...config, parserMode }, elements);
}

export function syncFramingFieldVisibility(prefix, config, elements) {
  const frameMode = config.frameMode ?? "none";
  const parserMode = config.parserMode ?? "json";
  const isLine = frameMode === "line";
  const isStxEtx = frameMode === "stxEtx";

  if (elements[`${prefix}RxLineEndingField`]) {
    elements[`${prefix}RxLineEndingField`].hidden = !isLine;
  }
  if (elements[`${prefix}FramePrefixField`]) {
    elements[`${prefix}FramePrefixField`].hidden = !isStxEtx;
  }
  if (elements[`${prefix}FrameSuffixField`]) {
    elements[`${prefix}FrameSuffixField`].hidden = !isStxEtx;
  }
  if (elements[`${prefix}FrameCrcField`]) {
    elements[`${prefix}FrameCrcField`].hidden = parserMode === "modbus";
    const select = elements[toDebugCurveElementId(prefix, "frameCrcMode")];
    if (select && parserMode === "modbus") {
      select.value = "modbus";
      select.disabled = true;
    } else if (select) {
      select.disabled = false;
    }
  }
}

export function listBinaryCurveControlElements(prefix, elements) {
  const keys = new Set(["modbusSlaveId", "modbusFunctionCode"]);
  for (const spec of HEX_CURVE_SLOT_SPECS) {
    keys.add(spec.byteOffsetKey);
    keys.add(spec.dataTypeKey);
    keys.add(spec.byteOrderKey);
    keys.add(spec.scaleKey);
    keys.add(spec.offsetKey);
  }
  for (const spec of MODBUS_CURVE_SLOT_SPECS) {
    keys.add(spec.byteOffsetKey);
    keys.add(spec.dataTypeKey);
    keys.add(spec.byteOrderKey);
    keys.add(spec.scaleKey);
    keys.add(spec.offsetKey);
  }

  return [...keys].map((key) => elements[toDebugCurveElementId(prefix, key)]).filter(Boolean);
}

function getElementValue(prefix, key, elements) {
  const element = elements[toDebugCurveElementId(prefix, key)];
  if (!element) {
    return undefined;
  }

  if (element.type === "checkbox") {
    return element.checked;
  }

  return element.value;
}

function setElementValue(prefix, key, value, elements) {
  const element = elements[toDebugCurveElementId(prefix, key)];
  if (!element || value === undefined) {
    return;
  }

  if (element.type === "checkbox") {
    element.checked = Boolean(value);
    return;
  }

  element.value = String(value);
}
