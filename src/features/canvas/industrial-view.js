import { EXTENDED_FEEDBACK_TYPES } from "../../hmi/extended-feedback.js";
import { extendedIndustrialView } from "./extended-industrial-view.js";
import i18n from "../../i18n.js";
import { INDUSTRIAL_CATALOG, industrialDrivers, industrialMotionRate, industrialMoving, industrialValue, renderIndustrialSvg } from "../../hmi/industrial.js";
import { propValue } from "../../hmi/uidp.js";
import { toReal } from "../../hmi/py-values.js";

/** Each view owns its animation; only visible, moving, live equipment requests frames. */
export function industrialView(widget, ctx) {
  if (EXTENDED_FEEDBACK_TYPES.has(widget.type)) return extendedIndustrialView(widget, ctx);
  const item = INDUSTRIAL_CATALOG.get(widget.type);
  const root = document.createElement("div");
  root.className = "hmi-widget hmi-industrial";
  root.dataset.widgetId = widget.id ?? "";
  root.dataset.type = widget.type;
  const title = document.createElement("div");
  title.className = "hmi-industrial-title";
  const storedTitle = String(propValue(widget, "title") ?? "");
  title.textContent = storedTitle === item.name ? i18n(`hmi.widget.${item.type}`) : storedTitle;
  const graphic = document.createElement("div");
  graphic.className = "hmi-industrial-graphic";
  graphic.setAttribute("aria-hidden", "true");
  const reading = document.createElement("div");
  reading.className = "hmi-industrial-reading";
  reading.setAttribute("role", "status");
  root.append(title, graphic, reading);
  // The digital pressure face already contains the number and unit. Keep one full,
  // accessible status, with only waiting/error/alarm hints visible below the face.
  let pressureHint = null;
  if (item.type === "PressureGauge") {
    reading.className = "visually-hidden";
    pressureHint = document.createElement("div");
    pressureHint.className = "hmi-industrial-reading";
    pressureHint.setAttribute("aria-hidden", "true");
    root.append(pressureHint);
  }
  const finite = (name, fallback) => { const v = toReal(propValue(widget, name)); return v !== null && Number.isFinite(v) ? v : fallback; };
  const options = { ...(widget.properties ?? {}), minimum: finite("minimum", item.minimum), maximum: finite("maximum", item.maximum), decimals: finite("decimals", item.decimals), unit: String(propValue(widget, "unit") ?? "") };
  let value = ctx.mode === "run" ? null : industrialValue(item, propValue(widget, "value"), options);
  let state = ctx.mode === "run" ? "waiting" : value === null ? "invalid" : "ready";
  let phase = 0;
  let frame = null;
  let last = null;
  let visible = false;
  let destroyed = false;
  const motionAllowed = () => !destroyed && ctx.mode === "run" && state === "ready" && visible && document.visibilityState !== "hidden" && !reduced.matches && industrialMoving(item, value, options);
  function paint() {
    const dark = document.documentElement.dataset.theme === "dark";
    graphic.innerHTML = renderIndustrialSvg(item, { ...options, value: state === "ready" ? value : null, phase, dark });
    root.dataset.state = state;
    let text;
    let limitHint = "";
    if (state !== "ready") text = i18n(`hmi.industrial.${state}`);
    else if (item.type === "Motor" && options.feedbackMode === "运行位") text = i18n(value ? "hmi.industrial.running" : "hmi.industrial.stopped");
    else if (item.type === "Cylinder" && options.feedbackMode === "端位状态") text = i18n(["hmi.industrial.between", "hmi.industrial.retracted", "hmi.industrial.extended"][value]);
    else if (item.mode === "flags") {
      const english = i18n.current() === "en";
      const labels = english ? item.flagsEn : item.flags;
      text = value === 0 ? (english ? item.clearLabelEn : item.clearLabel) : labels.filter((_, bit) => (value & (1 << bit)) !== 0).join(english ? ", " : "、");
    }
    else if (item.mode === "byte") text = `0x${value.toString(16).toUpperCase().padStart(2, "0")}`;
    else if (item.mode === "state" || item.mode === "bits") text = (i18n.current() === "en" ? item.statesEn : item.states)[value];
    else text = `${item.type === "PowerMeter" && value === 0 ? "0" : value.toFixed(Math.max(0, Math.min(6, options.decimals)))}${options.unit ? ` ${options.unit}` : ""}`;
    if (state === "ready") {
      const directional = ["FlowMeter", "FlowPipe", "Tachometer", "Motor", "Mixer", "BeltConveyor", "ScrewConveyor"];
      if (directional.includes(item.type) && !(item.type === "Motor" && options.feedbackMode === "运行位")) {
        text += ` · ${i18n(value > 0 ? "hmi.industrial.forward" : value < 0 ? "hmi.industrial.reverse" : ["FlowMeter", "FlowPipe"].includes(item.type) ? "hmi.industrial.zeroFlow" : "hmi.industrial.stopped")}`;
      }
      if (item.type === "PowerMeter" && value !== 0) text += ` · ${i18n(value < 0 ? "hmi.industrial.output" : "hmi.industrial.input")}`;
      const drivers = industrialDrivers(item, value, options.minimum, options.maximum, phase, options);
      if (drivers.lowAlarm) limitHint = i18n("hmi.industrial.lowAlarm");
      else if (drivers.highAlarm) limitHint = i18n("hmi.industrial.highAlarm");
      if (limitHint) text += ` · ${limitHint}`;
    }
    if (pressureHint) {
      const hint = state === "ready" ? limitHint : text;
      if (pressureHint.textContent !== hint) pressureHint.textContent = hint;
      graphic.title = text;
      pressureHint.title = text;
    }
    // Motion must not repeatedly announce an unchanged reading to screen readers.
    if (reading.textContent !== text) {
      reading.textContent = text;
      reading.title = text;
      root.setAttribute("aria-label", `${title.textContent}: ${text}`);
    }
  }
  function animate(time) {
    frame = null;
    if (!motionAllowed()) { last = null; return; }
    if (last !== null) {
      phase = (phase + industrialMotionRate(item, value, options) * Math.min(100, time - last) / 1000 + 1) % 1;
    }
    last = time;
    paint();
    frame = requestAnimationFrame(animate);
  }
  function sync() {
    if (motionAllowed()) { if (frame === null) frame = requestAnimationFrame(animate); }
    else { if (frame !== null) cancelAnimationFrame(frame); frame = null; last = null; }
  }
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  reduced.addEventListener("change", sync);
  const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); });
  observer.observe(root);
  const theme = new MutationObserver(() => paint());
  theme.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  document.addEventListener("visibilitychange", sync);
  paint();
  return {
    el: root, body: root,
    setValue(raw) { value = industrialValue(item, raw, options); state = value === null ? "invalid" : "ready"; paint(); sync(); },
    setBindingState(next) { if (next !== "ready") { state = next; paint(); sync(); } },
    resize() { paint(); },
    destroy() { destroyed = true; sync(); observer.disconnect(); theme.disconnect(); reduced.removeEventListener("change", sync); document.removeEventListener("visibilitychange", sync); },
  };
}
