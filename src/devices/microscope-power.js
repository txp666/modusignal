import i18n from "../i18n.js";

export const MICROSCOPE_POWER_DEVICE_ID = "microscope-power";

export function getMicroScopePowerProfile() {
  return {
    id: MICROSCOPE_POWER_DEVICE_ID,
    name: "MicroScope Power",
    type: i18n("microscopePower.profile.type"),
    protocolStatus: "ready",
    defaultTransportId: "serial",
  };
}
