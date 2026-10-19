import i18n from "./i18n.js";
import { HEX_CURVE_SLOT_SPECS, MODBUS_CURVE_SLOT_SPECS } from "./devices/binary-curve-config.js";
import { JSON_CURVE_SLOTS } from "./devices/json-curve-config.js";

const CURVE_KEYS = ["curve.curveOne", "curve.curveTwo", "curve.curveThree", "curve.curveFour"];

const DATA_TYPE_OPTIONS = [
  { value: "uint16", label: "UInt16" },
  { value: "int16", label: "Int16" },
  { value: "float32", label: "Float32" },
];

const BYTE_ORDER_OPTIONS = [
  { value: "AB", label: "AB / ABCD" },
  { value: "BA", label: "BA" },
  { value: "DCBA", label: "DCBA" },
  { value: "BADC", label: "BADC" },
  { value: "CDAB", label: "CDAB" },
];

const SLOT_DOM_SUFFIX = {
  curve1: {
    enabled: "Curve1Enabled",
    fieldName: "FieldName",
    unit: "Unit",
    path: "ParserFieldPath",
  },
  curve2: {
    enabled: "Curve2Enabled",
    fieldName: "Curve2FieldName",
    unit: "Curve2Unit",
    path: "Curve2FieldPath",
  },
  curve3: {
    enabled: "Curve3Enabled",
    fieldName: "Curve3FieldName",
    unit: "Curve3Unit",
    path: "Curve3FieldPath",
  },
  curve4: {
    enabled: "Curve4Enabled",
    fieldName: "Curve4FieldName",
    unit: "Curve4Unit",
    path: "Curve4FieldPath",
  },
};

export const MESSAGE_DEBUG_CURVE_SECTIONS = [
  {
    prefix: "custom",
    sectionId: "chartCurveCustomSection",
    testParserId: "testCustomParser",
    firstCurveHasUnit: false,
    parserSampleValue: '{"value":12.34}',
    parserSamplePlaceholder: 'JSON：{"value":12.34}；HEX/Modbus：02 00 64 03',
  },
  {
    prefix: "websocket",
    sectionId: "chartCurveWebsocketSection",
    testParserId: "testWebsocketParser",
    firstCurveHasUnit: true,
    parserSampleValue: '{"value":12.34}',
    parserSamplePlaceholder: 'JSON：{"value":12.34}；HEX/Modbus：01 03 02 00 64 B9 AF',
  },
  {
    prefix: "mqtt",
    sectionId: "chartCurveMqttSection",
    testParserId: "testMqttParser",
    firstCurveHasUnit: true,
    parserSampleValue: '{"value":25.6,"unit":"C"}',
    parserSamplePlaceholder: 'JSON：{"value":12.34}；HEX/Modbus：01 03 02 00 64 B9 AF',
  },
];

function domId(prefix, suffix) {
  return `${prefix}${suffix}`;
}

function buildSelect(id, options, selectedValue) {
  const items = options
    .map((option) => {
      const selected = option.value === selectedValue ? " selected" : "";
      return `<option value="${option.value}"${selected}>${option.label}</option>`;
    })
    .join("");
  return `<select id="${id}">${items}</select>`;
}

