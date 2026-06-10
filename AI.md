# AI 开发说明

本文给 AI 或后续维护者快速说明 modusignal 的目标、架构和添加设备方式。

## 项目目标

modusignal 是一个静态在线串口平台。它通过浏览器 Web Serial API 连接使用者本地串口设备，提供：

- 串口连接、断开、收发日志
- 设备专属页面 UI
- 设备命令构造
- 回包解析和曲线查看
- 自定义设备模板，支持无内置驱动时快速调试
- GitHub Pages 静态部署

当前内置设备：

- `aomaster`：AOMaster 4-20mA / 0-10V 模拟量信号发生器，协议待补充
- `custom`：自定义设备，使用本地保存的模板和解析配置

## 当前架构

```text
index.html
  页面结构、导航、设备页面 UI

src/app.js
  应用状态、页面路由、DOM 绑定、串口事件、日志、曲线联动

src/serial.js
  Web Serial session 封装：connect / disconnect / write / read loop

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

设备驱动应至少提供：

```js
export const MY_DEVICE_ID = "my-device";

export const MY_DEVICE_PROFILE = {
  id: MY_DEVICE_ID,
  name: "My Device",
  type: "设备类型",
  protocolStatus: "ready",
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
    supported: true,
    preview: "发送预览",
    bytes: new Uint8Array(),
  };
}

export function parseMyDeviceTelemetry(text, parseNumericTelemetry) {
  return {
    fieldName: "测量值",
    unit: "",
    value: 0,
    rawValue: 0,
  };
}
```

然后在 `src/protocols.js` 注册：

- 加入 `DEVICE_PROFILES`
- 在 `createDeviceSetOutputCommand` 分发命令构造
- 在 `parseDeviceTelemetry` 分发回包解析

## 添加设备 UI

1. 在 `index.html` 的设备库中添加一个 `data-page-target` 和 `data-device-id` 按钮。
2. 为设备添加专属页面说明和控件。
3. 在 `src/app.js` 的页面状态中处理该设备。
4. 保持串口连接、日志和曲线复用现有组件。

## 注意事项

- Web Serial 只能在 HTTPS 或 localhost 安全上下文使用。
- 不要在协议未确认时写死会影响设备输出的命令。
- 需要写设备输出时，要校验范围并在 UI 中展示命令预览。
- 自定义设备配置保存在浏览器 `localStorage`，不是云端配置。
- `src/config.js` 中的 GitHub 链接目前是占位，配置真实仓库后应更新。
