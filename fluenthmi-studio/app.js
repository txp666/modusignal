const REPOSITORY = "txp666/FluentHMI-Studio";
const RELEASE_API = `https://api.github.com/repos/${REPOSITORY}/releases/latest`;
const FALLBACK_RELEASE_DATE = "2026-10-27T08:39:17Z";

const copy = {
  skipLink: { zh: "跳到主要内容", en: "Skip to main content" },
  brandTagline: { zh: "C++ 可视化上位机设计器", en: "Visual host-app designer in C++" },
  navWorkflow: { zh: "工作流程", en: "Workflow" },
  navCapabilities: { zh: "功能介绍", en: "Features" },
  navCompare: { zh: "与 Python 版相比", en: "vs. Python version" },
  navGuide: { zh: "使用说明", en: "Guide" },
  navDownloads: { zh: "下载", en: "Downloads" },
  backToModusignal: { zh: "返回 modusignal", en: "Back to modusignal" },
  stableRelease: { zh: "最新稳定版", en: "Latest stable" },
  heroEyebrow: { zh: "C++ / Qt 6 · 拖拽设计 · 秒级导出", en: "C++ / Qt 6 · Drag-and-drop · Instant export" },
  heroTitle: { zh: "<span class=\"hero-title-line\">拖拽搭建上位机界面</span><span class=\"hero-title-line\">不到一秒导出应用</span>", en: "<span class=\"hero-title-line\">Drag together a host app</span><span class=\"hero-title-line\">Export it in under a second</span>" },
  heroDescription: { zh: "PyQt UI Designer 的 C++/Qt 6 重写版，界面基于 FluentQtWidgets。拖拽控件、配置属性，绑定串口、TCP 或 MQTT 数据，预览运行后直接导出独立应用，不需要 Python 和编译器。", en: "The C++/Qt 6 rewrite of PyQt UI Designer, built on FluentQtWidgets. Drag widgets, set their properties and bind them to serial, TCP or MQTT data, run a live preview, then export a standalone app with no Python or compiler needed." },
  downloadNow: { zh: "立即下载", en: "Download now" },
  exploreCompare: { zh: "与 Python 版相比", en: "Compare with the Python version" },
  releaseSource: { zh: "下载信息来自 GitHub Releases，页面会自动检查最新稳定版。", en: "Download information comes from GitHub Releases and is refreshed automatically." },
  visualCaptionLead: { zh: "29 种控件 · 兼容 .uidp 工程", en: "29 widgets · .uidp compatible" },
  visualCaptionTitle: { zh: "预览和导出的应用是同一个运行器", en: "The preview and exported apps share one runtime" },
  trustOneTitle: { zh: "直接打开 .uidp 工程", en: "Opens .uidp projects" },
  trustOneDesc: { zh: "PyQt UI Designer 做好的工程可以直接打开、预览和导出", en: "Projects made in PyQt UI Designer open, preview and export as they are" },
  trustTwoTitle: { zh: "导出不需要编译器", en: "No compiler to export" },
  trustTwoDesc: { zh: "复制预编译的运行器，再放入工程和图片", en: "It copies a prebuilt runtime and adds the project and its images" },
  trustThreeTitle: { zh: "安装包更小，启动更快", en: "Smaller and faster" },
  trustThreeDesc: { zh: "Windows 安装包约为 Python 版的三分之一，启动约快一倍", en: "The Windows download is about a third the size of the Python version's, and it starts about twice as fast" },
  workflowEyebrow: { zh: "工作流程", en: "Workflow" },
  workflowTitle: { zh: "从画布到可以拷走的应用", en: "From canvas to an app you can copy anywhere" },
  workflowDescription: { zh: "设计画布上显示的就是真实的运行时控件。预览和导出的应用把同一批控件挂到同一个运行时上，由它接收链路数据、执行绑定、发送命令，所以预览里看到的就是导出后的效果。", en: "The design canvas shows the real runtime widgets. The preview and the exported app attach the same widgets to the same runtime, which receives link data, runs the bindings and sends commands, so what you see in the preview is what the export does." },
  bindTitle: { zh: "接收：数据绑定", en: "Receive: data binding" },
  bindDescription: { zh: "行文本（键值 / JSON / CSV）、HEX 帧、Modbus RTU、Modbus TCP 四种解析；键值匹配、JSON 路径、HEX 字节提取、Modbus 四种绑定，支持 <code>value * 0.1</code> 这类转换表达式。", en: "Four parsers — line text (key/value, JSON, CSV), HEX frames, Modbus RTU and Modbus TCP — and four bindings — key/value, JSON path, HEX byte extraction and Modbus — with expressions such as <code>value * 0.1</code>." },
  sendTitle: { zh: "发送：命令配置", en: "Send: commands" },
  sendDescription: { zh: "文本、HEX、Modbus 三种模式和 <code>{value}</code> 模板；Modbus 命令按每条链路的解析模式自动组 RTU 帧或 MBAP 帧。", en: "Text, HEX and Modbus modes with a <code>{value}</code> template. Modbus commands are framed as RTU or MBAP to match each link's parse mode." },
  viewGuide: { zh: "查看使用说明与协议说明", en: "Read the user guide and protocol reference" },
  consoleTitle: { zh: "命令行", en: "Command line" },
  consoleExportLabel: { zh: "不打开界面，直接导出应用", en: "Export an app without the UI" },
  consoleCheckLabel: { zh: "检查工程，例如 AI 写的工程", en: "Check a project, such as one an AI wrote" },
  consoleShotLabel: { zh: "把工程画面渲染成图片", en: "Render a project to an image" },
  flowDesign: { zh: "设计界面", en: "Design" },
  flowDesignDetail: { zh: "拖拽 · 对齐 · 容器嵌套", en: "Drag · align · nest" },
  flowBind: { zh: "绑定数据", en: "Bind data" },
  flowBindDetail: { zh: "绑定键 · 解析模式 · 命令", en: "Keys · parsers · commands" },
  flowPreview: { zh: "预览运行", en: "Preview" },
  flowPreviewDetail: { zh: "串口 · TCP · MQTT 实时测试", en: "Live test over serial · TCP · MQTT" },
  flowExport: { zh: "导出应用", en: "Export" },
  flowExportDetail: { zh: "复制运行器 · 约 0.3 秒", en: "Copy the runtime · about 0.3 s" },
  previewEyebrow: { zh: "预览运行", en: "Live preview" },
  previewTitle: { zh: "预览看到的就是导出后的效果", en: "The preview is the exported app" },
  previewDescription: { zh: "串口、TCP、MQTT 三种链路可以同时连接，收到的数据进入同一套绑定、曲线、表格和日志。预览和导出的应用用的是同一个运行器。", en: "Serial, TCP and MQTT links can be connected at the same time, and their data feeds the same bindings, plots, tables and logs. The preview and the exported app run on the same runtime." },
  linkSerial: { zh: "扫描端口，可设波特率、数据位、校验位、停止位和流控。", en: "Port scanning, with baud rate, data bits, parity, stop bits and flow control." },
  linkTcp: { zh: "客户端连接设备，或作为服务端等待设备连入；支持 Modbus TCP。", en: "Connect to a device as a client, or listen as a server for devices to connect. Modbus TCP is supported." },
  linkMqtt: { zh: "自带 MQTT 3.1.1 客户端：用户名密码、QoS 0/1/2、<code>+</code> / <code>#</code> 通配符订阅，TLS 使用系统证书库，连接成功后断开会自动重连。", en: "A built-in MQTT 3.1.1 client: username and password, QoS 0/1/2, <code>+</code> / <code>#</code> wildcard subscriptions, TLS through the system certificate store, and automatic reconnects once connected." },
  previewCaption: { zh: "同一份工程连上 MQTT 模拟设备后的预览运行", en: "The same project in the live preview, connected to a simulated MQTT device" },
  capabilitiesEyebrow: { zh: "功能介绍", en: "Features" },
  capabilitiesTitle: { zh: "设计、通信、导出与更新", en: "Design, connect, export and update" },
  capabilitiesDescription: { zh: "控件、属性、解析模式、数据绑定和命令编码与 PyQt UI Designer 一一对应，换成原生编译的 C++ 实现，导出也不再需要编译。", en: "Widgets, properties, parse modes, bindings and command encoding match PyQt UI Designer one for one, rebuilt as native C++ so exporting no longer needs a compiler." },
  featureDesignerTitle: { zh: "可视化设计", en: "Visual designer" },
  featureDesignerDesc: { zh: "29 种控件，网格吸附、缩放、适应窗口、对齐与等距分布；容器支持水平 / 垂直 / 弹性布局、分组框、卡片和选项卡嵌套。浅色、深色和跟随系统主题。", en: "29 widgets with grid snapping, zoom, fit to window, alignment and even distribution. Containers nest horizontal, vertical and flow layouts, group boxes, cards and tabs. Light, dark and follow-system themes." },
  featureFormatTitle: { zh: "工程格式兼容", en: "Same project format" },
  featureFormatDesc: { zh: "直接读写 .uidp（版本 1.0），控件类型、属性名、默认值和枚举选项与 PyQt UI Designer 一一对应；解析与命令编码规则逐条移植，并有单元测试覆盖。", en: "Reads and writes .uidp (version 1.0) with the same widget types, property names, defaults and options as PyQt UI Designer. The parsing and command-encoding rules were ported one by one and are covered by unit tests." },
  featureLinksTitle: { zh: "串口、TCP 与 MQTT", en: "Serial, TCP and MQTT" },
  featureLinksDesc: { zh: "三种链路可以同时连接。MQTT 每条消息视为一帧，只有一个数值的消息可以直接用主题名绑定；TCP 服务端可接入多个设备。", en: "All three links can be connected together. Each MQTT message is one frame, and a message that is a single number can be bound by topic name. A TCP server accepts several devices." },
  featureExportTitle: { zh: "秒级导出", en: "Instant export" },
  featureExportDesc: { zh: "导出时复制运行器、写入工程和用到的图片，并以应用名命名。导出的应用带着运行器和 Qt，可以直接拷到别的电脑上运行；macOS 导出的应用同样是 universal。", en: "Exporting copies the runtime, writes the project and the images it uses, and names the app after the project. The app carries its runtime and Qt, so it runs when copied to another computer; on macOS it is universal too." },
  featureUpdateTitle: { zh: "在线更新", en: "In-app updates" },
  featureUpdateDesc: { zh: "设置页检查更新，也可在启动时检查。下载本平台的安装包并校验 SHA-256，重启或退出时换上新版本；换不上时保留原来的版本。", en: "Check for updates in Settings or at startup. It downloads the package for your platform, verifies its SHA-256 and swaps in the new version when you restart or quit, keeping the old one if the swap fails." },
  featureAiTitle: { zh: "让 AI 写工程", en: "Let an AI write the project" },
  featureAiDesc: { zh: ".uidp 是 JSON 文件。把需求和仓库里的格式说明一起交给 AI，它就能直接写出工程，写完用 <code>FluentHMIRuntime 工程.uidp --check</code> 检查。", en: "A .uidp file is JSON. Give an AI your requirements along with the format guide in the repository and it can write the project; check the result with <code>FluentHMIRuntime project.uidp --check</code>." },
  widgetsEyebrow: { zh: "全部控件", en: "All widgets" },
  widgetsTitle: { zh: "29 种控件一览", en: "All 29 widgets" },
  widgetsDescription: { zh: "基础控件、布局容器、显示控件、图表和通信卡片，由运行器直接把工程画面渲染成图片。下图随页面的浅色 / 深色主题切换。", en: "Basic widgets, layout containers, displays, charts and link cards, rendered to an image by the runtime itself. The image follows this page's light / dark theme." },
  compareEyebrow: { zh: "版本对比", en: "Comparison" },
  compareTitle: { zh: "同一种工程，不同的实现与导出", en: "One project format, different builds and exports" },
  compareDescription: { zh: "两者使用同一种 .uidp 工程格式，控件、解析模式、数据绑定和命令编码规则一致；不同之处在实现和导出方式。", en: "Both use the same .uidp project format, with the same widgets, parse modes, bindings and command encoding. They differ in how they are built and how they export." },
  compareItem: { zh: "项目", en: "Item" },
  compareImpl: { zh: "实现", en: "Built with" },
  compareImplHmi: { zh: "C++17 / Qt 6，原生编译", en: "C++17 / Qt 6, compiled natively" },
  compareImplPy: { zh: "Python / PyQt5（Qt 5），用 Nuitka 打包", en: "Python / PyQt5 (Qt 5), packaged with Nuitka" },
  compareExport: { zh: "导出应用", en: "Exporting an app" },
  compareExportHmi: { zh: "复制预编译的运行器，再放入工程和图片，约 0.3 秒，不需要 Python 和编译器", en: "Copies a prebuilt runtime and adds the project and images in about 0.3 s, with no Python or compiler" },
  compareExportPy: { zh: "生成 Python 源码，再用 Nuitka 编译；下载的设计器要打包时需另装 Python 与编译工具", en: "Generates Python source, then compiles it with Nuitka; packaging from the downloaded designer needs Python and a compiler installed" },
  comparePreview: { zh: "预览与导出", en: "Preview and export" },
  comparePreviewHmi: { zh: "预览和导出的应用是同一个运行器", en: "The preview and the exported app are the same runtime" },
  comparePreviewPy: { zh: "预览在设计器内运行，导出的是另外生成的代码", en: "The preview runs inside the designer; the export is separately generated code" },
  compareWindows: { zh: "Windows 安装包", en: "Windows download" },
  compareMac: { zh: "macOS 安装包", en: "macOS download" },
  compareMacHmi: { zh: "一个 universal 包，31.1 MB，Apple Silicon 与 Intel 通用；导出的应用同样是 universal", en: "One universal package, 31.1 MB, for Apple Silicon and Intel; exported apps are universal too" },
  compareMacPy: { zh: "arm64、x64 各一个包，51.3 / 59.9 MB；打包只生成本机架构的程序", en: "Separate arm64 and x64 packages, 51.3 / 59.9 MB; packaging builds for the current architecture only" },
  compareLaunch: { zh: "启动到出现窗口", en: "Launch to window" },
  compareLaunchHmi: { zh: "0.7–1.1 秒", en: "0.7–1.1 s" },
  compareLaunchPy: { zh: "1.5–2.2 秒", en: "1.5–2.2 s" },
  compareMemory: { zh: "启动后内存", en: "Memory after launch" },
  compareUpdate: { zh: "更新", en: "Updates" },
  compareUpdateHmi: { zh: "应用内检查、下载、校验并替换，可设为启动时检查", en: "Checks, downloads, verifies and replaces itself, optionally at startup" },
  compareUpdatePy: { zh: "设置页手动检查，有新版本时打开下载页", en: "Check by hand in Settings; a new version opens the download page" },
  compareNote: { zh: "安装包大小取自两者的 GitHub Release。启动时间和内存在同一台 Mac（Apple M5 Pro）上用两个版本的 Apple Silicon 程序测得：空工程，各启动 4 次取后 3 次，内存为窗口出现 5 秒后的常驻内存。导出时间是导出示例工程三次的耗时（0.26–0.41 秒）。", en: "Package sizes come from each project's GitHub Release. Launch time and memory were measured on one Mac (Apple M5 Pro) with the Apple Silicon builds of both: an empty project, four launches each with the first discarded, and resident memory five seconds after the window appeared. Export time is three exports of the example project (0.26–0.41 s)." },
  pythonEyebrow: { zh: "暂未移植的功能", en: "Not ported yet" },
  pythonTitle: { zh: "这些功能暂时还在 PyQt UI Designer", en: "Some features are still Python-only" },
  pythonDescription: { zh: "导出可以继续修改的源码工程，以及实时曲线的游标和数据保存 / 加载，目前只有 Python 版提供。需要这些功能时，请继续使用 PyQt UI Designer。", en: "Exporting a source project you can keep editing, plus plot cursors and saving / loading plot data, are only in the Python version for now. If you need them, stay with PyQt UI Designer." },
  pythonMore: { zh: "了解 PyQt UI Designer", en: "About PyQt UI Designer" },
  downloadEyebrow: { zh: "最新稳定版", en: "Latest stable" },
  downloadTitle: { zh: "下载运行包", en: "Download a package" },
  downloadDescription: { zh: "解压即可运行，无需另装 Qt。包里只有一份 Qt，Studio 和运行器共用；导出的应用会复制运行器及其 Qt。", en: "Unzip and run; no separate Qt install needed. The package holds one copy of Qt shared by the Studio and the runtime, and exported apps copy the runtime with its Qt." },
  viewRelease: { zh: "在 GitHub 查看 Release", en: "View release on GitHub" },
  recommended: { zh: "推荐", en: "Recommended" },
  windowsDescription: { zh: "解压后运行 FluentHMIStudio.exe。Studio 与运行器 FluentHMIRuntime.exe 在同一目录，共用 Qt DLL。", en: "Unzip and run FluentHMIStudio.exe. The Studio and the FluentHMIRuntime.exe runtime sit in one folder and share the Qt DLLs." },
  macDescription: { zh: "一个包同时支持 Apple Silicon 与 Intel。解压后先把 FluentHMI Studio.app 移到“应用程序”文件夹再打开，在线更新才能直接替换。", en: "One package for Apple Silicon and Intel. Move FluentHMI Studio.app to the Applications folder before opening it so in-app updates can replace it." },
  format: { zh: "格式", en: "Format" },
  size: { zh: "大小", en: "Size" },
  packageIncludes: { zh: "内置 Qt", en: "Qt included" },
  downloadWindows: { zh: "下载 Windows 版", en: "Download for Windows" },
  downloadMac: { zh: "下载 macOS 版", en: "Download for macOS" },
  downloadNote: { zh: "下载按钮直接连接 GitHub Release 附件，每个包都提供 .zip.sha256 校验文件。Mac 版只做了 ad hoc 签名，未做 Developer ID 签名与公证，第一次打开需要在“系统设置 → 隐私与安全性”中点“仍要打开”；Windows 版未做 Authenticode 签名，SmartScreen 提示时点“更多信息 → 仍要运行”。", en: "Buttons link directly to GitHub Release assets, each with a .zip.sha256 file. The Mac build is only ad hoc signed, not Developer ID signed or notarized, so the first launch needs “Open Anyway” in System Settings → Privacy & Security. The Windows build is not Authenticode signed; if SmartScreen appears, choose “More info → Run anyway”." },
  guideLink: { zh: "使用说明", en: "User guide" },
  buildFromSource: { zh: "从源码构建", en: "Build from source" },
  englishReadme: { zh: "English README", en: "English README" },
  sourceCode: { zh: "查看源代码", en: "View source" },
  openEyebrow: { zh: "开放源码", en: "Open source" },
  openTitle: { zh: "源码、许可证与路线图", en: "Source, license and roadmap" },
  openDescription: { zh: "FluentHMI Studio 基于 C++17、Qt 6 与 FluentQtWidgets 构建，采用 GPL-3.0 许可证。路线图包括撤销 / 重做、复制 / 粘贴，实时曲线的完整历史记录与游标，导出 C++/CMake 源码工程，以及 UDP、蓝牙和英文界面。", en: "FluentHMI Studio is built with C++17, Qt 6 and FluentQtWidgets and licensed under GPL-3.0. The roadmap includes undo / redo, copy / paste, full plot history and cursors, exporting a C++/CMake source project, UDP, Bluetooth and an English UI." },
  githubRepository: { zh: "GitHub 仓库", en: "GitHub repository" },
  reportIssue: { zh: "反馈问题", en: "Report an issue" },
  footerTagline: { zh: "面向硬件工程师的 C++ 可视化上位机设计工具。", en: "A visual host-app designer in C++ for hardware engineers." },
};

