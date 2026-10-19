// Every sample contributes to a pixel bucket. The indexed source answers large
// buckets without scanning their entire contents or missing narrow transients.
export function aggregateVisibleBuckets(source, columns) {
  const buckets = [];
  const samplesPerColumn = source.visibleSamples / columns;
  for (let x = 0; x < columns && source.visibleSamples > 0; x += 1) {
    const start = Math.floor(x * samplesPerColumn);
    const end = Math.min(source.visibleSamples, Math.max(start + 1, Math.floor((x + 1) * samplesPerColumn)));
    if (source.readVisibleAggregate) {
      buckets.push(source.readVisibleAggregate(start, end));
      continue;
    }
    let min = Infinity;
    let max = -Infinity;
    let sum = 0;
    for (let i = start; i < end; i += 1) {
      const sample = source.readVisibleSample(i);
      min = Math.min(min, sample);
      max = Math.max(max, sample);
      sum += sample;
    }
    buckets.push({ min, max, sum, count: end - start });
  }
  return buckets;
}

export function aggregateTimeBuckets(source, columns) {
  if (!source.timeSegments) {
    return aggregateVisibleBuckets(source, columns).map((bucket, x) => ({ ...bucket, x, segment: 0 }));
  }
  const buckets = [];
  const span = Math.max(1e-9, source.timeEnd - source.timeStart);
  source.timeSegments.forEach(({ startOffset, endOffset }, segment) => {
    const firstX = Math.max(0, Math.floor((source.readVisibleTime(startOffset) - source.timeStart) / span * columns + 1e-9));
    const lastX = Math.min(columns - 1, Math.floor((source.readVisibleTime(endOffset - 1) - source.timeStart) / span * columns + 1e-9));
    for (let x = firstX; x <= lastX; x += 1) {
      const start = Math.max(startOffset, source.timeToOffset(source.timeStart + x / columns * span));
      const end = Math.min(endOffset, source.timeToOffset(source.timeStart + (x + 1) / columns * span));
      if (end <= start) continue;
      const values = source.readVisibleAggregate(start, end);
      buckets.push({ ...values, x, segment });
    }
  });
  return buckets;
}

