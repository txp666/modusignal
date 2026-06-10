export class LiveChart {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.maxPoints = options.maxPoints ?? 120;
    this.points = [];
    this.color = options.color ?? "#0f766e";
    this.gridColor = options.gridColor ?? "#d7dde4";
    this.textColor = options.textColor ?? "#687381";
    this.draw();
  }

  add(value) {
    const point = {
      value,
      time: Date.now(),
    };

    this.points.push(point);
    if (this.points.length > this.maxPoints) {
      this.points.shift();
    }
    this.draw();
    return point;
  }

  clear() {
    this.points = [];
    this.draw();
  }

  draw() {
    const { canvas, ctx } = this;
    const width = canvas.width;
    const height = canvas.height;
    const padding = 36;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#fbfcfd";
    ctx.fillRect(0, 0, width, height);

    this.drawGrid(width, height, padding);

    if (this.points.length < 2) {
      ctx.fillStyle = this.textColor;
      ctx.font = "16px Segoe UI, Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("等待串口数据", width / 2, height / 2);
      return;
    }

    const values = this.points.map((point) => point.value);
    let min = Math.min(...values);
    let max = Math.max(...values);

    if (min === max) {
      min -= 1;
      max += 1;
    }

    const xStep = (width - padding * 2) / Math.max(this.maxPoints - 1, 1);
    const yScale = (height - padding * 2) / (max - min);

    ctx.strokeStyle = this.color;
    ctx.lineWidth = 3;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();

    this.points.forEach((point, index) => {
      const x = padding + index * xStep;
      const y = height - padding - (point.value - min) * yScale;

      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();

    const latest = this.points[this.points.length - 1];
    const latestX = padding + (this.points.length - 1) * xStep;
    const latestY = height - padding - (latest.value - min) * yScale;

    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(latestX, latestY, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = this.textColor;
    ctx.font = "13px Segoe UI, Arial, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(max.toFixed(3), 8, padding + 4);
    ctx.fillText(min.toFixed(3), 8, height - padding + 4);
  }

  drawGrid(width, height, padding) {
    const { ctx } = this;
    ctx.strokeStyle = this.gridColor;
    ctx.lineWidth = 1;

    for (let i = 0; i <= 4; i += 1) {
      const y = padding + ((height - padding * 2) / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();
    }

    for (let i = 0; i <= 6; i += 1) {
      const x = padding + ((width - padding * 2) / 6) * i;
      ctx.beginPath();
      ctx.moveTo(x, padding);
      ctx.lineTo(x, height - padding);
      ctx.stroke();
    }
  }
}
