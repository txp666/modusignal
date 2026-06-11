import * as echarts from "../vendor/echarts.esm.min.js";

const THEME = {
  grid: "#d7dde4",
  text: "#687381",
  surface: "#fbfcfd",
};

function finiteOr(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function formatValue(value, decimals = 3) {
  return finiteOr(value, 0).toFixed(decimals);
}

function hostHasSize(host) {
  return Boolean(host && (host.offsetWidth > 0 || host.offsetHeight > 0));
}

function initChartMixin(instance) {
  instance.chart = null;
  instance.pendingRender = false;

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

  instance.resize = function resize() {
    if (!this.ensureChart()) {
      this.pendingRender = true;
      return;
    }

    this.chart.resize();
    this.flushPendingRender();
  };

  instance.dispose = function dispose() {
    if (this.chart) {
      this.chart.dispose();
      this.chart = null;
    }
    this.pendingRender = false;
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
    this.emptyText = options.emptyText ?? "等待数据";
    this.title = options.title ?? "";
    this.unit = options.unit ?? "";
    this.values = [];
    this.fixedMin = null;
    this.fixedMax = null;
    this.followLatest = true;
    this.zoomStartValue = null;
    this.zoomEndValue = null;
    this.render();
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
    this.render();
  }

  setPoints(values) {
    this.values = (values ?? []).map((value) => finiteOr(value, 0));
    this.followLatest = true;
    this.zoomStartValue = null;
    this.zoomEndValue = null;
    this.render();
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
    this.render();
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
    this.render();
  }

  clear() {
    this.values = [];
    this.followLatest = true;
    this.zoomStartValue = null;
    this.zoomEndValue = null;
    this.render();
  }

  setRange(min, max) {
    if (Number.isFinite(min) && Number.isFinite(max) && min !== max) {
      this.fixedMin = min;
      this.fixedMax = max;
    } else {
      this.fixedMin = null;
      this.fixedMax = null;
    }
    this.render();
  }

  setMeta({ title, unit }) {
    if (title !== undefined) {
      this.title = title;
    }
    if (unit !== undefined) {
      this.unit = unit;
    }
    this.render();
  }

  render() {
    const chart = this.ensureChart();
    if (!chart) {
      this.pendingRender = true;
      return;
    }

    if (!this.zoomListenerBound) {
      chart.on("dataZoom", () => this.captureZoomWindow());
      this.zoomListenerBound = true;
    }

    const computedMin = this.values.length ? Math.min(...this.values) : 0;
    const computedMax = this.values.length ? Math.max(...this.values) : 1;
    let yMin = this.fixedMin ?? computedMin;
    let yMax = this.fixedMax ?? computedMax;

    if (yMin === yMax) {
      yMin -= 1;
      yMax += 1;
    }

    const categories = this.values.map((_, index) => String(index + 1));
    const hasData = this.values.length > 0;
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
        grid: { left: 48, right: 18, top: 36, bottom: hasZoom ? 54 : 28 },
        title: this.title
          ? {
              text: this.title,
              left: 0,
              top: 0,
              textStyle: { color: THEME.text, fontSize: 13, fontWeight: 600 },
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
          axisLine: { lineStyle: { color: THEME.grid } },
          axisLabel: { color: THEME.text, show: hasData },
          splitLine: { show: false },
        },
        dataZoom: hasZoom
          ? [
              {
                type: "inside",
                xAxisIndex: 0,
                filterMode: "none",
                startValue,
                endValue,
              },
              {
                type: "slider",
                xAxisIndex: 0,
                filterMode: "none",
                startValue,
                endValue,
                height: 18,
                bottom: 8,
                borderColor: "#cbd5df",
                fillerColor: "rgba(15, 118, 110, 0.12)",
                handleStyle: { color: this.color },
                textStyle: { color: THEME.text },
              },
            ]
          : [],
        yAxis: {
          type: "value",
          min: yMin,
          max: yMax,
          axisLine: { show: false },
          axisLabel: {
            color: THEME.text,
            formatter: (value) => formatValue(value, 2),
          },
          splitLine: { lineStyle: { color: THEME.grid, type: "dashed" } },
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
                  fill: THEME.text,
                  fontSize: 14,
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
          },
        ],
      },
      true,
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
    this.emptyText = options.emptyText ?? "连接设备并开启轮询后显示实时曲线";
    this.title = options.title ?? "HART 变量曲线";
    this.seriesDefs = options.series ?? [];
    this.visible = Object.fromEntries(this.seriesDefs.map((item) => [item.key, item.visible !== false]));
    this.values = Object.fromEntries(this.seriesDefs.map((item) => [item.key, []]));
    this.followLatest = true;
    this.zoomStartValue = null;
    this.zoomEndValue = null;
    this.render();
  }

  setSeriesVisible(key, visible) {
    if (!(key in this.visible)) {
      return;
    }

    this.visible[key] = Boolean(visible);
    this.render();
  }

  setVisibleMap(visibleMap = {}) {
    for (const def of this.seriesDefs) {
      if (visibleMap[def.key] !== undefined) {
        this.visible[def.key] = Boolean(visibleMap[def.key]);
      }
    }
    this.render();
  }

  addSample(sample = {}) {
    for (const def of this.seriesDefs) {
      const value = sample[def.key];
      this.values[def.key].push(Number.isFinite(value) ? value : null);
      if (this.values[def.key].length > this.maxPoints) {
        this.values[def.key].shift();
      }
    }
    this.render();
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
    this.render();
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
    this.render();
  }

  clear() {
    for (const def of this.seriesDefs) {
      this.values[def.key] = [];
    }
    this.followLatest = true;
    this.zoomStartValue = null;
    this.zoomEndValue = null;
    this.render();
  }

  setMeta({ title }) {
    if (title !== undefined) {
      this.title = title;
    }
    this.render();
  }

  render() {
    const chart = this.ensureChart();
    if (!chart) {
      this.pendingRender = true;
      return;
    }

    if (!this.zoomListenerBound) {
      chart.on("dataZoom", () => this.captureZoomWindow());
      this.zoomListenerBound = true;
    }

    const activeSeries = this.seriesDefs.filter((def) => this.visible[def.key]);
    const pointCount = Math.max(0, ...this.seriesDefs.map((def) => this.values[def.key].length));
    const categories = Array.from({ length: pointCount }, (_, index) => String(index + 1));
    const numericValues = activeSeries.flatMap((def) =>
      this.values[def.key].filter((value) => Number.isFinite(value)),
    );
    const computedMin = numericValues.length ? Math.min(...numericValues) : 0;
    const computedMax = numericValues.length ? Math.max(...numericValues) : 1;
    let yMin = computedMin;
    let yMax = computedMax;

    if (yMin === yMax) {
      yMin -= 1;
      yMax += 1;
    }

    const hasData = pointCount > 0 && numericValues.length > 0;
    const visiblePoints = Math.max(1, Math.min(this.visiblePoints, pointCount || this.visiblePoints));
    const hasZoom = hasData && pointCount > visiblePoints;
    const endValue = this.followLatest || this.zoomEndValue === null ? pointCount - 1 : Math.min(pointCount - 1, this.zoomEndValue);
    const startValue = this.followLatest || this.zoomStartValue === null
      ? Math.max(0, endValue - visiblePoints + 1)
      : Math.max(0, Math.min(this.zoomStartValue, endValue));

    chart.setOption(
      {
        animation: false,
        grid: { left: 48, right: 18, top: 48, bottom: hasZoom ? 54 : 28 },
        title: this.title
          ? {
              text: this.title,
              left: 0,
              top: 0,
              textStyle: { color: THEME.text, fontSize: 13, fontWeight: 600 },
            }
          : undefined,
        legend: {
          top: 18,
          textStyle: { color: THEME.text, fontSize: 12 },
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
          axisLine: { lineStyle: { color: THEME.grid } },
          axisLabel: { color: THEME.text, show: hasData },
          splitLine: { show: false },
        },
        dataZoom: hasZoom
          ? [
              { type: "inside", xAxisIndex: 0, filterMode: "none", startValue, endValue },
              {
                type: "slider",
                xAxisIndex: 0,
                filterMode: "none",
                startValue,
                endValue,
                height: 18,
                bottom: 8,
                borderColor: "#cbd5df",
                fillerColor: "rgba(15, 118, 110, 0.12)",
                textStyle: { color: THEME.text },
              },
            ]
          : [],
        yAxis: {
          type: "value",
          min: yMin,
          max: yMax,
          axisLine: { show: false },
          axisLabel: {
            color: THEME.text,
            formatter: (value) => formatValue(value, 2),
          },
          splitLine: { lineStyle: { color: THEME.grid, type: "dashed" } },
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
                  fill: THEME.text,
                  fontSize: 14,
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
          })),
      },
      true,
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
