import i18n from "../i18n.js";

export const CHART_CSV_FORMAT = "modusignal-chart-csv/v1";

export function getLastFiniteValue(values = []) {
  for (let index = values.length - 1; index >= 0; index -= 1) {
    const value = Number(values[index]);
    if (Number.isFinite(value)) return value;
  }
  return null;
}

export function getFiniteSeriesExtent(seriesGroups = []) {
  let min = Infinity;
  let max = -Infinity;
  let hasValue = false;
  seriesGroups.forEach((series) => {
    (series ?? []).forEach((value) => {
      const number = Number(value);
      if (!Number.isFinite(number)) return;
      hasValue = true;
      if (number < min) min = number;
      if (number > max) max = number;
    });
  });
  return hasValue ? { min, max } : null;
}

function escapeCsvCell(value) {
  const text = value == null ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function buildChartCsvText(context, deviceId) {
  const pointCount = Math.max(0, ...context.series.map((series) => series.values.length));
  const metadata = {
    format: CHART_CSV_FORMAT,
    deviceId,
    chartKind: context.kind,
    title: context.title,
    exportedAt: new Date().toISOString(),
    series: context.series.map(({ key, name, unit }) => ({ key, name, unit })),
  };
  const lines = [
    `# ${CHART_CSV_FORMAT}`,
    `# ${JSON.stringify(metadata)}`,
    ["index", ...context.series.map((series) => series.key)].map(escapeCsvCell).join(","),
  ];

  for (let rowIndex = 0; rowIndex < pointCount; rowIndex += 1) {
    lines.push([
      rowIndex + 1,
      ...context.series.map((series) => Number.isFinite(series.values[rowIndex]) ? series.values[rowIndex] : ""),
    ].map(escapeCsvCell).join(","));
  }
  return { text: lines.join("\n"), pointCount };
}

export function buildChartCsvFilename(deviceId) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const safeDeviceId = String(deviceId || "chart").replace(/[^a-z0-9_-]/gi, "-");
  return `modusignal-${safeDeviceId}-${stamp}.csv`;
}

export function triggerChartCsvDownload(filename, text) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let inQuotes = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (character === "," && !inQuotes) {
      values.push(current);
      current = "";
    } else {
      current += character;
    }
  }
  values.push(current);
  return values;
}

export function parseChartCsvText(text) {
  const normalized = String(text || "").replace(/^\uFEFF/, "");
  const rows = [];
  let metadata = null;
  normalized.split(/\r?\n/).forEach((rawLine) => {
    const line = rawLine.trimEnd();
    if (!line.trim()) return;
    if (line.startsWith("#")) {
      const comment = line.slice(1).trim();
      if (comment.startsWith("{")) {
        try {
          metadata = JSON.parse(comment);
        } catch {
          // Ignore non-JSON metadata comments.
        }
      }
      return;
    }
    rows.push(parseCsvLine(line));
  });

  if (!rows.length || rows[0].length < 2) throw new Error(i18n("chart.csvNeedCols"));
  const seriesKeys = rows[0].slice(1).map((key, index) => String(key || `series${index + 1}`).trim());
  const seriesData = Object.fromEntries(seriesKeys.map((key) => [key, []]));
  rows.slice(1).forEach((row) => {
    if (row.every((cell) => !String(cell || "").trim())) return;
    seriesKeys.forEach((key, index) => {
      const cell = String(row[index + 1] ?? "").trim();
      const value = cell === "" ? null : Number(cell);
      seriesData[key].push(Number.isFinite(value) ? value : null);
    });
  });
  return {
    metadata,
    seriesKeys,
    seriesData,
    pointCount: Math.max(0, ...Object.values(seriesData).map((values) => values.length)),
  };
}

export function resolveImportedSeriesKey(parsed, targetSeries, fallbackIndex) {
  if (parsed.seriesData[targetSeries.key]) return targetSeries.key;
  const metadataSeries = parsed.metadata?.series?.find(
    (series) => series?.key === targetSeries.key || series?.name === targetSeries.name,
  );
  if (metadataSeries?.key && parsed.seriesData[metadataSeries.key]) return metadataSeries.key;
  const byName = parsed.seriesKeys.find((key) => key === targetSeries.name);
  if (byName && parsed.seriesData[byName]) return byName;
  return parsed.seriesKeys[fallbackIndex] ?? null;
}

export function formatImportedSingleReadout(series, values, pointCount) {
  const lastValue = getLastFiniteValue(values);
  if (!Number.isFinite(lastValue)) return `${i18n("chart.csvLoaded")} ${pointCount} ${i18n("num.points", "points")}`;
  return `${series.name} ${lastValue.toFixed(3)}${series.unit ? ` ${series.unit}` : ""} · ${i18n("num.totalPointsPrefix")} ${pointCount} ${i18n("num.points", "points")}`;
}

export function formatImportedDualReadout(values, unit, pointCount) {
  const lastValue = getLastFiniteValue(values);
  if (!Number.isFinite(lastValue)) return `${i18n("chart.csvLoaded")} ${pointCount} ${i18n("num.points", "points")}`;
  return i18n("chart.latest")
    .replace("{value}", `${lastValue.toFixed(3)}${unit ? ` ${unit}` : ""}`)
    .replace("{points}", pointCount);
}

export function formatImportedMultiReadout(seriesDefs, seriesData, pointCount) {
  const summary = seriesDefs.map((series) => {
    const lastValue = getLastFiniteValue(seriesData[series.key] ?? []);
    return Number.isFinite(lastValue)
      ? `${series.name} ${lastValue.toFixed(3)}${series.unit ? ` ${series.unit}` : ""}`
      : null;
  }).filter(Boolean).join(" · ");
  return summary || `${i18n("chart.csvLoaded")} ${pointCount} ${i18n("num.points")}`;
}
