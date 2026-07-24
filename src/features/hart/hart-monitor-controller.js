import i18n from "../../i18n.js";
import { HART_VARIABLE_CARDS, normalizeHartConfig } from "../../devices/hart-device.js";

export function createHartMonitorController({
  elements,
  getConfig,
  setConfig,
  ensureChart,
  getChart,
  updateWorkspaceFromTelemetry,
  syncChartPanel,
}) {
  function buildSeriesDefs(config = getConfig()) {
    const normalized = normalizeHartConfig(config);
    return HART_VARIABLE_CARDS.map((card) => ({
      key: card.key,
      name: card.label,
      unit: card.defaultUnit,
      color: card.color,
      areaColor: `${card.color}1f`,
      visible: normalized.chartSeries[card.key],
    }));
  }

  function syncSeriesControls() {
    if (!elements.hartChartSeriesBlock) return;

    const normalized = normalizeHartConfig(getConfig());
    elements.hartChartSeriesInputs.forEach((input) => {
      const key = input.dataset.hartSeries;
      if (key) input.checked = Boolean(normalized.chartSeries[key]);
    });
  }

  function updateVariableCards(variables = {}) {
    document.querySelectorAll("#hartVariableCards [data-hart-card]").forEach((card) => {
      const key = card.dataset.hartCard;
      const readout = card.querySelector(".hart-value-readout");
      const unit = card.querySelector(".hart-value-unit");
      const entry = variables[key];
      if (!readout || !unit) return;

      const defaults = HART_VARIABLE_CARDS.find((item) => item.key === key);
      if (!entry || !Number.isFinite(entry.value)) {
        readout.textContent = "--";
        unit.textContent = defaults?.defaultUnit ?? "";
        return;
      }

      readout.textContent = entry.value.toFixed(3);
      unit.textContent = entry.unit || defaults?.defaultUnit || "";
    });
  }

  function updateCommandResponse(telemetry) {
    if (!elements.hartCommandResponse || !telemetry?.commandSummary) return;
    const lines = telemetry.commandLines?.length ? telemetry.commandLines : [telemetry.commandSummary];
    elements.hartCommandResponse.textContent = lines.join("\n");
  }

  function handleTelemetry(telemetry) {
    updateCommandResponse(telemetry);
    updateWorkspaceFromTelemetry(telemetry);

    if (telemetry?.isMulti && telemetry.variables) {
      updateVariableCards(telemetry.variables);
      const sample = Object.fromEntries(
        Object.entries(telemetry.variables).map(([key, entry]) => [key, entry.value]),
      );
      ensureChart();
      getChart()?.addSample(sample);

      const summary = Object.entries(telemetry.variables)
        .map(([key, entry]) => {
          const label = HART_VARIABLE_CARDS.find((item) => item.key === key)?.label ?? key;
          return `${label} ${entry.value.toFixed(3)}${entry.unit ? ` ${entry.unit}` : ""}`;
        })
        .join(" · ");
      if (elements.chartValue) elements.chartValue.textContent = summary || i18n("chart.noData");
      return;
    }

    if (telemetry && Number.isFinite(telemetry.value)) {
      ensureChart();
      getChart()?.addSample({ pv: telemetry.value });
      updateVariableCards({ pv: { value: telemetry.value, unit: telemetry.unit } });
      if (elements.chartValue) {
        elements.chartValue.textContent = `${telemetry.fieldName} ${telemetry.value.toFixed(3)}${telemetry.unit ? ` ${telemetry.unit}` : ""}`;
      }
    } else if (telemetry?.isCommandResult && telemetry.commandSummary && elements.chartValue) {
      elements.chartValue.textContent = telemetry.commandSummary;
    }
  }

  function handleSeriesChange(event) {
    const key = event.target.dataset.hartSeries;
    if (!key) return;

    const current = normalizeHartConfig(getConfig());
    setConfig(normalizeHartConfig({
      ...current,
      chartSeries: {
        ...current.chartSeries,
        [key]: event.target.checked,
      },
    }));
    getChart()?.setSeriesVisible(key, event.target.checked);
    syncChartPanel();
  }

  return {
    buildSeriesDefs,
    handleSeriesChange,
    handleTelemetry,
    syncSeriesControls,
    updateVariableCards,
  };
}
