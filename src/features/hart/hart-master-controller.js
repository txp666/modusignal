import i18n from "../../i18n.js";
import { normalizeHartConfig } from "../../devices/hart-device.js";
import { createRequestMaster } from "../../framing/request-master.js";
import {
  describeHartResponseCode,
  extractHartFrames,
  getHartCommandLabel,
  isHartErrorResponse,
  matchHartResponse,
  parseHartFrame,
  parseHartRequest,
} from "../../hart/hart.js";

const LOG_LABEL = "HART";
// A device starts answering within about 260 ms, but at 1200 bit/s a long reply then takes
// up to 2.6 s to arrive: an exchange keeps waiting while bytes are still coming in.
export const RX_IDLE_MS = 300;
export const RX_MAX_EXTRA_MS = 3000;
// Lets the modem drop its carrier before the next request.
export const MIN_POLL_GAP_MS = 50;

const HART_PROTOCOL = {
  parseRequest: parseHartRequest,
  extractFrames(buffer) {
    const { frames, remaining } = extractHartFrames(buffer);
    return { frames: frames.map((parsed) => parsed.frame), remaining };
  },
  parseResponse: parseHartFrame,
  matches: matchHartResponse,
  isException: isHartErrorResponse,
  invalidRequestMessage: () => i18n("hart.master.invalidRequest"),
};

/** The HART master session: one request in flight, matched by address, master and command. */
export function createHartMaster(options) {
  return createRequestMaster({
    ...options,
    protocol: HART_PROTOCOL,
    minPollGapMs: MIN_POLL_GAP_MS,
    rxIdleMs: RX_IDLE_MS,
    rxMaxExtraMs: RX_MAX_EXTRA_MS,
  });
}

const hex = (value, width) => value.toString(16).toUpperCase().padStart(width, "0");

export function describeHartRequest(request) {
  // Long frames carry the device ID in their last three address bytes.
  const target = request.addressLength === 1
    ? `${i18n("hart.addrShort")} ${request.pollAddress}`
    : `ID 0x${request.addressKey.slice(-6)}`;
  return `Cmd ${getHartCommandLabel(request.command)} · ${target}`;
}

export function describeHartTimeout(transaction, timeoutMs) {
  let reason = i18n(transaction.request.addressLength === 1 ? "hart.timeout.silent" : "hart.timeout.silentLong");
  if (transaction.foreignFrames > 0) {
    reason = i18n("hart.timeout.foreign");
  } else if (transaction.rxBytes > 0) {
    reason = i18n("hart.timeout.garbled").replace("{bytes}", String(transaction.rxBytes));
  }
  return `${i18n("hart.timeoutLabel")} ${timeoutMs} ms · ${reason}`;
}

function describeOutcome(transaction, timeoutMs) {
  if (transaction.status === "ok") return `${Math.round(transaction.latencyMs)} ms`;
  if (transaction.status === "exception") {
    const { command, responseCode } = transaction.response;
    return `${i18n("hart.responseCode")} 0x${hex(responseCode, 2)} ${describeHartResponseCode(command, responseCode)}`;
  }
  if (transaction.status === "timeout") return describeHartTimeout(transaction, timeoutMs);
  return i18n("hart.cancelled");
}

/** One line for the result of an exchange: ✓ / ✗, the request, then latency, response code or timeout cause. */
export function describeHartTransaction(transaction, timeoutMs) {
  const mark = { ok: "✓ ", exception: "✗ ", timeout: "✗ " }[transaction.status] ?? "";
  return `${mark}${describeHartRequest(transaction.request)} · ${describeOutcome(transaction, timeoutMs)}`;
}

/**
 * Owns the HART master session on the HART page: one request in flight, matched by address
 * and command, error and timeout reporting, and the exchange statistics. Every received
 * frame, matched or not (burst messages), goes to `onFrame`.
 */
export function createHartMasterController({ elements: e, getConfig, getSession, appendLog, onFrame, onPollingStopped }) {
  let lastTransaction = null;
  const getTimeoutMs = () => normalizeHartConfig(getConfig()).responseTimeoutMs;

  const master = createHartMaster({
    write: (bytes) => {
      const session = getSession();
      if (!session?.connected) throw new Error(i18n("transport.serial.notConnected"));
      return session.write(bytes);
    },
    getTimeoutMs,
    onTransaction: handleTransaction,
    onFrame: (response) => onFrame(response, null),
  });

  function handleTransaction(transaction) {
    if (transaction.response) onFrame(transaction.response, transaction);
    lastTransaction = transaction;
    // A scan reports once at the end rather than for every silent address.
    const quiet = transaction.source === "scan" && transaction.status === "timeout";
    if (!quiet && (transaction.status === "exception" || transaction.status === "timeout")) {
      appendLog("error", LOG_LABEL, `${describeHartRequest(transaction.request)} · ${describeOutcome(transaction, getTimeoutMs())}`);
    }
    renderStatus();
  }

  function renderStatus() {
    const stats = master.getStats();
    if (e.hartStatRequests) e.hartStatRequests.textContent = String(stats.requests);
    if (e.hartStatResponses) e.hartStatResponses.textContent = String(stats.responses);
    if (e.hartStatErrors) e.hartStatErrors.textContent = String(stats.exceptions);
    if (e.hartStatTimeouts) e.hartStatTimeouts.textContent = String(stats.timeouts);
    if (e.hartStatLatency) {
      e.hartStatLatency.textContent = stats.lastLatencyMs === null ? "—" : `${Math.round(stats.lastLatencyMs)} ms`;
    }
    e.hartStatErrors?.closest("[data-stat]")?.classList.toggle("alert", stats.exceptions > 0);
    e.hartStatTimeouts?.closest("[data-stat]")?.classList.toggle("alert", stats.timeouts > 0);
    const result = e.hartLastResult;
    if (!result) return;
    result.classList.remove("ok", "error");
    if (!lastTransaction) {
      result.textContent = i18n("hart.stats.idle");
      return;
    }
    result.textContent = describeHartTransaction(lastTransaction, getTimeoutMs());
    if (lastTransaction.status === "ok") result.classList.add("ok");
    else if (lastTransaction.status !== "cancelled") result.classList.add("error");
  }

  /** Resolves to the finished exchange, or null when the request could not be written. */
  async function send(bytes, source = "command") {
    try {
      return await master.send(bytes, { source });
    } catch (error) {
      appendLog("error", i18n("log.send"), error.message);
      return null;
    }
  }

  function startPolling(buildRequest) {
    master.startPolling(buildRequest, () => normalizeHartConfig(getConfig()).pollIntervalMs, (error) => {
      appendLog("error", LOG_LABEL, error.message);
      onPollingStopped();
    });
  }

  e.hartStatsReset?.addEventListener("click", () => {
    master.resetStats();
    lastTransaction = null;
    renderStatus();
  });

  renderStatus();

  return {
    send,
    startPolling,
    stopPolling: master.stopPolling,
    handleRx: master.handleRx,
    handleTx: master.handleTx,
    reset: master.reset,
    localize: renderStatus,
  };
}
