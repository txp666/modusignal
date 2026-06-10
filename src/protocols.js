import { MODUSIGNAL_APP } from "./config.js";
import { AOMASTER_DEVICE_ID, AOMASTER_PROFILE, createAOMasterSetOutputCommand, parseAOMasterTelemetry } from "./devices/aomaster.js";
import {
  createCustomProfile,
  createCustomSetOutputCommand,
  CUSTOM_DEVICE_ID,
  DEFAULT_CUSTOM_CONFIG,
  normalizeCustomConfig,
  parseCustomTelemetry,
} from "./devices/custom-device.js";

const textEncoder = new TextEncoder();

export { CUSTOM_DEVICE_ID, DEFAULT_CUSTOM_CONFIG, MODUSIGNAL_APP, normalizeCustomConfig };

export const DEFAULT_DEVICE_ID = AOMASTER_DEVICE_ID;

export const DEVICE_PROFILES = {
  [AOMASTER_DEVICE_ID]: AOMASTER_PROFILE,
};

export function getDeviceProfile(deviceId = DEFAULT_DEVICE_ID, customConfig = DEFAULT_CUSTOM_CONFIG) {
  if (deviceId === CUSTOM_DEVICE_ID) {
    return createCustomProfile(customConfig);
  }

  return DEVICE_PROFILES[deviceId] ?? DEVICE_PROFILES[DEFAULT_DEVICE_ID];
}

export function getModeConfig(mode, deviceId = DEFAULT_DEVICE_ID, customConfig = DEFAULT_CUSTOM_CONFIG) {
  const profile = getDeviceProfile(deviceId, customConfig);
  return profile.modes[mode] ?? profile.modes.custom ?? profile.modes.current;
}

export function createDeviceSetOutputCommand(deviceId, state, customConfig = DEFAULT_CUSTOM_CONFIG) {
  if (deviceId === CUSTOM_DEVICE_ID) {
    return createCustomSetOutputCommand(state, customConfig, {
      bytesToHex,
      parseHexPayload,
      resolveLineEnding,
    });
  }

  if (deviceId === AOMASTER_DEVICE_ID) {
    return createAOMasterSetOutputCommand(state);
  }

  return {
    supported: false,
    preview: "未选择可发送的设备驱动",
    bytes: null,
  };
}

export function parseDeviceTelemetry(deviceId, text, customConfig = DEFAULT_CUSTOM_CONFIG) {
  if (deviceId === CUSTOM_DEVICE_ID) {
    return parseCustomTelemetry(text, customConfig, parseNumericTelemetry);
  }

  if (deviceId === AOMASTER_DEVICE_ID) {
    return parseAOMasterTelemetry(text, parseNumericTelemetry);
  }

  return null;
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

export function resolveLineEnding(value) {
  if (value === "\\n") {
    return "\n";
  }

  if (value === "\\r\\n") {
    return "\r\n";
  }

  return "";
}
