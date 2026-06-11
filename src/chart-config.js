export const CHART_MIN_POINTS = 10;
export const CHART_MAX_POINTS = 200000;
export const CHART_MAX_VISIBLE_POINTS = 5000;
export const CHART_DEFAULT_POINTS = 3000;
export const CHART_DEFAULT_VISIBLE_POINTS = 240;

export const DEFAULT_CHART_CONFIG = {
  chartPointCount: CHART_DEFAULT_POINTS,
  visibleChartPointCount: CHART_DEFAULT_VISIBLE_POINTS,
};

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
