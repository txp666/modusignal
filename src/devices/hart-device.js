import i18n from "../i18n.js";
import {
  buildHartFrame,
  encodeHartDateBytes,
  encodeHartLatin1,
  encodeHartPackedAscii,
  extractHartFrames,
  formatHartFrameStatusLines,
  formatHartDeviceSummary,
  getHartCommandLabel,
  parseCommand0Device,
  parseHartCommand1Variables,
  parseHartCommand9Variables,
  parseHartCommand33Variables,
  parseHartCommand3Variables,
  parseHartTelemetryValue,
  parseHartUniversalResponse,
  PRIMARY_MASTER,
  SECONDARY_MASTER,
} from "../hart/hart.js";
import { HART_ENGINEERING_UNITS } from "../hart/hart-unit-codes.js";

export const HART_DEVICE_ID = "hart";
export const HART_DEFAULT_BAUD_RATE = 1200;

/** HART 常用串口参数：1200 8O1 */
export const HART_TRANSPORT_DEFAULTS = {
  baudRate: HART_DEFAULT_BAUD_RATE,
  parity: "odd",
  dataBits: 8,
  stopBits: 1,
  flowControl: "none",
};

export const DEFAULT_HART_DEVICE = {
  discovered: false,
  addressManufacturer: 0,
  addressDeviceType: 0,
  manufacturer: 0,
  deviceType: 0,
  expandedDeviceType: 0,
  deviceId: 0,
  minPreambleCount: 5,
  hartRevision: 0,
  deviceRevision: 0,
  profile: 0,
  softwareVersion: 0,
  hardwareVersion: 0,
  physicalSignalType: 0,
  deviceFlag: 0,
  responsePreambleCount: null,
  lastDeviceVariableCode: null,
  configChangeCounter: null,
  extendedDeviceStatus: null,
  privateLabelDistributor: null,
};

export const DEFAULT_HART_CONFIG = {
  pollAddress: 0,
  masterType: "primary",
  commandMode: "preset",
  command: 1,
  customCommand: 1,
  pollMode: "pv",
  customCommandData: "",
  standardCommandValues: {},
  fieldName: "PV",
  unit: "",
  scale: 1,
  offset: 0,
  pollIntervalMs: 1000,
  preambleLength: 5,
  chartSeries: {
    pv: true,
    sv: true,
    tv: true,
    qv: true,
  },
  device: { ...DEFAULT_HART_DEVICE },
};

export const HART_VARIABLE_CARDS = [
  { key: "pv", label: "PV", subtitle: "Primary Variable", defaultUnit: "", color: "#0f766e" },
  { key: "sv", label: "SV", subtitle: "Secondary Variable", defaultUnit: "", color: "#2563eb" },
  { key: "tv", label: "TV", subtitle: "Tertiary Variable", defaultUnit: "", color: "#b45309" },
  { key: "qv", label: "QV", subtitle: "Quaternary Variable", defaultUnit: "", color: "#9c27b0" },
];

export const HART_DYNAMIC_VARIABLE_KEYS = ["pv", "sv", "tv", "qv"];

let rxBuffer = new Uint8Array(0);

const HART_UNIVERSAL_COMMAND_ENTRIES = [
  { value: 0, kind: "read", category: "universal" },
  { value: 1, kind: "read", category: "universal" },
  { value: 2, kind: "read", category: "universal" },
  { value: 3, kind: "read", category: "universal" },
  { value: 7, kind: "read", category: "universal" },
  { value: 8, kind: "read", category: "universal" },
  { value: 9, kind: "read", category: "universal", defaultData: [246, 247, 248, 249] },
  { value: 11, kind: "read", category: "universal" },
  { value: 12, kind: "read", category: "universal" },
  { value: 13, kind: "read", category: "universal" },
  { value: 14, kind: "read", category: "universal" },
  { value: 15, kind: "read", category: "universal" },
  { value: 16, kind: "read", category: "universal" },
  { value: 20, kind: "read", category: "universal" },
  { value: 21, kind: "read", category: "universal" },
  { value: 48, kind: "read", category: "universal" },
  { value: 33, kind: "read", category: "common", defaultData: [246, 247, 248, 249] },
  { value: 50, kind: "read", category: "common" },
  { value: 81, kind: "read", category: "common", defaultData: [0] },
  { value: 105, kind: "read", category: "common", defaultData: [0] },
  { value: 6, kind: "write", category: "universal" },
  { value: 17, kind: "write", category: "universal" },
  { value: 18, kind: "write", category: "universal" },
  { value: 19, kind: "write", category: "universal" },
  { value: 22, kind: "write", category: "universal" },
  { value: 38, kind: "write", category: "universal" },
  { value: 34, kind: "write", category: "common" },
  { value: 35, kind: "write", category: "common" },
  { value: 40, kind: "write", category: "common" },
  { value: 43, kind: "write", category: "common" },
  { value: 44, kind: "write", category: "common" },
  { value: 45, kind: "write", category: "common" },
  { value: 46, kind: "write", category: "common" },
  { value: 47, kind: "write", category: "common" },
  { value: 82, kind: "write", category: "common" },
  { value: 108, kind: "write", category: "common" },
  { value: 109, kind: "write", category: "common" },
];

