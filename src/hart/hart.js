import i18n from "../i18n.js";
import { getHartEngineeringUnit } from "./hart-unit-codes.js";

export const TX_ADDR_SHORT = 0x02;
export const TX_ADDR_LONG = 0x82;
export const RX_ADDR_SHORT = 0x06;
export const RX_ADDR_LONG = 0x86;
export const PRIMARY_MASTER = 0x80;
export const SECONDARY_MASTER = 0x00;

const HART_DEVICE_STATUS_BITS = [
  { mask: 0x80, key: "hart.status.deviceMalfunction" },
  { mask: 0x40, key: "hart.status.configChanged" },
  { mask: 0x20, key: "hart.status.coldStart" },
  { mask: 0x10, key: "hart.status.moreStatus" },
  { mask: 0x08, key: "hart.status.loopFixed" },
  { mask: 0x04, key: "hart.status.loopSaturated" },
  { mask: 0x02, key: "hart.status.nonPvOutOfLimits" },
  { mask: 0x01, key: "hart.status.pvOutOfLimits" },
];

const HART_COMMUNICATION_STATUS_BITS = [
  { mask: 0x40, key: "hart.commStatus.verticalParity" },
  { mask: 0x20, key: "hart.commStatus.overrun" },
  { mask: 0x10, key: "hart.commStatus.framing" },
  { mask: 0x08, key: "hart.commStatus.checksum" },
  { mask: 0x04, key: "hart.commStatus.communicationFailure" },
  { mask: 0x02, key: "hart.commStatus.bufferOverflow" },
];

const HART_RESPONSE_CODE_KEYS = {
  0: "hart.response.success",
  5: "hart.response.tooFewBytes",
  6: "hart.response.deviceSpecificError",
  7: "hart.response.writeProtect",
  8: "hart.response.warning",
  16: "hart.response.accessRestricted",
  32: "hart.response.busy",
};

const HART_COMMAND_RESPONSE_CODE_KEYS = {
  6: {
    2: "hart.response.invalidPollAddress",
  },
  9: {
    2: "hart.response.invalidSelection",
  },
  18: {
    9: "hart.response.invalidDate",
  },
  21: {
    16: "hart.response.tagMismatch",
  },
  38: {
    8: "hart.response.configCounterMismatch",
  },
  48: {
    8: "hart.response.updateInProgress",
    14: "hart.response.statusBytesMismatch",
  },
};

const HART_DYNAMIC_VARIABLE_CODE_MAP = {
  0: "pv",
  1: "sv",
  2: "tv",
  3: "qv",
  246: "pv",
  247: "sv",
  248: "tv",
  249: "qv",
};

export function getHartUnitString(unitCode, classification = null) {
  const unit = getHartEngineeringUnit(unitCode, classification);
  if (unit) {
    return unit.symbol;
  }

  const code = Math.trunc(Number(unitCode));
  if (code >= 170 && code <= 219) {
    return `${i18n("hart.unitCode", "Unit")} ${code}`;
  }
  if (code >= 240 && code <= 249) {
    return `${i18n("hart.manufacturerUnit", "Mfr Unit")} ${code}`;
  }
  return "";
}

export function byteArrayToFloat(data, offset = 0) {
  if (!data || data.length < offset + 4) {
    return null;
  }

  const view = new DataView(data.buffer, data.byteOffset + offset, 4);
  const value = view.getFloat32(0, false);
  return Number.isFinite(value) ? value : null;
}

export function buildHartFrame({
  command,
  pollAddress = 0,
  masterType = PRIMARY_MASTER,
  preambleLength = 5,
  device = null,
  commandData = new Uint8Array(0),
}) {
  const commandNumber = Math.trunc(Number(command));
  if (!Number.isInteger(commandNumber) || commandNumber < 0 || commandNumber > 0xffff) {
    throw new RangeError("HART command must be an integer from 0 to 65535");
  }

  const safePreamble = clamp(Math.trunc(preambleLength), 2, 20);
  const masterBit = masterType === SECONDARY_MASTER ? SECONDARY_MASTER : PRIMARY_MASTER;
  const shortAddress = pollAddress & 0x3f;
  const payload = commandData instanceof Uint8Array ? commandData : Uint8Array.from(commandData ?? []);
  const wireCommand = commandNumber > 0xff ? 31 : commandNumber;
  const wireData =
    commandNumber > 0xff
      ? Uint8Array.from([(commandNumber >> 8) & 0xff, commandNumber & 0xff, ...payload])
      : payload;
  if (wireData.length > 0xff) {
    throw new RangeError("HART command data cannot exceed 255 bytes");
  }
  const parts = [];

  if (wireCommand === 0) {
    parts.push(TX_ADDR_SHORT, shortAddress | masterBit);
  } else if (device?.discovered) {
    const expandedDeviceType = device.expandedDeviceType ??
      (((device.addressManufacturer ?? device.manufacturer ?? 0) & 0xff) << 8) |
        ((device.addressDeviceType ?? device.deviceType ?? 0) & 0xff);
    parts.push(
      TX_ADDR_LONG,
      ((expandedDeviceType >> 8) & 0x3f) | masterBit,
      expandedDeviceType & 0xff,
      (device.deviceId >> 16) & 0xff,
      (device.deviceId >> 8) & 0xff,
      device.deviceId & 0xff,
    );
  } else {
    parts.push(TX_ADDR_SHORT, shortAddress | masterBit);
  }

  parts.push(wireCommand, wireData.length);
  wireData.forEach((byte) => parts.push(byte & 0xff));

  const body = Uint8Array.from(parts);
  let checksum = 0;
  for (const byte of body) {
    checksum ^= byte;
  }

  const frame = new Uint8Array(safePreamble + body.length + 1);
  frame.fill(0xff, 0, safePreamble);
  frame.set(body, safePreamble);
  frame[safePreamble + body.length] = checksum;
  return frame;
}

