# 贡献指南

感谢你为 modusignal 增加设备、协议或界面能力。项目目标是把常见串口、WebSocket 与 MQTT 设备做成在线可用的浏览器工具，同时保留通用调试能力。

## 开发原则

- 每个设备应有独立驱动文件，放在 `src/devices/`。
- 每个设备可以有独立页面 UI，但连接、日志、曲线和手动收发能力应复用现有框架。
- 设备协议不要写在 `src/app.js`。页面层只负责状态和交互，协议层负责命令构造和回包解析。
- 不能确定协议时，先提供只读状态、手动命令和解析测试，不要伪造设备命令。

## 添加新设备

1. 在 `src/devices/` 新建设备驱动文件，例如 `my-device.js`。
2. 导出设备 ID、profile（含 `defaultTransportId`、可选 `image`）、命令构造函数和遥测解析函数。
3. 如有常用连接参数，导出 `*_TRANSPORT_DEFAULTS` 并在 `src/app.js` 的 `DEVICE_TRANSPORT_DEFAULTS` 按传输 ID 注册；如需轮询，在 `DEFAULT_*_CONFIG` 中设置 `pollIntervalMs`。
4. 在 `src/protocols.js` 注册设备 profile，并在 `createDeviceSetOutputCommand`、`parseDeviceTelemetry` 中接入。
5. 在 `pages/devices/` 增加设备页面 HTML，并在 `src/page-loader.js` 注册路径。
6. 在 `src/app.js` 增加 `DEVICE_PAGE_IDS`、页面状态绑定、设备专属 UI 显隐逻辑与轮询/配置表单。
7. 更新 `README.md` 和 `AI.md`。
8. 至少运行：

```powershell
node --check src\app.js
node --check src\protocols.js
node --check src\devices\my-device.js
```

## 新设备请求需要的信息

- 设备名称和型号
- 设备类型和使用场景
- 默认通讯方式（串口 / WebSocket / MQTT 等）与连接参数
- 协议文档或命令示例
- 回包样例和字段含义
- 需要的 UI 控件
- 安全限制，例如输出范围、危险命令、写入确认要求
- 参考图片或截图

## Pull Request 要求

- 说明新增或修改的设备能力。
- 说明如何手动验证。
- 对协议不确定的地方明确标注，不要隐藏假设。
- 不要提交本地临时文件、连接日志或个人设备配置。
