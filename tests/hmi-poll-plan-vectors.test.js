import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { planBlocks } from "../src/hmi/modbus-poll.js";

const cases = JSON.parse(readFileSync(new URL("./data/poll_plan_vectors.json", import.meta.url), "utf8"));

for (const vector of cases) {
  test(`poll plan: ${vector.name}`, () => {
    assert.deepStrictEqual(planBlocks(vector.needs, vector.defaultPeriod), vector.blocks);
  });
}
