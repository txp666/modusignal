import test from "node:test";
import assert from "node:assert/strict";
import { bytesToEscapedText, encodeEscapedText, isPrintableText, TextEscapeError } from "../src/utils/text-escapes.js";

const bytes = (...values) => Uint8Array.from(values);

test("escapes encode to the bytes they name and literals stay UTF-8", () => {
  assert.deepEqual(encodeEscapedText("AT\\r\\n"), bytes(0x41, 0x54, 0x0d, 0x0a));
  assert.deepEqual(encodeEscapedText("a\\tb\\\\c"), bytes(0x61, 0x09, 0x62, 0x5c, 0x63));
  // \xHH is a raw byte, not a UTF-8 encoded code point.
  assert.deepEqual(encodeEscapedText("\\x00\\xff\\xAb"), bytes(0x00, 0xff, 0xab));
  assert.deepEqual(encodeEscapedText("中\\x0D"), bytes(0xe4, 0xb8, 0xad, 0x0d));
  assert.deepEqual(encodeEscapedText("no escapes"), new TextEncoder().encode("no escapes"));
});

test("unknown, incomplete and malformed escapes are rejected with the offending sequence", () => {
  for (const [text, sequence, index] of [["A\\q", "\\q", 1], ["\\x4", "\\x4", 0], ["\\xZZ!", "\\xZZ", 0], ["end\\", "\\", 3]]) {
    assert.throws(() => encodeEscapedText(text), (error) => {
      assert.ok(error instanceof TextEscapeError);
      assert.equal(error.sequence, sequence);
      assert.equal(error.index, index);
      return true;
    });
  }
});

test("bytes display as text with control and invalid bytes escaped", () => {
  assert.equal(bytesToEscapedText(bytes(0x4f, 0x4b, 0x0d, 0x0a)), "OK\\r\\n");
  assert.equal(bytesToEscapedText(bytes(0x01, 0x7f, 0x5c, 0x09)), "\\x01\\x7F\\\\\\t");
  assert.equal(bytesToEscapedText(bytes(0xe4, 0xb8, 0xad, 0xf0, 0x9f, 0x98, 0x80)), "中😀");
  // Lone continuation, truncated sequence, overlong form and surrogate are not text.
  assert.equal(bytesToEscapedText(bytes(0x80, 0xe4, 0xb8)), "\\x80\\xE4\\xB8");
  assert.equal(bytesToEscapedText(bytes(0xc0, 0xaf, 0xed, 0xa0, 0x80)), "\\xC0\\xAF\\xED\\xA0\\x80");
});

test("display line breaks follow inner newlines only", () => {
  assert.equal(bytesToEscapedText(bytes(0x41, 0x0a, 0x42, 0x0a), { breakLines: true }), "A\\n\nB\\n");
  assert.equal(bytesToEscapedText(bytes(0x41, 0x0a, 0x42, 0x0a)), "A\\nB\\n");
});

test("escaped display round trips through the editor syntax", () => {
  const all = Uint8Array.from({ length: 256 }, (_, index) => index);
  assert.deepEqual(encodeEscapedText(bytesToEscapedText(all)), all);
  const utf8 = new TextEncoder().encode("温度=25.0℃\r\n");
  assert.deepEqual(encodeEscapedText(bytesToEscapedText(utf8)), utf8);
});

test("printable text detection tolerates a sequence split at the end of a chunk", () => {
  assert.equal(isPrintableText(new TextEncoder().encode("OK 中\r\n\t")), true);
  assert.equal(isPrintableText(bytes(0xe4, 0xb8)), true);
  assert.equal(isPrintableText(bytes(0x41, 0x00)), false);
  assert.equal(isPrintableText(bytes(0x01, 0x03, 0x04)), false);
  assert.equal(isPrintableText(bytes(0xe4, 0x41)), false);
  assert.equal(isPrintableText(bytes(0xff)), false);
  assert.equal(isPrintableText(bytes()), true);
});
