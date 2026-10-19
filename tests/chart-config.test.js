import test from "node:test";
import assert from "node:assert/strict";
import { CHART_CONFIG_STORAGE_KEY, DEFAULT_CHART_CONFIG, getChartPointSettings, loadChartConfig } from "../src/chart-config.js";

function memoryStorage(values = {}) {
  const entries = new Map(Object.entries(values));
  return {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, value),
  };
}

test("a fresh chart displays one third of the default history", () => {
  assert.deepEqual(loadChartConfig(memoryStorage()), {
    chartPointCount: 3000,
    visibleChartPointCount: 1000,
  });
  assert.deepEqual(getChartPointSettings(), { totalPointCount: 3000, visiblePointCount: 1000 });
  assert.equal(getChartPointSettings({ chartPointCount: 500 }).visiblePointCount, 500);
});

test("the old default window upgrades once and a later explicit 240 is respected", () => {
  const storage = memoryStorage({
    "modusignal.chart.v1": JSON.stringify({ chartPointCount: 3000, visibleChartPointCount: 240 }),
  });
  assert.deepEqual(loadChartConfig(storage), DEFAULT_CHART_CONFIG);
  assert.deepEqual(JSON.parse(storage.getItem(CHART_CONFIG_STORAGE_KEY)), DEFAULT_CHART_CONFIG);
  storage.setItem(CHART_CONFIG_STORAGE_KEY, JSON.stringify({ chartPointCount: 3000, visibleChartPointCount: 240 }));
  assert.equal(loadChartConfig(storage).visibleChartPointCount, 240);
});

test("existing custom history and visible ranges are retained", () => {
  for (const config of [
    { chartPointCount: 3000, visibleChartPointCount: 600 },
    { chartPointCount: 6000, visibleChartPointCount: 240 },
  ]) {
    assert.deepEqual(loadChartConfig(memoryStorage({ "modusignal.chart.v1": JSON.stringify(config) })), config);
  }
});

test("legacy AOMaster chart settings migrate without importing device fields", () => {
  const storage = memoryStorage({
    "modusignal.aomasterDevice.v1": JSON.stringify({ slaveId: 8, chartPointCount: 3000, visibleChartPointCount: 240 }),
  });
  assert.deepEqual(loadChartConfig(storage), DEFAULT_CHART_CONFIG);
});

test("blocked or invalid storage falls back to the wider default", () => {
  assert.deepEqual(loadChartConfig({ getItem() { throw new Error("blocked"); } }), DEFAULT_CHART_CONFIG);
  assert.deepEqual(loadChartConfig(memoryStorage({ [CHART_CONFIG_STORAGE_KEY]: "invalid" })), DEFAULT_CHART_CONFIG);
  const storage = memoryStorage({ "modusignal.chart.v1": '{"chartPointCount":3000,"visibleChartPointCount":240}' });
  storage.setItem = () => { throw new Error("read only"); };
  assert.deepEqual(loadChartConfig(storage), DEFAULT_CHART_CONFIG);
});