let currentLanguage = "zh";
let latestRelease = null;
const THEME_STORAGE_KEY = "modusignal-theme";
const DARK_THEME_QUERY = "(prefers-color-scheme: dark)";
let currentTheme = "light";

function readStoredTheme() {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : null;
  } catch {
    return null;
  }
}

function updateThemeButton() {
  const button = document.querySelector("[data-theme-toggle]");
  if (!button) return;
  const nextTheme = currentTheme === "dark" ? "light" : "dark";
  const label = currentLanguage === "en"
    ? `Switch to ${nextTheme} theme`
    : `切换到${nextTheme === "dark" ? "深色" : "浅色"}主题`;
  button.textContent = nextTheme === "dark" ? "☾" : "☀";
  button.setAttribute("aria-label", label);
  button.setAttribute("aria-pressed", String(currentTheme === "dark"));
  button.title = label;
}

function applyTheme(theme) {
  currentTheme = theme;
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute(
    "content",
    theme === "dark" ? "#0b1419" : "#f7fbfc",
  );
  updateThemeButton();
}

function initTheme() {
  const mediaQuery = window.matchMedia?.(DARK_THEME_QUERY);
  applyTheme(readStoredTheme() ?? (mediaQuery?.matches ? "dark" : "light"));
  document.querySelector("[data-theme-toggle]")?.addEventListener("click", () => {
    const theme = currentTheme === "dark" ? "light" : "dark";
    try { localStorage.setItem(THEME_STORAGE_KEY, theme); } catch {}
    applyTheme(theme);
  });
  mediaQuery?.addEventListener?.("change", (event) => {
    if (!readStoredTheme()) applyTheme(event.matches ? "dark" : "light");
  });
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return "—";
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatReleaseDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return currentLanguage === "zh"
    ? `${new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" }).format(date)} 发布`
    : `Released ${new Intl.DateTimeFormat("en", { year: "numeric", month: "short", day: "numeric" }).format(date)}`;
}

