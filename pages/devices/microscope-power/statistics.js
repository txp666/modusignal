// Raw ADC summaries stay independent of calibration. A segment tree over blocks
// makes a full history query logarithmic; only partial edge blocks read samples.
const RANGE_COUNT = 2;

function emptyRange() {
  return { count: 0, min: Infinity, max: -Infinity, sum: 0, sumSq: 0, centeredSumSq: 0 };
}

function addSample(target, code) {
  const delta = code - (target.count ? target.sum / target.count : 0);
  target.count += 1;
  target.min = Math.min(target.min, code);
  target.max = Math.max(target.max, code);
  target.sum += code;
  target.sumSq += code * code;
  target.centeredSumSq += delta * (code - target.sum / target.count);
}

export class SampleStatistics {
  constructor(codes, ranges, blockSize = 256) {
    if (!codes.length || codes.length !== ranges.length || !Number.isInteger(blockSize) || blockSize < 1) {
      throw new RangeError("Invalid sample buffers or statistics block size");
    }
    this.codes = codes;
    this.ranges = ranges;
    this.capacity = codes.length;
    this.blockSize = blockSize;
    this.blockCount = Math.ceil(this.capacity / blockSize);
    this.leafCount = 2 ** Math.ceil(Math.log2(this.blockCount));
    const size = this.leafCount * 2 * RANGE_COUNT;
    this.counts = new Uint32Array(size);
    // The raw ADC ring uses integers; a filtered ring keeps fractional codes.
    // Preserve those fractions in the index as well as in the sample buffer.
    const ExtremaArray = codes instanceof Uint16Array ? Uint16Array : Float64Array;
    this.mins = new ExtremaArray(size);
    this.maxs = new ExtremaArray(size);
    this.sums = new Float64Array(size);
    this.sumSquares = new Float64Array(size);
    this.centeredSquares = new Float64Array(size);
    this.reset();
  }

  reset(startSerial = 0) {
    if (!Number.isSafeInteger(startSerial) || startSerial < 0) {
      throw new RangeError("Invalid starting sample serial");
    }
    this.generation = (this.generation || 0) + 1;
    this.writeIndex = startSerial % this.capacity;
    this.available = 0;
    this.totalWritten = startSerial;
    // Count zero invalidates all stale aggregates without clearing the raw ring.
    this.counts.fill(0);
  }

  // Recalculate a retained frame when its measured sample period becomes
  // available. Serial addresses and the retained interval do not change.
  replace(startSerial, samples, rangeOhm) {
    if (!Number.isSafeInteger(startSerial) || startSerial < this.totalWritten - this.available ||
        startSerial + samples.length > this.totalWritten) {
      throw new RangeError("Replacement samples are outside retained history");
    }
    if (!samples.length) return;
    const firstIndex = startSerial % this.capacity;
    let physical = firstIndex;
    for (const code of samples) {
      this.codes[physical] = code;
      if (rangeOhm !== undefined) this.ranges[physical] = rangeOhm === 10 ? 10 : 1;
      physical = (physical + 1) % this.capacity;
    }
    const firstCount = Math.min(samples.length, this.capacity - firstIndex);
    this.rebuildBlocks(firstIndex, firstIndex + firstCount);
    if (firstCount < samples.length) this.rebuildBlocks(0, samples.length - firstCount);
    this.generation += 1;
  }

  append(samples, rangeOhm) {
    if (!samples.length) return;
    const firstIndex = this.writeIndex;
    const range = rangeOhm === 10 ? 10 : 1;
    for (const code of samples) {
      this.codes[this.writeIndex] = code;
      this.ranges[this.writeIndex] = range;
      this.writeIndex = (this.writeIndex + 1) % this.capacity;
    }
    this.available = Math.min(this.capacity, this.available + samples.length);
    this.totalWritten += samples.length;

    if (samples.length >= this.capacity) {
      this.rebuildBlocks(0, this.capacity);
    } else {
      const firstCount = Math.min(samples.length, this.capacity - firstIndex);
      this.rebuildBlocks(firstIndex, firstIndex + firstCount);
      if (firstCount < samples.length) this.rebuildBlocks(0, samples.length - firstCount);
    }
  }

