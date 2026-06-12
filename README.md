<p align="center">
  <img src="./images/modusignal-logo.svg" alt="modusignal" width="520" />
</p>

<p align="center">
  <b>Debug industrial devices directly from your browser.</b><br />
  <i>Serial · WebSocket · MQTT · Modbus RTU · HART — all in one zero-install web app.</i>
</p>

<p align="center">
  <a href="https://modusignal.cn/"><img src="https://img.shields.io/badge/Live%20Demo-modusignal.cn-0f766e?style=flat-square" alt="Live Demo" /></a>
  <a href="./LICENSE.txt"><img src="https://img.shields.io/badge/license-Apache%202.0-blue?style=flat-square" alt="License" /></a>
  <a href="https://github.com/txp666/modusignal"><img src="https://img.shields.io/github/stars/txp666/modusignal?style=flat-square" alt="GitHub Stars" /></a>
  <a href="https://github.com/txp666/modusignal/issues/new?title=%E6%96%B0%E8%AE%BE%E5%A4%87%E6%94%AF%E6%8C%81%E8%AF%B7%E6%B1%82"><img src="https://img.shields.io/badge/request-new%20device-8b5cf6?style=flat-square" alt="Request Device" /></a>
</p>

---

## 🔥 Why modusignal?

> **No setup. No install. No backend. Just a browser — connect and debug.**

| Traditional Way | modusignal |
|----------------|-----------|
| ❌ Install desktop software per device | ✅ Open a URL — that's it |
| ❌ Windows-only vendor tools | ✅ Cross-platform (Chrome, Edge) |
| ❌ One tool per protocol | ✅ Unified: serial, WebSocket, MQTT |
| ❌ Can't test remotely easily | ✅ Share a link — ready to go |
| ❌ Heavy IDE required for custom protocols | ✅ Custom device template in 2 minutes |

**16,000+ lines of clean, modular JavaScript. Zero backend. Pure browser magic.**

---

## ✨ Features That Pop

### 🚀 Zero Install, Open & Go
Deploy to GitHub Pages (or any static host), open the URL — **done**. No npm install, no server, no database. Your browser does all the work via **Web Serial**, **WebSocket**, and **MQTT over WebSocket**.

### 🔌 6 Built-In Device Profiles
| Device | Transport | Use Case |
|--------|-----------|----------|
| **AOMaster** | Serial (115200 8N1) | 4-20mA / 0-10V signal generator, 6 waveforms |
| **Modbus RTU** | Serial (9600 8N1) | Read/write holding & input registers |
| **HART** | Serial (1200 8O1) | Device search, universal commands, PV/SV/TV/QV |
| **WebSocket Debug** | WebSocket | JSON/HEX/Modbus message debug & curve |
| **MQTT Debug** | MQTT | Publish/subscribe, QoS, retain, message stats |
| **Custom Device** | Any | User-defined templates, regex parsing, JSON path |

Switch devices → transport & params auto-switch. **It just works.**

### 📈 Live Charts, No Library
Real-time curve engine built on **Canvas 2D** — zero dependencies. 3000-point buffer, configurable viewport, multi-axis. Smooth, fast, lightweight.

### 🧩 Transport/Device Orthogonal Architecture
```
UI (app.js)
 ├── Device Layer  →  constructs commands, parses replies
 └── Transport Layer →  connects, sends, receives (serial / WS / MQTT)
```
Add a new device? Write 2 functions. Add a new transport? Extend `BaseTransport`. **No cross-contamination.**

### 📝 4-in-1 Log Console
Color-coded logs: **TX**, **RX**, **System**, **Error**. MQTT logs show topic prefixes. Copy, clear, scroll — everything you expect.

### 🎮 Manual Send: ASCII · JSON · HEX
Multi-line input, line-ending selectors, JSON validation, HEX with flexible separators. Send anything, see results instantly.

### 🔄 Auto Polling
Read-mode devices can auto-poll at configurable intervals (50 ms to 10 s). Live-updating curves while you work.

### 🛠 Custom Device Builder
Need to debug a device modusignal doesn't support yet? Configure:
- Output range, unit, step
- Send template with `{value}`, `{value:2}`, `{unit}` placeholders
- Parse rules: regex, JSON path, HEX offset, Modbus payload
- Value scaling: `parsed × scale + offset`

**No coding required.** Build your driver in 2 minutes.

