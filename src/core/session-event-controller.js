import i18n from "../i18n.js";
import { resetAomasterRxBuffer } from "../devices/aomaster.js";
import { resetCustomRxBuffer } from "../devices/custom-device.js";
import {
  mergeHartDiscovery,
  resetHartRxBuffer,
} from "../devices/hart-device.js";
import { resetModbusRxBuffer } from "../devices/modbus-device.js";
import { resetMqttRxBuffer } from "../devices/mqtt-device.js";
import { resetWebSocketRxBuffer } from "../devices/websocket-device.js";
import { formatHartDeviceSummary } from "../hart/hart.js";
import {
  CUSTOM_DEVICE_ID,
  DEFAULT_DEVICE_ID,
  HART_DEVICE_ID,
  MODBUS_DEVICE_ID,
  MQTT_DEVICE_ID,
  WEBSOCKET_DEVICE_ID,
  parseDeviceTelemetry,
} from "../protocols.js";
import { DEFAULT_TRANSPORT_ID } from "../transports/registry.js";

// Binary protocols whose traffic the log's "auto" display shows as HEX.
const HEX_LOG_DEVICE_IDS = [MODBUS_DEVICE_ID, HART_DEVICE_ID, DEFAULT_DEVICE_ID];

export function createSessionEventController(options) {
  const {
    elements,
    state,
    getConfigs,
    setHartConfig,
    getControllers,
    updateHartDeviceInfo,
    updateDeviceUi,
    queueRxLogDisplay,
    finalizeRxLogCoalesce,
    appendLog,
  } = options;

  function resetMessageBuffers(customConfig) {
    resetMqttRxBuffer();
    resetWebSocketRxBuffer();
    resetCustomRxBuffer(customConfig);
  }

  function bind(target) {
    target.addEventListener("connected", () => {
      const { messageDebugController, transportController, pollingController, modbusController } = getControllers();
      messageDebugController.resetStats();
      modbusController.reset();
      resetMessageBuffers(getConfigs().customConfig);
      transportController.updateConnectionUi(true);
      pollingController.updateActive();
      appendLog("info", i18n("log.connect"), transportController.describeConnectionSummary());
    });

    target.addEventListener("disconnected", () => {
      getControllers().customCommandUi?.stop("disconnected");
      const { pollingController, hartSessionController, transportController, messageDebugController, modbusController } = getControllers();
      state.pollingActive = false;
      pollingController.stopAll();
      modbusController.reset();
      resetModbusRxBuffer();
      resetHartRxBuffer();
      hartSessionController.resetLinkProbe();
      resetAomasterRxBuffer();
      resetMessageBuffers(getConfigs().customConfig);
      finalizeRxLogCoalesce();
      transportController.updateConnectionUi(false);
      messageDebugController.resetStats();
      appendLog("info", i18n("log.connect"), i18n("log.disconnected"));
    });

    target.addEventListener("rx", (event) => handleRx(event.detail));
    target.addEventListener("tx", (event) => handleTx(event.detail));
    target.addEventListener("error", (event) => {
      getControllers().customCommandUi?.stop("failed");
      appendLog("error", i18n("log.error"), event.detail.error?.message ?? String(event.detail.error));
    });
  }

  function handleRx({ bytes, text, topic }) {
    const {
      aomasterController,
      chartController,
      hartConfigUi,
      hartMonitorController,
      hartSessionController,
      hartWorkspaceController,
      messageDebugController,
    } = getControllers();
    const configs = getConfigs();
    const hartLinkProbeChunk = state.deviceId === HART_DEVICE_ID && state.transportId === DEFAULT_TRANSPORT_ID
      ? hartSessionController.handleLinkProbeRx(text)
      : false;
    // Device default for the log's "auto" display; the HEX/Text toggle overrides it.
    const useHexDisplay = HEX_LOG_DEVICE_IDS.includes(state.deviceId);
    queueRxLogDisplay(bytes, text, useHexDisplay && !topic && !hartLinkProbeChunk, topic ? `[${topic}] ` : "");
    if (hartLinkProbeChunk) return;

    if (state.deviceId === WEBSOCKET_DEVICE_ID) messageDebugController.increment("websocket", "rx");
    if (state.deviceId === MQTT_DEVICE_ID) messageDebugController.increment("mqtt", "rx");
    if (state.deviceId === MODBUS_DEVICE_ID) {
      // The Modbus master matches responses to requests and feeds the table and chart itself.
      getControllers().modbusController.handleRx(bytes);
      return;
    }

    const telemetry = parseDeviceTelemetry(
      state.deviceId,
      text,
      configs.customConfig,
      configs.modbusConfig,
      bytes,
      state,
      configs.aomasterConfig,
      configs.hartConfig,
      configs.websocketConfig,
      configs.mqttConfig,
    );
    if (!telemetry) return;

    if (state.deviceId === HART_DEVICE_ID && telemetry.isDiscovery) {
      const nextHartConfig = mergeHartDiscovery(configs.hartConfig, telemetry);
      setHartConfig(nextHartConfig);
      hartConfigUi.populateConfigForm(nextHartConfig);
      updateHartDeviceInfo();
      hartWorkspaceController.updateFromDiscovery(telemetry);
      appendLog("info", "HART", formatHartDeviceSummary(nextHartConfig.device));
      updateDeviceUi();
      return;
    }

    if (state.deviceId === DEFAULT_DEVICE_ID) {
      aomasterController.handleTelemetry(telemetry);
    } else if (state.deviceId === HART_DEVICE_ID) {
      hartMonitorController.handleTelemetry(telemetry);
    } else if ([MQTT_DEVICE_ID, WEBSOCKET_DEVICE_ID, CUSTOM_DEVICE_ID, MODBUS_DEVICE_ID].includes(state.deviceId)) {
      chartController.handleJsonMultiTelemetry(telemetry);
    } else {
      chartController.getCharts().chart?.add(telemetry.value);
      if (elements.chartValue && Number.isFinite(telemetry.value)) {
        const formatted = `${telemetry.value.toFixed(3)}${telemetry.unit ? ` ${telemetry.unit}` : ""}`;
        elements.chartValue.textContent = `${telemetry.fieldName} ${formatted}`;
      }
    }
  }

  function handleTx({ bytes, text, topic, qos, retain }) {
    const { messageDebugController } = getControllers();
    finalizeRxLogCoalesce();
    // A record rather than a string, so the log can show it as HEX or text. Text writes keep showing as text.
    const payload = { bytes, text, autoHex: text === undefined && HEX_LOG_DEVICE_IDS.includes(state.deviceId) };
    if (topic) {
      const flags = [];
      if (qos) flags.push(`QoS${qos}`);
      if (retain) flags.push("retain");
      payload.prefix = `[${topic}${flags.length ? ` ${flags.join(" ")}` : ""}] `;
    }
    appendLog("tx", "TX", payload);
    if (state.deviceId === MODBUS_DEVICE_ID && bytes) getControllers().modbusController.handleTx(bytes);
    if (state.deviceId === WEBSOCKET_DEVICE_ID) messageDebugController.increment("websocket", "tx");
    if (state.deviceId === MQTT_DEVICE_ID) messageDebugController.increment("mqtt", "tx");
  }

  return { bind };
}