export class WavePlot {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false });
    this.width = 0;
    this.height = 0;
    this.dpr = 1;
    this.metrics = null;
    this.selectionBox = null;
    this.resize();
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.dpr = window.devicePixelRatio || 1;
    const nextWidth = Math.max(320, Math.floor(rect.width * this.dpr));
    const nextHeight = Math.max(240, Math.floor(rect.height * this.dpr));

    if (nextWidth !== this.width || nextHeight !== this.height) {
      this.width = nextWidth;
      this.height = nextHeight;
      this.canvas.width = nextWidth;
      this.canvas.height = nextHeight;
    }
  }

  draw(source) {
    this.resize();
    this.darkTheme = this.canvas.ownerDocument?.documentElement.dataset.theme === "dark";

    const ctx = this.ctx;
    const width = this.width;
    const height = this.height;
    const padLeft = Math.round(92 * this.dpr);
    const padRight = Math.round(82 * this.dpr);
    const padTop = Math.round(18 * this.dpr);
    const padBottom = Math.round(36 * this.dpr);
    const plotWidth = Math.max(1, width - padLeft - padRight);
    const plotHeight = Math.max(1, height - padTop - padBottom);

    this.metrics = {
      padLeft,
      padRight,
      padTop,
      padBottom,
      plotWidth,
      plotHeight,
      dpr: this.dpr,
      visibleSamples: source.visibleSamples,
      yMin: source.yRange.min,
      yMax: source.yRange.max,
      source,
    };

    ctx.fillStyle = this.darkTheme ? "#151d27" : "#f6f7f9";
    ctx.fillRect(0, 0, width, height);

    if (source.showGrid) {
      this.drawGrid(ctx, padLeft, padTop, plotWidth, plotHeight);
    }

    if (source.visibleSamples <= 0) {
      this.drawEmpty(ctx, width, height);
      this.drawAxes(ctx, padLeft, padTop, plotWidth, plotHeight, source);
      return;
    }

    this.drawWaveform(ctx, padLeft, padTop, plotWidth, plotHeight, source);
    this.drawCursors(ctx, padLeft, padTop, plotWidth, plotHeight, source);
    this.drawSelectionBox(ctx, padLeft, padTop, plotWidth, plotHeight);
    this.drawAxes(ctx, padLeft, padTop, plotWidth, plotHeight, source);
  }

  setSelectionBox(box) {
    this.selectionBox = box ? { ...box } : null;
  }

  drawSelectionBox(ctx, x, y, width, height) {
    if (!this.selectionBox) return;
    const { x1, y1, x2, y2 } = this.selectionBox;
    const left = x + Math.min(x1, x2) * width;
    const top = y + Math.min(y1, y2) * height;
    const boxWidth = Math.abs(x2 - x1) * width;
    const boxHeight = Math.abs(y2 - y1) * height;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, width, height);
    ctx.clip();
    ctx.fillStyle = "rgba(37, 99, 235, 0.16)";
    ctx.fillRect(left, top, boxWidth, boxHeight);
    ctx.strokeStyle = "#2563eb";
    ctx.lineWidth = Math.max(1, this.dpr);
    ctx.setLineDash([4 * this.dpr, 3 * this.dpr]);
    ctx.strokeRect(left, top, boxWidth, boxHeight);
    ctx.restore();
  }

  drawWaveform(ctx, x0, y0, width, height, source) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, y0, width, height);
    ctx.clip();

    const columns = Math.max(1, Math.floor(width));
    const cacheKey = source.dataKey === undefined ? null : `${source.dataKey}:${columns}`;
    if (cacheKey === null || this.bucketCache?.key !== cacheKey) {
      this.bucketCache = { key: cacheKey, buckets: aggregateTimeBuckets(source, columns) };
    }
    const pointSegments = [];

    if (source.showEnvelope) {
      ctx.strokeStyle = "rgba(29, 78, 216, 0.18)";
      ctx.lineWidth = Math.max(1, this.dpr);
    }

    for (const { x, segment, min, max, sum, count } of this.bucketCache.buckets) {
      const px = x0 + x + 0.5;
      if (source.showEnvelope && count > 0) {
        const yMin = this.valueToY(min, y0, height, source.yRange);
        const yMax = this.valueToY(max, y0, height, source.yRange);
        ctx.beginPath();
        ctx.moveTo(px, yMin);
        ctx.lineTo(px, yMax);
        ctx.stroke();
      }

      if (count > 0) {
        (pointSegments[segment] ||= []).push({
          x: px,
          y: this.valueToY(sum / count, y0, height, source.yRange),
        });
      }
    }

    for (const points of pointSegments) {
      if (!points?.length) continue;
      const displayPoints = source.smoothDisplay ? this.smoothPoints(points, 3) : points;
      ctx.strokeStyle = "#1d4ed8";
      ctx.lineWidth = Math.max(1.4, 1.4 * this.dpr);
      ctx.beginPath();
      ctx.moveTo(displayPoints[0].x, displayPoints[0].y);
      for (let i = 1; i < displayPoints.length; i += 1) {
        ctx.lineTo(displayPoints[i].x, displayPoints[i].y);
      }
      ctx.stroke();
    }

    ctx.restore();
  }

  smoothPoints(points, radius) {
    if (points.length <= 2 || radius <= 0) {
      return points;
    }

    return points.map((point, index) => {
      const start = Math.max(0, index - radius);
      const end = Math.min(points.length - 1, index + radius);
      let sum = 0;
      let count = 0;
      for (let i = start; i <= end; i += 1) {
        sum += points[i].y;
        count += 1;
      }
      return { x: point.x, y: sum / count };
    });
  }

  drawGrid(ctx, x, y, width, height) {
    ctx.strokeStyle = this.darkTheme ? "#344252" : "#d7dde4";
    ctx.lineWidth = 1;

    for (let i = 0; i <= 4; i += 1) {
      const gy = y + (height * i) / 4;
      ctx.beginPath();
      ctx.moveTo(x, gy + 0.5);
      ctx.lineTo(x + width, gy + 0.5);
      ctx.stroke();
    }

    for (let i = 0; i <= 10; i += 1) {
      const gx = x + (width * i) / 10;
      ctx.beginPath();
      ctx.moveTo(gx + 0.5, y);
      ctx.lineTo(gx + 0.5, y + height);
      ctx.stroke();
    }
  }

  drawAxes(ctx, x, y, width, height, source) {
    const fontSize = 12 * this.dpr;
    ctx.fillStyle = this.darkTheme ? "#bac6d2" : "#40505e";
    ctx.font = `${fontSize}px system-ui, sans-serif`;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";

    const yMin = source.yRange.min;
    const yMax = source.yRange.max;
    const yMid = (yMin + yMax) / 2;
    ctx.fillText(this.formatMicroamps(yMax), x - 8 * this.dpr, y);
    ctx.fillText(this.formatMicroamps(yMid), x - 8 * this.dpr, y + height / 2);
    ctx.fillText(this.formatMicroamps(yMin), x - 8 * this.dpr, y + height);

    ctx.textAlign = "left";
    ctx.fillText(this.formatMilliamps(yMax), x + width + 8 * this.dpr, y);
    ctx.fillText(this.formatMilliamps(yMid), x + width + 8 * this.dpr, y + height / 2);
    ctx.fillText(this.formatMilliamps(yMin), x + width + 8 * this.dpr, y + height);

    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    const seconds = source.timeEnd !== undefined ? source.timeEnd - source.timeStart : source.visibleSamples / Math.max(1, source.sampleRate);
    const offset = source.offsetSeconds ?? source.viewOffsetSamples / Math.max(1, source.sampleRate);
    const label = source.viewOffsetSamples > 0
      ? `${this.formatSeconds(seconds)}，距最新 ${this.formatSeconds(offset)}`
      : `${this.formatSeconds(seconds)}，最新`;
    ctx.fillText(label, x + width / 2, y + height + 10 * this.dpr);
  }

  drawCursors(ctx, x, y, width, height, source) {
    if (!source.cursorEnabled) {
      return;
    }

    const drawOne = (cursor, color, label) => {
      if (!cursor || cursor.sampleOffset === null) {
        return;
      }

      const ratio = source.readVisibleTime
        ? (source.readVisibleTime(cursor.sampleOffset) - source.timeStart) / Math.max(1e-9, source.timeEnd - source.timeStart)
        : cursor.sampleOffset / Math.max(1, source.visibleSamples - 1);
      const px = x + ratio * width;
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(1, this.dpr);
      ctx.beginPath();
      ctx.moveTo(px + 0.5, y);
      ctx.lineTo(px + 0.5, y + height);
      ctx.stroke();

      ctx.fillStyle = color;
      ctx.font = `${12 * this.dpr}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(label, px, y + 4 * this.dpr);
    };

    drawOne(source.cursors.a, "#dc2626", "A");
    drawOne(source.cursors.b, "#059669", "B");
  }

  drawEmpty(ctx, width, height) {
    ctx.fillStyle = this.darkTheme ? "#9aa9b8" : "#596674";
    ctx.font = `${14 * this.dpr}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("等待采样数据", width / 2, height / 2);
  }

  valueToY(value, y, height, yRange) {
    const min = yRange.min;
    const max = yRange.max > min ? yRange.max : min + 1e-9;
    const normalized = (Math.max(min, Math.min(max, value)) - min) / (max - min);
    return y + height - normalized * height;
  }

  formatMicroamps(value) {
    if (Math.abs(value) >= 10000) {
      return `${Math.round(value)} µA`;
    }
    if (Math.abs(value) >= 1000) {
      return `${value.toFixed(1)} µA`;
    }
    if (Math.abs(value) >= 10) {
      return `${value.toFixed(1)} µA`;
    }
    return `${value.toFixed(3)} µA`;
  }

  formatMilliamps(value) {
    const ma = value / 1000;
    if (Math.abs(ma) >= 10) {
      return `${ma.toFixed(2)} mA`;
    }
    if (Math.abs(ma) >= 1) {
      return `${ma.toFixed(3)} mA`;
    }
    return `${ma.toFixed(4)} mA`;
  }

  formatSeconds(seconds) {
    if (seconds < 0.001) {
      return `${(seconds * 1000000).toFixed(1)} us`;
    }
    if (seconds < 1) {
      return `${(seconds * 1000).toFixed(3)} ms`;
    }
    return `${seconds.toFixed(3)} s`;
  }

  clientXToSampleOffset(clientX) {
    if (!this.metrics || this.metrics.visibleSamples <= 0) {
      return null;
    }

    const ratio = this.clientXToPlotRatio(clientX);
    if (ratio === null) {
      return null;
    }
    const source = this.metrics.source;
    if (source?.timeToOffset) {
      return Math.min(source.visibleSamples - 1, source.timeToOffset(source.timeStart + ratio * (source.timeEnd - source.timeStart)));
    }
    return Math.round(ratio * Math.max(0, this.metrics.visibleSamples - 1));
  }

  clientXToPlotRatio(clientX) {
    const geometry = this.getPlotGeometry();
    return geometry ? Math.max(0, Math.min(1, (clientX - geometry.left) / geometry.width)) : null;
  }

  clientYToValue(clientY) {
    if (!this.metrics) {
      return null;
    }

    const geometry = this.getPlotGeometry();
    const normalized = 1 - Math.max(0, Math.min(1, (clientY - geometry.top) / geometry.height));
    return this.metrics.yMin + normalized * (this.metrics.yMax - this.metrics.yMin);
  }

  getPlotGeometry() {
    if (!this.metrics) return null;
    const rect = this.canvas.getBoundingClientRect();
    // The canvas bitmap can exceed CSS size on a small viewport, so dpr alone
    // does not always describe the actual client-to-bitmap mapping.
    const scaleX = rect.width > 0 && this.width > 0 ? this.width / rect.width : this.metrics.dpr;
    const scaleY = rect.height > 0 && this.height > 0 ? this.height / rect.height : this.metrics.dpr;
    return {
      left: rect.left + (this.metrics.padLeft || 0) / scaleX,
      top: (rect.top || 0) + (this.metrics.padTop || 0) / scaleY,
      width: this.metrics.plotWidth / scaleX,
      height: this.metrics.plotHeight / scaleY,
    };
  }

  clientPointToPlot(clientX, clientY, geometry = this.getPlotGeometry(), clamp = false) {
    if (!geometry) return null;
    let x = (clientX - geometry.left) / geometry.width;
    let y = (clientY - geometry.top) / geometry.height;
    const inside = x >= 0 && x <= 1 && y >= 0 && y <= 1;
    if (clamp) {
      x = Math.max(0, Math.min(1, x));
      y = Math.max(0, Math.min(1, y));
    }
    return { x, y, inside };
  }

  sampleOffsetToClientX(sampleOffset) {
    if (!this.metrics || this.metrics.visibleSamples <= 0) {
      return null;
    }

    const geometry = this.getPlotGeometry();
    const source = this.metrics.source;
    const ratio = source?.readVisibleTime
      ? (source.readVisibleTime(sampleOffset) - source.timeStart) / Math.max(1e-9, source.timeEnd - source.timeStart)
      : sampleOffset / Math.max(1, this.metrics.visibleSamples - 1);
    return geometry.left + ratio * geometry.width;
  }
}
