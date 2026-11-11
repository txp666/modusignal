import test from "node:test";
import assert from "node:assert/strict";
import { CURVE_FIELDS, CurveEntry, curveConfigs } from "../src/hmi/binding.js";
import { hexToBytes } from "../src/hmi/parsers.js";
import { createEmptyProject, parseProject, serializeProject, propDef } from "../src/hmi/uidp.js";

const sources = [
  ["key", { key: "temperature" }, (entry) => entry.onParsed({ temperature: 12 })],
  ["JSON", { parseMode: "JSON路径", jsonPath: "data.temperature" }, (entry) => entry.onParsed({ data: { temperature: 12 } })],
  ["Modbus", { parseMode: "Modbus", regIndex: 100 }, (entry) => entry.onParsed({ slave: 1, fc: 3, hr100: 12 })],
  ["HEX", { parseMode: "HEX字节提取", dataType: "uint16", frameHeader: "AA", frameTail: "FF" }, (entry) => {
    assert.deepEqual(entry.onRaw(hexToBytes("AA00")), []);
    return entry.onRaw(hexToBytes("0CFF"));
  }],
];

for (const [source, cfg, sample] of sources) {
  test(`chart ${source}: transform each sample once and preserve legacy/failure values`, () => {
    for (const [expression, expected] of [[undefined, 12], ["", 12], ["value * 2 + 1", 25], ["value / 0", 12], ["value +", 12], ["__import__('os')", 12]]) {
      const entry = new CurveEntry({ ...CURVE_FIELDS, ...cfg, expression });
      assert.deepEqual(sample(entry), [expected], expression);
    }
  });
}

test("chart expressions are independent, survive .uidp and mode/count changes, and default empty", () => {
  const project = createEmptyProject();
  const properties = { curveCount: 2, _curve_0_key: "temperature", _curve_0_expression: "value * 2", _curve_1_key: "temperature", _curve_1_expression: "value + 10" };
  project.widgets.push({ type: "RealtimeChart", id: "chart", properties });
  const restored = parseProject(serializeProject(project)).widgets.at(-1).properties;
  assert.deepEqual(restored, properties);
  assert.deepEqual(curveConfigs(restored).map((cfg) => new CurveEntry(cfg).onParsed({ temperature: 12 })), [[24], [22]]);
  restored.curveCount = 1;
  restored._curve_0_parseMode = "HEX字节提取";
  assert.equal(curveConfigs(restored)[0].expression, "value * 2");
  restored.curveCount = 2;
  assert.equal(curveConfigs(restored)[1].expression, "value + 10");
  assert.equal(curveConfigs({})[0].expression, "");
  assert.equal(propDef("RealtimeChart", "curveExpression").default, "");
});


test("chart numeric text is a float; integer samples keep bitwise operations; invalid text never creates a point", () => {
  const entry = (expression) => new CurveEntry({ ...CURVE_FIELDS, key: "v", expression });
  assert.deepEqual(entry("value * 0.1").onParsed({ v: "125" }), [12.5]);
  assert.deepEqual(entry("value & 1").onParsed({ v: 125 }), [1]);
  assert.deepEqual(entry("value & 1").onParsed({ v: "125" }), [125]);
  assert.deepEqual(entry("value / 0").onParsed({ v: "125" }), [125]);
  for (const v of ["", "text", "NaN", "Infinity", [], {}, null]) {
    assert.deepEqual(entry("42").onParsed({ v }), []);
  }
});
