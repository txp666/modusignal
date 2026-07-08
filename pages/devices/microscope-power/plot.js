export class WavePlot {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false });
    this.width = 0;
    this.height = 0;
    this.dpr = 1;
    this.metrics = null;
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
    };

    ctx.fillStyle = "#f8fafc";
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
    this.drawAxes(ctx, padLeft, padTop, plotWidth, plotHeight, source);
  }

  drawWaveform(ctx, x0, y0, width, height, source) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, y0, width, height);
    ctx.clip();

    const columns = Math.max(1, Math.floor(width));
    const samplesPerColumn = source.visibleSamples / columns;
    const maxReadsPerColumn = source.showEnvelope ? 64 : 16;
    const meanPoints = [];

    if (source.showEnvelope) {
      ctx.strokeStyle = "rgba(29, 78, 216, 0.18)";
      ctx.lineWidth = Math.max(1, this.dpr);
    }

    for (let x = 0; x < columns; x += 1) {
      const start = Math.floor(x * samplesPerColumn);
      const end = Math.max(start + 1, Math.floor((x + 1) * samplesPerColumn));
      const countInBucket = Math.max(1, end - start);
      const step = Math.max(1, Math.ceil(countInBucket / maxReadsPerColumn));
      let min = Infinity;
      let max = -Infinity;
      let sum = 0;
      let count = 0;

      for (let i = start; i < end && i < source.visibleSamples; i += step) {
        const sample = source.readVisibleSample(i);
        if (sample < min) min = sample;
        if (sample > max) max = sample;
        sum += sample;
        count += 1;
      }

      const lastIndex = Math.min(source.visibleSamples - 1, end - 1);
      if (lastIndex >= start && ((lastIndex - start) % step) !== 0) {
        const sample = source.readVisibleSample(lastIndex);
        if (sample < min) min = sample;
        if (sample > max) max = sample;
        sum += sample;
        count += 1;
      }

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
        meanPoints.push({
          x: px,
          y: this.valueToY(sum / count, y0, height, source.yRange),
        });
      }
    }

    const displayPoints = source.smoothDisplay ? this.smoothPoints(meanPoints, 3) : meanPoints;
    if (displayPoints.length > 0) {
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
    ctx.strokeStyle = "#d9e2ec";
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
    ctx.fillStyle = "#334155";
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
    const seconds = source.visibleSamples / Math.max(1, source.sampleRate);
    const offset = source.viewOffsetSamples / Math.max(1, source.sampleRate);
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

      const px = x + (cursor.sampleOffset / Math.max(1, source.visibleSamples - 1)) * width;
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
    ctx.fillStyle = "#64748b";
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
      return `${Math.round(value)} uA`;
    }
    if (Math.abs(value) >= 1000) {
      return `${value.toFixed(1)} uA`;
    }
    if (Math.abs(value) >= 10) {
      return `${value.toFixed(1)} uA`;
    }
    return `${value.toFixed(3)} uA`;
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
    return Math.round(ratio * Math.max(0, this.metrics.visibleSamples - 1));
  }

  clientXToPlotRatio(clientX) {
    if (!this.metrics) {
      return null;
    }

    const rect = this.canvas.getBoundingClientRect();
    const x = (clientX - rect.left) * this.metrics.dpr;
    const rel = Math.max(0, Math.min(this.metrics.plotWidth, x - this.metrics.padLeft));
    return rel / this.metrics.plotWidth;
  }

  clientYToValue(clientY) {
    if (!this.metrics) {
      return null;
    }

    const rect = this.canvas.getBoundingClientRect();
    const y = (clientY - rect.top) * this.metrics.dpr;
    const rel = Math.max(0, Math.min(this.metrics.plotHeight, y - this.metrics.padTop));
    const normalized = 1 - rel / this.metrics.plotHeight;
    return this.metrics.yMin + normalized * (this.metrics.yMax - this.metrics.yMin);
  }

  sampleOffsetToClientX(sampleOffset) {
    if (!this.metrics || this.metrics.visibleSamples <= 0) {
      return null;
    }

    const rect = this.canvas.getBoundingClientRect();
    const rel = (sampleOffset / Math.max(1, this.metrics.visibleSamples - 1)) * this.metrics.plotWidth;
    return rect.left + (this.metrics.padLeft + rel) / this.metrics.dpr;
  }
}
