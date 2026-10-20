<p align="center">
  <img src="./images/modusignal-logo.svg" alt="modusignal" width="520" />
</p>

<p align="center">
  <b>在浏览器里直接调设备。</b><br/>
  <sub>串口 · WebUSB · WebSocket · MQTT · Modbus RTU · HART · 自定义协议</sub>
</p>

<p align="center">
  <a href="https://modusignal.cn/"><img src="https://img.shields.io/badge/live%20demo-modusignal.cn-0f766e?style=flat-square" alt="在线使用"></a>
  <a href="./LICENSE.txt"><img src="https://img.shields.io/badge/license-Apache%202.0-blue?style=flat-square" alt="License"></a>
  <a href="https://github.com/txp666/modusignal/stargazers"><img src="https://img.shields.io/github/stars/txp666/modusignal?style=flat-square" alt="Stars"></a>
  <a href="https://github.com/txp666/modusignal/issues"><img src="https://img.shields.io/github/issues/txp666/modusignal?style=flat-square" alt="Issues"></a>
  <a href="https://github.com/txp666/modusignal/commits"><img src="https://img.shields.io/github/last-commit/txp666/modusignal?style=flat-square" alt="Last commit"></a>
</p>

<p align="center">
  <b>中文</b> ·
  <a href="./README_EN.md">English</a> ·
  <a href="https://modusignal.cn/">立即使用 →</a> ·
  <a href="https://github.com/txp666/modusignal/issues/new?title=%E6%96%B0%E8%AE%BE%E5%A4%87%E6%94%AF%E6%8C%81%E8%AF%B7%E6%B1%82">请求设备</a>
</p>

<p align="center">
  <img src="./images/show.gif" alt="modusignal 演示" width="880" />
</p>

<table>
  <tr>
    <td width="25%" align="center">
      <img src="./images/AOMaster.png" alt="AOMaster" width="210" /><br/>
      <sub><b>AOMaster</b><br/>4-20 mA / 0-10 V<br/>6 种波形</sub>
    </td>
    <td width="25%" align="center">
      <img src="./images/hart.png" alt="HART" width="210" /><br/>
      <sub><b>HART</b><br/>通用仪表调试<br/>PV / SV / TV / QV</sub>
    </td>
    <td width="25%" align="center">
      <img src="./images/websocket.png" alt="WebSocket" width="210" /><br/>
      <sub><b>WebSocket</b><br/>JSON / HEX / Modbus<br/>实时曲线</sub>
    </td>
    <td width="25%" align="center">
      <img src="./images/mqtt.png" alt="MQTT" width="210" /><br/>
      <sub><b>MQTT</b><br/>发布 / 订阅 · QoS<br/>保留消息 · 统计</sub>
    </td>
  </tr>
</table>

## 简介

浏览器里的设备调试台，纯静态前端，没有上位机要装、没有后端要起。打开网页、选设备、连上，就能看原始报文、手动发命令、看实时曲线。

> 一个标签页，一根线，跟设备直接对话。

**适用场景**

- 临时调一块 Modbus RTU 板子，不想装厂家几百 MB 的上位机
- 进车间带个 HART 调制解调器，笔记本插上就是 HART 调试工具
- 新设备走 WebSocket 或 MQTT，想边看流量边看曲线
- 把链接发给同事，比发 `setup.exe` 省事
- 内部协议没有现成工具，用 *自定义设备* 页面拼一个，不用写代码

不适合长时间数据采集、生产监控或 SCADA，这是个调试工具。

## 内置设备

