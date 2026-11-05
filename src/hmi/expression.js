// The binding expression: Python's grammar and semantics for the subset uidp-format.md lists
// (numbers, value, True / False, parentheses, + - * / // % **, & | ^ ~ << >>, comparisons that
// chain, and / or / not). Evaluated by hand: no eval / new Function. Ints are 64-bit (as in
// FluentHMI Studio); an int that outgrows them is an error. Pure: no DOM.

import { PyFloat, isFloat, isNumber, numberOf, pyFloat } from "./py-values.js";

const INT_MIN = -(2n ** 63n);
const INT_MAX = 2n ** 63n - 1n;

// Kinds: int and bool hold a BigInt (bool 0n / 1n), float a number, other any other Python
// value (text, lists, objects), error an exception raised while evaluating.
const ERROR = Object.freeze({ kind: "error" });
const intValue = (n) => (n < INT_MIN || n > INT_MAX ? ERROR : { kind: "int", n });
const boolValue = (b) => ({ kind: "bool", n: b ? 1n : 0n });
const floatValue = (x) => ({ kind: "float", x });

const isInteger = (v) => v.kind === "int" || v.kind === "bool";
const isNumeric = (v) => isInteger(v) || v.kind === "float";
const toReal = (v) => (v.kind === "float" ? v.x : Number(v.n));

function truthy(v) {
  if (v.kind === "float") return v.x !== 0;
  if (isInteger(v)) return v.n !== 0n;
  const raw = v.raw;
  if (typeof raw === "string") return raw.length > 0;
  if (Array.isArray(raw)) return raw.length > 0;
  if (raw && typeof raw === "object") return Object.keys(raw).length > 0;
  return Boolean(raw);
}

// Python's divmod of two floats: the remainder takes the divisor's sign.
function floatDivMod(a, b) {
  let mod = a % b;
  let div = (a - mod) / b;
  if (mod !== 0) {
    if ((b < 0) !== (mod < 0)) {
      mod += b;
      div -= 1;
    }
  } else {
    mod = b < 0 ? -0 : 0;
  }
  let floorDiv;
  if (div !== 0) {
    floorDiv = Math.floor(div);
    if (div - floorDiv > 0.5) floorDiv += 1;
  } else {
    floorDiv = (a / b < 0 || Object.is(a / b, -0)) ? -0 : 0;
  }
  return [floorDiv, mod];
}

function floatPower(base, exponent) {
  if (base === 0 && exponent < 0 && Number.isFinite(exponent)) return ERROR;
  if (base < 0 && Number.isFinite(base) && Number.isFinite(exponent) && exponent !== Math.floor(exponent)) return ERROR;
  const result = base ** exponent;
  if (!Number.isFinite(result) && Number.isFinite(base) && Number.isFinite(exponent)) return ERROR;
  return floatValue(result);
}

function apply(op, a, b) {
  if (a.kind === "error" || b.kind === "error" || !isNumeric(a) || !isNumeric(b)) return ERROR;
  const integers = isInteger(a) && isInteger(b);
  const i = a.n;
  const j = b.n;
  const x = toReal(a);
  const y = toReal(b);
  switch (op) {
    case "+": return integers ? intValue(i + j) : floatValue(x + y);
    case "-": return integers ? intValue(i - j) : floatValue(x - y);
    case "*": return integers ? intValue(i * j) : floatValue(x * y);
    case "/": return y === 0 ? ERROR : floatValue(x / y);
    case "//": {
      if (integers) {
        if (j === 0n) return ERROR;
        const q = i / j;
        return intValue(i % j !== 0n && (i < 0n) !== (j < 0n) ? q - 1n : q);
      }
      return y === 0 ? ERROR : floatValue(floatDivMod(x, y)[0]);
    }
    case "%": {
      if (integers) {
        if (j === 0n) return ERROR;
        const r = i % j;
        return intValue(r !== 0n && (r < 0n) !== (j < 0n) ? r + j : r);
      }
      return y === 0 ? ERROR : floatValue(floatDivMod(x, y)[1]);
    }
    case "**":
      if (integers && j >= 0n) {
        if (j > 64n && i !== 0n && i !== 1n && i !== -1n) return ERROR;
        return intValue(i ** j);
      }
      return floatPower(x, y);
    case "&":
    case "|":
    case "^": {
      if (!integers) return ERROR;
      const bits = op === "&" ? i & j : op === "|" ? i | j : i ^ j;
      return a.kind === "bool" && b.kind === "bool" ? boolValue(bits !== 0n) : intValue(bits);
    }
    case "<<":
      if (!integers || j < 0n) return ERROR;
      if (i === 0n) return intValue(0n);
      if (j >= 64n) return ERROR;
      return intValue(i << j);
    case ">>":
      if (!integers || j < 0n) return ERROR;
      return intValue(j >= 63n ? (i < 0n ? -1n : 0n) : i >> j);
    default:
      return ERROR;
  }
}

