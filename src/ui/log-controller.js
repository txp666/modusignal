const RX_LOG_IDLE_MS = 45;
const MAX_LOG_LINES = 400;

function concatBytes(left, right) {
  const merged = new Uint8Array(left.length + right.length);
  merged.set(left);
  merged.set(right, left.length);
  return merged;
}

export function createLogController({ getLogElement, bytesToHex }) {
  let rxFlushTimer = null;
  let rxBuffer = null;
  let rxPendingLine = null;

  function resetRxCoalesce() {
    if (rxFlushTimer) window.clearTimeout(rxFlushTimer);
    rxFlushTimer = null;
    rxBuffer = null;
    rxPendingLine = null;
  }

  function finalizeRxCoalesce() {
    resetRxCoalesce();
  }

  function append(kind, direction, payload, options = {}) {
    const line = document.createElement("div");
    line.className = `log-line ${kind}`;

    const time = document.createElement("span");
    time.className = "time";
    time.textContent = new Date().toLocaleTimeString("zh-CN", { hour12: false });

    const dir = document.createElement("span");
    dir.className = "dir";
    dir.textContent = direction;

    const content = document.createElement("span");
    content.className = "payload";
    content.textContent = payload;
    line.append(time, dir, content);

    const logElement = getLogElement();
    if (!logElement) return options.returnLine ? line : undefined;
    logElement.append(line);
    logElement.scrollTop = logElement.scrollHeight;
    while (logElement.children.length > MAX_LOG_LINES) logElement.firstElementChild?.remove();
    return options.returnLine ? line : undefined;
  }

  function queueRx(bytes, text, useHexDisplay) {
    if (useHexDisplay) {
      rxBuffer = rxBuffer instanceof Uint8Array ? concatBytes(rxBuffer, bytes) : bytes.slice();
    } else if (text.trim()) {
      rxBuffer = typeof rxBuffer === "string" ? rxBuffer + text : text;
    } else {
      rxBuffer = rxBuffer instanceof Uint8Array ? concatBytes(rxBuffer, bytes) : bytes.slice();
    }

    const payload =
      useHexDisplay && rxBuffer instanceof Uint8Array
        ? bytesToHex(rxBuffer)
        : typeof rxBuffer === "string"
          ? rxBuffer
          : bytesToHex(rxBuffer);

    if (rxPendingLine) {
      const content = rxPendingLine.querySelector(".payload");
      if (content) content.textContent = payload;
    } else {
      rxPendingLine = append("rx", "RX", payload, { returnLine: true });
    }

    if (rxFlushTimer) window.clearTimeout(rxFlushTimer);
    rxFlushTimer = window.setTimeout(finalizeRxCoalesce, RX_LOG_IDLE_MS);
  }

  return {
    append,
    finalizeRxCoalesce,
    queueRx,
    resetRxCoalesce,
  };
}
