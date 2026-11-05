import assert from "node:assert/strict";
import test from "node:test";

import {
  buildChartCsvText,
  getFiniteSeriesExtent,
  getLastFiniteValue,
  parseChartCsvText,
  resolveImportedSeriesKey,
} from "../src/monitoring/chart-csv.js";

test("chart CSV round-trips metadata, quoted names, and sparse values", () => {
  const context = {
    kind: "multi",
    title: "Pressure, Temperature",
    series: [
      { key: "pv", name: "Pressure, PV", unit: "kPa", values: [1, 2, 3] },
      { key: "sv", name: "Temperature", unit: "°C", values: [20, null, 22] },
    ],
  };
  const exported = buildChartCsvText(context, "hart");
  const parsed = parseChartCsvText(exported.text);

  assert.equal(exported.pointCount, 3);
  assert.equal(parsed.metadata.deviceId, "hart");
  assert.deepEqual(parsed.seriesKeys, ["pv", "sv"]);
  assert.deepEqual(parsed.seriesData.pv, [1, 2, 3]);
  assert.deepEqual(parsed.seriesData.sv, [20, null, 22]);
});

test("chart CSV helpers resolve imported series and finite ranges", () => {
  const parsed = {
    metadata: { series: [{ key: "temperature", name: "SV" }] },
    seriesKeys: ["temperature"],
    seriesData: { temperature: [null, 20, 22] },
  };
  assert.equal(resolveImportedSeriesKey(parsed, { key: "sv", name: "SV" }, 0), "temperature");
  assert.equal(getLastFiniteValue(parsed.seriesData.temperature), 22);
  assert.deepEqual(getFiniteSeriesExtent([[null, -1], [2, 5]]), { min: -1, max: 5 });
});
