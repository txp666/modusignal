import i18n from "../../i18n.js";
import {
  buildMqttMessage,
  getMqttPublishOptions,
  MQTT_QUICK_MESSAGES,
} from "../../devices/mqtt-device.js";
import {
  buildWebSocketMessage,
  WEBSOCKET_QUICK_MESSAGES,
} from "../../devices/websocket-device.js";
import {
  bytesToHex,
  normalizeMqttConfig,
  normalizeWebSocketConfig,
  parseHexPayload,
} from "../../protocols.js";

export function createMessageDebugController(options) {
  const { elements, getSession, getWebsocketConfig, getMqttConfig, transportController } = options;
  const stats = {
    websocket: { rx: 0, tx: 0 },
    mqtt: { rx: 0, tx: 0 },
  };

  function updatePayloadPreview(target, format, message, builder) {
    if (!target) return;
    try {
      const payload = builder(format, message, { parseHexPayload });
      target.textContent = typeof payload === "string" ? payload : bytesToHex(payload);
      target.classList.remove("error");
    } catch (error) {
      target.textContent = error.message;
      target.classList.add("error");
    }
  }

  function renderTemplateCards(container, presets, attributes) {
    if (!container) return;
    container.innerHTML = "";
    presets.forEach((preset) => {
      const card = document.createElement("article");
      card.className = "debug-template-card";
      const header = document.createElement("div");
      header.className = "debug-template-heading";
      const title = document.createElement("strong");
      title.textContent = typeof preset.label === "function" ? preset.label() : preset.label;
      const format = document.createElement("span");
      format.textContent = preset.format.toUpperCase();
      const preview = document.createElement("code");
      preview.textContent = preset.message;
      const actions = document.createElement("div");
      actions.className = "debug-template-actions";
      const loadButton = document.createElement("button");
      loadButton.type = "button";
      loadButton.className = "ghost-button";
      loadButton.setAttribute(attributes.load, preset.id);
      loadButton.textContent = i18n("common.fill");
      const sendButton = document.createElement("button");
      sendButton.type = "button";
      sendButton.setAttribute(attributes.send, preset.id);
      sendButton.textContent = i18n("workbench.send");
      sendButton.disabled = !getSession()?.connected;
      header.append(title, format);
      actions.append(loadButton, sendButton);
      card.append(header, preview, actions);
      container.append(card);
    });
  }

  function renderWebsocketQuickSends() {
    renderTemplateCards(elements.wsQuickSendGrid, WEBSOCKET_QUICK_MESSAGES, {
      send: "data-ws-quick-send",
      load: "data-ws-load-preset",
    });
  }

  function renderMqttQuickSends() {
    renderTemplateCards(elements.mqttQuickSendGrid, MQTT_QUICK_MESSAGES, {
      send: "data-mqtt-quick-send",
      load: "data-mqtt-load-preset",
    });
  }

  function readMqttWriteOptions() {
    return getMqttPublishOptions(getMqttConfig(), transportController.readOptions().publishTopic);
  }

  async function sendWebsocketQuickMessage(preset) {
    const session = getSession();
    if (!session?.connected) throw new Error(i18n("common.connectFirst.ws"));
    await session.write(buildWebSocketMessage(preset.format, preset.message, { parseHexPayload }));
  }

  async function sendMqttQuickMessage(preset) {
    const session = getSession();
    if (!session?.connected) throw new Error(i18n("common.connectFirst.mqtt"));
    await session.write(buildMqttMessage(preset.format, preset.message, { parseHexPayload }), readMqttWriteOptions());
  }

  function readWebsocketHeartbeatPreset() {
    const config = normalizeWebSocketConfig(getWebsocketConfig());
    return { id: "websocket-heartbeat", label: i18n("ws.pollMessage"), format: config.heartbeatFormat, message: config.heartbeatMessage };
  }

  function readMqttHeartbeatPreset() {
    const config = normalizeMqttConfig(getMqttConfig());
    return { id: "mqtt-heartbeat", label: i18n("mqtt.pollMessage"), format: config.heartbeatFormat, message: config.heartbeatMessage };
  }

  function updateWebsocketStatsUi() {
    if (elements.websocketRxCount) elements.websocketRxCount.textContent = String(stats.websocket.rx);
    if (elements.websocketTxCount) elements.websocketTxCount.textContent = String(stats.websocket.tx);
    if (elements.websocketEndpoint) elements.websocketEndpoint.textContent = transportController.readCurrentField("url") || "—";
  }

  function updateMqttStatsUi() {
    if (elements.mqttRxCount) elements.mqttRxCount.textContent = String(stats.mqtt.rx);
    if (elements.mqttTxCount) elements.mqttTxCount.textContent = String(stats.mqtt.tx);
    if (elements.mqttSubscribeTopic) {
      const topic = getSession()?.connected ? transportController.readOptions().subscribeTopic : "—";
      elements.mqttSubscribeTopic.textContent = topic || "—";
    }
    const publish = readMqttWriteOptions();
    if (elements.mqttEffectivePublishTopic) elements.mqttEffectivePublishTopic.textContent = publish.topic || "—";
    if (elements.mqttPublishMode) elements.mqttPublishMode.textContent = `QoS ${publish.qos}${publish.retain ? " · retain" : ""}`;
  }

  function updateWebsocketDebuggerUi() {
    updateWebsocketStatsUi();
    const config = normalizeWebSocketConfig(getWebsocketConfig());
    updatePayloadPreview(elements.websocketHeartbeatPreview, config.heartbeatFormat, config.heartbeatMessage, buildWebSocketMessage);
  }

  function updateMqttDebuggerUi() {
    updateMqttStatsUi();
    const publish = readMqttWriteOptions();
    if (elements.mqttPublishPreview) {
      elements.mqttPublishPreview.textContent = `${publish.topic || i18n("common.notConfigured")} · QoS ${publish.qos}${publish.retain ? " · retain" : ""}`;
    }
    const config = normalizeMqttConfig(getMqttConfig());
    updatePayloadPreview(elements.mqttHeartbeatPreview, config.heartbeatFormat, config.heartbeatMessage, buildMqttMessage);
  }

  function increment(kind, direction) {
    stats[kind][direction] += 1;
    if (kind === "websocket") updateWebsocketStatsUi();
    else updateMqttStatsUi();
  }

  function resetStats() {
    stats.websocket = { rx: 0, tx: 0 };
    stats.mqtt = { rx: 0, tx: 0 };
    updateWebsocketStatsUi();
    updateMqttStatsUi();
  }

  function loadIntoManualSender(preset) {
    if (elements.sendFormat) elements.sendFormat.value = preset.format;
    if (elements.lineEnding) elements.lineEnding.value = "";
    if (elements.manualCommand) {
      elements.manualCommand.value = preset.message;
      elements.manualCommand.focus();
    }
  }

  return {
    increment,
    loadIntoManualSender,
    readMqttHeartbeatPreset,
    readMqttWriteOptions,
    readWebsocketHeartbeatPreset,
    renderMqttQuickSends,
    renderWebsocketQuickSends,
    resetStats,
    sendMqttQuickMessage,
    sendWebsocketQuickMessage,
    updateMqttDebuggerUi,
    updateMqttStatsUi,
    updateWebsocketDebuggerUi,
    updateWebsocketStatsUi,
  };
}
