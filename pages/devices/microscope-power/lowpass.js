import { SampleStatistics } from "./statistics.js?v=__ASSET_VERSION__";
import { FRAME_FLAGS } from "./protocol.js?v=__ASSET_VERSION__";

// One real pole, y[n] = y[n-1] + alpha * (x[n] - y[n-1]). This coefficient
// places the digital response at -3 dB at cutoffHz; the usual RC approximation
// becomes inaccurate when the requested cutoff approaches Nyquist.
export function lowPassAlpha(cutoffHz, period) {
  if (!Number.isFinite(cutoffHz) || cutoffHz <= 0 || !Number.isFinite(period) || period <= 0) {
    throw new RangeError("Invalid low-pass cutoff or sample period");
  }
  const frequency = Math.min(cutoffHz * period, 0.45);
  const k = 2 * Math.sin(Math.PI * frequency) ** 2;
  return Math.sqrt(k * (k + 2)) - k;
}

function samplePeriod(frame) {
  if (Number.isFinite(frame.period) && frame.period > 0) return frame.period;
  if (Number.isFinite(frame.rate) && frame.rate > 0) return 1 / frame.rate;
  throw new Error("采样时间轴缺少有效采样周期");
}

function initialState() {
  return { value: NaN, range: null, rate: null, nextSerial: null };
}

// Filter once over the retained capture, before choosing a view or applying
// calibration. Panning, zooming and calibration cannot restart the pole or
// change a historical sample. Raw samples and export remain independent.
export class LowPassMeasurements {
  constructor(rawStatistics, timeline) {
    this.rawStatistics = rawStatistics;
    this.timeline = timeline;
    this.statistics = null;
    this.scratch = new Float64Array(timeline.frameSize);
    this.generation = 0;
    this.revision = 0;
    this.reset();
  }

  reset() {
    // Keep the optional large allocation for reuse, without allocating when
    // the low-pass display has never been enabled.
    this.statistics?.reset();
    this.rawGeneration = null;
    this.processedSerial = null;
    this.requestedCutoffHz = null;
    this.effectiveCutoffHz = null;
    this.samplePeriod = null;
    this.firstSeedSerial = null;
    this.state = initialState();
    this.lastFrame = null;
    this.generation += 1;
    this.revision = this.generation;
  }

  ensureStatistics() {
    if (!this.statistics) {
      this.statistics = new SampleStatistics(
        new Float64Array(this.rawStatistics.capacity), this.rawStatistics.ranges,
        this.rawStatistics.blockSize,
      );
    }
  }

  samplePeriodAt(serial) {
    const frame = this.timeline.frameAt(serial);
    if (!frame) throw new Error("低通滤波缺少保留数据的时间戳");
    const period = samplePeriod(frame);
    if (serial !== frame.startSerial || serial === this.firstSeedSerial || frame.gap) return period;
    const previous = this.timeline.frameAt(serial - 1);
    // A fresh segment is seeded, so no pole step crosses a gap, range or rate
    // boundary. Within a contiguous capture, the interval into the first point
    // belongs to the preceding frame; later points use this frame's period.
    if (!previous || frame.rate !== previous.rate ||
        ((frame.flags ^ previous.flags) & FRAME_FLAGS.range10Ohm)) return period;
    const boundaryPeriod = this.timeline.timeAt(serial) - this.timeline.timeAt(serial - 1);
    return Number.isFinite(boundaryPeriod) && boundaryPeriod > 0 ? boundaryPeriod : period;
  }

