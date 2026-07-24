import i18n from "../../i18n.js";
import {
  createHartSearchCommand,
  DEFAULT_HART_CONFIG,
  HART_DEVICE_ID,
  normalizeHartConfig,
} from "../../devices/hart-device.js";
import {
  HARTLINK_VERSION_QUERY,
  isHartLinkVersionProbeChunk,
  parseHartLinkVersionResponse,
} from "../../hart/hartlink.js";

const LINK_DETECT_DELAY_MS = 80;
const LINK_DETECT_TIMEOUT_MS = 1200;
const LINK_RESPONSE_BUFFER_LIMIT = 512;
const SCAN_ADDRESS_DELAY_MS = 650;

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
  bytesToHex,
  appendLog,
}) {
  let addressScanActive = false;
  let linkProbeTimer = null;
  let linkResponseBuffer = "";
  let linkState = { status: "idle", version: "", model: "" };

  function isAddressScanActive() {
    return addressScanActive;
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

  async function sendSearchCommand(pollAddress = normalizeHartConfig(getConfig()).pollAddress) {
    const session = getSession();
    if (!session?.connected) return;

    resetRxBuffer();
    const searchConfig = normalizeHartConfig({ ...getConfig(), pollAddress, command: 0 });
    const command = createHartSearchCommand(searchConfig, { bytesToHex });
    await session.write(command.bytes);
  }

  async function scanAddresses() {
    if (!getSession()?.connected || addressScanActive) return;

    const originalConfig = normalizeHartConfig(getConfig());
    addressScanActive = true;
    resetRxBuffer();
    updateDeviceUi();
    appendLog("info", "HART", i18n("hart.scanStarted"));

    try {
      for (let address = 0; address <= 15; address += 1) {
        if (!addressScanActive || !getSession()?.connected) break;

        const nextConfig = normalizeHartConfig({
          ...getConfig(),
          pollAddress: address,
          device: { ...DEFAULT_HART_CONFIG.device },
        });
        setConfig(nextConfig);
        populateConfigForm(nextConfig);
        updateDeviceUi();
        await sendSearchCommand(address);

        const startedAt = Date.now();
        while (Date.now() - startedAt < SCAN_ADDRESS_DELAY_MS) {
          if (!addressScanActive || !getSession()?.connected) break;
          if (normalizeHartConfig(getConfig()).device.discovered) {
            appendLog("info", "HART", i18n("hart.scanFound").replace("{address}", String(normalizeHartConfig(getConfig()).pollAddress)));
            return;
          }
          await delay(50);
        }
      }

      if (!normalizeHartConfig(getConfig()).device.discovered) {
        setConfig(originalConfig);
        populateConfigForm(originalConfig);
        appendLog("warning", "HART", i18n("hart.scanNotFound"));
      }
    } finally {
      addressScanActive = false;
      updateDeviceUi();
    }
  }

  return {
    detectLinkVersion,
    handleLinkProbeRx,
    isAddressScanActive,
    resetLinkProbe,
    scanAddresses,
    sendSearchCommand,
    updateLinkInfo,
  };
}
