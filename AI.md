# AI 开发说明

本文给 AI 或后续维护者快速说明 modusignal 的目标、架构和添加设备/传输的方式。

## 项目目标

modusignal 是一个静态在线设备/信号调试平台。它通过浏览器连接使用者的设备，统一抽象多种传输方式（串口、WebSocket、MQTT 等），提供：

- 多传输连接、断开、收发日志（已实现串口、WebSocket、MQTT over WebSocket）
- 设备专属页面 UI
- 设备命令构造
- 回包解析和曲线查看
- 自定义设备模板，支持无内置驱动时快速调试
- GitHub Pages 静态部署

当前内置设备：

- `aomaster`：AOMaster 4-20mA / 0-10V 模拟量信号发生器，Modbus RTU 驱动，默认串口
- `modbus`：通用 Modbus RTU 寄存器读写，默认串口
- `hart`：HART 通用设备，支持搜索、通用命令与 PV/SV/TV/QV 轮询，默认串口
- `websocket`：WebSocket 消息调试，快捷发送与 JSON 解析，默认 WebSocket，图标 `images/websocket.png`
- `mqtt`：MQTT 消息调试，主题发布/订阅、QoS/retain 与 JSON 解析，默认 MQTT，图标 `images/mqtt.png`
- `custom`：自定义设备，使用本地保存的模板和解析配置，默认串口

各设备 profile 可声明：

- `defaultTransportId`：默认通讯方式（`serial` / `websocket` / `mqtt` 等），由 `getDeviceDefaultTransportId()` 读取；切换设备时 `applyDeviceDefaultTransport()` 自动切换传输
- `image`：设备库与主页卡片图标路径（如 `./images/hart.png`）；有图标的设备在 `listDeviceLibrary()` 中优先排序
- `*_TRANSPORT_DEFAULTS`：各传输下的默认连接参数，在 `src/app.js` 的 `DEVICE_TRANSPORT_DEFAULTS` 注册
- `DEFAULT_*_CONFIG.pollIntervalMs`：轮询间隔

设备层与传输层正交：设备只产出/解析字节或文本，不关心数据怎么传；传输层负责建立连接与收发。

## 当前架构

```text
index.html
  应用壳：顶栏、侧栏、页面挂载点

pages/
  home.html / request.html
  devices/aomaster.html · modbus.html · hart.html · websocket.html · mqtt.html · custom.html
  shared/workbench.html（监测面板 + 收发调试 + 曲线配置折叠区）

src/page-loader.js
  启动时 fetch 并注入上述 HTML 片段

src/app.js
  应用状态、页面路由、DOM 绑定、传输事件、日志、曲线联动、传输参数动态渲染

src/echarts-charts.js
  ECharts 曲线封装

src/transports/transport.js
  BaseTransport 接口（connect/disconnect/write + connected/disconnected/rx/tx/error 事件）

src/transports/serial.js
  SerialTransport（Web Serial 封装）与串口 descriptor

src/transports/websocket.js
  WebSocketTransport；字符串/JSON 发文本帧，Uint8Array 发二进制帧

src/transports/mqtt.js
  MqttTransport（mqtt.js + WebSocket Broker）；write 支持 topic/qos/retain；rx/tx 带主题

vendor/mqtt.esm.js
  mqtt.js 浏览器 ESM bundle

src/transports/registry.js
  传输注册表：listTransports / getTransportDescriptor / createTransportSession

src/protocols.js
  设备注册表、getDeviceDefaultTransportId、getModeConfig、统一协议入口

src/devices/aomaster.js
  AOMaster profile、Modbus RTU 命令构造、实际输出回读解析

src/devices/modbus-device.js
  通用 Modbus RTU profile、读写命令与回包解析

src/devices/hart-device.js
  HART profile、搜索/轮询命令、PV/SV/TV/QV 解析

src/devices/json-curve-config.js
  JSON 多曲线槽位（4 槽）、路径解析、normalize / list / remove 共享逻辑

src/devices/binary-curve-config.js
  HEX / Modbus 多曲线槽位、按偏移解码、removeMultiCurveSlot

src/debug-curve-form.js
  监测面板 MQTT/WebSocket 二进制曲线表单读写与模式切换

src/devices/message-parser.js
  MQTT / WebSocket 共享解析入口：JSON·HEX·Modbus 多曲线

src/framing/frame-parser.js
  行界缓冲、HEX 帧头帧尾切帧、字节流 append

src/utils/bytes.js
  字节拼接、HEX/文本载荷归一、ASCII 预览

src/chart-curve-panel.js
  监测面板「曲线配置」折叠区：按设备显示 section、协议说明弹窗

src/chart-curve-help.js
  各设备曲线 / 协议帮助 HTML

src/devices/websocket-device.js
  WebSocket 调试 profile、心跳命令、JSON/HEX/Modbus 遥测解析

src/devices/mqtt-device.js
  MQTT 调试 profile、快捷发布、QoS/retain 配置、JSON/HEX/Modbus 遥测解析

src/devices/custom-device.js
  自定义设备配置、模板发送、行界/帧头帧尾/正则/HEX 解析

images/
  设备图标：AOMaster.png · hart.png · websocket.png · mqtt.png · modusignal-logo.svg

src/config.js
  项目链接和站点级配置
```

