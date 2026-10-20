import i18n from "../../i18n.js";
import { decodeModbusDataTelemetry, normalizeModbusConfig } from "../../devices/modbus-device.js";
import { isReadFunctionCode, MODBUS_EXCEPTION_NAMES } from "../../modbus/modbus.js";
import { createModbusMaster } from "./modbus-master.js";
import { formatModbusAddress, formatRegisterRows, isPairFormat } from "./register-table.js";

const LOG_LABEL = "Modbus";

export function describeModbusRequest(request) {
  const code = String(request.functionCode).padStart(2, "0");
  return `${i18n("modbus.slaveShort")} ${request.slaveId} · FC${code} · ${i18n("modbus.addrShort")} ${request.address} ×${request.quantity}`;
}

export function describeModbusException(exceptionCode) {
  const name = MODBUS_EXCEPTION_NAMES[exceptionCode] ?? "unknown";
  const code = exceptionCode.toString(16).toUpperCase().padStart(2, "0");
  return `${i18n("modbus.exceptionLabel")} ${code} ${i18n(`modbus.exception.${name}`)}`;
}

export function describeModbusTimeout(transaction, timeoutMs) {
  let reason = i18n("modbus.timeout.silent");
  if (transaction.foreignFrames > 0) {
    reason = i18n("modbus.timeout.foreign");
  } else if (transaction.rxBytes > 0) {
    reason = `${i18n("modbus.timeout.receivedPrefix")} ${transaction.rxBytes} ${i18n("modbus.timeout.garbledSuffix")}`;
  }
  return `${i18n("modbus.timeoutLabel")} ${timeoutMs} ms · ${reason}`;
}

/**
 * Owns the Modbus master session on the Modbus page: request/response timing,
 * exception and timeout reporting, statistics and the register table.
 */
