import { getChartCurveHelp } from "./chart-curve-help.js";

export function initChartCurvePanel(options = {}) {
  const {
    elements,
    getDeviceId,
    onVisibilityChange,
  } = options;

  if (!elements?.chartCurveConfigBlock) {
    return;
  }

  const dialog = elements.chartCurveConfigDialog;
  elements.chartCurveConfigToggle?.addEventListener("click", () => {
    if (dialog && !dialog.open) dialog.showModal();
  });
  elements.chartCurveConfigClose?.addEventListener("click", () => dialog?.close());
  dialog?.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog?.addEventListener("close", () => {
    elements.chartCurveConfigToggle?.focus({ preventScroll: true });
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

  if (!showPanel || elements.chartCurveConfigDialog?.dataset.deviceId !== deviceId) {
    elements.chartCurveConfigDialog?.close();
    elements.chartCurveHelpDialog?.close();
  }
  if (elements.chartCurveConfigDialog) elements.chartCurveConfigDialog.dataset.deviceId = deviceId || "";
  if (!showPanel) return;

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