## 页面模型

`src/app.js` 使用轻量页面状态：

- `home`：项目主页，包含 GitHub 链接和设备入口
- `aomaster`：AOMaster 专属页面（信号波形、阶跃序列、双曲线）
- `modbus`：Modbus RTU 专属页面
- `hart`：HART 通用设备专属页面
- `websocket`：WebSocket 调试专属页面
- `mqtt`：MQTT 调试专属页面
- `custom`：自定义设备专属页面
- `request`：新增设备请求页面

新增设备时，应新增页面入口和页面 UI，而不是把所有控件塞进一个通用面板。

## 设备驱动接口

一个设备驱动文件（`src/devices/<id>.js`）按需要分三块能力，**profile 元信息是必须的**，输出设定和回包解析都按设备实际功能选配：

| 能力 | 是否必须 | 提供方式 |
| --- | --- | --- |
| 设备元信息（id / name / type / protocolStatus / defaultTransportId / image） | 必须（image 可选） | `*_PROFILE` |
| 设定与输出命令（滑条、预设、发送字节） | 可选 | `profile.modes` + `create*SetOutputCommand` |
| 回包解析（曲线、读数） | 可选 | `parse*Telemetry` |

### 默认通讯方式

在 profile 上声明 `defaultTransportId`，与 `src/transports/registry.js` 中已注册的传输 ID 一致：

```js
export const MY_DEVICE_PROFILE = {
  id: MY_DEVICE_ID,
  name: "My Device",
  type: "设备类型",
  protocolStatus: "ready",
  defaultTransportId: "serial", // 或 "websocket" / "mqtt"
  image: "./images/my-device.png", // 可选
};
```

切换设备时 `selectDevice()` → `applyDeviceDefaultTransport()` 会：

1. 若当前传输与设备默认不一致，调用 `setTransport(defaultTransportId)`
2. 否则调用 `applyDeviceTransportDefaults()` 更新连接参数表单

### 最小驱动：只读遥测、无设定

如果设备只上报数据、不需要从页面下发设定，**可以完全省略 `modes` 和 `create*SetOutputCommand`**。参考 `src/devices/websocket-device.js` 与 `src/devices/mqtt-device.js`（无 modes，通过快捷发送与收发调试区手动发消息）。`getModeConfig()` 对无 `modes` 的 profile 返回安全占位配置；连接后 UI 走 `updateMessageDebugCommandUi()`。

### 完整驱动：带设定与输出命令

需要从页面下发设定时，再补上 `modes` 和命令构造函数。约定：`create*SetOutputCommand` 始终返回 `{ supported, preview, bytes }`；`bytes` 可为 `Uint8Array` 或 `string`（WebSocket/MQTT 文本帧）。

### 在 `src/protocols.js` 注册

- 把 profile 加入 `DEVICE_PROFILES`（`custom` 除外）
- 在 `parseDeviceTelemetry` 分发到本设备的 `parse*Telemetry`
- 在 `createDeviceSetOutputCommand` 分发命令构造（无设定则跳过）

## 设备默认连接参数与轮询

在 `src/devices/<id>.js` 中导出各传输的默认连接参数：

```js
export const MY_DEVICE_TRANSPORT_DEFAULTS = {
  baudRate: 9600,
  parity: "none",
  dataBits: 8,
  stopBits: 1,
  flowControl: "none",
};

export const MY_DEVICE_WEBSOCKET_TRANSPORT_DEFAULTS = {
  url: "ws://127.0.0.1:8080",
};

export const MY_DEVICE_MQTT_TRANSPORT_DEFAULTS = {
  brokerUrl: "wss://broker.emqx.io:8084/mqtt",
  clientId: "modusignal",
  subscribeTopic: "modusignal/rx",
  publishTopic: "modusignal/tx",
};
```

