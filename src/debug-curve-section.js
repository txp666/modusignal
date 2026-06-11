import { HEX_CURVE_SLOT_SPECS, MODBUS_CURVE_SLOT_SPECS } from "./devices/binary-curve-config.js";
import { JSON_CURVE_SLOTS } from "./devices/json-curve-config.js";

const CURVE_NUMBERS = ["一", "二", "三", "四"];

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
  const offsetLabel = mode === "modbus" ? "数据偏移" : "字节偏移";
  const offsetTitle = mode === "modbus" ? ' title="相对读响应数据区首字节的偏移"' : "";

  return `
    <div class="curve-mode-fields" data-parser-mode="${mode}"${hiddenAttr}>
      <label>${offsetLabel}<input id="${byteOffsetId}" type="number" min="0" step="1" value="${spec.defaultOffset}"${offsetTitle} /></label>
      <label>数据类型${buildSelect(dataTypeId, DATA_TYPE_OPTIONS, "uint16")}</label>
      <label>字节序${buildSelect(byteOrderId, BYTE_ORDER_OPTIONS, "AB")}</label>
      <label>比例<input id="${scaleId}" type="number" step="0.000001" value="1" /></label>
      <label>偏移<input id="${offsetId}" type="number" step="0.000001" value="0" /></label>
    </div>`;
}

function buildJsonPathFields(prefix, slotKey, hidden = false) {
  const suffix = SLOT_DOM_SUFFIX[slotKey];
  const hiddenAttr = hidden ? " hidden" : "";
  const slotNumber = CURVE_NUMBERS[JSON_CURVE_SLOTS.findIndex((slot) => slot.key === slotKey)];
  const pathId = domId(prefix, suffix.path);
  return `
    <div class="curve-mode-fields" data-parser-mode="json"${hiddenAttr}>
      <label>曲线${slotNumber}路径<input id="${pathId}" type="text" value="${slotKey === "curve1" ? "value" : ""}" placeholder="例如 value 或 data.temp" /></label>
    </div>`;
}

function buildCurveToggle(prefix, slotKey, slotIndex, checked = false) {
  const suffix = SLOT_DOM_SUFFIX[slotKey];
  const slotNumber = CURVE_NUMBERS[slotIndex];
  const enabledId = domId(prefix, suffix.enabled);
  const checkedAttr = checked ? " checked" : "";

  if (slotIndex === 0) {
    return `<label class="curve-toggle">启用曲线${slotNumber}<input id="${enabledId}" type="checkbox"${checkedAttr} /></label>`;
  }

  return `
    <div class="curve-row-actions">
      <label class="curve-toggle">启用曲线${slotNumber}<input id="${enabledId}" type="checkbox" /></label>
      <button type="button" class="ghost-button curve-remove-button" data-remove-curve-slot="${slotIndex + 1}" aria-label="删除曲线${slotNumber}">删除</button>
    </div>`;
}

function buildCurveNameField(prefix, slotKey, slotIndex, defaultName) {
  const suffix = SLOT_DOM_SUFFIX[slotKey];
  const slotNumber = CURVE_NUMBERS[slotIndex];
  const nameId = domId(prefix, suffix.fieldName);
  const value = defaultName ?? (slotIndex === 0 ? "数值" : `曲线${slotNumber}`);
  return `<label>曲线${slotNumber}名称<input id="${nameId}" type="text" value="${value}" /></label>`;
}

