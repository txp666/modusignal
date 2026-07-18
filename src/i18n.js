const SUPPORTED_LANGS = ["zh", "en"];

const TRANSLATIONS = {
  // ===== 通用 / index.html =====
  "app.subtitle": { zh: "在线设备调试平台（串口·WebSocket·HART·MQTT）", en: "Online Device Debug Platform (Serial · WebSocket · HART · MQTT)" },
  "app.title": { zh: "modusignal 在线设备调试", en: "modusignal Online Device Debug" },
  "app.ogTitle": { zh: "modusignal 在线设备调试", en: "modusignal Online Device Debug" },
  "app.ogDesc": { zh: "浏览器端在线设备/信号调试：串口·WebSocket·HART·Modbus·自定义协议，实时曲线与收发调试。", en: "Browser-based device/signal debugging: Serial, WebSocket, HART, Modbus, custom protocols with real-time charts." },
  "app.metaDesc": { zh: "modusignal 在线设备调试平台：Web Serial 串口与 WebSocket，支持 AOMaster Modbus RTU、HART、Modbus RTU、WebSocket 调试与自定义协议，实时曲线、收发日志与监测轮询。", en: "modusignal online device debug platform: Web Serial, WebSocket, supports AOMaster, Modbus RTU, HART, custom protocols, real-time charts, transceiver logs and monitoring polling." },
  "app.metaKeywords": { zh: "modusignal,设备调试,串口调试,Web Serial,WebSocket,HART,Modbus RTU,4-20mA,信号发生器,在线调试,工业协议", en: "modusignal,device debug,serial debug,Web Serial,WebSocket,HART,Modbus RTU,4-20mA,signal generator,online debug,industrial protocols" },
  "app.schemaDesc": { zh: "在线设备与信号调试平台，支持 Web Serial 串口、WebSocket、HART、Modbus RTU 与自定义协议驱动。", en: "Online device and signal debug platform supporting Web Serial, WebSocket, HART, Modbus RTU and custom protocol drivers." },

  // Header / 导航
  "nav.checkingEnv": { zh: "检测环境", en: "Checking..." },
  "nav.connect": { zh: "连接", en: "Connect" },
  "nav.disconnect": { zh: "断开连接", en: "Disconnect" },
  "nav.project": { zh: "项目", en: "Project" },
  "nav.collapseProject": { zh: "折叠项目", en: "Collapse Project" },
  "nav.home": { zh: "主页", en: "Home" },
  "nav.homeDesc": { zh: "项目概览 / GitHub / 请求设备", en: "Overview / GitHub / Request Device" },
  "nav.requestDevice": { zh: "请求新设备", en: "Request New Device" },
  "nav.requestDeviceDesc": { zh: "提交协议和 UI 需求", en: "Submit protocol & UI requirements" },
  "nav.deviceLibrary": { zh: "设备库", en: "Device Library" },
  "nav.notConnected": { zh: "未连接", en: "Not Connected" },
  "nav.connected": { zh: "已连接", en: "Connected" },
  "nav.collapseLibrary": { zh: "折叠设备库", en: "Collapse Device Library" },
  "nav.search": { zh: "搜索", en: "Search" },
  "nav.searchPlaceholder": { zh: "名称 / 协议 / ID", en: "Name / Protocol / ID" },
  "nav.connectionParams": { zh: "连接参数", en: "Connection Params" },
  "nav.collapseParams": { zh: "折叠连接参数", en: "Collapse Connection Params" },
  "nav.transportMode": { zh: "传输方式", en: "Transport" },

  // 环境状态
  "env.needHttps": { zh: "需要 HTTPS 或 localhost", en: "HTTPS or localhost required" },
  "env.notSupported": { zh: "当前环境不支持", en: "Not supported: " },
  "env.available": { zh: " 可用", en: " available" },

  // Footer
  "footer.license": { zh: "开源协议", en: "License" },
  "footer.version": { zh: "版本", en: "Version" },

  // 连接日志
  "log.disconnected": { zh: "已断开", en: "Disconnected" },
  "log.connect": { zh: "连接", en: "Connect" },
  "log.error": { zh: "错误", en: "Error" },
  "log.send": { zh: "发送", en: "Send" },
  "log.system": { zh: "系统", en: "System" },
  "log.device": { zh: "设备", en: "Device" },
  "log.chart": { zh: "曲线", en: "Chart" },
  "log.logCleared": { zh: "日志已清空", en: "Log cleared" },
  "log.chartCleared": { zh: "曲线已清空", en: "Chart cleared" },
  "log.switchedTo": { zh: "已切换到", en: "Switched to" },
  "log.switchedTransport": { zh: "已切换", en: "Switched" },

  // 面板
  "panel.expand": { zh: "展开", en: "Expand" },
  "panel.collapse": { zh: "折叠", en: "Collapse" },

  // ===== 首页 =====
  "home.pageTitle": { zh: "modusignal 在线设备调试", en: "modusignal Online Device Debug" },
  "home.pageDesc": { zh: "通过浏览器连接设备，统一传输抽象（串口·WebSocket·MQTT），把设备驱动、调试收发和曲线查看放在一个在线工具里。", en: "Connect to devices via browser with unified transport abstraction (Serial · WebSocket · MQTT), combining device drivers, debug transceiver and chart viewing in one online tool." },
  "home.github": { zh: "GitHub", en: "GitHub" },
  "home.requestDevice": { zh: "请求新设备", en: "Request New Device" },
  "home.buyProduct": { zh: "购买产品", en: "Buy Product" },
  "home.aomasterKicker": { zh: "AOMaster 产品", en: "AOMaster Product" },
  "home.aomasterProductTitle": { zh: "AOMaster 便携式模拟量输出控制器", en: "AOMaster Portable Analog Output Controller" },
  "home.aomasterProductDesc": { zh: "基于 CH32V003F4U6 + GP8630 的掌心级模拟量输出设备，支持 OLED 本地调节、0-10 V / 4-20 mA 输出、波形输出与 USART1 Modbus RTU 上位机控制。", en: "A palm-sized analog output device based on CH32V003F4U6 + GP8630, with OLED local adjustment, 0-10 V / 4-20 mA output, waveform output and USART1 Modbus RTU host control." },
  "home.aomasterLocalControl": { zh: "OLED 本地调节", en: "OLED Local Control" },
  "home.aomasterMore": { zh: "查看产品介绍", en: "Product Intro" },
  "home.aomasterDebug": { zh: "打开调试页", en: "Open Debug Page" },
  "home.aomasterClose": { zh: "关闭产品介绍", en: "Close Product Intro" },
  "home.aomasterIntro": { zh: "AOMaster 面向传感器、仪表和采集模块调试，可在现场直接旋钮设定输出，也可以通过 modusignal 在浏览器里下发恒定值、阶跃、斜坡、方波、三角波和正弦波，并轮询回读实际输出曲线。", en: "AOMaster is built for sensor, instrument and acquisition-module debugging. Set output directly with the on-device knob, or use modusignal in the browser to send constant, step, ramp, square, triangle and sine outputs while polling actual output curves." },
  "home.aomasterFeatureOutput": { zh: "模拟量输出", en: "Analog Output" },
  "home.aomasterFeatureOutputDesc": { zh: "覆盖 0-10 V 电压与 4-20 mA 电流，适合 PLC、采集卡、变送器输入端调试。", en: "Covers 0-10 V voltage and 4-20 mA current output for PLC, DAQ and transmitter input debugging." },
  "home.aomasterFeatureWave": { zh: "波形发生", en: "Waveform Generation" },
  "home.aomasterFeatureWaveDesc": { zh: "支持恒定、阶跃、斜坡、方波、三角波、正弦波；阶跃序列最多 16 点。", en: "Supports constant, step, ramp, square, triangle and sine outputs; step sequences support up to 16 points." },
  "home.aomasterFeatureLocal": { zh: "本地操作", en: "Local Operation" },
  "home.aomasterFeatureLocalDesc": { zh: "OLED 显示当前模式和输出值，编码器可切换步进、调整输出并进入菜单。", en: "OLED shows current mode and output value; the encoder switches step size, adjusts output and opens the menu." },
  "home.aomasterFeatureHost": { zh: "网页上位机", en: "Web Host" },
  "home.aomasterFeatureHostDesc": { zh: "USB-C 接入后以 115200 8N1 使用 Modbus RTU，支持设定写入与 50 ms 轮询回读。", en: "After USB-C connection, Modbus RTU runs at 115200 8N1 with setpoint writes and 50 ms polling readback." },
  "home.aomasterUsageTitle": { zh: "典型用法", en: "Typical Use" },
  "home.aomasterUsageDesc": { zh: "给设备供电后，将输出端接入被测设备或仪表输入端；网页中选择 AOMaster 与 Serial，保持默认串口参数即可开始控制与监测。", en: "Power the device, wire the output to the target device or instrument input, then select AOMaster and Serial in the web app with default serial parameters to start control and monitoring." },
  "home.aomasterHardware": { zh: "硬件资料", en: "Hardware Docs" },
  "home.hartlinkKicker": { zh: "HARTLink M1 产品", en: "HARTLink M1 Product" },
  "home.hartlinkProductTitle": { zh: "HARTLink M1 便携式 HART 手操器", en: "HARTLink M1 Portable HART Communicator" },
  "home.hartlinkProductDesc": { zh: "基于 CH32L103F8U6 的便携式 HART 基础读取手操器与 USB 透传桥，支持 OLED 本机菜单、设备扫描、USB CDC 原始帧透传与 USB HID IAP 升级。", en: "A portable CH32L103F8U6-based HART read-only communicator and USB bridge with an OLED menu, device scanning, raw USB CDC forwarding and USB HID IAP updates." },
  "home.hartlinkReadOnly": { zh: "安全只读", en: "Safe Read-only" },
  "home.hartlinkLocalMenu": { zh: "OLED 本机菜单", en: "OLED Local Menu" },
  "home.hartlinkMore": { zh: "查看产品介绍", en: "Product Intro" },
  "home.hartlinkDebug": { zh: "打开调试页", en: "Open Debug Page" },
  "home.hartlinkClose": { zh: "关闭产品介绍", en: "Close Product Intro" },
  "home.hartlinkIntro": { zh: "HARTLink M1 面向学习、实验和现场调试，可脱离电脑发现 HART 设备并读取过程变量与诊断状态；连接电脑后则作为 USB 与 HART 物理层之间的原始帧桥，配合 modusignal 完成更复杂的操作。", en: "HARTLink M1 is designed for learning, lab work and field diagnostics. It discovers HART devices and reads process variables and diagnostic status without a computer, then becomes a raw USB-to-HART physical-layer bridge for more advanced workflows with modusignal." },
  "home.hartlinkFeatureRead": { zh: "本机安全读取", en: "Safe Local Reads" },
  "home.hartlinkFeatureReadDesc": { zh: "提供 Cmd0/1/2/3/7/12/13/14/15/20 等基础读命令，本机菜单不向现场设备发送写参数命令。", en: "Provides core read commands including Cmd0/1/2/3/7/12/13/14/15/20; the local menu does not send parameter-write commands to field devices." },
  "home.hartlinkFeatureScan": { zh: "设备发现与轮询", en: "Discovery and Polling" },
  "home.hartlinkFeatureScanDesc": { zh: "扫描轮询地址 0-15，缓存设备身份与长地址，并在 OLED 上查看过程变量、状态和诊断信息。", en: "Scans polling addresses 0-15, caches device identity and long address, and shows process variables, status and diagnostics on the OLED." },
  "home.hartlinkFeatureBridge": { zh: "USB HART 透传", en: "USB HART Bridge" },
  "home.hartlinkFeatureBridgeDesc": { zh: "USB CDC 双向转发原始 HART 字节流；上位机活跃时本机不会抢占总线。", en: "USB CDC forwards raw HART byte streams in both directions; local commands do not seize the bus while the host is active." },
  "home.hartlinkFeatureUpdate": { zh: "在线固件升级", en: "Firmware Updates" },
  "home.hartlinkFeatureUpdateDesc": { zh: "内置 Bootloader 支持 USB HID IAP，可使用应用固件完成日常升级。", en: "The resident bootloader supports USB HID IAP for routine application-firmware updates." },
  "home.hartlinkUsageTitle": { zh: "接线提示", en: "Wiring Note" },
  "home.hartlinkUsageDesc": { zh: "USB 仅为 HARTLink 本机供电，不给 4-20 mA/HART 回路供电。请将测试线并联在约 250 Ω 负载两端或现场仪表端子，并在接线前确认回路极性、外部供电、负载与现场安全条件。", en: "USB powers HARTLink only; it does not power the 4-20 mA/HART loop. Connect the probes across an approximately 250 Ω load or the field-device terminals, and verify polarity, external loop power, load and field safety conditions first." },
  "home.hartlinkHardware": { zh: "立创开源硬件", en: "OSHWHub Hardware" },
  "home.architecture": { zh: "当前架构", en: "Current Architecture" },
  "home.archAriaLabel": { zh: "modusignal 架构框图：页面 UI 经 app.js 调度，分为正交的设备层与传输层，数据汇入曲线与日志", en: "modusignal architecture: page UI orchestrated by app.js, orthogonal device layer and transport layer, data flows into charts and logs" },
  "home.archUi": { zh: "页面 UI", en: "Page UI" },
  "home.archUiSub": { zh: "index.html + pages/", en: "index.html + pages/" },
  "home.archCore": { zh: "app.js 调度", en: "app.js Orchestrator" },
  "home.archCoreSub": { zh: "状态 · 路由 · 事件 · 日志/曲线联动", en: "State · Routing · Events · Log/Chart" },
  "home.archDevice": { zh: "设备", en: "Device" },
  "home.archTransport": { zh: "传输", en: "Transport" },
  "home.archDeviceLayer": { zh: "设备层", en: "Device Layer" },
  "home.archDeviceRegistry": { zh: "设备注册表", en: "Device Registry" },
  "home.archDeviceDriver": { zh: "设备驱动", en: "Device Driver" },
  "home.archTransportLayer": { zh: "传输层", en: "Transport Layer" },
  "home.archTransportRegistry": { zh: "传输注册表", en: "Transport Registry" },
  "home.archSerialWsMqtt": { zh: "串口 · WebSocket · MQTT", en: "Serial · WebSocket · MQTT" },
  "home.archParseSend": { zh: "解析 / 收发", en: "Parse / Send/Recv" },
  "home.archChartLog": { zh: "曲线 / 日志", en: "Chart / Log" },
  "home.archChartLogSub": { zh: "ECharts · 日志面板", en: "ECharts · Log Panel" },
  "home.archDesc": { zh: "设备层与传输层正交：设备只产出/解析字节，通过统一的 profile、命令构造和遥测解析接口接入；各设备可声明默认通讯方式，亦可在连接参数中手动切换。", en: "Device layer and transport layer are orthogonal: devices only produce/parse bytes through unified profile, command construction and telemetry parsing interfaces; each device declares default transport and can be manually switched in connection params." },

  // 设备库卡片
  "device.noMatch": { zh: "没有匹配的设备，请换个关键词试试。", en: "No matching devices. Try a different keyword." },
  "device.libraryEmpty": { zh: "设备库为空。", en: "Device library is empty." },

  // 传输默认描述
  "transport.defaults.mqtt": { zh: "默认 MQTT Broker 与主题", en: "Default MQTT Broker and topics" },
  "transport.defaults.modbusWs": { zh: "Modbus 默认 WebSocket 地址", en: "Modbus default WebSocket address" },
  "transport.defaults.wsDebug": { zh: "WebSocket 调试默认连接地址", en: "WebSocket debug default address" },
  "transport.defaults.mqttDebug": { zh: "MQTT 调试默认 Broker 与主题", en: "MQTT debug default Broker and topics" },
  "transport.defaults.ws": { zh: "默认 WebSocket 地址", en: "Default WebSocket address" },
  "transport.defaults.hart": { zh: "HART 默认串口参数（1200 8O1）", en: "HART default serial params (1200 8O1)" },
  "transport.defaults.aomaster": { zh: "AOMaster 默认串口参数（115200 8N1）", en: "AOMaster default serial params (115200 8N1)" },
  "transport.defaults.modbus": { zh: "Modbus 默认串口参数（9600 8N1）", en: "Modbus default serial params (9600 8N1)" },
  "transport.defaults.custom": { zh: "自定义串口设备默认串口参数（115200 8N1）", en: "Custom serial device default serial params (115200 8N1)" },
  "transport.defaults.generic": { zh: "设备默认连接参数", en: "Device default connection params" },
  "transport.switched": { zh: "已切换", en: "Switched" },

  // ===== 请求新设备页面 =====
  "request.title": { zh: "新增设备请求", en: "New Device Request" },
  "request.desc": { zh: "提交新设备前，请尽量准备协议、连接/串口参数、典型命令、回包样例和期望页面 UI。", en: "Before submitting, please prepare the protocol, connection/serial params, typical commands, response samples and desired page UI." },
  "request.toGithub": { zh: "去 GitHub 提交", en: "Submit on GitHub" },
  "request.template": { zh: "请求模板", en: "Request Template" },
  "request.templateContent": {
    zh: "设备名称：\n设备类型：\n传输方式（串口/WebSocket/MQTT 等）：\n默认连接参数：\n需要的页面控件：\n发送命令示例：\n回包示例：\n解析字段：\n安全注意事项：\n参考资料链接：",
    en: "Device Name:\nDevice Type:\nTransport (Serial/WebSocket/MQTT etc.):\nDefault Connection Params:\nRequired Page Controls:\nSend Command Examples:\nResponse Examples:\nParse Fields:\nSafety Notes:\nReference Links:"
  },
  "request.copyTemplate": { zh: "复制模板", en: "Copy Template" },

  // ===== 工作台 =====
  "workbench.monitorPanel": { zh: "监测面板", en: "Monitor Panel" },
  "workbench.chartSummary": { zh: "自动尝试从接收数据中提取数值并绘制最近 120 个采样点。", en: "Automatically extracts values from received data and plots the latest 120 sample points." },
  "workbench.pollStopped": { zh: "轮询已停止", en: "Polling stopped" },
  "workbench.polling": { zh: "轮询中", en: "Polling" },
  "workbench.startPolling": { zh: "开始轮询", en: "Start Polling" },
  "workbench.stopPolling": { zh: "停止轮询", en: "Stop Polling" },
  "workbench.clearChart": { zh: "清空曲线", en: "Clear Chart" },
  "workbench.chartAria": { zh: "实时曲线", en: "Real-time Chart" },
  "workbench.noData": { zh: "暂无数据", en: "No data" },
  "workbench.noSetpoint": { zh: "暂无设定", en: "No setpoint" },
  "workbench.setpointPreview": { zh: "设定预览", en: "Setpoint Preview" },
  "workbench.setpointPreviewAria": { zh: "设定预览曲线", en: "Setpoint Preview Chart" },
  "workbench.realtimeOutput": { zh: "实时输出", en: "Real-time Output" },
  "workbench.realtimeOutputAria": { zh: "实时输出曲线", en: "Real-time Output Chart" },
  "workbench.pollReadback": { zh: "轮询回读设备实际值", en: "Polling readback of actual device value" },
  "workbench.chartConfig": { zh: "曲线配置", en: "Chart Config" },
  "workbench.chartSummaryDefault": { zh: "—", en: "—" },
  "workbench.protocolHelp": { zh: "协议说明", en: "Protocol Help" },
  "workbench.aomasterDualMode": { zh: "双曲线模式：设定预览与轮询回读的实际输出；波形参数在设备页配置。", en: "Dual-chart mode: setpoint preview and polled actual output; waveform params configured on device page." },
  "workbench.showCurves": { zh: "显示曲线", en: "Show Curves" },
  "workbench.totalPoints": { zh: "曲线总点数", en: "Total Points" },
  "workbench.totalPointsTitle": { zh: "手动设置曲线总采样点数，点数越高历史越长", en: "Manually set total sample points; higher count means longer history" },
  "workbench.displayPoints": { zh: "显示点数", en: "Display Points" },
  "workbench.displayPointsTitle": { zh: "当前窗口显示点数，曲线可左右滑动查看总点数历史", en: "Displayed point count in the current window; scroll left/right to view full history" },
  "workbench.exportCsv": { zh: "导出 CSV", en: "Export CSV" },
  "workbench.loadCsv": { zh: "加载 CSV", en: "Load CSV" },
  "workbench.resetDefault": { zh: "恢复默认", en: "Reset Default" },
  "workbench.save": { zh: "保存", en: "Save" },
  "workbench.protocolHelpTitle": { zh: "协议说明", en: "Protocol Help" },
  "workbench.closeDialog": { zh: "关闭", en: "Close" },
  "workbench.transceiverDebug": { zh: "收发调试", en: "Transceiver Debug" },
  "workbench.transceiverDesc": { zh: "支持 ASCII 与 HEX，适合协议确认前做调试。", en: "Supports ASCII and HEX, suitable for debugging before protocol confirmation." },
  "workbench.clearLog": { zh: "清空日志", en: "Clear Log" },
  "workbench.format": { zh: "格式", en: "Format" },
  "workbench.lineEnding": { zh: "行尾", en: "Line Ending" },
  "workbench.command": { zh: "命令", en: "Command" },
  "workbench.commandPlaceholder": { zh: "例如：READ?、01 03 00 00 或 {\"cmd\":\"ping\"}", en: "e.g.: READ?, 01 03 00 00 or {\"cmd\":\"ping\"}" },
  "workbench.send": { zh: "发送", en: "Send" },

  // 曲线配置面板
  "curve.config": { zh: "曲线配置", en: "Chart Config" },
  "curve.protocolHelp": { zh: "协议说明", en: "Protocol Help" },
  "curve.curveOne": { zh: "曲线一", en: "Curve 1" },
  "curve.curveTwo": { zh: "曲线二", en: "Curve 2" },
  "curve.curveThree": { zh: "曲线三", en: "Curve 3" },
  "curve.curveFour": { zh: "曲线四", en: "Curve 4" },
  "curve.enableCurve": { zh: "启用曲线", en: "Enable Curve" },
  "curve.delete": { zh: "删除", en: "Delete" },
  "curve.deleteCurve": { zh: "删除曲线", en: "Delete Curve" },
  "curve.name": { zh: "曲线", en: "Curve" },
  "curve.nameField": { zh: "名称", en: "Name" },
  "curve.unit": { zh: "单位", en: "Unit" },
  "curve.unitPlaceholder": { zh: "可选", en: "Optional" },
  "curve.dataOffset": { zh: "数据偏移", en: "Data Offset" },
  "curve.byteOffset": { zh: "字节偏移", en: "Byte Offset" },
  "curve.dataType": { zh: "数据类型", en: "Data Type" },
  "curve.byteOrder": { zh: "字节序", en: "Byte Order" },
  "curve.scale": { zh: "比例", en: "Scale" },
  "curve.offset": { zh: "偏移", en: "Offset" },
  "curve.pathPlaceholder": { zh: "例如 value 或 data.temp", en: "e.g. value or data.temp" },
  "curve.addCurve": { zh: "+ 添加曲线", en: "+ Add Curve" },
  "curve.frameMode": { zh: "帧界模式", en: "Frame Mode" },
  "curve.frameModeNone": { zh: "无（整包）", en: "None (Full)" },
  "curve.frameModeLine": { zh: "行界（CR/LF）", en: "Line Delimited (CR/LF)" },
  "curve.frameModeStxEtx": { zh: "帧头帧尾（HEX）", en: "Delimiters (HEX)" },
  "curve.rxLineEnding": { zh: "行结束符", en: "Line Ending" },
  "curve.framePrefix": { zh: "帧头 HEX", en: "Frame Prefix (HEX)" },
  "curve.frameSuffix": { zh: "帧尾 HEX", en: "Frame Suffix (HEX)" },
  "curve.framePrefixPlaceholder": { zh: "例如 02（STX）", en: "e.g. 02 (STX)" },
  "curve.frameSuffixPlaceholder": { zh: "例如 03（ETX）", en: "e.g. 03 (ETX)" },
  "curve.crcCheck": { zh: "CRC 校验", en: "CRC Check" },
  "curve.crcNone": { zh: "无", en: "None" },
  "curve.crcModbus": { zh: "Modbus CRC16", en: "Modbus CRC16" },
  "curve.slaveId": { zh: "从站地址", en: "Slave ID" },
  "curve.functionCode": { zh: "功能码", en: "Function Code" },
  "curve.curveParser": { zh: "曲线解析", en: "Curve Parser" },
  "curve.parserJson": { zh: "JSON / 文本", en: "JSON / Text" },
  "curve.parserHex": { zh: "HEX 原始字节", en: "HEX Raw Bytes" },
  "curve.parserModbus": { zh: "Modbus RTU", en: "Modbus RTU" },
  "curve.parserSample": { zh: "解析样例", en: "Parser Sample" },
  "curve.testButton": { zh: "测试", en: "Test" },
  "curve.waitingTest": { zh: "等待测试", en: "Waiting for test" },
  "curve.singleChart": { zh: "单曲线", en: "Single Curve" },
  "curve.autoNumeric": { zh: "自动数字", en: "Auto Numeric" },
  "curve.multiCurve": { zh: "多曲线", en: "Multi Curve" },
  "curve.dataOffsetTitle": { zh: "相对读响应数据区首字节的偏移", en: "Byte offset relative to start of read response data area" },
  "curve.pathLabel": { zh: "路径", en: "Path" },

  // 曲线帮助
  "curve.help.title.aomaster": { zh: "AOMaster 曲线说明", en: "AOMaster Chart Guide" },
  "curve.help.title.modbus": { zh: "Modbus RTU 曲线说明", en: "Modbus RTU Chart Guide" },
  "curve.help.title.hart": { zh: "HART 曲线说明", en: "HART Chart Guide" },
  "curve.help.title.custom": { zh: "自定义串口设备曲线说明", en: "Custom Serial Device Chart Guide" },
  "curve.help.title.websocket": { zh: "WebSocket 曲线说明", en: "WebSocket Chart Guide" },
  "curve.help.title.mqtt": { zh: "MQTT 曲线说明", en: "MQTT Chart Guide" },
  "curve.help.title.default": { zh: "曲线说明", en: "Chart Guide" },
  "curve.help.defaultContent": { zh: "<p>当前设备会自动从接收数据中提取数值并绘制曲线。</p>", en: "<p>The current device automatically extracts values from received data and plots charts.</p>" },

  // ===== AOMaster =====
  "aomaster.signalOutput": { zh: "信号输出", en: "Signal Output" },
  "aomaster.signalType": { zh: "信号类型", en: "Signal Type" },
  "aomaster.outputWaveform": { zh: "输出波形", en: "Output Waveform" },
  "aomaster.waveform.constant": { zh: "恒定输出", en: "Constant" },
  "aomaster.waveform.step": { zh: "阶跃", en: "Step" },
  "aomaster.waveform.ramp": { zh: "斜坡", en: "Ramp" },
  "aomaster.waveform.square": { zh: "方波", en: "Square" },
  "aomaster.waveform.triangle": { zh: "三角波", en: "Triangle" },
  "aomaster.waveform.sine": { zh: "正弦波", en: "Sine" },
  "aomaster.value.unit": { zh: "单位", en: "Unit" },
  "aomaster.currentSetpoint": { zh: "电流设定", en: "Current Setpoint" },
  "aomaster.voltageSetpoint": { zh: "电压设定", en: "Voltage Setpoint" },
  "aomaster.preset.min": { zh: "最小", en: "Min" },
  "aomaster.preset.mid": { zh: "中点", en: "Mid" },
  "aomaster.preset.max": { zh: "最大", en: "Max" },
  "aomaster.waveLow": { zh: "低值", en: "Low" },
  "aomaster.waveHigh": { zh: "高值", en: "High" },
  "aomaster.wavePeriod": { zh: "周期/时长 (ms)", en: "Period (ms)" },
  "aomaster.waveDuty": { zh: "占空比 (%)", en: "Duty (%)" },
  "aomaster.wavePreset.full": { zh: "全量程", en: "Full Range" },
  "aomaster.wavePreset.mid": { zh: "中间段", en: "Mid Range" },
  "aomaster.wavePreset.narrow": { zh: "窄脉冲", en: "Narrow Pulse" },
  "aomaster.stepSequence": { zh: "阶跃序列", en: "Step Sequence" },
  "aomaster.stepSequenceDesc": { zh: "按顺序逐级跳变，每步保持相同时间", en: "Jump through levels in order, each step held for the same duration" },
  "aomaster.addStep": { zh: "添加阶跃点", en: "Add Step" },
  "aomaster.stepPreset.five": { zh: "五点均分", en: "5 Equal Points" },
  "aomaster.stepPreset.upDown": { zh: "上→下", en: "Up→Down" },
  "aomaster.stepPreset.pulse": { zh: "脉冲序列", en: "Pulse Sequence" },
  "aomaster.stepDwell": { zh: "单步保持 (ms)", en: "Step Dwell (ms)" },
  "aomaster.stepLoops": { zh: "循环次数", en: "Loop Count" },
  "aomaster.stepLoopsHint": { zh: "循环次数填 0 表示无限循环。", en: "Set loop count to 0 for infinite loop." },
  "aomaster.driverCmdPreview": { zh: "驱动命令预览", en: "Driver Command Preview" },
  "aomaster.sendSetting": { zh: "发送设定", en: "Send Setting" },
  "aomaster.commParams": { zh: "通讯参数", en: "Communication Params" },
  "aomaster.commDesc": { zh: "寄存器：0x0000 类型（0=电流，1=电压），0x0001 波形，0x0006 只读 ACTUAL；轮询读取 0x0000~0x0006 共 7 个寄存器，根据类型判断单位。阶跃时 0x0002 点数、0x0003 保持(ms)、0x0004 循环、0x0007+ 序列值。", en: "Registers: 0x0000 type (0=current, 1=voltage), 0x0001 waveform, 0x0006 read-only ACTUAL; polling reads 0x0000~0x0006 (7 registers) and uses type to select units. Step: 0x0002 count, 0x0003 dwell(ms), 0x0004 loops, 0x0007+ sequence." },
  "aomaster.slaveId": { zh: "从站地址", en: "Slave ID" },
  "aomaster.pollInterval": { zh: "回读轮询 (ms)", en: "Readback Poll (ms)" },
  "aomaster.pollIntervalTitle": { zh: "大于 0 时可在监测面板手动开始轮询，默认 50", en: "When > 0, polling can be manually started in the monitor panel; default 50" },
  "aomaster.profile.type": { zh: "模拟量信号发生器", en: "Analog Signal Generator" },
  "aomaster.mode.current": { zh: "电流", en: "Current" },
  "aomaster.mode.voltage": { zh: "电压", en: "Voltage" },

  // AOMaster 自定义仪表
  "aomaster.actualOutput": { zh: "实际输出", en: "Actual Output" },
  "aomaster.infiniteLoop": { zh: "无限循环", en: "Infinite Loop" },
  "aomaster.defaultNoPoll": { zh: "默认不轮询", en: "Default, no polling" },
  "aomaster.pollSummaryLabel": { zh: "轮询间隔", en: "Poll Interval" },

  // ===== Modbus =====
  "modbus.registerOps": { zh: "寄存器操作", en: "Register Operations" },
  "modbus.readHolding": { zh: "读保持寄存器", en: "Read Holding Registers" },
  "modbus.readInput": { zh: "读输入寄存器", en: "Read Input Registers" },
  "modbus.writeSingle": { zh: "写单寄存器", en: "Write Single Register" },
  "modbus.writeMultiple": { zh: "写多寄存器", en: "Write Multiple Registers" },
  "modbus.writeValue": { zh: "写入值", en: "Write Value" },
  "modbus.readRegister": { zh: "读取寄存器", en: "Read Register" },
  "modbus.writeRegister": { zh: "写入寄存器", en: "Write Register" },
  "modbus.commParams": { zh: "通讯参数", en: "Communication Params" },
  "modbus.commDesc": { zh: "配置从站、功能码、地址与轮询；曲线解码在监测面板配置。", en: "Configure slave, function code, address and polling; curve decoding configured in monitor panel." },
  "modbus.slaveId": { zh: "从站地址", en: "Slave ID" },
  "modbus.functionCode": { zh: "功能码", en: "Function Code" },
  "modbus.fc03": { zh: "03 读保持寄存器", en: "03 Read Holding Registers" },
  "modbus.fc04": { zh: "04 读输入寄存器", en: "04 Read Input Registers" },
  "modbus.fc06": { zh: "06 写单寄存器", en: "06 Write Single Register" },
  "modbus.fc16": { zh: "16 写多寄存器", en: "16 Write Multiple Registers" },
  "modbus.startAddr": { zh: "起始地址", en: "Start Address" },
  "modbus.quantity": { zh: "寄存器数量", en: "Register Count" },
  "modbus.quantityTitle": { zh: "读模式下若小于曲线所需范围，会自动扩大", en: "In read mode, auto-expands if less than required range for curves" },
  "modbus.pollInterval": { zh: "轮询间隔 (ms)", en: "Poll Interval (ms)" },
  "modbus.pollIntervalTitle": { zh: "读模式下大于 0 时可在监测面板手动开始轮询，默认 500", en: "When > 0 in read mode, polling can be manually started in monitor panel; default 500" },
  "modbus.profile.type": { zh: "RTU 寄存器读写", en: "RTU Register Read/Write" },
  "modbus.unsupportedFunction": { zh: "不支持的 Modbus 功能码", en: "Unsupported Modbus function code" },
  "modbus.operation": { zh: "操作", en: "Operation" },

  // HART
  "hart.variableRead": { zh: "变量读取", en: "Variable Reading" },
  "hart.deviceNotFound": { zh: "尚未搜索到设备", en: "Device not found" },
  "hart.deviceNotSearched": { zh: "设备：尚未搜索", en: "Device: Not searched" },
  "hart.hartlinkWaiting": { zh: "HARTLink：连接串口后自动探测版本", en: "HARTLink: Version is detected after serial connection" },
  "hart.hartlinkDetecting": { zh: "HARTLink：正在探测版本…", en: "HARTLink: Detecting version…" },
  "hart.hartlinkDetected": { zh: "HARTLink：{model} · 固件 {version}", en: "HARTLink: {model} · Firmware {version}" },
  "hart.hartlinkNotDetected": { zh: "HARTLink：未检测到版本响应（普通 HART 接口仍可使用）", en: "HARTLink: No version response (generic HART interfaces remain available)" },
  "hart.hartlinkProbeFailed": { zh: "HARTLink：版本探测发送失败", en: "HARTLink: Version probe could not be sent" },
  "hart.hartlinkDetectedLog": { zh: "检测到 {model}，固件 {version}", en: "Detected {model}, firmware {version}" },
  "hart.hartlinkNotDetectedLog": { zh: "未收到版本响应，可继续使用普通 HART 接口", en: "No version response; generic HART interfaces remain available" },
  "hart.primaryVariable": { zh: "Primary Variable", en: "Primary Variable" },
  "hart.secondaryVariable": { zh: "Secondary Variable", en: "Secondary Variable" },
  "hart.tertiaryVariable": { zh: "Tertiary Variable", en: "Tertiary Variable" },
  "hart.quaternaryVariable": { zh: "Quaternary Variable", en: "Quaternary Variable" },
  "hart.cmdResponse": { zh: "通用命令应答", en: "Command Response" },
  "hart.noResponse": { zh: "尚未收到应答", en: "No response yet" },
  "hart.searchDevice": { zh: "搜索设备", en: "Search Device" },
  "hart.scanAddresses": { zh: "扫描 0-15", en: "Scan 0-15" },
  "hart.scanning": { zh: "扫描中...", en: "Scanning..." },
  "hart.scanStarted": { zh: "开始扫描轮询地址 0-15", en: "Scanning poll addresses 0-15" },
  "hart.scanFound": { zh: "地址 {address} 发现设备", en: "Device found at address {address}" },
  "hart.scanNotFound": { zh: "地址 0-15 未发现设备", en: "No device found at addresses 0-15" },
  "hart.sendCommand": { zh: "发送命令", en: "Send Command" },
  "hart.commandPreview": { zh: "命令预览", en: "Command Preview" },
  "hart.advancedSettings": { zh: "高级设置", en: "Advanced Settings" },
  "hart.advancedSettingsDesc": { zh: "主站/前导码、PV 显示缩放和命令数据助手", en: "Master/preamble, PV display scaling and command data helper" },
  "hart.commParams": { zh: "通讯参数", en: "Communication Params" },
  "hart.commDesc": { zh: "支持预设 HART 命令或自定义命令号 + HEX 数据，帧 XOR 校验自动计算。", en: "Supports preset HART commands or custom command number + HEX data; XOR checksum auto-calculated." },
  "hart.pollAddress": { zh: "轮询地址", en: "Poll Address" },
  "hart.masterType": { zh: "主站类型", en: "Master Type" },
  "hart.preambleLen": { zh: "前导码", en: "Preamble" },
  "hart.pollInterval": { zh: "轮询间隔 (ms)", en: "Poll Interval (ms)" },
  "hart.pollIntervalTitle": { zh: "大于 0 时可在监测面板手动开始轮询，默认 1000", en: "When > 0, polling can be manually started in the monitor panel; default 1000" },
  "hart.commandMode": { zh: "命令方式", en: "Command Mode" },
  "hart.cmdPreset": { zh: "预设通用命令", en: "Preset Commands" },
  "hart.cmdCustom": { zh: "自定义命令", en: "Custom Command" },
  "hart.universalCmd": { zh: "通用命令", en: "Universal Command" },
  "hart.cmdNumber": { zh: "命令号", en: "Command Number" },
  "hart.cmdNumberTitle": { zh: "0–255，自动组帧并计算 XOR 校验", en: "0-255, auto-framed with XOR checksum" },
  "hart.cmdData": { zh: "命令数据 (HEX)", en: "Command Data (HEX)" },
  "hart.cmdDataPlaceholder": { zh: "可选；写命令或带参数读命令时填入，校验自动计算", en: "Optional; for write commands or parameterized reads; checksum auto-calculated" },
  "hart.dataHelper": { zh: "命令数据助手", en: "Command Data Helper" },
  "hart.dataHelperDesc": { zh: "按现场常用场景生成请求数据，仍可在 HEX 输入框中手工修改。", en: "Generate request data for common field tasks; you can still edit the HEX field manually." },
  "hart.helperTemplate": { zh: "模板", en: "Template" },
  "hart.helperText": { zh: "文本 / Tag", en: "Text / Tag" },
  "hart.helperDescriptor": { zh: "描述符", en: "Descriptor" },
  "hart.helperDate": { zh: "日期", en: "Date" },
  "hart.helperLoopMode": { zh: "Loop Mode Byte", en: "Loop Mode Byte" },
  "hart.applyTemplate": { zh: "生成命令数据", en: "Generate Data" },
  "hart.clearCommandData": { zh: "清空数据", en: "Clear Data" },
  "hart.templatePreview": { zh: "模板预览", en: "Template Preview" },
  "hart.template.cmd9": { zh: "Cmd 9 读 PV/SV/TV/QV + 状态", en: "Cmd 9 Read PV/SV/TV/QV + Status" },
  "hart.template.cmd33": { zh: "Cmd 33 读 PV/SV/TV/QV", en: "Cmd 33 Read PV/SV/TV/QV" },
  "hart.template.cmd6": { zh: "Cmd 6 写当前轮询地址", en: "Cmd 6 Write Current Poll Address" },
  "hart.template.cmd17": { zh: "Cmd 17 写设备消息", en: "Cmd 17 Write Message" },
  "hart.template.cmd18": { zh: "Cmd 18 写 Tag / 描述符 / 日期", en: "Cmd 18 Write Tag / Descriptor / Date" },
  "hart.template.cmd21": { zh: "Cmd 21 按长标签查设备", en: "Cmd 21 Find by Long Tag" },
  "hart.template.cmd22": { zh: "Cmd 22 写长标签", en: "Cmd 22 Write Long Tag" },
  "hart.template.cmd38": { zh: "Cmd 38 复位配置变更标志", en: "Cmd 38 Reset Config Changed Flag" },
  "hart.frameChecksum": { zh: "帧校验 (XOR)", en: "Frame Checksum (XOR)" },
  "hart.pollMode": { zh: "轮询方式", en: "Poll Mode" },
  "hart.pollPv": { zh: "轮询 PV (Cmd 1)", en: "Poll PV (Cmd 1)" },
  "hart.pollDynamic": { zh: "轮询 PV/SV/TV/QV (Cmd 3)", en: "Poll PV/SV/TV/QV (Cmd 3)" },
  "hart.pvDisplayName": { zh: "PV 显示名", en: "PV Display Name" },
  "hart.pvUnitOverride": { zh: "PV 单位覆盖", en: "PV Unit Override" },
  "hart.pvUnitPlaceholder": { zh: "留空则使用 HART 单位码", en: "Leave empty to use HART unit code" },
  "hart.pvScale": { zh: "PV 比例", en: "PV Scale" },
  "hart.pvOffset": { zh: "PV 偏移", en: "PV Offset" },
  "hart.profile.name": { zh: "HART 通用设备", en: "HART Universal Device" },
  "hart.profile.type": { zh: "HART 现场总线", en: "HART Fieldbus" },
  "hart.mode.deviceId": { zh: "设备标识", en: "Device ID" },
  "hart.searchFirst": { zh: "请先搜索设备（Cmd 0），再发送 Cmd 1+ 长地址帧", en: "Please search device first (Cmd 0), then send Cmd 1+ with long address frame" },
  "hart.neverSearched": { zh: "未搜索", en: "Not searched" },
  "hart.hartRev": { zh: "HART 修订", en: "HART Rev" },
  "hart.preambleCount": { zh: "前导码", en: "Preamble" },
  "hart.loopMode": { zh: "环路电流模式", en: "Loop Current Mode" },
  "hart.requestPreamble": { zh: "请求前导码", en: "Request Preamble" },
  "hart.classification": { zh: "分类", en: "Classification" },
  "hart.bytes": { zh: "字节", en: "bytes" },
  "hart.noData": { zh: "无数据", en: "No data" },
  "hart.command": { zh: "命令", en: "Command" },
  "hart.responseCode": { zh: "响应码", en: "Response Code" },
  "hart.deviceStatus": { zh: "设备状态", en: "Device Status" },
  "hart.configChangeCounter": { zh: "配置变更计数", en: "Config Change Counter" },
  "hart.extendedStatus": { zh: "扩展状态", en: "Extended Status" },
  "hart.lastDeviceVariable": { zh: "最后设备变量码", en: "Last Device Variable Code" },
  "hart.deviceVariable": { zh: "设备变量", en: "Device Variable" },
  "hart.variableStatus": { zh: "变量状态", en: "Variable Status" },
  "hart.timestamp": { zh: "时间戳", en: "Timestamp" },
  "hart.operatingMode": { zh: "运行模式", en: "Operating Mode" },
  "hart.standardizedStatus0": { zh: "标准状态 0", en: "Standardized Status 0" },
  "hart.standardizedStatus1": { zh: "标准状态 1", en: "Standardized Status 1" },
  "hart.standardizedStatus2": { zh: "标准状态 2", en: "Standardized Status 2" },
  "hart.standardizedStatus3": { zh: "标准状态 3", en: "Standardized Status 3" },
  "hart.analogChannelSaturated": { zh: "模拟通道饱和", en: "Analog Channel Saturated" },
  "hart.analogChannelFixed": { zh: "模拟通道固定", en: "Analog Channel Fixed" },

  // HART 命令标签
  "hart.cmd.0": { zh: "0 读设备标识", en: "0 Read Device ID" },
  "hart.cmd.1": { zh: "1 读主变量 (PV)", en: "1 Read Primary Variable (PV)" },
  "hart.cmd.2": { zh: "2 读环路电流 / 百分比", en: "2 Read Loop Current / Percent" },
  "hart.cmd.3": { zh: "3 读动态变量 (PV/SV/TV/QV)", en: "3 Read Dynamic Variables (PV/SV/TV/QV)" },
  "hart.cmd.6": { zh: "6 读轮询地址", en: "6 Read Poll Address" },
  "hart.cmd.7": { zh: "7 读环路配置", en: "7 Read Loop Config" },
  "hart.cmd.8": { zh: "8 读动态变量分类", en: "8 Read Dynamic Variable Classification" },
  "hart.cmd.9": { zh: "9 读带状态的设备变量", en: "9 Read Device Variables with Status" },
  "hart.cmd.11": { zh: "11 读标签 / 描述符 / 日期", en: "11 Read Tag / Descriptor / Date" },
  "hart.cmd.12": { zh: "12 读设备消息", en: "12 Read Device Message" },
  "hart.cmd.13": { zh: "13 读标签 / 描述符 / 日期", en: "13 Read Tag / Descriptor / Date" },
  "hart.cmd.14": { zh: "14 读传感器信息", en: "14 Read Sensor Info" },
  "hart.cmd.15": { zh: "15 读输出信息", en: "15 Read Output Info" },
  "hart.cmd.16": { zh: "16 读最终装配号", en: "16 Read Final Assembly Number" },
  "hart.cmd.17": { zh: "17 写设备消息", en: "17 Write Device Message" },
  "hart.cmd.18": { zh: "18 写标签 / 描述符 / 日期", en: "18 Write Tag / Descriptor / Date" },
  "hart.cmd.19": { zh: "19 写最终装配号", en: "19 Write Final Assembly Number" },
  "hart.cmd.20": { zh: "20 读长标签", en: "20 Read Long Tag" },
  "hart.cmd.21": { zh: "21 读长标签关联的设备标识", en: "21 Read Long Tag Device ID" },
  "hart.cmd.22": { zh: "22 写长标签", en: "22 Write Long Tag" },
  "hart.cmd.33": { zh: "33 读变送器变量", en: "33 Read Transmitter Variables" },
  "hart.cmd.34": { zh: "34 写阻尼值", en: "34 Write Damping Value" },
  "hart.cmd.35": { zh: "35 写主变量量程", en: "35 Write PV Range" },
  "hart.cmd.36": { zh: "36 设置主变量上限", en: "36 Set PV Upper Limit" },
  "hart.cmd.37": { zh: "37 设置主变量下限", en: "37 Set PV Lower Limit" },
  "hart.cmd.38": { zh: "38 复位配置变更标志", en: "38 Reset Config Change Flag" },
  "hart.cmd.39": { zh: "39 钳位主变量", en: "39 Clamp PV" },
  "hart.cmd.40": { zh: "40 写 PV 传感器信息", en: "40 Write PV Sensor Info" },
  "hart.cmd.41": { zh: "41 写轮询地址", en: "41 Write Poll Address" },
  "hart.cmd.43": { zh: "43 设置 PV 零点", en: "43 Set PV Zero" },
  "hart.cmd.44": { zh: "44 写环路电流模式", en: "44 Write Loop Current Mode" },
  "hart.cmd.45": { zh: "45 写 PV 单位", en: "45 Write PV Unit" },
  "hart.cmd.46": { zh: "46 校准环路电流零点", en: "46 Calibrate Loop Current Zero" },
  "hart.cmd.47": { zh: "47 校准环路电流增益", en: "47 Calibrate Loop Current Gain" },
  "hart.cmd.48": { zh: "48 读附加设备状态", en: "48 Read Additional Device Status" },
  "hart.cmd.49": { zh: "49 写 PV 传感器序列号", en: "49 Write PV Sensor Serial Number" },

  // HART 解析中文
  "hart.loopCurrent": { zh: "环路电流", en: "Loop Current" },
  "hart.percentRange": { zh: "量程百分比", en: "Percent Range" },
  "hart.emptyMsg": { zh: "(空消息)", en: "(Empty message)" },
  "hart.emptyLongTag": { zh: "(空长标签)", en: "(Empty long tag)" },
  "hart.manufacturer": { zh: "制造商", en: "Manufacturer" },
  "hart.deviceType": { zh: "设备类型", en: "Device Type" },
  "hart.deviceId": { zh: "设备 ID", en: "Device ID" },
  "hart.hartRevision": { zh: "HART 修订", en: "HART Revision" },
  "hart.tag": { zh: "标签", en: "Tag" },
  "hart.descriptor": { zh: "描述符", en: "Descriptor" },
  "hart.date": { zh: "日期", en: "Date" },
  "hart.upperRange": { zh: "上限", en: "Upper" },
  "hart.lowerRange": { zh: "下限", en: "Lower" },
  "hart.minSpan": { zh: "最小量程", en: "Min Span" },
  "hart.alarm": { zh: "报警", en: "Alarm" },
  "hart.transferFunc": { zh: "传递函数", en: "Transfer Function" },
  "hart.upperRangeLimit": { zh: "上限量程", en: "Upper Range" },
  "hart.lowerRangeLimit": { zh: "下限量程", en: "Lower Range" },
  "hart.damping": { zh: "阻尼", en: "Damping" },
  "hart.assemblyNumber": { zh: "装配号", en: "Assembly No." },
  "hart.additionalStatus": { zh: "附加状态", en: "Additional Status" },
  "hart.status.deviceMalfunction": { zh: "设备故障", en: "Device Malfunction" },
  "hart.status.configChanged": { zh: "配置已变更", en: "Configuration Changed" },
  "hart.status.coldStart": { zh: "冷启动", en: "Cold Start" },
  "hart.status.moreStatus": { zh: "有更多状态(Cmd 48)", en: "More Status Available (Cmd 48)" },
  "hart.status.loopFixed": { zh: "环路电流固定", en: "Loop Current Fixed" },
  "hart.status.loopSaturated": { zh: "环路电流饱和", en: "Loop Current Saturated" },
  "hart.status.nonPvOutOfLimits": { zh: "非主变量越限", en: "Non-PV Out of Limits" },
  "hart.status.pvOutOfLimits": { zh: "主变量越限", en: "PV Out of Limits" },
  "hart.commStatus.verticalParity": { zh: "垂直奇偶校验错误", en: "Vertical Parity Error" },
  "hart.commStatus.overrun": { zh: "串口溢出", en: "Overrun Error" },
  "hart.commStatus.framing": { zh: "帧错误", en: "Framing Error" },
  "hart.commStatus.checksum": { zh: "纵向校验错误", en: "Longitudinal Parity Error" },
  "hart.commStatus.communicationFailure": { zh: "通信失败", en: "Communication Failure" },
  "hart.commStatus.bufferOverflow": { zh: "缓冲区溢出", en: "Buffer Overflow" },
  "hart.response.success": { zh: "成功", en: "Success" },
  "hart.response.communicationError": { zh: "通信错误", en: "Communication Error" },
  "hart.response.undefined": { zh: "未定义/命令特定响应", en: "Undefined / Command-specific Response" },
  "hart.response.tooFewBytes": { zh: "数据字节不足", en: "Too Few Data Bytes" },
  "hart.response.deviceSpecificError": { zh: "设备特定命令错误", en: "Device-specific Command Error" },
  "hart.response.writeProtect": { zh: "写保护", en: "In Write Protect Mode" },
  "hart.response.warning": { zh: "警告", en: "Warning" },
  "hart.response.accessRestricted": { zh: "访问受限", en: "Access Restricted" },
  "hart.response.busy": { zh: "设备忙", en: "Busy" },
  "hart.response.invalidPollAddress": { zh: "轮询地址无效", en: "Invalid Poll Address" },
  "hart.response.invalidSelection": { zh: "选择无效", en: "Invalid Selection" },
  "hart.response.invalidDate": { zh: "日期码无效", en: "Invalid Date Code" },
  "hart.response.tagMismatch": { zh: "标签不匹配", en: "Tag Mismatch" },
  "hart.response.configCounterMismatch": { zh: "配置变更计数不匹配", en: "Config Counter Mismatch" },
  "hart.response.updateInProgress": { zh: "状态更新中", en: "Update in Progress" },
  "hart.response.statusBytesMismatch": { zh: "状态字节不匹配", en: "Status Bytes Mismatch" },

  // ===== MQTT =====
  "mqtt.title": { zh: "MQTT 调试", en: "MQTT Debug" },
  "mqtt.desc": { zh: "连接 MQTT Broker，发布/订阅主题并解析 JSON 回包。", en: "Connect to MQTT Broker, publish/subscribe topics and parse JSON responses." },
  "mqtt.quickPublish": { zh: "快捷发布", en: "Quick Publish" },
  "mqtt.quickPublishDesc": { zh: "可直接发布，也可填入下方收发调试区后再编辑", en: "Can publish directly or fill into the transceiver debug area below for editing" },
  "mqtt.rxCount": { zh: "已接收", en: "Received" },
  "mqtt.txCount": { zh: "已发送", en: "Sent" },
  "mqtt.subscribeTopic": { zh: "订阅主题", en: "Subscribe Topic" },
  "mqtt.publishTopic": { zh: "发布主题", en: "Publish Topic" },
  "mqtt.publishOptions": { zh: "发布选项", en: "Publish Options" },
  "mqtt.publishConfig": { zh: "发布配置", en: "Publish Config" },
  "mqtt.publishConfigDesc": { zh: "覆盖侧栏默认发布主题，设置 QoS 与保留标志。", en: "Override sidebar default publish topic; set QoS and retain flag." },
  "mqtt.publishTopicField": { zh: "发布主题", en: "Publish Topic" },
  "mqtt.publishTopicPlaceholder": { zh: "留空使用侧栏「发布主题」", en: "Leave empty to use sidebar publish topic" },
  "mqtt.qos0": { zh: "0 - 最多一次", en: "0 - At most once" },
  "mqtt.qos1": { zh: "1 - 至少一次", en: "1 - At least once" },
  "mqtt.qos2": { zh: "2 - 仅一次", en: "2 - Exactly once" },
  "mqtt.retain": { zh: "保留消息", en: "Retain" },
  "mqtt.publishTarget": { zh: "发布目标", en: "Publish Target" },
  "mqtt.debugConfig": { zh: "调试配置", en: "Debug Config" },
  "mqtt.debugConfigDesc": { zh: "轮询消息与发布选项；曲线解析在监测面板配置。", en: "Polling message and publish options; curve parsing configured in monitor panel." },
  "mqtt.pollInterval": { zh: "轮询间隔 (ms)", en: "Poll Interval (ms)" },
  "mqtt.pollFormat": { zh: "轮询格式", en: "Poll Format" },
  "mqtt.pollMessage": { zh: "轮询消息", en: "Poll Message" },
  "mqtt.pollPreview": { zh: "轮询预览", en: "Poll Preview" },
  "mqtt.fillSend": { zh: "填入发送框", en: "Fill to Send" },
  "mqtt.profile.name": { zh: "MQTT 调试", en: "MQTT Debug" },
  "mqtt.profile.type": { zh: "MQTT 消息调试", en: "MQTT Message Debug" },
  "mqtt.noPollMsg": { zh: "未配置轮询消息", en: "No polling message configured" },

  // ===== WebSocket =====
  "ws.title": { zh: "WebSocket 调试", en: "WebSocket Debug" },
  "ws.desc": { zh: "连接 WebSocket 服务，快捷发送 JSON/文本并解析回包。", en: "Connect to WebSocket service, quick-send JSON/text and parse responses." },
  "ws.quickSend": { zh: "快捷发送", en: "Quick Send" },
  "ws.quickSendDesc": { zh: "可直接发送，也可填入下方收发调试区后再编辑", en: "Can send directly or fill into the transceiver debug area below for editing" },
  "ws.rxCount": { zh: "已接收", en: "Received" },
  "ws.txCount": { zh: "已发送", en: "Sent" },
  "ws.endpoint": { zh: "连接地址", en: "Endpoint" },
  "ws.debugConfig": { zh: "调试配置", en: "Debug Config" },
  "ws.debugConfigDesc": { zh: "轮询消息；曲线解析在监测面板配置。", en: "Polling message; curve parsing configured in monitor panel." },
  "ws.pollInterval": { zh: "轮询间隔 (ms)", en: "Poll Interval (ms)" },
  "ws.pollFormat": { zh: "轮询格式", en: "Poll Format" },
  "ws.pollMessage": { zh: "轮询消息", en: "Poll Message" },
  "ws.pollPreview": { zh: "轮询预览", en: "Poll Preview" },
  "ws.fillSend": { zh: "填入发送框", en: "Fill to Send" },
  "ws.profile.name": { zh: "WebSocket 调试", en: "WebSocket Debug" },
  "ws.profile.type": { zh: "WebSocket 消息调试", en: "WebSocket Message Debug" },
  "ws.noPollMsg": { zh: "未配置轮询消息", en: "No polling message configured" },

  // ===== 自定义设备 =====
  "custom.setpointOutput": { zh: "设定输出", en: "Setpoint Output" },
  "custom.setpointValue": { zh: "设定值", en: "Setpoint Value" },
  "custom.profile.type": { zh: "自定义串口设备", en: "Custom Serial Device" },
  "custom.customProfile.name": { zh: "自定义串口设备", en: "Custom Serial Device" },
  "custom.customProfile.desc": { zh: "自定义串口设备模板可发送", en: "Custom serial device template ready to send" },
  "custom.templateSendable": { zh: "模板可发送", en: "Template Ready" },
  "custom.deviceConfig": { zh: "设备配置", en: "Device Config" },
  "custom.deviceConfigDesc": { zh: "设定范围与发送模板；曲线解析、帧界与 CRC 在监测面板配置。", en: "Setpoint range and send template; curve parsing, framing and CRC configured in monitor panel." },
  "custom.deviceName": { zh: "设备名称", en: "Device Name" },
  "custom.deviceType": { zh: "设备类型", en: "Device Type" },
  "custom.channelName": { zh: "通道名称", en: "Channel Name" },
  "custom.unit": { zh: "单位", en: "Unit" },
  "custom.unitPlaceholder": { zh: "例如：mA、V、℃", en: "e.g.: mA, V, ℃" },
  "custom.min": { zh: "最小值", en: "Min" },
  "custom.max": { zh: "最大值", en: "Max" },
  "custom.step": { zh: "步进", en: "Step" },
  "custom.defaultValue": { zh: "默认值", en: "Default Value" },
  "custom.sendTemplate": { zh: "发送模板", en: "Send Template" },
  "custom.templatePlaceholder": { zh: "支持 {value}、{value:2}、{unit}、{mode}", en: "Supports {value}, {value:2}, {unit}, {mode}" },
  "custom.format": { zh: "格式", en: "Format" },
  "custom.lineEnding": { zh: "行尾", en: "Line Ending" },
  "custom.template": { zh: "模板", en: "Template" },

  // ===== 传输层 =====
  "transport.serial.label": { zh: "串口 (Web Serial)", en: "Serial (Web Serial)" },
  "transport.serial.baudRate": { zh: "波特率", en: "Baud Rate" },
  "transport.serial.dataBits": { zh: "数据位", en: "Data Bits" },
  "transport.serial.stopBits": { zh: "停止位", en: "Stop Bits" },
  "transport.serial.parity": { zh: "校验", en: "Parity" },
  "transport.serial.flowControl": { zh: "流控", en: "Flow Control" },
  "transport.serial.notSupported": { zh: "当前浏览器不支持 Web Serial，请使用 Chrome 或 Edge 的 HTTPS 页面。", en: "Web Serial is not supported by your browser. Please use Chrome or Edge with HTTPS." },
  "transport.serial.notConnected": { zh: "连接未建立", en: "Connection not established" },

  "transport.mqtt.label": { zh: "MQTT (WebSocket)", en: "MQTT (WebSocket)" },
  "transport.mqtt.brokerUrl": { zh: "Broker 地址", en: "Broker URL" },
  "transport.mqtt.clientId": { zh: "Client ID", en: "Client ID" },
  "transport.mqtt.subscribeTopic": { zh: "订阅主题", en: "Subscribe Topic" },
  "transport.mqtt.publishTopic": { zh: "发布主题", en: "Publish Topic" },
  "transport.mqtt.username": { zh: "用户名", en: "Username" },
  "transport.mqtt.password": { zh: "密码", en: "Password" },
  "transport.mqtt.noBroker": { zh: "请填写 MQTT Broker 地址", en: "Please enter MQTT Broker URL" },
  "transport.mqtt.invalidBroker": { zh: "MQTT Broker 地址格式无效", en: "Invalid MQTT Broker URL format" },
  "transport.mqtt.mustUseWs": { zh: "浏览器端 MQTT 须使用 ws:// 或 wss:// Broker 地址", en: "Browser MQTT must use ws:// or wss:// Broker URL" },
  "transport.mqtt.notSupported": { zh: "当前浏览器不支持 WebSocket，无法使用 MQTT。", en: "WebSocket not supported; MQTT unavailable." },
  "transport.mqtt.subscribeFailed": { zh: "MQTT 订阅失败", en: "MQTT subscription failed" },
  "transport.mqtt.publishFailed": { zh: "MQTT 发布失败", en: "MQTT publish failed" },
  "transport.mqtt.cannotConnect": { zh: "无法连接 MQTT Broker", en: "Cannot connect to MQTT Broker" },
  "transport.mqtt.wsWarning": { zh: "HTTPS 下远程 ws:// Broker 可能被浏览器拦截，可改用 wss://", en: "Remote ws:// Broker may be blocked on HTTPS; switch to wss://" },
  "transport.mqtt.pleaseProvide": { zh: "请填写{label}", en: "Please provide {label}" },

  "transport.ws.label": { zh: "WebSocket", en: "WebSocket" },
  "transport.ws.url": { zh: "地址", en: "URL" },
  "transport.ws.noUrl": { zh: "请填写 WebSocket 地址", en: "Please enter WebSocket URL" },
  "transport.ws.invalidUrl": { zh: "WebSocket 地址格式无效", en: "Invalid WebSocket URL format" },
  "transport.ws.mustStartWith": { zh: "WebSocket 地址必须以 ws:// 或 wss:// 开头", en: "WebSocket URL must start with ws:// or wss://" },
  "transport.ws.notSupported": { zh: "当前浏览器不支持 WebSocket。", en: "WebSocket not supported by your browser." },
  "transport.ws.cannotConnect": { zh: "无法连接 WebSocket", en: "Cannot connect WebSocket" },
  "transport.ws.connectFailed": { zh: "WebSocket 连接失败", en: "WebSocket connection failed" },
  "transport.ws.commError": { zh: "WebSocket 通信错误", en: "WebSocket communication error" },
  "transport.ws.wsWarning": { zh: "HTTPS 下远程 ws:// 可能被浏览器拦截，可改用 wss://", en: "Remote ws:// may be blocked on HTTPS; switch to wss://" },

  // ===== 协议 / 命令 =====
  "protocol.noDeviceDriver": { zh: "未选择可发送的设备驱动", en: "No sendable device driver selected" },
  "protocol.jsonNotEmpty": { zh: "JSON 命令不能为空", en: "JSON command cannot be empty" },
  "protocol.jsonInvalid": { zh: "JSON 格式无效", en: "Invalid JSON format" },
  "protocol.hexNotEmpty": { zh: "HEX 命令不能为空", en: "HEX command cannot be empty" },
  "protocol.hexByteInvalid": { zh: "HEX 字节无效", en: "Invalid HEX byte" },
  "protocol.jsonMsgNotEmpty": { zh: "JSON 消息不能为空", en: "JSON message cannot be empty" },

  // ===== 页面加载 =====
  "pageLoader.cannotLoad": { zh: "无法加载页面片段", en: "Cannot load page fragment" },
  "pageLoader.noMount": { zh: "页面挂载点不存在", en: "Page mount point does not exist" },
  "pageLoader.bootError": { zh: "页面加载失败", en: "Page load failed" },

  // ===== 应用启动 =====
  "app.bootFailed": { zh: "应用启动失败", en: "Application startup failed" },
  "app.bootError": { zh: "页面加载失败", en: "Page load failed" },
  "app.ready": { zh: " 已就绪，当前设备：", en: " ready, current device: " },

  // 语言切换
  "lang.switch": { zh: "EN", en: "中文" },
  "lang.switchTarget": { zh: "EN", en: "中" },

  // ===== 图表相关 (app.js) =====
  "chart.realTimeChart": { zh: "实时曲线", en: "Real-time Chart" },
  "chart.setpointPreview": { zh: "设定预览", en: "Setpoint Preview" },
  "chart.realTimeOutput": { zh: "实时输出", en: "Real-time Output" },
  "chart.hartVariableChart": { zh: "HART 变量曲线", en: "HART Variable Chart" },
  "chart.emptyText": { zh: "连接设备并开启轮询后显示实时曲线", en: "Connect device and start polling to see real-time chart" },
  "chart.emptySetpoint": { zh: "调整设定值以预览曲线", en: "Adjust setpoint to preview chart" },
  "chart.emptyActual": { zh: "连接设备并开启轮询后显示实时输出", en: "Connect device and start polling to see actual output" },
  "chart.emptyWs": { zh: "连接设备并接收 WebSocket 消息后显示多曲线", en: "Connect device and receive WebSocket messages to see multi-curve" },
  "chart.emptySerial": { zh: "连接设备并接收串口数据后显示多曲线", en: "Connect device and receive serial data to see multi-curve" },
  "chart.emptyModbus": { zh: "连接设备并开始轮询后显示多曲线", en: "Connect device and start polling to see multi-curve" },
  "chart.emptyMqtt": { zh: "连接设备并接收 MQTT 消息后显示多曲线", en: "Connect device and receive MQTT messages to see multi-curve" },
  "chart.aomasterDual": { zh: "AOMaster 双曲线", en: "AOMaster Dual Chart" },
  "chart.hartVar": { zh: "HART 变量曲线", en: "HART Variable Chart" },
  "chart.modbusChart": { zh: "Modbus 多曲线", en: "Modbus Multi-Curve" },
  "chart.wsChart": { zh: "WebSocket 多曲线", en: "WebSocket Multi-Curve" },
  "chart.serialChart": { zh: "串口多曲线", en: "Serial Multi-Curve" },
  "chart.mqttChart": { zh: "MQTT 多曲线", en: "MQTT Multi-Curve" },
  "chart.hartMultiChart": { zh: "HART 变量曲线", en: "HART Variable Chart" },
  "chart.moduleLoadFailed": { zh: "图表模块加载失败：", en: "Chart module load failed: " },
  "chart.noData": { zh: "暂无数据", en: "No data" },
  "chart.notSelected": { zh: "未选择变量", en: "No variable selected" },
  "chart.csvExport": { zh: "CSV 已导出", en: "CSV exported" },
  "chart.csvNeedCols": { zh: "CSV 至少需要一列索引和一列数据", en: "CSV needs at least an index column and a data column" },
  "chart.csvLoaded": { zh: "已加载", en: "Loaded" },
  "chart.csvLoadedMsg": { zh: " 已加载", en: " loaded" },
  "chart.singleCurve": { zh: "单曲线", en: "Single Curve" },
  "chart.dualCurve": { zh: "双曲线 · 设定预览 + 实时输出", en: "Dual Chart · Setpoint Preview + Actual Output" },
  "chart.registryValue": { zh: "寄存器值", en: "Register Value" },
  "chart.hexRaw": { zh: "单曲线 · HEX 原始字节", en: "Single Curve · HEX Raw Bytes" },
  "chart.modbusPayload": { zh: "单曲线 · Modbus RTU 载荷", en: "Single Curve · Modbus RTU Payload" },
  "chart.multiCurveCount": { zh: "{count} 条 {mode} 曲线", en: "{count} {mode} curves" },
  "chart.modbusCurveCount": { zh: "{count} 条 Modbus 曲线", en: "{count} Modbus curves" },
  "chart.aomasterDesc": { zh: "ECharts 曲线预览设定波形，并跟踪轮询回读的实际输出；保留 {total} 个采样点，当前显示 {visible} 个。", en: "ECharts charts preview set waveform and track actual polled output; {total} sample points retained, {visible} displayed." },
  "chart.hartDesc": { zh: "HART PV/SV/TV/QV 卡片与多曲线同步显示；保留 {total} 个采样点，当前显示 {visible} 个。", en: "HART PV/SV/TV/QV cards and multi-curve sync; {total} sample points retained, {visible} displayed." },
  "chart.modbusMultiDesc": { zh: "Modbus 多曲线；保留 {total} 个采样点，当前显示 {visible} 个。", en: "Modbus multi-curve; {total} sample points retained, {visible} displayed." },
  "chart.modbusSingleDesc": { zh: "Modbus 读回包自动解析寄存器数值；保留 {total} 个采样点，当前显示 {visible} 个。", en: "Modbus auto-parses register values from response; {total} sample points retained, {visible} displayed." },
  "chart.wsMultiDesc": { zh: "WebSocket 多曲线（JSON / HEX / Modbus）；保留 {total} 个采样点，当前显示 {visible} 个。", en: "WebSocket multi-curve (JSON / HEX / Modbus); {total} sample points retained, {visible} displayed." },
  "chart.wsSingleDesc": { zh: "WebSocket 回包自动解析 JSON、HEX 或 Modbus 数值；保留 {total} 个采样点，当前显示 {visible} 个。", en: "WebSocket auto-parses JSON, HEX or Modbus values from response; {total} sample points retained, {visible} displayed." },
  "chart.mqttMultiDesc": { zh: "MQTT 多曲线（JSON / HEX / Modbus）；保留 {total} 个采样点，当前显示 {visible} 个。", en: "MQTT multi-curve (JSON / HEX / Modbus); {total} sample points retained, {visible} displayed." },
  "chart.mqttSingleDesc": { zh: "MQTT 订阅消息自动解析数值；保留 {total} 个采样点，当前显示 {visible} 个。", en: "MQTT subscription messages auto-parse values; {total} sample points retained, {visible} displayed." },
  "chart.customMultiDesc": { zh: "自定义串口多曲线（JSON / HEX / Modbus）；保留 {total} 个采样点，当前显示 {visible} 个。", en: "Custom serial multi-curve (JSON / HEX / Modbus); {total} sample points retained, {visible} displayed." },
  "chart.customSingleDesc": { zh: "自定义串口回包自动解析数值；保留 {total} 个采样点，当前显示 {visible} 个。", en: "Custom serial auto-parses values from response; {total} sample points retained, {visible} displayed." },
  "chart.defaultDesc": { zh: "ECharts 曲线自动解析设备回读数值；保留 {total} 个采样点，当前显示 {visible} 个。", en: "ECharts chart auto-parses device readback values; {total} sample points retained, {visible} displayed." },

  // 首页设备卡片描述
  "home.card.aomaster": { zh: "阶跃/斜坡/方波等波形输出，双曲线预览，监测面板可手动轮询回读。", en: "Step, ramp, square and other waveform outputs; dual chart preview; manual polling readback in monitor panel." },
  "home.card.modbus": { zh: "RTU 寄存器读写，支持轮询读取与曲线显示。", en: "RTU register read/write with polling read and curve display." },
  "home.card.hart": { zh: "通用命令读写，PV/SV/TV/QV 轮询与多曲线，完整 HART 上位机调试。", en: "Universal command read/write, PV/SV/TV/QV polling and multi-curve, full HART host debugging." },
  "home.card.websocket": { zh: "WebSocket 连接调试，快捷 JSON/文本发送与回包解析。", en: "WebSocket connection debug, quick JSON/text send and response parsing." },
  "home.card.mqtt": { zh: "MQTT Broker 连接调试，发布/订阅消息与 JSON 回包解析。", en: "MQTT Broker connection debug, publish/subscribe messages and JSON response parsing." },
  "home.card.custom": { zh: "模板发送 / JSON·HEX·Modbus 解析", en: "Template send / JSON·HEX·Modbus parsing" },
  "home.microscopePowerCardDesc": { zh: "RP2040 WebUSB 小电流波形采集上位机，支持高速曲线、游标、校准与 CSV/PNG 导出。", en: "RP2040 WebUSB small-current waveform host with high-speed charts, cursors, calibration and CSV/PNG export." },

  // MicroScope Power
  "microscopePower.title": { zh: "MicroScope Power 上位机", en: "MicroScope Power Host" },
  "microscopePower.desc": { zh: "RP2040 WebUSB 电流波形采集、曲线查看、游标测量、校准与导出。", en: "RP2040 WebUSB current waveform acquisition, chart view, cursor measurement, calibration and export." },
  "microscopePower.openStandalone": { zh: "独立打开", en: "Open Standalone" },
  "microscopePower.profile.type": { zh: "WebUSB 电流波形采集", en: "WebUSB Current Waveform Capture" },

  // 日志曲线格式
  "log.curveLoaded": { zh: "{name} 已加载：{series} 条曲线，共 {points} 点", en: "{name} loaded: {series} curves, {points} points total" },
  "log.curveValueRange": { zh: "{name} {value} · 共 {points} 点", en: "{name} {value} · {points} points total" },
  "log.curvePointCount": { zh: "已加载 {points} 点", en: "{points} points loaded" },

  // ===== 调试曲线 =====
  "debugCurve.modbusNote": { zh: "读模式下从 RTU 回包<strong>数据区</strong>按字节偏移解码；从站、功能码、起始地址与寄存器数量在设备页配置。启用多条曲线时，会自动扩大读取寄存器数量以覆盖最远偏移。", en: "In read mode, decode by byte offset from RTU response <strong>data area</strong>; slave ID, function code, start address and register count configured on device page. Multiple curves auto-expand read count to cover farthest offset." },
  "debugCurve.modbusTitle": { zh: "Modbus 曲线", en: "Modbus Curve" },
  "debugCurve.modbusHint": { zh: "同一读响应内最多 4 条曲线，偏移 0 为数据区首字节", en: "Up to 4 curves per read response; offset 0 = first byte of data area" },
  "debugCurve.jsonTitle": { zh: "JSON 曲线", en: "JSON Curve" },
  "debugCurve.jsonHint": { zh: "支持 data.temp、metrics.0.value 这类路径", en: "Supports paths like data.temp, metrics.0.value" },
  "debugCurve.rtuSampleHint": { zh: "完整 RTU 帧 HEX", en: "Full RTU Frame HEX" },

  // 通用按钮
  "common.save": { zh: "保存", en: "Save" },
  "common.resetDefault": { zh: "恢复默认", en: "Reset Default" },
  "common.sendSetting": { zh: "发送设定", en: "Send Setting" },
  "common.close": { zh: "关闭", en: "Close" },
  "common.none": { zh: "无", en: "None" },

  // 模版消息
  "msg.helloJson": { zh: "Hello JSON", en: "Hello JSON" },
  "msg.ping": { zh: "Ping", en: "Ping" },
  "msg.sensor": { zh: "传感器", en: "Sensor" },
  "msg.testText": { zh: "测试文本", en: "Test Text" },
  "msg.pingJson": { zh: "Ping JSON", en: "Ping JSON" },
  "msg.hello": { zh: "Hello", en: "Hello" },
  "msg.timestamp": { zh: "时间戳", en: "Timestamp" },

  // 连接摘要
  "conn.manualMode": { zh: "手动收发", en: "Manual" },
  "conn.sidebarTopic": { zh: "侧栏发布主题", en: "Sidebar Publish Topic" },

  // 数字格式
  "num.times": { zh: "次", en: " times" },
  "num.points": { zh: "点", en: " points" },
  "num.msStep": { zh: " ms/步", en: " ms/step" },
  "num.pointCount": { zh: "点", en: " points" },
  "num.curves": { zh: "条", en: " " },

  // ===== 连接摘要 =====
  "conn.mqttConnected": { zh: "MQTT 已连接", en: "MQTT Connected" },
  "conn.wsConnected": { zh: "WebSocket 已连接", en: "WebSocket Connected" },
  "conn.serialConnected": { zh: "串口已连接", en: "Serial Connected" },
  "conn.connected": { zh: " 已连接", en: " Connected" },
  "conn.subscribed": { zh: " 订阅 ", en: " subscribed " },

  // ===== 通用 配置保存/恢复 =====
  "common.configSaved": { zh: " 配置已保存", en: " config saved" },
  "common.configReset": { zh: " 配置已恢复默认", en: " config reset to default" },
  "common.configSavedShort": { zh: "配置已保存", en: "Config saved" },
  "common.configResetShort": { zh: "配置已恢复默认", en: "Config reset to default" },
  "common.copied": { zh: "已复制", en: "Copied" },
  "common.copyFailed": { zh: "复制失败，请手动选择模板文本", en: "Copy failed, please manually select template text" },
  "common.noDriverCmd": { zh: "当前设备没有可发送的驱动命令", en: "No sendable driver command for current device" },
  "common.cmdNotEmpty": { zh: "命令不能为空", en: "Command cannot be empty" },
  "common.sendPollMsg": { zh: "发送轮询消息", en: "Send Poll Message" },
  "common.noConfig": { zh: "请配置轮询消息", en: "Please configure poll message" },
  "common.connectFirst.ws": { zh: "请先连接 WebSocket", en: "Please connect WebSocket first" },
  "common.connectFirst.mqtt": { zh: "请先连接 MQTT", en: "Please connect MQTT first" },
  "common.notConfigured": { zh: "未配置发布主题", en: "Publish topic not configured" },
  "common.fill": { zh: "填入", en: "Fill" },

  // ===== 轮询 =====
  "poll.notConnected": { zh: "未连接", en: "Not Connected" },
  "poll.notSupported": { zh: "当前设备不支持轮询", en: "Current device does not support polling" },
  "poll.needReadMode": { zh: "读模式方可轮询", en: "Read mode required for polling" },
  "poll.needSearchFirst": { zh: "请先搜索设备", en: "Please search device first" },
  "poll.needIntervalMsg": { zh: "请配置轮询间隔与消息", en: "Please configure poll interval and message" },
  "poll.needInterval": { zh: "请设置轮询间隔", en: "Please set poll interval" },
  "poll.category": { zh: "轮询", en: "Poll" },
  "poll.started": { zh: "轮询", en: "Poll" },
  "poll.startedMsg": { zh: "已开始，间隔 {interval} ms", en: "Started, interval {interval} ms" },
  "poll.startedPrefix": { zh: "已开始，间隔", en: "Started, interval " },
  "poll.stopped": { zh: "已停止", en: "Stopped" },

  // ===== 图表扩展 =====
  "chart.latest": { zh: "最新 {value} · 共 {points} 点", en: "Latest {value} · {points} points total" },
  "chart.notParsed": { zh: "未解析到数值", en: "No value parsed" },
  "chart.scaleConfigSaved": { zh: "曲线缩放配置已保存", en: "Chart scale config saved" },
  "chart.scaleConfigReset": { zh: "曲线缩放配置已恢复默认", en: "Chart scale config reset to default" },
  "chart.setpointPrefix": { zh: "设定", en: "Setpoint" },
  "chart.setpointValue": { zh: "设定 {value}", en: "Setpoint {value}" },
  "chart.stepLabel": { zh: "阶跃", en: "Step" },
  "chart.stepPreview": { zh: "阶跃 {seq} {unit} · {dwell} ms/步 · {loop}", en: "Step {seq} {unit} · {dwell} ms/step · {loop}" },

  // ===== HART 扩展 =====
  "hart.identified": { zh: "HART 已识别", en: "HART Identified" },
  "hart.notSearched": { zh: "HART 未搜索", en: "HART Not Searched" },
  "hart.xorAuto": { zh: "（XOR 自动计算）", en: " (XOR auto-calculated)" },
  "hart.devicePrefix": { zh: "设备：", en: "Device: " },
  "hart.cmdGroup.write": { zh: "写命令", en: "Write Command" },
  "hart.cmdGroup.read": { zh: "读命令", en: "Read Command" },
  "hart.checksumXorAuto": { zh: "（XOR 自动计算）", en: " (XOR auto-calc)" },

  // ===== 自定义设备扩展 =====
  "custom.protocolPending": { zh: "协议待配置", en: "Protocol Pending" },

  // ===== 首页扩展 =====
  "home.card.unsupported": { zh: "用模板发送和解析规则快速适配未知串口设备。", en: "Quickly adapt unknown serial devices with send templates and parsing rules." },

  // ===== 请求页面扩展 =====
  "request.prepareDesc": { zh: "整理设备资料、协议、截图和期望 UI，方便贡献设备驱动。", en: "Prepare device docs, protocol, screenshots and desired UI to help contribute device drivers." },

  // ===== 阶跃 =====
  "step.maxPoints": { zh: "最多支持 {max} 个阶跃点", en: "Maximum {max} step points supported" },
  "step.category": { zh: "阶跃", en: "Step" },

  // ===== 设备名称 =====
  "device.ws": { zh: "WebSocket 调试", en: "WebSocket Debug" },
  "device.mqtt": { zh: "MQTT 调试", en: "MQTT Debug" },
  "device.modbus": { zh: "Modbus", en: "Modbus" },
  "device.hart": { zh: "HART", en: "HART" },
  "device.aomaster": { zh: "AOMaster", en: "AOMaster" },

  // ===== 曲线帮助 HTML =====
  "curve.help.html.aomaster": {
    zh: `<p>AOMaster 监测面板显示<strong>双曲线</strong>：上方为设定预览，下方为轮询回读的实际输出。</p>
      <div class="protocol-example-grid">
        <article class="protocol-example-card">
          <h3>设定预览</h3>
          <p>根据当前波形参数（恒定、阶跃、方波、锯齿等）在本地生成预览曲线，不依赖设备回包。</p>
        </article>
        <article class="protocol-example-card">
          <h3>实时输出</h3>
          <p>轮询读取寄存器 <code>0x0000~0x0006</code> 共 7 个寄存器，用 <code>0x0000</code> 的类型判断电流/电压，再取 <code>0x0006</code> 的实际输出值；原始值按 1000 缩放，实际输出曲线的 Y 轴按回包类型切换为 4~20 mA 或 0~10 V。</p>
        </article>
      </div>
      <div class="protocol-note">
        <strong>采样：</strong>
        <span>曲线总点数与显示点数在监测面板底部设置；点数越高历史越长，显示点数决定当前窗口宽度。</span>
      </div>`,
    en: `<p>The AOMaster monitor panel displays <strong>dual charts</strong>: the upper chart shows the setpoint preview, and the lower chart shows the actual output from polling readback.</p>
      <div class="protocol-example-grid">
        <article class="protocol-example-card">
          <h3>Setpoint Preview</h3>
          <p>Generates a local preview curve based on current waveform parameters (constant, step, square, sawtooth, etc.), independent of device response.</p>
        </article>
        <article class="protocol-example-card">
          <h3>Real-time Output</h3>
          <p>Polls registers <code>0x0000~0x0006</code> (7 registers), uses <code>0x0000</code> to select current/voltage units, then plots the actual output from <code>0x0006</code>. Raw values are scaled by 1000. The actual-output Y axis follows the response type: 4~20 mA or 0~10 V.</p>
        </article>
      </div>
      <div class="protocol-note">
        <strong>Sampling:</strong>
        <span>Total points and display points are configured at the bottom of the monitor panel; higher point count means longer history, display points determine the current window width.</span>
      </div>`
  },
  "curve.help.html.modbus": {
    zh: `<p>读模式（功能码 <code>03/04</code>）下，监测面板从 RTU 回包的<strong>数据区</strong>按字节偏移解码数值；写模式仅发送命令，不绘制曲线。</p>
      <div class="protocol-example-grid">
        <article class="protocol-example-card">
          <h3>1. 单曲线（UInt16）</h3>
          <p>曲线一数据偏移 <code>0</code>，类型 UInt16，字节序 AB。读 1 个寄存器即可。</p>
          <pre><code>请求：01 03 00 00 00 01 84 0A
响应：01 03 02 00 64 B9 AF
数据区：00 64 → 100</code></pre>
        </article>
        <article class="protocol-example-card">
          <h3>2. 双曲线（同帧多寄存器）</h3>
          <p>曲线一偏移 <code>0</code>，曲线二偏移 <code>2</code>；读 2 个寄存器。偏移相对<strong>数据区首字节</strong>，不含从站/功能码/CRC。</p>
          <pre><code>响应：01 03 04 00 64 00 C8 FA 33
偏移 0 → 100，偏移 2 → 200</code></pre>
        </article>
        <article class="protocol-example-card">
          <h3>3. Float32</h3>
          <p>类型选 Float32 占 4 字节；32 位浮点需选 ABCD / DCBA 等字序。下一条曲线偏移至少 +4。</p>
          <pre><code>01 03 04 42 48 00 00 …
→ 50.0（取决于字序）</code></pre>
        </article>
        <article class="protocol-example-card">
          <h3>4. 比例与偏移</h3>
          <p>显示值 = 原始值 × 比例 + 偏移。例如原始 100、比例 0.1 → 显示 10.0。</p>
        </article>
      </div>
      <div class="protocol-note">
        <strong>配置分工：</strong>
        <span>设备页设置从站、功能码、起始地址、寄存器数量与轮询；监测面板设置每条曲线的名称、偏移、类型、字序与换算。启用多曲线时，若寄存器数量不足，会自动扩大读取范围。</span>
      </div>
      <div class="protocol-note">
        <strong>测试：</strong>
        <span>在曲线配置底部粘贴完整 RTU 帧 HEX（含 CRC），点「测试」验证解码，无需连接设备。</span>
      </div>`,
    en: `<p>In read mode (function code <code>03/04</code>), the monitor panel decodes values from the RTU response <strong>data area</strong> by byte offset; write mode only sends commands without plotting.</p>
      <div class="protocol-example-grid">
        <article class="protocol-example-card">
          <h3>1. Single Curve (UInt16)</h3>
          <p>Curve 1 data offset <code>0</code>, type UInt16, byte order AB. Read 1 register.</p>
          <pre><code>Request: 01 03 00 00 00 01 84 0A
Response: 01 03 02 00 64 B9 AF
Data area: 00 64 → 100</code></pre>
        </article>
        <article class="protocol-example-card">
          <h3>2. Dual Curve (multi-register in one frame)</h3>
          <p>Curve 1 offset <code>0</code>, Curve 2 offset <code>2</code>; read 2 registers. Offset is relative to <strong>data area first byte</strong>, excluding slave/function code/CRC.</p>
          <pre><code>Response: 01 03 04 00 64 00 C8 FA 33
Offset 0 → 100, Offset 2 → 200</code></pre>
        </article>
        <article class="protocol-example-card">
          <h3>3. Float32</h3>
          <p>Type Float32 occupies 4 bytes; 32-bit float requires ABCD / DCBA word order. Next curve offset at least +4.</p>
          <pre><code>01 03 04 42 48 00 00 …
→ 50.0 (depends on word order)</code></pre>
        </article>
        <article class="protocol-example-card">
          <h3>4. Scale & Offset</h3>
          <p>Display value = raw value × scale + offset. e.g. raw 100, scale 0.1 → display 10.0.</p>
        </article>
      </div>
      <div class="protocol-note">
        <strong>Configuration split:</strong>
        <span>Device page sets slave, function code, start address, register count & polling; monitor panel sets curve name, offset, type, byte order & scaling. Multi-curve mode auto-expands read range if register count is insufficient.</span>
      </div>
      <div class="protocol-note">
        <strong>Test:</strong>
        <span>Paste a complete RTU frame HEX (with CRC) at the bottom of curve config, click "Test" to verify decoding without connecting a device.</span>
      </div>`
  },
  "curve.help.html.hart": {
    zh: `<p>HART 设备搜索成功后，可轮询 PV / SV / TV / QV 四个主变量；卡片与曲线同步更新。</p>
      <div class="protocol-example-grid">
        <article class="protocol-example-card">
          <h3>变量含义</h3>
          <p>PV 主变量、SV 次变量、TV 第三变量、QV 第四变量；单位随设备 DD 变化。</p>
        </article>
        <article class="protocol-example-card">
          <h3>显示开关</h3>
          <p>在曲线配置中勾选要绘制的变量；未勾选的不进入图表，但仍可在卡片查看。</p>
        </article>
      </div>`,
    en: `<p>After a successful HART device search, you can poll the four primary variables: PV / SV / TV / QV; cards and charts update synchronously.</p>
      <div class="protocol-example-grid">
        <article class="protocol-example-card">
          <h3>Variable Meanings</h3>
          <p>PV = Primary Variable, SV = Secondary Variable, TV = Tertiary Variable, QV = Quaternary Variable; units vary with device DD.</p>
        </article>
        <article class="protocol-example-card">
          <h3>Display Toggle</h3>
          <p>Check the variables to plot in curve config; unchecked ones won't appear on the chart but remain visible on cards.</p>
        </article>
      </div>`
  },
  "curve.help.html.custom": {
    zh: `<p>自定义串口设备通过发送模板下发设定，从回包中解析 JSON / HEX / Modbus 数值并绘图。</p>
      <div class="protocol-example-grid">
        <article class="protocol-example-card">
          <h3>1. JSON 单/多曲线</h3>
          <p>解析模式 <code>JSON / 文本</code>；路径如 <code>value</code>、<code>data.temp</code>、<code>metrics.0.value</code>。</p>
          <pre><code>{"telemetry":{"temp":25.6,"pressure":1.23}}</code></pre>
        </article>
        <article class="protocol-example-card">
          <h3>2. HEX 多曲线</h3>
          <p>模式 <code>HEX 原始字节</code>；曲线一偏移 0、曲线二偏移 2，按 UInt16/Int16/Float32 解码。</p>
          <pre><code>00 64 00 C8</code></pre>
        </article>
        <article class="protocol-example-card">
          <h3>3. 帧界与 CRC</h3>
          <p><code>行界</code> 按 CRLF/LF 切分；<code>帧头帧尾</code> 填 HEX（如 STX <code>02</code>、ETX <code>03</code>）；可选 Modbus CRC16 校验。</p>
        </article>
        <article class="protocol-example-card">
          <h3>4. Modbus 载荷</h3>
          <p>模式 <code>Modbus RTU</code>，配置从站与功能码，在同一 RTU 帧数据区内按偏移解多条曲线。</p>
          <pre><code>01 03 04 00 64 00 C8 FA 33</code></pre>
        </article>
      </div>
      <div class="protocol-note">
        <strong>分工：</strong>
        <span>设备页：名称、范围、发送模板；监测面板：解析模式、帧界、CRC、曲线字段。分片数据在连接期间缓冲至完整帧。</span>
      </div>`,
    en: `<p>Custom serial devices send setpoints via templates and parse JSON / HEX / Modbus values from responses for plotting.</p>
      <div class="protocol-example-grid">
        <article class="protocol-example-card">
          <h3>1. JSON Single/Multi Curve</h3>
          <p>Parser mode <code>JSON / Text</code>; paths like <code>value</code>, <code>data.temp</code>, <code>metrics.0.value</code>.</p>
          <pre><code>{"telemetry":{"temp":25.6,"pressure":1.23}}</code></pre>
        </article>
        <article class="protocol-example-card">
          <h3>2. HEX Multi Curve</h3>
          <p>Mode <code>HEX Raw Bytes</code>; Curve 1 offset 0, Curve 2 offset 2, decoded as UInt16/Int16/Float32.</p>
          <pre><code>00 64 00 C8</code></pre>
        </article>
        <article class="protocol-example-card">
          <h3>3. Framing & CRC</h3>
          <p><code>Line Delimited</code> splits by CRLF/LF; <code>Delimiters</code> with HEX values (e.g. STX <code>02</code>, ETX <code>03</code>); optional Modbus CRC16.</p>
        </article>
        <article class="protocol-example-card">
          <h3>4. Modbus Payload</h3>
          <p>Mode <code>Modbus RTU</code>, configure slave & function code, decode multiple curves by offset within the data area of one RTU frame.</p>
          <pre><code>01 03 04 00 64 00 C8 FA 33</code></pre>
        </article>
      </div>
      <div class="protocol-note">
        <strong>Split:</strong>
        <span>Device page: name, range, send template; Monitor panel: parser mode, framing, CRC, curve fields. Fragmented data is buffered to complete frames during the connection.</span>
      </div>`
  },
  "curve.help.html.websocket": {
    zh: `<div class="protocol-example-grid">
        <article class="protocol-example-card">
          <h3>1. JSON 单曲线</h3>
          <p>解析模式 <code>JSON / 文本</code>，曲线一路径 <code>value</code>；留空路径时自动取第一个数字。</p>
          <pre><code>{"value":12.34}</code></pre>
        </article>
        <article class="protocol-example-card">
          <h3>2. JSON 多曲线</h3>
          <p>最多 4 条；路径互不相同即可，如 <code>telemetry.temp</code> 与 <code>telemetry.pressure</code>。</p>
          <pre><code>{"telemetry":{"temp":25.6,"pressure":1.23,"flow":18.4}}</code></pre>
        </article>
        <article class="protocol-example-card">
          <h3>3. HEX 多曲线</h3>
          <p>模式 <code>HEX 原始字节</code>；偏移为载荷内字节位置，非 Modbus 帧头。可配合行界/帧头帧尾切帧。</p>
          <pre><code>00 64 00 C8</code></pre>
        </article>
        <article class="protocol-example-card">
          <h3>4. Modbus RTU 载荷</h3>
          <p>模式 <code>Modbus RTU</code>；从站、功能码 03/04，在数据区按偏移解寄存器。Modbus 模式自带 CRC 校验。</p>
          <pre><code>01 03 04 00 64 00 C8 FA 33</code></pre>
        </article>
      </div>
      <div class="protocol-note">
        <strong>帧界：</strong>
        <span>整包、行界、帧头帧尾（HEX）三选一；HEX/JSON 可选 Modbus CRC16。JSON/HEX/Modbus 均支持最多 4 条曲线。</span>
      </div>
      <div class="protocol-note">
        <strong>测试：</strong>
        <span>曲线配置底部「解析样例」可离线验证；JSON 填文本，HEX/Modbus 填空格分隔十六进制。</span>
      </div>`,
    en: `<div class="protocol-example-grid">
        <article class="protocol-example-card">
          <h3>1. JSON Single Curve</h3>
          <p>Parser mode <code>JSON / Text</code>, Curve 1 path <code>value</code>; leave path empty to auto-grab the first number.</p>
          <pre><code>{"value":12.34}</code></pre>
        </article>
        <article class="protocol-example-card">
          <h3>2. JSON Multi Curve</h3>
          <p>Up to 4 curves; paths must differ, e.g. <code>telemetry.temp</code> and <code>telemetry.pressure</code>.</p>
          <pre><code>{"telemetry":{"temp":25.6,"pressure":1.23,"flow":18.4}}</code></pre>
        </article>
        <article class="protocol-example-card">
          <h3>3. HEX Multi Curve</h3>
          <p>Mode <code>HEX Raw Bytes</code>; offset is byte position within payload, not Modbus frame header. Can combine with line/delimiter framing.</p>
          <pre><code>00 64 00 C8</code></pre>
        </article>
        <article class="protocol-example-card">
          <h3>4. Modbus RTU Payload</h3>
          <p>Mode <code>Modbus RTU</code>; slave, function code 03/04, decode registers by offset within data area. Modbus mode includes CRC check.</p>
          <pre><code>01 03 04 00 64 00 C8 FA 33</code></pre>
        </article>
      </div>
      <div class="protocol-note">
        <strong>Framing:</strong>
        <span>Choose from Full, Line Delimited, or Delimiters (HEX); HEX/JSON can optionally enable Modbus CRC16. JSON/HEX/Modbus all support up to 4 curves.</span>
      </div>
      <div class="protocol-note">
        <strong>Test:</strong>
        <span>The "Parser Sample" at the bottom of curve config allows offline verification; paste text for JSON, space-separated hex for HEX/Modbus.</span>
      </div>`
  },
  "curve.help.html.mqtt": {
    zh: `<div class="protocol-example-grid">
        <article class="protocol-example-card">
          <h3>1. JSON 单曲线</h3>
          <p>订阅主题收到的 payload 按 JSON 路径提取；常见物联网格式 <code>{"value":25.6}</code>。</p>
          <pre><code>{"value":25.6}</code></pre>
        </article>
        <article class="protocol-example-card">
          <h3>2. JSON 多曲线</h3>
          <p>同一 JSON 内多条路径；嵌套与数组下标均支持，如 <code>sensors.0.temp</code>。</p>
          <pre><code>{"telemetry":{"temp":25.6,"pressure":1.23,"flow":18.4}}</code></pre>
        </article>
        <article class="protocol-example-card">
          <h3>3. HEX 多曲线</h3>
          <p>payload 为原始字节（或 HEX 字符串）；按字节偏移解码，适用于二进制遥测。</p>
          <pre><code>00 64 00 C8</code></pre>
        </article>
        <article class="protocol-example-card">
          <h3>4. Modbus RTU 载荷</h3>
          <p>MQTT 消息体为完整或连续 Modbus RTU 字节流；自动切帧、校验 CRC、按数据区偏移解多条曲线。</p>
          <pre><code>01 03 04 00 64 00 C8 FA 33</code></pre>
        </article>
      </div>
      <div class="protocol-note">
        <strong>帧界与 CRC：</strong>
        <span>非 Modbus 模式可选行界/帧头帧尾/CRC；Modbus 模式强制 RTU CRC。多曲线时曲线名显示在图例与实时读数区。</span>
      </div>
      <div class="protocol-note">
        <strong>发布：</strong>
        <span>设备页配置发布主题、QoS、retain；监测面板只负责订阅解析与曲线，两者独立保存。</span>
      </div>`,
    en: `<div class="protocol-example-grid">
        <article class="protocol-example-card">
          <h3>1. JSON Single Curve</h3>
          <p>Subscribed topic payload is extracted by JSON path; common IoT format <code>{"value":25.6}</code>.</p>
          <pre><code>{"value":25.6}</code></pre>
        </article>
        <article class="protocol-example-card">
          <h3>2. JSON Multi Curve</h3>
          <p>Multiple paths within one JSON; nesting and array indices supported, e.g. <code>sensors.0.temp</code>.</p>
          <pre><code>{"telemetry":{"temp":25.6,"pressure":1.23,"flow":18.4}}</code></pre>
        </article>
        <article class="protocol-example-card">
          <h3>3. HEX Multi Curve</h3>
          <p>Payload as raw bytes (or HEX string); decoded by byte offset, suitable for binary telemetry.</p>
          <pre><code>00 64 00 C8</code></pre>
        </article>
        <article class="protocol-example-card">
          <h3>4. Modbus RTU Payload</h3>
          <p>MQTT message body as complete or continuous Modbus RTU byte stream; auto-framing, CRC check, multi-curve decode by data area offset.</p>
          <pre><code>01 03 04 00 64 00 C8 FA 33</code></pre>
        </article>
      </div>
      <div class="protocol-note">
        <strong>Framing & CRC:</strong>
        <span>Non-Modbus modes can optionally use line/delimiter framing or CRC; Modbus mode enforces RTU CRC. Curve names appear in legend and real-time readout area when multi-curve is enabled.</span>
      </div>
      <div class="protocol-note">
        <strong>Publish:</strong>
        <span>Device page configures publish topic, QoS, retain; monitor panel is only responsible for subscription parsing and curves — both are saved independently.</span>
      </div>`
  },

  // ===== app.js 专用别名 (driver / workbench.poll / settings 等) =====
  "chart.wsEmpty": { zh: "连接设备并接收 WebSocket 消息后显示多曲线", en: "Connect device and receive WebSocket messages to show multi-curves" },
  "chart.serialEmpty": { zh: "连接设备并接收串口数据后显示多曲线", en: "Connect device and receive serial data to show multi-curves" },
  "chart.modbusEmpty": { zh: "连接设备并开始轮询后显示多曲线", en: "Connect device and start polling to show multi-curves" },
  "chart.mqttEmpty": { zh: "连接设备并接收 MQTT 消息后显示多曲线", en: "Connect device and receive MQTT messages to show multi-curves" },
  "home.aomasterCardDesc": { zh: "阶跃/斜坡/方波等波形输出，双曲线预览，监测面板可手动轮询回读。", en: "Step, ramp, square and other waveform outputs; dual chart preview; manual polling readback in monitor panel." },
  "home.modbusCardDesc": { zh: "RTU 寄存器读写，支持轮询读取与曲线显示。", en: "RTU register read/write with polling read and curve display." },
  "home.hartCardDesc": { zh: "通用命令读写，PV/SV/TV/QV 轮询与多曲线，完整 HART 上位机调试。", en: "Universal command read/write, PV/SV/TV/QV polling and multi-curve, full HART host debugging." },
  "home.mqttCardDesc": { zh: "MQTT over WebSocket 调试，主题发布/订阅、QoS 与 JSON 解析。", en: "MQTT over WebSocket debug, topic publish/subscribe, QoS and JSON parsing." },
  "home.customCardDesc": { zh: "用模板发送和解析规则快速适配未知串口设备。", en: "Quickly adapt unknown serial devices with send templates and parsing rules." },
  "home.requestCardDesc": { zh: "整理设备资料、协议、截图和期望 UI，方便贡献设备驱动。", en: "Prepare device docs, protocol, screenshots and desired UI to help contribute device drivers." },
  "custom.deviceConfigDescSummary": { zh: "；设定范围与发送模板在本页配置，曲线解析在监测面板。", en: "; Setpoint range and send template configured on this page, curve parsing in monitor panel." },
  "custom.cardDesc": { zh: "模板发送 / JSON·HEX·Modbus 解析", en: "Template send / JSON·HEX·Modbus parsing" },
  "panel.default": { zh: "面板", en: "Panel" },
  "conn.subscribe": { zh: "订阅", en: "Subscribe" },
  "conn.connectedSuffix": { zh: " 已连接", en: " Connected" },
  "conn.reconnectHint": { zh: "，断开后重新连接生效", en: ", reconnect to take effect" },
  "settings.saved.custom": { zh: "自定义串口设备配置已保存", en: "Custom serial device config saved" },
  "settings.reset.custom": { zh: "自定义串口设备配置已恢复默认", en: "Custom serial device config reset to default" },
  "common.val": { zh: "值", en: "val" },
  "driver.readRegister": { zh: "读取寄存器", en: "Read Register" },
  "driver.writeRegister": { zh: "写入寄存器", en: "Write Register" },
  "driver.modbusRtu": { zh: "Modbus RTU", en: "Modbus RTU" },
  "driver.sendCommand": { zh: "发送命令", en: "Send Command" },
  "driver.hartIdentified": { zh: "HART 已识别", en: "HART Identified" },
  "driver.hartNotSearched": { zh: "HART 未搜索", en: "HART Not Searched" },
  "driver.sendSetting": { zh: "发送设定", en: "Send Setting" },
  "driver.templateReady": { zh: "模板可发送", en: "Template Ready" },
  "driver.protocolPending": { zh: "协议待配置", en: "Protocol Pending" },
  "driver.sendPollMsg": { zh: "发送轮询消息", en: "Send Poll Message" },
  "driver.mqttDebug": { zh: "MQTT 调试", en: "MQTT Debug" },
  "driver.wsDebug": { zh: "WebSocket 调试", en: "WebSocket Debug" },
  "driver.configPollMsg": { zh: "请配置轮询消息", en: "Please configure poll message" },
  "workbench.pollNotSupported": { zh: "当前设备不支持轮询", en: "Current device does not support polling" },
  "workbench.pollNeedRead": { zh: "读模式方可轮询", en: "Read mode required for polling" },
  "workbench.pollNeedSearch": { zh: "请先搜索设备", en: "Please search device first" },
  "workbench.pollNeedConfig": { zh: "请配置轮询间隔与消息", en: "Please configure poll interval and message" },
  "workbench.pollNeedInterval": { zh: "请设置轮询间隔", en: "Please set poll interval" },
  "chart.latestPrefix": { zh: "最新", en: "Latest" },
  "chart.totalPrefix": { zh: "共", en: "total" },
  "num.totalPointsPrefix": { zh: "共", en: "total" },
  "request.copyFailed": { zh: "复制失败，请手动选择模板文本", en: "Copy failed, please manually select template text" },
};