function applyLanguage(language) {
  currentLanguage = language === "en" ? "en" : "zh";
  document.documentElement.lang = currentLanguage === "zh" ? "zh-CN" : "en";
  document.querySelectorAll("[data-copy]").forEach((element) => {
    const value = copy[element.dataset.copy]?.[currentLanguage];
    if (value) element.innerHTML = value;
  });
  const toggle = document.querySelector("[data-language-toggle]");
  toggle.textContent = currentLanguage === "zh" ? "EN" : "中";
  toggle.setAttribute("aria-label", currentLanguage === "zh" ? "Switch to English" : "切换到中文");
  updateThemeButton();
  const releaseDate = latestRelease?.published_at || FALLBACK_RELEASE_DATE;
  document.querySelectorAll("[data-release-date]").forEach((element) => {
    element.textContent = formatReleaseDate(releaseDate);
  });
  try { localStorage.setItem("fluenthmi-studio-language", currentLanguage); } catch {}
}

function assetPlatform(assetName) {
  if (/windows-x64\.zip$/i.test(assetName)) return "windows";
  if (/macos-universal\.zip$/i.test(assetName)) return "macos";
  return null;
}

function preferredPlatform() {
  const hint = `${navigator.userAgent} ${navigator.platform}`.toLowerCase();
  // One universal package serves both Apple Silicon and Intel Macs.
  if (hint.includes("mac")) return "macos";
  return "windows";
}

