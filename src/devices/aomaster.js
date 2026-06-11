import {
  buildReadRegistersRequest,
  buildWriteMultipleRegistersRequest,
  extractRtuFrames,
} from "../modbus/modbus.js";

export const AOMASTER_DEVICE_ID = "aomaster";

export const AOMASTER_REGISTERS = {
  SIGNAL_TYPE: 0,
  WAVEFORM: 1,
  VALUE_A: 2,
  VALUE_B: 3,
  PERIOD_MS: 4,
  DUTY: 5,
  ACTUAL: 6,
  STEP_SEQUENCE_START: 7,
};

export const AOMASTER_MAX_STEP_SEQUENCE = 16;
const AOMASTER_PREVIEW_CYCLES = 10;

export const AOMASTER_MODES = {
  current: 0,
  voltage: 1,
  current020: 2,
  voltage05: 3,
  current024: 4,
  frequency: 5,
};

export const AOMASTER_WAVEFORMS = {
  constant: 0,
  step: 1,
  ramp: 2,
  square: 3,
  triangle: 4,
  sine: 5,
};

export const AOMASTER_WAVEFORM_OPTIONS = [
  { id: "constant", label: "恒定输出" },
  { id: "step", label: "阶跃" },
  { id: "ramp", label: "斜坡" },
  { id: "square", label: "方波" },
  { id: "triangle", label: "三角波" },
  { id: "sine", label: "正弦波" },
];

export const AOMASTER_SCALE = 1000;
export const AOMASTER_FREQUENCY_SCALE = 10;
export const AOMASTER_DEFAULT_BAUD_RATE = 115200;

/** AOMaster 常用串口参数：115200 8N1 */
export const AOMASTER_TRANSPORT_DEFAULTS = {
  baudRate: AOMASTER_DEFAULT_BAUD_RATE,
  parity: "none",
  dataBits: 8,
  stopBits: 1,
  flowControl: "none",
};

export const DEFAULT_AOMASTER_CONFIG = {
  slaveId: 1,
  pollIntervalMs: 50,
};

export const DEFAULT_AOMASTER_WAVE_STATE = {
  waveform: "constant",
  setpoint: 12,
  waveLow: 4,
  waveHigh: 20,
  wavePeriodMs: 1000,
  waveDuty: 50,
  stepSequence: [4, 8, 12, 16, 20],
  stepDwellMs: 500,
  stepLoops: 1,
};

let rxBuffer = new Uint8Array(0);

export const AOMASTER_PROFILE = {
  id: AOMASTER_DEVICE_ID,
  name: "AOMaster",
  type: "模拟量信号发生器",
  image: "./images/AOMaster.png",
  protocolStatus: "ready",
  modes: {
    current: {
      label: "4-20mA 电流",
      unit: "mA",
      min: 4,
      max: 20,
      step: 0.001,
      presets: { min: 4, mid: 12, max: 20 },
    },
    voltage: {
      label: "0-10V 电压",
      unit: "V",
      min: 0,
      max: 10,
      step: 0.001,
      presets: { min: 0, mid: 5, max: 10 },
    },
    current020: {
      label: "0-20mA 电流",
      unit: "mA",
      min: 0,
      max: 20,
      step: 0.001,
      presets: { min: 0, mid: 10, max: 20 },
    },
    voltage05: {
      label: "0-5V 电压",
      unit: "V",
      min: 0,
      max: 5,
      step: 0.001,
      presets: { min: 0, mid: 2.5, max: 5 },
    },
    current024: {
      label: "0-24mA 电流",
      unit: "mA",
      min: 0,
      max: 24,
      step: 0.001,
      presets: { min: 0, mid: 12, max: 24 },
    },
    frequency: {
      label: "频率输出",
      unit: "Hz",
      min: 0.1,
      max: 1000,
      step: 0.1,
      presets: { min: 0.1, mid: 100, max: 1000 },
    },
  },
};

export function resetAomasterRxBuffer() {
  rxBuffer = new Uint8Array(0);
}

export function normalizeAomasterConfig(config = {}) {
  const merged = {
    ...DEFAULT_AOMASTER_CONFIG,
    ...config,
  };

  return {
    slaveId: clamp(Math.trunc(toFiniteNumber(merged.slaveId, DEFAULT_AOMASTER_CONFIG.slaveId)), 1, 247),
    pollIntervalMs: Math.max(0, Math.trunc(toFiniteNumber(merged.pollIntervalMs, DEFAULT_AOMASTER_CONFIG.pollIntervalMs))),
  };
}

