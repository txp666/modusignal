import { SERIAL_TRANSPORT } from "./serial.js";
import { WEBSOCKET_TRANSPORT } from "./websocket.js";

/**
 * 传输注册表：加一种传输 = 实现一个 session 类（继承 BaseTransport）+ 导出 descriptor，
 * 然后在此注册。设备层与页面无需改动。
 *
 * 扩展点（纯静态浏览器页面能力边界）：
 *   - WebSocket：浏览器原生支持，见 websocket.js。
 *   - MQTT：仅能走 MQTT over WebSocket（如 mqtt.js 连接 wss://broker），同样注册即可。
 *   注意：HTTPS 页面只能连接 wss://（连 ws:// 会被混合内容拦截）。
 */
const TRANSPORTS = {
  [SERIAL_TRANSPORT.id]: SERIAL_TRANSPORT,
  [WEBSOCKET_TRANSPORT.id]: WEBSOCKET_TRANSPORT,
};

export const DEFAULT_TRANSPORT_ID = SERIAL_TRANSPORT.id;

export function listTransports() {
  return Object.values(TRANSPORTS);
}

export function getTransportDescriptor(id = DEFAULT_TRANSPORT_ID) {
  return TRANSPORTS[id] ?? TRANSPORTS[DEFAULT_TRANSPORT_ID];
}

export function createTransportSession(id = DEFAULT_TRANSPORT_ID) {
  return getTransportDescriptor(id).createSession();
}
