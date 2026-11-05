// How each .uidp widget looks on the canvas, in design (inert) and run mode (live controls).
// A view is { el, body, setValue(value), destroy(), resize() }; bound values arrive through
// setValue and never send a command back.

import i18n from "../../i18n.js";
import { createHmiChart } from "./hmi-chart.js";
import { curveConfigs } from "../../hmi/binding.js";
import { displayString, formatFixed, toInteger, toReal } from "../../hmi/py-values.js";
import { geometryOf, isSupported, propValue, widgetMeta } from "../../hmi/uidp.js";
import { TAB_PAGE_TOP, currentTab, tabNames } from "../../hmi/layout.js";
import { dataRecvCardView, dataSendCardView, linkCardView, logBoxView } from "./card-views.js";

const SVG_NS = "http://www.w3.org/2000/svg";

/** Curve colours in their fixed order, as FluentHMI Studio's kCurveColors / kDarkCurveColors. */
export const CURVE_COLORS = {
  light: ["#0078d4", "#f44336", "#4caf50", "#ff9800", "#9c27b0", "#00bcd4", "#795548", "#607d8b"],
  dark: ["#4aa3df", "#ff7069", "#81c784", "#ffb74d", "#ce93d8", "#4dd0e1", "#bcaaa4", "#b0bec5"],
};

export function curveColor(index) {
  const dark = document.documentElement.dataset.theme === "dark";
  const colors = dark ? CURVE_COLORS.dark : CURVE_COLORS.light;
  return colors[index % colors.length];
}

/** The DataTable column that takes the time a frame arrived. */
const TIME_COLUMN = "时间";

const LED_COLORS = { green: "var(--hmi-led-green)", red: "var(--hmi-led-red)", yellow: "var(--hmi-led-yellow)", blue: "var(--hmi-led-blue)", gray: "var(--hmi-led-gray)" };

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function svg(tag, attrs = {}) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  return node;
}

const str = (widget, name) => String(propValue(widget, name) ?? "");
const num = (widget, name, fallback = 0) => {
  const value = toReal(propValue(widget, name));
  return value === null || !Number.isFinite(value) ? fallback : value;
};
const int = (widget, name, fallback = 0) => toInteger(propValue(widget, name)) ?? fallback;
const flag = (widget, name) => {
  const value = propValue(widget, name);
  return value === true || value === "true" || value === 1;
};

function polar(cx, cy, r, degrees) {
  const radians = (degrees * Math.PI) / 180;
  return [cx + r * Math.cos(radians), cy + r * Math.sin(radians)];
}

function arcPath(cx, cy, r, from, to) {
  const [x1, y1] = polar(cx, cy, r, from);
  const [x2, y2] = polar(cx, cy, r, to);
  const large = Math.abs(to - from) > 180 ? 1 : 0;
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

// -- the views ----------------------------------------------------------------------------

function baseView(widget, className) {
  const root = el("div", `hmi-widget ${className}`);
  root.dataset.widgetId = widget.id ?? "";
  root.dataset.type = widget.type;
  return { el: root, body: root, setValue() {}, destroy() {}, resize() {} };
}

/** Calls draw(width, height) now and whenever the widget's box changes size. */
function onSize(view, draw) {
  let last = "";
  const observer = new ResizeObserver(() => {
    const key = `${view.el.clientWidth}x${view.el.clientHeight}`;
    if (key !== last && view.el.clientWidth && view.el.clientHeight) {
      last = key;
      draw(view.el.clientWidth, view.el.clientHeight);
    }
  });
  observer.observe(view.el);
  const destroy = view.destroy;
  view.destroy = () => {
    observer.disconnect();
    destroy();
  };
}

function pushButton(widget, ctx) {
  const view = baseView(widget, "hmi-button");
  const button = el("button", "hmi-control", str(widget, "text"));
  button.type = "button";
  button.disabled = !flag(widget, "enabled") || ctx.mode !== "run";
  button.addEventListener("click", () => ctx.send(widget, {}));
  view.el.append(button);
  return view;
}

function label(widget) {
  const view = baseView(widget, "hmi-label");
  const text = el("div", "hmi-label-text", str(widget, "text"));
  // fontSize is in points, as Qt reads them at 96 dpi.
  text.style.fontSize = `${(int(widget, "fontSize", 14) * 4) / 3}px`;
  text.style.fontWeight = flag(widget, "bold") ? "700" : "400";
  text.style.textAlign = { Left: "left", Center: "center", Right: "right" }[str(widget, "alignment")] ?? "left";
  view.el.append(text);
  view.setValue = (value) => {
    text.textContent = String(value);
  };
  return view;
}

function lineEdit(widget, ctx) {
  const view = baseView(widget, "hmi-lineedit");
  const input = el("input", "hmi-control");
  input.type = "text";
  input.placeholder = str(widget, "placeholderText");
  input.value = str(widget, "text");
  input.readOnly = flag(widget, "readOnly");
  input.disabled = ctx.mode !== "run";
  input.setAttribute("aria-label", widget.id ?? widget.type);
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.isComposing) ctx.send(widget, { text: input.value });
  });
  view.el.append(input);
  return view;
}

