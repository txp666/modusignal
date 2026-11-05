import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CommandError, commandForEvent, modbusFrame } from "../src/hmi/commands.js";
import { bytesToHexLower } from "../src/hmi/parsers.js";

const { cases } = JSON.parse(readFileSync(new URL("./data/command_vectors.json", import.meta.url), "utf8"));

// The bytes a command puts on a link that parses `link` (TCP transactions count from 1).
function sent(command, link) {
  if (command === null) return null;
  if (command.kind === "modbus") return bytesToHexLower(modbusFrame(command.request, link, 1));
  return bytesToHexLower(command.bytes);
}

for (const vector of cases) {
  test(`command: ${vector.name}`, () => {
    const link = vector.link ?? "line";
    if (vector.error) {
      assert.throws(() => commandForEvent(vector.widget, vector.props, vector.event), CommandError);
      return;
    }
    assert.equal(sent(commandForEvent(vector.widget, vector.props, vector.event), link), vector.out);
  });
}