export const HART_UNIVERSAL_COMMANDS = HART_UNIVERSAL_COMMAND_ENTRIES.map((entry) => ({
  ...entry,
  defaultData: entry.defaultData ? Uint8Array.from(entry.defaultData) : null,
  label: getHartCommandLabel(entry.value),
}));

export function getHartCommandDefinition(command) {
  return HART_UNIVERSAL_COMMANDS.find((entry) => entry.value === Number(command)) ?? null;
}

const field = (key, labelKey, type, options = {}) => ({
  key,
  label: i18n(labelKey),
  type,
  ...options,
});

const choice = (key, labelKey, defaultValue, options) =>
  field(key, labelKey, "select", { defaultValue: String(defaultValue), options });

const option = (value, labelKey) => ({ value: String(value), label: i18n(labelKey) });

function engineeringUnitOptions() {
  const units = new Map(
    Object.entries(HART_ENGINEERING_UNITS).map(([code, unit]) => [
      Number(code),
      { value: code, label: `${code} · ${unit.symbol || unit.description}` },
    ]),
  );
  for (let code = 170; code <= 219; code += 1) {
    units.set(code, { value: String(code), label: `${code} · ${i18n("hart.unitExpansionOption")}` });
  }
  for (let code = 240; code <= 249; code += 1) {
    units.set(code, { value: String(code), label: `${code} · ${i18n("hart.manufacturerUnitOption")}` });
  }
  return [...units.entries()].sort(([left], [right]) => left - right).map(([, entry]) => entry);
}

export function getHartStandardRequestFields(command, device = DEFAULT_HART_DEVICE) {
  const currentDate = new Date().toISOString().slice(0, 10);
  switch (Number(command)) {
    case 6:
      return [
        field("polling_address", "hart.input.pollAddress", "number", {
          min: 0,
          max: 63,
          step: 1,
          defaultValue: String(clamp(Math.trunc(toFiniteNumber(device?.pollAddress, 0)), 0, 63)),
        }),
        choice("loop_current_mode", "hart.input.loopCurrentMode", 1, [
          option(0, "hart.option.disabled"),
          option(1, "hart.option.enabled"),
        ]),
      ];
    case 9:
      return [field("device_variables", "hart.input.deviceVariables", "decimal-list", { defaultValue: "246, 247, 248, 249" })];
    case 11:
      return [field("tag", "hart.input.shortTag", "text", { maxLength: 8, defaultValue: "" })];
    case 17:
      return [field("message", "hart.input.message", "text", { maxLength: 32, defaultValue: "" })];
    case 18:
      return [
        field("tag", "hart.input.shortTag", "text", { maxLength: 8, defaultValue: "" }),
        field("descriptor", "hart.input.descriptor", "text", { maxLength: 16, defaultValue: "" }),
        field("date", "hart.input.date", "date", { defaultValue: currentDate }),
      ];
    case 19:
      return [field("final_assembly_number", "hart.input.finalAssemblyNumber", "number", { min: 0, max: 0xffffff, step: 1, defaultValue: "0" })];
    case 21:
    case 22:
      return [field("long_tag", "hart.input.longTag", "text", { maxLength: 32, defaultValue: "" })];
    case 33:
      return [field("device_variables", "hart.input.deviceVariables", "decimal-list", { defaultValue: "246, 247, 248, 249" })];
    case 34:
      return [field("damping_seconds", "hart.input.dampingSeconds", "number", { step: "any", defaultValue: "1.0" })];
    case 35:
      return [
        field("unit_code", "hart.input.unitCode", "unit-select", { options: engineeringUnitOptions(), defaultValue: "" }),
        field("upper_range", "hart.input.upperRange", "number", { step: "any", defaultValue: "" }),
        field("lower_range", "hart.input.lowerRange", "number", { step: "any", defaultValue: "" }),
      ];
    case 38:
      return [
        field("configuration_change_counter", "hart.input.configCounter", "number", {
          min: 0,
          max: 0xffff,
          step: 1,
          optional: true,
          defaultValue: Number.isFinite(device?.configChangeCounter) ? String(device.configChangeCounter) : "",
        }),
      ];
    case 40:
      return [field("fixed_current", "hart.input.fixedCurrent", "number", { step: "any", defaultValue: "0.0" })];
    case 44:
      return [field("unit_code", "hart.input.unitCode", "unit-select", { options: engineeringUnitOptions(), defaultValue: "" })];
    case 45:
      return [field("measured_current", "hart.input.measuredCurrent", "number", { step: "any", defaultValue: "4.0" })];
    case 46:
      return [field("measured_current", "hart.input.measuredCurrent", "number", { step: "any", defaultValue: "20.0" })];
    case 47:
      return [
        choice("transfer_function", "hart.input.transferFunction", 0, [
          option(0, "hart.transfer.linear"),
          option(1, "hart.transfer.sqrt"),
          option(2, "hart.transfer.sqrt3"),
          option(3, "hart.transfer.sqrt5"),
          option(4, "hart.transfer.special"),
          option(5, "hart.transfer.square"),
          option(10, "hart.transfer.equal25"),
          option(11, "hart.transfer.equal33"),
          option(12, "hart.transfer.equal50"),
          option(15, "hart.transfer.quick25"),
          option(16, "hart.transfer.quick33"),
          option(17, "hart.transfer.quick50"),
          option(230, "hart.transfer.discrete"),
        ]),
      ];
    case 81:
      return [field("device_variable", "hart.input.deviceVariable", "number", { min: 0, max: 255, step: 1, defaultValue: "0" })];
    case 82:
      return [
        field("device_variable", "hart.input.deviceVariable", "number", { min: 0, max: 255, step: 1, defaultValue: "0" }),
        choice("trim_point", "hart.input.trimPoint", 1, [option(1, "hart.option.lowPoint"), option(2, "hart.option.highPoint")]),
        field("unit_code", "hart.input.unitCode", "unit-select", { options: engineeringUnitOptions(), defaultValue: "" }),
        field("trim_value", "hart.input.trimValue", "number", { step: "any", defaultValue: "" }),
      ];
    case 105:
      return [field("burst_message", "hart.input.burstMessage", "number", { min: 0, max: 255, step: 1, defaultValue: "0" })];
    case 108:
      return [
        field("burst_command", "hart.input.burstCommand", "number", { min: 0, max: 0xffff, step: 1, defaultValue: "1" }),
        field("burst_message", "hart.input.burstMessage", "number", { min: 0, max: 255, step: 1, defaultValue: "0" }),
      ];
    case 109:
      return [
        choice("burst_control", "hart.input.burstControl", 0, [
          option(0, "hart.option.burstOff"),
          option(1, "hart.option.burstToken"),
          option(2, "hart.option.burstTdma"),
          option(3, "hart.option.burstBoth"),
          option(4, "hart.option.burstIp"),
        ]),
        field("burst_message", "hart.input.burstMessage", "number", { min: 0, max: 255, step: 1, defaultValue: "0" }),
      ];
    default:
      return [];
  }
}