  rebuildBlocks(start, end) {
    if (end <= start) return;
    for (let block = Math.floor(start / this.blockSize); block <= Math.floor((end - 1) / this.blockSize); block += 1) {
      let node = this.leafCount + block;
      const low = emptyRange();
      const high = emptyRange();
      const blockStart = block * this.blockSize;
      const blockStop = Math.min((block + 1) * this.blockSize, this.capacity);
      const oldestIndex = (this.totalWritten - this.available) % this.capacity;
      const validEnd = oldestIndex + this.available;
      const stop = Math.min(blockStop, validEnd);
      for (let i = Math.max(blockStart, oldestIndex); i < stop; i += 1) {
        addSample(this.ranges[i] === 10 ? high : low, this.codes[i]);
      }
      // A replay can begin anywhere in the physical ring, even before it is
      // full. Include only the two retained intervals, never stale slots.
      const wrappedStop = Math.min(blockStop, validEnd - this.capacity);
      for (let i = blockStart; i < wrappedStop; i += 1) {
        addSample(this.ranges[i] === 10 ? high : low, this.codes[i]);
      }
      this.setNode(node * RANGE_COUNT, low);
      this.setNode(node * RANGE_COUNT + 1, high);
      while (node > 1) {
        node = Math.floor(node / 2);
        for (let range = 0; range < RANGE_COUNT; range += 1) {
          const index = node * RANGE_COUNT + range;
          const left = node * 2 * RANGE_COUNT + range;
          const right = left + RANGE_COUNT;
          const leftCount = this.counts[left];
          const rightCount = this.counts[right];
          this.counts[index] = leftCount + rightCount;
          this.mins[index] = !leftCount ? this.mins[right] : !rightCount ? this.mins[left] : Math.min(this.mins[left], this.mins[right]);
          this.maxs[index] = !leftCount ? this.maxs[right] : !rightCount ? this.maxs[left] : Math.max(this.maxs[left], this.maxs[right]);
          this.sums[index] = (leftCount ? this.sums[left] : 0) + (rightCount ? this.sums[right] : 0);
          this.sumSquares[index] = (leftCount ? this.sumSquares[left] : 0) + (rightCount ? this.sumSquares[right] : 0);
          const delta = leftCount && rightCount ? this.sums[right] / rightCount - this.sums[left] / leftCount : 0;
          this.centeredSquares[index] = (leftCount ? this.centeredSquares[left] : 0)
            + (rightCount ? this.centeredSquares[right] : 0)
            + (leftCount && rightCount ? delta * delta * leftCount * rightCount / (leftCount + rightCount) : 0);
        }
      }
    }
  }

  setNode(index, values) {
    this.counts[index] = values.count;
    this.mins[index] = values.count ? values.min : 0;
    this.maxs[index] = values.count ? values.max : 0;
    this.sums[index] = values.sum;
    this.sumSquares[index] = values.sumSq;
    this.centeredSquares[index] = values.centeredSumSq;
  }

  addNode(result, node) {
    for (let range = 0; range < RANGE_COUNT; range += 1) {
      const index = node * RANGE_COUNT + range;
      if (!this.counts[index]) continue;
      const target = result[range];
      const delta = target.count ? this.sums[index] / this.counts[index] - target.sum / target.count : 0;
      target.centeredSumSq += this.centeredSquares[index]
        + delta * delta * target.count * this.counts[index] / (target.count + this.counts[index]);
      target.count += this.counts[index];
      target.min = Math.min(target.min, this.mins[index]);
      target.max = Math.max(target.max, this.maxs[index]);
      target.sum += this.sums[index];
      target.sumSq += this.sumSquares[index];
    }
  }

  queryPhysical(start, end, result) {
    let fullStart = Math.min(end, Math.ceil(start / this.blockSize) * this.blockSize);
    const fullEnd = Math.max(fullStart, Math.floor(end / this.blockSize) * this.blockSize);
    for (let i = start; i < fullStart; i += 1) addSample(result[this.ranges[i] === 10 ? 1 : 0], this.codes[i]);
    for (let i = fullEnd; i < end; i += 1) addSample(result[this.ranges[i] === 10 ? 1 : 0], this.codes[i]);
    let left = this.leafCount + Math.floor(fullStart / this.blockSize);
    let right = this.leafCount + Math.floor(fullEnd / this.blockSize);
    while (left < right) {
      if (left % 2) this.addNode(result, left++);
      if (right % 2) this.addNode(result, --right);
      left = Math.floor(left / 2);
      right = Math.floor(right / 2);
    }
  }

