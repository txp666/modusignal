import assert from "node:assert/strict";
import test from "node:test";
import { FRAME_FLAGS, SAMPLE_RATES, WaveFrameParser, WAVE_FRAME } from "../../pages/devices/microscope-power/protocol.js";

const encode = (text) => new TextEncoder().encode(text);
const join = (...chunks) => {
  const joined = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0));
  let offset = 0;
  for (const chunk of chunks) { joined.set(chunk, offset); offset += chunk.length; }
  return joined;
};

function makeFrame(seq, sampleRate = 100000, flags = FRAME_FLAGS.adcData) {
  const bytes = new Uint8Array(WAVE_FRAME.bytes);
  const view = new DataView(bytes.buffer);
  view.setUint16(0, WAVE_FRAME.magic, true);
  view.setUint16(2, seq, true);
  view.setUint32(4, 0xffeeddcc, true);
  view.setUint32(8, sampleRate, true);
  view.setUint16(12, WAVE_FRAME.sampleCount, true);
  view.setUint16(14, flags, true);
  for (let i = 0; i < WAVE_FRAME.sampleCount; i++) view.setUint16(16 + i * 2, i * 251, true);
  view.setUint16(528, 0, true); // Existing firmware reserves the CRC field.
  return bytes;
}

function capture() {
  const frames = [];
  const lines = [];
  return { frames, lines, parser: new WaveFrameParser({ onFrame: (f) => frames.push(f), onText: (t) => lines.push(t) }) };
}

test("530-byte protocol survives every boundary in mixed text and binary transfers", () => {
  const stream = join(encode("OK\r\nSTATUS state=RUNNING srate=100000\n"), makeFrame(7),
    encode("OK PONG\n"), makeFrame(8, 10000, FRAME_FLAGS.streamStart | FRAME_FLAGS.gapBefore), encode("ERR BAD_RATE\n"));
  for (let split = 0; split <= stream.length; split++) {
    const { parser, frames, lines } = capture();
    parser.push(stream.subarray(0, split));
    parser.push(stream.subarray(split));
    assert.deepEqual(lines, ["OK", "STATUS state=RUNNING srate=100000", "OK PONG", "ERR BAD_RATE"], `split ${split}`);
    assert.deepEqual(frames.map((f) => f.seq), [7, 8], `split ${split}`);
    assert.equal(frames[0].samples[255], 255 * 251);
    assert.equal(frames[0].t0Us, 0xffeeddcc);
    assert.equal(frames[1].flags, FRAME_FLAGS.streamStart | FRAME_FLAGS.gapBefore);
    assert.equal(parser.buffer.length, 0);
  }
});

test("single-byte transfers retain magic and emit only completed lines", () => {
  const { parser, frames, lines } = capture();
  const stream = join(encode("ZERO\nSTATUS state=IDLE\n"), makeFrame(65535), encode("OK"));
  for (const byte of stream) parser.push(Uint8Array.of(byte));
  assert.deepEqual(lines, ["ZERO", "STATUS state=IDLE"]);
  assert.equal(frames[0].seq, 65535);
  parser.push(encode("\n"));
  assert.deepEqual(lines, ["ZERO", "STATUS state=IDLE", "OK"]);
});

test("rejects unsupported rates and wrong counts before resynchronizing", () => {
  for (const rate of SAMPLE_RATES) {
    const { parser, frames } = capture();
    const badCount = makeFrame(1);
    new DataView(badCount.buffer).setUint16(12, 255, true);
    parser.push(join(makeFrame(2, 12345), badCount, makeFrame(3, rate)));
    assert.deepEqual(frames.map((f) => f.seq), [3]);
    assert.equal(frames[0].sampleRate, rate);
  }
});

test("garbage and overlong text stay bounded and do not hide following frames or lines", () => {
  const { parser, frames, lines } = capture();
  parser.push(new Uint8Array(1_000_000).fill(65));
  assert.ok(parser.buffer.length <= 1);
  assert.ok(parser.textLine.length <= 1024);
  parser.push(join(encode("\nOK\n"), Uint8Array.of(0, 255, 90), makeFrame(4), encode("STATUS state=IDLE\n")));
  assert.deepEqual(lines, ["OK", "STATUS state=IDLE"]);
  assert.deepEqual(frames.map((f) => f.seq), [4]);
});

test("reset discards partial binary and text from an old connection", () => {
  const { parser, frames, lines } = capture();
  parser.push(join(encode("STATUS state="), makeFrame(1).subarray(0, 10)));
  parser.reset();
  parser.push(join(encode("OK\n"), makeFrame(2)));
  assert.deepEqual(lines, ["OK"]);
  assert.deepEqual(frames.map((f) => f.seq), [2]);
});
