import i18n from "../i18n.js";
import {
  RX_ADDR_SHORT,
  buildHartFrame,
  extractHartFrames,
  formatHartDeviceSummary,
  getHartCommandLabel,
  parseCommand0Device,
  parseHartCommand1Variables,
  parseHartCommand3Variables,
  parseHartTelemetryValue,
  parseHartUniversalResponse,
  PRIMARY_MASTER,
  SECONDARY_MASTER,
} from "../hart/hart.js";

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
  manufacturer: 0,
  deviceType: 0,
  deviceId: 0,
  minPreambleCount: 5,
  hartRevision: 0,
  profile: 0,
  softwareVersion: 0,
  hardwareVersion: 0,
  physicalSignalType: 0,
  deviceFlag: 0,
};

export const DEFAULT_HART_CONFIG = {
  pollAddress: 0,
  masterType: "primary",
  commandMode: "preset",
  command: 1,
  customCommand: 1,
  pollMode: "pv",
  customCommandData: "",
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
  { value: 0, kind: "read" },
  { value: 1, kind: "read" },
  { value: 2, kind: "read" },
  { value: 3, kind: "read" },
  { value: 6, kind: "read" },
  { value: 7, kind: "read" },
  { value: 8, kind: "read" },
  { value: 9, kind: "read" },
  { value: 11, kind: "read" },
  { value: 12, kind: "read" },
  { value: 13, kind: "read" },
  { value: 14, kind: "read" },
  { value: 15, kind: "read" },
  { value: 16, kind: "read" },
  { value: 20, kind: "read" },
  { value: 48, kind: "read" },
  { value: 17, kind: "write" },
  { value: 18, kind: "write" },
  { value: 22, kind: "write" },
  { value: 34, kind: "write" },
  { value: 35, kind: "write" },
  { value: 41, kind: "write" },
  { value: 44, kind: "write" },
  { value: 45, kind: "write" },
];

export const HART_UNIVERSAL_COMMANDS = HART_UNIVERSAL_COMMAND_ENTRIES.map((entry) => ({
  ...entry,
  label: getHartCommandLabel(entry.value),
}));

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
    pollAddress: clamp(Math.trunc(toFiniteNumber(merged.pollAddress, DEFAULT_HART_CONFIG.pollAddress)), 0, 15),
    masterType: merged.masterType === "secondary" ? "secondary" : "primary",
    commandMode: merged.commandMode === "custom" ? "custom" : "preset",
    command: normalizeCommand(merged.command),
    customCommand: clamp(Math.trunc(toFiniteNumber(merged.customCommand, merged.command)), 0, 255),
    customCommandData: String(merged.customCommandData ?? ""),
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
        ? clamp(Math.trunc(toFiniteNumber(merged.customCommand, merged.command)), 0, 255)
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
  if (normalized.customCommandData.trim()) {
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

  const bytes = buildHartFrame({
    command,
    pollAddress: normalized.pollAddress,
    masterType: normalized.masterType === "secondary" ? SECONDARY_MASTER : PRIMARY_MASTER,
    preambleLength: normalized.preambleLength,
    device: normalized.device,
    commandData,
  });

  return {
    supported: true,
    preview: formatHartCommandPreview(bytes, helpers.bytesToHex),
    bytes,
    checksum: bytes[bytes.length - 1],
  };
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
          isDiscovery: true,
        };
      }
      continue;
    }

    if (!matchesHartResponseAddress(parsed, normalized)) {
      continue;
    }

    const multi = parseHartMultiVariables(parsed, normalized);
    if (multi) {
      return attachHartFrameStatus(multi, parsed);
    }

    if (parsed.command !== normalized.activeCommand) {
      continue;
    }

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

  return null;
}

function buildHartUniversalTelemetry(config, universal, parsed) {
  const payload = {
    commandSummary: universal.summary,
    commandLines: universal.lines,
    commandLabel: universal.commandLabel,
    command: universal.command,
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

  return {
    ...telemetry,
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
  if (parsed.delimiter !== RX_ADDR_SHORT || parsed.pollAddress === null) {
    return true;
  }

  return parsed.pollAddress === (config.pollAddress & 0x0f);
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
    device: {
      ...config.device,
      ...discovery.device,
    },
  });
}

function normalizeHartDevice(device = {}) {
  return {
    discovered: Boolean(device.discovered),
    manufacturer: clamp(Math.trunc(toFiniteNumber(device.manufacturer, 0)), 0, 65535),
    deviceType: clamp(Math.trunc(toFiniteNumber(device.deviceType, 0)), 0, 65535),
    deviceId: clamp(Math.trunc(toFiniteNumber(device.deviceId, 0)), 0, 0xffffff),
    minPreambleCount: clamp(Math.trunc(toFiniteNumber(device.minPreambleCount, 5)), 2, 20),
    hartRevision: clamp(Math.trunc(toFiniteNumber(device.hartRevision, 0)), 0, 255),
    profile: clamp(Math.trunc(toFiniteNumber(device.profile, 0)), 0, 255),
    softwareVersion: clamp(Math.trunc(toFiniteNumber(device.softwareVersion, 0)), 0, 255),
    hardwareVersion: clamp(Math.trunc(toFiniteNumber(device.hardwareVersion, 0)), 0, 255),
    physicalSignalType: clamp(Math.trunc(toFiniteNumber(device.physicalSignalType, 0)), 0, 255),
    deviceFlag: clamp(Math.trunc(toFiniteNumber(device.deviceFlag, 0)), 0, 255),
  };
}

function normalizeCommand(value) {
  const command = Math.trunc(Number(value));
  if (command >= 0 && command <= 255) {
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
