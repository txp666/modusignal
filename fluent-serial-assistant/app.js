const REPOSITORY = "txp666/FluentSerialAssistant";
const RELEASE_API = `https://api.github.com/repos/${REPOSITORY}/releases/latest`;
const FALLBACK_RELEASE_DATE = "2026-10-30T08:17:40Z";

const copy = {
  skipLink: { zh: "跳到主要内容", en: "Skip to main content" },
  brandTagline: { zh: "GUI · CLI · MCP 串口工作台", en: "GUI · CLI · MCP serial workbench" },
  navAiControl: { zh: "CLI / MCP", en: "CLI / MCP" },
  navCapabilities: { zh: "功能介绍", en: "Features" },
  navWorkspace: { zh: "软件界面", en: "Workspace" },
  navDownloads: { zh: "下载", en: "Downloads" },
  backToModusignal: { zh: "返回 modusignal", en: "Back to modusignal" },
  stableRelease: { zh: "最新稳定版", en: "Latest stable" },
  heroEyebrow: { zh: "GUI · CLI · MCP · 跨平台", en: "GUI · CLI · MCP · Cross-platform" },
  heroTitle: { zh: "<span class=\"hero-title-line\">串口收发与协议调试</span><span class=\"hero-title-line\">支持 CLI / MCP 控制</span>", en: "<span class=\"hero-title-line\">Serial I/O and protocol tools</span><span class=\"hero-title-line\">With CLI / MCP control</span>" },
  heroDescription: { zh: "支持文本/HEX 收发、协议解析、日志记录和实时曲线。串口由 GUI 管理，脚本和 MCP 客户端可复用当前会话，执行端口扫描、连接、数据收发和绘图操作。", en: "Supports text/HEX I/O, protocol parsing, logging and live plots. The GUI manages the serial port; scripts and MCP clients reuse the active session to scan ports, connect, exchange data and control plots." },
  downloadNow: { zh: "立即下载", en: "Download now" },
  allPlatforms: { zh: "查看全部平台", en: "All platforms" },
  exploreAiControl: { zh: "了解 CLI / MCP", en: "Explore CLI / MCP" },
  releaseSource: { zh: "下载信息来自 GitHub Releases，页面会自动检查最新稳定版。", en: "Download information comes from GitHub Releases and is refreshed automatically." },
  visualCaptionLead: { zh: "CLI + MCP 已随安装包提供", en: "CLI + MCP included in every package" },
  visualCaptionTitle: { zh: "CLI 与 MCP 复用 GUI 串口会话", en: "CLI and MCP reuse the GUI serial session" },
  trustOneTitle: { zh: "GUI 唯一持有串口", en: "The GUI owns the port" },
  trustOneDesc: { zh: "外部控制复用会话，不重复打开设备", en: "External control reuses sessions instead of reopening devices" },
  trustTwoTitle: { zh: "CLI 输出稳定 JSON", en: "Stable JSON from the CLI" },
  trustTwoDesc: { zh: "适合终端、Shell 脚本与自动测试", en: "Built for terminals, shell scripts and automated tests" },
  trustThreeTitle: { zh: "MCP 提供 12 个工具", en: "12 MCP tools" },
  trustThreeDesc: { zh: "支持端口扫描、连接、收发、记录读取和绘图控制", en: "Port scanning, connections, data exchange, record retrieval and plot control" },
  aiEyebrow: { zh: "CLI / MCP 接口", en: "CLI / MCP interfaces" },
  aiTitle: { zh: "GUI、命令行与 MCP 共享会话", en: "Shared sessions for GUI, CLI and MCP" },
  aiDescription: { zh: "可在 GUI 中操作，也可通过 CLI 编写脚本，或由 AI 客户端调用 MCP 工具。各入口使用同一会话中的协议解析、收发记录和曲线配置。", en: "Use the GUI, write CLI scripts or call MCP tools from an AI client. Each interface uses the same session, protocol parser, traffic records and plot settings." },
  cliTitle: { zh: "命令行与自动测试", en: "Command line and automated tests" },
  cliDescription: { zh: "端口扫描、会话选择、连接、文本/HEX 收发、记录读取、协议选择和绘图控制均返回稳定 JSON。", en: "Port discovery, session selection, connection, text/HEX I/O, record retrieval, protocol selection and plot control all return stable JSON." },
  mcpTitle: { zh: "MCP 工具调用", en: "MCP tools" },
  mcpDescription: { zh: "stdio MCP 服务提供 12 个工具，使用 JSON Schema 定义参数并返回结构化结果，包含操作失败时的错误信息。", en: "The stdio MCP server exposes 12 tools with JSON Schema parameters and structured results, including error details when an operation fails." },
  viewAiDocs: { zh: "查看 CLI、MCP 与 IPC 接入文档", en: "Read the CLI, MCP and IPC integration guide" },
  consoleTitle: { zh: "控制当前 GUI 会话", en: "Control the active GUI session" },
  consoleCliLabel: { zh: "扫描、发送、读取", en: "Discover, send, read" },
  consoleMcpLabel: { zh: "MCP 客户端配置", en: "MCP client configuration" },
  flowClients: { zh: "AI 客户端 / 脚本", en: "AI client / script" },
  flowIpc: { zh: "用户级本地 IPC", en: "User-scoped local IPC" },
  flowGui: { zh: "Fluent GUI 会话", en: "Fluent GUI session" },
  flowGuiDetail: { zh: "协议 · 记录 · 曲线", en: "Protocols · records · plots" },
  flowDevice: { zh: "串口设备", en: "Serial device" },
  flowDeviceDetail: { zh: "由 GUI 唯一持有", en: "Owned only by the GUI" },
  capabilitiesEyebrow: { zh: "功能介绍", en: "Features" },
  capabilitiesTitle: { zh: "收发、解析、记录与绘图", en: "Send, parse, log and plot" },
  capabilitiesDescription: { zh: "支持多标签串口会话、帧协议模板、宏命令和 JavaScript 自动化，可按调试任务配置日志与曲线窗口。", en: "Use multiple serial tabs, frame protocol templates, macros and JavaScript automation. Configure logs and plot windows for each test." },
  featureTerminalTitle: { zh: "串口终端", en: "Serial terminal" },
  featureTerminalDesc: { zh: "独立配置收发编码，支持文本、HEX、混合显示、搜索过滤、内容着色、时间戳、自动断帧与多标签会话。", en: "Configure receive and send encodings separately, with text, HEX, mixed view, search, content coloring, timestamps, automatic framing and multi-tab sessions." },
  featureProtocolTitle: { zh: "协议与校验工具", en: "Protocol and checksum tools" },
  featureProtocolDesc: { zh: "在可视化编辑器中定义帧头、长度、命令、载荷、校验和帧尾；内置 Modbus RTU 与 CRC、LRC、XOR、SUM8，发送时可自动追加校验并跳过帧头帧尾。", en: "Define the header, length, command, payload, checksum and tail in a visual frame editor. Modbus RTU and CRC, LRC, XOR and SUM8 are built in, and checksums can be appended on send while skipping header and tail bytes." },
  featureAutomationTitle: { zh: "宏命令与自动化接口", en: "Macros and automation interfaces" },
  featureAutomationDesc: { zh: "可用宏命令和 JavaScript 执行重复操作，也可通过 CLI 或 MCP 从外部脚本、测试程序及 AI 客户端控制。", en: "Run repeated operations with macros and JavaScript, or control them through CLI and MCP from scripts, tests and AI clients." },
  featureVisualTitle: { zh: "实时曲线与导出", en: "Live plots and export" },
  featureVisualDesc: { zh: "同时打开多个独立曲线窗口，从全部数字、分隔值、键值对、JSON 或二进制字段中提取数值，实时绘图并导出 CSV；CLI/MCP 也可打开和配置曲线。", en: "Open several plot windows at once, extract values from bare numbers, delimited values, key/value pairs, JSON or binary fields, plot them live and export CSV. CLI/MCP can also open and configure plots." },
  featureSendTitle: { zh: "发送工具", en: "Sending tools" },
  featureSendDesc: { zh: "支持保存常用数据包、查看发送历史、循环发送、自动应答和分块文件发送；内置虚拟串口对，没有硬件也能测试双向通信。", en: "Save packets, browse send history, repeat transmissions, configure automatic replies and send files in chunks. A built-in virtual port pair tests two-way traffic without hardware." },
  featureRecordTitle: { zh: "日志、恢复与更新", en: "Logs, recovery and updates" },
  featureRecordDesc: { zh: "自动日志支持 TXT、CSV、BIN 与滚动存储；会话参数、规则和测试配置可在下次启动时恢复。应用内检查更新，确认后自动下载、校验并安装。", en: "Automatic logging supports TXT, CSV, BIN and file rotation; session settings, rules and tests return on the next launch. The app checks for updates and, once you confirm, downloads, verifies and installs them." },
  workspaceEyebrow: { zh: "界面截图", en: "Screenshot" },
  workspaceTitle: { zh: "多标签会话、终端与发送区", en: "Tabs, terminal and sending" },
  workspaceDescription: { zh: "左侧可折叠的卡片设置连接、接收、协议模板、发送、Modbus 和常用包，主区域显示终端记录，顶部实时统计收发速率和累计流量，底部输入发送内容。支持浅色、深色和系统主题。", en: "Collapsible cards on the left set up the connection, receiving, protocol templates, sending, Modbus and saved packets. The main area shows the terminal, with live rates and totals above it and the send box below. Light, dark and system themes are available." },
  workspacePointOne: { zh: "扫描端口并显示描述、厂商、VID / PID 与序列号", en: "Scan ports with descriptions, vendors, VID / PID and serial numbers" },
  workspacePointTwo: { zh: "内容着色：内置 ESP-IDF 日志、日志等级、AT 指令响应等预设，也可按关键词或正则自定义", en: "Content coloring: presets for ESP-IDF logs, log levels, AT responses and more, or your own keyword and regex rules" },
  workspacePointThree: { zh: "内置虚拟串口对：两个会话分别连接 VIRTUAL-A 和 VIRTUAL-B 即可互相收发", en: "Built-in virtual port pair: connect two sessions to VIRTUAL-A and VIRTUAL-B and they talk to each other" },
  workspacePointFour: { zh: "简体中文与 English 可即时切换，无需重启", en: "Switch between Simplified Chinese and English without restarting" },
  workspaceCaption: { zh: "终端工作台：多标签会话、日志着色和流量统计", en: "Terminal workbench: tabs, colored logs and traffic statistics" },
  screensEyebrow: { zh: "曲线与协议", en: "Plots and protocols" },
  screensTitle: { zh: "曲线窗口与帧协议编辑器", en: "Plot windows and the frame editor" },
  screensDescription: { zh: "曲线窗口按协议提取字段并实时绘图，同一会话可以同时打开多个；帧协议编辑器用彩色字节标出帧结构，编辑字段或样例即可看到解析值和校验结果。", en: "Plot windows pull fields out by protocol and draw them live, several per session if you like. The frame editor colors each byte by its field and updates the parsed values and checksum result as you edit fields or the sample." },
  plotCaption: { zh: "曲线窗口：按协议提取字段并实时绘图", en: "Plot window: fields extracted by protocol and drawn live" },
  editorCaption: { zh: "帧协议编辑器：字节结构、字段和校验一目了然", en: "Frame editor: byte layout, fields and checksum at a glance" },
  downloadEyebrow: { zh: "最新稳定版", en: "Latest stable" },
  downloadTitle: { zh: "下载安装包", en: "Download an installer" },
  downloadDescription: { zh: "Windows、macOS 与 Linux 安装包均已包含命令行和 MCP 服务程序。v0.1.14 及更新版本可在应用内检查更新。", en: "Windows, macOS and Linux packages all include the command-line and MCP server programs. Version 0.1.14 and later can update from inside the app." },
  viewRelease: { zh: "在 GitHub 查看 Release", en: "View release on GitHub" },
  recommended: { zh: "推荐", en: "Recommended" },
  windowsDescription: { zh: "Inno Setup 安装包会请求管理员权限，并默认安装到 Windows 的 Program Files 目录。", en: "The Inno Setup installer requests administrator privileges and installs to Windows Program Files by default." },
  macDescription: { zh: "打开 DMG，将 Fluent Serial Assistant 拖入“应用程序”文件夹。", en: "Open the DMG and drag Fluent Serial Assistant into the Applications folder." },
  linuxDescription: { zh: "适用于 x64 或 64 位 ARM 的 Debian、Ubuntu 及其衍生发行版，可使用 APT 安装。", en: "For x64 or 64-bit ARM Debian, Ubuntu and derivatives. Install the matching DEB package with APT." },
  format: { zh: "格式", en: "Format" },
  size: { zh: "大小", en: "Size" },
  packageIncludes: { zh: "GUI + CLI + MCP", en: "GUI + CLI + MCP" },
  downloadWindows: { zh: "下载 Windows 版", en: "Download for Windows" },
  downloadMac: { zh: "下载 macOS 版", en: "Download for macOS" },
  downloadLinuxX64: { zh: "下载 Linux x64 版", en: "Download Linux x64" },
  downloadLinuxArm64: { zh: "下载 Linux arm64 版", en: "Download Linux arm64" },
  downloadNote: { zh: "下载按钮直接连接 GitHub Release 附件，每个平台包均提供 SHA-256 校验文件。Windows Authenticode 开源签名正在申请中，当前安装包暂未签名。", en: "Buttons link directly to GitHub Release assets, with SHA-256 files for every package. Open-source Windows Authenticode signing is being applied for; the current installer is unsigned." },
  englishReadme: { zh: "English README", en: "English README" },
  signingPolicy: { zh: "签名政策", en: "Signing policy" },
  sourceCode: { zh: "查看源代码", en: "View source" },
  openEyebrow: { zh: "开放源码", en: "Open source" },
  openTitle: { zh: "源码与许可证", en: "Source code and license" },
  openDescription: { zh: "Fluent 串口助手基于 C++17、Qt 6 Widgets 与 FluentQtWidgets 构建，采用 GPL-3.0-or-later 许可证。", en: "Fluent Serial Assistant is built with C++17, Qt 6 Widgets and FluentQtWidgets, and licensed under GPL-3.0-or-later." },
  githubRepository: { zh: "GitHub 仓库", en: "GitHub repository" },
  reportIssue: { zh: "反馈问题", en: "Report an issue" },
  footerTagline: { zh: "跨平台串口调试工具，支持 GUI、CLI 与 MCP。", en: "Cross-platform serial tools with GUI, CLI and MCP." },
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
  try { localStorage.setItem("fluent-serial-language", currentLanguage); } catch {}
}

function assetPlatform(assetName) {
  if (/windows-x64-setup\.exe$/i.test(assetName)) return "windows";
  if (/macos-arm64\.dmg$/i.test(assetName)) return "macos";
  if (/linux-x64\.deb$/i.test(assetName)) return "linux-x64";
  if (/linux-arm64\.deb$/i.test(assetName)) return "linux-arm64";
  return null;
}

function preferredPlatform() {
  const hint = `${navigator.userAgent} ${navigator.platform}`.toLowerCase();
  if (hint.includes("mac")) return "macos";
  if (hint.includes("linux")) return hint.includes("arm64") || hint.includes("aarch64") ? "linux-arm64" : "linux-x64";
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
    updatePrimaryDownload(preferredPlatform());
  }
}

document.querySelector("[data-language-toggle]").addEventListener("click", () => {
  applyLanguage(currentLanguage === "zh" ? "en" : "zh");
});

let savedLanguage = "zh";
try { savedLanguage = localStorage.getItem("fluent-serial-language") || "zh"; } catch {}
initTheme();
applyLanguage(savedLanguage);
refreshLatestRelease();