function comboBox(widget, ctx) {
  const view = baseView(widget, "hmi-combobox");
  const select = el("select", "hmi-control");
  // One option per non-empty line, trimmed, as Studio and the Python designer list them.
  const items = str(widget, "items").split("\n").map((item) => item.trim()).filter(Boolean);
  items.forEach((item, index) => {
    const option = el("option", "", item);
    option.value = String(index);
    select.append(option);
  });
  const current = int(widget, "currentIndex", 0);
  if (current >= 0 && current < items.length) select.value = String(current);
  select.disabled = ctx.mode !== "run";
  select.setAttribute("aria-label", widget.id ?? widget.type);
  select.addEventListener("change", () => {
    const index = Number(select.value);
    ctx.send(widget, { index, text: items[index] ?? "" });
  });
  view.el.append(select);
  return view;
}

function toggleSwitch(widget, ctx) {
  // The label on the left, the switch on the right with its 开 / 关, as Studio's ToggleSwitch.
  const view = baseView(widget, "hmi-toggle");
  const wrap = el("label", "hmi-switch");
  const input = el("input");
  input.type = "checkbox";
  input.setAttribute("role", "switch");
  input.checked = flag(widget, "checked");
  input.disabled = ctx.mode !== "run";
  const track = el("span", "hmi-switch-track");
  track.setAttribute("aria-hidden", "true");
  const state = el("span", "hmi-switch-state");
  const showState = () => {
    state.textContent = i18n(input.checked ? "hmi.switch.on" : "hmi.switch.off");
  };
  showState();
  wrap.append(el("span", "hmi-switch-label", str(widget, "label")), input, track, state);
  input.addEventListener("change", () => {
    showState();
    ctx.send(widget, { checked: input.checked });
  });
  view.el.append(wrap);
  view.setValue = (value) => {
    input.checked = Boolean(value);
    showState();
  };
  return view;
}

function slider(widget, ctx) {
  // A Fluent slider across the widget: the groove filled up to the handle, no readout.
  const view = baseView(widget, "hmi-slider");
  const input = el("input", "hmi-range");
  input.type = "range";
  input.min = String(int(widget, "minimum", 0));
  input.max = String(int(widget, "maximum", 100));
  input.step = "1";
  input.value = String(int(widget, "value", 50));
  input.disabled = ctx.mode !== "run";
  input.setAttribute("aria-label", widget.id ?? widget.type);
  const fill = () => {
    const span = Number(input.max) - Number(input.min);
    const ratio = span > 0 ? (Number(input.value) - Number(input.min)) / span : 0;
    input.style.setProperty("--fill", `${Math.max(0, Math.min(100, ratio * 100))}%`);
  };
  fill();
  // While the user holds the handle, device feedback does not move it.
  let held = false;
  input.addEventListener("pointerdown", () => {
    held = true;
  });
  const release = () => {
    held = false;
  };
  input.addEventListener("pointerup", release);
  input.addEventListener("pointercancel", release);
  input.addEventListener("input", fill);
  // A drag sends once when it lets go; each keyboard step commits (and sends) too.
  input.addEventListener("change", () => {
    held = false;
    ctx.send(widget, { value: Number(input.value) });
  });
  view.el.append(input);
  view.setValue = (value) => {
    if (held) return;
    input.value = String(value);
    fill();
  };
  return view;
}