export function encodeHartStandardRequestData(command, suppliedValues = {}, device = DEFAULT_HART_DEVICE) {
  const fields = getHartStandardRequestFields(command, device);
  if (fields.length === 0) return new Uint8Array(0);

  const values = Object.fromEntries(
    fields.map((entry) => [entry.key, String(suppliedValues?.[entry.key] ?? entry.defaultValue ?? "")]),
  );
  const fail = (message) => {
    throw new Error(message);
  };
  const unsigned = (key, label, minimum, maximum, optional = false) => {
    const text = values[key].trim();
    if (optional && text === "") return null;
    if (!/^\d+$/.test(text)) fail(`${label}${i18n("hart.input.mustBeDecimal")}`);
    const value = Number(text);
    if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
      fail(`${label}${i18n("hart.input.range").replace("{min}", minimum).replace("{max}", maximum)}`);
    }
    return value;
  };
  const floating = (key, label) => {
    const value = Number(values[key].trim());
    if (values[key].trim() === "" || !Number.isFinite(value) || !Number.isFinite(Math.fround(value))) {
      fail(`${label}${i18n("hart.input.mustBeNumber")}`);
    }
    return Math.fround(value);
  };
  const uintBytes = (value, length) => {
    const bytes = new Uint8Array(length);
    for (let index = length - 1, remaining = value; index >= 0; index -= 1) {
      bytes[index] = remaining & 0xff;
      remaining = Math.floor(remaining / 256);
    }
    return bytes;
  };
  const floatBytes = (value) => {
    const bytes = new Uint8Array(4);
    new DataView(bytes.buffer).setFloat32(0, value, false);
    return bytes;
  };
  const concat = (...parts) => {
    const bytes = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
    let offset = 0;
    parts.forEach((part) => {
      bytes.set(part, offset);
      offset += part.length;
    });
    return bytes;
  };
  const packedText = (key, label, characters) => {
    const text = values[key];
    if (text.length > characters) fail(`${label}${i18n("hart.input.tooLong").replace("{max}", characters)}`);
    for (const character of text.toUpperCase()) {
      const code = character.charCodeAt(0);
      if (code < 0x20 || code > 0x5f) fail(`${label}${i18n("hart.input.invalidPackedAscii")}`);
    }
    return encodeHartPackedAscii(text, characters);
  };
  const latin1Text = (key, label, characters) => {
    const text = values[key];
    if (text.length > characters) fail(`${label}${i18n("hart.input.tooLong").replace("{max}", characters)}`);
    for (const character of text) {
      if (character.charCodeAt(0) > 0xff) fail(`${label}${i18n("hart.input.invalidLatin1")}`);
    }
    const encoded = encodeHartLatin1(text, characters);
    encoded.fill(0, text.length);
    return encoded;
  };
  const decimalList = (key, label, maximumItems) => {
    const parts = values[key].trim().split(/[\s,，;；]+/).filter(Boolean);
    if (parts.length < 1 || parts.length > maximumItems) {
      fail(`${label}${i18n("hart.input.listCount").replace("{max}", maximumItems)}`);
    }
    return Uint8Array.from(parts.map((part) => unsignedValue(part, label, 0, 255)));
  };
  const unsignedValue = (text, label, minimum, maximum) => {
    if (!/^\d+$/.test(text)) fail(`${label}${i18n("hart.input.mustBeDecimal")}`);
    const value = Number(text);
    if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
      fail(`${label}${i18n("hart.input.range").replace("{min}", minimum).replace("{max}", maximum)}`);
    }
    return value;
  };

  switch (Number(command)) {
    case 6:
      return Uint8Array.from([
        unsigned("polling_address", i18n("hart.input.pollAddress"), 0, 63),
        unsigned("loop_current_mode", i18n("hart.input.loopCurrentMode"), 0, 1),
      ]);
    case 9:
      return decimalList("device_variables", i18n("hart.input.deviceVariables"), 8);
    case 11:
      return packedText("tag", i18n("hart.input.shortTag"), 8);
    case 17:
      return packedText("message", i18n("hart.input.message"), 32);
    case 18: {
      const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(values.date);
      if (!match) fail(i18n("hart.input.invalidDate"));
      const date = new Date(`${values.date}T00:00:00`);
      const expectedYear = Number(match[1]);
      const expectedMonth = Number(match[2]);
      const expectedDay = Number(match[3]);
      if (
        !Number.isFinite(date.getTime()) ||
        expectedYear < 1900 ||
        expectedYear > 2155 ||
        date.getFullYear() !== expectedYear ||
        date.getMonth() + 1 !== expectedMonth ||
        date.getDate() !== expectedDay
      ) {
        fail(i18n("hart.input.invalidDate"));
      }
      return concat(
        packedText("tag", i18n("hart.input.shortTag"), 8),
        packedText("descriptor", i18n("hart.input.descriptor"), 16),
        encodeHartDateBytes(values.date),
      );
    }
    case 19:
      return uintBytes(unsigned("final_assembly_number", i18n("hart.input.finalAssemblyNumber"), 0, 0xffffff), 3);
    case 21:
    case 22:
      return latin1Text("long_tag", i18n("hart.input.longTag"), 32);
    case 33:
      return decimalList("device_variables", i18n("hart.input.deviceVariables"), 4);
    case 34:
      return floatBytes(floating("damping_seconds", i18n("hart.input.dampingSeconds")));
    case 35:
      return concat(
        uintBytes(unsigned("unit_code", i18n("hart.input.unitCode"), 0, 255), 1),
        floatBytes(floating("upper_range", i18n("hart.input.upperRange"))),
        floatBytes(floating("lower_range", i18n("hart.input.lowerRange"))),
      );
    case 38: {
      const value = unsigned("configuration_change_counter", i18n("hart.input.configCounter"), 0, 0xffff, true);
      if (value !== null) return uintBytes(value, 2);
      return Number.isFinite(device?.configChangeCounter) ? uintBytes(device.configChangeCounter, 2) : new Uint8Array(0);
    }
    case 40:
      return floatBytes(floating("fixed_current", i18n("hart.input.fixedCurrent")));
    case 44:
      return uintBytes(unsigned("unit_code", i18n("hart.input.unitCode"), 0, 255), 1);
    case 45:
    case 46:
      return floatBytes(floating("measured_current", i18n("hart.input.measuredCurrent")));
    case 47:
      return uintBytes(unsigned("transfer_function", i18n("hart.input.transferFunction"), 0, 255), 1);
    case 81:
      return uintBytes(unsigned("device_variable", i18n("hart.input.deviceVariable"), 0, 255), 1);
    case 82:
      return concat(
        uintBytes(unsigned("device_variable", i18n("hart.input.deviceVariable"), 0, 255), 1),
        uintBytes(unsigned("trim_point", i18n("hart.input.trimPoint"), 1, 2), 1),
        uintBytes(unsigned("unit_code", i18n("hart.input.unitCode"), 0, 255), 1),
        floatBytes(floating("trim_value", i18n("hart.input.trimValue"))),
      );
    case 105:
      return uintBytes(unsigned("burst_message", i18n("hart.input.burstMessage"), 0, 255), 1);
    case 108:
      return concat(
        uintBytes(unsigned("burst_command", i18n("hart.input.burstCommand"), 0, 0xffff), 2),
        uintBytes(unsigned("burst_message", i18n("hart.input.burstMessage"), 0, 255), 1),
      );
    case 109:
      return Uint8Array.from([
        unsigned("burst_control", i18n("hart.input.burstControl"), 0, 4),
        unsigned("burst_message", i18n("hart.input.burstMessage"), 0, 255),
      ]);
    default:
      return new Uint8Array(0);
  }
}

