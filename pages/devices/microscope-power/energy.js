// Rectangular integration of received, calibrated raw ADC samples. Only the
// final frame remains pending because CaptureTimeline revises its period when
// the next frame arrives. No sample ring or visible-window state is retained.

function finite(value, name) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new RangeError(`Invalid ${name}`);
  }
  return value;
}

function periodFor(entry) {
  const period = finite(entry.period, "sample period");
  if (period <= 0) throw new RangeError("Invalid sample period");
  return period;
}

// Neumaier compensation also preserves small signed contributions when large
// positive and negative charge totals cancel. Copies keep validation atomic.
function add(total, value) {
  finite(value, "integral contribution");
  const sum = total.sum + value;
  const correction = Math.abs(total.sum) >= Math.abs(value)
    ? (total.sum - sum) + value : (value - sum) + total.sum;
  const compensation = total.compensation + correction;
  finite(sum, "integral total");
  finite(compensation, "integral compensation");
  finite(sum + compensation, "integral total");
  return { sum, compensation };
}

function value(total) {
  return total.sum + total.compensation;
}

function readFrame(samples, conversion, entry, voltageV) {
  if (!Array.isArray(samples) && !(ArrayBuffer.isView(samples) && !(samples instanceof DataView))) {
    throw new TypeError("Invalid ADC samples");
  }
  if (!entry || typeof entry !== "object" || !conversion || typeof conversion !== "object") {
    throw new TypeError("Invalid capture frame or conversion");
  }
  const count = entry.count;
  if (!Number.isSafeInteger(count) || count <= 0 || samples.length !== count) {
    throw new RangeError("Invalid capture frame sample count");
  }
  const time = finite(entry.time, "capture frame time");
  if (time < 0 || typeof entry.gap !== "boolean") {
    throw new RangeError("Invalid capture frame time or gap");
  }
  const period = periodFor(entry);
  const zero = finite(conversion.zero, "zero calibration");
  const scale = finite(conversion.scale, "current conversion scale");
  let currentTotal = { sum: 0, compensation: 0 };
  let lastCurrent;
  for (const code of samples) {
    if (!Number.isInteger(code) || code < 0 || code > 65535) {
      throw new RangeError("Invalid ADC sample");
    }
    lastCurrent = finite((code - zero) * scale, "calibrated current");
    currentTotal = add(currentTotal, lastCurrent);
  }
  const sumCurrent = value(currentTotal);
  finite(count * period, "capture frame duration");
  finite(sumCurrent * period, "capture frame charge");
  const voltage = typeof voltageV === "number" && Number.isFinite(voltageV) && voltageV >= 0
    ? voltageV : null;
  if (voltage !== null) {
    finite(sumCurrent * period * 1e-6 * voltage, "capture frame energy");
    finite(lastCurrent * 1e-6 * voltage, "capture frame power");
  }
  return { entry, time, count, sumCurrent, lastCurrent, gap: entry.gap, voltage };
}

function contribution(frame) {
  const period = periodFor(frame.entry);
  const charge = finite(frame.sumCurrent * period, "capture frame charge");
  return {
    duration: finite(frame.count * period, "capture frame duration"),
    charge,
    energy: frame.voltage === null ? null : finite(charge * 1e-6 * frame.voltage, "capture frame energy"),
  };
}

function integrate(totals, frame, part) {
  const next = {
    duration: add(totals.duration, part.duration),
    charge: add(totals.charge, part.charge),
    energy: totals.energy,
    energyDuration: totals.energyDuration,
    voltageMissingDuration: totals.voltageMissingDuration,
  };
  if (frame.voltage === null) {
    next.voltageMissingDuration = add(next.voltageMissingDuration, part.duration);
  } else {
    next.energy = add(next.energy, part.energy);
    next.energyDuration = add(next.energyDuration, part.duration);
  }
  return next;
}

export class EnergyStatistics {
  constructor() {
    this.reset();
  }

  reset() {
    this.count = 0;
    this.totals = {
      duration: { sum: 0, compensation: 0 },
      charge: { sum: 0, compensation: 0 },
      energy: { sum: 0, compensation: 0 },
      energyDuration: { sum: 0, compensation: 0 },
      voltageMissingDuration: { sum: 0, compensation: 0 },
    };
    this.voltageMissingCount = 0;
    this.missing = { sum: 0, compensation: 0 };
    this.gapCount = 0;
    this.pending = null;
    return this;
  }

  append(samples, conversion, timelineEntry, voltageV = null) {
    // Finish every validation before committing the preceding pending frame.
    const frame = readFrame(samples, conversion, timelineEntry, voltageV);
    if (this.pending && (timelineEntry === this.pending.entry || frame.time <= this.pending.time)) {
      throw new RangeError("Capture frame time must increase; reset for a new capture");
    }
    const count = this.count + frame.count;
    if (!Number.isSafeInteger(count)) throw new RangeError("Invalid accumulated sample count");
    let totals = this.totals;
    let missing = this.missing;
    let gapCount = this.gapCount;
    if (this.pending) {
      const previous = contribution(this.pending);
      totals = integrate(totals, this.pending, previous);
      if (frame.gap) {
        // Missing time is reported, not filled with invented current samples.
        const interval = Math.max(0, frame.time - (this.pending.time + previous.duration));
        missing = add(missing, interval);
        gapCount += 1;
      }
    }
    // Include the new estimate in overflow checks without storing it twice.
    const tail = contribution(frame);
    integrate(totals, frame, tail);
    this.count = count;
    this.totals = totals;
    this.voltageMissingCount += frame.voltage === null ? frame.count : 0;
    this.missing = missing;
    this.gapCount = gapCount;
    this.pending = frame;
    return this;
  }

  snapshot(_voltageV) {
    // The optional argument remains accepted for callers migrating from a
    // fixed-voltage UI. Historical energy only uses each frame's captured V.
    let totals = this.totals;
    if (this.pending) {
      const tail = contribution(this.pending);
      totals = integrate(totals, this.pending, tail);
    }
    const durationSeconds = value(totals.duration);
    const chargeMicroampSeconds = value(totals.charge);
    const energyDurationSeconds = value(totals.energyDuration);
    const energyJoules = energyDurationSeconds > 0 ? value(totals.energy) : null;
    const lastWatts = this.pending && this.pending.voltage !== null
      ? this.pending.voltage === 0 ? 0 : this.pending.lastCurrent * 1e-6 * this.pending.voltage : null;
    return {
      count: this.count,
      durationSeconds,
      chargeMicroampSeconds,
      energyJoules,
      averageWatts: energyDurationSeconds > 0 ? energyJoules / energyDurationSeconds : null,
      lastWatts,
      energyDurationSeconds,
      voltageMissingSeconds: value(totals.voltageMissingDuration),
      voltageMissingCount: this.voltageMissingCount,
      estimatedTail: this.pending !== null,
      gapCount: this.gapCount,
      missingSeconds: value(this.missing),
    };
  }
}
