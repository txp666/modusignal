import i18n from "../i18n.js";
import { initChartCurvePanel } from "../chart-curve-panel.js";
import { buildDefaultStepSequence } from "../devices/aomaster.js";
import { WEBSOCKET_QUICK_MESSAGES } from "../devices/websocket-device.js";
import { MQTT_QUICK_MESSAGES } from "../devices/mqtt-device.js";
import { CUSTOM_DEVICE_ID, MODBUS_DEVICE_ID, MQTT_DEVICE_ID, WEBSOCKET_DEVICE_ID, getModeConfig } from "../protocols.js";

const on = (element, eventName, handler) => element?.addEventListener(eventName, handler);

function bindProductDialog(openButton, dialog, closeButton) {
  const open = () => typeof dialog?.showModal === "function" ? dialog.showModal() : dialog?.setAttribute("open", "");
  const close = () => typeof dialog?.close === "function" ? dialog.close() : dialog?.removeAttribute("open");
  on(openButton, "click", open);
  on(closeButton, "click", close);
  on(dialog, "click", (event) => {
    if (event.target === dialog || event.target.closest("[data-page-target]")) close();
  });
}

export function bindAppEvents(options) {
  const {
    elements,
    state,
    getConfigs,
    sidebarController,
    transportController,
    pollingController,
    deviceNavigationUi,
    aomasterWaveformUi,
    customConfigUi,
    modbusConfigUi,
    websocketConfigUi,
    mqttConfigUi,
    debugCurveController,
    hartConfigUi,
    hartSessionController,
    hartWorkspaceController,
    hartMonitorController,
    handlers,
  } = options;
  const {
    requestChartResize,
    updateSetpoint,
    sendDeviceCommand,
    sendManualCommand,
    copyRequestTemplate,
    sendWebSocketQuickMessage,
    sendMqttQuickMessage,
    loadMessageIntoManualSender,
    resetRxLogCoalesce,
    appendLog,
    clearAllCharts,
    selectDevice,
    navigateToPage,
    updateDeviceUi,
    updateSetpointUi,
    setAomasterValueDisplayMode,
    testDeviceParser,
    updateModbusDraftConfig,
    saveModbusConfig,
    resetModbusConfig,
    updateHartDraftConfig,
    saveHartConfig,
    resetHartConfig,
    readWebsocketHeartbeatPreset,
    readMqttHeartbeatPreset,
    getAomasterConfigControls,
    updateAomasterDraftConfig,
    saveAomasterConfig,
    resetAomasterConfig,
    bindChartConfigEvents,
  } = handlers;

  sidebarController.bind();
  initChartCurvePanel({ elements, getDeviceId: () => state.deviceId, onVisibilityChange: requestChartResize });
  on(elements.connectButton, "click", transportController.connect);
  on(elements.disconnectButton, "click", transportController.disconnect);
  on(elements.transportSelect, "change", (event) => transportController.setTransport(event.target.value));
  on(elements.deviceShell, "input", (event) => {
    if (event.target.matches('[data-field="setpointSlider"]')) updateSetpoint(Number(event.target.value));
  });
  on(elements.deviceShell, "change", (event) => {
    if (event.target.matches('[data-field="setpointInput"]')) updateSetpoint(Number(event.target.value));
  });
  on(elements.deviceShell, "click", (event) => {
    const workspaceTab = event.target.closest("[data-hart-workspace-tab]");
    if (workspaceTab) {
      hartWorkspaceController.switchWorkspace(workspaceTab.dataset.hartWorkspaceTab);
      return;
    }
    const workspaceAction = event.target.closest("[data-hart-workspace-action]");
    if (workspaceAction) {
      hartWorkspaceController.handleAction(workspaceAction.dataset.hartWorkspaceAction)
        .catch((error) => appendLog("error", "HART", error.message));
      return;
    }
    if (event.target.closest('[data-field="sendDriverCommand"]')) {
      sendDeviceCommand();
      return;
    }
    const quickActions = [
      ["[data-ws-quick-send]", "wsQuickSend", WEBSOCKET_QUICK_MESSAGES, sendWebSocketQuickMessage],
      ["[data-mqtt-quick-send]", "mqttQuickSend", MQTT_QUICK_MESSAGES, sendMqttQuickMessage],
    ];
    for (const [selector, dataKey, presets, send] of quickActions) {
      const target = event.target.closest(selector);
      if (target) {
        const preset = presets.find((item) => item.id === target.dataset[dataKey]);
        if (preset) send(preset).catch((error) => appendLog("error", i18n("log.send"), error.message));
        return;
      }
    }
    const loadActions = [
      ["[data-ws-load-preset]", "wsLoadPreset", WEBSOCKET_QUICK_MESSAGES],
      ["[data-mqtt-load-preset]", "mqttLoadPreset", MQTT_QUICK_MESSAGES],
    ];
    for (const [selector, dataKey, presets] of loadActions) {
      const target = event.target.closest(selector);
      if (target) {
        const preset = presets.find((item) => item.id === target.dataset[dataKey]);
        if (preset) loadMessageIntoManualSender(preset);
        return;
      }
    }
    const preset = event.target.closest("[data-preset]");
    if (preset) {
      const { customConfig, modbusConfig } = getConfigs();
      updateSetpoint(getModeConfig(state.mode, state.deviceId, customConfig, modbusConfig).presets[preset.dataset.preset]);
    }
  });

  on(elements.sendManual, "click", sendManualCommand);
  on(elements.copyRequestTemplate, "click", copyRequestTemplate);
  bindProductDialog(elements.openAomasterProductDialog, elements.aomasterProductDialog, elements.closeAomasterProductDialog);
  bindProductDialog(elements.openHartlinkProductDialog, elements.hartlinkProductDialog, elements.closeHartlinkProductDialog);
  on(elements.clearLog, "click", () => {
    resetRxLogCoalesce();
    elements.serialLog.innerHTML = "";
    appendLog("info", i18n("log.system"), i18n("log.logCleared"));
  });
  on(elements.clearChart, "click", () => {
    clearAllCharts();
    appendLog("info", i18n("log.system"), i18n("log.chartCleared"));
  });
  on(elements.togglePolling, "click", pollingController.toggle);
  on(elements.appShell, "click", (event) => {
    const target = event.target.closest("[data-page-target]");
    if (!target) return;
    if (target.dataset.deviceId) selectDevice(target.dataset.deviceId);
    else navigateToPage(target.dataset.pageTarget);
  });

  on(elements.outputModeSelect, "change", () => {
    state.mode = elements.outputModeSelect.value;
    aomasterWaveformUi.applyModeDefaults();
    aomasterWaveformUi.clearCharts();
    aomasterWaveformUi.syncChartRanges();
    updateDeviceUi();
  });
  on(elements.waveformSelect, "change", () => {
    state.waveform = elements.waveformSelect.value;
    if (state.waveform === "step" && state.stepSequence.length < 2) state.stepSequence = buildDefaultStepSequence(state.mode);
    aomasterWaveformUi.updateUi();
    aomasterWaveformUi.renderStepSequence();
    aomasterWaveformUi.refreshPreview();
    updateSetpointUi();
  });
  elements.aomasterValueDisplayMode?.forEach((control) => on(control, "change", () => {
    if (control.checked) setAomasterValueDisplayMode(control.value);
  }));
  aomasterWaveformUi.getWaveControls().filter(Boolean).forEach((control) => {
    on(control, "input", aomasterWaveformUi.updateDraft);
    on(control, "change", aomasterWaveformUi.updateDraft);
  });
  document.querySelectorAll("[data-wave-preset]").forEach((button) => on(button, "click", () => aomasterWaveformUi.applyWavePreset(button.dataset.wavePreset)));
  on(elements.addStepButton, "click", aomasterWaveformUi.addStepPoint);
  document.querySelectorAll("[data-step-preset]").forEach((button) => on(button, "click", () => aomasterWaveformUi.applyStepPreset(button.dataset.stepPreset)));

  customConfigUi.getControls().filter(Boolean).forEach((control) => {
    on(control, "input", customConfigUi.updateDraft);
    on(control, "change", customConfigUi.updateDraft);
  });
  on(elements.saveCustomConfig, "click", customConfigUi.save);
  on(elements.resetCustomConfig, "click", customConfigUi.reset);
  on(elements.testCustomParser, "click", () => testDeviceParser(CUSTOM_DEVICE_ID));
  modbusConfigUi.getConfigControls().filter(Boolean).forEach((control) => {
    on(control, "input", updateModbusDraftConfig);
    on(control, "change", updateModbusDraftConfig);
  });
  on(elements.saveModbusConfig, "click", saveModbusConfig);
  on(elements.resetModbusConfig, "click", resetModbusConfig);
  on(elements.testModbusParser, "click", () => testDeviceParser(MODBUS_DEVICE_ID));
  on(elements.modbusAddCurve, "click", () => debugCurveController.add("modbus"));
  debugCurveController.bind("modbus");
  on(elements.deviceLibrarySearch, "input", deviceNavigationUi.handleSearchInput);

  hartConfigUi.getConfigControls().filter(Boolean).forEach((control) => {
    on(control, "input", updateHartDraftConfig);
    on(control, "change", updateHartDraftConfig);
  });
  on(elements.hartStandardCommandFields, "input", updateHartDraftConfig);
  on(elements.hartStandardCommandFields, "change", updateHartDraftConfig);
  on(elements.saveHartConfig, "click", saveHartConfig);
  on(elements.resetHartConfig, "click", resetHartConfig);

  const bindMessageConfig = (prefix, configUi, heartbeatPreset, deviceId) => {
    configUi.getControls().filter(Boolean).forEach((control) => {
      on(control, "input", configUi.updateDraft);
      on(control, "change", configUi.updateDraft);
    });
    on(elements[`save${prefix}Config`], "click", configUi.save);
    on(elements[`reset${prefix}Config`], "click", configUi.reset);
    on(elements[`load${prefix}Heartbeat`], "click", () => loadMessageIntoManualSender(heartbeatPreset()));
    on(elements[`test${prefix}Parser`], "click", () => testDeviceParser(deviceId));
    on(elements[`${prefix.toLowerCase()}AddCurve`], "click", () => debugCurveController.add(prefix.toLowerCase()));
    debugCurveController.bind(prefix.toLowerCase());
  };
  bindMessageConfig("Websocket", websocketConfigUi, readWebsocketHeartbeatPreset, WEBSOCKET_DEVICE_ID);
  bindMessageConfig("Mqtt", mqttConfigUi, readMqttHeartbeatPreset, MQTT_DEVICE_ID);
  debugCurveController.bind("custom");
  on(elements.customAddCurve, "click", () => debugCurveController.add("custom"));

  on(elements.hartSearchDevice, "click", () => hartSessionController.sendSearchCommand().catch((error) => appendLog("error", "HART", error.message)));
  on(elements.hartScanAddresses, "click", () => hartSessionController.scanAddresses().catch((error) => appendLog("error", "HART", error.message)));
  elements.hartChartSeriesInputs.forEach((input) => on(input, "change", hartMonitorController.handleSeriesChange));
  getAomasterConfigControls().filter(Boolean).forEach((control) => {
    on(control, "input", updateAomasterDraftConfig);
    on(control, "change", updateAomasterDraftConfig);
  });
  on(elements.saveAomasterConfig, "click", saveAomasterConfig);
  on(elements.resetAomasterConfig, "click", resetAomasterConfig);
  bindChartConfigEvents();
}
