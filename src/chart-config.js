export const CHART_MIN_POINTS = 10;
export const CHART_MAX_POINTS = 200000;
export const CHART_MAX_VISIBLE_POINTS = 5000;
export const CHART_DEFAULT_POINTS = 3000;
export const CHART_DEFAULT_VISIBLE_POINTS = 1000;
export const CHART_CONFIG_STORAGE_KEY = "modusignal.chart.v2";

export const DEFAULT_CHART_CONFIG = {
  chartPointCount: CHART_DEFAULT_POINTS,
  visibleChartPointCount: CHART_DEFAULT_VISIBLE_POINTS,
};

export function loadChartConfig(storage) {
  try {
    storage ??= globalThis.localStorage;
    const saved = storage.getItem(CHART_CONFIG_STORAGE_KEY);
    if (saved) return normalizeChartConfig(JSON.parse(saved));

    const legacy = storage.getItem("modusignal.chart.v1")
      || storage.getItem("modusignal.aomasterDevice.v1");
    if (legacy) {
      const config = normalizeChartConfig(JSON.parse(legacy));
      // Upgrade the old default once; retain other saved ranges. The v2 key
      // also lets users explicitly choose 240 again without another upgrade.
      if (config.chartPointCount === 3000 && config.visibleChartPointCount === 240) {
        config.visibleChartPointCount = CHART_DEFAULT_VISIBLE_POINTS;
      }
      try {
        storage.setItem(CHART_CONFIG_STORAGE_KEY, JSON.stringify(config));
      } catch {
        // The larger window still works when storage is read-only.
      }
      return config;
    }
  } catch {
    // Use defaults when storage is unavailable or its contents are invalid.
  }
  return normalizeChartConfig();
}

export function normalizeChartConfig(config = {}) {
  const merged = {
    ...DEFAULT_CHART_CONFIG,
    ...config,
  };

  return {
    chartPointCount: clamp(
      Math.trunc(toFiniteNumber(merged.chartPointCount, DEFAULT_CHART_CONFIG.chartPointCount)),
      CHART_MIN_POINTS,
      CHART_MAX_POINTS,
    ),
    visibleChartPointCount: clamp(
      Math.trunc(toFiniteNumber(merged.visibleChartPointCount, DEFAULT_CHART_CONFIG.visibleChartPointCount)),
      CHART_MIN_POINTS,
      CHART_MAX_VISIBLE_POINTS,
    ),
  };
}

export function getChartPointSettings(config = {}) {
  const normalized = normalizeChartConfig(config);

  return {
    totalPointCount: normalized.chartPointCount,
    visiblePointCount: Math.min(normalized.visibleChartPointCount, normalized.chartPointCount),
  };
}

function toFiniteNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
