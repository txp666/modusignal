import i18n from "../i18n.js";
import {
  requestChartCurvePanelResize,
  updateChartCurvePanel,
} from "../chart-curve-panel.js";
import {
  DEFAULT_CHART_CONFIG,
  getChartPointSettings as resolveChartPointSettings,
  normalizeChartConfig,
} from "../chart-config.js";
import { describeJsonCurveSummary } from "../devices/json-curve-config.js";
import {
  HART_VARIABLE_CARDS,
  normalizeHartConfig,
} from "../devices/hart-device.js";
import {
  listCustomChartSeries,
} from "../devices/custom-device.js";
import {
  listModbusDeviceChartSeries,
} from "../devices/modbus-device.js";
import {
  listMqttChartSeries,
} from "../devices/mqtt-device.js";
import {
  listWebSocketChartSeries,
} from "../devices/websocket-device.js";
import {
  CUSTOM_DEVICE_ID,
  DEFAULT_CUSTOM_CONFIG,
  DEFAULT_DEVICE_ID,
  DEFAULT_MQTT_CONFIG,
  DEFAULT_WEBSOCKET_CONFIG,
  HART_DEVICE_ID,
  MODBUS_DEVICE_ID,
  MQTT_DEVICE_ID,
  WEBSOCKET_DEVICE_ID,
  normalizeCustomConfig,
  normalizeModbusConfig,
  normalizeMqttConfig,
  normalizeWebSocketConfig,
} from "../protocols.js";

const CHART_CONFIG_STORAGE_KEY = "modusignal.chart.v1";
const LEGACY_AOMASTER_CONFIG_STORAGE_KEY = "modusignal.aomasterDevice.v1";

function loadChartConfig() {
  try {
    const saved = localStorage.getItem(CHART_CONFIG_STORAGE_KEY);
    if (saved) return normalizeChartConfig(JSON.parse(saved));

    const legacyAomaster = localStorage.getItem(LEGACY_AOMASTER_CONFIG_STORAGE_KEY);
    if (legacyAomaster) {
      const parsed = JSON.parse(legacyAomaster);
      if (parsed.chartPointCount != null || parsed.visibleChartPointCount != null) {
        return normalizeChartConfig({
          chartPointCount: parsed.chartPointCount,
          visibleChartPointCount: parsed.visibleChartPointCount,
        });
      }
    }
  } catch {
    // Fall through to the normalized defaults when storage is unavailable or invalid.
  }
  return normalizeChartConfig(DEFAULT_CHART_CONFIG);
}

const on = (element, eventName, handler) => element?.addEventListener(eventName, handler);

