import i18n from "./i18n.js";

const HELP_CONTENT = {
  aomaster: {
    title: () => i18n("curve.help.title.aomaster"),
    html: () => i18n("curve.help.html.aomaster"),
  },
  modbus: {
    title: () => i18n("curve.help.title.modbus"),
    html: () => i18n("curve.help.html.modbus"),
  },
  hart: {
    title: () => i18n("curve.help.title.hart"),
    html: () => i18n("curve.help.html.hart"),
  },
  custom: {
    title: () => i18n("curve.help.title.custom"),
    html: () => i18n("curve.help.html.custom"),
  },
  websocket: {
    title: () => i18n("curve.help.title.websocket"),
    html: () => i18n("curve.help.html.websocket"),
  },
  mqtt: {
    title: () => i18n("curve.help.title.mqtt"),
    html: () => i18n("curve.help.html.mqtt"),
  },
};

export function getChartCurveHelp(deviceId) {
  const entry = HELP_CONTENT[deviceId];
  if (entry) {
    return { title: entry.title(), html: entry.html() };
  }
  return {
    title: i18n("curve.help.title.default"),
    html: i18n("curve.help.defaultContent"),
  };
}

export function listChartCurveHelpDeviceIds() {
  return Object.keys(HELP_CONTENT);
}
