import i18n from "../../i18n.js";

// Schedule only after write completes. A stopped/in-flight write is never retried.
export function createCommandRunner({ getSession, isActive, onChange = () => {}, onError = () => {},
  setTimer = setTimeout, clearTimer = clearTimeout }) {
  let job = null;
  let pending = false;
  let timer = null;
  const snapshot = () => ({ active: Boolean(job?.active), pending, sent: job?.sent ?? 0,
    limit: job?.limit ?? 1, reason: job?.reason ?? "ready" });
  const notify = () => onChange(snapshot());

  function stop(reason = "stopped") {
    if (timer !== null) clearTimer(timer);
    timer = null;
    if (job?.active) { job.active = false; job.reason = reason; }
    notify();
  }

  async function tick(current) {
    timer = null;
    if (!current.active || current !== job) return;
    if (!isActive() || getSession() !== current.session || !current.session.connected) {
      stop("disconnected");
      return;
    }
    pending = true;
    notify();
    try {
      await current.session.write(current.bytes.slice());
      current.sent += 1;
      if (current.active && current.limit > 0 && current.sent >= current.limit) {
        current.active = false;
        current.reason = "complete";
      }
    } catch (error) {
      current.active = false;
      current.reason = "failed";
      onError(error);
    } finally {
      pending = false;
      // stop() may have been called while the transport was writing.
      if (current.active) timer = setTimer(() => void tick(current), current.interval);
      notify();
    }
  }

  function start(bytes, { interval = 1000, limit = 1 } = {}) {
    if (job?.active || pending) throw new Error(i18n("customTools.busy"));
    const session = getSession();
    if (!isActive() || !session?.connected) throw new Error(i18n("customTools.connectFirst"));
    if (!(bytes instanceof Uint8Array) || !bytes.length) throw new Error(i18n("customTools.payloadLimit"));
    if (!Number.isInteger(interval) || interval < 50 || interval > 60000 ||
        !Number.isInteger(limit) || limit < 0 || limit > 100000) {
      throw new Error(i18n("customTools.invalidSchedule"));
    }
    job = { active: true, reason: "running", sent: 0, bytes: bytes.slice(), interval, limit, session };
    return tick(job);
  }

  return { start, stop, snapshot };
}