function spinBox(widget, ctx) {
  const view = baseView(widget, "hmi-spinbox");
  const input = el("input", "hmi-control");
  input.type = "number";
  input.min = String(int(widget, "minimum", 0));
  input.max = String(int(widget, "maximum", 100));
  input.step = "1";
  input.value = String(int(widget, "value", 0));
  input.disabled = ctx.mode !== "run";
  input.setAttribute("aria-label", widget.id ?? widget.type);
  const suffix = str(widget, "suffix");
  input.addEventListener("change", () => {
    const min = Number(input.min);
    const max = Number(input.max);
    const value = Math.min(max, Math.max(min, Math.trunc(Number(input.value) || 0)));
    input.value = String(value);
    ctx.send(widget, { value });
  });
  view.el.append(input);
  if (suffix) view.el.append(el("span", "hmi-spin-suffix", suffix));
  view.setValue = (value) => {
    input.value = String(value);
  };
  return view;
}

function led(widget) {
  // A dot of at most 18 px, its glow kept inside the widget, the label 34 px in (Studio's LedWidget).
  const view = baseView(widget, "hmi-led");
  const glow = el("span", "hmi-led-glow");
  const dot = el("span", "hmi-led-dot");
  view.el.style.setProperty("--hmi-led-on", LED_COLORS[str(widget, "color")] ?? LED_COLORS.green);
  const setOn = (on) => view.el.classList.toggle("on", Boolean(on));
  setOn(flag(widget, "on"));
  view.el.append(glow, dot, el("span", "hmi-led-label", str(widget, "label")));
  onSize(view, (_width, height) => {
    const d = Math.max(0, Math.min(18, height - 4));
    const glowRadius = Math.min(d * 0.8, height / 2);
    Object.assign(dot.style, { width: `${d}px`, height: `${d}px`, left: `${glowRadius + 1 - d / 2}px`, top: `${(height - d) / 2}px` });
    Object.assign(glow.style, { width: `${glowRadius * 2}px`, height: `${glowRadius * 2}px`, left: `${1}px`, top: `${height / 2 - glowRadius}px` });
  });
  view.setValue = setOn;
  return view;
}

function numericDisplay(widget) {
  // A card with the title, the value (bold, in the accent colour, fontSize px) and the unit, stacked
  // and centred; an empty unit keeps its line (Studio's NumericDisplayWidget).
  const view = baseView(widget, "hmi-numeric");
  const value = el("div", "hmi-numeric-value", str(widget, "value"));
  value.style.fontSize = `${Math.max(8, int(widget, "fontSize", 28))}px`;
  view.el.append(el("div", "hmi-numeric-title", str(widget, "title")), value, el("div", "hmi-numeric-unit", str(widget, "unit")));
  view.setValue = (next) => {
    value.textContent = displayString(next);
  };
  return view;
}

function progressBar(widget) {
  // Fluent's progress bar: a 4 px bar over a 1 px track line, centred in the widget.
  const view = baseView(widget, "hmi-progress");
  const track = el("div", "hmi-progress-track");
  const fill = el("div", "hmi-progress-fill");
  track.append(fill);
  view.el.append(track);
  const maximum = Math.max(1, int(widget, "maximum", 100));
  const set = (value) => {
    const number = Math.max(0, Math.min(maximum, Math.trunc(Number(value) || 0)));
    fill.style.width = `${(number / maximum) * 100}%`;
  };
  set(int(widget, "value", 50));
  view.setValue = set;
  return view;
}

