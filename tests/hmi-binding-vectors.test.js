import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BindingEntry } from "../src/hmi/binding.js";
import { hexToBytes } from "../src/hmi/parsers.js";
import { PyFloat, plainValue } from "../src/hmi/py-values.js";

// JSON keeps 1.0 apart from 1 only in its text: read the vectors as Python does.
const parse = (text) => JSON.parse(text, (key, value, context) => (
  typeof value === "number" && Number.isInteger(value) && /[.eE]/.test(context?.source ?? "") ? new PyFloat(value) : value));
const { cases } = parse(readFileSync(new URL("./data/binding_vectors.json", import.meta.url), "utf8"));

for (const vector of cases) {
  test(`binding: ${vector.name}`, () => {
    const entry = BindingEntry.fromWidget({ id: "w", ...vector.widget });
    assert.ok(entry, "the binding is configured");
    const got = [];
    for (const input of vector.input) {
      got.push(...(input.raw !== undefined ? entry.onRaw(hexToBytes(input.raw)) : entry.onParsed(input.data)));
    }
    assert.deepStrictEqual(plainValue(got), plainValue(vector.expect));
  });
}

test("switch receive-state rules support nonzero, a custom value and zero as ON", () => {
  for (const props of [{}, { onCondition: "等于指定值", onValue: "5" }, { onCondition: "等于指定值", onValue: "0" }]) {
    const entry = BindingEntry.fromWidget({ id: "switch", type: "ToggleSwitch", properties: props, binding: { key: "state" } });
    for (const state of [0, 1, 5, -1]) {
      const expected = props.onCondition ? state === Number(props.onValue) : state !== 0;
      assert.deepEqual(entry.onParsed({ state }), [expected]);
    }
    assert.deepEqual(entry.onParsed({ state: "invalid" }), []);
  }
});
