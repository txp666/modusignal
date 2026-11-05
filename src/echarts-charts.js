import * as echarts from "../vendor/echarts.esm.min.js";

const DEFAULT_THEME = {
  grid: "#d7dde4",
  text: "#687381",
  surface: "#ffffff",
  surfaceMuted: "#f6f7f9",
  accent: "#0f766e",
};

function getChartTheme() {
  if (typeof document === "undefined") return DEFAULT_THEME;
  const styles = getComputedStyle(document.documentElement);
  return {
    grid: styles.getPropertyValue("--line").trim() || DEFAULT_THEME.grid,
    text: styles.getPropertyValue("--muted").trim() || DEFAULT_THEME.text,
    surface: styles.getPropertyValue("--surface").trim() || DEFAULT_THEME.surface,
    surfaceMuted: styles.getPropertyValue("--surface-muted").trim() || DEFAULT_THEME.surfaceMuted,
    accent: styles.getPropertyValue("--accent").trim() || DEFAULT_THEME.accent,
  };
}

// Match the overview track to the plot edges and keep the two range grips
// distinct even when a narrow portion of the history is selected.
function buildOverviewZoom({ startValue, endValue, theme, color = theme.accent, areaColor = "rgba(15, 118, 110, 0.12)" }) {
  const range = { xAxisIndex: 0, filterMode: "none", startValue, endValue };
  return [
    { type: "inside", ...range },
    {
      type: "slider",
      ...range,
      left: 48,
      right: 16,
      height: 28,
      bottom: 8,
      backgroundColor: theme.surfaceMuted,
      borderColor: theme.grid,
      fillerColor: areaColor,
      showDataShadow: true,
      dataBackground: {
        lineStyle: { color: theme.text, width: 1, opacity: 0.65 },
        areaStyle: { color: theme.text, opacity: 0.08 },
      },
      selectedDataBackground: {
        lineStyle: { color, width: 1.5, opacity: 1 },
        areaStyle: { color, opacity: 0.15 },
      },
      handleIcon: "path://M2,0H6A2,2,0,0,1,8,2V26A2,2,0,0,1,6,28H2A2,2,0,0,1,0,26V2A2,2,0,0,1,2,0Z",
      handleSize: "100%",
      handleStyle: { color: theme.surface, borderColor: color, borderWidth: 1.5 },
      brushSelect: false,
      moveHandleSize: 0,
      showDetail: false,
      emphasis: {
        handleLabel: { show: false },
        handleStyle: { color: theme.surface, borderColor: color, borderWidth: 2 },
      },
      textStyle: { color: theme.text },
    },
  ];
}

const ECHARTS_SET_OPTION_FLAGS = {
  notMerge: true,
  lazyUpdate: true,
  silent: true,
};

