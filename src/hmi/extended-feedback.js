// Models for feedback that is not a single floating-point gauge reading. No DOM.
import { isNumber, numberOf, toReal } from "./py-values.js";

export const BIT_PROFILE_TYPES = new Set(["StatusWordPanel", "DigitalTimingChart"]);
export const EXTENDED_FEEDBACK_TYPES = new Set([...BIT_PROFILE_TYPES, "RotaryEncoder", "BmsCellMatrix", "DcPowerSupply"]);
export const DEFAULT_BIT_COLOR = "#228866";
const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

export function bitProfileName(widget) {
  const name = widget.properties?.bitProfile;
  return typeof name === "string" && name.trim() ? name.trim() : "default";
}
export function normalizeBitProfile(value) {
  const width = value?.width === 16 ? 16 : 8;
  const bits = Array.from({ length: width }, (_, index) => {
    const bit = value?.bits?.[index];
    return {
      name: typeof bit?.name === "string" ? bit.name : `B${index}`,
      color: typeof bit?.color === "string" && /^#[0-9a-f]{6}$/i.test(bit.color) ? bit.color : DEFAULT_BIT_COLOR,
    };
  });
  return { width, bits };
}
export function getBitProfile(project = {}, name = "default") {
  return normalizeBitProfile(Object.hasOwn(project.bitProfiles ?? {}, name) ? project.bitProfiles[name] : null);
}
export function setBitProfile(project, name, profile) {
  project.bitProfiles = { ...(object(project.bitProfiles) ? project.bitProfiles : {}), [name]: normalizeBitProfile(profile) };
}
export function renameBitProfile(project, before, after) {
  after = after.trim();
  if (!after.trim() || before === after || Object.hasOwn(project.bitProfiles ?? {}, after)) return false;
  const profiles = { ...(object(project.bitProfiles) ? project.bitProfiles : {}), [after]: getBitProfile(project, before) };
  delete profiles[before];
  project.bitProfiles = profiles;
  function visit(list) {
    for (const widget of list ?? []) {
      if (BIT_PROFILE_TYPES.has(widget.type) && bitProfileName(widget) === before) {
        widget.properties ??= {}; widget.properties.bitProfile = after;
      }
      if (Array.isArray(widget.children)) visit(widget.children);
    }
  }
  visit(project.widgets);
  return true;
}
const numeric = (value) => isNumber(value) && Number.isFinite(numberOf(value)) ? numberOf(value) : null;
export function extendedFeedbackValue(type, raw, properties = {}, project = {}) {
  if (type === "BmsCellMatrix") {
    if (!Array.isArray(raw) || !raw.length) return null;
    const values = raw.map(numeric);
    return values.some((value) => value === null) ? null : values;
  }
  if (type === "DcPowerSupply") {
    const mode = typeof raw?.mode === "string" ? raw.mode.trim().toUpperCase() : "";
    if (!object(raw) || !["CV", "CC"].includes(mode)) return null;
    const voltage = numeric(raw.voltage), current = numeric(raw.current);
    return voltage === null || current === null ? null : { voltage, current, mode };
  }
  if (type === "RotaryEncoder" && !isNumber(raw)) return null;
  const value = toReal(raw);
  if (!Number.isSafeInteger(value)) return null;
  if (BIT_PROFILE_TYPES.has(type)) {
    const profile = getBitProfile(project, bitProfileName({ properties }));
    return value >= 0 && value < 2 ** profile.width ? value : null;
  }
  return type === "RotaryEncoder" ? value : null;
}
export function encoderPulses(properties = {}) {
  return Number.isSafeInteger(properties.pulsesPerTurn) && properties.pulsesPerTurn > 0 ? properties.pulsesPerTurn : 1024;
}

/** Owned by a runtime, never by a view. Only an actual extracted observation calls observe. */
export function createExtendedFeedbackState(type, properties = {}) {
  let state = "waiting", value = null, previous = null, direction = "unknown";
  const samples = [];
  return {
    observe(next, nextState) {
      state = nextState;
      value = nextState === "ready" ? next : null;
      if (type === "DigitalTimingChart") {
        samples.push(value); if (samples.length > 32) samples.shift();
      }
      if (type === "RotaryEncoder") {
        direction = value === null || previous === null ? "unknown" : value > previous ? "forward" : value < previous ? "reverse" : "stopped";
        previous = value;
      }
    },
    snapshot() {
      const pulseCount = encoderPulses(properties);
      return { state, value, direction, samples: [...samples], angle: value === null || type !== "RotaryEncoder" ? 0 : ((value % pulseCount) + pulseCount) % pulseCount / pulseCount * 360 };
    },
  };
}

export const escapeSvgText = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[char]);
