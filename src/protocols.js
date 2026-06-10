const textEncoder = new TextEncoder();

export const AOMASTER_PROFILE = {
  id: "aomaster",
  name: "AOMaster",
  protocolStatus: "pending",
  modes: {
    current: {
      label: "电流设定",
      unit: "mA",
      min: 4,
      max: 20,
      step: 0.001,
      presets: {
        min: 4,
        mid: 12,
        max: 20,
      },
    },
    voltage: {
      label: "电压设定",
      unit: "V",
      min: 0,
      max: 10,
      step: 0.001,
      presets: {
        min: 0,
        mid: 5,
        max: 10,
      },
    },
  },
};

export function getModeConfig(mode) {
  return AOMASTER_PROFILE.modes[mode] ?? AOMASTER_PROFILE.modes.current;
}

export function createAOMasterSetOutputCommand() {
  return {
    supported: false,
    preview: "等待协议定义",
    bytes: null,
  };
}

export function parseNumericTelemetry(text) {
  const normalized = text.replace(/,/g, " ");
  const matches = normalized.match(/[+-]?(?:\d+\.?\d*|\.\d+)/g);

  if (!matches || matches.length === 0) {
    return null;
  }

  const value = Number(matches[matches.length - 1]);
  return Number.isFinite(value) ? value : null;
}

export function buildManualPayload(format, command, lineEnding) {
  if (format === "hex") {
    return parseHexPayload(command);
  }

  return textEncoder.encode(`${command}${lineEnding}`);
}

export function parseHexPayload(input) {
  const tokens = input
    .trim()
    .replace(/0x/gi, "")
    .split(/[\s,;:-]+/)
    .filter(Boolean);

  if (tokens.length === 0) {
    throw new Error("HEX 命令不能为空");
  }

  const bytes = tokens.map((token) => {
    if (!/^[0-9a-fA-F]{1,2}$/.test(token)) {
      throw new Error(`HEX 字节无效：${token}`);
    }

    return Number.parseInt(token, 16);
  });

  return new Uint8Array(bytes);
}

export function bytesToHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0").toUpperCase()).join(" ");
}
