import { getChartCurveHelp } from "./chart-curve-help.js";

const CHART_CURVE_PANEL_COLLAPSED_KEY = "modusignal.chartCurvePanel.collapsed";

export function initChartCurvePanel(options = {}) {
  const {
    elements,
    getDeviceId,
    onVisibilityChange,
  } = options;

  if (!elements?.chartCurveConfigBlock) {
    return;
  }

  const collapsed = loadCollapsedState();
  setChartCurvePanelCollapsed(elements, collapsed);

  elements.chartCurveConfigToggle?.addEventListener("click", () => {
    const nextCollapsed = !elements.chartCurveConfigBlock.classList.contains("collapsed");
    setChartCurvePanelCollapsed(elements, nextCollapsed);
    localStorage.setItem(CHART_CURVE_PANEL_COLLAPSED_KEY, JSON.stringify(nextCollapsed));
    onVisibilityChange?.();
  });

  elements.chartCurveHelpButton?.addEventListener("click", () => {
    openChartCurveHelpDialog(elements, getDeviceId?.());
  });

  elements.chartCurveHelpClose?.addEventListener("click", () => {
    closeChartCurveHelpDialog(elements);
  });

  elements.chartCurveHelpDialog?.addEventListener("click", (event) => {
    if (event.target === elements.chartCurveHelpDialog) {
      closeChartCurveHelpDialog(elements);
    }
  });

  elements.chartCurveHelpDialog?.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeChartCurveHelpDialog(elements);
  });
}

export function updateChartCurvePanel(options = {}) {
  const {
    elements,
    deviceId,
    isDevicePage = false,
    summary = "",
  } = options;

  if (!elements?.chartCurveConfigBlock) {
    return;
  }

  const showPanel = Boolean(isDevicePage && deviceId);
  elements.chartCurveConfigBlock.hidden = !showPanel;

  if (!showPanel) {
    return;
  }

  if (elements.chartCurveConfigSummary) {
    elements.chartCurveConfigSummary.textContent = summary;
  }

  const sectionMap = {
    aomaster: deviceId === "aomaster",
    modbus: deviceId === "modbus",
    hart: deviceId === "hart",
    custom: deviceId === "custom",
    websocket: deviceId === "websocket",
    mqtt: deviceId === "mqtt",
  };

  elements.chartCurveAomasterSection && (elements.chartCurveAomasterSection.hidden = !sectionMap.aomaster);
  elements.chartCurveModbusSection && (elements.chartCurveModbusSection.hidden = !sectionMap.modbus);
  elements.chartCurveHartSection && (elements.chartCurveHartSection.hidden = !sectionMap.hart);
  elements.chartCurveCustomSection && (elements.chartCurveCustomSection.hidden = !sectionMap.custom);
  elements.chartCurveWebsocketSection && (elements.chartCurveWebsocketSection.hidden = !sectionMap.websocket);
  elements.chartCurveMqttSection && (elements.chartCurveMqttSection.hidden = !sectionMap.mqtt);
}

function setChartCurvePanelCollapsed(elements, collapsed) {
  elements.chartCurveConfigBlock.classList.toggle("collapsed", collapsed);
  elements.chartCurveConfigToggle?.setAttribute("aria-expanded", collapsed ? "false" : "true");
  if (elements.chartCurveConfigBody) {
    elements.chartCurveConfigBody.hidden = collapsed;
  }
}

function loadCollapsedState() {
  try {
    const saved = localStorage.getItem(CHART_CURVE_PANEL_COLLAPSED_KEY);
    return saved ? JSON.parse(saved) === true : false;
  } catch {
    return false;
  }
}

function openChartCurveHelpDialog(elements, deviceId) {
  if (!elements.chartCurveHelpDialog) {
    return;
  }

  const help = getChartCurveHelp(deviceId);
  if (elements.chartCurveHelpTitle) {
    elements.chartCurveHelpTitle.textContent = help.title;
  }
  if (elements.chartCurveHelpContent) {
    elements.chartCurveHelpContent.innerHTML = help.html;
  }

  if (typeof elements.chartCurveHelpDialog.showModal === "function") {
    elements.chartCurveHelpDialog.showModal();
  } else {
    elements.chartCurveHelpDialog.hidden = false;
  }
}

function closeChartCurveHelpDialog(elements) {
  if (!elements.chartCurveHelpDialog) {
    return;
  }

  if (typeof elements.chartCurveHelpDialog.close === "function") {
    elements.chartCurveHelpDialog.close();
  } else {
    elements.chartCurveHelpDialog.hidden = true;
  }
}

export function requestChartCurvePanelResize() {
  window.dispatchEvent(new Event("resize"));
}