### 🧪 Monitor Panel · Curve Config
Unified curve configuration for all devices:
- **JSON Path** — extract values from JSON responses
- **HEX Offset** — parse bytes at given offsets
- **Modbus Payload** — decode Modbus RTU frames
- **Frame Delimiters** — line-break, header/tail, CRC16
- **Test samples** — validate your parsing before going live

---

## 🖥️ Quick Start

### Development (no build)

```powershell
python -m http.server 4173
```

Open `http://localhost:4173` in Chrome/Edge.

### Production Build

```powershell
npm ci
npm run build
npm run preview
```

Build output goes to `_site/`. Chunks optimized — first paint in ~2-3 requests.

### Browser Support

| Feature | Required | Browsers |
|---------|----------|----------|
| **Serial** | ✅ | Chrome 89+ / Edge 89+ (HTTPS or localhost) |
| **WebSocket** | ✅ | All modern browsers |
| **MQTT over WS** | ✅ | All modern browsers |

---

## 🏗️ Project Architecture

```
index.html              →  App shell (topbar, sidebar, mount points)
pages/
  home.html             →  Home overview + device grid
  request.html          →  New device request form
  devices/
    aomaster.html       →  AOMaster control panel
    modbus.html         →  Modbus RTU register I/O
    hart.html           →  HART search & commands
    websocket.html      →  WebSocket message debug
    mqtt.html           →  MQTT publish/subscribe
    custom.html         →  Custom device builder
  shared/
    workbench.html      →  Log console + live charts
src/
  app.js                →  State, routing, events, device orchestration
  protocols.js          →  Device registry, command/telemetry dispatch
  page-loader.js        →  Async HTML fragment loader
  chart.js              →  Canvas 2D real-time chart engine
  echarts-charts.js     →  ECharts-based waveform preview
  config.js             →  App metadata, URLs, license
  transports/
    transport.js        →  BaseTransport interface (EventTarget)
    serial.js           →  Web Serial session
    websocket.js        →  WebSocket session
    mqtt.js             →  MQTT over WebSocket session
    registry.js         →  Transport descriptor registry
  devices/
    aomaster.js         →  AOMaster Modbus RTU driver
    modbus-device.js    →  Generic Modbus RTU driver
    hart-device.js      →  HART protocol driver
    websocket-device.js →  WebSocket debug driver
    mqtt-device.js      →  MQTT debug driver
    custom-device.js    →  Custom device template driver
  modbus/modbus.js      →  Modbus RTU frame assembler/disassembler
  hart/hart.js          →  HART frame encoder/decoder
```

---

## 📊 AOMaster Modbus Register Map

| Addr | R/W | Description |
|------|-----|-------------|
| 0x0000 | R/W | Signal type (current/voltage) |
| 0x0001 | R/W | Waveform: 0=const, 1=step, 2=ramp, 3=square, 4=triangle, 5=sine |
| 0x0002 | R/W | Setpoint / low value |
| 0x0003 | R/W | High value / step hold time |
| 0x0004 | R/W | Period (ms) or cycle count |
| 0x0005 | R/W | Duty cycle × 10 |
| 0x0006 | R | Actual output (readback) |
| 0x0007+ | R/W | Step sequence values |

Poll interval: 50 ms. Step mode writes header first, then sequence values.

---

## 🤝 Contributing

See [`CONTRIBUTING.md`](./CONTRIBUTING.md) for guidelines.

Quick path to add a new device:

1. Create `src/devices/<id>.js` — profile, set-output command, telemetry parser
2. Register in `src/protocols.js`
3. Add device page in `pages/devices/`
4. Wire transport defaults in `src/app.js`

Need a device we don't have? [Open a request](https://github.com/txp666/modusignal/issues/new?title=%E6%96%B0%E8%AE%BE%E5%A4%87%E6%94%AF%E6%8C%81%E8%AF%B7%E6%B1%82).

---

## 📄 License

[Apache License 2.0](./LICENSE.txt)

---

## 🌟 Star History

If modusignal saves you time debugging devices, give it a ⭐ — it helps others find it too!

---

<br />

---

<p align="center">
  <img src="./images/modusignal-logo.svg" alt="modusignal" width="200" />
</p>

<h1 align="center">modusignal 在线设备调试平台</h1>

<p align="center">
  浏览器端在线设备/信号调试工具<br />
  串口 · WebSocket · MQTT · Modbus RTU · HART · 自定义协议<br />
  <strong>零安装 · 纯前端 · 跨平台</strong>
</p>

---

## 🔥 为什么选择 modusignal？

