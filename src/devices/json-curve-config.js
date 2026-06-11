export const JSON_CURVE_SLOTS = [
  {
    key: "curve1",
    enabledKey: "curve1Enabled",
    fieldNameKey: "fieldName",
    unitKey: "unit",
    pathKey: "parserFieldPath",
    defaultName: "数值",
    color: "#0f766e",
  },
  {
    key: "curve2",
    enabledKey: "curve2Enabled",
    fieldNameKey: "curve2FieldName",
    unitKey: "curve2Unit",
    pathKey: "curve2FieldPath",
    defaultName: "曲线二",
    color: "#2563eb",
  },
  {
    key: "curve3",
    enabledKey: "curve3Enabled",
    fieldNameKey: "curve3FieldName",
    unitKey: "curve3Unit",
    pathKey: "curve3FieldPath",
    defaultName: "曲线三",
    color: "#ea580c",
  },
  {
    key: "curve4",
    enabledKey: "curve4Enabled",
    fieldNameKey: "curve4FieldName",
    unitKey: "curve4Unit",
    pathKey: "curve4FieldPath",
    defaultName: "曲线四",
    color: "#7c3aed",
  },
];

export const DEFAULT_JSON_CURVE_CONFIG = {
  curveSlotCount: 1,
  curve1Enabled: true,
  parserFieldPath: "value",
  curve2Enabled: false,
  curve2FieldName: "曲线二",
  curve2Unit: "",
  curve2FieldPath: "",
  curve3Enabled: false,
  curve3FieldName: "曲线三",
  curve3Unit: "",
  curve3FieldPath: "",
  curve4Enabled: false,
  curve4FieldName: "曲线四",
  curve4Unit: "",
  curve4FieldPath: "",
  fieldName: "数值",
  unit: "",
};

export function normalizeJsonCurveConfig(config = {}, defaults = DEFAULT_JSON_CURVE_CONFIG) {
  const merged = {
    ...defaults,
    ...config,
  };

  const normalized = {
    curveSlotCount: resolveCurveSlotCount(merged),
  };

  for (const slot of JSON_CURVE_SLOTS) {
    normalized[slot.enabledKey] = slot.key === "curve1" ? merged[slot.enabledKey] !== false : Boolean(merged[slot.enabledKey]);
    normalized[slot.fieldNameKey] = String(merged[slot.fieldNameKey] || slot.defaultName);
    normalized[slot.unitKey] = String(merged[slot.unitKey] ?? "");
    normalized[slot.pathKey] = String(merged[slot.pathKey] ?? "").trim();
  }

  return normalized;
}

export function listJsonChartSeries(config = {}, defaults = DEFAULT_JSON_CURVE_CONFIG) {
  const normalized = normalizeJsonCurveConfig(config, defaults);
  return buildCurveSeries(normalized).filter((series) => series.enabled && (series.path || series.key === "curve1"));
}

export function parseJsonCurveTelemetry(text, config, parseNumericTelemetry, defaults = DEFAULT_JSON_CURVE_CONFIG) {
  const normalized = normalizeJsonCurveConfig(config, defaults);
  const trimmed = String(text || "").trim();
  const series = listJsonChartSeries(normalized, defaults);
  const fallbackSeries = series[0] ?? null;

  if (!trimmed || !fallbackSeries) {
    return null;
  }

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      const variables = extractCurveVariables(parsed, series);
      const activeVariables = Object.values(variables);

      if (series.length > 1 && activeVariables.length > 0) {
        return {
          isMulti: true,
          variables,
        };
      }

      if (activeVariables.length === 1) {
        const entry = activeVariables[0];
        return {
          fieldName: entry.fieldName,
          unit: entry.unit,
          value: entry.value,
          rawValue: entry.rawValue,
        };
      }
    } catch {
      // Ignore invalid JSON and fall back to plain numeric parsing.
    }
  }

  const rawValue = parseNumericTelemetry(trimmed);
  if (!Number.isFinite(rawValue)) {
    return null;
  }

  if (series.length > 1) {
    return {
      isMulti: true,
      variables: {
        [fallbackSeries.key]: {
          fieldName: fallbackSeries.fieldName,
          unit: fallbackSeries.unit,
          value: rawValue,
          rawValue,
        },
      },
    };
  }

  return {
    fieldName: fallbackSeries.fieldName,
    unit: fallbackSeries.unit,
    value: rawValue,
    rawValue,
  };
}

