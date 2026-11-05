import { commandLine } from "./protocol.js";

function expectedResponse(command) {
  const verb = command.split(/\s/, 1)[0].toUpperCase();
  if (verb === "GET_STATUS" || verb === "ZERO_CAL") return "STATUS ";
  if (verb === "PING") return "OK PONG";
  if (["BOOTSEL", "OTA", "REBOOT_BOOTSEL"].includes(verb)) return "OK BOOTSEL";
  return "OK";
}

// Firmware replies have no request IDs. Only one command may be outstanding;
// an ambiguous transfer or timeout invalidates the connection until reconnect.
export class CommandTransport {
  constructor({ transferOut, timeoutMs = 2000, onInvalidated } = {}) {
    if (typeof transferOut !== "function") throw new TypeError("transferOut is required");
    this.transferOut = transferOut;
    this.timeoutMs = timeoutMs;
    this.onInvalidated = onInvalidated;
    this.queue = [];
    this.pending = null;
    this.invalidated = null;
  }

  send(text, { timeoutMs = this.timeoutMs } = {}) {
    if (this.invalidated) return Promise.reject(this.invalidated);
    const command = String(text).trim();
    if (!command || command.length > 63 || /[^\x20-\x7e]/.test(command)) {
      return Promise.reject(new Error("命令必须是一行且不超过 63 个 ASCII 字符"));
    }
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
      return Promise.reject(new Error("命令超时时间必须大于零"));
    }
    return new Promise((resolve, reject) => {
      this.queue.push({ command, timeoutMs, resolve, reject, expected: expectedResponse(command) });
      this.schedulePump();
    });
  }

  schedulePump() {
    // Do not send the next command in the middle of parsing coalesced replies.
    queueMicrotask(() => this.pump());
  }

  async pump() {
    if (this.pending || this.invalidated || !this.queue.length) return;
    const pending = this.queue.shift();
    this.pending = pending;
    pending.timer = setTimeout(() => {
      this.invalidate(new Error(`命令超时：${pending.command}；请重新连接设备`));
    }, pending.timeoutMs);

    try {
      const payload = new TextEncoder().encode(commandLine(pending.command));
      const result = await this.transferOut(payload);
      if (this.pending !== pending) return;
      if (result?.status !== "ok" || result.bytesWritten !== payload.byteLength) {
        throw new Error(`USB 命令未完整发送：${pending.command}；请重新连接设备`);
      }
      pending.transferred = true;
      this.completePending();
    } catch (error) {
      if (this.pending === pending) this.invalidate(error);
    }
  }

  handleText(text) {
    const pending = this.pending;
    if (!pending || this.invalidated || pending.response !== undefined) return false;
    const line = String(text).trim();
    if (/\r|\n/.test(line)) return false;
    const isError = /^ERR(?: |$)/.test(line);
    const matches = pending.expected === "STATUS "
      ? /^STATUS \S+=\S+/.test(line)
      : line === pending.expected;
    if (!isError && !matches) return false;
    pending.response = line;
    pending.responseError = isError ? new Error(`${pending.command}：${line}`) : null;
    this.completePending();
    return true;
  }

  completePending() {
    const pending = this.pending;
    if (!pending?.transferred || pending.response === undefined) return;
    clearTimeout(pending.timer);
    this.pending = null;
    if (pending.responseError) pending.reject(pending.responseError);
    else pending.resolve(pending.response);
    this.schedulePump();
  }

  invalidate(reason) {
    if (this.invalidated) return;
    const error = reason instanceof Error ? reason : new Error(String(reason));
    this.disconnect(error);
    this.onInvalidated?.(error);
  }

  disconnect(reason = new Error("设备已断开连接")) {
    if (this.invalidated) return;
    const error = reason instanceof Error ? reason : new Error(String(reason));
    this.invalidated = error;
    if (this.pending) {
      clearTimeout(this.pending.timer);
      this.pending.reject(error);
      this.pending = null;
    }
    for (const command of this.queue.splice(0)) command.reject(error);
  }
}
