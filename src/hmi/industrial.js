import { EXTENDED_FEEDBACK_TYPES, createExtendedFeedbackState, extendedFeedbackValue, escapeSvgText } from "./extended-feedback.js";
import { renderExtendedSvg } from "./extended-svg.js";
// Pure SVG template evaluation shared by palette previews and live industrial views.
import catalog from "./industrial-catalog.js";
import { toReal } from "./py-values.js";

export const INDUSTRIAL_CATALOG = new Map(catalog.map((item) => [item.type, item]));
export const INDUSTRIAL_THEMES = {
  light: { ink: "#172b3a", edge: "#526b80", muted: "#7c91a3", body: "#d7e3eb", surface: "#f5f9fc", accent: "#1687c9", liquid: "#26a9d7", warm: "#ef942e", danger: "#da4d56", green: "#269c68", yellow: "#d9aa21", grain: "#cba66b" },
  dark: { ink: "#e1edf5", edge: "#9ab4c8", muted: "#748da1", body: "#31495e", surface: "#1c2d3c", accent: "#4db8ef", liquid: "#43c5ed", warm: "#ffb456", danger: "#ff7882", green: "#54d49a", yellow: "#f3cf58", grain: "#dabe83" },
};
const clamp = (value) => Math.max(0, Math.min(1, value));
const flag = (value) => value === true || value === "true" || value === 1;
export const xmlText = escapeSvgText;

export function industrialValue(item, raw, options = {}) {
  if (EXTENDED_FEEDBACK_TYPES.has(item.type)) return extendedFeedbackValue(item.type, raw, options, options.project);
  const value = toReal(raw);
  if (value === null || !Number.isFinite(value)) return null;
  if (item.type === "Motor" && options.feedbackMode === "运行位") return value === 0 || value === 1 ? value : null;
  if (item.type === "Cylinder" && options.feedbackMode === "端位状态") return [0, 1, 2].includes(value) ? value : null;
  if (item.mode === "state" && (!Number.isInteger(value) || value < 0 || value >= item.states.length)) return null;
  if (["bits", "byte", "flags"].includes(item.mode) && (!Number.isInteger(value) || value < 0 || value > (item.mode === "bits" ? 7 : item.maximum))) return null;
  return value;
}

export function industrialDrivers(item, value, minimum, maximum, phase = 0, options = {}) {
  value = industrialValue(item, value, options);
  const known = value !== null;
  const low = toReal(options.lowLimit ?? item.limits?.[0]);
  const high = toReal(options.highLimit ?? item.limits?.[1]);
  const limitsOn = Boolean(item.limits && flag(options.showLimits ?? item.limitsOn) && Number.isFinite(low) && Number.isFinite(high) && low < high && maximum > minimum);
  const drivers = {
    phase, known: Number(known), level: 0, meniscus: 0, partial: 0, magnitude: 0, active: 0, positive: 0, negative: 0, zero: 0,
    limitsOn: Number(limitsOn),
    lowMark: limitsOn ? clamp((low - minimum) / (maximum - minimum)) : 0,
    highMark: limitsOn ? clamp((high - minimum) / (maximum - minimum)) : 0,
    lowAlarm: Number(known && limitsOn && value <= low), highAlarm: Number(known && limitsOn && value >= high),
    straight: Number(options.pipeShape === "直管"), elbow: Number(options.pipeShape !== "直管"), mirrored: Number(options.pipeDirection === "镜像布局"),
    thickness: clamp(((toReal(options.pipeWidth) ?? 16) - 8) / 18), pistonKnown: 0,
  };
  for (let n = 0; n < 8; n += 1) drivers[`state${n}`] = Number(known && value === n);
  for (let n = 0; n < 8; n += 1) drivers[`bit${n}`] = known ? ((value >> n) & 1) : 0;
  if (known) {
    drivers.level = maximum > minimum ? clamp((value - minimum) / (maximum - minimum)) : 0;
    drivers.meniscus = Math.min(1, 8 * drivers.level);
    const magnitudeRange = Math.max(Math.abs(minimum), Math.abs(maximum));
    drivers.magnitude = magnitudeRange ? clamp(Math.abs(value) / magnitudeRange) : 0;
    drivers.active = Number(item.type === "Pump" ? value === 1 : item.type === "AirCompressor" ? value === 1 || value === 3 : value !== 0);
    drivers.positive = Number(value > 0);
    drivers.negative = Number(value < 0);
    drivers.zero = Number(value === 0);
    drivers.pistonKnown = 1;
    if (item.type === "Cylinder" && options.feedbackMode === "端位状态") {
      drivers.pistonKnown = Number(value === 1 || value === 2);
      drivers.level = value === 2 ? 1 : 0;
    }
  }
  drivers.partial = Number(known && drivers.level > 0 && drivers.level < 1);
  for (let n = 1; n <= 12; n += 1) drivers[`seg${n}`] = Number(known && drivers.level >= n / 12);
  return drivers;
}

