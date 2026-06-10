# AOMaster 串口工作台

AOMaster 是一个基于浏览器 Web Serial API 的在线串口通讯框架，当前面向 4-20mA / 0-10V 信号发生器做第一版工作台。项目先保留协议扩展点，在通讯协议确定前提供手动 ASCII / HEX 收发、参数记录和曲线查看框架。

## 当前功能

- Web Serial 串口连接、断开、接收和发送
- 常用串口参数配置：波特率、数据位、停止位、校验、流控
- AOMaster 输出模式框架：4-20mA 与 0-10V
- 手动命令发送：ASCII / HEX，支持行尾选择
- 串口日志：TX / RX / 系统 / 错误
- 实时曲线：自动从接收文本中提取数值并绘制最近 120 个采样点
- 协议驱动占位：后续可在 `src/protocols.js` 中补充 AOMaster 正式命令

## 浏览器要求

Web Serial 需要安全上下文：

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

## GitHub Pages 部署

仓库已包含 `.github/workflows/pages.yml`。推送到 `main` 分支后，GitHub Actions 会自动发布静态站点。

首次使用时需要在 GitHub 仓库中打开：

```text
Settings -> Pages -> Build and deployment -> Source -> GitHub Actions
```

## 后续协议接入点

AOMaster 协议确定后，优先补充：

- `src/protocols.js` 的 `createAOMasterSetOutputCommand`
- 设备回包解析函数，例如把原始数据解析为电流、电压、状态码、告警等字段
- 曲线字段选择，例如电流输出、电压输出、温度、校准值

建议把不同设备抽象成独立 profile，保持页面层只依赖统一的驱动接口。