  // Serial addresses are monotonic and end-exclusive after start + count.
  // Requests are intersected with the retained ring, never silently shifted.
  queryRaw(startSerial, count) {
    const result = [emptyRange(), emptyRange()];
    if (!Number.isFinite(startSerial) || !Number.isFinite(count) || count <= 0) return result;
    const start = Math.max(this.totalWritten - this.available, Math.floor(startSerial));
    const end = Math.min(this.totalWritten, Math.floor(startSerial + count));
    if (end <= start) return result;
    const physicalStart = start % this.capacity;
    const firstCount = Math.min(end - start, this.capacity - physicalStart);
    this.queryPhysical(physicalStart, physicalStart + firstCount, result);
    if (firstCount < end - start) this.queryPhysical(0, end - start - firstCount, result);
    return result;
  }

  query(startSerial, count, conversion) {
    const ranges = this.queryRaw(startSerial, count);
    let sampleCount = 0;
    let min = Infinity;
    let max = -Infinity;
    let sum = 0;
    let sumSq = 0;
    let mean = 0;
    let centeredSumSq = 0;
    let minCode = Infinity;
    let maxCode = -Infinity;
    let sumCode = 0;
    for (let range = 0; range < RANGE_COUNT; range += 1) {
      const raw = ranges[range];
      if (!raw.count) continue;
      const { zero, scale } = conversion[range];
      const first = (raw.min - zero) * scale;
      const last = (raw.max - zero) * scale;
      min = Math.min(min, first, last);
      max = Math.max(max, first, last);
      sum += (raw.sum - zero * raw.count) * scale;
      // Zero calibration changes the mean, never the noise. Combine centered
      // moments from the tree; subtracting large raw squared sums loses small
      // ripple at full ring capacity, even before calibration is applied.
      const rangeMean = (raw.sum / raw.count - zero) * scale;
      const rangeCenteredSumSq = Math.max(0, raw.centeredSumSq) * scale * scale;
      sumSq += rangeCenteredSumSq + rangeMean * rangeMean * raw.count;
      const delta = rangeMean - mean;
      centeredSumSq += rangeCenteredSumSq + delta * delta * sampleCount * raw.count / (sampleCount + raw.count);
      mean += delta * raw.count / (sampleCount + raw.count);
      minCode = Math.min(minCode, raw.min);
      maxCode = Math.max(maxCode, raw.max);
      sumCode += raw.sum;
      sampleCount += raw.count;
    }
    const avg = sampleCount ? sum / sampleCount : 0;
    const lastSerial = Math.min(this.totalWritten, Math.floor(startSerial + count)) - 1;
    const lastIndex = lastSerial % this.capacity;
    const rangeOhm = sampleCount ? this.ranges[lastIndex] : 1;
    const lastCode = sampleCount ? this.codes[lastIndex] : 0;
    const lastConversion = conversion[rangeOhm === 10 ? 1 : 0];
    const pp = sampleCount ? max - min : 0;
    return {
      count: sampleCount,
      scannedCount: sampleCount,
      last: sampleCount ? (lastCode - lastConversion.zero) * lastConversion.scale : 0,
      avg,
      min: sampleCount ? min : 0,
      max: sampleCount ? max : 0,
      sum,
      sumSq,
      pp,
      // The UI's existing RMS measurement is AC RMS (standard deviation).
      rms: Math.sqrt(sampleCount ? centeredSumSq / sampleCount : 0),
      ppPercent: Math.abs(avg) > 1e-12 ? Math.abs(pp / avg) * 100 : 0,
      lastCode,
      avgCode: sampleCount ? sumCode / sampleCount : 0,
      minCode: sampleCount ? minCode : 0,
      maxCode: sampleCount ? maxCode : 0,
      ppCode: sampleCount ? maxCode - minCode : 0,
      rangeOhm,
    };
  }
}