export function renderIndustrialSvg(item, options = {}) {
  if (EXTENDED_FEEDBACK_TYPES.has(item.type)) {
    const model = createExtendedFeedbackState(item.type, options);
    const value = extendedFeedbackValue(item.type, options.value ?? item.value, options, options.project);
    model.observe(value, value === null ? "invalid" : "ready");
    const snapshot = model.snapshot(); snapshot.samples = item.type === "DigitalTimingChart" && value !== null ? [value] : [];
    return renderExtendedSvg(item, snapshot, options, options.project, INDUSTRIAL_THEMES[options.dark ? "dark" : "light"]);
  }
  const { value = item.value, minimum = item.minimum, maximum = item.maximum, decimals = item.decimals, unit = item.unit, phase = 0, dark = false } = options;
  const valid = industrialValue(item, value, options);
  const drivers = industrialDrivers(item, valid, minimum, maximum, phase, options);
  const concise = (number) => xmlText(Number(Number(number).toPrecision(6)));
  const tokens = { ...INDUSTRIAL_THEMES[dark ? "dark" : "light"], degrees: valid ?? 0, reading: valid === null ? "—" : item.mode === "byte" ? `0x${valid.toString(16).toUpperCase().padStart(2, "0")}` : valid.toFixed(Math.max(0, Math.min(6, Number(decimals) || 0))), unit: xmlText(unit), minLabel: concise(minimum), maxLabel: concise(maximum) };
  if (item.type === "PressureGauge") tokens.readingSize = Math.min(28, 180 / tokens.reading.length);
  for (const [name, [driver, from, to]] of Object.entries(item.slots)) tokens[name] = from + (to - from) * (drivers[driver] ?? 0);
  return item.svg.replace(/\{\{(\w+)\}\}/g, (_, token) => String(tokens[token] ?? ""));
}

/** Signed turns per second, shared by the motion gate and phase integrator. */
export function industrialMotionRate(item, value, options = {}) {
  value = industrialValue(item, value, options);
  if (value === null || value === 0 || item.motion === "none") return 0;
  if (item.type === "Motor" && options.feedbackMode === "运行位") return value === 1 ? 0.55 : 0;
  if (item.motion === "compressor") return value === 1 ? 0.55 : value === 3 ? 0.3 : 0;
  if (item.motion === "run") return value === 1 ? 0.55 : 0;
  const minimum = options.minimum ?? item.minimum, maximum = options.maximum ?? item.maximum;
  const range = Math.max(Math.abs(minimum), Math.abs(maximum));
  const magnitude = range ? clamp(Math.abs(value) / range) : 0;
  return Math.sign(value) * (0.15 + 0.75 * magnitude);
}

export function industrialMoving(item, value, options = {}) {
  return industrialMotionRate(item, value, options) !== 0;
}
