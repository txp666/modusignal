import { BaseTransport } from "./transport.js";

const decoder = new TextDecoder();

export const SERIAL_TRANSPORT_ID = "serial";

export class SerialTransport extends BaseTransport {
  constructor() {
    super();
    this.port = null;
    this.reader = null;
    this.writer = null;
    this.reading = false;
    this.readLoopPromise = null;
  }

  get connected() {
    return Boolean(this.port && this.reader && this.writer);
  }

  static isSupported() {
    return "serial" in navigator;
  }

  async connect(options) {
    if (!SerialTransport.isSupported()) {
      throw new Error("当前浏览器不支持 Web Serial，请使用 Chrome 或 Edge 的 HTTPS 页面。");
    }

    this.port = await navigator.serial.requestPort();
    await this.port.open(options);
    this.reader = this.port.readable.getReader();
    this.writer = this.port.writable.getWriter();
    this.reading = true;
    this.emit("connected", { options });
    this.readLoopPromise = this.readLoop();
  }

  async disconnect() {
    this.reading = false;

    if (this.reader) {
      try {
        await this.reader.cancel();
      } catch (error) {
        this.emit("error", { error });
      }
    }

    if (this.readLoopPromise) {
      await this.readLoopPromise.catch((error) => this.emit("error", { error }));
      this.readLoopPromise = null;
    }

    if (this.writer) {
      try {
        await this.writer.close();
      } catch (error) {
        this.emit("error", { error });
      } finally {
        this.writer.releaseLock();
        this.writer = null;
      }
    }

    if (this.port) {
      try {
        await this.port.close();
      } catch (error) {
        this.emit("error", { error });
      } finally {
        this.port = null;
      }
    }

    this.emit("disconnected");
  }

  async write(bytes) {
    if (!this.writer) {
      throw new Error("连接未建立");
    }

    await this.writer.write(bytes);
    this.emit("tx", { bytes, timestamp: new Date() });
  }

  async readLoop() {
    while (this.port && this.reader && this.reading) {
      try {
        const { value, done } = await this.reader.read();

        if (done) {
          break;
        }

        if (value) {
          this.emit("rx", {
            bytes: value,
            text: decoder.decode(value, { stream: true }),
            timestamp: new Date(),
          });
        }
      } catch (error) {
        if (this.reading) {
          this.emit("error", { error });
        }
        break;
      }
    }

    if (this.reader) {
      this.reader.releaseLock();
      this.reader = null;
    }
  }
}

export const SERIAL_TRANSPORT = {
  id: SERIAL_TRANSPORT_ID,
  label: "串口 (Web Serial)",
  requiresSecureContext: true,
  isSupported: () => SerialTransport.isSupported(),
  fields: [
    {
      key: "baudRate",
      label: "波特率",
      type: "select",
      default: 115200,
      options: [9600, 19200, 38400, 57600, 115200],
    },
    { key: "dataBits", label: "数据位", type: "select", default: 8, options: [7, 8] },
    { key: "stopBits", label: "停止位", type: "select", default: 1, options: [1, 2] },
    {
      key: "parity",
      label: "校验",
      type: "select",
      default: "none",
      options: [
        { value: "none", label: "None" },
        { value: "even", label: "Even" },
        { value: "odd", label: "Odd" },
      ],
    },
    {
      key: "flowControl",
      label: "流控",
      type: "select",
      default: "none",
      options: [
        { value: "none", label: "None" },
        { value: "hardware", label: "Hardware" },
      ],
    },
  ],
  createSession: () => new SerialTransport(),
};
