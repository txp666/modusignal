import i18n from "../i18n.js";
import { concatBytes } from "../utils/bytes.js";
import { formatLogRecord, formatLogTime, LOG_DISPLAY_MODES, logFileName, serializeLogEntries } from "./log-format.js";

const RX_LOG_IDLE_MS = 45;
// Enough history to be worth saving; the oldest lines are dropped first.
const MAX_LOG_LINES = 1000;
const DISPLAY_MODE_KEY = "modusignal.logDisplayMode";

function loadDisplayMode() {
  try {
    const saved = localStorage.getItem(DISPLAY_MODE_KEY);
    return LOG_DISPLAY_MODES.includes(saved) ? saved : "auto";
  } catch {
    return "auto";
  }
}

export function createLogController({ elements = {}, getLogElement, bytesToHex }) {
  // RX/TX lines keep their bytes so a display mode change can re-render them.
  const records = new WeakMap();
  let displayMode = loadDisplayMode();
  let paused = false;
  let rxTotal = 0;
  let txTotal = 0;
  let rxFlushTimer = null;
  let rxPendingLine = null;

  function render(line) {
    const entry = records.get(line);
    if (entry) entry.content.textContent = formatLogRecord(entry.record, displayMode, bytesToHex);
  }

  function followTail(logElement, removedHeight = 0) {
    // While paused, keep the lines being read in place as old lines are trimmed above them.
    if (paused) logElement.scrollTop = Math.max(0, logElement.scrollTop - removedHeight);
    else logElement.scrollTop = logElement.scrollHeight;
  }

  function updateCounters() {
    if (elements.logRxBytes) elements.logRxBytes.textContent = String(rxTotal);
    if (elements.logTxBytes) elements.logTxBytes.textContent = String(txTotal);
  }

  function resetRxCoalesce() {
    if (rxFlushTimer) window.clearTimeout(rxFlushTimer);
    rxFlushTimer = null;
    rxPendingLine = null;
  }

  function finalizeRxCoalesce() {
    resetRxCoalesce();
  }

  /** payload is a string, or an RX/TX record { bytes, text?, prefix?, autoHex? } rendered per display mode. */
  function append(kind, direction, payload, options = {}) {
    const line = document.createElement("div");
    line.className = `log-line ${kind}`;

    const time = document.createElement("span");
    time.className = "time";
    time.textContent = formatLogTime();

    const dir = document.createElement("span");
    dir.className = "dir";
    dir.textContent = direction;

    const content = document.createElement("span");
    content.className = "payload";
    if (payload && typeof payload === "object") {
      records.set(line, { record: payload, content });
      render(line);
      if (kind === "tx") {
        txTotal += payload.bytes?.length ?? 0;
        updateCounters();
      }
    } else {
      content.textContent = payload;
    }
    line.append(time, dir, content);

    const logElement = getLogElement();
    if (!logElement) return options.returnLine ? line : undefined;
    logElement.append(line);
    let removedHeight = 0;
    while (logElement.children.length > MAX_LOG_LINES) {
      const oldest = logElement.firstElementChild;
      removedHeight += oldest.getBoundingClientRect().height;
      if (oldest === rxPendingLine) resetRxCoalesce();
      oldest.remove();
    }
    followTail(logElement, removedHeight);
    return options.returnLine ? line : undefined;
  }

  /** Stream chunks arriving within RX_LOG_IDLE_MS share a line; prefixed (topic) messages never do. */
  function queueRx(bytes, text, useHexDisplay, prefix = "") {
    rxTotal += bytes.length;
    updateCounters();
    if (prefix) {
      finalizeRxCoalesce();
      append("rx", "RX", { bytes: bytes.slice(), text: text ?? "", prefix, autoHex: useHexDisplay });
      return;
    }

    const pending = rxPendingLine && records.get(rxPendingLine);
    if (pending) {
      const { record } = pending;
      record.bytes = concatBytes(record.bytes, bytes);
      record.text += text ?? "";
      record.autoHex = useHexDisplay;
      render(rxPendingLine);
      const logElement = getLogElement();
      if (logElement) followTail(logElement);
    } else {
      rxPendingLine = append("rx", "RX", { bytes: bytes.slice(), text: text ?? "", autoHex: useHexDisplay }, { returnLine: true });
    }

    if (rxFlushTimer) window.clearTimeout(rxFlushTimer);
    rxFlushTimer = window.setTimeout(finalizeRxCoalesce, RX_LOG_IDLE_MS);
  }

  function setDisplayMode(mode) {
    if (!LOG_DISPLAY_MODES.includes(mode)) return;
    displayMode = mode;
    try { localStorage.setItem(DISPLAY_MODE_KEY, mode); } catch {}
    if (elements.logDisplayMode) elements.logDisplayMode.value = mode;
    const logElement = getLogElement();
    if (!logElement) return;
    for (const line of logElement.children) render(line);
    followTail(logElement);
  }

  function setPaused(next) {
    paused = next;
    const button = elements.logPauseScroll;
    if (button) {
      const key = paused ? "workbench.resumeScroll" : "workbench.pauseScroll";
      button.setAttribute("aria-pressed", String(paused));
      button.setAttribute("data-i18n", key);
      button.textContent = i18n(key);
    }
    const logElement = getLogElement();
    if (!paused && logElement) followTail(logElement);
  }

  function clear() {
    resetRxCoalesce();
    getLogElement()?.replaceChildren();
    rxTotal = 0;
    txTotal = 0;
    updateCounters();
    append("info", i18n("log.system"), i18n("log.logCleared"));
  }

  function save() {
    const logElement = getLogElement();
    if (!logElement) return;
    const entries = [...logElement.children].map((line) => ({
      time: line.querySelector(".time")?.textContent ?? "",
      direction: line.querySelector(".dir")?.textContent ?? "",
      payload: line.querySelector(".payload")?.textContent ?? "",
    }));
    const now = new Date();
    const url = URL.createObjectURL(new Blob([serializeLogEntries(entries, now)], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = logFileName(now);
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  elements.logDisplayMode?.addEventListener("change", () => setDisplayMode(elements.logDisplayMode.value));
  elements.logPauseScroll?.addEventListener("click", () => setPaused(!paused));
  elements.saveLog?.addEventListener("click", save);
  elements.clearLog?.addEventListener("click", clear);
  if (elements.logDisplayMode) elements.logDisplayMode.value = displayMode;
  updateCounters();

  return {
    append,
    clear,
    finalizeRxCoalesce,
    queueRx,
    resetRxCoalesce,
    save,
    setDisplayMode,
    setPaused,
  };
}
