import i18n from "../../i18n.js";
import { extractRtuFrames, matchRtuResponse, parseRtuRequest, parseRtuResponse } from "../../modbus/modbus.js";

const MAX_RX_BUFFER = 512;
// RTU needs a silent gap between frames; like common master tools, never poll back-to-back.
export const MIN_POLL_GAP_MS = 20;

export function createModbusStats() {
  return { requests: 0, responses: 0, exceptions: 0, timeouts: 0, lastLatencyMs: null };
}

/**
 * One request at a time: every request waits for its response, exception or timeout
 * before the next one is written. Requests sent from elsewhere (the manual sender)
 * are recognised from the TX stream so they are timed and matched too.
 */
export function createModbusMaster({
  write,
  getTimeoutMs,
  onTransaction = () => {},
  now = () => performance.now(),
  setTimer = setTimeout,
  clearTimer = clearTimeout,
}) {
  let buffer = new Uint8Array(0);
  let pending = null;
  let writing = false;
  let queue = Promise.resolve();
  let stats = createModbusStats();
  let pollToken = null;
  let pollTimer = null;

  function begin(request, source, resolve) {
    // Bytes left from an earlier exchange must not complete this one.
    buffer = new Uint8Array(0);
    stats.requests += 1;
    pending = { request, source, resolve, startedAt: now(), rxBytes: 0, foreignFrames: 0, timer: null };
    return pending;
  }

  function armTimeout(current) {
    if (pending === current && current.timer === null) {
      current.timer = setTimer(() => finish(current, { status: "timeout" }), getTimeoutMs());
    }
  }

  function finish(current, result) {
    if (pending !== current) return;
    if (current.timer !== null) clearTimer(current.timer);
    pending = null;
    const latencyMs = now() - current.startedAt;
    if (result.status === "ok") stats.responses += 1;
    if (result.status === "exception") stats.exceptions += 1;
    if (result.status === "timeout") {
      stats.timeouts += 1;
      buffer = new Uint8Array(0);
    } else {
      stats.lastLatencyMs = latencyMs;
    }
    const transaction = {
      ...result,
      request: current.request,
      source: current.source,
      latencyMs,
      rxBytes: current.rxBytes,
      foreignFrames: current.foreignFrames,
    };
    onTransaction(transaction, getStats());
    current.resolve?.(transaction);
  }

  function transact(bytes, request) {
    return new Promise((resolve, reject) => {
      const current = begin(request, "master", resolve);
      writing = true;
      Promise.resolve()
        .then(() => write(bytes))
        .then(() => armTimeout(current), (error) => {
          if (pending === current) {
            pending = null;
            stats.requests -= 1;
          }
          reject(error);
        })
        .finally(() => { writing = false; });
    });
  }

  function send(bytes) {
    const request = parseRtuRequest(bytes);
    if (!request) return Promise.reject(new Error(i18n("modbus.master.invalidRequest")));
    const run = () => transact(bytes, request);
    const result = queue.then(run, run);
    queue = result.catch(() => {});
    return result;
  }

  function handleTx(bytes) {
    // Our own write, or a frame sent while another exchange is still open: nothing to correlate.
    if (writing || pending) return;
    const request = parseRtuRequest(bytes);
    if (request) armTimeout(begin(request, "manual", null));
  }

  function handleRx(bytes) {
    if (!bytes?.length) return;
    if (pending) pending.rxBytes += bytes.length;
    const merged = new Uint8Array(buffer.length + bytes.length);
    merged.set(buffer);
    merged.set(bytes, buffer.length);
    const { frames, remaining } = extractRtuFrames(merged.length > MAX_RX_BUFFER ? merged.subarray(-MAX_RX_BUFFER) : merged);
    buffer = remaining.slice();
    for (const frame of frames) {
      const response = parseRtuResponse(frame);
      if (!response) continue;
      if (pending && matchRtuResponse(pending.request, response)) {
        const status = response.exceptionCode === undefined ? "ok" : "exception";
        finish(pending, { status, response, frame: frame.slice() });
      } else if (pending) {
        pending.foreignFrames += 1;
      }
    }
  }

  function startPolling(buildRequest, getInterval, onStopped = () => {}) {
    if (pollToken) return;
    const token = {};
    pollToken = token;
    const cycle = async () => {
      pollTimer = null;
      if (pollToken !== token) return;
      const startedAt = now();
      try {
        await send(buildRequest());
      } catch (error) {
        if (pollToken === token) {
          pollToken = null;
          onStopped(error);
        }
        return;
      }
      if (pollToken !== token) return;
      const wait = Math.max(MIN_POLL_GAP_MS, getInterval() - (now() - startedAt));
      pollTimer = setTimer(() => void cycle(), wait);
    };
    void cycle();
  }

  function stopPolling() {
    pollToken = null;
    if (pollTimer !== null) clearTimer(pollTimer);
    pollTimer = null;
  }

  /** Drops the open exchange (disconnect / device switch) without counting a timeout. */
  function reset() {
    stopPolling();
    const current = pending;
    if (current) {
      if (current.timer !== null) clearTimer(current.timer);
      pending = null;
      current.resolve?.({ status: "cancelled", request: current.request, source: current.source });
    }
    buffer = new Uint8Array(0);
  }

  function getStats() {
    return { ...stats };
  }

  function resetStats() {
    stats = createModbusStats();
    return getStats();
  }

  return {
    send,
    handleTx,
    handleRx,
    startPolling,
    stopPolling,
    isPolling: () => pollToken !== null,
    isBusy: () => pending !== null,
    reset,
    getStats,
    resetStats,
  };
}