let currentLang = null;

export function i18n(key, fallback) {
  const entry = TRANSLATIONS[key];
  if (!entry) {
    return fallback ?? key;
  }
  const lang = i18n.current();
  return entry[lang] ?? entry.zh ?? key;
}

i18n.current = function () {
  if (currentLang) return currentLang;

  try {
    const stored = localStorage.getItem("modusignal-lang");
    if (stored && SUPPORTED_LANGS.includes(stored)) {
      currentLang = stored;
      return currentLang;
    }
  } catch {}

  currentLang = "zh";
  return currentLang;
};

i18n.setLanguage = function (lang, callback) {
  if (!SUPPORTED_LANGS.includes(lang)) {
    return;
  }
  currentLang = lang;
  try {
    localStorage.setItem("modusignal-lang", lang);
  } catch {}
  document.documentElement.lang = lang === "zh" ? "zh-CN" : "en-US";

  i18n.apply(document.body);

  if (typeof callback === "function") {
    callback(lang);
  }
};

i18n.getLanguage = function () {
  return i18n.current();
};

i18n.apply = function (root) {
  if (!root) return;

  walkNodes(root, (node) => {
    if (node.getAttribute?.("data-i18n")) {
      const key = node.getAttribute("data-i18n");
      const text = i18n(key);
      if (text) {
        node.textContent = text;
      }
    }
    if (node.getAttribute?.("data-i18n-title")) {
      const key = node.getAttribute("data-i18n-title");
      const text = i18n(key);
      if (text) {
        node.title = text;
      }
    }
    if (node.getAttribute?.("data-i18n-placeholder")) {
      const key = node.getAttribute("data-i18n-placeholder");
      const text = i18n(key);
      if (text) {
        node.placeholder = text;
      }
    }
    if (node.getAttribute?.("data-i18n-aria-label")) {
      const key = node.getAttribute("data-i18n-aria-label");
      const text = i18n(key);
      if (text) {
        node.setAttribute("aria-label", text);
      }
    }
    if (node.getAttribute?.("data-i18n-value")) {
      const key = node.getAttribute("data-i18n-value");
      const text = i18n(key);
      if (text) {
        node.value = text;
      }
    }
    if (node.getAttribute?.("data-i18n-content")) {
      const key = node.getAttribute("data-i18n-content");
      const text = i18n(key);
      if (text) {
        node.setAttribute("content", text);
      }
    }
  });
};

function walkNodes(root, callback) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, null, false);
  let node;
  while ((node = walker.nextNode())) {
    callback(node);
  }
}

export function initI18n() {
  document.documentElement.lang = i18n.current() === "zh" ? "zh-CN" : "en-US";
  i18n.apply(document.body);
}

export default i18n;
