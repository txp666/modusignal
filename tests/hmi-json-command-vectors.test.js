import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CommandError, jsonCommand } from "../src/hmi/commands.js";

const { cases } = JSON.parse(readFileSync(new URL("./data/json_command_vectors.json", import.meta.url), "utf8"));

for (const vector of cases) {
  test(`JSON command: ${vector.name}`, () => {
    if (vector.error) {
      assert.throws(() => jsonCommand(vector.props, vector.value), CommandError);
      return;
    }
    assert.equal(jsonCommand(vector.props, vector.value), vector.out);
  });
}