function progressRing(widget) {
  // Fluent's progress ring (6 px, from the top, clockwise, the percentage inside) sized
  // max(40, min(w - 8, h - 36)), the label under it (Studio's ProgressRingWidget).
  const view = baseView(widget, "hmi-ring");
  const graphic = svg("svg", { class: "hmi-ring-svg", "aria-hidden": "true" });
  const track = svg("circle", { class: "hmi-ring-track" });
  const arc = svg("path", { class: "hmi-ring-value" });
  const text = svg("text", { "text-anchor": "middle", "dominant-baseline": "central", class: "hmi-ring-text" });
  graphic.append(track, arc, text);
  const box = el("div", "hmi-ring-box");
  box.append(graphic);
  view.el.append(box, el("div", "hmi-ring-label", str(widget, "label")));
  const maximum = Math.max(1, int(widget, "maximum", 100));
  let current = int(widget, "value", 0);
  let side = 100;
  const draw = () => {
    const ratio = Math.max(0, Math.min(1, current / maximum));
    const r = (side - 6) / 2;
    const c = side / 2;
    graphic.setAttribute("viewBox", `0 0 ${side} ${side}`);
    Object.assign(graphic.style, { width: `${side}px`, height: `${side}px` });
    for (const [key, value] of Object.entries({ cx: c, cy: c, r })) track.setAttribute(key, value);
    const degrees = Math.floor(ratio * 360);
    arc.setAttribute("d", degrees <= 0 ? "" : degrees >= 360 ? `M ${c} ${c - r} A ${r} ${r} 0 1 1 ${c - 0.01} ${c - r}` : arcPath(c, c, r, -90, -90 + degrees));
    text.setAttribute("x", c);
    text.setAttribute("y", c);
    text.textContent = `${Math.floor(ratio * 100)}%`;
  };
  onSize(view, (width, height) => {
    side = Math.max(40, Math.min(width - 8, height - 36));
    draw();
  });
  draw();
  view.setValue = (value) => {
    const number = toInteger(value) ?? Math.trunc(Number(value));
    if (!Number.isFinite(number)) return;
    current = Math.max(0, Math.min(maximum, number));
    draw();
  };
  return view;
}

function gauge(widget) {
  // Studio's GaugeWidget: a 270° arc (stroke max(6, side / 14)) open at the bottom, the value with one
  // decimal in the middle, the unit under it and the title in the opening; sized from the widget.
  const view = baseView(widget, "hmi-gauge");
  const graphic = svg("svg", { class: "hmi-gauge-svg", "aria-hidden": "true" });
  const track = svg("path", { class: "hmi-gauge-track" });
  const arc = svg("path", { class: "hmi-gauge-value" });
  const valueText = svg("text", { "text-anchor": "middle", "dominant-baseline": "central", class: "hmi-gauge-text" });
  const unitText = svg("text", { "text-anchor": "middle", "dominant-baseline": "central", class: "hmi-gauge-unit" });
  unitText.textContent = str(widget, "unit");
  const titleText = svg("text", { "text-anchor": "middle", "dominant-baseline": "hanging", class: "hmi-gauge-title" });
  titleText.textContent = str(widget, "title");
  graphic.append(track, arc, valueText, unitText, titleText);
  view.el.append(graphic);
  const minimum = num(widget, "minimum", 0);
  const maximum = num(widget, "maximum", 100);
  let current = num(widget, "value", 0);
  let size = [200, 200];
  const draw = () => {
    const [width, height] = size;
    const base = Math.min(width, height);
    const stroke = Math.max(6, base / 14);
    const side = Math.max(1, base - stroke - 8);
    const left = (width - side) / 2;
    const top = (height - side) / 2 + 4;
    const cx = left + side / 2;
    const cy = top + side / 2;
    const r = side / 2;
    graphic.setAttribute("viewBox", `0 0 ${width} ${height}`);
    track.setAttribute("d", arcPath(cx, cy, r, 135, 405));
    track.style.strokeWidth = arc.style.strokeWidth = `${stroke}px`;
    const ratio = maximum > minimum ? Math.max(0, Math.min(1, (current - minimum) / (maximum - minimum))) : 0;
    arc.setAttribute("d", ratio > 0 ? arcPath(cx, cy, r, 135, 135 + 270 * Math.max(ratio, 0.001)) : "");
    valueText.setAttribute("x", cx);
    valueText.setAttribute("y", cy);
    valueText.style.fontSize = `${Math.max(10, Math.floor(side / 5.5))}px`;
    valueText.textContent = formatFixed(Math.min(Math.max(current, minimum), Math.max(minimum, maximum)), 1);
    const small = `${Math.max(9, Math.floor(side / 11))}px`;
    unitText.setAttribute("x", cx);
    unitText.setAttribute("y", cy + side * 0.16);
    unitText.style.fontSize = small;
    titleText.setAttribute("x", cx);
    titleText.setAttribute("y", top + side * 0.8);
    titleText.style.fontSize = small;
  };
  onSize(view, (width, height) => {
    size = [width, height];
    draw();
  });
  draw();
  view.setValue = (value) => {
    const number = Number(value);
    if (!Number.isFinite(number)) return;
    current = number;
    draw();
  };
  return view;
}

