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
    return "尚未搜索到设备";
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
      fieldName: "环路电流",
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
  0: "0 读设备标识",
  1: "1 读主变量 (PV)",
  2: "2 读环路电流 / 百分比",
  3: "3 读动态变量 (PV/SV/TV/QV)",
  6: "6 读轮询地址",
  7: "7 读环路配置",
  8: "8 读动态变量分类",
  9: "9 读带状态的设备变量",
  11: "11 读标签 / 描述符 / 日期",
  12: "12 读设备消息",
  13: "13 读标签 / 描述符 / 日期",
  14: "14 读传感器信息",
  15: "15 读输出信息",
  16: "16 读最终装配号",
  17: "17 写设备消息",
  18: "18 写标签 / 描述符 / 日期",
  20: "20 读长标签",
  21: "21 读长标签关联的设备标识",
  22: "22 写长标签",
  33: "33 读变送器变量",
  34: "34 写阻尼值",
  35: "35 写主变量量程",
  36: "36 设置主变量上限",
  37: "37 设置主变量下限",
  38: "38 复位配置变更标志",
  39: "39 钳位主变量",
  40: "40 写 PV 传感器信息",
  41: "41 写轮询地址",
  43: "43 设置 PV 零点",
  44: "44 写环路电流模式",
  45: "45 写 PV 单位",
  46: "46 校准环路电流零点",
  47: "47 校准环路电流增益",
  48: "48 读附加设备状态",
  49: "49 写 PV 传感器序列号",
};

export function getHartCommandLabel(command) {
  return HART_COMMAND_LABELS[command] ?? `命令 ${command}`;
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
        `制造商 0x${device.manufacturer.toString(16).toUpperCase().padStart(2, "0")}`,
        `设备类型 0x${device.deviceType.toString(16).toUpperCase().padStart(2, "0")}`,
        `设备 ID 0x${device.deviceId.toString(16).padStart(6, "0").toUpperCase()}`,
        `HART 修订 ${device.hartRevision} · 前导码 ${device.minPreambleCount}`,
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

    const lines = [formatHartVariableLine("环路电流", variables.loopCurrent.value, "mA")];
    if (variables.percent) {
      lines.push(formatHartVariableLine("量程百分比", variables.percent.value, "%"));
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
      lines.unshift(formatHartVariableLine("环路电流", variables.loopCurrent.value, "mA"));
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
      summary: `轮询地址 ${pollingAddress} · 环路模式 ${loopMode}${statusSuffix}`,
      lines: [`轮询地址 ${pollingAddress}`, `环路电流模式 ${loopMode}`],
    };
  }

  if (command === 7 && data.length >= 2) {
    return {
      command,
      commandLabel: getHartCommandLabel(command),
      summary: `环路电流模式 ${data[0]} · 请求前导码 ${data[1]}${statusSuffix}`,
      lines: [`环路电流模式 ${data[0]}`, `请求前导码 ${data[1]}`],
    };
  }

  if (command === 8 && data.length >= 4) {
    const labels = ["PV", "SV", "TV", "QV"];
    const lines = labels.map((label, index) => `${label} 分类 ${data[index]}`);
    return {
      command,
      commandLabel: getHartCommandLabel(command),
      summary: `${lines.join(" · ")}${statusSuffix}`,
      lines,
    };
  }

  if (command === 12 && data.length > 0) {
    const message = decodeHartPackedAscii(data, 0, Math.min(24, data.length));
    return {
      command,
      commandLabel: getHartCommandLabel(command),
      summary: `${message || "(空消息)"}${statusSuffix}`,
      lines: [message || "(空消息)"],
    };
  }

  if ((command === 11 || command === 13) && data.length >= 21) {
    const tag = decodeHartPackedAscii(data, 0, 6);
    const descriptor = decodeHartPackedAscii(data, 6, 12);
    const date =
      data.length >= 21
        ? `${2000 + (data[20] & 0x7f)}/${data[19]}/${data[18]}`
        : "";
    const lines = [`标签 ${tag || "--"}`, `描述符 ${descriptor || "--"}`, date ? `日期 ${date}` : null].filter(Boolean);
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
      upper ? formatHartVariableLine("上限", upper.value, upper.unit) : null,
      lower ? formatHartVariableLine("下限", lower.value, lower.unit) : null,
      minSpan ? formatHartVariableLine("最小量程", minSpan.value, minSpan.unit) : null,
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
      `报警 ${data[0]} · 传递函数 ${data[1]}`,
      upper ? formatHartVariableLine("上限量程", upper.value, upper.unit) : null,
      lower ? formatHartVariableLine("下限量程", lower.value, lower.unit) : null,
      Number.isFinite(damping) ? formatHartVariableLine("阻尼", damping, "s") : null,
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
      summary: `装配号 0x${assembly.toString(16).toUpperCase().padStart(6, "0")}${statusSuffix}`,
      lines: [`装配号 0x${assembly.toString(16).toUpperCase().padStart(6, "0")}`],
    };
  }

  if (command === 20 && data.length > 0) {
    const longTag = decodeHartPackedAscii(data, 0, Math.min(32, data.length));
    return {
      command,
      commandLabel: getHartCommandLabel(command),
      summary: `${longTag || "(空长标签)"}${statusSuffix}`,
      lines: [longTag || "(空长标签)"],
    };
  }

  if (command === 48 && data.length > 0) {
    return {
      command,
      commandLabel: getHartCommandLabel(command),
      summary: `附加状态 ${formatHexBytes(data)}${statusSuffix}`,
      lines: [`附加状态 ${formatHexBytes(data)}`],
    };
  }

  if (data.length === 0) {
    return {
      command,
      commandLabel: getHartCommandLabel(command),
      summary: `命令 ${command} · 无数据${statusSuffix}`,
      lines: [`命令 ${command} · 无数据`],
    };
  }

  return {
    command,
    commandLabel: getHartCommandLabel(command),
    summary: `命令 ${command} · ${byteCount} 字节 · ${formatHexBytes(data)}${statusSuffix}`,
    lines: [`命令 ${command} · ${byteCount} 字节`, formatHexBytes(data)],
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
