const MAX_RX_BUFFER = 512;

export function createRequestStats() {
  return { requests: 0, responses: 0, exceptions: 0, timeouts: 0, lastLatencyMs: null };
}

/**
 * One request at a time on a request/response link: every request waits for its response,
 * an exception (the device answered with an error code) or a timeout before the next one
 * is written. Requests sent from elsewhere (the manual sender) are recognised from the TX
 * stream so they are timed and matched too.
 *
 * `protocol` supplies the framing:
 *   parseRequest(bytes) → request | null
 *   extractFrames(buffer) → { frames, remaining }
 *   parseResponse(frame) → response | null
 *   matches(request, response) → boolean
 *   isException(response) → boolean
 *   invalidRequestMessage() → string
 *
 * With `rxIdleMs`, a reply that is still arriving when the timeout expires is not cut off:
 * the exchange waits until the line has been quiet for `rxIdleMs`, for at most `rxMaxExtraMs`
 * beyond the timeout. Frames that complete no request are passed to `onFrame`.
 */
export function createRequestMaster({
  protocol,
  write,
  getTimeoutMs,
  minPollGapMs = 20,
  rxIdleMs = 0,
  rxMaxExtraMs = 0,
  onTransaction = () => {},
  onFrame = () => {},
  now = () => performance.now(),
  setTimer = setTimeout,
  clearTimer = clearTimeout,
}) {
  let buffer = new Uint8Array(0);
  let pending = null;
  let writing = false;
  let queue = Promise.resolve();
  let stats = createRequestStats();
  let pollToken = null;
  let pollTimer = null;

  function begin(request, source, resolve) {
    // Bytes left from an earlier exchange must not complete this one.
    buffer = new Uint8Array(0);
    stats.requests += 1;
    pending = {
      request, source, resolve, startedAt: now(), armedAt: null, lastRxAt: null, rxBytes: 0, foreignFrames: 0, timer: null,
    };
    return pending;
  }

  function armTimeout(current) {
    if (pending === current && current.timer === null) {
      current.armedAt = now();
      current.timer = setTimer(() => expire(current), getTimeoutMs());
    }
  }

  function expire(current) {
    if (pending !== current) return;
    const time = now();
    const quietFor = current.lastRxAt === null ? Infinity : time - current.lastRxAt;
    const extraLeft = current.armedAt + getTimeoutMs() + rxMaxExtraMs - time;
    if (quietFor < rxIdleMs && extraLeft > 0) {
      current.timer = setTimer(() => expire(current), Math.min(rxIdleMs - quietFor, extraLeft));
      return;
    }
    current.timer = null;
    finish(current, { status: "timeout" });
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

  function transact(bytes, request, source) {
    return new Promise((resolve, reject) => {
      const current = begin(request, source, resolve);
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

  function send(bytes, { source = "master" } = {}) {
    const request = protocol.parseRequest(bytes);
    if (!request) return Promise.reject(new Error(protocol.invalidRequestMessage()));
    const run = () => transact(bytes, request, source);
    const result = queue.then(run, run);
    queue = result.catch(() => {});
    return result;
  }

  function handleTx(bytes) {
    // Our own write, or a frame sent while another exchange is still open: nothing to correlate.
    if (writing || pending) return;
    const request = protocol.parseRequest(bytes);
    if (request) armTimeout(begin(request, "manual", null));
  }

  function handleRx(bytes) {
    if (!bytes?.length) return;
    if (pending) {
      pending.rxBytes += bytes.length;
      pending.lastRxAt = now();
    }
    const merged = new Uint8Array(buffer.length + bytes.length);
    merged.set(buffer);
    merged.set(bytes, buffer.length);
    const { frames, remaining } = protocol.extractFrames(merged.length > MAX_RX_BUFFER ? merged.subarray(-MAX_RX_BUFFER) : merged);
    buffer = remaining.slice();
    for (const frame of frames) {
      const response = protocol.parseResponse(frame);
      if (!response) continue;
      if (pending && protocol.matches(pending.request, response)) {
        const status = protocol.isException(response) ? "exception" : "ok";
        finish(pending, { status, response, frame: frame.slice() });
      } else {
        if (pending) pending.foreignFrames += 1;
        onFrame(response, frame.slice());
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
        await send(buildRequest(), { source: "poll" });
      } catch (error) {
        if (pollToken === token) {
          pollToken = null;
          onStopped(error);
        }
        return;
      }
      if (pollToken !== token) return;
      const wait = Math.max(minPollGapMs, getInterval() - (now() - startedAt));
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
    stats = createRequestStats();
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
