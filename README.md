<p align="center">
  <img src="./images/modusignal-logo.svg" alt="modusignal" width="480" />
</p>

<p align="center">在线设备调试平台（串口·WebSocket·HART·MQTT）</p>

# modusignal 在线设备调试平台

modusignal 是一个浏览器端在线设备/信号调试平台，统一抽象多种传输方式（串口·WebSocket·MQTT），用来通过网页连接使用者的设备。**当前已实现串口（Web Serial）、WebSocket 与 MQTT over WebSocket**。内置 AOMaster、Modbus RTU、HART 通用设备、WebSocket 调试、MQTT 调试与自定义设备 profile；切换设备时会自动切换该设备的默认通讯方式与连接参数。

## 当前功能

- 统一传输抽象：连接、断开、接收和发送（串口、WebSocket、MQTT）
- 连接参数面板：按所选传输的 descriptor 动态渲染（串口含波特率、数据位、停止位、校验、流控；WebSocket 含服务地址；MQTT 含 Broker、Client ID、订阅/发布主题与认证）
- 设备默认通讯：各设备 profile 声明 `defaultTransportId`；切换设备时自动切换传输并套用默认连接参数
- 多页面设备 UI：主页、AOMaster / Modbus / HART / WebSocket 调试 / MQTT 调试 / 自定义设备各自独立 HTML（`pages/`），共享曲线与日志工作台
- 设备库框架：内置设备 profile 可声明 `image`（如 `images/websocket.png`、`images/mqtt.png`），在侧栏设备库与主页卡片显示图标
- AOMaster 多信号类型与波形：恒定、阶跃、斜坡、方波、三角波、正弦波；双曲线（波形预览 + 实时输出）
- Modbus RTU：读/写保持寄存器与输入寄存器，可配置地址、数据类型与轮询
- HART 通用设备：设备搜索、通用命令、PV/SV/TV/QV 多曲线
- WebSocket 调试：快捷 JSON/文本发送、心跳轮询、JSON 路径解析与曲线
- MQTT 调试：Broker 连接、主题发布/订阅、QoS 与保留消息、快捷发布、消息统计与 JSON 解析
- 自定义设备：可配置设备名、类型、设定范围、单位、发送模板和解析规则
- 监测轮询：读模式设备与 WebSocket / MQTT 调试可在工作台手动开始/停止轮询，间隔按设备配置
- 手动命令发送：ASCII / JSON / HEX，支持行尾选择（JSON/ASCII 走文本帧）
- 收发日志：TX / RX / 系统 / 错误（MQTT 日志带主题前缀）
- 实时曲线：按当前设备解析接收数据并绘制（默认保留 3000 点、显示 240 点，可配置）
- 协议驱动：AOMaster Modbus RTU；通用 Modbus RTU；HART 帧编解码；WebSocket / MQTT JSON/文本解析；自定义模板可用于其他设备

## 内置设备默认参数

切换设备时，**默认通讯方式**、连接参数与轮询间隔会自动切换为下表默认值（已保存的浏览器配置需点「恢复默认」才会更新）：

| 设备 | 默认通讯 | 默认连接参数 | 默认轮询间隔 | 说明 |
| --- | --- | --- | --- | --- |
| AOMaster | 串口 | 115200 8N1 | 50 ms | Modbus RTU 从站，回读寄存器 0x0006 |
| 自定义 | 串口 | 115200 8N1 | 500 ms | 配置项已预留；当前页面不支持自动轮询 |
| Modbus RTU | 串口 | 9600 8N1 | 500 ms | 读模式下可轮询 |
| HART | 串口 | 1200 8O1 | 1000 ms | 需先搜索到设备方可轮询 |
| WebSocket 调试 | WebSocket | `ws://127.0.0.1:8080` | 0（手动） | 可配置心跳轮询与 JSON 解析路径 |
| MQTT 调试 | MQTT | `wss://broker.emqx.io:8084/mqtt` · 订阅 `modusignal/rx` · 发布 `modusignal/tx` | 0（手动） | 可配置 QoS、保留消息与 JSON 解析路径 |

常量定义位置：

- 默认通讯：`src/devices/*-device.js` 中 profile 的 `defaultTransportId`
- 连接参数：`src/devices/*-device.js` 的 `*_TRANSPORT_DEFAULTS` 与 `src/app.js` 的 `DEVICE_TRANSPORT_DEFAULTS`
- 轮询间隔：`DEFAULT_*_CONFIG.pollIntervalMs`
- 设备图标：profile 的 `image` 字段，资源放在 `images/`

## 传输方式与扩展

传输层与设备层正交，加一种传输不需要改设备驱动或页面逻辑：在 `src/transports/` 新建继承 `BaseTransport` 的 session 类并导出 descriptor，再到 `src/transports/registry.js` 注册即可（详见 `AI.md` 的「添加传输」）。