export function getHartProfile() {
  return {
    id: HART_DEVICE_ID,
    name: i18n("hart.profile.name"),
    type: i18n("hart.profile.type"),
    image: "./images/hart.png",
    protocolStatus: "ready",
    defaultTransportId: "serial",
    modes: {
      readId: {
        label: i18n("hart.mode.deviceId"),
        unit: "",
        min: 0,
        max: 100,
        step: 0.01,
        presets: { min: 0, mid: 50, max: 100 },
      },
      readPv: {
        label: "PV",
        unit: "",
        min: 0,
        max: 100,
        step: 0.01,
        presets: { min: 0, mid: 50, max: 100 },
      },
      readLoop: {
        label: "Loop Current",
        unit: "mA",
        min: 4,
        max: 20,
        step: 0.01,
        presets: { min: 4, mid: 12, max: 20 },
      },
      readDynamic: {
        label: "PV",
        unit: "",
        min: 0,
        max: 100,
        step: 0.01,
        presets: { min: 0, mid: 50, max: 100 },
      },
    },
  };
}

export function resetHartRxBuffer() {
  rxBuffer = new Uint8Array(0);
}

export function resetHartDeviceState(config = DEFAULT_HART_CONFIG) {
  return normalizeHartConfig({
    ...config,
    device: { ...DEFAULT_HART_DEVICE },
  });
}

