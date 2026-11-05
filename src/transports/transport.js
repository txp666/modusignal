/**
 * 传输层统一接口。
 *
 * 设备驱动只产出/解析字节，与具体传输（串口、WebSocket、MQTT、TCP 等）正交。
 * 每种传输需实现一个 session 类（继承 BaseTransport）并导出一个 descriptor。
 *
 * Session 约定：
 *   - connect(options): Promise<void>   建立连接，成功后 emit("connected")
 *   - disconnect(): Promise<void>        断开连接，结束后 emit("disconnected")
 *   - write(data: Uint8Array | string): Promise<void>  发送数据，成功后 emit("tx", ...)
 *   - get connected(): boolean           当前是否已连接
 *   - static isSupported(): boolean      当前环境是否支持该传输
 *
 * 事件（CustomEvent.detail）：
 *   - connected   { options }
 *   - disconnected
 *   - rx          { bytes: Uint8Array, text: string, timestamp: Date }
 *   - tx          { bytes: Uint8Array, text?: string, timestamp: Date }
 *   - error       { error: Error }
 *
 * Descriptor 约定（见 registry.js）：
 *   {
 *     id: string,
 *     label: string,
 *     requiresSecureContext?: boolean,
 *     isSupported: () => boolean,
 *     fields: TransportField[],      // 声明式连接参数，UI 据此渲染并收集
 *     createSession: () => BaseTransport,
 *   }
 *
 * TransportField：
 *   { key, label, type: "select" | "text" | "number", default, options? }
 */
export class BaseTransport extends EventTarget {
  get connected() {
    return false;
  }

  static isSupported() {
    return false;
  }

  async connect() {
    throw new Error("connect() 未实现");
  }

  async disconnect() {
    throw new Error("disconnect() 未实现");
  }

  async write() {
    throw new Error("write() 未实现");
  }

  emit(type, detail = {}) {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }
}