在 `src/app.js` 的 `DEVICE_TRANSPORT_DEFAULTS` 中按传输 ID 注册：

```js
[MY_DEVICE_ID]: {
  serial: MY_DEVICE_TRANSPORT_DEFAULTS,
  websocket: MY_DEVICE_WEBSOCKET_TRANSPORT_DEFAULTS,
  mqtt: MY_DEVICE_MQTT_TRANSPORT_DEFAULTS,
},
```

当前默认值：

| 设备 | 默认通讯 | 连接参数 | 轮询 (ms) |
| --- | --- | --- | --- |
| AOMaster | serial | 115200 8N1 | 50 |
| 自定义 | serial | 115200 8N1 | 500（暂不支持轮询） |
| Modbus | serial | 9600 8N1 | 500 |
| HART | serial | 1200 8O1 | 1000 |
| WebSocket 调试 | websocket | ws://127.0.0.1:8080 | 0（可配置心跳轮询） |
| MQTT 调试 | mqtt | wss://broker.emqx.io:8084/mqtt · modusignal/rx · modusignal/tx | 0（可配置心跳轮询） |

## 添加设备 UI

1. 在 `pages/devices/<id>.html` 添加设备专属 UI，并在 `src/page-loader.js` 的 `PAGE_PATHS.devices` 中注册路径。
2. 设备库与主页卡片通过 `listDeviceLibrary()` 自动收录 `DEVICE_PROFILES` 中的设备；设置 `profile.image` 可显示 `images/` 下图标。
3. 在 `src/app.js` 增加 `DEVICE_PAGE_IDS`、页面状态绑定、轮询与配置表单。
4. 保持连接、日志和曲线复用现有组件。

## 添加传输

传输层与设备层正交：加一种传输不需要改设备驱动或页面逻辑。

1. 在 `src/transports/` 新建 session 类，继承 `BaseTransport`，实现 `connect/disconnect/write` 与 `get connected`，并在收发时 `emit("rx"/"tx"/...)`。
2. `write(data, options?)` 接受 `Uint8Array | string`；WebSocket 字符串走文本帧；MQTT 可通过 options 指定 `topic` / `qos` / `retain`。
3. 导出 descriptor，用 `fields` 声明连接参数。
4. 在 `src/transports/registry.js` 的 `TRANSPORTS` 中注册。

已实现传输见 `src/transports/serial.js`、`websocket.js`、`mqtt.js`。

### 浏览器能力与约束

- 纯静态浏览器页面可用：Web Serial、WebSocket、MQTT over WebSocket。
- Web Serial 需 HTTPS 或 localhost（`requiresSecureContext: true`）。
- WebSocket / MQTT 远程 `ws://` 在 HTTPS 页面可能被浏览器拦截；UI 会提示，但不硬拦截；本地 `127.0.0.1` 通常可用。
- 收发调试区 `buildManualPayload()` 支持 `ascii` / `json` / `hex`；JSON 校验后作为字符串发送。

## 曲线配置与协议解析

监测面板 `pages/shared/workbench.html` 中的 `#chartCurveConfigBlock` 集中管理各设备曲线相关 UI（HART 变量勾选、MQTT/WebSocket JSON 多曲线与解析模式、协议说明弹窗）。设备页只保留连接/轮询/收发调试配置。

解析分层：

| 层级 | 模块 | 职责 |
| --- | --- | --- |
| 帧界 | `src/framing/frame-parser.js` | CRLF/LF 行缓冲；HEX 帧头/帧尾切帧 |
| 载荷 | `src/utils/bytes.js` | 文本/HEX/二进制归一为 `Uint8Array` |
| 协议 | `src/devices/message-parser.js` | MQTT/WS 共享 JSON·HEX·Modbus 解析 |
| 设备 | 各 `*-device.js` | 设备专属 normalize、命令、summary |

Modbus RTU 与自定义帧头帧尾在连接期间维护 rx buffer；连接/断开时 `reset*RxBuffer()` 清空。

## 注意事项

- Web Serial 只能在 HTTPS 或 localhost 安全上下文使用。
- 不要在协议未确认时写死会影响设备输出的命令。
- 需要写设备输出时，要校验范围并在 UI 中展示命令预览。
- 自定义设备、WebSocket 与 MQTT 调试配置保存在浏览器 `localStorage`，不是云端配置。
- `src/config.js` 中的 GitHub 链接目前是占位，配置真实仓库后应更新。
