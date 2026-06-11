import mqtt from "../../vendor/mqtt.esm.js";
import { BaseTransport } from "./transport.js";

const decoder = new TextDecoder();
const textEncoder = new TextEncoder();

export const MQTT_TRANSPORT_ID = "mqtt";

export const MQTT_CONNECT_DEFAULTS = {
  brokerUrl: "wss://broker.emqx.io:8084/mqtt",
  clientId: "modusignal",
  username: "",
  password: "",
  subscribeTopic: "modusignal/rx",
  publishTopic: "modusignal/tx",
};

function normalizeBrokerUrl(url) {
  const value = String(url || "").trim();
  if (!value) {
    throw new Error("请填写 MQTT Broker 地址");
  }

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("MQTT Broker 地址格式无效");
  }

  if (parsed.protocol !== "ws:" && parsed.protocol !== "wss:") {
    throw new Error("浏览器端 MQTT 须使用 ws:// 或 wss:// Broker 地址");
  }

  return parsed.toString();
}

function resolveClientId(clientId) {
  const value = String(clientId || "").trim();
  if (value) {
    return value;
  }

  return `modusignal-${Math.random().toString(16).slice(2, 10)}`;
}

function normalizeTopic(value, label) {
  const topic = String(value || "").trim();
  if (!topic) {
    throw new Error(`请填写${label}`);
  }
  return topic;
}

function clampQos(value) {
  const qos = Math.trunc(Number(value));
  if (qos === 1 || qos === 2) {
    return qos;
  }
  return 0;
}

export function describeMqttUrlWarning(url) {
  const value = String(url || "").trim();
  if (!value || !window.isSecureContext) {
    return null;
  }

  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "ws:") {
      return null;
    }

    const localHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);
    if (localHosts.has(parsed.hostname)) {
      return null;
    }

    return "HTTPS 下远程 ws:// Broker 可能被浏览器拦截，可改用 wss://";
  } catch {
    return null;
  }
}

export class MqttTransport extends BaseTransport {
  constructor() {
    super();
    this.client = null;
    this.connectedFlag = false;
    this.publishTopic = "";
  }

  get connected() {
    return this.connectedFlag;
  }

  static isSupported() {
    return "WebSocket" in window;
  }

  async connect(options) {
    if (!MqttTransport.isSupported()) {
      throw new Error("当前浏览器不支持 WebSocket，无法使用 MQTT。");
    }

    if (this.client) {
      await this.disconnect();
    }

    const brokerUrl = normalizeBrokerUrl(options.brokerUrl);
    const subscribeTopic = normalizeTopic(options.subscribeTopic, "订阅主题");
    const publishTopic = normalizeTopic(options.publishTopic, "发布主题");
    const username = String(options.username || "").trim();
    const password = String(options.password || "");

    const client = mqtt.connect(brokerUrl, {
      clientId: resolveClientId(options.clientId),
      username: username || undefined,
      password: password || undefined,
      clean: true,
      reconnectPeriod: 0,
    });

    await new Promise((resolve, reject) => {
      let settled = false;

      const finish = (error) => {
        if (settled) {
          return;
        }
        settled = true;
        cleanup();
        if (error) {
          client.end(true);
          reject(error);
          return;
        }
        resolve();
      };

      const onConnect = () => finish(null);
      const onError = (error) => finish(new Error(error?.message || `无法连接 MQTT Broker：${brokerUrl}`));
      const cleanup = () => {
        client.off("connect", onConnect);
        client.off("error", onError);
      };

      client.on("connect", onConnect);
      client.on("error", onError);
    });

    await new Promise((resolve, reject) => {
      client.subscribe(subscribeTopic, { qos: 0 }, (error) => {
        if (error) {
          client.end(true);
          reject(new Error(`MQTT 订阅失败：${error.message}`));
          return;
        }
        resolve();
      });
    });

    this.client = client;
    this.publishTopic = publishTopic;
    this.connectedFlag = true;
    this.bindClientEvents(client);
    this.emit("connected", {
      options: {
        ...options,
        brokerUrl,
        subscribeTopic,
        publishTopic,
      },
    });
  }

  bindClientEvents(client) {
    client.on("message", (topic, payload) => {
      const bytes = payload instanceof Uint8Array ? payload : new Uint8Array(payload);
      this.emit("rx", {
        bytes,
        text: decoder.decode(bytes),
        topic: String(topic || ""),
        timestamp: new Date(),
      });
    });

    client.on("close", () => {
      if (!this.connectedFlag) {
        return;
      }

      this.connectedFlag = false;
      this.client = null;
      this.emit("disconnected");
    });

    client.on("error", (error) => {
      this.emit("error", { error: error instanceof Error ? error : new Error(String(error)) });
    });
  }

  async disconnect() {
    this.connectedFlag = false;
    const client = this.client;
    this.client = null;
    this.publishTopic = "";

    if (!client) {
      this.emit("disconnected");
      return;
    }

    await new Promise((resolve) => {
      client.end(true, {}, () => resolve());
    });

    this.emit("disconnected");
  }

  async write(data, options = {}) {
    if (!this.client || !this.connectedFlag) {
      throw new Error("连接未建立");
    }

    const topic = normalizeTopic(options.topic || this.publishTopic, "发布主题");
    const qos = clampQos(options.qos);
    const retain = Boolean(options.retain);
    const payload = typeof data === "string" ? data : data;

    await new Promise((resolve, reject) => {
      this.client.publish(topic, payload, { qos, retain }, (error) => {
        if (error) {
          reject(new Error(error.message || "MQTT 发布失败"));
          return;
        }
        resolve();
      });
    });

    if (typeof data === "string") {
      this.emit("tx", {
        bytes: textEncoder.encode(data),
        text: data,
        topic,
        qos,
        retain,
        timestamp: new Date(),
      });
      return;
    }

    this.emit("tx", {
      bytes: data,
      topic,
      qos,
      retain,
      timestamp: new Date(),
    });
  }
}

export const MQTT_TRANSPORT = {
  id: MQTT_TRANSPORT_ID,
  label: "MQTT (WebSocket)",
  requiresSecureContext: false,
  isSupported: () => MqttTransport.isSupported(),
  fields: [
    {
      key: "brokerUrl",
      label: "Broker 地址",
      type: "text",
      default: MQTT_CONNECT_DEFAULTS.brokerUrl,
    },
    {
      key: "clientId",
      label: "Client ID",
      type: "text",
      default: MQTT_CONNECT_DEFAULTS.clientId,
    },
    {
      key: "subscribeTopic",
      label: "订阅主题",
      type: "text",
      default: MQTT_CONNECT_DEFAULTS.subscribeTopic,
    },
    {
      key: "publishTopic",
      label: "发布主题",
      type: "text",
      default: MQTT_CONNECT_DEFAULTS.publishTopic,
    },
    {
      key: "username",
      label: "用户名",
      type: "text",
      default: MQTT_CONNECT_DEFAULTS.username,
    },
    {
      key: "password",
      label: "密码",
      type: "text",
      default: MQTT_CONNECT_DEFAULTS.password,
    },
  ],
  createSession: () => new MqttTransport(),
};
