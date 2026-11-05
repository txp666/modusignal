import i18n from "../../i18n.js";
import {
  createHartSearchCommand,
  HART_DEVICE_ID,
  mergeHartDiscovery,
  normalizeHartConfig,
} from "../../devices/hart-device.js";
import { formatHartDeviceSummary, parseCommand0Device } from "../../hart/hart.js";
import {
  HARTLINK_VERSION_QUERY,
  isHartLinkVersionProbeChunk,
  parseHartLinkVersionResponse,
} from "../../hart/hartlink.js";

const LINK_DETECT_DELAY_MS = 80;
const LINK_DETECT_TIMEOUT_MS = 1200;
const LINK_RESPONSE_BUFFER_LIMIT = 512;
const SCAN_LAST_ADDRESS = 15;

const delay = (milliseconds) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));

export function createHartSessionController({
  elements,
  getConfig,
  setConfig,
  getSession,
  getDeviceId,
  canProbeLink,
  populateConfigForm,
  updateDeviceUi,
  resetRxBuffer,
  sendRequest,
  onDiscovered,
  bytesToHex,
  appendLog,
}) {
  let addressScanActive = false;
  let scanStopRequested = false;
  let scanAddress = null;
  let linkProbeTimer = null;
  let linkResponseBuffer = "";
  let linkState = { status: "idle", version: "", model: "" };

  function isAddressScanActive() {
    return addressScanActive;
  }

  /** null when no scan runs, else the address being searched and whether a stop was requested. */
  function getScanProgress() {
    return addressScanActive ? { address: scanAddress, stopping: scanStopRequested } : null;
  }

  function clearLinkProbeTimer() {
    if (linkProbeTimer) {
      window.clearTimeout(linkProbeTimer);
      linkProbeTimer = null;
    }
  }

  function updateLinkInfo() {
    if (!elements.hartlinkVersionInfo) return;

    const { status, version, model } = linkState;
    const translationKey =
      status === "detecting"
        ? "hart.hartlinkDetecting"
        : status === "detected"
          ? "hart.hartlinkDetected"
          : status === "not-detected"
            ? "hart.hartlinkNotDetected"
            : status === "error"
              ? "hart.hartlinkProbeFailed"
              : "hart.hartlinkWaiting";

    elements.hartlinkVersionInfo.dataset.state = status;
    elements.hartlinkVersionInfo.textContent = i18n(translationKey)
      .replace("{version}", version)
      .replace("{model}", model);
  }

  function setLinkState(status, details = {}) {
    linkState = {
      status,
      version: details.version ?? "",
      model: details.model ?? "",
    };
    updateLinkInfo();
  }

  function resetLinkProbe(status = "idle") {
    clearLinkProbeTimer();
    linkResponseBuffer = "";
    setLinkState(status);
  }

  function handleLinkProbeRx(text) {
    if (linkState.status !== "detecting" || !isHartLinkVersionProbeChunk(text)) return false;

    linkResponseBuffer = `${linkResponseBuffer}${text}`.slice(-LINK_RESPONSE_BUFFER_LIMIT);
    const detected = parseHartLinkVersionResponse(linkResponseBuffer);
    if (!detected) return true;

    clearLinkProbeTimer();
    linkResponseBuffer = "";
    resetRxBuffer();
    setLinkState("detected", detected);
    appendLog(
      "info",
      "HARTLink",
      i18n("hart.hartlinkDetectedLog")
        .replace("{version}", detected.version)
        .replace("{model}", detected.model),
    );
    return true;
  }

  async function detectLinkVersion(targetSession = getSession()) {
    resetLinkProbe("detecting");
    resetRxBuffer();
    await delay(LINK_DETECT_DELAY_MS);

    if (targetSession !== getSession() || !targetSession?.connected || getDeviceId() !== HART_DEVICE_ID || !canProbeLink()) {
      resetLinkProbe();
      return;
    }

    try {
      await targetSession.write(HARTLINK_VERSION_QUERY);
    } catch (error) {
      if (targetSession === getSession() && targetSession?.connected) {
        resetLinkProbe("error");
        appendLog("warning", "HARTLink", `${i18n("hart.hartlinkProbeFailed")}: ${error.message}`);
      }
      return;
    }

    if (linkState.status !== "detecting") return;
    linkProbeTimer = window.setTimeout(() => {
      linkProbeTimer = null;
      if (linkState.status !== "detecting") return;
      linkResponseBuffer = "";
      resetRxBuffer();
      setLinkState("not-detected");
      appendLog("info", "HARTLink", i18n("hart.hartlinkNotDetectedLog"));
    }, LINK_DETECT_TIMEOUT_MS);
  }

  /** Cmd 0 at a short address; resolves to the finished exchange, or null when it could not be sent. */
  function sendCommand0(pollAddress, source) {
    const searchConfig = normalizeHartConfig({ ...getConfig(), pollAddress });
    return sendRequest(createHartSearchCommand(searchConfig, { bytesToHex }).bytes, source);
  }

  async function sendSearchCommand(pollAddress = normalizeHartConfig(getConfig()).pollAddress) {
    if (!getSession()?.connected) return null;
    return sendCommand0(pollAddress, "search");
  }

  function applyDiscovery(telemetry) {
    const nextConfig = mergeHartDiscovery(getConfig(), telemetry);
    setConfig(nextConfig);
    populateConfigForm(nextConfig);
    onDiscovered();
    appendLog("info", "HART", formatHartDeviceSummary(nextConfig.device));
    updateDeviceUi();
  }

  /** Searches addresses 0–15 one exchange at a time; calling it again while it runs stops it. */
  async function scanAddresses() {
    if (addressScanActive) {
      // The exchange in flight still finishes (at most one response timeout).
      scanStopRequested = true;
      updateDeviceUi();
      return;
    }
    if (!getSession()?.connected) return;

    addressScanActive = true;
    updateDeviceUi();
    appendLog("info", "HART", i18n("hart.scanStarted"));

    let found = false;
    try {
      for (let address = 0; address <= SCAN_LAST_ADDRESS; address += 1) {
        if (scanStopRequested || !getSession()?.connected) break;
        scanAddress = address;
        updateDeviceUi();
        const transaction = await sendCommand0(address, "scan");
        if (transaction?.status === "ok" && parseCommand0Device(transaction.response)) {
          found = true;
          appendLog("info", "HART", i18n("hart.scanFound").replace("{address}", String(address)));
          break;
        }
      }
      if (!found) {
        const stopped = scanStopRequested || !getSession()?.connected;
        appendLog("warning", "HART", i18n(stopped ? "hart.scanStopped" : "hart.scanNotFound"));
      }
    } finally {
      addressScanActive = false;
      scanStopRequested = false;
      scanAddress = null;
      updateDeviceUi();
    }
  }

  return {
    applyDiscovery,
    detectLinkVersion,
    getScanProgress,
    handleLinkProbeRx,
    isAddressScanActive,
    resetLinkProbe,
    scanAddresses,
    sendSearchCommand,
    updateLinkInfo,
  };
}
