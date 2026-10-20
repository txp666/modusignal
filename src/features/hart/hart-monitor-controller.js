import i18n from "../../i18n.js";
import { HART_VARIABLE_CARDS, interpretHartFrame, normalizeHartConfig } from "../../devices/hart-device.js";

export function createHartMonitorController({
  elements,
  getConfig,
  setConfig,
  ensureChart,
  getChart,
  updateWorkspaceFromTelemetry,
  onDiscovery,
  syncChartPanel,
}) {
  // The cards keep the latest reading until new values arrive or the chart is cleared.
  let cardVariables = {};

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
    cardVariables = variables;
    renderVariableCards();
  }

  function renderVariableCards() {
    const variables = cardVariables;
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

  /** A response from the master (with its exchange) or a burst message (without one). */
  function handleFrame(response, transaction) {
    const telemetry = interpretHartFrame(response, getConfig());
    if (!telemetry) return;
    const source = transaction?.source ?? "burst";
    if (telemetry.isDiscovery) {
      if (source === "command") updateCommandResponse(telemetry);
      onDiscovery(telemetry);
      return;
    }
    handleTelemetry(telemetry, source);
  }

  function handleTelemetry(telemetry, source) {
    // Polls and burst messages feed the cards and chart; the response view keeps the last command's answer.
    if (source !== "poll" && source !== "burst") updateCommandResponse(telemetry);
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
    handleFrame,
    handleSeriesChange,
    renderVariableCards,
    syncSeriesControls,
    updateVariableCards,
  };
}