export function normalizeHartConfig(config = {}) {
  const merged = {
    ...DEFAULT_HART_CONFIG,
    ...config,
    device: {
      ...DEFAULT_HART_DEVICE,
      ...(config.device ?? {}),
    },
  };

  return {
    pollAddress: clamp(Math.trunc(toFiniteNumber(merged.pollAddress, DEFAULT_HART_CONFIG.pollAddress)), 0, 63),
    masterType: merged.masterType === "secondary" ? "secondary" : "primary",
    commandMode: merged.commandMode === "custom" ? "custom" : "preset",
    command: normalizeCommand(merged.command),
    customCommand: clamp(Math.trunc(toFiniteNumber(merged.customCommand, merged.command)), 0, 0xffff),
    customCommandData: String(merged.customCommandData ?? ""),
    standardCommandValues: normalizeHartStandardCommandValues(merged.standardCommandValues),
    fieldName: String(merged.fieldName || DEFAULT_HART_CONFIG.fieldName),
    unit: String(merged.unit ?? ""),
    scale: toFiniteNumber(merged.scale, DEFAULT_HART_CONFIG.scale),
    offset: toFiniteNumber(merged.offset, DEFAULT_HART_CONFIG.offset),
    pollIntervalMs: Math.max(0, Math.trunc(toFiniteNumber(merged.pollIntervalMs, DEFAULT_HART_CONFIG.pollIntervalMs))),
    pollMode: merged.pollMode === "dynamic" ? "dynamic" : "pv",
    preambleLength: normalizePreambleLength(merged.preambleLength),
    chartSeries: normalizeChartSeries(merged.chartSeries),
    device: normalizeHartDevice(merged.device),
    activeCommand:
      merged.commandMode === "custom"
        ? clamp(Math.trunc(toFiniteNumber(merged.customCommand, merged.command)), 0, 0xffff)
        : normalizeCommand(merged.command),
  };
}

export function getHartActiveCommand(config = DEFAULT_HART_CONFIG) {
  return normalizeHartConfig(config).activeCommand;
}

export function formatHartCommandPreview(bytes, bytesToHex) {
  if (!bytes?.length) {
    return "";
  }

  const checksum = bytes[bytes.length - 1];
  return `${bytesToHex(bytes)} · 校验 0x${checksum.toString(16).toUpperCase().padStart(2, "0")}`;
}

export function createHartProfile() {
  return getHartProfile();
}

export function getHartMode(command) {
  if (command === 0) {
    return "readId";
  }

  if (command === 2) {
    return "readLoop";
  }

  if (command === 3) {
    return "readDynamic";
  }

  if (command === 9 || command === 33) {
    return "readDynamic";
  }

  return "readPv";
}

export function createHartSearchCommand(config, helpers) {
  const normalized = normalizeHartConfig(config);
  const bytes = buildHartFrame({
    command: 0,
    pollAddress: normalized.pollAddress,
    masterType: normalized.masterType === "secondary" ? SECONDARY_MASTER : PRIMARY_MASTER,
    preambleLength: normalized.preambleLength,
    device: normalized.device,
  });

  return {
    supported: true,
    preview: formatHartCommandPreview(bytes, helpers.bytesToHex),
    bytes,
    checksum: bytes[bytes.length - 1],
  };
}

export function createHartPollCommand(config, helpers) {
  const normalized = normalizeHartConfig(config);
  const command = normalized.pollMode === "dynamic" ? 3 : 1;
  return createHartCommandBytes(normalized, command, helpers);
}

export function createHartSetOutputCommand(state, config, helpers) {
  const normalized = normalizeHartConfig(config);
  return createHartCommandBytes(normalized, normalized.activeCommand, helpers);
}

