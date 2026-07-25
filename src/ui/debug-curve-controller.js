import { JSON_CURVE_SLOTS } from "../devices/json-curve-config.js";
import { removeMultiCurveSlot } from "../devices/binary-curve-config.js";

export function createDebugCurveController({ elements }) {
  const handlersByPrefix = new Map();
  const getHandlers = (prefix) => handlersByPrefix.get(prefix);

  function register(prefix, handlers) {
    handlersByPrefix.set(prefix, handlers);
  }
  function syncRows(prefix, config) {
    const normalized = getHandlers(prefix).normalize(config);
    const field = elements[`${prefix}CurveConfigBlock`];
    const addButton = elements[`${prefix}AddCurve`];
    field?.querySelectorAll(".curve-config-row[data-curve-slot]").forEach((row) => {
      row.hidden = Number(row.dataset.curveSlot) > normalized.curveSlotCount;
    });
    if (addButton) addButton.hidden = normalized.curveSlotCount >= JSON_CURVE_SLOTS.length;
  }

  function remove(prefix, slotNumber) {
    const handlers = getHandlers(prefix);
    const next = handlers.normalize(removeMultiCurveSlot(handlers.readForm(), slotNumber, handlers.defaults));
    handlers.assign(next);
    handlers.populateForm(next);
    handlers.updateDraft();
  }

  function add(prefix) {
    const handlers = getHandlers(prefix);
    const config = handlers.readForm();
    const nextSlot = JSON_CURVE_SLOTS[config.curveSlotCount];
    if (!nextSlot) return;
    const next = handlers.normalize({
      ...config,
      curveSlotCount: config.curveSlotCount + 1,
      [nextSlot.enabledKey]: true,
    });
    handlers.assign(next);
    handlers.populateForm(next);
    handlers.updateDraft();
  }

  function bind(prefix) {
    const field = elements[`${prefix}CurveConfigBlock`];
    if (!field || field.dataset.curveActionsBound === "true") return;
    field.dataset.curveActionsBound = "true";
    field.addEventListener("click", (event) => {
      const button = event.target.closest("[data-remove-curve-slot]");
      const slotNumber = Number(button?.dataset.removeCurveSlot);
      if (button && Number.isFinite(slotNumber)) remove(prefix, slotNumber);
    });
  }

  return { add, bind, register, remove, syncRows };
}
