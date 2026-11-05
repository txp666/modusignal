import { MQTT_TRANSPORT } from "./mqtt.js";
import { SERIAL_TRANSPORT } from "./serial.js";
import { WEBSOCKET_TRANSPORT } from "./websocket.js";

/**
 * 传输注册表：加一种传输 = 实现一个 session 类（继承 BaseTransport）+ 导出 descriptor，
 * 然后在此注册。设备层与页面无需改动。
 *
 * 浏览器能力边界：
 *   - 串口：Web Serial（HTTPS / localhost）
 *   - WebSocket：浏览器原生
 *   - MQTT：仅 MQTT over WebSocket（mqtt.js + ws:// / wss:// Broker）
 */
const TRANSPORTS = {
  [SERIAL_TRANSPORT.id]: SERIAL_TRANSPORT,
  [WEBSOCKET_TRANSPORT.id]: WEBSOCKET_TRANSPORT,
  [MQTT_TRANSPORT.id]: MQTT_TRANSPORT,
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
