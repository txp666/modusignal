import i18n from "../i18n.js";

export const CUSTOM_DEVICE_ID = "custom";
export const CUSTOM_DEFAULT_BAUD_RATE = 115200;

export const CUSTOM_TRANSPORT_DEFAULTS = {
  baudRate: CUSTOM_DEFAULT_BAUD_RATE,
  parity: "none",
  dataBits: 8,
  stopBits: 1,
  flowControl: "none",
};

/**
 * The custom device is a .uidp canvas (src/features/canvas/): its widgets bind to the parsed
 * data and send their own commands, so the profile has no setpoint modes.
 */
export function getCustomProfile() {
  return {
    id: CUSTOM_DEVICE_ID,
    name: i18n("custom.profile.name"),
    type: i18n("custom.profile.type"),
    protocolStatus: "custom",
    defaultTransportId: "serial",
  };
}