export function describeJsonCurveSummary(config, defaults = DEFAULT_JSON_CURVE_CONFIG) {
  const normalized = normalizeJsonCurveConfig(config, defaults);
  const series = listJsonChartSeries(normalized, defaults);

  if (series.length > 1) {
    return `多曲线：${series.map((item) => item.fieldName).join(" / ")}`;
  }

  return series[0]?.path || "自动数字";
}

function buildCurveSeries(config) {
  return JSON_CURVE_SLOTS.map((slot) => ({
    key: slot.key,
    enabled: Boolean(config[slot.enabledKey]),
    fieldName: String(config[slot.fieldNameKey] || slot.defaultName),
    unit: String(config[slot.unitKey] ?? ""),
    path: String(config[slot.pathKey] ?? "").trim(),
    color: slot.color,
  }));
}

function extractCurveVariables(source, series) {
  const variables = {};

  for (const item of series) {
    const rawValue = item.path ? extractJsonValue(source, item.path) : findFirstNumber(source);
    if (!Number.isFinite(rawValue)) {
      continue;
    }

    variables[item.key] = {
      fieldName: item.fieldName,
      unit: item.unit,
      value: rawValue,
      rawValue,
    };
  }

  return variables;
}

function extractJsonValue(source, path) {
  if (!path) {
    return findFirstNumber(source);
  }

  let current = source;
  for (const segment of path.split(".")) {
    if (current == null || segment === "") {
      return null;
    }

    if (Array.isArray(current) && /^\d+$/.test(segment)) {
      current = current[Number(segment)];
      continue;
    }

    if (typeof current === "object") {
      current = current[segment];
      continue;
    }

    return null;
  }

  return toFiniteNumber(current, null);
}

function findFirstNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findFirstNumber(item);
      if (Number.isFinite(found)) {
        return found;
      }
    }
    return null;
  }

  if (value && typeof value === "object") {
    for (const key of Object.keys(value)) {
      const found = findFirstNumber(value[key]);
      if (Number.isFinite(found)) {
        return found;
      }
    }
  }

  return null;
}

export function removeJsonCurveSlot(config, slotNumber, defaults = DEFAULT_JSON_CURVE_CONFIG) {
  const normalized = normalizeJsonCurveConfig(config, defaults);
  const slotIndex = Math.trunc(Number(slotNumber)) - 1;

  if (slotIndex < 1 || slotIndex >= normalized.curveSlotCount) {
    return normalized;
  }

  const merged = {
    ...defaults,
    ...config,
    ...normalized,
  };

  for (let index = slotIndex; index < normalized.curveSlotCount - 1; index += 1) {
    const fromSlot = JSON_CURVE_SLOTS[index + 1];
    const toSlot = JSON_CURVE_SLOTS[index];
    merged[toSlot.enabledKey] = merged[fromSlot.enabledKey];
    merged[toSlot.fieldNameKey] = merged[fromSlot.fieldNameKey];
    merged[toSlot.unitKey] = merged[fromSlot.unitKey];
    merged[toSlot.pathKey] = merged[fromSlot.pathKey];
  }

  const clearSlot = JSON_CURVE_SLOTS[normalized.curveSlotCount - 1];
  applySlotDefaults(merged, clearSlot, defaults);
  merged.curveSlotCount = normalized.curveSlotCount - 1;

  return normalizeJsonCurveConfig(merged, defaults);
}

function applySlotDefaults(merged, slot, defaults) {
  if (slot.key === "curve1") {
    merged[slot.enabledKey] = true;
    return;
  }

  merged[slot.enabledKey] = false;
  merged[slot.fieldNameKey] = defaults[slot.fieldNameKey] ?? slot.defaultName;
  merged[slot.unitKey] = defaults[slot.unitKey] ?? "";
  merged[slot.pathKey] = defaults[slot.pathKey] ?? "";
}

function resolveCurveSlotCount(merged) {
  let count = Math.trunc(toFiniteNumber(merged.curveSlotCount, DEFAULT_JSON_CURVE_CONFIG.curveSlotCount));

  for (let index = 1; index < JSON_CURVE_SLOTS.length; index += 1) {
    const slot = JSON_CURVE_SLOTS[index];
    if (merged[slot.enabledKey] || String(merged[slot.pathKey] ?? "").trim()) {
      count = Math.max(count, index + 1);
    }
  }

  return clamp(count, 1, JSON_CURVE_SLOTS.length);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function toFiniteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}