// -1, 0 or 1 by Python's ordering of numbers; 2 when unordered (NaN); null when Python raises.
function compareNumbers(a, b) {
  if (isInteger(a) && isInteger(b)) return a.n > b.n ? 1 : a.n < b.n ? -1 : 0;
  const x = toReal(a);
  const y = toReal(b);
  if (Number.isNaN(x) || Number.isNaN(y)) return 2;
  // An int against a float compares exactly; the ints met here are well within a double for that.
  if (isInteger(a) && Number.isFinite(y) && Number.isInteger(y)) {
    const whole = BigInt(y);
    return a.n > whole ? 1 : a.n < whole ? -1 : 0;
  }
  if (isInteger(b) && Number.isFinite(x) && Number.isInteger(x)) {
    const whole = BigInt(x);
    return whole > b.n ? 1 : whole < b.n ? -1 : 0;
  }
  return x > y ? 1 : x < y ? -1 : 0;
}

function sameOther(a, b) {
  if (a.kind !== "other" || b.kind !== "other") return false;
  return JSON.stringify(a.raw) === JSON.stringify(b.raw);
}

/** The outcome of `a op b`: a bool Value, or ERROR where Python raises. */
function holds(op, a, b) {
  if (isNumeric(a) && isNumeric(b)) {
    const order = compareNumbers(a, b);
    switch (op) {
      case "!=": return order !== 0;
      case "==": return order === 0;
      case "<": return order === -1;
      case "<=": return order === -1 || order === 0;
      case ">": return order === 1;
      default: return order === 1 || order === 0;
    }
  }
  if (op === "==") return sameOther(a, b);
  if (op === "!=") return !sameOther(a, b);
  if (typeof a.raw === "string" && typeof b.raw === "string") {
    const order = a.raw > b.raw ? 1 : a.raw < b.raw ? -1 : 0;
    switch (op) {
      case "<": return order === -1;
      case "<=": return order <= 0;
      case ">": return order === 1;
      default: return order >= 0;
    }
  }
  return null;
}

const isNameChar = (c) => c !== undefined && /[\p{L}\p{N}_]/u.test(c);
const isDecimal = (c) => c !== undefined && c >= "0" && c <= "9";
const isBinary = (c) => c === "0" || c === "1";
const isOctal = (c) => c !== undefined && c >= "0" && c <= "7";
const isHex = (c) => c !== undefined && /[0-9a-fA-F]/.test(c);

class SyntaxFailure extends Error {}

class ExpressionParser {
  constructor(text, value) {
    this.text = text;
    this.value = value;
    this.pos = 0;
  }

  run() {
    const result = this.orExpr();
    this.skipSpace();
    if (this.pos !== this.text.length) throw new SyntaxFailure();
    return result;
  }

  at(pos) {
    return this.text[pos];
  }

  skipSpace() {
    while (this.pos < this.text.length && /\s/.test(this.text[this.pos])) this.pos += 1;
  }

  accept(token) {
    this.skipSpace();
    if (this.text.startsWith(token, this.pos)) {
      this.pos += token.length;
      return true;
    }
    return false;
  }

  acceptWord(word) {
    this.skipSpace();
    if (!this.text.startsWith(word, this.pos) || isNameChar(this.at(this.pos + word.length))) return false;
    this.pos += word.length;
    return true;
  }

  orExpr() {
    let left = this.andExpr();
    while (this.acceptWord("or")) {
      const right = this.andExpr();
      if (left.kind !== "error" && !truthy(left)) left = right;
    }
    return left;
  }

  andExpr() {
    let left = this.notExpr();
    while (this.acceptWord("and")) {
      const right = this.notExpr();
      if (left.kind !== "error" && truthy(left)) left = right;
    }
    return left;
  }

  notExpr() {
    if (this.acceptWord("not")) {
      const operand = this.notExpr();
      return operand.kind === "error" ? ERROR : boolValue(!truthy(operand));
    }
    return this.comparison();
  }

  comparison() {
    const left = this.bitOr();
    let previous = left;
    let decided = null;
    let compared = false;
    for (;;) {
      let op = null;
      for (const candidate of ["<=", ">=", "==", "!=", "<", ">"]) {
        if (this.accept(candidate)) {
          op = candidate;
          break;
        }
      }
      if (!op) break;
      const right = this.bitOr();
      compared = true;
      if (decided) continue;
      if (previous.kind === "error" || right.kind === "error") {
        decided = ERROR;
      } else {
        const outcome = holds(op, previous, right);
        if (outcome === null) decided = ERROR;
        else if (!outcome) decided = boolValue(false);
      }
      previous = right;
    }
    if (!compared) return left;
    return decided ?? boolValue(true);
  }

  binaryLevel(operand, tokens) {
    let left = operand();
    for (;;) {
      const match = tokens.find((token) => {
        // "*" must not take the first half of "**", nor "/" of "//", nor "<" of "<<" (handled by order).
        return this.accept(token);
      });
      if (!match) break;
      const right = operand();
      left = apply(match, left, right);
    }
    return left;
  }