export function normalizeAomasterWaveState(state = {}, mode = "current") {
  const modeConfig = getAomasterModeConfig(mode);
  const merged = {
    ...DEFAULT_AOMASTER_WAVE_STATE,
    ...state,
    mode,
  };
  const waveform = AOMASTER_WAVEFORM_OPTIONS.some((item) => item.id === merged.waveform)
    ? merged.waveform
    : "constant";
  const safeWaveform = mode === "frequency" ? "constant" : waveform;
  const stepSequence = normalizeStepSequence(merged.stepSequence, mode);

  return {
    mode,
    waveform: safeWaveform,
    setpoint: clampWaveValue(mode, merged.setpoint, modeConfig.presets.mid),
    waveLow: clampWaveValue(mode, merged.waveLow, modeConfig.min),
    waveHigh: clampWaveValue(mode, merged.waveHigh, modeConfig.max),
    wavePeriodMs: clamp(Math.trunc(toFiniteNumber(merged.wavePeriodMs, DEFAULT_AOMASTER_WAVE_STATE.wavePeriodMs)), 1, 65535),
    waveDuty: clamp(toFiniteNumber(merged.waveDuty, DEFAULT_AOMASTER_WAVE_STATE.waveDuty), 1, 99),
    stepSequence,
    stepDwellMs: clamp(Math.trunc(toFiniteNumber(merged.stepDwellMs, DEFAULT_AOMASTER_WAVE_STATE.stepDwellMs)), 1, 65535),
    stepLoops: clamp(Math.trunc(toFiniteNumber(merged.stepLoops, DEFAULT_AOMASTER_WAVE_STATE.stepLoops)), 0, 65535),
  };
}

export function buildDefaultStepSequence(mode) {
  const config = getAomasterModeConfig(mode);
  const span = (config.max - config.min) / 4;
  return [0, 1, 2, 3, 4].map((index) =>
    roundToStep(config.min + span * index, config.step, config.min, config.max),
  );
}

export function normalizeStepSequence(sequence, mode) {
  const config = getAomasterModeConfig(mode);
  const source = Array.isArray(sequence) ? sequence : DEFAULT_AOMASTER_WAVE_STATE.stepSequence;
  const normalized = source
    .slice(0, AOMASTER_MAX_STEP_SEQUENCE)
    .map((value) => clampWaveValue(mode, value, config.presets.mid));

  while (normalized.length < 2) {
    normalized.push(config.presets.mid);
  }

  return normalized;
}

export function formatStepSequence(mode, sequence) {
  return sequence.map((value) => formatSetpoint(mode, value)).join(" → ");
}

export function getAomasterModeConfig(mode) {
  return AOMASTER_PROFILE.modes[mode] ?? AOMASTER_PROFILE.modes.current;
}

export function getAomasterModeCode(mode) {
  return AOMASTER_MODES[mode] ?? AOMASTER_MODES.current;
}

export function getAomasterWaveformCode(waveform) {
  return AOMASTER_WAVEFORMS[waveform] ?? AOMASTER_WAVEFORMS.constant;
}

export function getAomasterWaveformLabel(waveform) {
  return AOMASTER_WAVEFORM_OPTIONS.find((item) => item.id === waveform)?.label ?? "恒定输出";
}

export function encodeAomasterValue(mode, value) {
  if (mode === "frequency") {
    return clampUint16(Math.round(value * AOMASTER_FREQUENCY_SCALE));
  }

  return clampUint16(Math.round(value * AOMASTER_SCALE));
}

export function decodeAomasterValue(mode, rawValue) {
  if (mode === "frequency") {
    return rawValue / AOMASTER_FREQUENCY_SCALE;
  }

  return rawValue / AOMASTER_SCALE;
}

export function describeAomasterSummary(config) {
  const normalized = normalizeAomasterConfig(config);
  if (normalized.pollIntervalMs <= 0) {
    return `Modbus RTU 从站 ${normalized.slaveId}，默认不轮询`;
  }

  return `Modbus RTU 从站 ${normalized.slaveId}，轮询间隔 ${normalized.pollIntervalMs} ms`;
}

