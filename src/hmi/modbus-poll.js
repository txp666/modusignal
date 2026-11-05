// Modbus automatic polling of a .uidp runtime, as PyQt UI Designer's modbus_master.py and
// modbus_poller.py have it: what the Modbus bindings and chart curves read is merged into read
// blocks, each read at its own period; one request on the wire at a time, a control's write
// ahead of the waiting reads. Timers and the link are injected; no DOM.

import { modbusFrame } from "./commands.js";

const FUNCTION_OF_TABLE = { hr: 3, ir: 4, co: 1, di: 2 };
const MAX_GAP = { 3: 8, 4: 8, 1: 64, 2: 64 };
const MAX_LEN = { 3: 120, 4: 120, 1: 1000, 2: 1000 };

export const DEFAULT_PERIOD = 500;
export const DEFAULT_TIMEOUT = 1000;
export const DEFAULT_SLAVE = 1;
const DUE_EARLY = 10;

const compareTuples = (a, b) => {
  for (let i = 0; i < Math.min(a.length, b.length); i += 1) {
    if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
  }
  return a.length - b.length;
};

/**
 * Read blocks covering what is needed: [slave, fc, start, count, period] in (slave, fc, start) order.
 * A need is { slave, table (hr / ir / co / di), address, count, period (0: the default) }.
 */
export function planBlocks(needs, defaultPeriod) {
  const groups = new Map();
  for (const need of needs) {
    const fc = FUNCTION_OF_TABLE[need.table];
    const period = need.period || defaultPeriod;
    const key = `${need.slave}:${fc}`;
    if (!groups.has(key)) groups.set(key, { slave: need.slave, fc, items: [] });
    groups.get(key).items.push([need.address, need.count, period]);
  }
  const blocks = [];
  const sorted = [...groups.values()].sort((a, b) => compareTuples([a.slave, a.fc], [b.slave, b.fc]));
  for (const { slave, fc, items } of sorted) {
    items.sort(compareTuples);
    let start = null;
    let end = null;
    let period = null;
    for (const [address, count, needPeriod] of items) {
      const needEnd = address + count;
      if (start !== null && address <= end + MAX_GAP[fc] && needEnd - start <= MAX_LEN[fc]) {
        end = Math.max(end, needEnd);
        period = Math.min(period, needPeriod);
      } else {
        if (start !== null) blocks.push([slave, fc, start, end - start, period]);
        start = address;
        end = needEnd;
        period = needPeriod;
      }
    }
    if (start !== null) blocks.push([slave, fc, start, end - start, period]);
  }
  return blocks.sort((a, b) => compareTuples(a.slice(0, 3), b.slice(0, 3)));
}

export const MODBUS_EXCEPTION_NAMES = {
  1: "非法功能码", 2: "非法数据地址", 3: "非法数据值", 4: "从站设备故障",
  5: "已确认，处理中", 6: "从站忙", 10: "网关路径不可用", 11: "网关目标设备无响应",
};

/**
 * The request queue of one link. `write(frame)` sends (a promise), `parserType()` names the link's
 * Modbus framing; handleMessage(message) gets every message the link parsed. A result is
 * { ok, message, problem: null | { kind: "timeout", timeout } | { kind: "exception", code } | { kind: "send" } }.
 */
export function createModbusMaster({ write, parserType, isConnected, setTimer = setTimeout, clearTimer = clearTimeout }) {
  let queue = [];
  let current = null;
  let timer = null;
  let transaction = 0;

  const call = (entry, result) => entry.onDone?.(result);

  function nextTransaction() {
    transaction = (transaction + 1) & 0xffff;
    return transaction;
  }

  function start(entry) {
    current = entry;
    Promise.resolve()
      .then(() => write(entry.frame))
      .then(() => {
        if (current === entry && timer === null) timer = setTimer(onTimeout, entry.timeout);
      }, () => {
        if (current === entry) finish({ ok: false, message: {}, problem: { kind: "send" } });
      });
  }

  function pump() {
    while (current === null && queue.length) start(queue.shift());
  }

  function finish(result) {
    const entry = current;
    current = null;
    if (timer !== null) clearTimer(timer);
    timer = null;
    call(entry, result);
    pump();
  }

  function onTimeout() {
    timer = null;
    if (current) finish({ ok: false, message: {}, problem: { kind: "timeout", timeout: current.timeout } });
  }

  function answers(data) {
    const { slave, func, address } = current.request;
    const reply = data.fc;
    if (data.slave !== slave || (reply !== func && reply !== (func | 0x80))) return false;
    if (reply === func && [1, 2, 3, 4].includes(func)) return data.start === address;
    const where = data.start ?? data.address;
    return where === undefined || where === address;
  }

  return {
    /** Queue a request; the frame it goes out as, or null when the link is down. */
    enqueue(request, timeout = DEFAULT_TIMEOUT, priority = "read", onDone = null, owner = null) {
      if (!isConnected()) return null;
      const type = parserType();
      const frame = modbusFrame(request, type, type === "modbus_tcp" ? nextTransaction() : 0);
      const entry = { request, frame, timeout: Math.max(1, Math.trunc(timeout)), onDone, write: priority === "write", owner };
      if (current === null && !queue.length) {
        start(entry);
        return frame;
      }
      if (entry.write) queue.splice(queue.filter((queued) => queued.write).length, 0, entry);
      else queue.push(entry);
      return frame;
    },
    withdraw(owner) {
      queue = queue.filter((entry) => entry.owner !== owner);
    },
    busy: () => current !== null,
    /** The link went down (or a new connection starts): every request ends as timed out. */
    cancelAll() {
      const entries = [...(current ? [current] : []), ...queue];
      current = null;
      queue = [];
      if (timer !== null) clearTimer(timer);
      timer = null;
      for (const entry of entries) call(entry, { ok: false, message: {}, problem: { kind: "timeout", timeout: entry.timeout } });
    },
    resetTransactions() {
      transaction = 0;
    },
    handleMessage(data) {
      if (!current || !answers(data)) return;
      const code = data.error;
      finish(code === undefined
        ? { ok: true, message: data, problem: null }
        : { ok: false, message: data, problem: { kind: "exception", code } });
    },
  };
}