function createHartCommandBytes(normalized, command, helpers) {
  if (command !== 0 && !normalized.device.discovered) {
    return {
      supported: false,
      preview: i18n("hart.searchFirst"),
      bytes: null,
    };
  }

  let commandData = new Uint8Array(0);
  if (normalized.commandMode === "custom" && normalized.customCommandData.trim()) {
    try {
      commandData = helpers.parseHexPayload(normalized.customCommandData);
    } catch (error) {
      return {
        supported: false,
        preview: error.message,
        bytes: null,
      };
    }
  }

  const definition = getHartCommandDefinition(command);
  if (normalized.commandMode === "preset") {
    try {
      commandData = encodeHartStandardRequestData(
      command,
      normalized.standardCommandValues[String(command)] ?? {},
        { ...normalized.device, pollAddress: normalized.pollAddress },
      );
    } catch (error) {
      return { supported: false, preview: error.message, bytes: null };
    }
    if (commandData.length === 0 && definition?.defaultData && getHartStandardRequestFields(command).length === 0) {
      commandData = definition.defaultData;
    }
  }
  if (command === 38 && commandData.length === 0 && Number.isFinite(normalized.device.configChangeCounter)) {
    const counter = normalized.device.configChangeCounter;
    commandData = Uint8Array.from([(counter >> 8) & 0xff, counter & 0xff]);
  }

  const validationError = validateHartCommandData(command, commandData);
  if (validationError) {
    return {
      supported: false,
      preview: validationError,
      bytes: null,
    };
  }

  let bytes;
  try {
    bytes = buildHartFrame({
      command,
      pollAddress: normalized.pollAddress,
      masterType: normalized.masterType === "secondary" ? SECONDARY_MASTER : PRIMARY_MASTER,
      preambleLength: normalized.preambleLength,
      device: normalized.device,
      commandData,
    });
  } catch (error) {
    return { supported: false, preview: error.message, bytes: null };
  }

  return {
    supported: true,
    preview: formatHartCommandPreview(bytes, helpers.bytesToHex),
    bytes,
    checksum: bytes[bytes.length - 1],
    command,
    commandData,
    kind: definition?.kind ?? "custom",
    requiresConfirmation: definition?.kind === "write" || (!definition && commandData.length > 0),
  };
}

export function validateHartCommandData(command, data = new Uint8Array(0)) {
  const length = data?.length ?? 0;
  const exact = (expected) =>
    length === expected ? null : `${getHartCommandLabel(command)}：请求数据必须为 ${expected} 字节（当前 ${length} 字节）`;
  const range = (minimum, maximum, description) =>
    length >= minimum && length <= maximum
      ? null
      : `${getHartCommandLabel(command)}：请求数据${description}（当前 ${length} 字节）`;

  if ([0, 1, 2, 3, 7, 8, 12, 13, 14, 15, 16, 20, 43, 50].includes(command)) return exact(0);
  if (command === 6) return [1, 2].includes(length) ? null : `${getHartCommandLabel(command)}：请求数据必须为 1 或 2 字节`;
  if (command === 9) return range(1, 8, "必须包含 1–8 个设备变量码");
  if (command === 11) return exact(6);
  if (command === 17) return exact(24);
  if (command === 18) return exact(21);
  if (command === 19) return exact(3);
  if (command === 21 || command === 22) return exact(32);
  if (command === 33) return range(1, 4, "必须包含 1–4 个设备变量码");
  if ([34, 40, 45, 46].includes(command)) return exact(4);
  if (command === 35) return exact(9);
  if (command === 38) return [0, 2].includes(length) ? null : `${getHartCommandLabel(command)}：请求数据必须为空或为 2 字节计数器`;
  if ([44, 47, 81].includes(command)) return exact(1);
  if (command === 48) return length === 0 || (length >= 9 && length <= 25) ? null : `${getHartCommandLabel(command)}：请求数据必须为空或为 9–25 字节状态镜像`;
  if (command === 82) return exact(7);
  if (command === 105) return [0, 1].includes(length) ? null : `${getHartCommandLabel(command)}：请求数据必须为空或为 1 字节消息号`;
  if (command === 108) return [1, 3].includes(length) ? null : `${getHartCommandLabel(command)}：请求数据必须为 1 或 3 字节`;
  if (command === 109) return [1, 2].includes(length) ? null : `${getHartCommandLabel(command)}：请求数据必须为 1 或 2 字节`;
  return length <= 0xff ? null : `${getHartCommandLabel(command)}：请求数据不能超过 255 字节`;
}

export function parseHartTelemetry(bytes, config) {
  if (!bytes || bytes.length === 0) {
    return null;
  }

  const normalized = normalizeHartConfig(config);
  rxBuffer = concatBytes(rxBuffer, bytes);
  const { frames, remaining } = extractHartFrames(rxBuffer);
  rxBuffer = remaining;

  for (const parsed of frames) {
    if (parsed.command === 0) {
      const device = parseCommand0Device(parsed);
      if (device) {
        return {
          fieldName: i18n("hart.mode.deviceId"),
          unit: "",
          value: device.deviceId,
          rawValue: device.deviceId,
          device,
          pollAddress: parsed.pollAddress,
          isDiscovery: true,
        };
      }
      continue;
    }

    if (!matchesHartResponseAddress(parsed, normalized)) {
      continue;
    }

    if (parsed.command === normalized.activeCommand) {
      const universal = parseHartUniversalResponse(parsed);
      if (universal) {
        return buildHartUniversalTelemetry(normalized, universal, parsed);
      }

      const telemetry = parseHartTelemetryValue(parsed, normalized.activeCommand);
      if (!telemetry) {
        continue;
      }

      return attachHartFrameStatus(
        {
          fieldName: normalized.fieldName || telemetry.fieldName,
          unit: normalized.unit || telemetry.unit,
          value: telemetry.value * normalized.scale + normalized.offset,
          rawValue: telemetry.rawValue,
          extra: telemetry.extra,
        },
        parsed,
      );
    }

    const multi = parseHartMultiVariables(parsed, normalized);
    if (multi) {
      return attachHartFrameStatus(multi, parsed);
    }
  }

  return null;
}