当前已注册：

| 传输 | ID | 说明 |
| --- | --- | --- |
| 串口 | `serial` | Web Serial，需 HTTPS 或 localhost |
| WebSocket | `websocket` | 浏览器原生 WebSocket；字符串/JSON 发文本帧，HEX 发二进制帧 |
| MQTT | `mqtt` | MQTT over WebSocket（mqtt.js）；订阅收、发布发；支持 QoS 与 retain |

浏览器能力边界：纯静态页面可用 Web Serial、WebSocket、MQTT over WebSocket。远程 `ws://` 在 HTTPS 页面可能被浏览器拦截，公网服务建议用 `wss://`；本地 `ws://127.0.0.1` 通常可用。

## WebSocket 调试设备

适用于直连 WebSocket 服务、联调 JSON 协议或 echo 服务：

1. 侧栏进入 **WebSocket 调试**（会自动选中 WebSocket 传输）
2. 填写 WebSocket 地址并连接
3. 使用快捷按钮或收发调试区发送 JSON/文本/HEX
4. 在设备页配置 **JSON 数值路径**（如 `value`）可将回包绘制到曲线；配置轮询间隔与心跳消息后可开启轮询

## MQTT 调试设备

适用于 MQTT over WebSocket 联调、主题测试与 JSON 消息验证：

1. 侧栏进入 **MQTT 调试**（会自动选中 MQTT 传输）
2. 填写 Broker 地址、Client ID、订阅/发布主题（或使用默认公共 Broker）
3. 点击连接；侧栏顶栏会显示连接摘要
4. 在设备页使用快捷发布，或在收发调试区手动发送 JSON/ASCII/HEX
5. 可配置发布 QoS（0/1/2）、保留消息、JSON 解析路径与轮询心跳

默认公共测试 Broker：

```text
wss://broker.emqx.io:8084/mqtt
订阅：modusignal/rx
发布：modusignal/tx
```

## 自定义设备

自定义设备配置保存在当前浏览器的 `localStorage` 中，不会上传到服务器。可配置：

- 输出设定：通道名称、单位、最小值、最大值、步进、默认值
- 发送模板：ASCII 或 HEX，支持 `{value}`、`{value:2}`、`{unit}`、`{mode}`
- 回包解析：自动提取最后一个数字，或使用正则捕获指定分组
- 数值换算：`解析值 * 比例 + 偏移`

示例：

```text
ASCII 模板：SET {value:3}
HEX 模板：01 06 00 01 {value:0}
正则：PV=([-+]?\d+(?:\.\d+)?)
```

## 浏览器要求

串口（Web Serial）需要安全上下文：

- 线上使用 GitHub Pages 的 HTTPS 地址
- 本地开发使用 `localhost`
- 推荐 Chrome 或 Edge

WebSocket 与 MQTT 无额外插件要求；HTTPS 页面连接远程服务时请优先使用 `wss://`。

## 本地预览

不需要安装依赖。启动一个本地静态服务器即可：

```powershell
python -m http.server 4173
```

然后访问：

```text
http://localhost:4173
```

## 设备与协议接入点

设备驱动放在 `src/devices/`，统一由 `src/protocols.js` 注册和分发。

### AOMaster Modbus RTU 寄存器

| 地址 | 读写 | 说明 |
| --- | --- | --- |
| 0x0000 | R/W | 信号类型 |
| 0x0001 | R/W | 波形：0=恒定，1=阶跃，2=斜坡，3=方波，4=三角波，5=正弦 |
| 0x0002 | R/W | 恒定=设定值；阶跃=序列点数；其它波形=低值 |
| 0x0003 | R/W | 恒定=同设定；阶跃=单步保持(ms)；其它波形=高值 |
| 0x0004 | R/W | 恒定/其它=周期(ms)或0；阶跃=循环次数(0=无限) |
| 0x0005 | R/W | 占空比×10（方波）或 0 |
| 0x0006 | R | 实际输出 |
| 0x0007+ | R/W | 阶跃序列各点（模拟量×1000） |

阶跃模式分两次写入：先写 0x0000~0x0005 头部，再写 0x0007 起的序列值。默认回读轮询 50 ms，读取 0x0006。

新增其他设备时，优先补充：

- `src/devices/<id>.js` 的 profile（含 `defaultTransportId`、可选 `image`）与 `create*SetOutputCommand`
- 设备回包解析函数
- `src/app.js` 中 `DEVICE_TRANSPORT_DEFAULTS` 注册
- 曲线字段选择

建议每种设备维护独立 profile，保持页面层只依赖统一的驱动接口。

## 项目文档

- `CONTRIBUTING.md`：贡献流程和新增设备请求需要的信息
- `AI.md`：项目目标、架构说明、AI 添加设备指南
- `src/config.js`：GitHub 链接和新增设备请求链接配置
