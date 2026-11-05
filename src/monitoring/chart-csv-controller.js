import i18n from "../i18n.js";
import {
  DEFAULT_DEVICE_ID,
  HART_DEVICE_ID,
  MQTT_DEVICE_ID,
  WEBSOCKET_DEVICE_ID,
  getModeConfig,
  normalizeMqttConfig,
  normalizeWebSocketConfig,
} from "../protocols.js";
import { normalizeChartConfig } from "../chart-config.js";
import {
  buildChartCsvFilename,
  buildChartCsvText,
  formatImportedDualReadout,
  formatImportedMultiReadout,
  formatImportedSingleReadout,
  getFiniteSeriesExtent,
  getLastFiniteValue,
  parseChartCsvText,
  resolveImportedSeriesKey,
  triggerChartCsvDownload,
} from "./chart-csv.js";

export function createChartCsvController(options) {
  const {
    elements,
    state,
    getConfigs,
    getCharts,
    getChartPointSettings,
    getAomasterDisplayUnit,
    getAomasterActualMode,
    getHartSeriesDefs,
    shouldUseJsonMultiChart,
    getJsonMultiChartMeta,
    ensureHartChart,
    ensureJsonMultiChart,
    ensureSingleChart,
    getChartConfig,
    setChartConfig,
    populateChartConfigForm,
    applyChartPointCountConfig,
    updateHartVariableCards,
    requestChartResize,
    appendLog,
  } = options;

  function getSingleSeriesMeta() {
    const { websocketConfig, mqttConfig, customConfig, modbusConfig } = getConfigs();
    const { chart } = getCharts();
    if (state.deviceId === WEBSOCKET_DEVICE_ID) {
      const normalized = normalizeWebSocketConfig(websocketConfig);
      return { key: "value", name: normalized.fieldName || "value", unit: normalized.unit || "" };
    }
    if (state.deviceId === MQTT_DEVICE_ID) {
      const normalized = normalizeMqttConfig(mqttConfig);
      return { key: "value", name: normalized.fieldName || "value", unit: normalized.unit || "" };
    }
    const config = getModeConfig(state.mode, state.deviceId, customConfig, modbusConfig);
    return {
      key: "value",
      name: config.fieldName || chart?.title || "value",
      unit: config.unit || chart?.unit || "",
    };
  }

  function resolveTarget() {
    const { chart, hartChart, jsonMultiChart, setpointChart, actualChart } = getCharts();
    if (state.deviceId === DEFAULT_DEVICE_ID) {
      return {
        kind: "dual",
        title: i18n("chart.aomasterDual"),
        charts: { setpoint: setpointChart, actual: actualChart },
        series: [
          { key: "setpoint", name: i18n("chart.setpointPreview"), unit: getAomasterDisplayUnit() },
          { key: "actual", name: i18n("chart.realTimeOutput"), unit: getAomasterDisplayUnit(getAomasterActualMode()) },
        ],
      };
    }
    if (state.deviceId === HART_DEVICE_ID) {
      ensureHartChart();
      const current = getCharts().hartChart;
      return {
        kind: "multi",
        title: i18n("chart.hartVar"),
        chart: current,
        series: current?.getSeriesDefs?.() ?? getHartSeriesDefs(),
      };
    }
    if (shouldUseJsonMultiChart()) {
      ensureJsonMultiChart();
      const meta = getJsonMultiChartMeta();
      const current = getCharts().jsonMultiChart;
      return {
        kind: "multi",
        title: meta.title,
        chart: current,
        series: current?.getSeriesDefs?.() ?? meta.seriesDefs,
      };
    }
    ensureSingleChart();
    const current = getCharts().chart;
    return {
      kind: "single",
      title: current?.title || i18n("chart.realTimeChart"),
      chart: current,
      series: [getSingleSeriesMeta()],
    };
  }

  function buildContext(target) {
    if (target.kind === "single") {
      return {
        kind: target.kind,
        title: target.title,
        series: [{ ...target.series[0], values: target.chart?.getPoints?.() ?? [] }],
      };
    }
    if (target.kind === "dual") {
      return {
        kind: target.kind,
        title: target.title,
        series: [
          { ...target.series[0], values: target.charts.setpoint?.getPoints?.() ?? [] },
          { ...target.series[1], values: target.charts.actual?.getPoints?.() ?? [] },
        ],
      };
    }
    const valuesMap = target.chart?.getSeriesValues?.() ?? {};
    return {
      kind: target.kind,
      title: target.title,
      series: target.series.map((series) => ({ ...series, values: valuesMap[series.key] ?? [] })),
    };
  }

  function exportCsv() {
    const context = buildContext(resolveTarget());
    const { text, pointCount } = buildChartCsvText(context, state.deviceId);
    triggerChartCsvDownload(buildChartCsvFilename(state.deviceId), text);
    appendLog(
      "info",
      i18n("log.chart"),
      `${i18n("chart.csvExport")}: ${context.series.length} ${i18n("num.curves", "curves")}, ${pointCount} ${i18n("num.points", "points")}`,
    );
  }

  function ensureCapacity(pointCount) {
    const settings = getChartPointSettings();
    if (pointCount <= settings.totalPointCount) return;
    const next = normalizeChartConfig({
      ...getChartConfig(),
      chartPointCount: pointCount,
      visibleChartPointCount: Math.min(settings.visiblePointCount, pointCount),
    });
    setChartConfig(next);
    populateChartConfigForm(next);
    applyChartPointCountConfig();
  }

  function importCsv(parsed, sourceName = "CSV") {
    const target = resolveTarget();
    ensureCapacity(parsed.pointCount);
    if (target.kind === "single") {
      const series = target.series[0];
      const sourceKey = resolveImportedSeriesKey(parsed, series, 0);
      const values = (sourceKey ? parsed.seriesData[sourceKey] ?? [] : []).filter(Number.isFinite);
      target.chart?.setPoints(values);
      if (elements.chartValue) {
        elements.chartValue.textContent = formatImportedSingleReadout(series, values, parsed.pointCount);
      }
    } else if (target.kind === "dual") {
      const [setpointSeries, actualSeries] = target.series;
      const setpointKey = resolveImportedSeriesKey(parsed, setpointSeries, 0);
      const actualKey = resolveImportedSeriesKey(parsed, actualSeries, 1);
      const setpointValues = (setpointKey ? parsed.seriesData[setpointKey] ?? [] : []).filter(Number.isFinite);
      const actualValues = (actualKey ? parsed.seriesData[actualKey] ?? [] : []).filter(Number.isFinite);
      target.charts.setpoint?.setPoints(setpointValues);
      target.charts.actual?.setPoints(actualValues);
      target.charts.setpoint?.setMeta({ unit: setpointSeries.unit });
      target.charts.actual?.setMeta({ unit: actualSeries.unit });
      const extent = getFiniteSeriesExtent([setpointValues, actualValues]);
      if (extent) {
        target.charts.setpoint?.setRange(extent.min, extent.max);
        target.charts.actual?.setRange(extent.min, extent.max);
      }
      if (elements.setpointChartValue) {
        elements.setpointChartValue.textContent = formatImportedDualReadout(setpointValues, setpointSeries.unit, parsed.pointCount);
      }
      if (elements.actualChartValue) {
        elements.actualChartValue.textContent = formatImportedDualReadout(actualValues, actualSeries.unit, parsed.pointCount);
      }
    } else {
      const importedSeriesData = Object.fromEntries(target.series.map((series, index) => {
        const sourceKey = resolveImportedSeriesKey(parsed, series, index);
        return [series.key, sourceKey ? parsed.seriesData[sourceKey] ?? [] : []];
      }));
      target.chart?.setSeriesData(importedSeriesData);
      if (elements.chartValue) {
        elements.chartValue.textContent = formatImportedMultiReadout(target.series, importedSeriesData, parsed.pointCount);
      }
      if (state.deviceId === HART_DEVICE_ID) {
        updateHartVariableCards(Object.fromEntries(target.series.map((series) => {
          const value = getLastFiniteValue(importedSeriesData[series.key] ?? []);
          return Number.isFinite(value) ? [series.key, { value, unit: series.unit || "" }] : null;
        }).filter(Boolean)));
      }
    }
    requestChartResize();
    appendLog(
      "info",
      i18n("log.chart"),
      i18n("log.curveLoaded")
        .replace("{name}", sourceName)
        .replace("{series}", target.series.length)
        .replace("{points}", parsed.pointCount),
    );
  }

  function openPicker() {
    elements.loadChartCsvInput?.click();
  }

  async function loadFile(event) {
    const [file] = Array.from(event.target?.files ?? []);
    if (!file) return;
    try {
      importCsv(parseChartCsvText(await file.text()), file.name);
    } catch (error) {
      appendLog("error", i18n("log.chart"), error.message);
    } finally {
      event.target.value = "";
    }
  }

  return { exportCsv, importCsv, loadFile, openPicker };
}