  bitOr() { return this.binaryLevel(() => this.bitXor(), ["|"]); }
  bitXor() { return this.binaryLevel(() => this.bitAnd(), ["^"]); }
  bitAnd() { return this.binaryLevel(() => this.shift(), ["&"]); }
  shift() { return this.binaryLevel(() => this.sum(), ["<<", ">>"]); }
  sum() { return this.binaryLevel(() => this.product(), ["+", "-"]); }

  product() {
    let left = this.unary();
    for (;;) {
      this.skipSpace();
      let op = null;
      if (this.text.startsWith("**", this.pos)) break;
      for (const candidate of ["//", "*", "/", "%"]) {
        if (this.text.startsWith(candidate, this.pos)) {
          op = candidate;
          break;
        }
      }
      if (!op) break;
      this.pos += op.length;
      const right = this.unary();
      left = apply(op, left, right);
    }
    return left;
  }

  unary() {
    this.skipSpace();
    for (const sign of ["-", "+", "~"]) {
      if (!this.accept(sign)) continue;
      const v = this.unary();
      if (v.kind === "error" || !isNumeric(v)) return ERROR;
      if (sign === "~") return isInteger(v) ? intValue(~v.n) : ERROR;
      if (v.kind === "float") return floatValue(sign === "-" ? -v.x : v.x);
      if (sign === "+") return intValue(v.n);
      return intValue(-v.n);
    }
    return this.power();
  }

  power() {
    const base = this.atom();
    if (this.accept("**")) {
      const exponent = this.unary();
      return apply("**", base, exponent);
    }
    return base;
  }

  atom() {
    if (this.accept("(")) {
      const inner = this.orExpr();
      if (!this.accept(")")) throw new SyntaxFailure();
      return inner;
    }
    if (this.acceptWord("value")) return this.value;
    if (this.acceptWord("True")) return boolValue(true);
    if (this.acceptWord("False")) return boolValue(false);
    return this.number();
  }

  digits(isDigit) {
    const start = this.pos;
    let out = "";
    while (isDigit(this.at(this.pos))) {
      out += this.at(this.pos);
      this.pos += 1;
      if (this.at(this.pos) === "_" && isDigit(this.at(this.pos + 1))) this.pos += 1;
    }
    return this.pos > start ? out : null;
  }

  number() {
    this.skipSpace();
    const prefix = (this.at(this.pos + 1) ?? "").toLowerCase();
    if (this.at(this.pos) === "0" && (prefix === "x" || prefix === "o" || prefix === "b")) {
      this.pos += 2;
      const isDigit = prefix === "x" ? isHex : prefix === "o" ? isOctal : isBinary;
      if (this.at(this.pos) === "_" && isDigit(this.at(this.pos + 1))) this.pos += 1;
      const text = this.digits(isDigit);
      if (text === null || isNameChar(this.at(this.pos))) throw new SyntaxFailure();
      return intValue(BigInt(`0${prefix}${text}`));
    }
    let text = this.digits(isDecimal) ?? "";
    const whole = text.length > 0;
    let real = false;
    if (this.at(this.pos) === ".") {
      this.pos += 1;
      const fraction = this.digits(isDecimal);
      if (!whole && fraction === null) throw new SyntaxFailure();
      text += `.${fraction ?? ""}`;
      real = true;
    } else if (!whole) {
      throw new SyntaxFailure();
    }
    if (this.at(this.pos) === "e" || this.at(this.pos) === "E") {
      let probe = this.pos + 1;
      const signed = this.at(probe) === "+" || this.at(probe) === "-";
      if (signed) probe += 1;
      if (isDecimal(this.at(probe))) {
        text += `e${signed ? this.at(probe - 1) : ""}`;
        this.pos = probe;
        text += this.digits(isDecimal);
        real = true;
      }
    }
    if (this.at(this.pos) === "j" || this.at(this.pos) === "J") throw new SyntaxFailure();
    if (real) return floatValue(Number(text.startsWith(".") ? `0${text}` : text));
    if (text.length > 1 && text.startsWith("0") && /[1-9]/.test(text)) throw new SyntaxFailure();
    return intValue(BigInt(text));
  }
}

function bind(value) {
  if (typeof value === "boolean") return boolValue(value);
  if (isNumber(value)) {
    if (isFloat(value)) return floatValue(numberOf(value));
    return intValue(BigInt(value));
  }
  return { kind: "other", raw: value };
}

/**
 * `expression` evaluated with `value` bound: the result (int / float / bool / the value itself),
 * or undefined where Python's eval would raise (a syntax error, a division by zero, a bit
 * operation on a float, a non-finite float…), in which case a binding shows the raw value.
 */
export function evaluateExpression(expression, value) {
  let result;
  try {
    result = new ExpressionParser(String(expression), bind(value)).run();
  } catch (error) {
    if (error instanceof SyntaxFailure) return undefined;
    throw error;
  }
  switch (result.kind) {
    case "bool": return result.n !== 0n;
    case "int": return Number(result.n);
    case "float": return Number.isFinite(result.x) ? pyFloat(result.x) : undefined;
    case "other": return result.raw;
    default: return undefined;
  }
}

export { PyFloat };
