import i18n from "../../i18n.js";
import { INDUSTRIAL_CATALOG, INDUSTRIAL_THEMES } from "../../hmi/industrial.js";
import { BIT_PROFILE_TYPES, bitProfileName, getBitProfile, createExtendedFeedbackState, extendedFeedbackValue, encoderPulses } from "../../hmi/extended-feedback.js";
import { renderExtendedSvg } from "../../hmi/extended-svg.js";

export function extendedIndustrialView(widget, ctx) {
  const item = INDUSTRIAL_CATALOG.get(widget.type), properties = widget.properties ?? {}, project = ctx.project ?? {};
  const el = document.createElement("div"); el.className = "hmi-widget hmi-industrial"; el.dataset.type = widget.type; el.dataset.widgetId = widget.id ?? "";
  const title = document.createElement("div"); title.className = "hmi-industrial-title";
  title.textContent = properties.title && properties.title !== item.name ? properties.title : i18n(`hmi.widget.${item.type}`, item.name);
  const graphic = document.createElement("div"); graphic.className = "hmi-industrial-graphic"; graphic.setAttribute("aria-hidden", "true");
  const reading = document.createElement("div"); reading.className = "hmi-industrial-reading"; reading.setAttribute("role", "status");
  el.append(title, graphic, reading);
  const own = createExtendedFeedbackState(widget.type, properties);
  const initial = extendedFeedbackValue(widget.type, properties.value ?? item.value, properties, project);
  const design = { state: initial === null ? "invalid" : "ready", value: initial, samples: widget.type === "DigitalTimingChart" && initial !== null ? [initial] : [], direction: "unknown", angle: widget.type === "RotaryEncoder" && initial !== null ? ((initial % encoderPulses(properties)) + encoderPulses(properties)) % encoderPulses(properties) / encoderPulses(properties) * 360 : 0 };
  const snapshot = () => ctx.mode === "run" ? ctx.runtime?.feedbackState?.(widget.id) ?? own.snapshot() : design;
  function paint() {
    const current = snapshot(), value = current.value;
    el.dataset.state = current.state;
    graphic.innerHTML = renderExtendedSvg(item, current, properties, project, INDUSTRIAL_THEMES[document.documentElement.dataset.theme === "dark" ? "dark" : "light"]);
    let text;
    if (current.state !== "ready") text = i18n(`hmi.industrial.${current.state}`);
    else if (BIT_PROFILE_TYPES.has(widget.type)) {
      const profile = getBitProfile(project, bitProfileName(widget));
      text = `0x${value.toString(16).toUpperCase().padStart(profile.width / 4, "0")}`;
      if (widget.type === "DigitalTimingChart") text += ` · ${current.samples.length}/32`;
      else text += ` · ${profile.bits.filter((_, bit) => (value & (1 << bit)) !== 0).map((bit) => bit.name).join(i18n.current() === "en" ? ", " : "、")}`;
    } else if (widget.type === "RotaryEncoder") text = `${value} · ${(value / encoderPulses(properties)).toFixed(3)} ${i18n("hmi.extended.turns")} · ${i18n(current.direction === "unknown" ? "hmi.extended.unknown" : `hmi.industrial.${current.direction}`)}`;
    else if (widget.type === "DcPowerSupply") text = `${value.mode} · ${value.voltage.toFixed(2)} V · ${value.current.toFixed(3)} A`;
    else {
      const low = value.reduce((a, b) => Math.min(a, b)), high = value.reduce((a, b) => Math.max(a, b));
      text = `${i18n("hmi.extended.minCell")} C${value.indexOf(low) + 1} ${low.toFixed(3)} V · ${i18n("hmi.extended.maxCell")} C${value.indexOf(high) + 1} ${high.toFixed(3)} V · Δ ${((high - low) * 1000).toFixed(1)} mV`;
    }
    graphic.title = text;
    if (reading.textContent !== text) { reading.textContent = text; reading.title = text; el.setAttribute("aria-label", `${title.textContent}: ${text}`); }
  }
  const theme = new MutationObserver(paint); theme.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  paint();
  return { el, body: el,
    setValue(raw) {
      if (!ctx.runtime?.feedbackState?.(widget.id)) { const value = extendedFeedbackValue(widget.type, raw, properties, project); own.observe(value, value === null ? "invalid" : "ready"); }
      paint();
    },
    setBindingState(state) {
      if (state === "invalid" && !ctx.runtime?.feedbackState?.(widget.id)) own.observe(null, state);
      paint();
    },
    resize: paint,
    destroy() { theme.disconnect(); },
  };
}
