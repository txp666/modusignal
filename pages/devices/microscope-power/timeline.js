import { FRAME_FLAGS } from "./protocol.js?v=__ASSET_VERSION__";

// Frame metadata, rather than a timestamp per sample, keeps the 120 s history
// small while preserving actual gaps and the device's 32-bit timer rollover.
export class CaptureTimeline {
  constructor(sampleCapacity, frameSize = 256) {
    this.frameSize = frameSize;
    this.frames = new Array(Math.ceil(sampleCapacity / frameSize) + 2);
    this.reset();
  }

  reset() {
    this.frames.fill(undefined);
    this.previous = null;
    this.lastRawUs = null;
    this.elapsedUs = 0;
  }

  append(frame, startSerial, { legacyTimingOverruns = false } = {}) {
    if (frame.count !== this.frameSize || startSerial % this.frameSize !== 0) {
      throw new Error("采样时间轴的帧边界无效");
    }
    const rawUs = frame.t0Us >>> 0;
    let gap = Boolean(frame.flags & FRAME_FLAGS.gapBefore);
    let period = 1 / frame.sampleRate;
    if (this.lastRawUs !== null) {
      const deltaUs = (rawUs - this.lastRawUs) >>> 0;
      const expectedUs = this.previous.count * 1e6 / this.previous.rate;
      // A timestamp must not run backwards into the preceding sample block.
      if (deltaUs < expectedUs - 1e6 / this.previous.rate || deltaUs > 0x7fffffff) {
        throw new Error("设备采样时间戳不连续，请重新开始采集");
      }
      const hasSequence = Number.isInteger(frame.seq) && Number.isInteger(this.previous.seq);
      const sequenceGap = hasSequence && ((frame.seq - this.previous.seq) & 0xffff) !== 1;
      const rangeChanged = Boolean((frame.flags ^ this.previous.flags) & FRAME_FLAGS.range10Ohm);
      const timingOnly = Boolean((frame.flags | this.previous.flags) & FRAME_FLAGS.timingOverrun);
      // Earlier firmware also used GAP_BEFORE for scheduling overruns, even
      // though every ADC result was retained. Accept that legacy case only
      // with confirming diagnostics, adjacent sequences and an unchanged range.
      if (gap && legacyTimingOverruns && hasSequence && !sequenceGap && !rangeChanged &&
          !(frame.flags & FRAME_FLAGS.timingOverrun) &&
          deltaUs > expectedUs && deltaUs < 2 * expectedUs) {
        gap = false;
      }
      gap ||= sequenceGap || (!timingOnly && deltaUs >= 2 * expectedUs) ||
        (rangeChanged && deltaUs > expectedUs + Math.max(2, 1e6 / this.previous.rate));
      if (!gap) {
        // Only frame-start timestamps are available. Spread consecutive retained
        // samples over the measured interval instead of placing all timing
        // slippage in an artificial empty strip at the end of each frame.
        this.previous.period = deltaUs / (1e6 * this.previous.count);
        period = this.previous.period;
      }
      this.elapsedUs += deltaUs;
    }
    const entry = {
      startSerial, count: frame.count, rate: frame.sampleRate,
      seq: frame.seq, flags: frame.flags, period,
      time: this.elapsedUs / 1e6, gap,
    };
    this.frames[Math.floor(startSerial / this.frameSize) % this.frames.length] = entry;
    this.lastRawUs = rawUs;
    this.previous = entry;
  }

  frameAt(serial) {
    const first = Math.floor(serial / this.frameSize) * this.frameSize;
    const entry = this.frames[Math.floor(serial / this.frameSize) % this.frames.length];
    return entry?.startSerial === first ? entry : null;
  }

  timeAt(serial) {
    const entry = this.frameAt(serial);
    return entry ? entry.time + (serial - entry.startSerial) * entry.period : NaN;
  }

  timeAfter(serial) {
    const entry = this.frameAt(serial);
    return entry ? entry.time + (serial - entry.startSerial + 1) * entry.period : NaN;
  }

  // First sample on or after a time, within an end-exclusive serial interval.
  lowerBound(time, start, end) {
    let lo = start;
    let hi = end;
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2);
      // Sub-picosecond rounding must not move an exactly aligned sample into
      // the preceding pixel/window (device timestamps are integer microseconds).
      if (this.timeAt(mid) + 1e-12 < time) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  segments(start, count) {
    if (count <= 0) return [];
    const end = start + count;
    let segmentStart = start;
    const result = [];
    for (let serial = (Math.floor(start / this.frameSize) + 1) * this.frameSize;
      serial < end; serial += this.frameSize) {
      if (this.frameAt(serial)?.gap) {
        result.push({ startOffset: segmentStart - start, endOffset: serial - start });
        segmentStart = serial;
      }
    }
    result.push({ startOffset: segmentStart - start, endOffset: count });
    return result;
  }
}