function realtimeChart(widget, ctx) {
  const view = baseView(widget, "hmi-chart");
  const curves = curveConfigs(widget.properties ?? {});
  // The designer shows the chart as it runs, empty and still.
  view.el.classList.add("hmi-chart-run");
  const chart = createHmiChart(view.el, {
    title: str(widget, "title"),
    curves: curves.map((curve) => ({ name: String(curve.name) })),
    displayPoints: int(widget, "displayPoints", 200),
    colorOf: curveColor,
    interactive: ctx.mode === "run",
  });
  view.addPoint = (index, value) => chart.append(index, value);
  view.resize = () => chart.resize();
  view.destroy = () => chart.dispose();
  return view;
}

function containerView(widget, className) {
  // Children are placed relative to the container's top-left corner, as in the file.
  const view = baseView(widget, `${className} hmi-container`);
  const title = str(widget, "title");
  if (className === "hmi-groupbox") {
    // The frame from y = 10 with a gap for the caption, as Studio paints a GroupBox.
    const frame = el("fieldset", "hmi-group-frame");
    frame.setAttribute("aria-hidden", "true");
    if (title) frame.append(el("legend", "", title));
    view.el.append(frame);
  } else if (title) {
    view.el.append(el("div", "hmi-container-title", title));
  }
  return view;
}

/** HBoxLayout / VBoxLayout / FlexLayout: a dashed frame with a small caption. */
function boxView(widget) {
  const view = baseView(widget, "hmi-box hmi-container");
  const title = str(widget, "title");
  if (title) view.el.append(el("div", "hmi-box-title", title));
  return view;
}

/** A TabWidget: tabs over a page; children sit relative to the widget, shown on their own page. */
function tabWidgetView(widget, ctx) {
  const view = baseView(widget, "hmi-tabs");
  const names = tabNames(widget);
  const bar = el("div", "hmi-tab-bar");
  bar.setAttribute("role", "tablist");
  const buttons = names.map((name, index) => {
    const tab = el("button", "hmi-tab", name);
    tab.type = "button";
    tab.dataset.tabIndex = String(index);
    tab.setAttribute("role", "tab");
    tab.addEventListener("click", () => ctx.selectTab?.(widget, index));
    bar.append(tab);
    return tab;
  });
  const page = el("div", "hmi-tab-page");
  page.setAttribute("role", "tabpanel");
  view.el.append(bar, page);
  view.body = page;
  view.childOffsetY = TAB_PAGE_TOP;
  view.showPage = (index) => {
    buttons.forEach((tab, i) => {
      tab.setAttribute("aria-selected", String(i === index));
      tab.tabIndex = i === index ? 0 : -1;
    });
    for (const child of page.children) child.hidden = Number(child.dataset.tabPage) !== index;
  };
  view.showPage(ctx.pageOf?.(widget) ?? currentTab(widget));
  return view;
}

