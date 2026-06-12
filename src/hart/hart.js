import i18n from "../i18n.js";

export const TX_ADDR_SHORT = 0x02;
export const TX_ADDR_LONG = 0x82;
export const RX_ADDR_SHORT = 0x06;
export const RX_ADDR_LONG = 0x86;
export const PRIMARY_MASTER = 0x80;
export const SECONDARY_MASTER = 0x00;

const HART_UNIT_CODES = {
  1: "°C",
  2: "°F",
  3: "K",
  4: "mA",
  5: "V",
  6: "mV",
  7: "kPa",
  8: "MPa",
  9: "Pa",
  10: "bar",
  11: "mbar",
  12: "psi",
  32: "%",
  39: "mA",
  48: "mm",
  57: "%",
  250: "",
};

export function getHartUnitString(unitCode) {
  return HART_UNIT_CODES[unitCode] ?? "";
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
  const safePreamble = clamp(Math.trunc(preambleLength), 2, 20);
  const masterBit = masterType === SECONDARY_MASTER ? SECONDARY_MASTER : PRIMARY_MASTER;
  const shortAddress = pollAddress & 0x0f;
  const parts = [];

  if (command === 0) {
    parts.push(TX_ADDR_SHORT, shortAddress | masterBit);
  } else if (device?.discovered) {
    parts.push(
      TX_ADDR_LONG,
      (device.manufacturer & 0xff) | masterBit,
      device.deviceType & 0xff,
      (device.deviceId >> 16) & 0xff,
      (device.deviceId >> 8) & 0xff,
      device.deviceId & 0xff,
    );
  } else {
    parts.push(TX_ADDR_SHORT, shortAddress | masterBit);
  }

  parts.push(command & 0xff, commandData.length & 0xff);
  commandData.forEach((byte) => parts.push(byte & 0xff));

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
  if (delimiter !== RX_ADDR_SHORT && delimiter !== RX_ADDR_LONG) {
    return null;
  }

  const addressLength = delimiter === RX_ADDR_SHORT ? 1 : 5;
  const headerLength = 1 + addressLength + 2;
  if (frame.length < headerLength + 2) {
    return null;
  }

  const command = frame[1 + addressLength];
  const byteCount = frame[2 + addressLength];
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
  const data = frame.subarray(dataStart + 2, dataStart + 2 + payloadLength);

  let pollAddress = null;
  if (delimiter === RX_ADDR_SHORT) {
    pollAddress = frame[1] & 0x0f;
  }

  return {
    delimiter,
    addressLength,
    pollAddress,
    command,
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
      if (byte === RX_ADDR_SHORT || byte === RX_ADDR_LONG) {
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
    const addressLength = delimiter === RX_ADDR_SHORT ? 1 : 5;
    const headerLength = 1 + addressLength + 2;

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
  if (!parsedFrame || parsedFrame.command !== 0 || parsedFrame.byteCount < 14) {
    return null;
  }

  const { data } = parsedFrame;
  if (data.length < 12) {
    return null;
  }

  return {
    discovered: true,
    manufacturer: data[1],
    deviceType: data[2],
    minPreambleCount: data[3],
    hartRevision: data[4],
    profile: data[5],
    softwareVersion: data[6],
    hardwareVersion: data[7] >> 3,
    physicalSignalType: data[7] & 0x07,
    deviceFlag: data[8],
    deviceId: (data[9] << 16) | (data[10] << 8) | data[11],
  };
}

export function formatHartDeviceSummary(device) {
  if (!device?.discovered) {
    return i18n("hart.deviceNotFound");
  }

  return `Mfr 0x${device.manufacturer.toString(16).padStart(2, "0").toUpperCase()} · Type 0x${device.deviceType
    .toString(16)
    .padStart(2, "0")
    .toUpperCase()} · ID 0x${device.deviceId.toString(16).padStart(6, "0").toUpperCase()} · HART${device.hartRevision}`;
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
  49: "hart.cmd.49",
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
  for (let index = 0; index < length; index += 1) {
    const code = bytes[offset + index];
    if (code === 0 || code === 0xfd) {
      break;
    }

    const char = code & 0x7f;
    if (char < 0x20) {
      continue;
    }

    text += String.fromCharCode(char);
  }

  return text.trim();
}

function formatHexBytes(bytes) {
  if (!bytes || bytes.length === 0) {
    return "";
  }

  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0").toUpperCase()).join(" ");
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

  if (command === 0) {
    const device = parseCommand0Device(parsedFrame);
    if (!device) {
      return null;
    }

    return {
      command,
      commandLabel: getHartCommandLabel(command),
      summary: `${formatHartDeviceSummary(device)}${statusSuffix}`,
      lines: [
        `${i18n("hart.manufacturer")} 0x${device.manufacturer.toString(16).toUpperCase().padStart(2, "0")}`,
        `${i18n("hart.deviceType")} 0x${device.deviceType.toString(16).toUpperCase().padStart(2, "0")}`,
        `${i18n("hart.deviceId")} 0x${device.deviceId.toString(16).padStart(6, "0").toUpperCase()}`,
        `${i18n("hart.hartRevision")} ${device.hartRevision} · ${i18n("hart.preambleLen")} ${device.minPreambleCount}`,
      ],
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
    const pollingAddress = data[0] & 0x0f;
    const loopMode = data[1];
    return {
      command,
      commandLabel: getHartCommandLabel(command),
      summary: `${i18n("hart.pollAddress")} ${pollingAddress} · ${i18n("hart.loopCurrent")} ${i18n("hart.mode.deviceId", "模式")} ${loopMode}${statusSuffix}`,
      lines: [`${i18n("hart.pollAddress")} ${pollingAddress}`, `${i18n("hart.loopCurrent")} ${i18n("hart.mode.deviceId", "模式")} ${loopMode}`],
    };
  }

  if (command === 7 && data.length >= 2) {
    return {
      command,
      commandLabel: getHartCommandLabel(command),
      summary: `${i18n("hart.loopCurrent")} ${i18n("hart.mode.deviceId", "模式")} ${data[0]} · ${i18n("hart.preambleLen", "请求前导码")} ${data[1]}${statusSuffix}`,
      lines: [`${i18n("hart.loopCurrent")} ${i18n("hart.mode.deviceId", "模式")} ${data[0]}`, `${i18n("hart.preambleLen", "请求前导码")} ${data[1]}`],
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

  if (command === 12 && data.length > 0) {
    const message = decodeHartPackedAscii(data, 0, Math.min(24, data.length));
    const emptyMsg = i18n("hart.emptyMsg");
    return {
      command,
      commandLabel: getHartCommandLabel(command),
      summary: `${message || emptyMsg}${statusSuffix}`,
      lines: [message || emptyMsg],
    };
  }

  if ((command === 11 || command === 13) && data.length >= 21) {
    const tag = decodeHartPackedAscii(data, 0, 6);
    const descriptor = decodeHartPackedAscii(data, 6, 12);
    const date =
      data.length >= 21
        ? `${2000 + (data[20] & 0x7f)}/${data[19]}/${data[18]}`
        : "";
    const lines = [`${i18n("hart.tag")} ${tag || "--"}`, `${i18n("hart.descriptor")} ${descriptor || "--"}`, date ? `${i18n("hart.date")} ${date}` : null].filter(Boolean);
    return {
      command,
      commandLabel: getHartCommandLabel(command),
      summary: `${lines.join(" · ")}${statusSuffix}`,
      lines,
      fields: { tag, descriptor, date },
    };
  }

  if (command === 14 && data.length >= 15) {
    const upper = readHartVariable(data, 0, 1);
    const lower = readHartVariable(data, 5, 6);
    const minSpan = readHartVariable(data, 10, 11);
    const lines = [
      upper ? formatHartVariableLine(i18n("hart.upperRange"), upper.value, upper.unit) : null,
      lower ? formatHartVariableLine(i18n("hart.lowerRange"), lower.value, lower.unit) : null,
      minSpan ? formatHartVariableLine(i18n("hart.minSpan"), minSpan.value, minSpan.unit) : null,
    ].filter(Boolean);
    return {
      command,
      commandLabel: getHartCommandLabel(command),
      summary: `${lines.join(" · ")}${statusSuffix}`,
      lines,
    };
  }

  if (command === 15 && data.length >= 15) {
    const upper = readHartVariable(data, 2, 3);
    const lower = readHartVariable(data, 7, 8);
    const damping = byteArrayToFloat(data, 12);
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
    };
  }

  if (command === 16 && data.length >= 3) {
    const assembly = (data[0] << 16) | (data[1] << 8) | data[2];
    return {
      command,
      commandLabel: getHartCommandLabel(command),
      summary: `${i18n("hart.assemblyNumber")} 0x${assembly.toString(16).toUpperCase().padStart(6, "0")}${statusSuffix}`,
      lines: [`${i18n("hart.assemblyNumber")} 0x${assembly.toString(16).toUpperCase().padStart(6, "0")}`],
    };
  }

  if (command === 20 && data.length > 0) {
    const longTag = decodeHartPackedAscii(data, 0, Math.min(32, data.length));
    const emptyLongTag = i18n("hart.emptyLongTag");
    return {
      command,
      commandLabel: getHartCommandLabel(command),
      summary: `${longTag || emptyLongTag}${statusSuffix}`,
      lines: [longTag || emptyLongTag],
    };
  }

  if (command === 48 && data.length > 0) {
    return {
      command,
      commandLabel: getHartCommandLabel(command),
      summary: `${i18n("hart.additionalStatus")} ${formatHexBytes(data)}${statusSuffix}`,
      lines: [`${i18n("hart.additionalStatus")} ${formatHexBytes(data)}`],
    };
  }

  if (data.length === 0) {
    return {
      command,
      commandLabel: getHartCommandLabel(command),
      summary: `${i18n("har.cmd", "命令")} ${command} · ${i18n("hart.noData", "无数据")}${statusSuffix}`,
      lines: [`${i18n("har.cmd", "命令")} ${command} · ${i18n("hart.noData", "无数据")}`],
    };
  }

  return {
    command,
    commandLabel: getHartCommandLabel(command),
    summary: `${i18n("har.cmd", "命令")} ${command} · ${byteCount} ${i18n("hart.bytes", "字节")} · ${formatHexBytes(data)}${statusSuffix}`,
    lines: [`${i18n("har.cmd", "命令")} ${command} · ${byteCount} ${i18n("hart.bytes", "字节")}`, formatHexBytes(data)],
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
