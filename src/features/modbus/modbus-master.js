import i18n from "../../i18n.js";
import { createRequestMaster } from "../../framing/request-master.js";
import { extractRtuFrames, matchRtuResponse, parseRtuRequest, parseRtuResponse } from "../../modbus/modbus.js";

// RTU needs a silent gap between frames; like common master tools, never poll back-to-back.
export const MIN_POLL_GAP_MS = 20;

const MODBUS_RTU = {
  parseRequest: parseRtuRequest,
  extractFrames: extractRtuFrames,
  parseResponse: parseRtuResponse,
  matches: matchRtuResponse,
  isException: (response) => response.exceptionCode !== undefined,
  invalidRequestMessage: () => i18n("modbus.master.invalidRequest"),
};

/** The Modbus RTU master session: one request in flight, matched by slave, function, length and write echo. */
export function createModbusMaster(options) {
  return createRequestMaster({ ...options, protocol: MODBUS_RTU, minPollGapMs: MIN_POLL_GAP_MS });
}