export function describeAomasterOutput(state) {
  const waveState = normalizeAomasterWaveState(state, state.mode);
  const modeConfig = getAomasterModeConfig(waveState.mode);

  if (waveState.waveform === "constant") {
    return `${modeConfig.label} ${formatSetpoint(waveState.mode, waveState.setpoint)} ${modeConfig.unit}`;
  }

  if (waveState.waveform === "step") {
    const loopLabel = waveState.stepLoops === 0 ? "无限循环" : `${waveState.stepLoops} 次`;
    return `阶跃序列 ${formatStepSequence(waveState.mode, waveState.stepSequence)} ${modeConfig.unit}，${waveState.stepDwellMs} ms/步，${loopLabel}`;
  }

  return `${getAomasterWaveformLabel(waveState.waveform)} ${formatSetpoint(waveState.mode, waveState.waveLow)}~${formatSetpoint(waveState.mode, waveState.waveHigh)} ${modeConfig.unit}，${waveState.wavePeriodMs} ms`;
}

export function buildAomasterRegisterValues(state) {
  const waveState = normalizeAomasterWaveState(state, state.mode);
  const modeCode = getAomasterModeCode(waveState.mode);

  if (waveState.waveform === "constant") {
    const setpoint = encodeAomasterValue(waveState.mode, waveState.setpoint);
    return [modeCode, AOMASTER_WAVEFORMS.constant, setpoint, setpoint, 0, 0];
  }

  if (waveState.waveform === "step") {
    return [
      modeCode,
      AOMASTER_WAVEFORMS.step,
      clampUint16(waveState.stepSequence.length),
      clampUint16(waveState.stepDwellMs),
      clampUint16(waveState.stepLoops),
      0,
    ];
  }

  return [
    modeCode,
    getAomasterWaveformCode(waveState.waveform),
    encodeAomasterValue(waveState.mode, waveState.waveLow),
    encodeAomasterValue(waveState.mode, waveState.waveHigh),
    clampUint16(waveState.wavePeriodMs),
    clampUint16(Math.round(waveState.waveDuty * 10)),
  ];
}

export function buildAomasterStepSequenceRegisterValues(state) {
  const waveState = normalizeAomasterWaveState(state, state.mode);
  if (waveState.waveform !== "step") {
    return [];
  }

  return waveState.stepSequence.map((value) => encodeAomasterValue(waveState.mode, value));
}

export function buildAomasterWriteFrames(state, slaveId) {
  const waveState = normalizeAomasterWaveState(state, state.mode);
  const header = buildWriteMultipleRegistersRequest(
    slaveId,
    AOMASTER_REGISTERS.SIGNAL_TYPE,
    buildAomasterRegisterValues(waveState),
  );

  if (waveState.waveform !== "step") {
    return [header];
  }

  const sequenceValues = buildAomasterStepSequenceRegisterValues(waveState);
  if (sequenceValues.length === 0) {
    return [header];
  }

  return [
    header,
    buildWriteMultipleRegistersRequest(
      slaveId,
      AOMASTER_REGISTERS.STEP_SEQUENCE_START,
      sequenceValues,
    ),
  ];
}

export function createAOMasterSetOutputCommand(state, config, helpers) {
  const normalized = normalizeAomasterConfig(config);
  const waveState = normalizeAomasterWaveState(state, state.mode);
  const frames = buildAomasterWriteFrames(waveState, normalized.slaveId);
  const preview = frames.map((frame) => helpers.bytesToHex(frame)).join("  |  ");

  return {
    supported: true,
    preview: `${preview}  →  ${describeAomasterOutput(waveState)}`,
    bytes: frames[0] ?? null,
    frames,
  };
}

export function createAOMasterReadCommand(config) {
  const normalized = normalizeAomasterConfig(config);
  return buildReadRegistersRequest(normalized.slaveId, 3, AOMASTER_REGISTERS.ACTUAL, 1);
}

