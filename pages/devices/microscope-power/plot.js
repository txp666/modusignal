const CODE_MIN = 0;
const CODE_MAX = 65535;

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
    const padLeft = Math.round(60 * this.dpr);
    const padRight = Math.round(22 * this.dpr);
    const padTop = Math.round(20 * this.dpr);
    const padBottom = Math.round(38 * this.dpr);
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
    ctx.strokeStyle = "#1d4ed8";
    ctx.lineWidth = Math.max(1, this.dpr);

    const samplesPerColumn = source.visibleSamples / width;

    for (let x = 0; x < width; x += 1) {
      const start = Math.floor(x * samplesPerColumn);
      const end = Math.max(start + 1, Math.floor((x + 1) * samplesPerColumn));
      let min = CODE_MAX;
      let max = CODE_MIN;

      for (let i = start; i < end && i < source.visibleSamples; i += 1) {
        const sample = source.readVisibleSample(i);
        if (sample < min) min = sample;
        if (sample > max) max = sample;
      }

      const yMin = this.codeToY(min, y0, height, source.yRange);
      const yMax = this.codeToY(max, y0, height, source.yRange);
      const px = x0 + x + 0.5;
      ctx.beginPath();
      ctx.moveTo(px, yMin);
      ctx.lineTo(px, yMax);
      ctx.stroke();
    }

    ctx.restore();
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
    const yMid = Math.round((yMin + yMax) / 2);
    ctx.fillText(String(yMax), x - 8 * this.dpr, y);
    ctx.fillText(String(yMid), x - 8 * this.dpr, y + height / 2);
    ctx.fillText(String(yMin), x - 8 * this.dpr, y + height);

    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    const seconds = source.visibleSamples / Math.max(1, source.sampleRate);
    const offset = source.viewOffsetSamples / Math.max(1, source.sampleRate);
    const label = source.viewOffsetSamples > 0
      ? `${seconds.toFixed(3)} s，距最新 ${offset.toFixed(3)} s`
      : `${seconds.toFixed(3)} s，最新`;
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

  codeToY(code, y, height, yRange) {
    const min = yRange.min;
    const max = Math.max(min + 1, yRange.max);
    const normalized = (Math.max(min, Math.min(max, code)) - min) / (max - min);
    return y + height - normalized * height;
  }

  clientXToSampleOffset(clientX) {
    if (!this.metrics || this.metrics.visibleSamples <= 0) {
      return null;
    }

    const rect = this.canvas.getBoundingClientRect();
    const x = (clientX - rect.left) * this.metrics.dpr;
    const rel = Math.max(0, Math.min(this.metrics.plotWidth, x - this.metrics.padLeft));
    return Math.round((rel / this.metrics.plotWidth) * Math.max(0, this.metrics.visibleSamples - 1));
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