> **无需安装、无需后端、打开浏览器就能调试设备。**

| 传统方式 | modusignal |
|---------|-----------|
| ❌ 每种设备装一个上位机软件 | ✅ 打开网页即可 |
| ❌ 仅限 Windows | ✅ 跨平台（Chrome / Edge / 全平台） |
| ❌ 一种协议一个工具 | ✅ 统一：串口、WebSocket、MQTT |
| ❌ 远端调试困难 | ✅ 分享链接立即用 |
| ❌ 自定协议需要写代码 | ✅ 自定义模板 2 分钟搞定 |

---

## ✨ 功能亮点

### 🚀 零安装 · 开箱即用
部署到 GitHub Pages 等任何静态托管，打开 URL 即可使用。**纯静态**，无后端、无数据库。利用浏览器原生 **Web Serial**、原生 **WebSocket**、**MQTT over WebSocket** 能力。

### 🔌 六大内置设备驱动
| 设备 | 传输 | 说明 |
|------|------|------|
| **AOMaster** | 串口 115200 8N1 | 4-20mA / 0-10V 信号发生器，6 种波形 |
| **Modbus RTU** | 串口 9600 8N1 | 读/写保持寄存器与输入寄存器 |
| **HART** | 串口 1200 8O1 | 设备搜索、通用命令、PV/SV/TV/QV 多变量 |
| **WebSocket 调试** | WebSocket | JSON/HEX/Modbus 消息调试与曲线 |
| **MQTT 调试** | MQTT over WS | 发布/订阅、QoS、保留消息、消息统计 |
| **自定义设备** | 任意 | 用户定义模板、正则解析、JSON 路径 |

切换设备时，**通讯方式和参数自动切换**。

### 📈 实时曲线 · 零依赖
基于 **Canvas 2D** 自绘曲线引擎，不依赖任何第三方图表库。3000 点缓冲区，可配置视口，多曲线同屏。

### 🧩 传输层与设备层正交设计
```
UI (app.js)
 ├── 设备层  →  构造命令、解析回包
 └── 传输层 →  连接、收发（串口 / WS / MQTT）
```
添加新设备只需写 2 个函数，添加新传输只需继承 `BaseTransport`。**互不污染**。

### 📝 四色收发日志
**TX（发送·蓝）· RX（接收·绿）· 系统（灰）· 错误（红）**，MQTT 日志带主题前缀。

### 🎮 手动发送：ASCII · JSON · HEX
多行输入、行尾选择、JSON 语法校验、HEX 灵活分隔符。

### 🔄 自动轮询
读模式设备支持自动轮询（50ms ~ 10s 可配），曲线实时刷新。

### 🛠 自定义设备构建器
无需写代码，2 分钟配出一个设备驱动：
- 输出范围、单位、步长
- 发送模板（占位符 `{value}`、`{value:2}`、`{unit}`）
- 解析规则（正则、JSON 路径、HEX 偏移、Modbus 载荷）
- 数值换算（`解析值 × 比例 + 偏移`）

### 🧪 统一曲线配置
- **JSON 路径** — 从 JSON 回包提取数值
- **HEX 偏移** — 按偏移量解析字节
- **Modbus 载荷** — 解码 Modbus RTU 帧
- **帧界定** — 换行分隔 / 帧头帧尾 / CRC16 校验
- **测试样例** — 配置后立即验证解析效果

---

## 🖥️ 快速开始

### 开发模式（无需构建）

```powershell
python -m http.server 4173
```

浏览器打开 `http://localhost:4173`，推荐 Chrome 或 Edge。

### 生产构建

```powershell
npm ci
npm run build
npm run preview
```

构建产物在 `_site/`，首屏仅 2~3 个请求。

### 浏览器兼容

| 功能 | 要求 | 支持浏览器 |
|------|------|-----------|
| **串口** | ✅ | Chrome 89+ / Edge 89+（HTTPS 或 localhost） |
| **WebSocket** | ✅ | 所有现代浏览器 |
| **MQTT over WS** | ✅ | 所有现代浏览器 |

---

## 📄 许可证

[Apache License 2.0](./LICENSE.txt)

---

## 🌟 Star 历史

如果 modusignal 帮你节省了设备调试时间，不妨点个 ⭐，帮助更多人发现它！

---

<p align="center">
  <i>Made by <a href="https://space.bilibili.com/509795217">飞起小鹏</a> · Powered by Web Serial · WebSocket · MQTT</i>
</p>