export function parseAOMasterTelemetry(bytes, config, mode = "current") {
  if (!bytes || bytes.length === 0) {
    return null;
  }

  const normalized = normalizeAomasterConfig(config);
  const modeConfig = getAomasterModeConfig(mode);
  rxBuffer = concatBytes(rxBuffer, bytes);
  const { frames, remaining } = extractRtuFrames(rxBuffer);
  rxBuffer = remaining;

  for (const frame of frames) {
    if (frame[0] !== normalized.slaveId || frame[1] !== 3 || frame[1] & 0x80) {
      continue;
    }

    if (frame.length < 7 || frame[2] !== 2) {
      continue;
    }

    const rawValue = (frame[3] << 8) | frame[4];
    const value = decodeAomasterValue(mode, rawValue);

    return {
      fieldName: "实际输出",
      unit: modeConfig.unit,
      value,
      rawValue,
    };
  }

  return null;
}

export function generateWaveformPreview(state, pointCount = 120) {
  const waveState = normalizeAomasterWaveState(state, state.mode);

  if (waveState.waveform === "constant") {
    return Array.from({ length: pointCount }, () => waveState.setpoint);
  }

  if (waveState.waveform === "step") {
    return generateStepSequencePreview(waveState, pointCount);
  }

  const low = Math.min(waveState.waveLow, waveState.waveHigh);
  const high = Math.max(waveState.waveLow, waveState.waveHigh);
  const periodMs = waveState.wavePeriodMs;
  const duty = waveState.waveDuty / 100;
  const totalMs = getAomasterPreviewDurationMs(waveState);

  return Array.from({ length: pointCount }, (_, index) => {
    const t = (index / Math.max(pointCount - 1, 1)) * totalMs;
    return evaluateWaveform(waveState.waveform, t, low, high, periodMs, duty);
  });
}

function getAomasterPreviewDurationMs(waveState) {
  if (waveState.waveform === "step") {
    const previewLoops = waveState.stepLoops === 0 ? AOMASTER_PREVIEW_CYCLES : waveState.stepLoops;
    return waveState.stepSequence.length * waveState.stepDwellMs * previewLoops;
  }

  return waveState.wavePeriodMs * AOMASTER_PREVIEW_CYCLES;
}

function generateStepSequencePreview(waveState, pointCount) {
  const sequence = waveState.stepSequence;
  const dwellMs = waveState.stepDwellMs;
  const previewLoops = waveState.stepLoops === 0 ? AOMASTER_PREVIEW_CYCLES : waveState.stepLoops;
  const totalMs = getAomasterPreviewDurationMs(waveState);

  return Array.from({ length: pointCount }, (_, index) => {
    const timeMs = (index / Math.max(pointCount - 1, 1)) * totalMs;
    const stepIndex = Math.min(Math.floor(timeMs / dwellMs), sequence.length * previewLoops - 1) % sequence.length;
    return sequence[stepIndex];
  });
}

export function formatSetpoint(mode, value) {
  const config = getAomasterModeConfig(mode);
  const decimals = mode === "frequency" ? 1 : decimalPlaces(config.step);
  return Number(value).toFixed(decimals);
}

function evaluateWaveform(type, timeMs, low, high, periodMs, duty) {
  switch (type) {
    case "ramp":
      return low + ((high - low) * (timeMs % periodMs)) / periodMs;
    case "square": {
      const phase = timeMs % periodMs;
      return phase < periodMs * duty ? high : low;
    }
    case "triangle": {
      const phase = timeMs % periodMs;
      const half = periodMs / 2;
      if (phase <= half) {
        return low + ((high - low) * phase) / half;
      }
      return high - ((high - low) * (phase - half)) / half;
    }
    case "sine": {
      const phase = timeMs % periodMs;
      const angle = (phase / periodMs) * Math.PI * 2;
      const mid = (low + high) / 2;
      const amplitude = (high - low) / 2;
      return mid + amplitude * Math.sin(angle);
    }
    default:
      return low;
  }
}

function clampWaveValue(mode, value, fallback) {
  const config = getAomasterModeConfig(mode);
  return clamp(toFiniteNumber(value, fallback), config.min, config.max);
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

function clampUint16(value) {
  return clamp(Math.trunc(Number(value)), 0, 65535);
}

function decimalPlaces(step) {
  const text = String(step);
  return Math.min(6, Math.max(0, text.includes(".") ? text.split(".")[1].length : 0));
}

function roundToStep(value, step, min, max) {
  const precision = decimalPlaces(step);
  const rounded = Math.round(value / step) * step;
  return clamp(Number(rounded.toFixed(precision)), min, max);
}