function buildHartUniversalTelemetry(config, universal, parsed) {
  const commandLines = [...(universal.lines ?? [])];

  const payload = {
    commandSummary: universal.summary,
    commandLines,
    commandLabel: universal.commandLabel,
    command: universal.command,
    fields: universal.fields ?? null,
    isError: Boolean(universal.isError),
    fieldName: universal.commandLabel,
    unit: "",
    value: universal.variables?.pv?.value ?? null,
    rawValue: universal.variables?.pv?.value ?? null,
  };

  if (universal.variables && Object.keys(universal.variables).some((key) => universal.variables[key])) {
    const variables = {};
    for (const [key, entry] of Object.entries(universal.variables)) {
      if (!entry || !Number.isFinite(entry.value)) {
        continue;
      }

      variables[key] = {
        value: key === "pv" ? entry.value * config.scale + config.offset : entry.value,
        unit: key === "pv" ? config.unit || entry.unit || "" : entry.unit || "",
      };
    }

    if (Object.keys(variables).length > 0) {
      const primary = variables.pv ?? Object.values(variables)[0];
      return attachHartFrameStatus(
        {
          isMulti: true,
          variables,
          ...payload,
          unit: primary.unit,
          value: primary.value,
          rawValue: primary.value,
        },
        parsed,
      );
    }
  }

  if (Number.isFinite(payload.value)) {
    return attachHartFrameStatus(
      {
        ...payload,
        unit: universal.variables?.pv?.unit ?? "",
        value: payload.value * config.scale + config.offset,
      },
      parsed,
    );
  }

  return attachHartFrameStatus(
    {
      ...payload,
      isCommandResult: true,
    },
    parsed,
  );
}

function attachHartFrameStatus(telemetry, parsed) {
  if (!telemetry) {
    return telemetry;
  }

  const statusLines = formatHartFrameStatusLines(parsed);
  const commandLines = statusLines.length
    ? [...(telemetry.commandLines ?? []), ...statusLines]
    : telemetry.commandLines;

  return {
    ...telemetry,
    commandLines,
    hartResponseCode: parsed.responseCode,
    hartDeviceStatus: parsed.status,
  };
}

function parseHartMultiVariables(parsed, config) {
  if (parsed.command === 1 && parsed.byteCount >= 5) {
    const variables = parseHartCommand1Variables(parsed.data);
    if (!variables?.pv) {
      return null;
    }

    return buildHartMultiTelemetry(config, {
      pv: applyHartVariableScale(variables.pv, config),
    });
  }

  if (parsed.command === 3 && parsed.byteCount >= 24) {
    const variables = parseHartCommand3Variables(parsed.data);
    if (!variables) {
      return null;
    }

    return buildHartMultiTelemetry(config, {
      pv: applyHartVariableScale(variables.pv, config),
      sv: variables.sv,
      tv: variables.tv,
      qv: variables.qv,
    });
  }

  if (parsed.command === 9) {
    const variables = parseHartCommand9Variables(parsed.data);
    if (!variables) {
      return null;
    }

    return buildHartMultiTelemetry(
      config,
      Object.fromEntries(
        Object.entries(variables.variables).map(([key, entry]) => [
          key,
          key === "pv" ? applyHartVariableScale(entry, config) : entry,
        ]),
      ),
    );
  }

  if (parsed.command === 33) {
    const variables = parseHartCommand33Variables(parsed.data);
    if (!variables) {
      return null;
    }

    return buildHartMultiTelemetry(
      config,
      Object.fromEntries(
        Object.entries(variables.variables).map(([key, entry]) => [
          key,
          key === "pv" ? applyHartVariableScale(entry, config) : entry,
        ]),
      ),
    );
  }

  return null;
}

function buildHartMultiTelemetry(config, variables) {
  const normalized = {};
  for (const key of HART_DYNAMIC_VARIABLE_KEYS) {
    const entry = variables[key];
    if (!entry || !Number.isFinite(entry.value)) {
      continue;
    }

    normalized[key] = {
      value: entry.value,
      unit: entry.unit || "",
    };
  }

  if (Object.keys(normalized).length === 0) {
    return null;
  }

  const primary = normalized.pv ?? Object.values(normalized)[0];
  const commandLines = HART_DYNAMIC_VARIABLE_KEYS.filter((key) => normalized[key]).map(
    (key) => `${key.toUpperCase()} ${normalized[key].value.toFixed(3)}${normalized[key].unit ? ` ${normalized[key].unit}` : ""}`,
  );
  return {
    isMulti: true,
    variables: normalized,
    fieldName: "PV",
    unit: primary.unit,
    value: primary.value,
    rawValue: primary.value,
    commandSummary: commandLines.join(" · "),
    commandLines,
  };
}