export function createModbusController({ elements: e, getConfig, getSession, appendLog, onTelemetry, onPollingStopped }) {
  let lastTransaction = null;
  let table = null;

  const master = createModbusMaster({
    write: (bytes) => {
      const session = getSession();
      if (!session?.connected) throw new Error(i18n("transport.serial.notConnected"));
      return session.write(bytes);
    },
    getTimeoutMs: () => normalizeModbusConfig(getConfig()).responseTimeoutMs,
    onTransaction: handleTransaction,
  });

  function handleTransaction(transaction) {
    lastTransaction = transaction;
    const config = normalizeModbusConfig(getConfig());
    const { request } = transaction;
    if (transaction.status === "ok" && isReadFunctionCode(request.functionCode)) {
      const sameBlock = table && table.request.slaveId === request.slaveId &&
        table.request.functionCode === request.functionCode && table.request.address === request.address;
      table = {
        request,
        data: transaction.response.data.slice(),
        previous: sameBlock ? table.data : null,
        receivedAt: new Date(),
        latencyMs: transaction.latencyMs,
      };
      renderTable();
      if (request.slaveId === config.slaveId && request.functionCode === config.functionCode && request.address === config.address) {
        const telemetry = decodeModbusDataTelemetry(table.data, config);
        if (telemetry) onTelemetry(telemetry);
      }
    } else if (transaction.status === "exception") {
      appendLog("error", LOG_LABEL, `${describeModbusRequest(request)} · ${describeModbusException(transaction.response.exceptionCode)}`);
    } else if (transaction.status === "timeout") {
      appendLog("error", LOG_LABEL, `${describeModbusRequest(request)} · ${describeModbusTimeout(transaction, config.responseTimeoutMs)}`);
    }
    renderStatus();
  }

  function renderStatus() {
    const stats = master.getStats();
    if (e.modbusStatRequests) e.modbusStatRequests.textContent = String(stats.requests);
    if (e.modbusStatResponses) e.modbusStatResponses.textContent = String(stats.responses);
    if (e.modbusStatExceptions) e.modbusStatExceptions.textContent = String(stats.exceptions);
    if (e.modbusStatTimeouts) e.modbusStatTimeouts.textContent = String(stats.timeouts);
    if (e.modbusStatLatency) {
      e.modbusStatLatency.textContent = stats.lastLatencyMs === null ? "—" : `${Math.round(stats.lastLatencyMs)} ms`;
    }
    e.modbusStatExceptions?.closest("[data-stat]")?.classList.toggle("alert", stats.exceptions > 0);
    e.modbusStatTimeouts?.closest("[data-stat]")?.classList.toggle("alert", stats.timeouts > 0);
    if (!e.modbusLastResult) return;
    const result = e.modbusLastResult;
    result.classList.remove("ok", "error");
    if (!lastTransaction) {
      result.textContent = i18n("modbus.stats.idle");
      return;
    }
    const { status, request } = lastTransaction;
    const head = describeModbusRequest(request);
    if (status === "ok") {
      result.textContent = `✓ ${head} · ${Math.round(lastTransaction.latencyMs)} ms`;
      result.classList.add("ok");
    } else if (status === "exception") {
      result.textContent = `✗ ${head} · ${describeModbusException(lastTransaction.response.exceptionCode)}`;
      result.classList.add("error");
    } else if (status === "timeout") {
      result.textContent = `✗ ${head} · ${describeModbusTimeout(lastTransaction, normalizeModbusConfig(getConfig()).responseTimeoutMs)}`;
      result.classList.add("error");
    }
  }

  function renderTable() {
    const config = normalizeModbusConfig(getConfig());
    if (e.modbusTableWordOrder) e.modbusTableWordOrder.disabled = !isPairFormat(config.tableFormat);
    if (!e.modbusRegisterRows) return;
    if (!table) {
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.colSpan = 3;
      cell.className = "modbus-table-empty";
      cell.textContent = i18n("modbus.table.empty");
      row.append(cell);
      e.modbusRegisterRows.replaceChildren(row);
      if (e.modbusTableMeta) e.modbusTableMeta.textContent = i18n("modbus.table.desc");
      return;
    }
    const rows = formatRegisterRows(table.data, table.request.address, {
      format: config.tableFormat,
      wordOrder: config.tableWordOrder,
      previous: table.previous,
    });
    e.modbusRegisterRows.replaceChildren(...rows.map((row) => {
      const tr = document.createElement("tr");
      if (row.changed) tr.className = "changed";
      const address = document.createElement("td");
      address.append(String(row.address));
      const hexAddress = document.createElement("small");
      hexAddress.textContent = formatModbusAddress(row.address);
      address.append(hexAddress);
      const hex = document.createElement("td");
      hex.textContent = row.hex;
      const value = document.createElement("td");
      value.textContent = row.continued ? "" : row.value;
      if (row.continued) value.className = "continued";
      tr.append(address, hex, value);
      return tr;
    }));
    if (e.modbusTableMeta) {
      const time = table.receivedAt.toLocaleTimeString(i18n.getLanguage() === "en" ? "en-GB" : "zh-CN", { hour12: false });
      const ms = String(table.receivedAt.getMilliseconds()).padStart(3, "0");
      e.modbusTableMeta.textContent = `${describeModbusRequest(table.request)} · ${time}.${ms} · ${Math.round(table.latencyMs)} ms`;
    }
  }

  async function send(bytes) {
    try {
      return await master.send(bytes);
    } catch (error) {
      appendLog("error", i18n("log.send"), error.message);
      return null;
    }
  }

  function startPolling(buildRequest) {
    master.startPolling(buildRequest, () => normalizeModbusConfig(getConfig()).pollIntervalMs, (error) => {
      appendLog("error", LOG_LABEL, error.message);
      onPollingStopped();
    });
  }

  e.modbusStatsReset?.addEventListener("click", () => {
    master.resetStats();
    lastTransaction = null;
    renderStatus();
  });

  renderStatus();
  renderTable();

  return {
    send,
    startPolling,
    stopPolling: master.stopPolling,
    isPolling: master.isPolling,
    handleRx: master.handleRx,
    handleTx: master.handleTx,
    reset: master.reset,
    refresh: renderTable,
    localize() {
      renderStatus();
      renderTable();
    },
  };
}
