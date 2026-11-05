// Chart history files of a .uidp RealtimeChart, as PyQt UI Designer's chart_runtime.py
// (save_data / _read_history / _history_json_channels / _history_channel_order) and
// chart_history.py have them: CSV (a header row of curve names, then one row per sample, CRLF)
// or JSON (an object of name → samples, or an array of {name, values} when names repeat).
// Pure: no DOM.

import { jsonString } from "./commands.js";
import { formatG, parsePyFloat, pyFloatRepr } from "./py-values.js";

export const HISTORY_LIMIT = 10000;
export const MAX_CHANNELS = 8;

export class ChartFileError extends Error {
  constructor(code, message, args = []) {
    super(message);
    this.code = code;
    this.args = args;
  }
}

/** A curve's samples: the last `capacity` for the plot, and every sample for saving. */
export class ChartHistory {
  constructor(capacity = HISTORY_LIMIT) {
    this.capacity = capacity;
    this.all = [];
  }

  append(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) throw new ChartFileError("notFinite", "曲线样本必须是有限数");
    this.all.push(number);
  }

  get count() {
    return this.all.length;
  }

  /** The last `count` samples still held for display (at most `capacity`). */
  tail(count) {
    const held = Math.min(this.all.length, this.capacity);
    return this.all.slice(this.all.length - Math.min(held, Math.max(0, count)));
  }

  last() {
    return this.all.length ? this.all[this.all.length - 1] : null;
  }

  values() {
    return this.all;
  }

  clear() {
    this.all = [];
  }
}

// -- writing ------------------------------------------------------------------------------

