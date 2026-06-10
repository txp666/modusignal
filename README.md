<p align="center">
  <img src="./images/modusignal-logo.svg" alt="modusignal" width="480" />
</p>

<p align="center">在线设备调试平台（串口·TCP·MQTT）</p>

# modusignal 在线设备调试平台

modusignal 是一个浏览器端在线设备/信号调试平台，统一抽象多种传输方式（串口·TCP·MQTT），用来通过网页连接使用者的设备。**当前已实现串口（Web Serial），TCP / MQTT / WebSocket 为已留好的扩展点**。AOMaster 是当前内置的第一个设备 profile，面向 4-20mA / 0-10V 信号发生器，采用 Modbus RTU 驱动。

## 当前功能

- 统一传输抽象：连接、断开、接收和发送（已实现串口，其余传输为扩展点）
- 连接参数面板：按所选传输的 descriptor 动态渲染（串口含波特率、数据位、停止位、校验、流控）
- 多页面设备 UI：主页、AOMaster / Modbus / 自定义设备各自独立 HTML（`pages/`），共享曲线与日志工作台
- 设备库框架：当前内置 AOMaster 与自定义设备，后续设备放在 `src/devices/`
- AOMaster 多信号类型与波形：恒定、阶跃、斜坡、方波、三角波、正弦波；双曲线（波形预览 + 实时输出）；默认 20 ms 轮询
- 自定义设备：可配置设备名、类型、设定范围、单位、发送模板和解析规则
- 手动命令发送：ASCII / HEX，支持行尾选择
- 收发日志：TX / RX / 系统 / 错误
- 实时曲线：按当前设备解析接收数据并绘制最近 120 个采样点
- 协议驱动：AOMaster Modbus RTU（寄存器 0x0000 模式、0x0001 设定、0x0002 回读）；通用 Modbus 与自定义模板仍可用于其他设备

## 传输方式与扩展

传输层与设备层正交，加一种传输不需要改设备驱动或页面逻辑：在 `src/transports/` 新建继承 `BaseTransport` 的 session 类并导出 descriptor，再到 `src/transports/registry.js` 注册即可（详见 `AI.md` 的「添加传输」）。

浏览器能力边界：纯静态页面只能用 Web Serial、WebSocket、MQTT over WebSocket；原始 TCP/UDP 需自建 WS↔TCP 桥接或转桌面端（Tauri/Electron）；HTTPS 页面只能连 `wss://`。

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
| 0x0007+ | R/W | 阶跃序列各点（模拟量×1000，频率×10） |

阶跃模式分两次写入：先写 0x0000~0x0005 头部，再写 0x0007 起的序列值。回读轮询默认 20 ms，读取 0x0006。

新增其他设备时，优先补充：

- `src/devices/<id>.js` 的 profile 与 `create*SetOutputCommand`
- 设备回包解析函数
- 曲线字段选择

建议每种设备维护独立 profile，保持页面层只依赖统一的驱动接口。

## 项目文档

- `CONTRIBUTING.md`：贡献流程和新增设备请求需要的信息
- `AI.md`：项目目标、架构说明、AI 添加设备指南
- `src/config.js`：GitHub 链接和新增设备请求链接配置