/** @deprecated Use buildHartFrame */
export function buildHartShortFrame(pollAddress, command, data = new Uint8Array(0), preambleLength = 5) {
  return buildHartFrame({
    command,
    pollAddress,
    preambleLength,
    commandData: data,
  });
}

export function calcHartChecksum(bytes, start, endExclusive) {
  let checksum = 0;
  for (let index = start; index < endExclusive; index += 1) {
    checksum ^= bytes[index];
  }
  return checksum;
}

export function verifyHartChecksum(frame) {
  if (frame.length < 5) {
    return false;
  }

  const checksum = calcHartChecksum(frame, 0, frame.length - 1);
  return checksum === frame[frame.length - 1];
}

export function parseHartFrame(frame) {
  if (!frame || frame.length < 6) {
    return null;
  }

  const delimiter = frame[0];
  if ((delimiter & 0x07) !== 0x06) {
    return null;
  }

  const addressLength = (delimiter & 0x80) !== 0 ? 5 : 1;
  const expansionByteCount = (delimiter >> 5) & 0x03;
  const headerLength = 1 + addressLength + expansionByteCount + 2;
  if (frame.length < headerLength + 2) {
    return null;
  }

  const commandIndex = 1 + addressLength + expansionByteCount;
  const wireCommand = frame[commandIndex];
  const byteCount = frame[commandIndex + 1];
  if (byteCount < 2) {
    return null;
  }
  const frameLength = headerLength + byteCount + 1;

  if (frame.length < frameLength) {
    return null;
  }

  const parsed = frame.subarray(0, frameLength);
  if (!verifyHartChecksum(parsed)) {
    return null;
  }

  const dataStart = headerLength;
  const responseCode = frame[dataStart];
  const status = frame[dataStart + 1];
  const payloadLength = Math.max(0, byteCount - 2);
  let command = wireCommand;
  let data = frame.subarray(dataStart + 2, dataStart + 2 + payloadLength);
  if (wireCommand === 31 && data.length >= 2) {
    command = (data[0] << 8) | data[1];
    data = data.subarray(2);
  }

  let pollAddress = null;
  if (addressLength === 1) {
    pollAddress = frame[1] & 0x3f;
  }

  return {
    delimiter,
    addressLength,
    expansionByteCount,
    pollAddress,
    command,
    wireCommand,
    byteCount,
    responseCode,
    status,
    data,
    frame: parsed,
  };
}

export function extractHartFrames(buffer) {
  const frames = [];
  let offset = 0;

  while (offset < buffer.length) {
    let startIndex = -1;

    for (let index = offset; index < buffer.length; index += 1) {
      const byte = buffer[index];
      if ((byte & 0x07) === 0x06) {
        startIndex = index;
        break;
      }
    }

    if (startIndex === -1) {
      if (offset === 0 && buffer.length > 24) {
        return {
          frames,
          remaining: buffer.subarray(buffer.length - 24),
        };
      }
      break;
    }

    const delimiter = buffer[startIndex];
    const addressLength = (delimiter & 0x80) !== 0 ? 5 : 1;
    const expansionByteCount = (delimiter >> 5) & 0x03;
    const headerLength = 1 + addressLength + expansionByteCount + 2;

    if (buffer.length - startIndex < headerLength + 2) {
      break;
    }

    const byteCount = buffer[startIndex + headerLength - 1];
    const frameLength = headerLength + byteCount + 1;

    if (buffer.length - startIndex < frameLength) {
      break;
    }

    const raw = buffer.subarray(startIndex, startIndex + frameLength);
    const parsed = parseHartFrame(raw);

    if (!parsed) {
      offset = startIndex + 1;
      continue;
    }

    frames.push(parsed);
    offset = startIndex + frameLength;
  }

  return {
    frames,
    remaining: buffer.subarray(offset),
  };
}

export function parseCommand0Device(parsedFrame) {
  if (
    !parsedFrame ||
    ![0, 11, 21].includes(parsedFrame.command) ||
    parsedFrame.responseCode !== 0 ||
    parsedFrame.byteCount < 14
  ) {
    return null;
  }

  const { data } = parsedFrame;
  if (data.length < 12 || data[0] !== 0xfe) {
    return null;
  }

  return {
    discovered: true,
    addressManufacturer: data[1],
    addressDeviceType: data[2],
    manufacturer: data.length >= 19 ? (data[17] << 8) | data[18] : data[1],
    deviceType: data[2],
    expandedDeviceType: (data[1] << 8) | data[2],
    minPreambleCount: data[3],
    hartRevision: data[4],
    deviceRevision: data[5],
    profile: data.length >= 22 ? data[21] : data[5],
    softwareVersion: data[6],
    hardwareVersion: data[7] >> 3,
    physicalSignalType: data[7] & 0x07,
    deviceFlag: data[8],
    deviceId: (data[9] << 16) | (data[10] << 8) | data[11],
    responsePreambleCount: data.length >= 13 ? data[12] : null,
    lastDeviceVariableCode: data.length >= 14 ? data[13] : null,
    configChangeCounter: data.length >= 16 ? (data[14] << 8) | data[15] : null,
    extendedDeviceStatus: data.length >= 17 ? data[16] : null,
    privateLabelDistributor: data.length >= 21 ? (data[19] << 8) | data[20] : null,
  };
}

