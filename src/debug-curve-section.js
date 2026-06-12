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
  const offsetLabel = mode === "modbus" ? i18n("curve.dataOffset") : i18n("curve.byteOffset");
  const offsetTitle = mode === "modbus" ? ` title="${i18n("curve.dataOffsetTitle", "相对读响应数据区首字节的偏移")}"` : "";

  return `
    <div class="curve-mode-fields" data-parser-mode="${mode}"${hiddenAttr}>
      <label>${offsetLabel}<input id="${byteOffsetId}" type="number" min="0" step="1" value="${spec.defaultOffset}"${offsetTitle} /></label>
      <label>${i18n("curve.dataType")}${buildSelect(dataTypeId, DATA_TYPE_OPTIONS, "uint16")}</label>
      <label>${i18n("curve.byteOrder")}${buildSelect(byteOrderId, BYTE_ORDER_OPTIONS, "AB")}</label>
      <label>${i18n("curve.scale")}<input id="${scaleId}" type="number" step="0.000001" value="1" /></label>
      <label>${i18n("curve.offset")}<input id="${offsetId}" type="number" step="0.000001" value="0" /></label>
    </div>`;
}

function buildJsonPathFields(prefix, slotKey, hidden = false) {
  const suffix = SLOT_DOM_SUFFIX[slotKey];
  const hiddenAttr = hidden ? " hidden" : "";
  const slotNumber = i18n(CURVE_KEYS[JSON_CURVE_SLOTS.findIndex((slot) => slot.key === slotKey)]);
  const pathId = domId(prefix, suffix.path);
  return `
    <div class="curve-mode-fields" data-parser-mode="json"${hiddenAttr}>
      <label>${slotNumber}${i18n("curve.pathLabel", "路径")}<input id="${pathId}" type="text" value="${slotKey === "curve1" ? "value" : ""}" placeholder="${i18n("curve.pathPlaceholder")}" /></label>
    </div>`;
}

function buildCurveToggle(prefix, slotKey, slotIndex, checked = false) {
  const suffix = SLOT_DOM_SUFFIX[slotKey];
  const slotName = i18n(CURVE_KEYS[slotIndex]);
  const enabledId = domId(prefix, suffix.enabled);
  const checkedAttr = checked ? " checked" : "";

  if (slotIndex === 0) {
    return `<label class="curve-toggle">${i18n("curve.enableCurve")}${slotName}<input id="${enabledId}" type="checkbox"${checkedAttr} /></label>`;
  }

  return `
    <div class="curve-row-actions">
      <label class="curve-toggle">${i18n("curve.enableCurve")}${slotName}<input id="${enabledId}" type="checkbox" /></label>
      <button type="button" class="ghost-button curve-remove-button" data-remove-curve-slot="${slotIndex + 1}" aria-label="${i18n("curve.deleteCurve")}${slotName}">${i18n("curve.delete")}</button>
    </div>`;
}

function buildCurveNameField(prefix, slotKey, slotIndex, defaultName) {
  const suffix = SLOT_DOM_SUFFIX[slotKey];
  const slotName = i18n(CURVE_KEYS[slotIndex]);
  const nameId = domId(prefix, suffix.fieldName);
  const value = defaultName ?? (slotIndex === 0 ? i18n("curve.nameField", "数值") : slotName);
  return `<label>${slotName}${i18n("curve.nameField")}<input id="${nameId}" type="text" value="${value}" /></label>`;
}

