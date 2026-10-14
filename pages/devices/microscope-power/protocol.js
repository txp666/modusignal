export const USB_CONFIG = Object.freeze({
  vendorId: 0xcafe,
  productId: 0x4012,
  interfaceNumber: 0,
  endpointIn: 1,
  endpointOut: 1,
});

export const WAVE_FRAME = Object.freeze({
  magic: 0xa55a,
  magicLo: 0x5a,
  magicHi: 0xa5,
  bytes: 530,
  sampleCount: 256,
  offsets: Object.freeze({
    magic: 0,
    seq: 2,
    t0Us: 4,
    sampleRate: 8,
    count: 12,
    flags: 14,
    samples: 16,
    crc: 528,
  }),
});

export const FRAME_FLAGS = Object.freeze({
  adcData: 1 << 0,
  overflow: 1 << 1,
  range10Ohm: 1 << 2,
  autoRange: 1 << 3,
  streamStart: 1 << 4,
  gapBefore: 1 << 5,
  timingOverrun: 1 << 6,
});

export const SAMPLE_RATES = Object.freeze([10000, 20000, 50000, 100000]);

export const DEFAULT_CALIBRATION = Object.freeze({
  zeroLowCode: 0,
  zeroHighCode: 0,
  senseLowOhm: 1,
  senseHighOhm: 10,
});

const MAX_TEXT_LINE_BYTES = 1024;
const PARSER_CHUNK_BYTES = 4096;

function concatBytes(a, b) {
  if (!a.length) return b.slice();
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

function findMagic(bytes) {
  for (let i = 0; i <= bytes.length - 2; i += 1) {
    if (bytes[i] === WAVE_FRAME.magicLo && bytes[i + 1] === WAVE_FRAME.magicHi) {
      return i;
    }
  }
  return -1;
}

export class WaveFrameParser {
  constructor({ onFrame, onText }) {
    this.buffer = new Uint8Array(0);
    this.textLine = "";
    this.discardTextLine = false;
    this.onFrame = onFrame;
    this.onText = onText;
  }

  reset() {
    this.buffer = new Uint8Array(0);
    this.textLine = "";
    this.discardTextLine = false;
  }

  push(chunk) {
    // Bound retained garbage even when a caller hands us a very large transfer.
    for (let offset = 0; offset < chunk.length; offset += PARSER_CHUNK_BYTES) {
      this.buffer = concatBytes(this.buffer, chunk.subarray(offset, offset + PARSER_CHUNK_BYTES));
      this.drain();
    }
  }

  drain() {
    while (this.buffer.length) {
      const magicIndex = findMagic(this.buffer);

      if (magicIndex < 0) {
        // A trailing 0x5a may be the first byte of the next binary frame.
        const retained = this.buffer[this.buffer.length - 1] === WAVE_FRAME.magicLo ? 1 : 0;
        this.emitText(this.buffer.subarray(0, this.buffer.length - retained));
        this.buffer = this.buffer.slice(this.buffer.length - retained);
        return;
      }

      if (magicIndex > 0) {
        this.emitText(this.buffer.slice(0, magicIndex));
        this.buffer = this.buffer.slice(magicIndex);
      }

      if (this.buffer.length < WAVE_FRAME.offsets.samples) {
        return;
      }

      const view = new DataView(this.buffer.buffer, this.buffer.byteOffset, this.buffer.byteLength);
      const count = view.getUint16(WAVE_FRAME.offsets.count, true);
      const sampleRate = view.getUint32(WAVE_FRAME.offsets.sampleRate, true);

      if (count !== WAVE_FRAME.sampleCount || !SAMPLE_RATES.includes(sampleRate)) {
        this.buffer = this.buffer.slice(1);
        continue;
      }

      if (this.buffer.length < WAVE_FRAME.bytes) {
        return;
      }

      const frameBytes = this.buffer.subarray(0, WAVE_FRAME.bytes);
      this.buffer = this.buffer.slice(WAVE_FRAME.bytes);
      // A complete frame is also a clean boundary after malformed input.
      this.textLine = "";
      this.discardTextLine = false;
      this.onFrame?.(this.parseFrame(frameBytes));
    }
  }

  emitText(bytes) {
    if (!bytes.length || !this.onText) {
      return;
    }

    // The command protocol is ASCII, and USB transfers are not line boundaries.
    for (const byte of bytes) {
      if (byte === 10) {
        const line = this.discardTextLine ? "" : this.textLine.trim();
        this.textLine = "";
        this.discardTextLine = false;
        if (line) this.onText(line);
      } else if (byte === 13) {
        continue;
      } else if (byte < 32 || byte > 126 || this.textLine.length >= MAX_TEXT_LINE_BYTES) {
        this.textLine = "";
        this.discardTextLine = true;
      } else if (!this.discardTextLine) {
        this.textLine += String.fromCharCode(byte);
      }
    }
  }

  parseFrame(bytes) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const samples = new Uint16Array(WAVE_FRAME.sampleCount);

    for (let i = 0; i < WAVE_FRAME.sampleCount; i += 1) {
      samples[i] = view.getUint16(WAVE_FRAME.offsets.samples + i * 2, true);
    }

    return {
      magic: view.getUint16(WAVE_FRAME.offsets.magic, true),
      seq: view.getUint16(WAVE_FRAME.offsets.seq, true),
      t0Us: view.getUint32(WAVE_FRAME.offsets.t0Us, true),
      sampleRate: view.getUint32(WAVE_FRAME.offsets.sampleRate, true),
      count: view.getUint16(WAVE_FRAME.offsets.count, true),
      flags: view.getUint16(WAVE_FRAME.offsets.flags, true),
      samples,
      crc: view.getUint16(WAVE_FRAME.offsets.crc, true),
    };
  }
}

export function commandLine(text) {
  return `${text.trim()}\n`;
}