export function formatHartDeviceSummary(device) {
  if (!device?.discovered) {
    return i18n("hart.deviceNotFound");
  }

  const manufacturerWidth = device.manufacturer > 0xff ? 4 : 2;
  const deviceType = device.expandedDeviceType ?? device.deviceType;
  const deviceTypeWidth = deviceType > 0xff ? 4 : 2;
  return `Mfr 0x${formatHexNumber(device.manufacturer, manufacturerWidth)} · Type 0x${formatHexNumber(
    deviceType,
    deviceTypeWidth,
  )} · ID 0x${formatHexNumber(device.deviceId, 6)} · HART${device.hartRevision}`;
}

export function parseHartTelemetryValue(parsedFrame, preferredCommand) {
  if (!parsedFrame) {
    return null;
  }

  const command = preferredCommand ?? parsedFrame.command;
  const { data } = parsedFrame;

  if (command === 1 && parsedFrame.byteCount >= 5 && data.length >= 5) {
    const unit = getHartUnitString(data[0]);
    const rawValue = byteArrayToFloat(data, 1);
    return Number.isFinite(rawValue)
      ? { fieldName: "PV", unit, value: rawValue, rawValue, command: 1 }
      : null;
  }

  if (command === 2 && parsedFrame.byteCount >= 8 && data.length >= 8) {
    const current = byteArrayToFloat(data, 0);
    const percent = byteArrayToFloat(data, 4);
    if (!Number.isFinite(current)) {
      return null;
    }

    return {
      fieldName: i18n("hart.loopCurrent"),
      unit: "mA",
      value: current,
      rawValue: current,
      command: 2,
      extra: Number.isFinite(percent) ? { percent } : null,
    };
  }

  if (command === 3 && parsedFrame.byteCount >= 24 && data.length >= 24) {
    const variables = parseHartCommand3Variables(data);
    if (!variables?.pv) {
      return null;
    }

    return {
      fieldName: "PV",
      unit: variables.pv.unit,
      value: variables.pv.value,
      rawValue: variables.pv.value,
      command: 3,
    };
  }

  return null;
}

export const HART_COMMAND_LABELS = {
  0: "hart.cmd.0",
  1: "hart.cmd.1",
  2: "hart.cmd.2",
  3: "hart.cmd.3",
  6: "hart.cmd.6",
  7: "hart.cmd.7",
  8: "hart.cmd.8",
  9: "hart.cmd.9",
  11: "hart.cmd.11",
  12: "hart.cmd.12",
  13: "hart.cmd.13",
  14: "hart.cmd.14",
  15: "hart.cmd.15",
  16: "hart.cmd.16",
  17: "hart.cmd.17",
  18: "hart.cmd.18",
  19: "hart.cmd.19",
  20: "hart.cmd.20",
  21: "hart.cmd.21",
  22: "hart.cmd.22",
  33: "hart.cmd.33",
  34: "hart.cmd.34",
  35: "hart.cmd.35",
  36: "hart.cmd.36",
  37: "hart.cmd.37",
  38: "hart.cmd.38",
  39: "hart.cmd.39",
  40: "hart.cmd.40",
  41: "hart.cmd.41",
  43: "hart.cmd.43",
  44: "hart.cmd.44",
  45: "hart.cmd.45",
  46: "hart.cmd.46",
  47: "hart.cmd.47",
  48: "hart.cmd.48",
  50: "hart.cmd.50",
  81: "hart.cmd.81",
  82: "hart.cmd.82",
  105: "hart.cmd.105",
  108: "hart.cmd.108",
  109: "hart.cmd.109",
};

export function getHartCommandLabel(command) {
  const key = HART_COMMAND_LABELS[command];
  return key ? i18n(key) : `${i18n("hart.universalCmd", "命令")} ${command}`;
}

export function decodeHartPackedAscii(bytes, offset = 0, length = bytes?.length ?? 0) {
  if (!bytes || length <= 0) {
    return "";
  }

  let text = "";
  const end = Math.min(bytes.length, offset + length);
  for (let index = offset; index + 2 < end; index += 3) {
    const packed = (bytes[index] << 16) | (bytes[index + 1] << 8) | bytes[index + 2];
    const values = [(packed >> 18) & 0x3f, (packed >> 12) & 0x3f, (packed >> 6) & 0x3f, packed & 0x3f];
    for (const value of values) {
      const charCode = value & 0x20 ? value : value | 0x40;
      text += String.fromCharCode(charCode);
    }
  }

  return text.trimEnd();
}

export function encodeHartPackedAscii(text = "", charCount = 4) {
  const safeCharCount = Math.max(4, Math.ceil(charCount / 4) * 4);
  const normalized = String(text).toUpperCase().padEnd(safeCharCount, " ").slice(0, safeCharCount);
  const bytes = new Uint8Array((safeCharCount / 4) * 3);

  for (let charIndex = 0, byteIndex = 0; charIndex < safeCharCount; charIndex += 4, byteIndex += 3) {
    const values = [0, 1, 2, 3].map((offsetIndex) => normalized.charCodeAt(charIndex + offsetIndex) & 0x3f);
    const packed = (values[0] << 18) | (values[1] << 12) | (values[2] << 6) | values[3];
    bytes[byteIndex] = (packed >> 16) & 0xff;
    bytes[byteIndex + 1] = (packed >> 8) & 0xff;
    bytes[byteIndex + 2] = packed & 0xff;
  }

  return bytes;
}

export function decodeHartLatin1(bytes, offset = 0, length = bytes?.length ?? 0) {
  if (!bytes || length <= 0) {
    return "";
  }

  let text = "";
  const end = Math.min(bytes.length, offset + length);
  for (let index = offset; index < end; index += 1) {
    const byte = bytes[index];
    if (byte === 0) {
      break;
    }
    text += String.fromCharCode(byte);
  }
  return text.trimEnd();
}

