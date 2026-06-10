const decoder = new TextDecoder();

export class SerialSession extends EventTarget {
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
    if (!SerialSession.isSupported()) {
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
      throw new Error("串口未连接");
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

  emit(type, detail = {}) {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }
}
