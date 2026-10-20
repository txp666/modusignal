const REPOSITORY = "txp666/PyQt-UI-Designer";
const RELEASE_API = `https://api.github.com/repos/${REPOSITORY}/releases/latest`;
const FALLBACK_RELEASE_DATE = "2026-10-20T13:47:04Z";

const copy = {
  skipLink: { zh: "跳到主要内容", en: "Skip to main content" },
  brandTagline: { zh: "可视化上位机设计器", en: "Visual host-app designer" },
  navWorkflow: { zh: "工作流程", en: "Workflow" },
  navCapabilities: { zh: "功能介绍", en: "Features" },
  navWorkspace: { zh: "导出示例", en: "Demo" },
  navGuide: { zh: "使用说明", en: "Guide" },
  navDownloads: { zh: "下载", en: "Downloads" },
  backToModusignal: { zh: "返回 modusignal", en: "Back to modusignal" },
  stableRelease: { zh: "最新稳定版", en: "Latest stable" },
  heroEyebrow: { zh: "拖拽设计 · 数据绑定 · 一键打包", en: "Drag-and-drop · Data binding · One-click packaging" },
  heroTitle: { zh: "<span class=\"hero-title-line\">拖拽搭建上位机界面</span><span class=\"hero-title-line\">导出独立 PyQt5 程序</span>", en: "<span class=\"hero-title-line\">Drag together a host app</span><span class=\"hero-title-line\">Export standalone PyQt5</span>" },
  heroDescription: { zh: "把控件拖到画布上，配置属性并绑定串口数据，在设计器里直接连接设备预览运行。调通后一键导出完整的 Python 项目，或用 Nuitka 打包为 Windows exe / macOS .app。", en: "Drop widgets on the canvas, set their properties and bind them to serial data, then connect a device and run a live preview inside the designer. When it works, export a complete Python project or package it with Nuitka as a Windows exe or macOS .app." },
  downloadNow: { zh: "立即下载", en: "Download now" },
  exploreWorkflow: { zh: "了解工作流程", en: "See the workflow" },
  releaseSource: { zh: "下载信息来自 GitHub Releases，页面会自动检查最新稳定版。", en: "Download information comes from GitHub Releases and is refreshed automatically." },
  visualCaptionLead: { zh: "27 种控件 · 所见即所得", en: "27 widgets · WYSIWYG" },
  visualCaptionTitle: { zh: "预览与导出使用同一套解析规则", en: "Preview and export share the same parsing rules" },
  trustOneTitle: { zh: "零代码搭建界面", en: "Build UIs without code" },
  trustOneDesc: { zh: "拖拽控件、配置属性和绑定键即可", en: "Drag widgets, set properties and binding keys" },
  trustTwoTitle: { zh: "设计器内连接设备", en: "Connect devices in the designer" },
  trustTwoDesc: { zh: "预览运行时直接收发串口数据", en: "The live preview talks to the serial port directly" },
  trustThreeTitle: { zh: "导出即可独立运行", en: "Exports run on their own" },
  trustThreeDesc: { zh: "生成 Python 项目，可打包为 exe / .app", en: "A Python project, ready to package as exe / .app" },
  workflowEyebrow: { zh: "工作流程", en: "Workflow" },
  workflowTitle: { zh: "从画布到可分发的上位机", en: "From canvas to a distributable host app" },
  workflowDescription: { zh: "显示类控件按绑定键从串口数据中取值，交互类控件按发送模式组帧下发。设计器预览与导出程序共用同一份串口和解析实现，预览里调通的行为导出后保持一致。", en: "Display widgets read values from serial data by binding key; interactive widgets build and send frames in their send mode. The preview and the exported program share one serial and parsing implementation, so what works in the preview behaves the same after export." },
  bindTitle: { zh: "接收：数据绑定", en: "Receive: data binding" },
  bindDescription: { zh: "支持键值匹配、JSON 路径、HEX 字节偏移和 Modbus RTU 寄存器解析；数值、LED、进度条、仪表盘和曲线按绑定键更新。", en: "Key/value matching, JSON paths, HEX byte offsets and Modbus RTU registers. Values, LEDs, progress bars, gauges and plots update by binding key." },
  sendTitle: { zh: "发送：命令配置", en: "Send: commands" },
  sendDescription: { zh: "按钮、开关、滑块等控件可按文本、HEX 或 Modbus 模式发送，命令模板用 <code>{value}</code> 占位符代入控件当前值。", en: "Buttons, switches, sliders and more send in text, HEX or Modbus mode. Command templates substitute the widget's current value into a <code>{value}</code> placeholder." },
  viewGuide: { zh: "查看使用说明与协议说明", en: "Read the user guide and protocol reference" },
  consoleTitle: { zh: "串口数据与导出项目", en: "Serial data and exported project" },
  consoleRxLabel: { zh: "每行一帧，按绑定键取值", en: "One frame per line, read by key" },
  consoleExportLabel: { zh: "导出的独立项目", en: "Standalone exported project" },
  flowDesign: { zh: "设计界面", en: "Design" },
  flowDesignDetail: { zh: "拖拽 · 对齐 · 属性", en: "Drag · align · properties" },
  flowBind: { zh: "绑定数据", en: "Bind data" },
  flowBindDetail: { zh: "绑定键 · 解析模式 · 命令", en: "Keys · parsers · commands" },
  flowPreview: { zh: "预览运行", en: "Preview" },
  flowPreviewDetail: { zh: "连接串口实时测试", en: "Live test on a serial port" },
  flowExport: { zh: "导出打包", en: "Export & package" },
  flowExportDetail: { zh: "Python 项目 · exe · .app", en: "Python project · exe · .app" },
  capabilitiesEyebrow: { zh: "功能介绍", en: "Features" },
  capabilitiesTitle: { zh: "设计、通信、绘图与打包", en: "Design, communicate, plot and package" },
  capabilitiesDescription: { zh: "面向串口设备的常见上位机需求：参数显示、状态指示、控制命令、实时曲线和数据记录，都能在画布上完成配置。", en: "The usual host-app needs for serial devices — readouts, status indicators, control commands, live plots and data logging — are all configured on the canvas." },
  featureDesignerTitle: { zh: "可视化设计器", en: "Visual designer" },
  featureDesignerDesc: { zh: "拖拽式画布，支持网格吸附、左右顶底对齐与横纵分布，画布尺寸自由设置并可缩放；工程保存为 .uidp 文件。", en: "A drag-and-drop canvas with grid snapping, edge alignment and even distribution, any canvas size and zoom. Projects are saved as .uidp files." },
  featureWidgetsTitle: { zh: "27 种控件", en: "27 widgets" },
  featureWidgetsDesc: { zh: "基础、布局、显示、图表和复合控件，包括 LED 指示灯、仪表盘、进度环、数据表格，以及串口配置、收发和 Modbus 配置卡片。", en: "Basic, layout, display, chart and composite widgets, including LEDs, gauges, progress rings, data tables, and serial, send/receive and Modbus setup cards." },
  featureParseTitle: { zh: "串口通信与解析", en: "Serial I/O and parsing" },
  featureParseDesc: { zh: "自动扫描端口，可设波特率、数据位、校验位、停止位和流控；支持行文本、HEX 帧和 Modbus RTU 解析，Modbus 响应校验 CRC。", en: "Automatic port scanning with baud rate, data bits, parity, stop bits and flow control. Line text, HEX frame and Modbus RTU parsers, with CRC checks on Modbus responses." },
  featureSendTitle: { zh: "命令发送", en: "Sending commands" },
  featureSendDesc: { zh: "文本模式可选换行符，HEX 模式支持帧头帧尾和数据类型打包，Modbus 模式自动构建 RTU 帧并支持轮询。", en: "Text mode with optional line endings, HEX mode with frame header/footer and typed packing, and Modbus mode that builds RTU frames and polls." },
  featureChartTitle: { zh: "实时曲线", en: "Live plots" },
  featureChartDesc: { zh: "多通道曲线带游标，约 33 ms 批量刷新；完整采样历史可导出为 CSV / JSON，也可重新加载查看。", en: "Multi-channel plots with cursors, refreshed in batches about every 33 ms. Export the full sample history as CSV / JSON and load it back later." },
  featureExportTitle: { zh: "代码导出与打包", en: "Code export and packaging" },
  featureExportDesc: { zh: "导出可独立运行的 Python 项目；内置 Nuitka 一键打包，实时显示编译输出，完成后自动清理缓存并压缩为 zip。", en: "Export a standalone Python project, or package it with built-in Nuitka: live compiler output, then automatic cache cleanup and a zip." },
  workspaceEyebrow: { zh: "导出示例", en: "Exported demo" },
  workspaceTitle: { zh: "串口采集 Demo", en: "Serial acquisition demo" },
  workspaceDescription: { zh: "仓库中的 demo 包含可编辑的 .uidp 工程、完整导出代码和模拟串口设备，不接硬件也能体验温度/压力采集与命令发送。", en: "The repository's demo ships an editable .uidp project, the full exported code and a simulated serial device, so you can try temperature/pressure acquisition and commands without hardware." },
  workspacePointOne: { zh: "选择 DEMO 端口即可连接模拟设备，无需硬件", en: "Pick the DEMO port to connect to the simulated device" },
  workspacePointTwo: { zh: "数值显示、进度环、LED、双通道曲线、字段表格和事件日志", en: "Readouts, a progress ring, LED, two-channel plot, field table and event log" },
  workspacePointThree: { zh: "整个 demo 文件夹可复制到仓库外独立运行", en: "Copy the demo folder anywhere and it runs on its own" },
  viewDemo: { zh: "查看 demo 说明", en: "Read the demo guide" },
  workspaceCaption: { zh: "由 PyQt UI Designer 导出的串口采集 Demo（深色主题）", en: "Serial acquisition demo exported from PyQt UI Designer (dark theme)" },
  downloadEyebrow: { zh: "最新稳定版", en: "Latest stable" },
  downloadTitle: { zh: "下载运行包", en: "Download a package" },
  downloadDescription: { zh: "各平台 zip 均内置 Python 和 Qt，解压即可运行，无需另装 Python。", en: "Every zip bundles Python and Qt. Unzip and run; no separate Python install needed." },
  viewRelease: { zh: "在 GitHub 查看 Release", en: "View release on GitHub" },
  recommended: { zh: "推荐", en: "Recommended" },
  windowsDescription: { zh: "解压后运行 main.exe。适用于 Windows 10 / 11。", en: "Unzip and run main.exe. For Windows 10 / 11." },
  macArmDescription: { zh: "适用于 M 系列芯片的 Mac，解压后打开 PyQt UI Designer.app。", en: "For Macs with M-series chips. Unzip and open PyQt UI Designer.app." },
  macIntelDescription: { zh: "适用于 Intel 芯片的 Mac，解压后打开 PyQt UI Designer.app。", en: "For Intel Macs. Unzip and open PyQt UI Designer.app." },
  format: { zh: "格式", en: "Format" },
  size: { zh: "大小", en: "Size" },
  packageIncludes: { zh: "内置 Python + Qt", en: "Python + Qt included" },
  downloadWindows: { zh: "下载 Windows 版", en: "Download for Windows" },
  downloadMacArm: { zh: "下载 Apple Silicon 版", en: "Download for Apple Silicon" },
  downloadMacIntel: { zh: "下载 Intel 版", en: "Download for Intel Mac" },
  downloadNote: { zh: "下载按钮直接连接 GitHub Release 附件，每个包都提供 .zip.sha256 校验文件。安装包暂未签名：Windows 出现 SmartScreen 提示时点击“更多信息 → 仍要运行”；Mac 版未做 Developer ID 签名与公证。应用内“一键打包”仍需本机 Python 与 C/C++ 编译工具。", en: "Buttons link directly to GitHub Release assets, each with a .zip.sha256 file. Packages are unsigned: if Windows SmartScreen appears, choose “More info → Run anyway”; the Mac builds are not Developer ID signed or notarized. In-app packaging still needs a local Python and C/C++ compiler." },
  runFromSource: { zh: "从源码运行", en: "Run from source" },
  guideLink: { zh: "使用说明", en: "User guide" },
  sourceCode: { zh: "查看源代码", en: "View source" },
  openEyebrow: { zh: "开放源码", en: "Open source" },
  openTitle: { zh: "源码与许可证", en: "Source code and license" },
  openDescription: { zh: "PyQt UI Designer 基于 PyQt5、PyQt-Fluent-Widgets、pyqtgraph 与 pyserial 构建，使用 Nuitka 打包，采用 GPLv3 许可证。TCP、MQTT 等通信方式正在开发中，欢迎提交 PR。", en: "PyQt UI Designer is built with PyQt5, PyQt-Fluent-Widgets, pyqtgraph and pyserial, packaged with Nuitka, and licensed under GPLv3. TCP, MQTT and more transports are in progress; pull requests are welcome." },
  githubRepository: { zh: "GitHub 仓库", en: "GitHub repository" },
  reportIssue: { zh: "反馈问题", en: "Report an issue" },
  footerTagline: { zh: "面向硬件工程师的可视化上位机设计工具。", en: "A visual host-app designer for hardware engineers." },
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
  try { localStorage.setItem("pyqt-ui-designer-language", currentLanguage); } catch {}
}

function assetPlatform(assetName) {
  if (/windows-x64\.zip$/i.test(assetName)) return "windows";
  if (/macos-arm64\.zip$/i.test(assetName)) return "macos-arm64";
  if (/macos-x64\.zip$/i.test(assetName)) return "macos-x64";
  return null;
}

function preferredPlatform() {
  const hint = `${navigator.userAgent} ${navigator.platform}`.toLowerCase();
  // Browsers report Intel in the Mac user agent even on Apple Silicon, so default Macs to arm64.
  if (hint.includes("mac")) return "macos-arm64";
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
try { savedLanguage = localStorage.getItem("pyqt-ui-designer-language") || "zh"; } catch {}
initTheme();
applyLanguage(savedLanguage);
// The GitHub API can take seconds to answer, so pick the platform from the built-in links first.
updatePrimaryDownload(preferredPlatform());
refreshLatestRelease();