  processFrame(frame, start, end, replace = false) {
    const period = samplePeriod(frame);
    const alpha = lowPassAlpha(this.requestedCutoffHz, period);
    const range = this.rawStatistics.ranges[start % this.rawStatistics.capacity] === 10 ? 10 : 1;
    const before = { ...this.state };
    const reset = !Number.isFinite(this.state.value) || this.state.nextSerial !== start ||
      frame.gap || range !== this.state.range || frame.rate !== this.state.rate;
    const firstPeriod = reset ? period : this.samplePeriodAt(start);
    const firstAlpha = firstPeriod === period ? alpha : lowPassAlpha(this.requestedCutoffHz, firstPeriod);
    let value = this.state.value;
    const count = end - start;
    for (let offset = 0; offset < count; offset += 1) {
      const code = this.rawStatistics.codes[(start + offset) % this.rawStatistics.capacity];
      // Seed from the first available sample, rather than an invented zero.
      value = offset === 0 && reset ? code : value + (offset === 0 ? firstAlpha : alpha) * (code - value);
      this.scratch[offset] = value;
    }
    const output = this.scratch.subarray(0, count);
    if (replace) this.statistics.replace(start, output, range);
    else this.statistics.append(output, range);
    this.state = { value, range, rate: frame.rate, nextSerial: end };
    this.processedSerial = end;
    this.effectiveCutoffHz = Math.min(this.requestedCutoffHz, 0.45 / period);
    this.samplePeriod = period;
    this.lastFrame = {
      start, end, frameStart: frame.startSerial, period, firstPeriod, rate: frame.rate,
      gap: frame.gap, before,
    };
  }

  sync(cutoffHz) {
    if (!Number.isFinite(cutoffHz) || cutoffHz <= 0) {
      throw new RangeError("Invalid low-pass cutoff");
    }
    this.ensureStatistics();
    const raw = this.rawStatistics;
    const oldest = raw.totalWritten - raw.available;
    let replay = this.requestedCutoffHz !== cutoffHz || this.rawGeneration !== raw.generation ||
      this.processedSerial === null || this.processedSerial < oldest || this.processedSerial > raw.totalWritten;
    const tentative = this.lastFrame && this.timeline.frameAt(this.lastFrame.start);
    if (this.lastFrame && (!tentative || this.lastFrame.start < oldest)) replay = true;
    const periodChanged = !replay && tentative &&
      (samplePeriod(tentative) !== this.lastFrame.period || tentative.rate !== this.lastFrame.rate ||
        tentative.gap !== this.lastFrame.gap || this.samplePeriodAt(this.lastFrame.start) !== this.lastFrame.firstPeriod);
    const appended = this.processedSerial !== raw.totalWritten;
    if (!replay && !periodChanged && !appended) return this;

    this.requestedCutoffHz = cutoffHz;
    this.rawGeneration = raw.generation;
    if (replay) {
      this.statistics.reset(oldest);
      this.processedSerial = oldest;
      this.state = initialState();
      this.lastFrame = null;
      this.effectiveCutoffHz = null;
      this.samplePeriod = null;
      this.firstSeedSerial = oldest;
    } else if (periodChanged) {
      // CaptureTimeline learns a frame's actual period from the next frame's
      // timestamp. Restore the state before that tentative frame, rewrite only
      // that frame, then continue the pole into any newly arrived frames.
      const previous = this.lastFrame;
      this.state = { ...previous.before };
      this.processFrame(tentative, previous.start, previous.end, true);
    }

    while (this.processedSerial < raw.totalWritten) {
      const start = this.processedSerial;
      const frame = this.timeline.frameAt(start);
      if (!frame) throw new Error("低通滤波缺少保留数据的时间戳");
      const end = Math.min(raw.totalWritten, frame.startSerial + frame.count);
      if (end <= start || end - start > this.scratch.length) {
        throw new Error("低通滤波采样帧边界无效");
      }
      this.processFrame(frame, start, end);
    }
    this.generation += 1;
    this.revision = this.generation;
    return this;
  }

  segments(start, count) {
    if (count <= 0) return [];
    const end = start + count;
    const breaks = new Set(this.timeline.segments(start, count).slice(1).map((s) => start + s.startOffset));
    const frameSize = this.timeline.frameSize;
    for (let serial = (Math.floor(start / frameSize) + 1) * frameSize; serial < end; serial += frameSize) {
      const current = this.timeline.frameAt(serial);
      const previous = this.timeline.frameAt(serial - 1);
      const ranges = this.rawStatistics.ranges;
      const capacity = this.rawStatistics.capacity;
      if (ranges[serial % capacity] !== ranges[(serial - 1) % capacity] ||
          current?.rate !== previous?.rate) breaks.add(serial);
    }
    let segmentStart = start;
    const result = [];
    for (const serial of [...breaks].sort((a, b) => a - b)) {
      result.push({ startOffset: segmentStart - start, endOffset: serial - start });
      segmentStart = serial;
    }
    result.push({ startOffset: segmentStart - start, endOffset: count });
    return result;
  }
}