function buildBinaryModeFields(prefix, mode, spec, hidden = false) {
  const modePrefix = mode === "hex" ? "Hex" : "Modbus";
  const hiddenAttr = hidden ? " hidden" : "";
  const byteOffsetId = domId(prefix, `${spec.byteOffsetKey.charAt(0).toUpperCase()}${spec.byteOffsetKey.slice(1)}`);
  const dataTypeId = domId(prefix, `${spec.dataTypeKey.charAt(0).toUpperCase()}${spec.dataTypeKey.slice(1)}`);
  const byteOrderId = domId(prefix, `${spec.byteOrderKey.charAt(0).toUpperCase()}${spec.byteOrderKey.slice(1)}`);
  const scaleId = domId(prefix, `${spec.scaleKey.charAt(0).toUpperCase()}${spec.scaleKey.slice(1)}`);
  const offsetId = domId(prefix, `${spec.offsetKey.charAt(0).toUpperCase()}${spec.offsetKey.slice(1)}`);
  const offsetKey = mode === "modbus" ? "curve.dataOffset" : "curve.byteOffset";
  const offsetTitle = mode === "modbus" ? ` data-i18n-title="curve.dataOffsetTitle" title="${i18n("curve.dataOffsetTitle")}"` : "";

  return `
    <div class="curve-mode-fields" data-parser-mode="${mode}"${hiddenAttr}>
      <label><span data-i18n="${offsetKey}">${i18n(offsetKey)}</span><input id="${byteOffsetId}" type="number" min="0" step="1" value="${spec.defaultOffset}"${offsetTitle} /></label>
      <label><span data-i18n="curve.dataType">${i18n("curve.dataType")}</span>${buildSelect(dataTypeId, DATA_TYPE_OPTIONS, "uint16")}</label>
      <label><span data-i18n="curve.byteOrder">${i18n("curve.byteOrder")}</span>${buildSelect(byteOrderId, BYTE_ORDER_OPTIONS, "AB")}</label>
      <label><span data-i18n="curve.scale">${i18n("curve.scale")}</span><input id="${scaleId}" type="number" step="0.000001" value="1" /></label>
      <label><span data-i18n="curve.offset">${i18n("curve.offset")}</span><input id="${offsetId}" type="number" step="0.000001" value="0" /></label>
    </div>`;
}

function buildJsonPathFields(prefix, slotKey, hidden = false) {
  const suffix = SLOT_DOM_SUFFIX[slotKey];
  const hiddenAttr = hidden ? " hidden" : "";
  const slotKeyLabel = CURVE_KEYS[JSON_CURVE_SLOTS.findIndex((slot) => slot.key === slotKey)];
  const pathId = domId(prefix, suffix.path);
  return `
    <div class="curve-mode-fields" data-parser-mode="json"${hiddenAttr}>
      <label><span><span data-i18n="${slotKeyLabel}">${i18n(slotKeyLabel)}</span> <span data-i18n="curve.pathLabel">${i18n("curve.pathLabel")}</span></span><input id="${pathId}" type="text" value="${slotKey === "curve1" ? "value" : ""}" data-i18n-placeholder="curve.pathPlaceholder" placeholder="${i18n("curve.pathPlaceholder")}" /></label>
    </div>`;
}

function buildCurveToggle(prefix, slotKey, slotIndex, checked = false) {
  const suffix = SLOT_DOM_SUFFIX[slotKey];
  const slotName = i18n(CURVE_KEYS[slotIndex]);
  const enabledId = domId(prefix, suffix.enabled);
  const checkedAttr = checked ? " checked" : "";

  if (slotIndex === 0) {
    return `<label class="curve-toggle"><span><span data-i18n="curve.enableCurve">${i18n("curve.enableCurve")}</span> <span data-i18n="${CURVE_KEYS[slotIndex]}">${slotName}</span></span><input id="${enabledId}" type="checkbox"${checkedAttr} /></label>`;
  }

  return `
    <div class="curve-row-actions">
      <label class="curve-toggle"><span><span data-i18n="curve.enableCurve">${i18n("curve.enableCurve")}</span> <span data-i18n="${CURVE_KEYS[slotIndex]}">${slotName}</span></span><input id="${enabledId}" type="checkbox" /></label>
      <button type="button" class="ghost-button curve-remove-button" data-remove-curve-slot="${slotIndex + 1}" data-i18n-aria-label="curve.deleteCurve" aria-label="${i18n("curve.deleteCurve")}" data-i18n="curve.delete">${i18n("curve.delete")}</button>
    </div>`;
}