function applyHartVariableScale(entry, config) {
  if (!entry) {
    return null;
  }

  return {
    value: entry.value * config.scale + config.offset,
    unit: config.unit || entry.unit || "",
  };
}

function matchesHartResponseAddress(parsed, config) {
  if (parsed.addressLength !== 1 || parsed.pollAddress === null) {
    return true;
  }

  return parsed.pollAddress === (config.pollAddress & 0x3f);
}

export function describeHartSummary(config) {
  const normalized = normalizeHartConfig(config);
  const deviceSummary = formatHartDeviceSummary(normalized.device);
  const pollLabel =
    normalized.pollMode === "dynamic" ? i18n("hart.pollDynamic") : i18n("hart.pollPv");
  return `${i18n("hart.pollAddress")} ${normalized.pollAddress} · ${pollLabel} · ${normalized.pollIntervalMs} ms · ${deviceSummary}`;
}

export function mergeHartDiscovery(config, discovery) {
  if (!discovery?.device) {
    return normalizeHartConfig(config);
  }

  return normalizeHartConfig({
    ...config,
    pollAddress: discovery.pollAddress ?? config.pollAddress,
    device: {
      ...config.device,
      ...discovery.device,
    },
  });
}

function normalizeHartDevice(device = {}) {
  return {
    discovered: Boolean(device.discovered),
    addressManufacturer: clamp(Math.trunc(toFiniteNumber(device.addressManufacturer, device.manufacturer ?? 0)), 0, 255),
    addressDeviceType: clamp(Math.trunc(toFiniteNumber(device.addressDeviceType, device.deviceType ?? 0)), 0, 255),
    manufacturer: clamp(Math.trunc(toFiniteNumber(device.manufacturer, 0)), 0, 65535),
    deviceType: clamp(Math.trunc(toFiniteNumber(device.deviceType, 0)), 0, 65535),
    expandedDeviceType: clamp(Math.trunc(toFiniteNumber(device.expandedDeviceType, device.deviceType ?? 0)), 0, 65535),
    deviceId: clamp(Math.trunc(toFiniteNumber(device.deviceId, 0)), 0, 0xffffff),
    minPreambleCount: clamp(Math.trunc(toFiniteNumber(device.minPreambleCount, 5)), 2, 20),
    hartRevision: clamp(Math.trunc(toFiniteNumber(device.hartRevision, 0)), 0, 255),
    deviceRevision: clamp(Math.trunc(toFiniteNumber(device.deviceRevision, device.profile ?? 0)), 0, 255),
    profile: clamp(Math.trunc(toFiniteNumber(device.profile, 0)), 0, 255),
    softwareVersion: clamp(Math.trunc(toFiniteNumber(device.softwareVersion, 0)), 0, 255),
    hardwareVersion: clamp(Math.trunc(toFiniteNumber(device.hardwareVersion, 0)), 0, 255),
    physicalSignalType: clamp(Math.trunc(toFiniteNumber(device.physicalSignalType, 0)), 0, 255),
    deviceFlag: clamp(Math.trunc(toFiniteNumber(device.deviceFlag, 0)), 0, 255),
    responsePreambleCount: nullableByte(device.responsePreambleCount),
    lastDeviceVariableCode: nullableByte(device.lastDeviceVariableCode),
    configChangeCounter: nullableWord(device.configChangeCounter),
    extendedDeviceStatus: nullableByte(device.extendedDeviceStatus),
    privateLabelDistributor: nullableWord(device.privateLabelDistributor),
  };
}

function nullableByte(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  return clamp(Math.trunc(toFiniteNumber(value, 0)), 0, 255);
}

function nullableWord(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  return clamp(Math.trunc(toFiniteNumber(value, 0)), 0, 65535);
}

function normalizeCommand(value) {
  const command = Math.trunc(Number(value));
  if (command >= 0 && command <= 0xffff) {
    return command;
  }

  return DEFAULT_HART_CONFIG.command;
}

function normalizePreambleLength(value) {
  const presets = [5, 8, 10, 15, 20];
  const length = Math.trunc(toFiniteNumber(value, DEFAULT_HART_CONFIG.preambleLength));
  return presets.includes(length) ? length : DEFAULT_HART_CONFIG.preambleLength;
}

function normalizeChartSeries(value = {}) {
  const hasLegacyCurrent = value.current !== undefined && value.qv === undefined;
  return {
    pv: value.pv !== false,
    sv: value.sv !== false,
    tv: value.tv !== false,
    qv: hasLegacyCurrent ? value.current !== false : value.qv !== false,
  };
}

function normalizeHartStandardCommandValues(value = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const normalized = {};
  Object.entries(value).forEach(([command, fields]) => {
    if (!fields || typeof fields !== "object" || Array.isArray(fields)) return;
    normalized[String(command)] = Object.fromEntries(
      Object.entries(fields).map(([key, fieldValue]) => [String(key), String(fieldValue ?? "")]),
    );
  });
  return normalized;
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
