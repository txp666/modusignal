// The RealtimeChart of a running .uidp project, as PyQt UI Designer's RealtimeLineChart and
// FluentHMI Studio's chart have it: a header reading each curve's value (the latest, or at the
// cursor; click an entry to hide or show its curve), the plot (x = the sample number in the
// window), and a toolbar: 显示点数, the mode (实时 / 游标 / an error), saving the whole history
// as CSV or JSON, loading a saved run as dashed comparison curves, clearing them. The plot is
// drawn as Studio's RealtimePlotWidget paints it.

import i18n from "../../i18n.js";
import {
  ChartFileError, ChartHistory, HISTORY_LIMIT, chartFileFormat, chartReading, parseChartFile, saveChartFile,
} from "../../hmi/chart-file.js";

const REFRESH_MS = 33;
const SAMPLE_READING = "-0000.00";
const PLOT_FONT = "12px -apple-system, BlinkMacSystemFont, \"Segoe UI\", \"PingFang SC\", \"Microsoft YaHei\", sans-serif";
const LINE_HEIGHT = 16;

const ICONS = {
  save: '<svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" aria-hidden="true"><path d="M4.5 3h9l3.5 3.5v9a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 15.5v-11A1.5 1.5 0 0 1 4.5 3z"/><path d="M6.5 3v4h6V3M6 17v-5.5h8V17"/></svg>',
  load: '<svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 5.5A1.5 1.5 0 0 1 4 4h3.6l1.8 2H16a1.5 1.5 0 0 1 1.5 1.5v7.5A1.5 1.5 0 0 1 16 16.5H4A1.5 1.5 0 0 1 2.5 15z"/><path d="M2.5 8.5h15"/></svg>',
  clear: '<svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15.5 2.5 10.8 8.6"/><path d="M8.2 8.1l4.6 3.1-1.4 2.6c-.8 1.6-2.4 3-4.4 3.5L3 17.2c1.2-1.2 1.8-2.7 2-4.2l.4-2.4z"/><path d="M5.6 11.6l5.6 3.4"/></svg>',
};

// -- Studio's plot ---------------------------------------------------------------------------

/** RealtimePlotWidget's colours: panel, plot, text, grid. */
function plotColors(dark) {
  return dark
    ? { panel: [32, 32, 32], plot: [18, 18, 18], text: [243, 243, 243], textAlpha: 190, grid: "rgba(255, 255, 255, 0.094)" }
    : { panel: [255, 255, 255], plot: [248, 250, 252], text: [31, 31, 31], textAlpha: 170, grid: "rgba(0, 0, 0, 0.078)" };
}

const rgba = ([r, g, b], alpha) => `rgba(${r}, ${g}, ${b}, ${(alpha / 255).toFixed(3)})`;

function withAlpha(color, alpha) {
  const hex = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(color);
  if (hex) return rgba([1, 2, 3].map((index) => Number.parseInt(hex[index], 16)), alpha);
  const rgb = /^rgba?\(([^,]+),([^,]+),([^,)]+)/.exec(color);
  return rgb ? rgba([1, 2, 3].map((index) => Number(rgb[index])), alpha) : color;
}

/** A round tick step for `span` in about `count` steps: 1, 2 or 5 times a power of ten (Studio's niceTickStep). */
export function niceTickStep(span, count) {
  const raw = span / Math.max(1, count);
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const fraction = raw / magnitude;
  const nice = fraction < 1.4142 ? 1 : fraction < 3.1623 ? 2 : fraction < 7.0711 ? 5 : 10;
  return nice * magnitude;
}

function tickPrecision(step) {
  const absolute = Math.abs(step);
  if (!Number.isFinite(absolute) || absolute <= 1e-6) return 8;
  if (absolute >= 2) return 0;
  if (absolute >= 1) return 1;
  return Math.max(0, Math.min(8, Math.ceil(-Math.log10(absolute)) + 1));
}

/** A tick's label: the value with the step's decimals, trailing zeros dropped (Studio's tickText). */
export function tickText(value, step) {
  let text = value.toFixed(tickPrecision(step));
  if (text.includes(".")) text = text.replace(/0+$/, "").replace(/\.$/, "");
  return text === "-0" ? "0" : text;
}