function buildCurveNameField(prefix, slotKey, slotIndex, defaultName) {
  const suffix = SLOT_DOM_SUFFIX[slotKey];
  const slotName = i18n(CURVE_KEYS[slotIndex]);
  const nameId = domId(prefix, suffix.fieldName);
  const value = defaultName ?? (slotIndex === 0 ? i18n("curve.nameField", "数值") : slotName);
  return `<label><span><span data-i18n="${CURVE_KEYS[slotIndex]}">${slotName}</span> <span data-i18n="curve.nameField">${i18n("curve.nameField")}</span></span><input id="${nameId}" type="text" value="${value}" /></label>`;
}

function buildUnitField(prefix, slotKey) {
  const suffix = SLOT_DOM_SUFFIX[slotKey];
  const unitId = domId(prefix, suffix.unit);
  return `<label><span data-i18n="curve.unit">${i18n("curve.unit")}</span><input id="${unitId}" type="text" data-i18n-placeholder="curve.unitPlaceholder" placeholder="${i18n("curve.unitPlaceholder")}" /></label>`;
}

function buildMessageCurveRow(prefix, slotIndex, options = {}) {
  const slot = JSON_CURVE_SLOTS[slotIndex];
  const slotKey = slot.key;
  const rowAttrs = slotIndex === 0 ? "" : ` data-curve-slot="${slotIndex + 1}" hidden`;
  const hexSpec = HEX_CURVE_SLOT_SPECS[slotIndex];
  const modbusSpec = MODBUS_CURVE_SLOT_SPECS[slotIndex];
  const parts = [
    buildCurveToggle(prefix, slotKey, slotIndex, slotIndex === 0),
    buildCurveNameField(prefix, slotKey, slotIndex),
  ];

  if (slotIndex > 0 || options.firstCurveHasUnit) {
    parts.push(buildUnitField(prefix, slotKey));
  }

  parts.push(
    buildJsonPathFields(prefix, slotKey, false),
    buildBinaryModeFields(prefix, "hex", hexSpec, true),
    buildBinaryModeFields(prefix, "modbus", modbusSpec, true),
  );

  return `<div class="curve-config-row"${rowAttrs}>${parts.join("")}</div>`;
}

function buildModbusOnlyCurveRow(prefix, slotIndex) {
  const slot = JSON_CURVE_SLOTS[slotIndex];
  const slotKey = slot.key;
  const spec = MODBUS_CURVE_SLOT_SPECS[slotIndex];
  const rowAttrs = slotIndex === 0 ? ' class="curve-config-row modbus-curve-row"' : ` class="curve-config-row modbus-curve-row" data-curve-slot="${slotIndex + 1}" hidden`;
  const byteOffsetId = domId(prefix, `${spec.byteOffsetKey.charAt(0).toUpperCase()}${spec.byteOffsetKey.slice(1)}`);
  const dataTypeId = domId(prefix, `${spec.dataTypeKey.charAt(0).toUpperCase()}${spec.dataTypeKey.slice(1)}`);
  const byteOrderId = domId(prefix, `${spec.byteOrderKey.charAt(0).toUpperCase()}${spec.byteOrderKey.slice(1)}`);
  const scaleId = domId(prefix, `${spec.scaleKey.charAt(0).toUpperCase()}${spec.scaleKey.slice(1)}`);
  const offsetId = domId(prefix, `${spec.offsetKey.charAt(0).toUpperCase()}${spec.offsetKey.slice(1)}`);

  return `
    <div${rowAttrs}>
      ${buildCurveToggle(prefix, slotKey, slotIndex, slotIndex === 0)}
      ${buildCurveNameField(prefix, slotKey, slotIndex, slotIndex === 0 ? i18n("chart.registryValue", "寄存器值") : undefined)}
      ${buildUnitField(prefix, slotKey)}
      <label><span data-i18n="curve.dataOffset">${i18n("curve.dataOffset")}</span><input id="${byteOffsetId}" type="number" min="0" step="1" value="${spec.defaultOffset}" data-i18n-title="curve.dataOffsetTitle" title="${i18n("curve.dataOffsetTitle")}" /></label>
      <label><span data-i18n="curve.dataType">${i18n("curve.dataType")}</span>${buildSelect(dataTypeId, DATA_TYPE_OPTIONS, "uint16")}</label>
      <label><span data-i18n="curve.byteOrder">${i18n("curve.byteOrder")}</span>${buildSelect(byteOrderId, BYTE_ORDER_OPTIONS, "AB")}</label>
      <label><span data-i18n="curve.scale">${i18n("curve.scale")}</span><input id="${scaleId}" type="number" step="0.000001" value="1" /></label>
      <label><span data-i18n="curve.offset">${i18n("curve.offset")}</span><input id="${offsetId}" type="number" step="0.000001" value="0" /></label>
    </div>`;
}