function buildUnitField(prefix, slotKey) {
  const suffix = SLOT_DOM_SUFFIX[slotKey];
  const unitId = domId(prefix, suffix.unit);
  return `<label>单位<input id="${unitId}" type="text" placeholder="可选" /></label>`;
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
      ${buildCurveNameField(prefix, slotKey, slotIndex, slotIndex === 0 ? "寄存器值" : undefined)}
      ${buildUnitField(prefix, slotKey)}
      <label>数据偏移<input id="${byteOffsetId}" type="number" min="0" step="1" value="${spec.defaultOffset}" title="相对读响应数据区首字节的偏移" /></label>
      <label>数据类型${buildSelect(dataTypeId, DATA_TYPE_OPTIONS, "uint16")}</label>
      <label>字节序${buildSelect(byteOrderId, BYTE_ORDER_OPTIONS, "AB")}</label>
      <label>比例<input id="${scaleId}" type="number" step="0.000001" value="1" /></label>
      <label>偏移<input id="${offsetId}" type="number" step="0.000001" value="0" /></label>
    </div>`;
}

function buildParserTest(prefix, testParserId, sampleValue, samplePlaceholder) {
  return `
    <div class="parser-test">
      <label>解析样例<input id="${prefix}ParserSample" type="text" value="${sampleValue.replace(/"/g, "&quot;")}" placeholder="${samplePlaceholder.replace(/"/g, "&quot;")}" /></label>
      <button id="${testParserId}" type="button">测试</button>
      <output id="${prefix}ParserPreview">等待测试</output>
    </div>`;
}

function buildFramingFields(prefix) {
  return `
    <div id="${prefix}FramingFields" class="config-grid compact framing-fields">
      <label>帧界模式<select id="${prefix}FrameMode"><option value="none" selected>无（整包）</option><option value="line">行界（CR/LF）</option><option value="stxEtx">帧头帧尾（HEX）</option></select></label>
      <label id="${prefix}RxLineEndingField" hidden>行结束符<select id="${prefix}RxLineEnding"><option value="\\r\\n" selected>CRLF</option><option value="\\n">LF</option><option value="\\r">CR</option></select></label>
      <label id="${prefix}FramePrefixField" hidden>帧头 HEX<input id="${prefix}FramePrefixHex" type="text" placeholder="例如 02（STX）" /></label>
      <label id="${prefix}FrameSuffixField" hidden>帧尾 HEX<input id="${prefix}FrameSuffixHex" type="text" placeholder="例如 03（ETX）" /></label>
      <label id="${prefix}FrameCrcField">CRC 校验<select id="${prefix}FrameCrcMode"><option value="none" selected>无</option><option value="modbus">Modbus CRC16</option></select></label>
    </div>`;
}

function buildModbusSharedFields(prefix) {
  return `
    <div id="${prefix}ModbusSharedFields" class="config-grid compact" data-parser-mode="modbus" hidden>
      <label>从站地址<input id="${prefix}ModbusSlaveId" type="number" min="1" max="247" step="1" value="1" /></label>
      <label>功能码<select id="${prefix}ModbusFunctionCode"><option value="3" selected>03 读保持寄存器</option><option value="4">04 读输入寄存器</option></select></label>
    </div>`;
}

export function buildModbusCurveSectionHtml(prefix = "modbus") {
  const rows = JSON_CURVE_SLOTS.map((_, index) => buildModbusOnlyCurveRow(prefix, index)).join("");
  return `
    <p class="chart-curve-section-note">读模式下从 RTU 回包<strong>数据区</strong>按字节偏移解码；从站、功能码、起始地址与寄存器数量在设备页配置。启用多条曲线时，会自动扩大读取寄存器数量以覆盖最远偏移。</p>
    <div id="${prefix}CurveConfigBlock" class="chart-curve-config">
      <div class="subsection-heading compact">
        <h3 id="${prefix}CurveConfigTitle">Modbus 曲线</h3>
        <span id="${prefix}CurveConfigHint">同一读响应内最多 4 条曲线，偏移 0 为数据区首字节</span>
      </div>
      <div class="curve-config-list">
        ${rows}
        <button id="${prefix}AddCurve" class="ghost-button add-curve-button" type="button">+ 添加曲线</button>
      </div>
    </div>
    ${buildParserTest(prefix, "testModbusParser", "01 03 04 00 64 00 C8 FA 33", "完整 RTU 帧 HEX")}`;
}

export function buildMessageDebugCurveSectionHtml(prefix, options = {}) {
  const rows = JSON_CURVE_SLOTS.map((_, index) =>
    buildMessageCurveRow(prefix, index, { firstCurveHasUnit: options.firstCurveHasUnit }),
  ).join("");

  return `
    <div class="config-grid compact">
      <label>曲线解析<select id="${prefix}ParserMode"><option value="json" selected>JSON / 文本</option><option value="hex">HEX 原始字节</option><option value="modbus">Modbus RTU</option></select></label>
    </div>
    ${buildFramingFields(prefix)}
    ${buildModbusSharedFields(prefix)}
    <div id="${prefix}CurveConfigBlock" class="chart-curve-config">
      <div class="subsection-heading compact">
        <h3 id="${prefix}CurveConfigTitle">JSON 曲线</h3>
        <span id="${prefix}CurveConfigHint">支持 data.temp、metrics.0.value 这类路径</span>
      </div>
      <div class="curve-config-list">
        ${rows}
        <button id="${prefix}AddCurve" class="ghost-button add-curve-button" type="button">+ 添加曲线</button>
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