/**
 * Reads the blocks of what the bindings need over the master `getMaster()` returns (that of the
 * first connected link that polls; null while there is none). `getNeeds()` returns
 * { slave (≤0: the default slave), table, address, count, period } each; `getSettings()`
 * { period, timeout, slave }. `onStatus(status)` gets
 * { state: "waiting" | "none" | "polling" | "ok" | "failed", blocks, ok, timeouts, failure }
 * where failure is { index, block, problem } of the last block that failed.
 */
export function createModbusPoller({
  getMaster, getNeeds, getSettings, onStatus = () => {},
  now = () => Date.now(), setTimer = setTimeout, clearTimer = clearTimeout,
}) {
  let active = false;
  let blocks = [];
  let due = new Map();
  let results = new Map();
  let roundState = null;
  let read = null;
  let wake = null;
  let counts = { ok: 0, timeouts: 0 };
  let failure = null;
  let lastStatus = "";
  let readMaster = null;
  const owner = {};

  const keyOf = (block) => block.join(",");

  function setStatus(state) {
    const status = { state, blocks: blocks.map((block) => [...block]), ok: counts.ok, timeouts: counts.timeouts, failure };
    const text = JSON.stringify(status);
    if (text !== lastStatus) {
      lastStatus = text;
      onStatus(status);
    }
  }

  function stopWake() {
    if (wake !== null) clearTimer(wake);
    wake = null;
  }

  function plan(settings) {
    const needs = [];
    for (const need of getNeeds()) {
      const slave = need.slave > 0 ? need.slave : settings.slave;
      if (slave >= 1 && slave <= 247 && need.address >= 0 && need.address <= 65535) {
        needs.push({ slave, table: need.table, address: need.address, count: need.count, period: Math.max(0, need.period) });
      }
    }
    return planBlocks(needs, settings.period);
  }

  function tick() {
    stopWake();
    if (!active) return;
    const settings = getSettings();
    const master = getMaster();
    if (!master) {
      blocks = [];
      due = new Map();
      results = new Map();
      roundState = null;
      setStatus("waiting");
      return;
    }
    const next = plan(settings);
    if (JSON.stringify(next) !== JSON.stringify(blocks)) {
      blocks = next;
      due = new Map(blocks.map((block) => [keyOf(block), due.get(keyOf(block)) ?? 0]));
      results = new Map();
      roundState = null;
    }
    if (!blocks.length) {
      setStatus("none");
      return;
    }
    setStatus(roundState ?? "polling");
    if (read) return;
    const time = now();
    let index = 0;
    for (let i = 1; i < blocks.length; i += 1) {
      if (due.get(keyOf(blocks[i])) < due.get(keyOf(blocks[index]))) index = i;
    }
    const block = blocks[index];
    const dueAt = due.get(keyOf(block));
    if (master.busy()) {
      wake = setTimer(tick, Math.max(DUE_EARLY, dueAt - time));
      return;
    }
    if (dueAt > time + DUE_EARLY) {
      wake = setTimer(tick, dueAt - time);
      return;
    }
    due.set(keyOf(block), time + block[4]);
    const current = { index, block };
    read = current;
    readMaster = master;
    const [slave, fc, start, count] = block;
    const frame = master.enqueue({ slave, func: fc, address: start, value: count, registers: [] }, settings.timeout, "read",
      (result) => onReadDone(current, result), owner);
    if (frame === null) {
      read = null;
      blockDone(index, block, { kind: "timeout", timeout: settings.timeout });
    }
  }

  function onReadDone(current, result) {
    if (current !== read) return;
    read = null;
    if (result.ok) counts.ok += 1;
    else if (result.problem?.kind !== "exception") counts.timeouts += 1;
    blockDone(current.index, current.block, result.ok ? null : result.problem);
  }

  function blockDone(index, block, problem) {
    if (index < blocks.length && keyOf(blocks[index]) === keyOf(block)) {
      if (!results.has(index) || results.get(index) === null) results.set(index, problem);
      if (problem) failure = { index, block: [...block], problem };
      if (results.size === blocks.length) {
        const failed = blocks.findIndex((_, i) => results.get(i) !== null);
        roundState = failed < 0 ? "ok" : "failed";
        if (failed >= 0) failure = { index: failed, block: [...blocks[failed]], problem: results.get(failed) };
        results = new Map();
      }
    }
    tick();
  }

  return {
    start() {
      if (active) return;
      active = true;
      counts = { ok: 0, timeouts: 0 };
      failure = null;
      tick();
    },
    stop() {
      active = false;
      stopWake();
      read = null;
      readMaster?.withdraw(owner);
      readMaster = null;
      blocks = [];
      due = new Map();
      results = new Map();
      roundState = null;
      lastStatus = "";
    },
    /** Something changed (bindings, settings, the link): plan again now. */
    refresh() {
      if (active) tick();
    },
    isActive: () => active,
    blocks: () => blocks.map((block) => [...block]),
  };
}
