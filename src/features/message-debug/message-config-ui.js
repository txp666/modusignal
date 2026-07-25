import i18n from "../../i18n.js";
import {
  listBinaryCurveControlElements,
  populateBinaryCurveFormValues,
  populateFramingFormValues,
  readBinaryCurveFormValues,
  readFramingFormValues,
  syncDebugCurveModeFields,
} from "../../debug-curve-form.js";

const BASE_FIELDS = [
  ["PollIntervalMs", "pollIntervalMs"],
  ["HeartbeatFormat", "heartbeatFormat"],
  ["HeartbeatMessage", "heartbeatMessage"],
  ["ParserMode", "parserMode"],
  ["Curve1Enabled", "curve1Enabled", true],
  ["ParserFieldPath", "parserFieldPath"],
  ["Curve2Enabled", "curve2Enabled", true],
  ["Curve2FieldName", "curve2FieldName"],
  ["Curve2FieldPath", "curve2FieldPath"],
  ["Curve2Unit", "curve2Unit"],
  ["Curve3Enabled", "curve3Enabled", true],
  ["Curve3FieldName", "curve3FieldName"],
  ["Curve3FieldPath", "curve3FieldPath"],
  ["Curve3Unit", "curve3Unit"],
  ["Curve4Enabled", "curve4Enabled", true],
  ["Curve4FieldName", "curve4FieldName"],
  ["Curve4FieldPath", "curve4FieldPath"],
  ["Curve4Unit", "curve4Unit"],
  ["FieldName", "fieldName"],
  ["Unit", "unit"],
];

const MQTT_FIELDS = [
  ["PublishTopic", "publishTopic"],
  ["PublishQos", "publishQos"],
  ["PublishRetain", "publishRetain", true],
];

export function loadMessageConfig(storageKey, defaults, normalize) {
  try {
    const saved = localStorage.getItem(storageKey);
    return normalize(saved ? JSON.parse(saved) : defaults);
  } catch {
    return normalize(defaults);
  }
}

export function createMessageConfigUi(options) {
  const {
    prefix,
    deviceLabelKey,
    storageKey,
    defaults,
    normalize,
    elements,
    state,
    getConfig,
    setConfig,
    syncCurveRows,
    syncChartPanel,
    updateDebugger,
    updateDeviceUi,
    canCurrentDevicePoll,
    updateActivePolling,
    appendLog,
  } = options;
  const fields = prefix === "mqtt" ? [...BASE_FIELDS, ...MQTT_FIELDS] : BASE_FIELDS;

  function getElement(suffix) {
    return elements[`${prefix}${suffix}`];
  }

  function updateParserUi(config = getConfig()) {
    const normalized = normalize(config);
    syncDebugCurveModeFields(prefix, normalized.parserMode, elements, normalized);
    syncChartPanel();
  }

  function populate(config = getConfig()) {
    const normalized = normalize(config);
    fields.forEach(([suffix, key, checked]) => {
      const element = getElement(suffix);
      if (!element) return;
      if (checked) element.checked = Boolean(normalized[key]);
      else element.value = String(normalized[key] ?? "");
    });
    populateBinaryCurveFormValues(prefix, normalized, elements);
    populateFramingFormValues(prefix, normalized, elements);
    updateParserUi(normalized);
    syncCurveRows(prefix, normalized);
    updateDebugger();
  }

  function read() {
    const values = Object.fromEntries(fields.map(([suffix, key, checked]) => {
      const element = getElement(suffix);
      return [key, checked ? element?.checked : element?.value];
    }));
    return normalize({
      ...values,
      ...readBinaryCurveFormValues(prefix, elements),
      ...readFramingFormValues(prefix, elements),
    });
  }

  function getControls() {
    return [
      ...fields.map(([suffix]) => getElement(suffix)),
      ...listBinaryCurveControlElements(prefix, elements),
      elements[`${prefix}FrameMode`],
      elements[`${prefix}RxLineEnding`],
      elements[`${prefix}FramePrefixHex`],
      elements[`${prefix}FrameSuffixHex`],
      elements[`${prefix}FrameCrcMode`],
    ];
  }

  function updateDraft() {
    const config = read();
    setConfig(config);
    updateParserUi(config);
    updateDeviceUi();
    if (state.pollingActive && !canCurrentDevicePoll()) {
      state.pollingActive = false;
    }
    updateActivePolling();
  }

  function save() {
    const config = read();
    setConfig(config);
    localStorage.setItem(storageKey, JSON.stringify(config));
    populate(config);
    updateDeviceUi();
    updateActivePolling();
    appendLog("info", i18n("log.device"), `${i18n(deviceLabelKey)}${i18n("common.configSavedShort")}`);
  }

  function reset() {
    const config = normalize(defaults);
    setConfig(config);
    localStorage.setItem(storageKey, JSON.stringify(config));
    populate(config);
    updateDeviceUi();
    updateActivePolling();
    appendLog("info", i18n("log.device"), `${i18n(deviceLabelKey)}${i18n("common.configResetShort")}`);
  }

  return { getControls, populate, read, reset, save, updateDraft, updateParserUi };
}