function updatePrimaryDownload(platform) {
  const source = document.querySelector(`[data-asset="${platform}"]`);
  if (!source) return;
  const card = source.closest("[data-platform]");
  const details = [card?.querySelector("h3")?.textContent, card?.querySelector("dd")?.textContent, document.querySelector(`[data-asset-size="${platform}"]`)?.textContent].filter(Boolean);
  const primary = document.querySelector("[data-primary-download]");
  primary.href = source.href;
  primary.querySelector("[data-primary-download-label]").textContent = details.join(" · ");
}

function applyRelease(release) {
  latestRelease = release;
  const version = String(release.tag_name || "").replace(/^v/i, "");
  if (version) document.querySelectorAll("[data-release-version]").forEach((element) => { element.textContent = version; });
  if (release.published_at) document.querySelectorAll("[data-release-date]").forEach((element) => { element.textContent = formatReleaseDate(release.published_at); });
  if (release.html_url) document.querySelectorAll("[data-release-page]").forEach((element) => { element.href = release.html_url; });

  for (const asset of release.assets || []) {
    const platform = assetPlatform(asset.name);
    if (!platform) continue;
    const link = document.querySelector(`[data-asset="${platform}"]`);
    const size = document.querySelector(`[data-asset-size="${platform}"]`);
    if (link && asset.browser_download_url) link.href = asset.browser_download_url;
    if (size) size.textContent = formatBytes(asset.size);
  }

  updatePrimaryDownload(preferredPlatform());
}

async function refreshLatestRelease() {
  try {
    const response = await fetch(RELEASE_API, { headers: { Accept: "application/vnd.github+json" } });
    if (!response.ok) throw new Error(`GitHub API ${response.status}`);
    applyRelease(await response.json());
  } catch {
    // Keep the fallback links already shown for the visitor's platform.
  }
}

document.querySelector("[data-language-toggle]").addEventListener("click", () => {
  applyLanguage(currentLanguage === "zh" ? "en" : "zh");
});

let savedLanguage = "zh";
try { savedLanguage = localStorage.getItem("fluenthmi-studio-language") || "zh"; } catch {}
initTheme();
applyLanguage(savedLanguage);
// The GitHub API can take seconds to answer, so pick the platform from the built-in links first.
updatePrimaryDownload(preferredPlatform());
refreshLatestRelease();
