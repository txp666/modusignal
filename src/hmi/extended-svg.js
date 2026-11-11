import { escapeSvgText as text, getBitProfile, bitProfileName } from "./extended-feedback.js";

const fill = (svg, tokens) => String(svg ?? "").replace(/\{\{(\w+)\}\}/g, (_, name) => String(tokens[name] ?? ""));
const point = (n) => Number(n.toFixed(4));
export function bitNameSize(name, base, room) {
  let units = 0;
  for (const char of String(name)) units += char.codePointAt(0) > 127 || "MW@%".includes(char) ? 1 : 0.68;
  return Math.min(base, Math.max(0, room) / Math.max(1, units));
}
export function timingTrace(samples, bit, height) {
  const step = 228 / 32;
  let trace = "", pen = false;
  samples.slice(-32).forEach((value, index, visible) => {
    const x = point(82 + (32 - visible.length + index) * step);
    if (value === null) { if (pen) trace += ` H${x}`; pen = false; return; }
    const y = point(((value >> bit) & 1) ? height * 0.2 : height * 0.8);
    trace += pen ? ` H${x} V${y}` : ` M${x} ${y}`;
    pen = true;
  });
  if (pen) trace += " H310";
  return trace.trim();
}

/** Shared trusted templates, with user text escaped and profile colors normalized. */
export function renderExtendedSvg(item, snapshot, properties = {}, project = {}, theme = {}) {
  const value = snapshot.state === "ready" ? snapshot.value : null;
  const tokens = { ...theme, items: "", known: Number(value !== null), voltageText: "—", currentText: "—", cvOn: 0, ccOn: 0, encoderAngle: snapshot.angle ?? 0, forwardOn: Number(snapshot.direction === "forward"), reverseOn: Number(snapshot.direction === "reverse") };
  if (["StatusWordPanel", "DigitalTimingChart"].includes(item.type)) {
    const profile = getBitProfile(project, bitProfileName({ properties }));
    const columns = profile.width === 16 ? 4 : 2, height = 144 / profile.width;
    tokens.items = profile.bits.map((bit, index) => {
      const local = item.type === "StatusWordPanel"
        ? { x: 8 + index % columns * 304 / columns, y: 8 + Math.floor(index / columns) * 36, w: 304 / columns - 4, nameSize: point(bitNameSize(bit.name, 11, 304 / columns - 4 - 28)), name: text(bit.name), color: bit.color, lit: Number(value !== null && ((value >> index) & 1) !== 0) }
        : { y: point(8 + index * height), h: point(height), labelY: point(height * 0.7), fontSize: point(bitNameSize(bit.name, Math.min(11, height * 0.77), 70)), name: text(bit.name), color: bit.color, trace: timingTrace(snapshot.samples ?? [], index, height) };
      return fill(item.itemSvg, { ...theme, ...local });
    }).join("");
  } else if (item.type === "BmsCellMatrix" && value !== null) {
    const count = value.length, columns = Math.min(count, Math.ceil(Math.sqrt(2 * count))), rows = Math.ceil(count / columns);
    const cellWidth = 304 / columns, cellHeight = 144 / rows, gap = Math.min(2, cellWidth * 0.1, cellHeight * 0.1);
    const width = cellWidth - gap, height = cellHeight - gap, low = value.reduce((a, b) => Math.min(a, b)), high = value.reduce((a, b) => Math.max(a, b));
    tokens.items = value.map((voltage, index) => fill(item.itemSvg, { ...theme,
      x: point(8 + index % columns * cellWidth), y: point(8 + Math.floor(index / columns) * cellHeight), w: point(width), h: point(height), cx: point(width / 2),
      nameY: point(height * 0.39), valueY: point(height * 0.79), nameSize: point(Math.min(11, height * 0.3, width * 0.2)), valueSize: point(Math.min(16, height * 0.33, width * 0.23)),
      name: `C${index + 1}`, valueText: voltage.toFixed(3), outline: low === high ? theme.muted : voltage === low ? theme.accent : voltage === high ? theme.warm : theme.muted,
    })).join("");
  } else if (item.type === "DcPowerSupply" && value !== null) {
    Object.assign(tokens, { voltageText: value.voltage.toFixed(2), currentText: value.current.toFixed(3), cvOn: Number(value.mode === "CV"), ccOn: Number(value.mode === "CC") });
  }
  return fill(item.svg, tokens);
}
