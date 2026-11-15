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

test("Modbus button accepts a logical coil value and sends the FC05 wire value", () => {
  const props = { commandMode: "Modbus", mbFunc: "05 写单线圈" };
  const click = (settings) => sent(commandForEvent("PushButton", { ...props, ...settings }), "modbus");
  for (const settings of [{}, { mbValue: 1 }, { mbValue: "1" }, { mbValue: 65280 }]) {
    assert.equal(click(settings), "01050000ff008c3a");
  }
  assert.equal(click({ mbValue: 0 }), "010500000000cdca");
  assert.throws(() => click({ mbValue: 2 }), CommandError);
  assert.throws(() => click({ mbValue: 1.5 }), CommandError);
  assert.equal(click({ mbFunc: "01 读线圈", mbValue: 1 }), "010100000001fdca");
  assert.equal(click({ mbFunc: "06 写单寄存器", mbValue: 1 }), "010600000001480a");
});

test("Modbus switch writes coils by default and 0/1 to a selected holding register", () => {
  const props = { commandMode: "Modbus", mbSlave: 7, mbAddress: 42 };
  const flip = (settings, checked) => sent(commandForEvent("ToggleSwitch", { ...props, ...settings }, { checked }), "modbus");
  for (const settings of [{}, { mbArea: "线圈" }]) {
    assert.equal(flip(settings, true), "0705002aff00ad94");
    assert.equal(flip(settings, false), "0705002a0000ec64");
  }
  assert.equal(flip({ mbArea: "保持寄存器" }, true), "0706002a000169a4");
  assert.equal(flip({ mbArea: "保持寄存器" }, false), "0706002a0000a864");
});
