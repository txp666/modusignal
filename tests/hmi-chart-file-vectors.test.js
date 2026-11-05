import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ChartFileError, parseChartFile, saveChartFile } from "../src/hmi/chart-file.js";

const { save, load } = JSON.parse(readFileSync(new URL("./data/chart_file_vectors.json", import.meta.url), "utf8"));

for (const vector of save) {
  test(`chart file save: ${vector.title}`, () => {
    assert.equal(saveChartFile(vector.names, vector.values, "csv"), vector.csv);
    assert.equal(saveChartFile(vector.names, vector.values, "json"), vector.json);
  });
}

for (const vector of load) {
  test(`chart file load: ${vector.title}`, () => {
    if (vector.error) {
      assert.throws(() => parseChartFile(vector.text, vector.format), ChartFileError);
      return;
    }
    assert.deepStrictEqual(parseChartFile(vector.text, vector.format), { names: vector.names, values: vector.values });
  });
}