export function createChartController(options) {
  const {
    elements,
    state,
    getConfigs,
    isDevicePageActive,
    getHartSeriesDefs,
    clearAomasterCharts,
    updateHartVariableCards,
    getCsvController,
    safeUpdateDeviceUi,
    appendLog,
  } = options;

  let config = loadChartConfig();
  let chart = null;
  let hartChart = null;
  let jsonMultiChart = null;
  let setpointChart = null;
  let actualChart = null;
  let allCharts = [];
  let chartsReady = false;
  let configEventsBound = false;
  let LiveChartClass = null;
  let MultiLiveChartClass = null;
  let jsonMultiChartSignature = "";
  let resizeTimer = null;

  function getCharts() {
    return { chart, hartChart, jsonMultiChart, setpointChart, actualChart };
  }

  function getConfig() {
    return config;
  }

  function setConfig(nextConfig) {
    config = normalizeChartConfig(nextConfig);
  }

  function getPointSettings() {
    return resolveChartPointSettings(config);
  }

  function getPointCount() {
    return getPointSettings().totalPointCount;
  }

  async function init() {
    try {
      const { EchartsLiveChart, EchartsMultiLiveChart } = await import("../echarts-charts.js");
      LiveChartClass = EchartsLiveChart;
      MultiLiveChartClass = EchartsMultiLiveChart;
      const pointSettings = getPointSettings();
      chart = new EchartsLiveChart(elements.telemetryChart, {
        maxPoints: pointSettings.totalPointCount,
        visiblePoints: pointSettings.visiblePointCount,
        color: "#0f766e",
        areaColor: "rgba(15, 118, 110, 0.12)",
        emptyText: i18n("chart.emptyText"),
        title: i18n("chart.realTimeChart"),
      });
      setpointChart = new EchartsLiveChart(elements.setpointChartCanvas, {
        maxPoints: pointSettings.totalPointCount,
        visiblePoints: pointSettings.visiblePointCount,
        color: "#2563eb",
        areaColor: "rgba(37, 99, 235, 0.12)",
        emptyText: i18n("chart.emptySetpoint"),
        title: i18n("chart.setpointPreview"),
      });
      actualChart = new EchartsLiveChart(elements.actualChartCanvas, {
        maxPoints: pointSettings.totalPointCount,
        visiblePoints: pointSettings.visiblePointCount,
        color: "#0f766e",
        areaColor: "rgba(15, 118, 110, 0.12)",
        emptyText: i18n("chart.emptyActual"),
        title: i18n("chart.realTimeOutput"),
      });
      allCharts = [chart, setpointChart, actualChart];
      chartsReady = true;
      bindResize();
      safeUpdateDeviceUi();
      requestResize();
    } catch (error) {
      chartsReady = false;
      console.error("initMonitoringCharts failed", error);
      if (elements.chartPanelSummary) {
        elements.chartPanelSummary.textContent = `${i18n("chart.moduleLoadFailed")}${error.message}`;
      }
    }
  }

  function applyPointCountConfig() {
    const pointSettings = getPointSettings();
    allCharts.filter(Boolean).forEach((item) => {
      item.setMaxPoints?.(pointSettings.totalPointCount);
      item.setVisiblePoints?.(pointSettings.visiblePointCount);
    });
    updatePointLabels();
  }

  function buildMultiSeries(configValue, listSeries) {
    return listSeries(configValue).map((series) => ({
      key: series.key,
      name: series.fieldName,
      unit: series.unit,
      color: series.color,
      areaColor: `${series.color}1f`,
      visible: true,
    }));
  }

  const buildMqttSeries = (value = getConfigs().mqttConfig) => buildMultiSeries(value, listMqttChartSeries);
  const buildWebsocketSeries = (value = getConfigs().websocketConfig) => buildMultiSeries(value, listWebSocketChartSeries);
  const buildCustomSeries = (value = getConfigs().customConfig) => buildMultiSeries(value, listCustomChartSeries);
  const buildModbusSeries = (value = getConfigs().modbusConfig) => buildMultiSeries(value, listModbusDeviceChartSeries);

  const shouldUseMqttMultiChart = (value = getConfigs().mqttConfig) => buildMqttSeries(value).length > 1;
  const shouldUseWebsocketMultiChart = (value = getConfigs().websocketConfig) => buildWebsocketSeries(value).length > 1;
  const shouldUseCustomMultiChart = (value = getConfigs().customConfig) => buildCustomSeries(value).length > 1;
  const shouldUseModbusMultiChart = (value = getConfigs().modbusConfig) => buildModbusSeries(value).length > 1;

  function shouldUseJsonMultiChart() {
    if (state.deviceId === MQTT_DEVICE_ID) return shouldUseMqttMultiChart();
    if (state.deviceId === WEBSOCKET_DEVICE_ID) return shouldUseWebsocketMultiChart();
    if (state.deviceId === CUSTOM_DEVICE_ID) return shouldUseCustomMultiChart();
    if (state.deviceId === MODBUS_DEVICE_ID) return shouldUseModbusMultiChart();
    return false;
  }

  function getJsonMultiChartMeta() {
    if (state.deviceId === WEBSOCKET_DEVICE_ID) {
      return { title: i18n("chart.wsChart"), emptyText: i18n("chart.wsEmpty"), seriesDefs: buildWebsocketSeries() };
    }
    if (state.deviceId === CUSTOM_DEVICE_ID) {
      return { title: i18n("chart.serialChart"), emptyText: i18n("chart.serialEmpty"), seriesDefs: buildCustomSeries() };
    }
    if (state.deviceId === MODBUS_DEVICE_ID) {
      return { title: i18n("chart.modbusChart"), emptyText: i18n("chart.modbusEmpty"), seriesDefs: buildModbusSeries() };
    }
    return { title: i18n("chart.mqttChart"), emptyText: i18n("chart.mqttEmpty"), seriesDefs: buildMqttSeries() };
  }

  function disposePrimaryCharts() {
    chart?.dispose();
    hartChart?.dispose();
    jsonMultiChart?.dispose();
    chart = null;
    hartChart = null;
    jsonMultiChart = null;
  }

  function ensureHartChart() {
    if (!chartsReady || !MultiLiveChartClass || !elements.telemetryChart) return;
    if (hartChart) {
      hartChart.setVisibleMap(normalizeHartConfig(getConfigs().hartConfig).chartSeries);
      return;
    }
    disposePrimaryCharts();
    jsonMultiChartSignature = "";
    const pointSettings = getPointSettings();
    hartChart = new MultiLiveChartClass(elements.telemetryChart, {
      maxPoints: pointSettings.totalPointCount,
      visiblePoints: pointSettings.visiblePointCount,
      emptyText: i18n("chart.emptyText"),
      title: i18n("chart.hartVar"),
      series: getHartSeriesDefs(),
    });
    allCharts = [hartChart, setpointChart, actualChart].filter(Boolean);
    applyPointCountConfig();
  }

  function ensureJsonMultiChart() {
    if (!chartsReady || !MultiLiveChartClass || !elements.telemetryChart) return;
    const { title, emptyText, seriesDefs } = getJsonMultiChartMeta();
    const signature = JSON.stringify(seriesDefs.map(({ key, name, color }) => ({ key, name, color })));
    if (jsonMultiChart && jsonMultiChartSignature === signature) return;
    disposePrimaryCharts();
    const pointSettings = getPointSettings();
    jsonMultiChart = new MultiLiveChartClass(elements.telemetryChart, {
      maxPoints: pointSettings.totalPointCount,
      visiblePoints: pointSettings.visiblePointCount,
      emptyText,
      title,
      series: seriesDefs,
    });
    jsonMultiChartSignature = signature;
    allCharts = [jsonMultiChart, setpointChart, actualChart].filter(Boolean);
    applyPointCountConfig();
  }

  function ensureSingleChart() {
    if (!chartsReady || !LiveChartClass || !elements.telemetryChart || chart) return;
    disposePrimaryCharts();
    jsonMultiChartSignature = "";
    const pointSettings = getPointSettings();
    chart = new LiveChartClass(elements.telemetryChart, {
      maxPoints: pointSettings.totalPointCount,
      visiblePoints: pointSettings.visiblePointCount,
      color: "#0f766e",
      areaColor: "rgba(15, 118, 110, 0.12)",
      emptyText: i18n("chart.emptyText"),
      title: i18n("chart.realTimeChart"),
    });
    allCharts = [chart, setpointChart, actualChart].filter(Boolean);
    applyPointCountConfig();
  }

  function handleJsonMultiTelemetry(telemetry) {
    if (telemetry?.isMulti && telemetry.variables) {
      ensureJsonMultiChart();
      jsonMultiChart?.addSample(Object.fromEntries(
        Object.entries(telemetry.variables).map(([key, entry]) => [key, entry.value]),
      ));
      if (elements.chartValue) {
        elements.chartValue.textContent = Object.values(telemetry.variables)
          .map((entry) => `${entry.fieldName} ${entry.value.toFixed(3)}${entry.unit ? ` ${entry.unit}` : ""}`)
          .join(" · ");
      }
      return;
    }
    if (telemetry && Number.isFinite(telemetry.value)) {
      chart?.add(telemetry.value);
      if (elements.chartValue) {
        elements.chartValue.textContent = `${telemetry.fieldName} ${telemetry.value.toFixed(3)}${telemetry.unit ? ` ${telemetry.unit}` : ""}`;
      }
    }
  }

  function describePanelSummary(total, visible) {
    const replaceCounts = (key) => i18n(key).replace("{total}", total).replace("{visible}", visible);
    if (state.deviceId === DEFAULT_DEVICE_ID) return replaceCounts("chart.aomasterDesc");
    if (state.deviceId === HART_DEVICE_ID) return replaceCounts("chart.hartDesc");
    if (state.deviceId === MODBUS_DEVICE_ID) return replaceCounts(shouldUseModbusMultiChart() ? "chart.modbusMultiDesc" : "chart.modbusSingleDesc");
    if (state.deviceId === WEBSOCKET_DEVICE_ID) return replaceCounts(shouldUseWebsocketMultiChart() ? "chart.wsMultiDesc" : "chart.wsSingleDesc");
    if (state.deviceId === MQTT_DEVICE_ID) return replaceCounts(shouldUseMqttMultiChart() ? "chart.mqttMultiDesc" : "chart.mqttSingleDesc");
    if (state.deviceId === CUSTOM_DEVICE_ID) return replaceCounts(shouldUseCustomMultiChart() ? "chart.customMultiDesc" : "chart.customSingleDesc");
    return replaceCounts("chart.defaultDesc");
  }

  function describeParserCurve(normalized, series, defaults) {
    if (series.length > 1) {
      const mode = normalized.parserMode === "hex" ? "HEX" : normalized.parserMode === "modbus" ? "Modbus" : "JSON";
      return i18n("chart.multiCurveCount").replace("{count}", series.length).replace("{mode}", mode);
    }
    if (normalized.parserMode === "hex") return `${i18n("chart.singleCurve")} · HEX ${i18n("chart.hexRaw").split(" · ").pop()}`;
    if (normalized.parserMode === "modbus") return `${i18n("chart.singleCurve")} · ${i18n("chart.modbusPayload").split(" · ").pop()}`;
    return describeJsonCurveSummary(normalized, defaults);
  }

  function describeCurveConfigSummary() {
    const { customConfig, modbusConfig, hartConfig, websocketConfig, mqttConfig } = getConfigs();
    if (state.deviceId === DEFAULT_DEVICE_ID) return i18n("chart.dualCurve");
    if (state.deviceId === MODBUS_DEVICE_ID) {
      const series = listModbusDeviceChartSeries(modbusConfig);
      if (series.length > 1) return i18n("chart.modbusCurveCount").replace("{count}", series.length);
      const normalized = normalizeModbusConfig(modbusConfig);
      return `${i18n("chart.singleCurve")} · ${normalized.fieldName || i18n("chart.registryValue")}`;
    }
    if (state.deviceId === HART_DEVICE_ID) {
      const normalized = normalizeHartConfig(hartConfig);
      const labels = HART_VARIABLE_CARDS.filter((card) => normalized.chartSeries[card.key]).map((card) => card.label);
      return labels.length ? labels.join(" / ") : i18n("chart.notSelected");
    }
    if (state.deviceId === CUSTOM_DEVICE_ID) {
      return describeParserCurve(normalizeCustomConfig(customConfig), listCustomChartSeries(customConfig), DEFAULT_CUSTOM_CONFIG);
    }
    if (state.deviceId === WEBSOCKET_DEVICE_ID) {
      return describeParserCurve(normalizeWebSocketConfig(websocketConfig), listWebSocketChartSeries(websocketConfig), DEFAULT_WEBSOCKET_CONFIG);
    }
    if (state.deviceId === MQTT_DEVICE_ID) {
      return describeParserCurve(normalizeMqttConfig(mqttConfig), listMqttChartSeries(mqttConfig), DEFAULT_MQTT_CONFIG);
    }
    return i18n("chart.singleCurve");
  }

  function syncCurvePanelUi() {
    updateChartCurvePanel({
      elements,
      deviceId: state.deviceId,
      isDevicePage: isDevicePageActive(),
      summary: describeCurveConfigSummary(),
    });
    requestChartCurvePanelResize();
  }

  function updatePointLabels() {
    const { totalPointCount, visiblePointCount } = getPointSettings();
    if (elements.singleChartPointCount) elements.singleChartPointCount.textContent = String(totalPointCount);
    if (elements.singleChartVisiblePointCount) elements.singleChartVisiblePointCount.textContent = String(visiblePointCount);
    if (elements.dualChartPointCount) elements.dualChartPointCount.textContent = String(totalPointCount);
    if (elements.dualChartVisiblePointCount) elements.dualChartVisiblePointCount.textContent = String(visiblePointCount);
    if (elements.chartPointCount) {
      elements.chartPointCount.value = String(totalPointCount);
      elements.chartPointCount.title = i18n("workbench.totalPointsTitle");
    }
    if (elements.visibleChartPointCount) {
      elements.visibleChartPointCount.value = String(visiblePointCount);
      elements.visibleChartPointCount.max = String(totalPointCount);
      elements.visibleChartPointCount.title = i18n("workbench.displayPointsTitle");
    }
    if (elements.chartPanelSummary) elements.chartPanelSummary.textContent = describePanelSummary(totalPointCount, visiblePointCount);
  }

  function syncConfigElements() {
    elements.chartPointCount = document.querySelector("#chartPointCount");
    elements.visibleChartPointCount = document.querySelector("#visibleChartPointCount");
    elements.saveChartConfig = document.querySelector("#saveChartConfig");
    elements.resetChartConfig = document.querySelector("#resetChartConfig");
    elements.exportChartCsv = document.querySelector("#exportChartCsv");
    elements.loadChartCsv = document.querySelector("#loadChartCsv");
    elements.loadChartCsvInput = document.querySelector("#loadChartCsvInput");
  }

  function readConfigForm() {
    syncConfigElements();
    if (!elements.chartPointCount || !elements.visibleChartPointCount) return normalizeChartConfig(config);
    return normalizeChartConfig({
      chartPointCount: elements.chartPointCount.value,
      visibleChartPointCount: elements.visibleChartPointCount.value,
    });
  }

  function populateConfigForm(nextConfig = config) {
    syncConfigElements();
    const normalized = normalizeChartConfig(nextConfig);
    if (!elements.chartPointCount || !elements.visibleChartPointCount) return;
    elements.chartPointCount.value = String(normalized.chartPointCount);
    elements.visibleChartPointCount.value = String(normalized.visibleChartPointCount);
    elements.visibleChartPointCount.max = String(normalized.chartPointCount);
  }

  function updateDraftConfig() {
    config = readConfigForm();
    applyPointCountConfig();
  }

  function saveConfig() {
    config = readConfigForm();
    localStorage.setItem(CHART_CONFIG_STORAGE_KEY, JSON.stringify(config));
    populateConfigForm();
    applyPointCountConfig();
    appendLog("info", i18n("log.chart"), i18n("chart.scaleConfigSaved"));
  }

  function resetConfig() {
    config = normalizeChartConfig(DEFAULT_CHART_CONFIG);
    localStorage.setItem(CHART_CONFIG_STORAGE_KEY, JSON.stringify(config));
    populateConfigForm();
    applyPointCountConfig();
    appendLog("info", i18n("log.chart"), i18n("chart.scaleConfigReset"));
  }

  function bindConfigEvents() {
    syncConfigElements();
    if (configEventsBound) return;
    const controls = [elements.chartPointCount, elements.visibleChartPointCount].filter(Boolean);
    if (!controls.length) return;
    controls.forEach((control) => {
      control.addEventListener("input", updateDraftConfig);
      control.addEventListener("change", updateDraftConfig);
    });
    on(elements.saveChartConfig, "click", saveConfig);
    on(elements.resetChartConfig, "click", resetConfig);
    on(elements.exportChartCsv, "click", () => getCsvController()?.exportCsv());
    on(elements.loadChartCsv, "click", () => getCsvController()?.openPicker());
    on(elements.loadChartCsvInput, "change", (event) => getCsvController()?.loadFile(event));
    configEventsBound = true;
  }

  function bindResize() {
    window.addEventListener("resize", requestResize);
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => requestResize());
    observer.observe(elements.deviceShell);
    document.querySelectorAll("#telemetryChart, #setpointChart, #actualChart, .chart-panel-body")
      .forEach((host) => observer.observe(host));
  }

  function requestResize() {
    if (!chartsReady || !allCharts.length) return;
    if (resizeTimer) window.cancelAnimationFrame(resizeTimer);
    resizeTimer = window.requestAnimationFrame(() => {
      allCharts.filter(Boolean).forEach((item) => item.resize());
      window.requestAnimationFrame(() => allCharts.filter(Boolean).forEach((item) => item.resize()));
    });
  }

  function clearAll() {
    chart?.clear();
    hartChart?.clear();
    jsonMultiChart?.clear();
    clearAomasterCharts();
    if (elements.chartValue) elements.chartValue.textContent = i18n("chart.noData");
    updateHartVariableCards();
    requestResize();
  }

  return {
    applyPointCountConfig,
    bindConfigEvents,
    clearAll,
    ensureHartChart,
    ensureJsonMultiChart,
    ensureSingleChart,
    getConfig,
    getCharts,
    getJsonMultiChartMeta,
    getPointCount,
    getPointSettings,
    handleJsonMultiTelemetry,
    init,
    populateConfigForm,
    requestResize,
    setConfig,
    shouldUseJsonMultiChart,
    syncCurvePanelUi,
    updatePointLabels,
  };
}