function buildUnitField(prefix, slotKey) {
  const suffix = SLOT_DOM_SUFFIX[slotKey];
  const unitId = domId(prefix, suffix.unit);
  return `<label>${i18n("curve.unit")}<input id="${unitId}" type="text" placeholder="${i18n("curve.unitPlaceholder")}" /></label>`;
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
      <label>${i18n("curve.dataOffset")}<input id="${byteOffsetId}" type="number" min="0" step="1" value="${spec.defaultOffset}" title="${i18n("curve.dataOffsetTitle", "相对读响应数据区首字节的偏移")}" /></label>
      <label>${i18n("curve.dataType")}${buildSelect(dataTypeId, DATA_TYPE_OPTIONS, "uint16")}</label>
      <label>${i18n("curve.byteOrder")}${buildSelect(byteOrderId, BYTE_ORDER_OPTIONS, "AB")}</label>
      <label>${i18n("curve.scale")}<input id="${scaleId}" type="number" step="0.000001" value="1" /></label>
      <label>${i18n("curve.offset")}<input id="${offsetId}" type="number" step="0.000001" value="0" /></label>
    </div>`;
}

function buildParserTest(prefix, testParserId, sampleValue, samplePlaceholder) {
  return `
    <div class="parser-test">
      <label>${i18n("curve.parserSample")}<input id="${prefix}ParserSample" type="text" value="${sampleValue.replace(/"/g, "&quot;")}" placeholder="${samplePlaceholder.replace(/"/g, "&quot;")}" /></label>
      <button id="${testParserId}" type="button">${i18n("curve.testButton")}</button>
      <output id="${prefix}ParserPreview">${i18n("curve.waitingTest")}</output>
    </div>`;
}

function buildFramingFields(prefix) {
  return `
    <div id="${prefix}FramingFields" class="config-grid compact framing-fields">
      <label>${i18n("curve.frameMode")}<select id="${prefix}FrameMode"><option value="none" selected>${i18n("curve.frameModeNone")}</option><option value="line">${i18n("curve.frameModeLine")}</option><option value="stxEtx">${i18n("curve.frameModeStxEtx")}</option></select></label>
      <label id="${prefix}RxLineEndingField" hidden>${i18n("curve.rxLineEnding")}<select id="${prefix}RxLineEnding"><option value="\\r\\n" selected>CRLF</option><option value="\\n">LF</option><option value="\\r">CR</option></select></label>
      <label id="${prefix}FramePrefixField" hidden>${i18n("curve.framePrefix")}<input id="${prefix}FramePrefixHex" type="text" placeholder="${i18n("curve.framePrefixPlaceholder")}" /></label>
      <label id="${prefix}FrameSuffixField" hidden>${i18n("curve.frameSuffix")}<input id="${prefix}FrameSuffixHex" type="text" placeholder="${i18n("curve.frameSuffixPlaceholder")}" /></label>
      <label id="${prefix}FrameCrcField">${i18n("curve.crcCheck")}<select id="${prefix}FrameCrcMode"><option value="none" selected>${i18n("curve.crcNone")}</option><option value="modbus">${i18n("curve.crcModbus")}</option></select></label>
    </div>`;
}

function buildModbusSharedFields(prefix) {
  return `
    <div id="${prefix}ModbusSharedFields" class="config-grid compact" data-parser-mode="modbus" hidden>
      <label>${i18n("curve.slaveId")}<input id="${prefix}ModbusSlaveId" type="number" min="1" max="247" step="1" value="1" /></label>
      <label>${i18n("curve.functionCode")}<select id="${prefix}ModbusFunctionCode"><option value="3" selected>${i18n("modbus.fc03")}</option><option value="4">${i18n("modbus.fc04")}</option></select></label>
    </div>`;
}

export function buildModbusCurveSectionHtml(prefix = "modbus") {
  const rows = JSON_CURVE_SLOTS.map((_, index) => buildModbusOnlyCurveRow(prefix, index)).join("");
  return `
    <p class="chart-curve-section-note">${i18n("debugCurve.modbusNote", "读模式下从 RTU 回包<strong>数据区</strong>按字节偏移解码；从站、功能码、起始地址与寄存器数量在设备页配置。启用多条曲线时，会自动扩大读取寄存器数量以覆盖最远偏移。")}</p>
    <div id="${prefix}CurveConfigBlock" class="chart-curve-config">
      <div class="subsection-heading compact">
        <h3 id="${prefix}CurveConfigTitle">${i18n("debugCurve.modbusTitle", "Modbus 曲线")}</h3>
        <span id="${prefix}CurveConfigHint">${i18n("debugCurve.modbusHint", "同一读响应内最多 4 条曲线，偏移 0 为数据区首字节")}</span>
      </div>
      <div class="curve-config-list">
        ${rows}
        <button id="${prefix}AddCurve" class="ghost-button add-curve-button" type="button">${i18n("curve.addCurve")}</button>
      </div>
    </div>
    ${buildParserTest(prefix, "testModbusParser", "01 03 04 00 64 00 C8 FA 33", i18n("debugCurve.rtuSampleHint", "完整 RTU 帧 HEX"))}`;
}

export function buildMessageDebugCurveSectionHtml(prefix, options = {}) {
  const rows = JSON_CURVE_SLOTS.map((_, index) =>
    buildMessageCurveRow(prefix, index, { firstCurveHasUnit: options.firstCurveHasUnit }),
  ).join("");

  return `
    <div class="config-grid compact">
      <label>${i18n("curve.curveParser")}<select id="${prefix}ParserMode"><option value="json" selected>${i18n("curve.parserJson")}</option><option value="hex">${i18n("curve.parserHex")}</option><option value="modbus">${i18n("curve.parserModbus")}</option></select></label>
    </div>
    ${buildFramingFields(prefix)}
    ${buildModbusSharedFields(prefix)}
    <div id="${prefix}CurveConfigBlock" class="chart-curve-config">
      <div class="subsection-heading compact">
        <h3 id="${prefix}CurveConfigTitle">${i18n("debugCurve.jsonTitle", "JSON 曲线")}</h3>
        <span id="${prefix}CurveConfigHint">${i18n("debugCurve.jsonHint", "支持 data.temp、metrics.0.value 这类路径")}</span>
      </div>
      <div class="curve-config-list">
        ${rows}
        <button id="${prefix}AddCurve" class="ghost-button add-curve-button" type="button">${i18n("curve.addCurve")}</button>
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