function buildParserTest(prefix, testParserId, sampleValue, samplePlaceholder) {
  return `
    <div class="parser-test">
      <label><span data-i18n="curve.parserSample">${i18n("curve.parserSample")}</span><input id="${prefix}ParserSample" type="text" value="${sampleValue.replace(/"/g, "&quot;")}" placeholder="${samplePlaceholder.replace(/"/g, "&quot;")}" /></label>
      <button id="${testParserId}" type="button" data-i18n="curve.testButton">${i18n("curve.testButton")}</button>
      <output id="${prefix}ParserPreview">${i18n("curve.waitingTest")}</output>
    </div>`;
}

function buildFramingFields(prefix) {
  return `
    <div id="${prefix}FramingFields" class="config-grid compact framing-fields">
      <label><span data-i18n="curve.frameMode">${i18n("curve.frameMode")}</span><select id="${prefix}FrameMode"><option value="none" selected data-i18n="curve.frameModeNone">${i18n("curve.frameModeNone")}</option><option value="line" data-i18n="curve.frameModeLine">${i18n("curve.frameModeLine")}</option><option value="stxEtx" data-i18n="curve.frameModeStxEtx">${i18n("curve.frameModeStxEtx")}</option></select></label>
      <label id="${prefix}RxLineEndingField" hidden><span data-i18n="curve.rxLineEnding">${i18n("curve.rxLineEnding")}</span><select id="${prefix}RxLineEnding"><option value="\\r\\n" selected>CRLF</option><option value="\\n">LF</option><option value="\\r">CR</option></select></label>
      <label id="${prefix}FramePrefixField" hidden><span data-i18n="curve.framePrefix">${i18n("curve.framePrefix")}</span><input id="${prefix}FramePrefixHex" type="text" data-i18n-placeholder="curve.framePrefixPlaceholder" placeholder="${i18n("curve.framePrefixPlaceholder")}" /></label>
      <label id="${prefix}FrameSuffixField" hidden><span data-i18n="curve.frameSuffix">${i18n("curve.frameSuffix")}</span><input id="${prefix}FrameSuffixHex" type="text" data-i18n-placeholder="curve.frameSuffixPlaceholder" placeholder="${i18n("curve.frameSuffixPlaceholder")}" /></label>
      <label id="${prefix}FrameCrcField"><span data-i18n="curve.crcCheck">${i18n("curve.crcCheck")}</span><select id="${prefix}FrameCrcMode"><option value="none" selected data-i18n="curve.crcNone">${i18n("curve.crcNone")}</option><option value="modbus" data-i18n="curve.crcModbus">${i18n("curve.crcModbus")}</option></select></label>
    </div>`;
}

