// Texts of the canvas page built from the protocol core's error codes and statuses.

import i18n from "../../i18n.js";
import { MODBUS_EXCEPTION_NAMES } from "../../hmi/modbus-poll.js";

const fill = (text, args) => args.reduce((out, arg, index) => out.replaceAll(`{${index}}`, String(arg)), text);

/** A parser setting's error (ParserConfigError) in the page's language. */
export function parserErrorText(error) {
  if (!error?.code) return String(error?.message ?? error);
  return fill(i18n(`hmi.err.parser.${error.code}`, error.message), error.args ?? []);
}

/** Why a .uidp file was rejected (ProjectError). */
export function projectErrorText(error) {
  if (!error?.code) return String(error?.message ?? error);
  if (error.code === "parser") return parserErrorText(error.args?.[0]);
  if (error.code === "cardParser") {
    return fill(i18n("hmi.err.project.cardParser", error.message), [error.args[0], parserErrorText(error.args[1])]);
  }
  return fill(i18n(`hmi.err.project.${error.code}`, error.message), error.args ?? []);
}

/** A command's error (CommandError). */
export function commandErrorText(error) {
  if (!error?.code) return String(error?.message ?? error);
  return fill(i18n(`hmi.err.command.${error.code}`, error.message), error.args ?? []);
}

export function modbusExceptionText(code) {
  const name = MODBUS_EXCEPTION_NAMES[code];
  const hex = Number(code).toString(16).toUpperCase().padStart(2, "0");
  return `${i18n("hmi.modbus.exception")} ${hex}${name ? ` ${i18n(`hmi.modbus.exc${code}`, name)}` : ""}`;
}

/** A runtime notice: { code, args } from the runtime's notify(). */
export function noticeText(code, args = []) {
  switch (code) {
    case "command": return commandErrorText(args[0]);
    case "modbusException": return `${i18n("hmi.notice.deviceReturned")}${modbusExceptionText(args[0])}`;
    case "modbusTimeout": return i18n("hmi.notice.modbusTimeout").replace("{ms}", String(args[0]));
    case "sendFailed": return `${i18n("hmi.notice.sendFailed")}${args[0] ?? ""}`;
    default: return i18n(`hmi.notice.${code}`);
  }
}

function problemText(problem) {
  if (!problem) return "";
  if (problem.kind === "exception") return modbusExceptionText(problem.code);
  if (problem.kind === "send") return i18n("hmi.notice.sendFailed");
  return i18n("hmi.status.noReply");
}

/** The toolbar status of a run: Modbus polling, a slave-role card, or nothing to poll. */
export function statusText(status) {
  if (!status) return "";
  if (status.kind === "parserError") return parserErrorText(status.error);
  if (status.kind === "slave") return i18n("hmi.status.slave");
  if (status.kind === "noLinks") return i18n("hmi.status.noLinks");
  if (status.kind === "idle") return i18n("hmi.status.running");
  if (status.kind !== "modbus") return "";
  if (status.state === "waiting") return i18n("hmi.status.waiting");
  if (status.state === "none") return i18n("hmi.status.noBindings");
  const counts = i18n("hmi.status.counts").replace("{blocks}", String(status.blocks.length))
    .replace("{ok}", String(status.ok)).replace("{timeouts}", String(status.timeouts));
  if (!status.failure) return counts;
  const [slave, fc, start] = status.failure.block;
  const where = i18n("hmi.status.block").replace("{n}", String(status.failure.index + 1))
    .replace("{slave}", String(slave)).replace("{fc}", String(fc)).replace("{start}", String(start));
  const label = status.state === "failed" ? i18n("hmi.status.lastError") : i18n("hmi.status.lastErrorEarlier");
  return `${counts} · ${label}${where} ${problemText(status.failure.problem)}`;
}

/** The tooltip of the status: one line per read block. */
export function statusTip(status) {
  if (status?.kind !== "modbus" || !status.blocks?.length) return statusText(status);
  return status.blocks.map(([slave, fc, start, count, period]) => i18n("hmi.status.blockTip")
    .replace("{slave}", String(slave)).replace("{fc}", String(fc)).replace("{start}", String(start))
    .replace("{end}", String(start + count - 1)).replace("{period}", String(period))).join("\n");
}

/** A LogBox line: { level, code, args, text } from the runtime. */
export function logText(entry) {
  switch (entry.code) {
    case "data": return entry.text;
    case "connected": return `${i18n("hmi.log.connected")}${entry.args[0] ?? ""}`;
    case "disconnected": return i18n("hmi.log.disconnected");
    case "error": return `${i18n("hmi.log.error")}${entry.args[0] ?? ""}`;
    case "parse": return `${i18n("hmi.log.parseError")}${entry.args[0] ?? ""}`;
    default: return noticeText(entry.code, entry.args);
  }
}