/** A DataTable: the latest frame as field / value rows, or a log with a row per frame. */
function dataTableView(widget, ctx) {
  const view = baseView(widget, "hmi-table");
  const columns = str(widget, "columns").split("\n").map((c) => c.trim()).filter(Boolean);
  const names = columns.length ? columns : ["字段", "值"];
  const logging = str(widget, "recordMode") === "逐行记录";
  const maxRows = Math.max(10, int(widget, "maxRows", 500));
  const scroller = el("div", "hmi-table-scroll");
  const table = el("table");
  const head = el("tr");
  if (!logging) head.append(el("th", "hmi-table-rownum", ""));
  for (const name of names) head.append(el("th", "", name));
  const thead = el("thead");
  thead.append(head);
  const body = el("tbody");
  table.append(thead, body);
  scroller.append(table);
  view.el.append(scroller);
  const row = (cells, number) => {
    const tr = el("tr");
    if (number !== undefined) tr.append(el("td", "hmi-table-rownum", String(number)));
    cells.slice(0, names.length).forEach((cell) => tr.append(el("td", "", cell)));
    for (let i = cells.length; i < names.length; i += 1) tr.append(el("td", "", ""));
    return tr;
  };
  if (ctx.mode === "run" && ctx.runtime) {
    view.destroy = ctx.runtime.events.data.on((data) => {
      if (logging) {
        const keys = names.filter((name) => name !== TIME_COLUMN);
        if (!keys.some((key) => Object.hasOwn(data, key))) return;
        const now = new Date();
        const stamp = `${now.toTimeString().slice(0, 8)}.${String(now.getMilliseconds()).padStart(3, "0")}`;
        if (body.childElementCount >= maxRows) body.firstElementChild.remove();
        body.append(row(names.map((name) => (name === TIME_COLUMN ? stamp : (data[name] === null || data[name] === undefined ? "" : displayString(data[name]))))));
        scroller.scrollTop = scroller.scrollHeight;
      } else {
        const rows = Object.entries(data).slice(0, maxRows).map(([key, value], index) => row([key, displayString(value)], index + 1));
        body.replaceChildren(...rows);
      }
    });
  }
  return view;
}

function separator(widget) {
  const view = baseView(widget, "hmi-separator");
  view.el.classList.toggle("vertical", str(widget, "orientation") === "vertical");
  view.el.append(el("div", "hmi-separator-line"));
  return view;
}

function placeholder(widget) {
  const view = baseView(widget, "hmi-placeholder");
  view.el.append(el("strong", "", widget.type), el("span", "", i18n("hmi.placeholder.note")));
  return view;
}

const FACTORIES = {
  PushButton: pushButton,
  Label: label,
  LineEdit: lineEdit,
  ComboBox: comboBox,
  ToggleSwitch: toggleSwitch,
  Slider: slider,
  SpinBox: spinBox,
  LEDIndicator: led,
  NumericDisplay: numericDisplay,
  ProgressBar: progressBar,
  ProgressRingDisplay: progressRing,
  GaugeMeter: gauge,
  RealtimeChart: realtimeChart,
  GroupBox: (widget) => containerView(widget, "hmi-groupbox"),
  TabWidget: tabWidgetView,
  HBoxLayout: boxView,
  VBoxLayout: boxView,
  FlexLayout: boxView,
  DataTable: dataTableView,
  CardContainer: (widget) => containerView(widget, "hmi-card"),
  Separator: separator,
  SerialConfigCard: linkCardView,
  TcpConfigCard: linkCardView,
  MqttConfigCard: linkCardView,
  DataRecvCard: dataRecvCardView,
  DataSendCard: dataSendCardView,
  LogBox: logBoxView,
};

/** The view of one widget, positioned by its geometry (relative to its container). */
export function createWidgetView(widget, ctx) {
  const factory = isSupported(widget) ? FACTORIES[widget.type] : placeholder;
  const view = factory(widget, ctx);
  const { x, y, w, h } = geometryOf(widget);
  // A tab page starts below the tab bar; its children's coordinates count from the TabWidget.
  view.offsetY = ctx.offsetY ?? 0;
  Object.assign(view.el.style, { left: `${x}px`, top: `${y - view.offsetY}px`, width: `${w}px`, height: `${h}px` });
  view.el.title = ctx.mode === "design" ? `${widget.id ?? ""} · ${i18n(`hmi.widget.${widget.type}`, widgetMeta(widget.type)?.name ?? widget.type)}` : "";
  return view;
}

