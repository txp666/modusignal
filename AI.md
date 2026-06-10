# AI 开发说明

本文给 AI 或后续维护者快速说明 modusignal 的目标、架构和添加设备/传输的方式。

## 项目目标

modusignal 是一个静态在线设备/信号调试平台。它通过浏览器连接使用者的设备，统一抽象多种传输方式（串口、TCP、MQTT 等），提供：

- 多传输连接、断开、收发日志（当前已实现串口，TCP/MQTT/WebSocket 为扩展点）
- 设备专属页面 UI
- 设备命令构造
- 回包解析和曲线查看
- 自定义设备模板，支持无内置驱动时快速调试
- GitHub Pages 静态部署

当前内置设备：

- `aomaster`：AOMaster 4-20mA / 0-10V 模拟量信号发生器，协议待补充
- `custom`：自定义设备，使用本地保存的模板和解析配置

设备层与传输层正交：设备只产出/解析字节，不关心数据怎么传；传输层负责建立连接与收发字节。

## 当前架构

```text
index.html
  页面结构、导航、设备页面 UI、连接参数容器

src/app.js
  应用状态、页面路由、DOM 绑定、传输事件、日志、曲线联动、传输参数动态渲染

src/transports/transport.js
  BaseTransport 接口（connect/disconnect/write + connected/disconnected/rx/tx/error 事件）

src/transports/serial.js
  SerialTransport（Web Serial 封装）与串口 descriptor（连接参数 schema）

src/transports/registry.js
  传输注册表与扩展点：listTransports / getTransportDescriptor / createTransportSession

src/chart.js
  无依赖 canvas 实时曲线

src/protocols.js
  设备注册表和统一协议入口

src/devices/aomaster.js
  AOMaster profile、命令构造占位、遥测解析入口

src/devices/custom-device.js
  自定义设备配置、模板发送、正则/自动数值解析

src/config.js
  项目链接和站点级配置
```

## 页面模型

`src/app.js` 使用轻量页面状态：

- `home`：项目主页，包含 GitHub 链接和设备入口
- `aomaster`：AOMaster 专属页面
- `custom`：自定义设备专属页面
- `request`：新增设备请求页面

新增设备时，应新增页面入口和页面 UI，而不是把所有控件塞进一个通用面板。

## 设备驱动接口

一个设备驱动文件（`src/devices/<id>.js`）按需要分三块能力，**只有 profile 元信息是必须的**，输出设定和回包解析都按设备实际功能选配：

| 能力 | 是否必须 | 提供方式 |
| --- | --- | --- |
| 设备元信息（id / name / type / protocolStatus） | 必须 | `*_PROFILE` |
| 设定与输出命令（滑条、预设、发送字节） | 可选 | `profile.modes` + `create*SetOutputCommand` |
| 回包解析（曲线、读数） | 可选 | `parse*Telemetry` |

### 最小驱动：只读遥测、无设定

如果设备只上报数据、不需要从页面下发设定，**可以完全省略 `modes` 和 `create*SetOutputCommand`**。此时设定面板不可用，命令构造分发会返回「设备不支持设定输出」，页面仍可显示日志与曲线：

```js
export const MY_DEVICE_ID = "my-device";

export const MY_DEVICE_PROFILE = {
  id: MY_DEVICE_ID,
  name: "My Device",
  type: "设备类型",
  protocolStatus: "ready",
};

export function parseMyDeviceTelemetry(text, parseNumericTelemetry) {
  const value = parseNumericTelemetry(text);
  return value === null ? null : { fieldName: "测量值", unit: "", value, rawValue: value };
}
```

### 完整驱动：带设定与输出命令

需要从页面下发设定时，再补上 `modes`（每个 mode 即一组「设定」滑条配置）和命令构造函数：

```js
export const MY_DEVICE_PROFILE = {
  id: MY_DEVICE_ID,
  name: "My Device",
  type: "设备类型",
  protocolStatus: "ready",
  // modes 可选：每个键是一种设定模式，值描述滑条范围与预设
  modes: {
    default: {
      label: "设定",
      unit: "",
      min: 0,
      max: 100,
      step: 1,
      presets: { min: 0, mid: 50, max: 100 },
    },
  },
};

export function createMyDeviceSetOutputCommand(state) {
  return {
    supported: true, // 协议未定时返回 false，页面会提示「协议待配置」
    preview: "发送预览",
    bytes: new Uint8Array(),
  };
}
```

> 约定：`create*SetOutputCommand` 始终返回 `{ supported, preview, bytes }`，协议未确认时用 `supported: false` 占位（参考 `src/devices/aomaster.js`），不要写死会影响设备输出的字节。

### 在 `src/protocols.js` 注册

- 把 profile 加入 `DEVICE_PROFILES`
- 在 `parseDeviceTelemetry` 分发到本设备的 `parse*Telemetry`（无解析则不分发）
- **仅当设备有设定输出时**，在 `createDeviceSetOutputCommand` 分发命令构造；否则交由默认分支返回不支持

> 自定义设备（`custom`）是特例：profile、设定范围、模板和解析都由用户表单实时生成，不进 `DEVICE_PROFILES`，由 `getDeviceProfile` / 各分发函数单独处理。

## 添加设备 UI

1. 在 `index.html` 的设备库中添加一个 `data-page-target` 和 `data-device-id` 按钮。
2. 为设备添加专属页面说明和控件。
3. 在 `src/app.js` 的页面状态中处理该设备。
4. 保持连接、日志和曲线复用现有组件。

## 添加传输

传输层与设备层正交：加一种传输不需要改设备驱动或页面逻辑。

1. 在 `src/transports/` 新建一个 session 类，继承 `BaseTransport`，实现 `connect/disconnect/write` 与 `get connected`，并在收发时 `emit("rx"/"tx"/...)`（参考 `serial.js`）。
2. 导出一个 descriptor，用 `fields` 声明连接参数（页面据此自动渲染并收集）：

```js
export const WEBSOCKET_TRANSPORT = {
  id: "websocket",
  label: "WebSocket",
  requiresSecureContext: false,
  isSupported: () => "WebSocket" in window,
  fields: [
    { key: "url", label: "地址", type: "text", default: "wss://example.com/ws" },
  ],
  createSession: () => new WebSocketTransport(),
};
```

3. 在 `src/transports/registry.js` 的 `TRANSPORTS` 中注册该 descriptor，连接参数面板的下拉就会自动出现该选项。

### 浏览器能力与约束

- 纯静态浏览器页面只能用：Web Serial、WebSocket、MQTT over WebSocket（如 mqtt.js 连 `wss://`）。
- 原始 TCP/UDP 浏览器无法直连，需要自建 WS↔TCP 桥接服务，或将来转桌面端（Tauri/Electron）由原生层提供 session 实现。
- HTTPS 页面只能连接 `wss://`（连 `ws://` 会被混合内容拦截）。
- `descriptor.requiresSecureContext` 用于声明是否必须安全上下文（串口为 `true`）。

## 注意事项

- Web Serial 只能在 HTTPS 或 localhost 安全上下文使用。
- 不要在协议未确认时写死会影响设备输出的命令。
- 需要写设备输出时，要校验范围并在 UI 中展示命令预览。
- 自定义设备配置保存在浏览器 `localStorage`，不是云端配置。
- `src/config.js` 中的 GitHub 链接目前是占位，配置真实仓库后应更新。