function tickValues(minimum, maximum, step) {
  if (!(step > 0) || !Number.isFinite(minimum) || !Number.isFinite(maximum) || maximum < minimum) return [];
  const first = Math.ceil(minimum / step - 1e-9);
  const last = Math.floor(maximum / step + 1e-9);
  if (last - first > 100) return [];
  const values = [];
  for (let k = first; k <= last; k += 1) values.push(k * step);
  return values;
}

/** The view of the shown curves, as Studio's chart fits it: x 0..count-1, y padded by 12 % (at least 0.2). */
export function fitView(windows) {
  let count = 0;
  let low = Infinity;
  let high = -Infinity;
  for (const values of windows) {
    count = Math.max(count, values.length);
    for (const value of values) {
      low = Math.min(low, value);
      high = Math.max(high, value);
    }
  }
  let yMin = -1;
  let yMax = 1;
  if (low <= high) {
    const padding = Math.max(0.2, Math.max(1e-6, high - low) * 0.12);
    yMin = low - padding;
    yMax = high + padding;
    if (low >= 0) yMin = Math.max(0, yMin);
    else if (high <= 0) yMax = Math.min(0, yMax);
  }
  return { xMin: 0, xMax: Math.max(1, count - 1), yMin, yMax };
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

let measureContext = null;
function textWidth(text, font) {
  measureContext ??= document.createElement("canvas").getContext("2d");
  measureContext.font = font;
  return measureContext.measureText(text).width;
}

/**
 * host: the element to fill. options: title, curves [{ name }], displayPoints, colorOf(index)
 * (the palette colour of a curve number, comparison curves following the live ones), interactive
 * (false for the designer's still preview).
 */
export function createHmiChart(host, { title, curves, displayPoints, colorOf, interactive = true }) {
  const histories = curves.map(() => new ChartHistory(HISTORY_LIMIT));
  const hidden = curves.map(() => false);
  let refs = [];
  let points = Math.max(10, Math.min(HISTORY_LIMIT, displayPoints));
  let cursor = null; // the cursor's x, in samples
  let hover = null; // the pointer over the plot, for the crosshair
  let view = fitView([]);
  let timer = null;
  let disposed = false;

  const header = el("div", "hmi-chart-header");
  const titleNode = el("span", "hmi-chart-title", title);
  const plotHost = el("div", "hmi-chart-plot");
  const canvas = el("canvas");
  plotHost.append(canvas);
  const toolbar = el("div", "hmi-chart-toolbar");
  const pointsLabel = el("label", "hmi-chart-points");
  const pointsInput = el("input");
  pointsInput.type = "text";
  pointsInput.inputMode = "numeric";
  pointsInput.value = String(points);
  pointsLabel.append(el("span", "", i18n("hmi.chart.points")), pointsInput);
  const mode = el("span", "hmi-chart-mode", i18n("hmi.chart.live"));
  const spacer = el("span", "hmi-chart-spacer");
  const toolButton = (icon, key) => {
    const button = el("button", "hmi-chart-tool");
    button.type = "button";
    button.title = i18n(key);
    button.setAttribute("aria-label", button.title);
    button.innerHTML = ICONS[icon];
    return button;
  };
  const saveButton = toolButton("save", "hmi.chart.save");
  const loadButton = toolButton("load", "hmi.chart.load");
  const clearButton = toolButton("clear", "hmi.chart.clearRefs");
  clearButton.hidden = true;
  const fileInput = el("input");
  fileInput.type = "file";
  fileInput.accept = ".csv,.json,text/csv,application/json";
  fileInput.hidden = true;
  toolbar.append(pointsLabel, mode, spacer, saveButton, loadButton, clearButton, fileInput);
  host.append(header, plotHost, toolbar);
  if (!interactive) {
    host.classList.add("hmi-chart-still");
    pointsInput.readOnly = true;
    pointsInput.tabIndex = -1;
    for (const button of [saveButton, loadButton]) button.tabIndex = -1;
  }

  const entryWidths = [];

  function setMode(text, error = false) {
    mode.textContent = text;
    mode.title = text;
    mode.classList.toggle("error", error);
  }

  const windowStart = () => Math.max(0, Math.max(0, ...histories.map((history) => history.count)) - points);

  function showEntries(values, sample) {
    const entries = values.map((value, index) => ({ name: curves[index].name, value, color: colorOf(index), dashed: false, shown: !hidden[index] }));
    refs.forEach((ref, index) => {
      const value = sample >= 0 && sample < ref.values.length ? chartReading(ref.values[sample]) : "--";
      entries.push({ name: ref.name, value, color: colorOf(curves.length + index), dashed: true, shown: !ref.hidden });
    });
    const font = getComputedStyle(header).font || "12px sans-serif";
    header.replaceChildren(...(title ? [titleNode] : []));
    entries.forEach((entry, index) => {
      // An entry keeps the widest it has been, so the ones after it stay where they are.
      if (index === entryWidths.length) entryWidths.push(textWidth(`${entry.name} ${SAMPLE_READING}`, font));
      entryWidths[index] = Math.max(entryWidths[index], textWidth(`${entry.name} ${entry.value}`, font));
      const button = el("button", "hmi-chart-entry");
      button.type = "button";
      button.tabIndex = interactive ? 0 : -1;
      button.classList.toggle("hidden-curve", !entry.shown);
      button.setAttribute("aria-pressed", String(entry.shown));
      button.style.setProperty("--curve", entry.color);
      button.style.minWidth = `${Math.ceil(26 + entryWidths[index])}px`;
      const mark = el("span", `hmi-chart-mark${entry.dashed ? " dashed" : ""}`);
      button.append(mark, el("span", "", `${entry.name} ${entry.value}`));
      if (interactive) button.addEventListener("click", () => toggle(index));
      header.append(button);
    });
  }

  function showLive() {
    const values = histories.map((history) => (history.count ? chartReading(history.last()) : "--"));
    showEntries(values, Math.max(0, ...histories.map((history) => history.count)) - 1);
  }

  function showCursor() {
    const index = Math.round(cursor);
    setMode(i18n("hmi.chart.cursor").replace("{x}", String(index)));
    const values = histories.map((history) => {
      const shown = history.tail(points);
      return index >= 0 && index < shown.length ? chartReading(shown[index]) : "--";
    });
    showEntries(values, windowStart() + index);
  }

  // -- painting, as RealtimePlotWidget::paintEvent and the chart's own overlay ----------------

  const size = () => ({ width: plotHost.clientWidth, height: plotHost.clientHeight });
  const plotRect = ({ width, height }) => ({ left: 58, top: 18, right: width - 18, bottom: height - 42 });
  const toX = (x, plot) => plot.left + (x - view.xMin) / Math.max(1e-6, view.xMax - view.xMin) * (plot.right - plot.left);
  const toY = (y, plot) => plot.bottom - (y - view.yMin) / Math.max(1e-6, view.yMax - view.yMin) * (plot.bottom - plot.top);
  const fromX = (px, plot) => view.xMin + (px - plot.left) / Math.max(1, plot.right - plot.left) * (view.xMax - view.xMin);

  function paint(live, refWindows) {
    const { width, height } = size();
    if (!width || !height) return;
    // Sharp at the device's pixels and at the canvas zoom.
    const zoom = plotHost.getBoundingClientRect().width / plotHost.offsetWidth || 1;
    const ratio = (window.devicePixelRatio || 1) * zoom;
    const pixelWidth = Math.round(width * ratio);
    const pixelHeight = Math.round(height * ratio);
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const g = canvas.getContext("2d");
    g.setTransform(ratio, 0, 0, ratio, 0, 0);
    g.clearRect(0, 0, width, height);
    const colors = plotColors(document.documentElement.dataset.theme === "dark");

    g.fillStyle = rgba(colors.panel, 255);
    g.beginPath();
    g.roundRect(0.5, 0.5, width - 1, height - 1, 8);
    g.fill();
    const plot = plotRect({ width, height });
    if (plot.right - plot.left <= 2 || plot.bottom - plot.top <= 2) return;
    g.fillStyle = rgba(colors.plot, 255);
    g.fillRect(plot.left, plot.top, plot.right - plot.left, plot.bottom - plot.top);
    g.strokeStyle = colors.grid;
    g.lineWidth = 1;
    g.strokeRect(plot.left + 0.5, plot.top + 0.5, plot.right - plot.left - 1, plot.bottom - plot.top - 1);

    const clip = () => {
      g.save();
      g.beginPath();
      g.rect(plot.left + 1, plot.top + 1, plot.right - plot.left - 2, plot.bottom - plot.top - 2);
      g.clip();
    };

    // Grid lines and labels on round values: about 6 steps across, 5 up.
    const xStep = niceTickStep(view.xMax - view.xMin, 6);
    const yStep = niceTickStep(view.yMax - view.yMin, 5);
    const xTicks = tickValues(view.xMin, view.xMax, xStep);
    const yTicks = tickValues(view.yMin, view.yMax, yStep);
    clip();
    g.strokeStyle = colors.grid;
    g.beginPath();
    for (const value of xTicks) {
      const x = Math.round(toX(value, plot)) + 0.5;
      g.moveTo(x, plot.top);
      g.lineTo(x, plot.bottom);
    }
    for (const value of yTicks) {
      const y = Math.round(toY(value, plot)) + 0.5;
      g.moveTo(plot.left, y);
      g.lineTo(plot.right, y);
    }
    g.stroke();
    g.restore();
    g.font = PLOT_FONT;
    g.fillStyle = rgba(colors.text, 190);
    g.textBaseline = "middle";
    g.textAlign = "right";
    for (const value of yTicks) g.fillText(tickText(value, yStep), plot.left - 6, toY(value, plot));
    g.textAlign = "center";
    for (const value of xTicks) g.fillText(tickText(value, xStep), toX(value, plot), plot.bottom + 7 + LINE_HEIGHT / 2);

    g.strokeStyle = rgba(colors.text, 145);
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(plot.left, plot.top);
    g.lineTo(plot.left, plot.bottom);
    g.lineTo(plot.right, plot.bottom);
    g.stroke();

    clip();
    g.lineCap = "round";
    g.lineJoin = "round";
    let shown = 0;
    live.forEach((values, index) => {
      if (hidden[index] || !values.length) return;
      shown += values.length;
      const color = colorOf(index);
      const pts = values.map((value, sample) => [toX(sample, plot), toY(value, plot)]);
      if (pts.length === 1) {
        g.fillStyle = color;
        g.beginPath();
        g.arc(pts[0][0], pts[0][1], 2.4, 0, Math.PI * 2);
        g.fill();
        return;
      }
      const gradient = g.createLinearGradient(0, plot.top, 0, plot.bottom);
      gradient.addColorStop(0, withAlpha(color, 48));
      gradient.addColorStop(1, withAlpha(color, 0));
      g.fillStyle = gradient;
      g.beginPath();
      g.moveTo(pts[0][0], plot.bottom);
      for (const [x, y] of pts) g.lineTo(x, y);
      g.lineTo(pts[pts.length - 1][0], plot.bottom);
      g.closePath();
      g.fill();
      g.strokeStyle = color;
      g.lineWidth = 2;
      g.beginPath();
      pts.forEach(([x, y], sample) => (sample ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.stroke();
    });
    if (!shown) {
      g.strokeStyle = rgba(colors.text, 55);
      g.lineWidth = 1.2;
      g.setLineDash([3.6, 3.6]);
      const middle = (plot.top + plot.bottom) / 2;
      g.beginPath();
      g.moveTo(plot.left + 8, middle);
      g.lineTo(plot.right - 8, middle);
      g.stroke();
      g.setLineDash([]);
    }

    // The crosshair over the plot: the nearest sample of each live curve and a label reading them.
    if (hover && hover.x >= plot.left && hover.x <= plot.right && hover.y >= plot.top && hover.y <= plot.bottom) {
      g.strokeStyle = rgba(colors.text, 120);
      g.lineWidth = 1;
      g.setLineDash([4, 2]);
      g.beginPath();
      g.moveTo(Math.round(hover.x) + 0.5, plot.top);
      g.lineTo(Math.round(hover.x) + 0.5, plot.bottom);
      g.moveTo(plot.left, Math.round(hover.y) + 0.5);
      g.lineTo(plot.right, Math.round(hover.y) + 0.5);
      g.stroke();
      g.setLineDash([]);
      const x = fromX(hover.x, plot);
      const xHoverStep = (view.xMax - view.xMin) / 6;
      const yHoverStep = (view.yMax - view.yMin) / 5;
      const lines = [{ text: `x=${tickText(x, xHoverStep)}`, color: rgba(colors.text, colors.textAlpha) }];
      live.forEach((values, index) => {
        if (hidden[index] || !values.length) return;
        const sample = Math.max(0, Math.min(values.length - 1, Math.round(x)));
        const color = colorOf(index);
        g.fillStyle = color;
        g.strokeStyle = rgba(colors.plot, 255);
        g.lineWidth = 3;
        g.beginPath();
        g.arc(toX(sample, plot), toY(values[sample], plot), 4.5, 0, Math.PI * 2);
        g.fill();
        g.stroke();
        lines.push({ text: `${curves[index].name}  ${tickText(values[sample], yHoverStep)}`, color });
      });
      const labelWidth = Math.max(...lines.map((line) => g.measureText(line.text).width)) + 18;
      const labelHeight = LINE_HEIGHT * lines.length + 12;
      let left = hover.x + 10;
      let top = hover.y - labelHeight - 10;
      if (left + labelWidth > plot.right - 4) left = hover.x - labelWidth - 10;
      if (top < plot.top + 4) top = hover.y + 10;
      g.fillStyle = rgba(colors.panel, 235);
      g.beginPath();
      g.roundRect(left, top, labelWidth, labelHeight, 5);
      g.fill();
      g.textAlign = "left";
      lines.forEach((line, index) => {
        g.fillStyle = line.color;
        g.fillText(line.text, left + 9, top + 6 + LINE_HEIGHT * (index + 0.5));
      });
    }
    g.restore();

    // Over it: the loaded run as dashed curves, and the cursor.
    clip();
    g.lineWidth = 2;
    g.setLineDash([8, 4]);
    g.lineCap = "butt";
    refWindows.forEach((values, index) => {
      if (refs[index].hidden || values.length < 2) return;
      g.strokeStyle = colorOf(curves.length + index);
      g.beginPath();
      values.forEach((value, sample) => (sample ? g.lineTo(toX(sample, plot), toY(value, plot)) : g.moveTo(toX(sample, plot), toY(value, plot))));
      g.stroke();
    });
    if (cursor !== null) {
      const x = Math.round(toX(cursor, plot)) + 0.5;
      g.strokeStyle = "rgba(255, 0, 0, 0.706)";
      g.lineWidth = 1;
      g.setLineDash([4, 2]);
      g.beginPath();
      g.moveTo(x, plot.top);
      g.lineTo(x, plot.bottom);
      g.stroke();
    }
    g.restore();
  }

  let lastLive = [];
  let lastRefs = [];

  function render() {
    timer = null;
    if (disposed) return;
    const start = windowStart();
    lastLive = histories.map((history) => history.tail(points));
    lastRefs = refs.map((ref) => ref.values.slice(start, start + points));
    view = fitView([...lastLive.filter((_, index) => !hidden[index]), ...lastRefs.filter((_, index) => !refs[index].hidden)]);
    paint(lastLive, lastRefs);
    if (cursor !== null) showCursor();
    else showLive();
  }

  const repaint = () => paint(lastLive, lastRefs);

  function schedule() {
    if (timer === null && !disposed) timer = setTimeout(render, REFRESH_MS);
  }

  function toggle(index) {
    if (index < curves.length) hidden[index] = !hidden[index];
    else refs[index - curves.length].hidden = !refs[index - curves.length].hidden;
    render();
  }

  // -- the cursor: a click places it, dragging it moves it, a double click takes it away ------

  const pointerAt = (event) => {
    const rect = plotHost.getBoundingClientRect();
    const zoom = rect.width / plotHost.offsetWidth || 1;
    return { x: (event.clientX - rect.left) / zoom, y: (event.clientY - rect.top) / zoom };
  };
  const inPlot = ({ x, y }) => {
    const plot = plotRect(size());
    return x >= plot.left && x <= plot.right && y >= plot.top && y <= plot.bottom;
  };
  const onCursor = (point) => cursor !== null && inPlot(point) && Math.abs(point.x - toX(cursor, plotRect(size()))) <= 4;
  const placeCursor = (px) => {
    const plot = plotRect(size());
    cursor = fromX(Math.max(plot.left, Math.min(plot.right, px)), plot);
    render();
  };

  let dragging = false;
  let pending = null;
  if (interactive) {
    plotHost.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      const point = pointerAt(event);
      if (onCursor(point)) {
        dragging = true;
        plotHost.setPointerCapture(event.pointerId);
      } else if (inPlot(point)) {
        pending = point;
      }
    });
    plotHost.addEventListener("pointermove", (event) => {
      const point = pointerAt(event);
      if (dragging) {
        placeCursor(point.x);
        return;
      }
      if (pending && Math.abs(point.x - pending.x) + Math.abs(point.y - pending.y) >= 4) pending = null;
      plotHost.classList.toggle("on-cursor", onCursor(point));
      hover = point;
      repaint();
    });
    plotHost.addEventListener("pointerup", (event) => {
      if (dragging) {
        dragging = false;
        return;
      }
      if (pending) {
        pending = null;
        placeCursor(pointerAt(event).x);
      }
    });
    plotHost.addEventListener("pointerleave", () => {
      if (dragging) return;
      pending = null;
      hover = null;
      repaint();
    });
    plotHost.addEventListener("dblclick", (event) => {
      if (!inPlot(pointerAt(event))) return;
      cursor = null;
      setMode(i18n("hmi.chart.live"));
      render();
    });
  }

  const resizer = new ResizeObserver(() => repaint());
  resizer.observe(plotHost);
  const themeWatch = new MutationObserver(() => render());
  themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  const commitPoints = () => {
    const typed = Number.parseInt(pointsInput.value.trim(), 10);
    points = Math.max(10, Math.min(HISTORY_LIMIT, Number.isFinite(typed) && String(typed) === pointsInput.value.trim() ? typed : points));
    pointsInput.value = String(points);
    render();
  };
  if (interactive) {
    pointsInput.addEventListener("change", commitPoints);
    pointsInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") commitPoints();
    });
  }

  // Saving: the format is picked from a small menu.
  let menu = null;
  const closeMenu = () => {
    menu?.remove();
    menu = null;
    document.removeEventListener("pointerdown", outside, true);
  };
  const outside = (event) => {
    if (menu && !menu.contains(event.target) && event.target !== saveButton) closeMenu();
  };
  function download(format) {
    closeMenu();
    try {
      const textOut = saveChartFile(curves.map((curve) => curve.name), histories.map((history) => history.values()), format);
      const blob = new Blob([textOut], { type: format === "json" ? "application/json" : "text/csv" });
      const url = URL.createObjectURL(blob);
      const link = el("a");
      link.href = url;
      link.download = `${(title || i18n("hmi.chart.defaultName")).replace(/[\\/:*?"<>|]+/g, "_")}.${format}`;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      setMode(`${i18n("hmi.chart.saveFailed")}${error.message}`, true);
    }
  }
  saveButton.addEventListener("click", () => {
    if (menu) {
      closeMenu();
      return;
    }
    menu = el("div", "hmi-context-menu hmi-chart-menu");
    menu.setAttribute("role", "menu");
    for (const [format, key] of [["csv", "hmi.chart.saveCsv"], ["json", "hmi.chart.saveJson"]]) {
      const item = el("button", "", i18n(key));
      item.type = "button";
      item.setAttribute("role", "menuitem");
      item.addEventListener("click", () => download(format));
      menu.append(item);
    }
    document.body.append(menu);
    const rect = saveButton.getBoundingClientRect();
    const box = menu.getBoundingClientRect();
    menu.style.left = `${Math.max(4, Math.min(rect.right - box.width, window.innerWidth - box.width - 4))}px`;
    menu.style.top = `${rect.top - box.height - 4 > 0 ? rect.top - box.height - 4 : rect.bottom + 4}px`;
    menu.querySelector("button").focus();
    document.addEventListener("pointerdown", outside, true);
  });

  loadButton.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    fileInput.value = "";
    if (!file) return;
    try {
      const { names, values } = parseChartFile(await file.text(), chartFileFormat(file.name));
      const stem = file.name.replace(/\.[^.]*$/, "");
      refs = names.map((name, index) => ({ name: i18n("hmi.chart.refName").replace("{name}", name).replace("{file}", stem), values: values[index], hidden: false }));
      entryWidths.length = curves.length;
      clearButton.hidden = !refs.length;
      render();
    } catch (error) {
      const message = error instanceof ChartFileError ? i18n(`hmi.chart.err.${error.code}`, error.message).replace("{0}", error.args[0] ?? "") : error.message;
      setMode(`${i18n("hmi.chart.loadFailed")}${message}`, true);
    }
  });
  clearButton.addEventListener("click", () => {
    refs = [];
    entryWidths.length = curves.length;
    clearButton.hidden = true;
    render();
  });

  render();
  return {
    append(index, value) {
      try {
        histories[index]?.append(value);
      } catch (error) {
        setMode(`${i18n("hmi.chart.recordFailed")}${error.message}`, true);
        return;
      }
      schedule();
    },
    resize() {
      render();
    },
    dispose() {
      disposed = true;
      clearTimeout(timer);
      closeMenu();
      resizer.disconnect();
      themeWatch.disconnect();
    },
  };
}
