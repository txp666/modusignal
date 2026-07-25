import { registerDebugCurveFormElements } from "../debug-curve-form.js";

const DEBUG_CURVE_PREFIXES = ["mqtt", "websocket", "custom", "modbus"];

/**
 * Builds the shared DOM registry after all page fragments have been mounted.
 * Elements whose key matches their unique id are discovered automatically;
 * only collections and selector aliases are declared explicitly.
 */
export function collectAppElements(root = document) {
  const elements = {};

  root.querySelectorAll("[id]").forEach((element) => {
    elements[element.id] = element;
  });

  Object.assign(elements, {
    appShell: root.querySelector(".app-shell"),
    modeRow: root.querySelector("#aomasterPage .mode-row"),
    pages: [...root.querySelectorAll("[data-page-id]")],
    aomasterValueDisplayMode: [...root.querySelectorAll('input[name="aomasterValueDisplayMode"]')],
    hartWorkspaceTabs: [...root.querySelectorAll("[data-hart-workspace-tab]")],
    hartWorkspacePanels: [...root.querySelectorAll("[data-hart-workspace-panel]")],
    hartWorkspaceActions: [...root.querySelectorAll("[data-hart-workspace-action]")],
    hartChartSeriesInputs: [...root.querySelectorAll("[data-hart-series]")],
  });

  DEBUG_CURVE_PREFIXES.forEach((prefix) => {
    registerDebugCurveFormElements(prefix, elements, root);
  });

  return elements;
}