function buildModbusSharedFields(prefix) {
  return `
    <div id="${prefix}ModbusSharedFields" class="config-grid compact" data-parser-mode="modbus" hidden>
      <label><span data-i18n="curve.slaveId">${i18n("curve.slaveId")}</span><input id="${prefix}ModbusSlaveId" type="number" min="1" max="247" step="1" value="1" /></label>
      <label><span data-i18n="curve.functionCode">${i18n("curve.functionCode")}</span><select id="${prefix}ModbusFunctionCode"><option value="3" selected data-i18n="modbus.fc03">${i18n("modbus.fc03")}</option><option value="4" data-i18n="modbus.fc04">${i18n("modbus.fc04")}</option></select></label>
    </div>`;
}

export function buildModbusCurveSectionHtml(prefix = "modbus") {
  const rows = JSON_CURVE_SLOTS.map((_, index) => buildModbusOnlyCurveRow(prefix, index)).join("");
  return `
    <p class="chart-curve-section-note" data-i18n="debugCurve.modbusNote">${i18n("debugCurve.modbusNote")}</p>
    <div id="${prefix}CurveConfigBlock" class="chart-curve-config">
      <div class="subsection-heading compact">
        <h3 id="${prefix}CurveConfigTitle" data-i18n="debugCurve.modbusTitle">${i18n("debugCurve.modbusTitle")}</h3>
        <span id="${prefix}CurveConfigHint" data-i18n="debugCurve.modbusHint">${i18n("debugCurve.modbusHint")}</span>
      </div>
      <div class="curve-config-list">
        ${rows}
        <button id="${prefix}AddCurve" class="ghost-button add-curve-button" type="button" data-i18n="curve.addCurve">${i18n("curve.addCurve")}</button>
      </div>
    </div>
    ${buildParserTest(prefix, "testModbusParser", "01 03 04 00 64 00 C8 BA 7A", i18n("debugCurve.rtuSampleHint", "完整 RTU 帧 HEX"))}`;
}

export function buildMessageDebugCurveSectionHtml(prefix, options = {}) {
  const rows = JSON_CURVE_SLOTS.map((_, index) =>
    buildMessageCurveRow(prefix, index, { firstCurveHasUnit: options.firstCurveHasUnit }),
  ).join("");

  return `
    <div class="config-grid compact">
      <label><span data-i18n="curve.curveParser">${i18n("curve.curveParser")}</span><select id="${prefix}ParserMode"><option value="json" selected data-i18n="curve.parserJson">${i18n("curve.parserJson")}</option><option value="hex" data-i18n="curve.parserHex">${i18n("curve.parserHex")}</option><option value="modbus" data-i18n="curve.parserModbus">${i18n("curve.parserModbus")}</option></select></label>
    </div>
    ${buildFramingFields(prefix)}
    ${buildModbusSharedFields(prefix)}
    <div id="${prefix}CurveConfigBlock" class="chart-curve-config">
      <div class="subsection-heading compact">
        <h3 id="${prefix}CurveConfigTitle" data-i18n="debugCurve.jsonTitle">${i18n("debugCurve.jsonTitle")}</h3>
        <span id="${prefix}CurveConfigHint" data-i18n="debugCurve.jsonHint">${i18n("debugCurve.jsonHint")}</span>
      </div>
      <div class="curve-config-list">
        ${rows}
        <button id="${prefix}AddCurve" class="ghost-button add-curve-button" type="button" data-i18n="curve.addCurve">${i18n("curve.addCurve")}</button>
      </div>
    </div>
    ${buildParserTest(prefix, options.testParserId, options.parserSampleValue, options.parserSamplePlaceholder)}`;
}

export function mountChartCurveSections(root = document) {
  const modbusHost = root.querySelector("#chartCurveModbusSection");
  if (modbusHost) {
    modbusHost.innerHTML = buildModbusCurveSectionHtml("modbus");
  }

  for (const section of MESSAGE_DEBUG_CURVE_SECTIONS) {
    const host = root.querySelector(`#${section.sectionId}`);
    if (host) {
      host.innerHTML = buildMessageDebugCurveSectionHtml(section.prefix, section);
    }
  }
}