export function encodeHartLatin1(text = "", byteLength = 1) {
  const bytes = new Uint8Array(Math.max(0, byteLength));
  bytes.fill(0x20);
  const normalized = String(text).slice(0, byteLength);
  for (let index = 0; index < normalized.length; index += 1) {
    bytes[index] = normalized.charCodeAt(index) & 0xff;
  }
  return bytes;
}

export function formatHartDateBytes(data, offset = 0) {
  if (!data || data.length < offset + 3) {
    return "";
  }

  const day = data[offset];
  const month = data[offset + 1];
  const year = 1900 + data[offset + 2];
  if (day === 0 || month === 0) {
    return "";
  }
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function encodeHartDateBytes(dateValue = "") {
  const date = dateValue ? new Date(`${dateValue}T00:00:00`) : new Date();
  const year = Number.isFinite(date.getFullYear()) ? date.getFullYear() : new Date().getFullYear();
  return Uint8Array.from([
    date.getDate(),
    date.getMonth() + 1,
    clamp(Math.trunc(year - 1900), 0, 255),
  ]);
}

export function decodeHartDeviceStatus(status) {
  return HART_DEVICE_STATUS_BITS.filter((entry) => (status & entry.mask) !== 0).map((entry) => i18n(entry.key));
}

export function decodeHartCommunicationStatus(responseCode) {
  if ((responseCode & 0x80) === 0) {
    return [];
  }
  return HART_COMMUNICATION_STATUS_BITS.filter((entry) => (responseCode & entry.mask) !== 0).map((entry) =>
    i18n(entry.key),
  );
}

export function describeHartResponseCode(command, responseCode) {
  if ((responseCode & 0x80) !== 0) {
    const status = decodeHartCommunicationStatus(responseCode);
    return status.length ? status.join(" / ") : i18n("hart.response.communicationError");
  }

  const key = HART_COMMAND_RESPONSE_CODE_KEYS[command]?.[responseCode] ?? HART_RESPONSE_CODE_KEYS[responseCode];
  return key ? i18n(key) : i18n("hart.response.undefined");
}

export function isHartCommandResponseWarning(command, responseCode) {
  if ((responseCode & 0x80) !== 0) {
    return false;
  }
  if ([1, 2, 3, 33, 34].includes(command)) return responseCode === 8;
  if (command === 9) return [8, 14, 30].includes(responseCode);
  if ([35, 36, 48, 82].includes(command)) return [8, 14].includes(responseCode);
  if (command === 37) return responseCode === 14;
  if ([107, 108, 109].includes(command)) return responseCode === 8;
  return false;
}

export function formatHartFrameStatusLines(parsedFrame) {
  if (!parsedFrame) {
    return [];
  }

  const lines = [];
  if (parsedFrame.responseCode !== 0) {
    lines.push(
      `${i18n("hart.responseCode")} 0x${formatHexNumber(parsedFrame.responseCode, 2)} ${describeHartResponseCode(
        parsedFrame.command,
        parsedFrame.responseCode,
      )}`,
    );
  }

  const deviceStatus = decodeHartDeviceStatus(parsedFrame.status);
  if (deviceStatus.length) {
    lines.push(`${i18n("hart.deviceStatus")} 0x${formatHexNumber(parsedFrame.status, 2)} ${deviceStatus.join(" / ")}`);
  }

  return lines;
}

function formatHexBytes(bytes) {
  if (!bytes || bytes.length === 0) {
    return "";
  }

  return [...bytes].map((byte) => formatHexNumber(byte, 2)).join(" ");
}

function formatHexNumber(value, width = 2) {
  return Math.trunc(Number(value) || 0).toString(16).padStart(width, "0").toUpperCase();
}

function formatHartFloat(value, unit = "") {
  if (!Number.isFinite(value)) {
    return "--";
  }

  return `${value.toFixed(3)}${unit ? ` ${unit}` : ""}`;
}

function formatHartVariableLine(label, value, unit = "") {
  return `${label} ${formatHartFloat(value, unit)}`;
}

function readHartVariable(data, unitOffset, valueOffset) {
  const unit = getHartUnitString(data[unitOffset]);
  const value = byteArrayToFloat(data, valueOffset);
  if (!Number.isFinite(value)) {
    return null;
  }

  return { value, unit };
}

export function parseHartCommand2Variables(data) {
  if (!data || data.length < 8) {
    return null;
  }

  const loopCurrent = byteArrayToFloat(data, 0);
  const percent = byteArrayToFloat(data, 4);
  if (!Number.isFinite(loopCurrent)) {
    return null;
  }

  return {
    loopCurrent: { value: loopCurrent, unit: "mA" },
    percent: Number.isFinite(percent) ? { value: percent, unit: "%" } : null,
  };
}

export function parseHartCommand3Variables(data) {
  if (!data || data.length < 24) {
    return null;
  }

  const pv = readHartVariable(data, 4, 5);
  if (!pv) {
    return null;
  }

  const loopCurrent = byteArrayToFloat(data, 0);
  const sv = readHartVariable(data, 9, 10);
  const tv = readHartVariable(data, 14, 15);
  const qv = readHartVariable(data, 19, 20);

  return {
    loopCurrent: Number.isFinite(loopCurrent) ? { value: loopCurrent, unit: "mA" } : null,
    pv,
    sv,
    tv,
    qv,
  };
}

export function parseHartCommand9Variables(data) {
  if (!data || data.length < 13) {
    return null;
  }

  const slotCount = clamp(Math.floor((data.length - 5) / 8), 1, 8);
  const slots = [];
  const variables = {};

  for (let slot = 0; slot < slotCount; slot += 1) {
    const offset = 1 + slot * 8;
    if (data.length < offset + 8) {
      break;
    }

    const code = data[offset];
    const classification = data[offset + 1];
    const unit = getHartUnitString(data[offset + 2], classification);
    const value = byteArrayToFloat(data, offset + 3);
    const status = data[offset + 7];
    const entry = {
      slot,
      code,
      classification,
      unit,
      value,
      status,
    };
    slots.push(entry);

    const dynamicKey = HART_DYNAMIC_VARIABLE_CODE_MAP[code];
    if (dynamicKey && Number.isFinite(value)) {
      variables[dynamicKey] = {
        value,
        unit,
        code,
        classification,
        status,
      };
    }
  }

  const timestampOffset = 1 + slotCount * 8;
  const timestamp =
    data.length >= timestampOffset + 4
      ? ((data[timestampOffset] << 24) | (data[timestampOffset + 1] << 16) | (data[timestampOffset + 2] << 8) | data[timestampOffset + 3]) >>> 0
      : null;

  return {
    extendedDeviceStatus: data[0],
    slots,
    variables,
    timestamp,
  };
}

export function parseHartCommand33Variables(data) {
  if (!data || data.length < 6) {
    return null;
  }

  const slotCount = clamp(Math.floor(data.length / 6), 1, 4);
  const slots = [];
  const variables = {};

  for (let slot = 0; slot < slotCount; slot += 1) {
    const offset = slot * 6;
    if (data.length < offset + 6) {
      break;
    }

    const code = data[offset];
    const unit = getHartUnitString(data[offset + 1]);
    const value = byteArrayToFloat(data, offset + 2);
    const entry = {
      slot,
      code,
      unit,
      value,
    };
    slots.push(entry);

    const dynamicKey = HART_DYNAMIC_VARIABLE_CODE_MAP[code];
    if (dynamicKey && Number.isFinite(value)) {
      variables[dynamicKey] = {
        value,
        unit,
        code,
      };
    }
  }

  return { slots, variables };
}

export function parseHartUniversalResponse(parsedFrame) {
  if (!parsedFrame) {
    return null;
  }

  const { command, data, responseCode, status, byteCount } = parsedFrame;
  const statusSuffix =
    responseCode !== 0 || status !== 0
      ? ` · 应答 0x${responseCode.toString(16).toUpperCase().padStart(2, "0")} · 状态 0x${status
          .toString(16)
          .toUpperCase()
          .padStart(2, "0")}`
      : "";

  if (responseCode !== 0 && !isHartCommandResponseWarning(command, responseCode)) {
    const response = describeHartResponseCode(command, responseCode);
    return {
      command,
      commandLabel: getHartCommandLabel(command),
      summary: `${i18n("hart.responseCode")} 0x${formatHexNumber(responseCode, 2)} · ${response}`,
      lines: [`${i18n("hart.responseCode")} 0x${formatHexNumber(responseCode, 2)} · ${response}`],
      isError: true,
    };
  }

  if (command === 0 || command === 11 || command === 21) {
    const device = parseCommand0Device(parsedFrame);
    if (!device) {
      return null;
    }

    return {
      command,
      commandLabel: getHartCommandLabel(command),
      summary: `${formatHartDeviceSummary(device)}${statusSuffix}`,
      lines: [
        `${i18n("hart.manufacturer")} 0x${formatHexNumber(device.manufacturer, device.manufacturer > 0xff ? 4 : 2)}`,
        `${i18n("hart.deviceType")} 0x${formatHexNumber(device.expandedDeviceType ?? device.deviceType, (device.expandedDeviceType ?? device.deviceType) > 0xff ? 4 : 2)}`,
        `${i18n("hart.deviceId")} 0x${formatHexNumber(device.deviceId, 6)}`,
        `${i18n("hart.hartRevision")} ${device.hartRevision} · ${i18n("hart.preambleLen")} ${device.minPreambleCount}`,
        Number.isFinite(device.configChangeCounter)
          ? `${i18n("hart.configChangeCounter")} ${device.configChangeCounter}`
          : null,
        Number.isFinite(device.extendedDeviceStatus)
          ? `${i18n("hart.extendedStatus")} 0x${formatHexNumber(device.extendedDeviceStatus, 2)}`
          : null,
        Number.isFinite(device.lastDeviceVariableCode)
          ? `${i18n("hart.lastDeviceVariable")} ${device.lastDeviceVariableCode}`
          : null,
      ].filter(Boolean),
      device,
    };
  }

  if (command === 1) {
    const variables = parseHartCommand1Variables(data);
    if (!variables?.pv) {
      return null;
    }

    return {
      command,
      commandLabel: getHartCommandLabel(command),
      summary: `${formatHartVariableLine("PV", variables.pv.value, variables.pv.unit)}${statusSuffix}`,
      lines: [formatHartVariableLine("PV", variables.pv.value, variables.pv.unit)],
      variables: { pv: variables.pv },
    };
  }

  if (command === 2) {
    const variables = parseHartCommand2Variables(data);
    if (!variables) {
      return null;
    }

    const lines = [formatHartVariableLine(i18n("hart.loopCurrent"), variables.loopCurrent.value, "mA")];
    if (variables.percent) {
      lines.push(formatHartVariableLine(i18n("hart.percentRange"), variables.percent.value, "%"));
    }

    return {
      command,
      commandLabel: getHartCommandLabel(command),
      summary: `${lines.join(" · ")}${statusSuffix}`,
      lines,
      fields: variables,
    };
  }

  if (command === 3) {
    const variables = parseHartCommand3Variables(data);
    if (!variables) {
      return null;
    }

    const dynamic = {
      pv: variables.pv,
      sv: variables.sv,
      tv: variables.tv,
      qv: variables.qv,
    };
    const lines = ["pv", "sv", "tv", "qv"]
      .map((key) => {
        const entry = dynamic[key];
        return entry ? formatHartVariableLine(key.toUpperCase(), entry.value, entry.unit) : null;
      })
      .filter(Boolean);

    if (variables.loopCurrent) {
      lines.unshift(formatHartVariableLine(i18n("hart.loopCurrent"), variables.loopCurrent.value, "mA"));
    }

    return {
      command,
      commandLabel: getHartCommandLabel(command),
      summary: `${lines.slice(0, 4).join(" · ")}${statusSuffix}`,
      lines,
      variables: dynamic,
      fields: variables,
    };
  }

  if (command === 6 && data.length >= 2) {
    const pollingAddress = data[0] & 0x3f;
    const loopMode = data[1];
    return {
      command,
      commandLabel: getHartCommandLabel(command),
      summary: `${i18n("hart.pollAddress")} ${pollingAddress} · ${i18n("hart.loopMode")} 0x${formatHexNumber(loopMode, 2)}${statusSuffix}`,
      lines: [`${i18n("hart.pollAddress")} ${pollingAddress}`, `${i18n("hart.loopMode")} 0x${formatHexNumber(loopMode, 2)}`],
      fields: { pollingAddress, loopCurrentMode: loopMode },
    };
  }

  if (command === 7 && data.length >= 2) {
    return {
      command,
      commandLabel: getHartCommandLabel(command),
      summary: `${i18n("hart.pollAddress")} ${data[0] & 0x3f} · ${i18n("hart.loopMode")} 0x${formatHexNumber(data[1], 2)}${statusSuffix}`,
      lines: [`${i18n("hart.pollAddress")} ${data[0] & 0x3f}`, `${i18n("hart.loopMode")} 0x${formatHexNumber(data[1], 2)}`],
      fields: { pollingAddress: data[0] & 0x3f, loopCurrentMode: data[1] },
    };
  }

  if (command === 8 && data.length >= 4) {
    const labels = ["PV", "SV", "TV", "QV"];
    const lines = labels.map((label, index) => `${label} ${i18n("hart.classification", "分类")} ${data[index]}`);
    return {
      command,
      commandLabel: getHartCommandLabel(command),
      summary: `${lines.join(" · ")}${statusSuffix}`,
      lines,
    };
  }

  if ((command === 12 || command === 17) && data.length > 0) {
    const message = decodeHartPackedAscii(data, 0, Math.min(24, data.length));
    const emptyMsg = i18n("hart.emptyMsg");
    return {
      command,
      commandLabel: getHartCommandLabel(command),
      summary: `${message || emptyMsg}${statusSuffix}`,
      lines: [message || emptyMsg],
      fields: { message },
    };
  }

  if ((command === 13 || command === 18) && data.length >= 21) {
    const tag = decodeHartPackedAscii(data, 0, 6);
    const descriptor = decodeHartPackedAscii(data, 6, 12);
    const date = formatHartDateBytes(data, 18);
    const lines = [`${i18n("hart.tag")} ${tag || "--"}`, `${i18n("hart.descriptor")} ${descriptor || "--"}`, date ? `${i18n("hart.date")} ${date}` : null].filter(Boolean);
    return {
      command,
      commandLabel: getHartCommandLabel(command),
      summary: `${lines.join(" · ")}${statusSuffix}`,
      lines,
      fields: { tag, descriptor, date },
    };
  }

  if (command === 14 && data.length >= 16) {
    const transducerSerialNumber = (data[0] << 16) | (data[1] << 8) | data[2];
    const upper = readHartVariable(data, 3, 4);
    const lower = readHartVariable(data, 3, 8);
    const minSpan = readHartVariable(data, 3, 12);
    const lines = [
      `${i18n("hart.transducerSerial")} ${transducerSerialNumber}`,
      upper ? formatHartVariableLine(i18n("hart.upperRange"), upper.value, upper.unit) : null,
      lower ? formatHartVariableLine(i18n("hart.lowerRange"), lower.value, lower.unit) : null,
      minSpan ? formatHartVariableLine(i18n("hart.minSpan"), minSpan.value, minSpan.unit) : null,
    ].filter(Boolean);
    return {
      command,
      commandLabel: getHartCommandLabel(command),
      summary: `${lines.join(" · ")}${statusSuffix}`,
      lines,
      fields: {
        transducerSerialNumber,
        unitCode: data[3],
        upper: upper?.value,
        lower: lower?.value,
        minSpan: minSpan?.value,
        unit: upper?.unit ?? getHartUnitString(data[3]),
      },
    };
  }

  if (command === 15 && data.length >= 15) {
    const upper = readHartVariable(data, 2, 3);
    const lower = readHartVariable(data, 2, 7);
    const damping = byteArrayToFloat(data, 11);
    const lines = [
      `${i18n("hart.alarm")} ${data[0]} · ${i18n("hart.transferFunc")} ${data[1]}`,
      upper ? formatHartVariableLine(i18n("hart.upperRangeLimit"), upper.value, upper.unit) : null,
      lower ? formatHartVariableLine(i18n("hart.lowerRangeLimit"), lower.value, lower.unit) : null,
      Number.isFinite(damping) ? formatHartVariableLine(i18n("hart.damping"), damping, "s") : null,
    ].filter(Boolean);
    return {
      command,
      commandLabel: getHartCommandLabel(command),
      summary: `${lines.join(" · ")}${statusSuffix}`,
      lines,
      fields: {
        alarmSelection: data[0],
        transferFunction: data[1],
        unitCode: data[2],
        upper: upper?.value,
        lower: lower?.value,
        damping,
        writeProtect: data.length >= 16 ? data[15] : null,
        analogChannelFlags: data.length >= 18 ? data[17] : null,
        unit: upper?.unit ?? getHartUnitString(data[2]),
      },
    };
  }

  if (command === 16 && data.length >= 3) {
    const assembly = (data[0] << 16) | (data[1] << 8) | data[2];
    return {
      command,
      commandLabel: getHartCommandLabel(command),
      summary: `${i18n("hart.assemblyNumber")} 0x${assembly.toString(16).toUpperCase().padStart(6, "0")}${statusSuffix}`,
      lines: [`${i18n("hart.assemblyNumber")} 0x${assembly.toString(16).toUpperCase().padStart(6, "0")}`],
      fields: { assemblyNumber: assembly },
    };
  }

  if ((command === 20 || command === 22) && data.length > 0) {
    const longTag = decodeHartLatin1(data, 0, Math.min(32, data.length));
    const emptyLongTag = i18n("hart.emptyLongTag");
    return {
      command,
      commandLabel: getHartCommandLabel(command),
      summary: `${longTag || emptyLongTag}${statusSuffix}`,
      lines: [longTag || emptyLongTag],
    };
  }

  if (command === 9) {
    const variables = parseHartCommand9Variables(data);
    if (!variables) {
      return null;
    }

    const lines = variables.slots.map((slot) => {
      const dynamicLabel = HART_DYNAMIC_VARIABLE_CODE_MAP[slot.code]?.toUpperCase() ?? `${i18n("hart.deviceVariable")} ${slot.code}`;
      const statusText = slot.status != null ? ` · ${i18n("hart.variableStatus")} 0x${formatHexNumber(slot.status, 2)}` : "";
      return `${dynamicLabel} ${formatHartFloat(slot.value, slot.unit)} · ${i18n("hart.classification")} ${slot.classification}${statusText}`;
    });
    lines.unshift(`${i18n("hart.extendedStatus")} 0x${formatHexNumber(variables.extendedDeviceStatus, 2)}`);
    if (Number.isFinite(variables.timestamp)) {
      lines.push(`${i18n("hart.timestamp")} ${(variables.timestamp / 32000).toFixed(3)} s`);
    }

    return {
      command,
      commandLabel: getHartCommandLabel(command),
      summary: `${lines.slice(0, 4).join(" · ")}${statusSuffix}`,
      lines,
      variables: variables.variables,
      fields: variables,
    };
  }

  if (command === 33) {
    const variables = parseHartCommand33Variables(data);
    if (!variables) {
      return null;
    }

    const lines = variables.slots.map((slot) => {
      const dynamicLabel = HART_DYNAMIC_VARIABLE_CODE_MAP[slot.code]?.toUpperCase() ?? `${i18n("hart.deviceVariable")} ${slot.code}`;
      return `${dynamicLabel} ${formatHartFloat(slot.value, slot.unit)}`;
    });

    return {
      command,
      commandLabel: getHartCommandLabel(command),
      summary: `${lines.join(" · ")}${statusSuffix}`,
      lines,
      variables: variables.variables,
      fields: variables,
    };
  }

  if (command === 38 && data.length >= 2) {
    const counter = (data[0] << 8) | data[1];
    return {
      command,
      commandLabel: getHartCommandLabel(command),
      summary: `${i18n("hart.configChangeCounter")} ${counter}${statusSuffix}`,
      lines: [`${i18n("hart.configChangeCounter")} ${counter}`],
      fields: { configChangeCounter: counter },
    };
  }

  if (command === 48 && data.length > 0) {
    const lines = [
      `${i18n("hart.additionalStatus")} ${formatHexBytes(data)}`,
      data.length >= 7 ? `${i18n("hart.extendedStatus")} 0x${formatHexNumber(data[6], 2)}` : null,
      data.length >= 8 ? `${i18n("hart.operatingMode")} 0x${formatHexNumber(data[7], 2)}` : null,
      data.length >= 9 ? `${i18n("hart.standardizedStatus0")} 0x${formatHexNumber(data[8], 2)}` : null,
      data.length >= 10 ? `${i18n("hart.standardizedStatus1")} 0x${formatHexNumber(data[9], 2)}` : null,
      data.length >= 11 ? `${i18n("hart.analogChannelSaturated")} 0x${formatHexNumber(data[10], 2)}` : null,
      data.length >= 12 ? `${i18n("hart.standardizedStatus2")} 0x${formatHexNumber(data[11], 2)}` : null,
      data.length >= 13 ? `${i18n("hart.standardizedStatus3")} 0x${formatHexNumber(data[12], 2)}` : null,
      data.length >= 14 ? `${i18n("hart.analogChannelFixed")} 0x${formatHexNumber(data[13], 2)}` : null,
    ].filter(Boolean);
    return {
      command,
      commandLabel: getHartCommandLabel(command),
      summary: `${i18n("hart.additionalStatus")} ${formatHexBytes(data)}${statusSuffix}`,
      lines,
    };
  }

  if (command === 50 && data.length >= 4) {
    const labels = ["PV", "SV", "TV", "QV"];
    const lines = labels.map((label, index) => `${label} → ${i18n("hart.deviceVariable")} ${data[index]}`);
    return {
      command,
      commandLabel: getHartCommandLabel(command),
      summary: `${lines.join(" · ")}${statusSuffix}`,
      lines,
      fields: { pv: data[0], sv: data[1], tv: data[2], qv: data[3] },
    };
  }

  if ([34, 40, 45, 46].includes(command) && data.length >= 4) {
    const value = byteArrayToFloat(data, 0);
    const unit = command === 34 ? "s" : "mA";
    const line = formatHartVariableLine(command === 34 ? i18n("hart.damping") : i18n("hart.loopCurrent"), value, unit);
    return {
      command,
      commandLabel: getHartCommandLabel(command),
      summary: `${line}${statusSuffix}`,
      lines: [line],
      fields: { value, unit },
    };
  }

  if (command === 35 && data.length >= 9) {
    const unitCode = data[0];
    const upper = byteArrayToFloat(data, 1);
    const lower = byteArrayToFloat(data, 5);
    const unit = getHartUnitString(unitCode);
    const lines = [
      formatHartVariableLine(i18n("hart.upperRangeLimit"), upper, unit),
      formatHartVariableLine(i18n("hart.lowerRangeLimit"), lower, unit),
    ];
    return {
      command,
      commandLabel: getHartCommandLabel(command),
      summary: `${lines.join(" · ")}${statusSuffix}`,
      lines,
      fields: { unitCode, unit, upper, lower },
    };
  }

  if (command === 44 && data.length >= 1) {
    const unitCode = data[0];
    const unit = getHartUnitString(unitCode);
    return {
      command,
      commandLabel: getHartCommandLabel(command),
      summary: `${i18n("hart.unitCode")} ${unitCode} · ${unit}${statusSuffix}`,
      lines: [`${i18n("hart.unitCode")} ${unitCode} · ${unit}`],
      fields: { unitCode, unit },
    };
  }

  if (command === 47 && data.length >= 1) {
    return {
      command,
      commandLabel: getHartCommandLabel(command),
      summary: `${i18n("hart.transferFunc")} ${data[0]}${statusSuffix}`,
      lines: [`${i18n("hart.transferFunc")} ${data[0]}`],
      fields: { transferFunction: data[0] },
    };
  }

  if (command === 81 && data.length >= 23) {
    const fields = {
      deviceVariable: data[0],
      supportedTrimPoints: data[1],
      unitCode: data[2],
      unit: getHartUnitString(data[2]),
      minimumLower: byteArrayToFloat(data, 3),
      maximumLower: byteArrayToFloat(data, 7),
      minimumUpper: byteArrayToFloat(data, 11),
      maximumUpper: byteArrayToFloat(data, 15),
      minimumDifferential: byteArrayToFloat(data, 19),
    };
    const lines = [
      `${i18n("hart.deviceVariable")} ${fields.deviceVariable} · ${i18n("hart.trimPoints")} ${fields.supportedTrimPoints}`,
      `${i18n("hart.lowPointRange")} ${formatHartFloat(fields.minimumLower, fields.unit)}…${formatHartFloat(fields.maximumLower, fields.unit)}`,
      `${i18n("hart.highPointRange")} ${formatHartFloat(fields.minimumUpper, fields.unit)}…${formatHartFloat(fields.maximumUpper, fields.unit)}`,
      `${i18n("hart.minimumDifferential")} ${formatHartFloat(fields.minimumDifferential, fields.unit)}`,
    ];
    return { command, commandLabel: getHartCommandLabel(command), summary: `${lines.join(" · ")}${statusSuffix}`, lines, fields };
  }

  if (command === 82 && data.length >= 7) {
    const fields = {
      deviceVariable: data[0],
      trimPoint: data[1],
      unitCode: data[2],
      unit: getHartUnitString(data[2]),
      value: byteArrayToFloat(data, 3),
    };
    const line = `${i18n("hart.deviceVariable")} ${fields.deviceVariable} · ${i18n("hart.trimPoint")} ${fields.trimPoint} · ${formatHartFloat(fields.value, fields.unit)}`;
    return { command, commandLabel: getHartCommandLabel(command), summary: `${line}${statusSuffix}`, lines: [line], fields };
  }

  if (data.length === 0) {
    return {
      command,
      commandLabel: getHartCommandLabel(command),
      summary: `${i18n("hart.command", "命令")} ${command} · ${i18n("hart.noData", "无数据")}${statusSuffix}`,
      lines: [`${i18n("hart.command", "命令")} ${command} · ${i18n("hart.noData", "无数据")}`],
    };
  }

  return {
    command,
    commandLabel: getHartCommandLabel(command),
    summary: `${i18n("hart.command", "命令")} ${command} · ${byteCount} ${i18n("hart.bytes", "字节")} · ${formatHexBytes(data)}${statusSuffix}`,
    lines: [`${i18n("hart.command", "命令")} ${command} · ${byteCount} ${i18n("hart.bytes", "字节")}`, formatHexBytes(data)],
  };
}

export function parseHartCommand1Variables(data) {
  if (!data || data.length < 5) {
    return null;
  }

  const pv = byteArrayToFloat(data, 1);
  if (!Number.isFinite(pv)) {
    return null;
  }

  return {
    pv: { value: pv, unit: getHartUnitString(data[0]) },
  };
}

/** @deprecated Use parseHartTelemetryValue */
export function parseHartFloatResponse(frame, floatIndex = 0) {
  const parsed = parseHartFrame(frame);
  if (!parsed) {
    return null;
  }

  const telemetry = parseHartTelemetryValue(parsed);
  if (!telemetry) {
    return byteArrayToFloat(parsed.data, floatIndex * 4);
  }

  return telemetry.rawValue;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
