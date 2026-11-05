// Python's value semantics where a .uidp runtime shows them: ints and floats are distinct
// (25 shows as "25", 25.0 as "25.0"), numbers convert as int() / float() do, and decimals
// round half to even. Pure: no DOM.

/**
 * A float whose value is a whole number (25.0). Other floats are plain JS numbers that are
 * not integers (or NaN / Infinity), so they need no marker; plain integer numbers are ints.
 */
export class PyFloat {
  constructor(value) {
    this.value = Number(value);
  }

  valueOf() {
    return this.value;
  }

  toJSON() {
    return this.value;
  }
}

/** A float value: a PyFloat when it is whole, so it is not taken for an int. */
export function pyFloat(value) {
  const number = Number(value);
  return Number.isInteger(number) ? new PyFloat(number) : number;
}

export function isFloat(value) {
  return value instanceof PyFloat || (typeof value === "number" && !Number.isInteger(value));
}

export function isInt(value) {
  return typeof value === "number" && Number.isInteger(value);
}

export function isNumber(value) {
  return typeof value === "number" || value instanceof PyFloat;
}

/** The number a value holds (PyFloat unwrapped). */
export function numberOf(value) {
  return value instanceof PyFloat ? value.value : value;
}

// Python's str.isspace() characters, which str.strip() and str.split() use.
const PY_SPACE = "\t\n\v\f\r\x1c\x1d\x1e\x1f \x85\xa0                　";

export function isPySpace(char) {
  return PY_SPACE.includes(char);
}

export function pyStrip(text) {
  let start = 0;
  let end = text.length;
  while (start < end && isPySpace(text[start])) start += 1;
  while (end > start && isPySpace(text[end - 1])) end -= 1;
  return text.slice(start, end);
}