function finiteOr(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function finiteOrNull(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function formatValue(value, decimals = 3) {
  return finiteOr(value, 0).toFixed(decimals);
}

function hostHasSize(host) {
  return Boolean(host && (host.offsetWidth > 0 || host.offsetHeight > 0));
}

function requestFrame(callback) {
  if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
    return window.requestAnimationFrame(callback);
  }

  callback();
  return null;
}

function cancelFrame(frameId) {
  if (
    frameId !== null &&
    typeof window !== "undefined" &&
    typeof window.cancelAnimationFrame === "function"
  ) {
    window.cancelAnimationFrame(frameId);
  }
}

function getFiniteRange(values) {
  let min = Infinity;
  let max = -Infinity;
  let hasValue = false;

  for (const value of values) {
    if (!Number.isFinite(value)) {
      continue;
    }

    hasValue = true;
    if (value < min) {
      min = value;
    }
    if (value > max) {
      max = value;
    }
  }

  return hasValue ? { hasValue, min, max } : { hasValue, min: 0, max: 1 };
}

function getVisibleSeriesRange(seriesDefs, valuesMap, visibleMap) {
  let pointCount = 0;
  let min = Infinity;
  let max = -Infinity;
  let hasValue = false;

  for (const def of seriesDefs) {
    const values = valuesMap[def.key] ?? [];
    pointCount = Math.max(pointCount, values.length);

    if (!visibleMap[def.key]) {
      continue;
    }

    for (const value of values) {
      if (!Number.isFinite(value)) {
        continue;
      }

      hasValue = true;
      if (value < min) {
        min = value;
      }
      if (value > max) {
        max = value;
      }
    }
  }

  return {
    pointCount,
    hasValue,
    min: hasValue ? min : 0,
    max: hasValue ? max : 1,
  };
}

function getIndexCategories(instance, count) {
  if (instance.categoryCacheCount !== count) {
    instance.categoryCacheCount = count;
    instance.categoryCache = Array.from({ length: count }, (_, index) => String(index + 1));
  }

  return instance.categoryCache;
}

function initChartMixin(instance) {
  instance.chart = null;
  instance.pendingRender = false;
  instance.renderFrameId = null;
  instance.categoryCache = [];
  instance.categoryCacheCount = -1;
  instance.themeChangeHandler = () => instance.scheduleRender();
  window.addEventListener?.("modusignal:themechange", instance.themeChangeHandler);

  instance.ensureChart = function ensureChart() {
    if (!this.host) {
      return null;
    }

    if (!this.chart && hostHasSize(this.host)) {
      this.chart = echarts.init(this.host, null, { renderer: "canvas" });
    }

    return this.chart;
  };

  instance.flushPendingRender = function flushPendingRender() {
    if (!this.pendingRender || !this.ensureChart()) {
      return;
    }

    this.pendingRender = false;
    this.render();
  };

  instance.scheduleRender = function scheduleRender() {
    if (this.renderFrameId !== null) {
      return;
    }

    this.renderFrameId = requestFrame(() => {
      this.renderFrameId = null;
      this.render();
    });
  };

  instance.resize = function resize() {
    if (!this.ensureChart()) {
      this.pendingRender = true;
      return;
    }

    this.chart.resize();
    this.flushPendingRender();
    this.scheduleRender();
  };

  instance.dispose = function dispose() {
    cancelFrame(this.renderFrameId);
    this.renderFrameId = null;
    if (this.chart) {
      this.chart.dispose();
      this.chart = null;
    }
    window.removeEventListener?.("modusignal:themechange", this.themeChangeHandler);
    this.pendingRender = false;
    this.zoomListenerBound = false;
  };
}

export class EchartsLiveChart {
  constructor(host, options = {}) {
    this.host = host;
    initChartMixin(this);
    this.maxPoints = options.maxPoints ?? 120;
    this.visiblePoints = options.visiblePoints ?? this.maxPoints;
    this.color = options.color ?? "#0f766e";
    this.areaColor = options.areaColor ?? "rgba(15, 118, 110, 0.12)";
    this.emptyText = options.emptyText ?? "";
    this.title = options.title ?? "";
    this.unit = options.unit ?? "";
    this.values = [];
    this.fixedMin = null;
    this.fixedMax = null;
    this.followLatest = true;
    this.zoomStartValue = null;
    this.zoomEndValue = null;
    this.scheduleRender();
  }

  add(value) {
    this.values.push(finiteOr(value, 0));
    if (this.values.length > this.maxPoints) {
      this.values.shift();
      if (this.zoomStartValue !== null && this.zoomEndValue !== null) {
        this.zoomStartValue = Math.max(0, this.zoomStartValue - 1);
        this.zoomEndValue = Math.max(0, this.zoomEndValue - 1);
      }
    }
    this.scheduleRender();
  }

  setPoints(values) {
    this.values = (values ?? []).map((value) => finiteOr(value, 0));
    this.followLatest = true;
    this.zoomStartValue = null;
    this.zoomEndValue = null;
    this.scheduleRender();
  }

  getPoints() {
    return [...this.values];
  }

  setMaxPoints(maxPoints) {
    const normalized = Math.max(1, Math.trunc(finiteOr(maxPoints, this.maxPoints)));
    if (normalized === this.maxPoints) {
      return;
    }

    this.maxPoints = normalized;
    if (this.values.length > this.maxPoints) {
      this.values = this.values.slice(-this.maxPoints);
    }
    this.scheduleRender();
  }

  setVisiblePoints(visiblePoints) {
    const normalized = Math.max(1, Math.trunc(finiteOr(visiblePoints, this.visiblePoints)));
    if (normalized === this.visiblePoints) {
      return;
    }

    this.visiblePoints = normalized;
    this.followLatest = true;
    this.zoomStartValue = null;
    this.zoomEndValue = null;
    this.scheduleRender();
  }

  clear() {
    this.values = [];
    this.followLatest = true;
    this.zoomStartValue = null;
    this.zoomEndValue = null;
    this.scheduleRender();
  }

  setRange(min, max) {
    if (Number.isFinite(min) && Number.isFinite(max) && min !== max) {
      this.fixedMin = min;
      this.fixedMax = max;
    } else {
      this.fixedMin = null;
      this.fixedMax = null;
    }
    this.scheduleRender();
  }

  setMeta({ title, unit }) {
    if (title !== undefined) {
      this.title = title;
    }
    if (unit !== undefined) {
      this.unit = unit;
    }
    this.scheduleRender();
  }

  render() {
    const chart = this.ensureChart();
    if (!chart) {
      this.pendingRender = true;
      return;
    }
    const theme = getChartTheme();

    if (!this.zoomListenerBound) {
      chart.on("dataZoom", () => this.captureZoomWindow());
      this.zoomListenerBound = true;
    }

    const { hasValue, min: computedMin, max: computedMax } = getFiniteRange(this.values);
    let yMin = this.fixedMin ?? computedMin;
    let yMax = this.fixedMax ?? computedMax;

    if (yMin === yMax) {
      yMin -= 1;
      yMax += 1;
    }

    const categories = getIndexCategories(this, this.values.length);
    const hasData = this.values.length > 0 && hasValue;
    const visiblePoints = Math.max(1, Math.min(this.visiblePoints, this.values.length || this.visiblePoints));
    const hasZoom = hasData && this.values.length > visiblePoints;
    const endValue = this.followLatest || this.zoomEndValue === null
      ? this.values.length - 1
      : Math.min(this.values.length - 1, this.zoomEndValue);
    const startValue = this.followLatest || this.zoomStartValue === null
      ? Math.max(0, endValue - visiblePoints + 1)
      : Math.max(0, Math.min(this.zoomStartValue, endValue));

    chart.setOption(
      {
        animation: false,
        grid: { left: 48, right: 16, top: this.title ? 38 : 18, bottom: hasZoom ? 72 : 30 },
        title: this.title
          ? {
              text: this.title,
              left: 0,
              top: 0,
              textStyle: { color: theme.text, fontSize: 13, fontWeight: 600 },
            }
          : undefined,
        tooltip: {
          trigger: "axis",
          formatter: (params) => {
            const point = params[0];
            if (!point) {
              return "";
            }
            return `${point.axisValue}：${formatValue(point.data)}${this.unit ? ` ${this.unit}` : ""}`;
          },
        },
        xAxis: {
          type: "category",
          boundaryGap: false,
          data: categories,
          axisLine: { show: hasData, lineStyle: { color: theme.grid } },
          axisLabel: { color: theme.text, show: hasData, fontSize: 11, hideOverlap: true, margin: 10 },
          splitLine: { show: false },
        },
        dataZoom: hasZoom
          ? buildOverviewZoom({ startValue, endValue, theme, color: this.color, areaColor: this.areaColor })
          : [],
        yAxis: {
          type: "value",
          show: hasData,
          splitNumber: Math.max(2, Math.min(5, Math.floor((chart.getHeight() - 90) / 50))),
          interval: this.fixedMin !== null && this.fixedMax !== null ? (yMax - yMin) / 4 : undefined,
          min: yMin,
          max: yMax,
          axisLine: { show: false },
          axisLabel: {
            color: theme.text,
            fontSize: 11,
            hideOverlap: true,
            formatter: (value) => formatValue(value, 2),
          },
          splitLine: { lineStyle: { color: theme.grid, type: "dashed" } },
        },
        graphic: hasData
          ? []
          : [
              {
                type: "text",
                left: "center",
                top: "middle",
                style: {
                  text: this.emptyText,
                  fill: theme.text,
                  fontSize: 12,
                  lineHeight: 20,
                  align: "center",
                  width: Math.max(100, chart.getWidth() - 48),
                  overflow: "break",
                },
              },
            ],
        series: [
          {
            type: "line",
            smooth: true,
            showSymbol: false,
            data: this.values,
            lineStyle: { color: this.color, width: 2.5 },
            areaStyle: { color: this.areaColor },
            sampling: this.values.length > 1000 ? "lttb" : undefined,
            progressive: 2000,
            progressiveThreshold: 3000,
          },
        ],
      },
      ECHARTS_SET_OPTION_FLAGS,
    );
  }

  captureZoomWindow() {
    if (!this.chart || !this.values.length) {
      return;
    }

    const zoom = this.chart.getOption()?.dataZoom?.[0];
    if (!zoom) {
      return;
    }

    const endValue = Number.isFinite(Number(zoom.endValue))
      ? Number(zoom.endValue)
      : Math.round(((Number(zoom.end) || 100) / 100) * Math.max(this.values.length - 1, 0));
    const startValue = Number.isFinite(Number(zoom.startValue))
      ? Number(zoom.startValue)
      : Math.round(((Number(zoom.start) || 0) / 100) * Math.max(this.values.length - 1, 0));

    this.zoomStartValue = startValue;
    this.zoomEndValue = endValue;
    this.followLatest = endValue >= this.values.length - 2;
  }
}

export class EchartsMultiLiveChart {
  constructor(host, options = {}) {
    this.host = host;
    initChartMixin(this);
    this.maxPoints = options.maxPoints ?? 120;
    this.visiblePoints = options.visiblePoints ?? this.maxPoints;
    this.emptyText = options.emptyText ?? "";
    this.title = options.title ?? "";
    this.seriesDefs = options.series ?? [];
    this.visible = Object.fromEntries(this.seriesDefs.map((item) => [item.key, item.visible !== false]));
    this.values = Object.fromEntries(this.seriesDefs.map((item) => [item.key, []]));
    this.followLatest = true;
    this.zoomStartValue = null;
    this.zoomEndValue = null;
    this.scheduleRender();
  }

  setSeriesVisible(key, visible) {
    if (!(key in this.visible)) {
      return;
    }

    this.visible[key] = Boolean(visible);
    this.scheduleRender();
  }

  setVisibleMap(visibleMap = {}) {
    for (const def of this.seriesDefs) {
      if (visibleMap[def.key] !== undefined) {
        this.visible[def.key] = Boolean(visibleMap[def.key]);
      }
    }
    this.scheduleRender();
  }

  addSample(sample = {}) {
    for (const def of this.seriesDefs) {
      const value = sample[def.key];
      this.values[def.key].push(Number.isFinite(value) ? value : null);
      if (this.values[def.key].length > this.maxPoints) {
        this.values[def.key].shift();
      }
    }
    this.scheduleRender();
  }

  getSeriesDefs() {
    return this.seriesDefs.map((def) => ({
      ...def,
      visible: this.visible[def.key] !== false,
    }));
  }

  getSeriesValues() {
    return Object.fromEntries(
      this.seriesDefs.map((def) => [def.key, [...(this.values[def.key] ?? [])]]),
    );
  }

  setSeriesData(seriesData = {}) {
    for (const def of this.seriesDefs) {
      const values = Array.isArray(seriesData[def.key]) ? seriesData[def.key] : [];
      this.values[def.key] = values.map((value) => finiteOrNull(value));
    }
    this.followLatest = true;
    this.zoomStartValue = null;
    this.zoomEndValue = null;
    this.scheduleRender();
  }

  setMaxPoints(maxPoints) {
    const normalized = Math.max(1, Math.trunc(finiteOr(maxPoints, this.maxPoints)));
    if (normalized === this.maxPoints) {
      return;
    }

    this.maxPoints = normalized;
    for (const def of this.seriesDefs) {
      if (this.values[def.key].length > this.maxPoints) {
        this.values[def.key] = this.values[def.key].slice(-this.maxPoints);
      }
    }
    this.scheduleRender();
  }

  setVisiblePoints(visiblePoints) {
    const normalized = Math.max(1, Math.trunc(finiteOr(visiblePoints, this.visiblePoints)));
    if (normalized === this.visiblePoints) {
      return;
    }

    this.visiblePoints = normalized;
    this.followLatest = true;
    this.zoomStartValue = null;
    this.zoomEndValue = null;
    this.scheduleRender();
  }

  clear() {
    for (const def of this.seriesDefs) {
      this.values[def.key] = [];
    }
    this.followLatest = true;
    this.zoomStartValue = null;
    this.zoomEndValue = null;
    this.scheduleRender();
  }

  setMeta({ title }) {
    if (title !== undefined) {
      this.title = title;
    }
    this.scheduleRender();
  }

  render() {
    const chart = this.ensureChart();
    if (!chart) {
      this.pendingRender = true;
      return;
    }
    const theme = getChartTheme();

    if (!this.zoomListenerBound) {
      chart.on("dataZoom", () => this.captureZoomWindow());
      this.zoomListenerBound = true;
    }

    const activeSeries = this.seriesDefs.filter((def) => this.visible[def.key]);
    const {
      pointCount,
      hasValue,
      min: computedMin,
      max: computedMax,
    } = getVisibleSeriesRange(this.seriesDefs, this.values, this.visible);
    const categories = getIndexCategories(this, pointCount);
    let yMin = computedMin;
    let yMax = computedMax;

    if (yMin === yMax) {
      yMin -= 1;
      yMax += 1;
    }

    const hasData = pointCount > 0 && hasValue;
    const visiblePoints = Math.max(1, Math.min(this.visiblePoints, pointCount || this.visiblePoints));
    const hasZoom = hasData && pointCount > visiblePoints;
    const endValue = this.followLatest || this.zoomEndValue === null ? pointCount - 1 : Math.min(pointCount - 1, this.zoomEndValue);
    const startValue = this.followLatest || this.zoomStartValue === null
      ? Math.max(0, endValue - visiblePoints + 1)
      : Math.max(0, Math.min(this.zoomStartValue, endValue));

    chart.setOption(
      {
        animation: false,
        grid: { left: 48, right: 16, top: 48, bottom: hasZoom ? 72 : 28 },
        title: this.title
          ? {
              text: this.title,
              left: 0,
              top: 0,
              textStyle: { color: theme.text, fontSize: 13, fontWeight: 600 },
            }
          : undefined,
        legend: {
          top: 18,
          textStyle: { color: theme.text, fontSize: 12 },
          data: activeSeries.map((def) => def.name),
        },
        tooltip: {
          trigger: "axis",
          formatter: (params) =>
            params
              .filter((point) => point.data !== null && point.data !== undefined)
              .map((point) => `${point.seriesName}：${formatValue(point.data)}`)
              .join("<br/>"),
        },
        xAxis: {
          type: "category",
          boundaryGap: false,
          data: categories,
          axisLine: { show: hasData, lineStyle: { color: theme.grid } },
          axisLabel: { color: theme.text, show: hasData, fontSize: 11, hideOverlap: true, margin: 10 },
          splitLine: { show: false },
        },
        dataZoom: hasZoom
          ? buildOverviewZoom({ startValue, endValue, theme })
          : [],
        yAxis: {
          type: "value",
          show: hasData,
          splitNumber: Math.max(2, Math.min(5, Math.floor((chart.getHeight() - 90) / 50))),
          min: yMin,
          max: yMax,
          axisLine: { show: false },
          axisLabel: {
            color: theme.text,
            fontSize: 11,
            hideOverlap: true,
            formatter: (value) => formatValue(value, 2),
          },
          splitLine: { lineStyle: { color: theme.grid, type: "dashed" } },
        },
        graphic: hasData
          ? []
          : [
              {
                type: "text",
                left: "center",
                top: "middle",
                style: {
                  text: this.emptyText,
                  fill: theme.text,
                  fontSize: 12,
                  lineHeight: 20,
                  align: "center",
                  width: Math.max(100, chart.getWidth() - 48),
                  overflow: "break",
                },
              },
            ],
        series: this.seriesDefs
          .filter((def) => this.visible[def.key])
          .map((def) => ({
            name: def.name,
            type: "line",
            smooth: true,
            showSymbol: false,
            data: this.values[def.key],
            lineStyle: { color: def.color, width: 2.5 },
            itemStyle: { color: def.color },
            areaStyle: def.areaColor ? { color: def.areaColor } : undefined,
            connectNulls: false,
            sampling: pointCount > 1000 ? "lttb" : undefined,
            progressive: 2000,
            progressiveThreshold: 3000,
          })),
      },
      ECHARTS_SET_OPTION_FLAGS,
    );
  }

  captureZoomWindow() {
    if (!this.chart) {
      return;
    }

    const pointCount = Math.max(0, ...this.seriesDefs.map((def) => this.values[def.key].length));
    if (!pointCount) {
      return;
    }

    const zoom = this.chart.getOption()?.dataZoom?.[0];
    if (!zoom) {
      return;
    }

    const endValue = Number.isFinite(Number(zoom.endValue))
      ? Number(zoom.endValue)
      : Math.round(((Number(zoom.end) || 100) / 100) * Math.max(pointCount - 1, 0));
    const startValue = Number.isFinite(Number(zoom.startValue))
      ? Number(zoom.startValue)
      : Math.round(((Number(zoom.start) || 0) / 100) * Math.max(pointCount - 1, 0));

    this.zoomStartValue = startValue;
    this.zoomEndValue = endValue;
    this.followLatest = endValue >= pointCount - 2;
  }
}

export function resizeAllCharts(charts) {
  charts.filter(Boolean).forEach((chart) => chart.resize());
}
