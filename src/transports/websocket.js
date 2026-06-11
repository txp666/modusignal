import { BaseTransport } from "./transport.js";

const decoder = new TextDecoder();

export const WEBSOCKET_TRANSPORT_ID = "websocket";

export const WEBSOCKET_CONNECT_DEFAULTS = {
  url: "ws://127.0.0.1:8080",
};

function normalizeWebSocketUrl(url) {
  const value = String(url || "").trim();
  if (!value) {
    throw new Error("请填写 WebSocket 地址");
  }

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("WebSocket 地址格式无效");
  }

  if (parsed.protocol !== "ws:" && parsed.protocol !== "wss:") {
    throw new Error("WebSocket 地址必须以 ws:// 或 wss:// 开头");
  }

  return parsed.toString();
}

export function describeWebSocketUrlWarning(url) {
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

    return "HTTPS 下远程 ws:// 可能被浏览器拦截，可改用 wss://";
  } catch {
    return null;
  }
}

export class WebSocketTransport extends BaseTransport {
  constructor() {
    super();
    this.socket = null;
    this.connectedFlag = false;
  }

  get connected() {
    return this.connectedFlag;
  }

  static isSupported() {
    return "WebSocket" in window;
  }

  async connect(options) {
    if (!WebSocketTransport.isSupported()) {
      throw new Error("当前浏览器不支持 WebSocket。");
    }

    if (this.socket) {
      await this.disconnect();
    }

    const url = normalizeWebSocketUrl(options.url);
    const socket = new WebSocket(url);
    socket.binaryType = "arraybuffer";

    await new Promise((resolve, reject) => {
      let settled = false;

      const finish = (error) => {
        if (settled) {
          return;
        }
        settled = true;
        cleanup();
        if (error) {
          reject(error);
          return;
        }
        resolve();
      };

      const onOpen = () => finish(null);
      const onError = () => finish(new Error(`无法连接 WebSocket：${url}`));
      const onClose = (event) => finish(new Error(event.reason || `WebSocket 连接失败：${url}`));
      const cleanup = () => {
        socket.removeEventListener("open", onOpen);
        socket.removeEventListener("error", onError);
        socket.removeEventListener("close", onClose);
      };

      socket.addEventListener("open", onOpen);
      socket.addEventListener("error", onError);
      socket.addEventListener("close", onClose);
    });

    this.socket = socket;
    this.connectedFlag = true;
    this.bindSocketEvents(socket);
    this.emit("connected", { options: { ...options, url } });
  }

  bindSocketEvents(socket) {
    socket.addEventListener("message", (event) => {
      if (typeof event.data === "string") {
        const bytes = new TextEncoder().encode(event.data);
        this.emit("rx", {
          bytes,
          text: event.data,
          timestamp: new Date(),
        });
        return;
      }

      const buffer = event.data instanceof ArrayBuffer ? event.data : event.data?.buffer;
      if (!buffer) {
        return;
      }

      const bytes = new Uint8Array(buffer);
      this.emit("rx", {
        bytes,
        text: decoder.decode(bytes, { stream: true }),
        timestamp: new Date(),
      });
    });

    socket.addEventListener("close", () => {
      if (!this.connectedFlag) {
        return;
      }

      this.connectedFlag = false;
      this.socket = null;
      this.emit("disconnected");
    });

    socket.addEventListener("error", () => {
      this.emit("error", { error: new Error("WebSocket 通信错误") });
    });
  }

  async disconnect() {
    this.connectedFlag = false;
    const socket = this.socket;
    this.socket = null;

    if (!socket) {
      this.emit("disconnected");
      return;
    }

    await new Promise((resolve) => {
      if (socket.readyState === WebSocket.CLOSED) {
        resolve();
        return;
      }

      socket.addEventListener("close", () => resolve(), { once: true });
      socket.close();
    });

    this.emit("disconnected");
  }

  async write(data) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      throw new Error("连接未建立");
    }

    if (typeof data === "string") {
      this.socket.send(data);
      this.emit("tx", {
        bytes: new TextEncoder().encode(data),
        text: data,
        timestamp: new Date(),
      });
      return;
    }

    this.socket.send(data);
    this.emit("tx", { bytes: data, timestamp: new Date() });
  }
}

export const WEBSOCKET_TRANSPORT = {
  id: WEBSOCKET_TRANSPORT_ID,
  label: "WebSocket",
  requiresSecureContext: false,
  isSupported: () => WebSocketTransport.isSupported(),
  fields: [
    {
      key: "url",
      label: "地址",
      type: "text",
      default: WEBSOCKET_CONNECT_DEFAULTS.url,
    },
  ],
  createSession: () => new WebSocketTransport(),
};