/** One CSV field as Python's csv writer (QUOTE_MINIMAL) writes it. */
function csvField(text) {
  return /[",\r\n]/.test(text) ? `"${text.replaceAll("\"", "\"\"")}"` : text;
}

function csvRow(fields) {
  if (fields.length === 1 && fields[0] === "") return "\"\"\r\n";
  return `${fields.map(csvField).join(",")}\r\n`;
}

/** The text a chart saves for its curve names and every curve's samples, as CSV or JSON. */
export function saveChartFile(names, values, format) {
  if (format === "json") {
    const duplicates = new Set(names).size !== names.length;
    const channels = names.map((name, index) => {
      const samples = `[${(values[index] ?? []).map(pyFloatRepr).join(",")}]`;
      return duplicates ? `{"name":${jsonString(name)},"values":${samples}}` : `${jsonString(name)}:${samples}`;
    });
    return duplicates ? `[${channels.join(",")}]` : `{${channels.join(",")}}`;
  }
  let text = csvRow(names);
  const rows = Math.max(0, ...values.map((samples) => samples.length));
  for (let row = 0; row < rows; row += 1) {
    text += csvRow(values.map((samples) => (row < samples.length ? pyFloatRepr(samples[row]) : "")));
  }
  return text;
}

// -- reading ------------------------------------------------------------------------------

/** Rows of CSV text as Python's csv.reader (excel dialect) reads them. */
export function readCsvRows(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  let started = false;
  let i = 0;
  const endField = () => {
    row.push(field);
    field = "";
    started = false;
  };
  const endRow = () => {
    if (started || row.length) endField();
    rows.push(row);
    row = [];
  };
  while (i < text.length) {
    const c = text[i];
    if (quoted) {
      if (c === "\"") {
        if (text[i + 1] === "\"") {
          field += "\"";
          i += 2;
          continue;
        }
        quoted = false;
      } else {
        field += c;
      }
      i += 1;
      continue;
    }
    if (c === "\"" && !field) {
      quoted = true;
      started = true;
    } else if (c === ",") {
      endField();
      started = true;
    } else if (c === "\r" || c === "\n") {
      endRow();
      if (c === "\r" && text[i + 1] === "\n") i += 1;
    } else {
      field += c;
      started = true;
    }
    i += 1;
  }
  if (started || row.length || field) endRow();
  return rows;
}

// A JSON reader that keeps an object's pairs in order, duplicates included, as Python's
// object_pairs_hook does; NaN and Infinity are read as Python's json module reads them.
class Pairs extends Array {}

function parseJsonPairs(text) {
  let i = 0;
  const fail = () => {
    throw new ChartFileError("json", "JSON 格式错误");
  };
  const space = () => {
    while (i < text.length && " \t\n\r".includes(text[i])) i += 1;
  };
  const value = () => {
    space();
    const c = text[i];
    if (c === "{") {
      i += 1;
      const pairs = new Pairs();
      space();
      if (text[i] === "}") {
        i += 1;
        return pairs;
      }
      for (;;) {
        space();
        if (text[i] !== "\"") fail();
        const key = string();
        space();
        if (text[i] !== ":") fail();
        i += 1;
        pairs.push([key, value()]);
        space();
        if (text[i] === "}") {
          i += 1;
          return pairs;
        }
        if (text[i] !== ",") fail();
        i += 1;
      }
    }
    if (c === "[") {
      i += 1;
      const items = [];
      space();
      if (text[i] === "]") {
        i += 1;
        return items;
      }
      for (;;) {
        items.push(value());
        space();
        if (text[i] === "]") {
          i += 1;
          return items;
        }
        if (text[i] !== ",") fail();
        i += 1;
      }
    }
    if (c === "\"") return string();
    for (const [word, result] of [["true", true], ["false", false], ["null", null], ["NaN", NaN], ["Infinity", Infinity], ["-Infinity", -Infinity]]) {
      if (text.startsWith(word, i)) {
        i += word.length;
        return result;
      }
    }
    const match = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(text.slice(i));
    if (!match) fail();
    i += match[0].length;
    return Number(match[0]);
  };
  const string = () => {
    const match = /^"(?:[^"\\\u0000-\u001f]|\\(?:["\\/bfnrt]|u[0-9a-fA-F]{4}))*"/.exec(text.slice(i));
    if (!match) fail();
    i += match[0].length;
    return JSON.parse(match[0]);
  };
  const result = value();
  space();
  if (i !== text.length) fail();
  return result;
}

const isObject = (value) => value instanceof Pairs;

/** The channels of a JSON history: [[name, samples], …], or ChartFileError. */
function jsonChannels(document) {
  let channels;
  if (isObject(document)) {
    channels = [...document];
  } else if (Array.isArray(document)) {
    channels = document.map((entry) => {
      if (!isObject(entry)) throw new ChartFileError("jsonChannel", "曲线 JSON 通道必须包含 name 和 values");
      const fields = new Map(entry);
      if (fields.size !== 2 || !fields.has("name") || !fields.has("values")) {
        throw new ChartFileError("jsonChannel", "曲线 JSON 通道必须包含 name 和 values");
      }
      return [fields.get("name"), fields.get("values")];
    });
  } else {
    throw new ChartFileError("jsonRoot", "曲线 JSON 必须是对象或通道数组");
  }
  for (const [name, values] of channels) {
    if (typeof name !== "string" || !Array.isArray(values) || isObject(values)) {
      throw new ChartFileError("jsonTypes", "曲线 JSON 通道名称必须是文本，样本必须是数组");
    }
  }
  return channels;
}

/** Python's float() of a JSON sample. */
function sampleOf(value) {
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const number = parsePyFloat(value);
    if (number === null) throw new ChartFileError("notNumber", `could not convert string to float: '${value}'`, [value]);
    return number;
  }
  throw new ChartFileError("notNumber", "float() argument must be a string or a real number", [String(value)]);
}

/** Curve names and samples from a saved file's text ("csv" or "json"); ChartFileError when it is no history. */
export function parseChartFile(text, format) {
  const names = [];
  const values = [];
  const append = (history, value) => {
    if (!Number.isFinite(value)) throw new ChartFileError("notFinite", "曲线样本必须是有限数");
    history.push(value);
  };
  if (format === "json") {
    for (const [name, samples] of jsonChannels(parseJsonPairs(text))) {
      names.push(name);
      const history = [];
      values.push(history);
      for (const sample of samples) if (sample !== null) append(history, sampleOf(sample));
    }
    return { names, values };
  }
  const rows = readCsvRows(text);
  names.push(...(rows[0] ?? []));
  for (const _ of names) values.push([]);
  for (const row of rows.slice(1)) {
    values.forEach((history, index) => {
      if (index < row.length && row[index].trim()) {
        const number = parsePyFloat(row[index]);
        if (number === null) throw new ChartFileError("notNumber", `could not convert string to float: '${row[index]}'`, [row[index]]);
        append(history, number);
      }
    });
  }
  return { names, values };
}

/** "csv" or "json", by a file name's extension. */
export function chartFileFormat(fileName) {
  return /\.json$/i.test(fileName) ? "json" : "csv";
}

/**
 * Which file channel feeds each configured curve when a history replaces a chart's data: the same
 * list in order, or unique names reordered; an empty default chart adopts the file's. ChartFileError otherwise.
 */
export function historyChannelOrder(names, expected, adopt = false) {
  if (!names.length) throw new ChartFileError("noChannels", "曲线文件没有通道");
  if (names.length > MAX_CHANNELS) throw new ChartFileError("tooManyChannels", "曲线文件最多支持 8 个通道");
  if (adopt) return names.map((_, index) => index);
  if (names.length === expected.length && names.every((name, index) => name === expected[index])) return expected.map((_, index) => index);
  if (names.length === expected.length && new Set(names).size === names.length
    && expected.every((name) => names.includes(name)) && names.every((name) => expected.includes(name))) {
    return expected.map((name) => names.indexOf(name));
  }
  throw new ChartFileError("channelMismatch", "曲线文件通道名称或数量与当前配置不一致，请加载对应通道的历史文件");
}

/** A reading as the chart header shows it: Python's f"{value:.4g}". */
export function chartReading(value) {
  return formatG(value, 4);
}