/** str.split() with no separator: runs of whitespace, no empty parts. */
export function pySplitWhitespace(text) {
  const parts = [];
  let current = "";
  for (const char of text) {
    if (isPySpace(char)) {
      if (current) parts.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  if (current) parts.push(current);
  return parts;
}

const INT_TEXT = /^[+-]?\d(?:_?\d)*$/;
const FLOAT_TEXT = /^[+-]?(?:(?:\d(?:_?\d)*)?\.\d(?:_?\d)*|\d(?:_?\d)*\.?)(?:[eE][+-]?\d(?:_?\d)*)?$/;
const FLOAT_WORDS = /^[+-]?(?:inf|infinity|nan)$/i;

/** int(text) for a str: the int, or null where Python raises ValueError. */
export function parsePyInt(text) {
  const stripped = pyStrip(String(text));
  if (!INT_TEXT.test(stripped)) return null;
  return Number(stripped.replaceAll("_", ""));
}

/** float(text) for a str: the number, or null where Python raises ValueError. */
export function parsePyFloat(text) {
  const stripped = pyStrip(String(text));
  if (FLOAT_WORDS.test(stripped)) {
    const negative = stripped.startsWith("-");
    if (/nan/i.test(stripped)) return NaN;
    return negative ? -Infinity : Infinity;
  }
  if (!FLOAT_TEXT.test(stripped)) return null;
  return Number(stripped.replaceAll("_", ""));
}

/** float(value): a number, or null where Python raises (text that is no number, None, containers). */
export function toReal(value) {
  if (typeof value === "boolean") return value ? 1 : 0;
  if (isNumber(value)) return numberOf(value);
  if (typeof value === "string") return parsePyFloat(value);
  return null;
}

/** int(value): truncates floats; null where Python raises (text that is no int, NaN, infinity). */
export function toInteger(value) {
  if (typeof value === "boolean") return value ? 1 : 0;
  if (isNumber(value)) {
    const number = numberOf(value);
    return Number.isFinite(number) ? Math.trunc(number) || 0 : null;
  }
  if (typeof value === "string") return parsePyInt(value);
  return null;
}

// -- exact decimal formatting --------------------------------------------------------------

const F64 = new Float64Array(1);
const U64 = new BigUint64Array(F64.buffer);

/** A finite double as sign, integer mantissa and binary exponent: |x| = mantissa × 2^exponent. */
function decompose(x) {
  F64[0] = x;
  const bits = U64[0];
  const negative = (bits >> 63n) === 1n;
  const biased = Number((bits >> 52n) & 0x7ffn);
  const fraction = bits & 0xfffffffffffffn;
  if (biased === 0) return { negative, mantissa: fraction, exponent: -1074 };
  return { negative, mantissa: fraction | (1n << 52n), exponent: biased - 1075 };
}

/** |x| × 10^places rounded half to even, as a BigInt: the digits Python's format shows. */
function scaledRound(x, places) {
  const { mantissa, exponent } = decompose(x);
  let numerator = mantissa * 10n ** BigInt(Math.max(0, places));
  let denominator = 10n ** BigInt(Math.max(0, -places));
  if (exponent >= 0) numerator <<= BigInt(exponent);
  else denominator <<= BigInt(-exponent);
  const quotient = numerator / denominator;
  const twice = (numerator % denominator) * 2n;
  if (twice > denominator || (twice === denominator && quotient % 2n === 1n)) return quotient + 1n;
  return quotient;
}

/** Python's f"{x:.{places}f}". */
export function formatFixed(x, places) {
  if (Number.isNaN(x)) return "nan";
  if (!Number.isFinite(x)) return x > 0 ? "inf" : "-inf";
  const negative = x < 0 || Object.is(x, -0);
  const digits = scaledRound(x, places).toString().padStart(places + 1, "0");
  const whole = places > 0 ? `${digits.slice(0, -places)}.${digits.slice(-places)}` : digits;
  return negative ? `-${whole}` : whole;
}

/** The shortest decimal digits and exponent that read back as x: x ≈ 0.d1d2… × 10^(exponent+1). */
function shortestDigits(x) {
  const text = Math.abs(x).toExponential();
  const [mantissa, exponent] = text.split("e");
  return { digits: mantissa.replace(".", ""), exponent: Number(exponent) };
}

/** Python's f"{x:.{precision}g}", rounding half to even on the exact value. */
export function formatG(x, precision = 6) {
  if (Number.isNaN(x)) return "nan";
  if (!Number.isFinite(x)) return x > 0 ? "inf" : "-inf";
  const p = Math.max(1, precision);
  const sign = x < 0 || Object.is(x, -0) ? "-" : "";
  if (x === 0) return `${sign}0`;
  let exponent = Math.floor(Math.log10(Math.abs(x)));
  let digits = scaledRound(x, p - 1 - exponent);
  if (digits >= 10n ** BigInt(p)) {
    exponent += 1;
    digits = scaledRound(x, p - 1 - exponent);
  } else if (digits < 10n ** BigInt(p - 1)) {
    exponent -= 1;
    digits = scaledRound(x, p - 1 - exponent);
  }
  const text = digits.toString();
  if (exponent < -4 || exponent >= p) {
    const mantissa = `${text[0]}.${text.slice(1)}`.replace(/\.?0+$/, "");
    return `${sign}${mantissa}e${exponent < 0 ? "-" : "+"}${String(Math.abs(exponent)).padStart(2, "0")}`;
  }
  let fixed;
  if (exponent >= 0) fixed = `${text.slice(0, exponent + 1)}.${text.slice(exponent + 1)}`;
  else fixed = `0.${"0".repeat(-exponent - 1)}${text}`;
  return sign + fixed.replace(/\.?0+$/, (match) => (match.startsWith(".") ? "" : "")).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
}

/** Python's repr() of a float. */
export function pyFloatRepr(x) {
  if (Number.isNaN(x)) return "nan";
  if (!Number.isFinite(x)) return x > 0 ? "inf" : "-inf";
  if (x === 0) return Object.is(x, -0) ? "-0.0" : "0.0";
  const sign = x < 0 ? "-" : "";
  const { digits, exponent } = shortestDigits(x);
  if (exponent >= -4 && exponent < 16) {
    if (exponent < 0) return `${sign}0.${"0".repeat(-exponent - 1)}${digits}`;
    const intPart = digits.length > exponent + 1 ? digits.slice(0, exponent + 1) : digits.padEnd(exponent + 1, "0");
    const fraction = digits.length > exponent + 1 ? digits.slice(exponent + 1) : "0";
    return `${sign}${intPart}.${fraction}`;
  }
  const mantissa = digits.length > 1 ? `${digits[0]}.${digits.slice(1)}` : digits;
  const expSign = exponent < 0 ? "-" : "+";
  return `${sign}${mantissa}e${expSign}${String(Math.abs(exponent)).padStart(2, "0")}`;
}

/** float(f"{x:.15g}"): the noise of binary arithmetic (267 * 0.1) rounded away, half to even. */
export function roundSignificant15(x) {
  if (!Number.isFinite(x) || x === 0) return x;
  const exponent = Math.floor(Math.log10(Math.abs(x)));
  for (const candidate of [exponent + 1, exponent, exponent - 1]) {
    const places = 14 - candidate;
    const digits = scaledRound(x, places);
    if (digits >= 10n ** 14n && digits < 10n ** 15n) {
      const text = `${digits}e${-places}`;
      return (x < 0 ? -1 : 1) * Number(text);
    }
  }
  return x;
}

/** str(value) as Python shows a value a binding produced (dicts and lists as compact JSON, as Studio does). */
export function displayString(value) {
  if (value === null || value === undefined) return "None";
  if (typeof value === "boolean") return value ? "True" : "False";
  if (value instanceof PyFloat) return pyFloatRepr(value.value);
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : pyFloatRepr(value);
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

/** A value with every PyFloat replaced by its number (for comparisons and JSON). */
export function plainValue(value) {
  if (value instanceof PyFloat) return value.value;
  if (Array.isArray(value)) return value.map(plainValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, plainValue(item)]));
  }
  return value;
}
