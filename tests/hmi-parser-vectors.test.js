import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { bytesToHexLower, createParser, hexToBytes, ModbusRequests } from "../src/hmi/parsers.js";
import { plainValue } from "../src/hmi/py-values.js";

const cases = JSON.parse(readFileSync(new URL("./data/parser_vectors.json", import.meta.url), "utf8"));

const units = (parser, list) => list.map((unit) => ({ frame: bytesToHexLower(unit), messages: plainValue(parser.parse(unit)) }));

for (const vector of cases) {
  test(`parser: ${vector.name}`, () => {
    if (vector.error !== undefined) {
      assert.throws(() => createParser(vector.type, vector.config, new ModbusRequests()), (error) => error.message === vector.error);
      return;
    }
    const parser = createParser(vector.type, vector.config, new ModbusRequests());
    const got = vector.steps.map((step) => {
      if (step.note !== undefined) {
        parser.requests.noteFrame(hexToBytes(step.note), vector.type);
        return [];
      }
      if (step.flush) return units(parser, parser.flush());
      return units(parser, parser.frames(hexToBytes(step.feed)));
    });
    assert.deepStrictEqual(got, vector.expect);
  });
}
