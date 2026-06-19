export const USB_CONFIG = Object.freeze({
  vendorId: 0xcafe,
  productId: 0x4011,
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
  fakeData: 1 << 0,
  adcData: 1 << 1,
  overflow: 1 << 2,
});

export const SAMPLE_RATES = Object.freeze([10000, 20000, 50000, 100000]);

export const DEFAULT_CALIBRATION = Object.freeze({
  zeroCode: 0,
  gainNaPerCode: 763,
});

const textDecoder = new TextDecoder("utf-8", { fatal: false });

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
    this.onFrame = onFrame;
    this.onText = onText;
  }

  reset() {
    this.buffer = new Uint8Array(0);
  }

  push(chunk) {
    this.buffer = concatBytes(this.buffer, chunk);

    while (this.buffer.length >= 2) {
      const magicIndex = findMagic(this.buffer);

      if (magicIndex < 0) {
        this.emitText(this.buffer);
        this.buffer = new Uint8Array(0);
        return;
      }

      if (magicIndex > 0) {
        this.emitText(this.buffer.slice(0, magicIndex));
        this.buffer = this.buffer.slice(magicIndex);
      }

      if (this.buffer.length < WAVE_FRAME.bytes) {
        return;
      }

      const frameBytes = this.buffer.slice(0, WAVE_FRAME.bytes);
      const view = new DataView(frameBytes.buffer, frameBytes.byteOffset, frameBytes.byteLength);
      const count = view.getUint16(WAVE_FRAME.offsets.count, true);

      if (count !== WAVE_FRAME.sampleCount) {
        this.buffer = this.buffer.slice(1);
        continue;
      }

      this.onFrame(this.parseFrame(frameBytes));
      this.buffer = this.buffer.slice(WAVE_FRAME.bytes);
    }
  }

  emitText(bytes) {
    if (!bytes.length || !this.onText) {
      return;
    }

    const text = textDecoder.decode(bytes).replace(/\0/g, "").trim();
    if (text) {
      this.onText(text);
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