| 设备 | 传输 | 默认参数 | 说明 |
|------|------|----------|------|
| Modbus RTU | 串口 | 9600 8N1 | 读写保持 / 输入寄存器 |
| HART | 串口 | 1200 8O1 | 设备搜索、通用命令、PV/SV/TV/QV、仪表设置与校正 |
| WebSocket | WebSocket | — | JSON / HEX / Modbus 报文调试 |
| MQTT | MQTT over WS | — | 发布订阅、QoS、保留消息、统计 |
| AOMaster | 串口 | 115200 8N1 | 4-20 mA / 0-10 V 信号源 |
| MicroScope Power | WebUSB | — | 小电流波形采集（[硬件](https://oshwhub.com/txp666/project_iupheygc) · [固件](https://github.com/txp666/MicroScope-Power)） |
| 自定义设备 | 任意 | — | 发送模板 + 解析规则，无需写代码 |

切换设备时，通讯方式和默认参数会跟着切换。

## 主要功能

- **收发调试**：毫秒时间戳，HEX / 文本显示切换，暂停滚动，收发字节统计，日志保存为 .txt。
- **Modbus RTU**：一问一答收发，超时与异常码诊断；寄存器表支持 16 / 32 位整数和 Float32 等多种格式。
- **HART**：地址扫描、通用命令、PV/SV/TV/QV 轮询，仪表参数设置与输入输出校正；应答超时和响应码诊断，写操作发送前确认。
- **自定义设备**：常用指令库（导入导出、定时发送），文本转义，CRC16 / SUM8 / XOR8 校验；发送模板支持 `{value}` 等占位符，解析支持正则、JSON 路径、HEX 偏移和 Modbus 载荷。
- **实时曲线**：多曲线显示，CSV 导入导出。
- **其它**：中英文界面、深浅色主题，可下载离线包使用。

## 快速开始

开发时不用构建，起一个静态服务即可：

```bash
python3 -m http.server 4173
```

用 Chrome / Edge 打开 `http://localhost:4173`。

构建发布版本：

```bash
npm install
npm run build
npm run preview
```

构建脚本是 `scripts/build.mjs`（基于 esbuild），产物在 `_site/`。

## 离线使用

适合拷到笔记本、工控机或现场环境里用，无需联网。

- **下载**：每次推送到 `main` 后，在 [Actions → Offline package](https://github.com/txp666/modusignal/actions/workflows/offline-package.yml) 最新一次运行里下载 `modusignal-offline-<版本>.zip`；打 `v*` 标签的版本在 [Releases](https://github.com/txp666/modusignal/releases) 下载。
- **运行**：解压后双击 `start-modusignal.bat`（Windows）或运行 `start-modusignal.sh`（macOS / Linux），会自动起服务并打开浏览器。
- **自己打包**：`npm install` 后运行 `npm run build:offline`，产物在 `_release/`。

## 浏览器要求

| 功能 | 浏览器 |
|------|--------|
| 串口（Web Serial） | Chrome / Edge 89+，需要 HTTPS 或 localhost |
| WebUSB | Chrome / Edge，需要 HTTPS 或 localhost |
| WebSocket、MQTT over WebSocket | 现代浏览器均可 |

Firefox 和 Safari 不支持 Web Serial / WebUSB，串口和 WebUSB 设备用不了，其它功能正常。

## 开发

设备层和传输层分开：加一个新设备通常就是在 `src/devices/` 写驱动、在 `src/device-registry.js` 注册、在 `pages/devices/` 加页面。

- [`CONTRIBUTING.md`](./CONTRIBUTING.md)：添加设备的步骤
- [`docs/architecture.md`](./docs/architecture.md)：模块分层
- [`DESIGN.md`](./DESIGN.md)：界面设计规范
- [`AI.md`](./AI.md)：各设备的协议约定与实现说明

测试：`npm test`。

## 参与

项目在持续迭代。需要新设备但不方便自己写驱动的，[提一个 issue](https://github.com/txp666/modusignal/issues/new?title=%E6%96%B0%E8%AE%BE%E5%A4%87%E6%94%AF%E6%8C%81%E8%AF%B7%E6%B1%82)，附上协议文档、报文样例和默认连接参数即可。也欢迎 PR 增加设备或修复驱动。

## 许可证

[Apache License 2.0](./LICENSE.txt)。

如果 modusignal 帮你省下了一个下午跟厂家上位机较劲的时间，点个 star 能让更多人看到它。

---

<p align="center">
  <sub>by <a href="https://space.bilibili.com/509795217">飞起小鹏</a> · <a href="https://modusignal.cn/">modusignal.cn</a></sub>
</p>
