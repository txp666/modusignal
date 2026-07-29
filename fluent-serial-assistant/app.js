const REPOSITORY = "txp666/FluentSerialAssistant";
const RELEASE_API = `https://api.github.com/repos/${REPOSITORY}/releases/latest`;
const FALLBACK_RELEASE_DATE = "2026-07-29T14:23:19Z";

const copy = {
  skipLink: { zh: "跳到主要内容", en: "Skip to main content" },
  brandTagline: { zh: "GUI · CLI · MCP 串口工作台", en: "GUI · CLI · MCP serial workbench" },
  navAiControl: { zh: "CLI / MCP", en: "CLI / MCP" },
  navCapabilities: { zh: "核心能力", en: "Capabilities" },
  navWorkspace: { zh: "软件界面", en: "Workspace" },
  navDownloads: { zh: "下载", en: "Downloads" },
  backToModusignal: { zh: "返回 modusignal", en: "Back to modusignal" },
  stableRelease: { zh: "最新稳定版", en: "Latest stable" },
  heroEyebrow: { zh: "GUI · CLI · MCP · 跨平台", en: "GUI · CLI · MCP · Cross-platform" },
  heroTitle: { zh: "<span class=\"hero-title-line\">串口调试</span><span class=\"hero-title-line\">现在交给 AI</span>", en: "<span class=\"hero-title-line\">Serial debugging</span><span class=\"hero-title-line\">now speaks AI</span>" },
  heroDescription: { zh: "GUI 继续掌控串口，机器可读 CLI 与 MCP 安全复用当前会话。让脚本和 AI 扫描端口、连接设备、精确收发、读取结构化记录并打开实时曲线。", en: "The GUI stays in control of the serial port while a machine-readable CLI and MCP safely reuse the active session. Let scripts and AI discover ports, connect devices, exchange exact data, read structured records and open live plots." },
  downloadNow: { zh: "立即下载", en: "Download now" },
  allPlatforms: { zh: "查看全部平台", en: "All platforms" },
  exploreAiControl: { zh: "了解 CLI / MCP", en: "Explore CLI / MCP" },
  releaseSource: { zh: "下载信息来自 GitHub Releases，页面会自动检查最新稳定版。", en: "Download information comes from GitHub Releases and is refreshed automatically." },
  visualCaptionLead: { zh: "CLI + MCP 已随安装包提供", en: "CLI + MCP included in every package" },
  visualCaptionTitle: { zh: "复用 GUI 会话，不与串口抢占", en: "Reuse the GUI session without competing for the port" },
  trustOneTitle: { zh: "GUI 唯一持有串口", en: "The GUI owns the port" },
  trustOneDesc: { zh: "外部控制复用会话，不重复打开设备", en: "External control reuses sessions instead of reopening devices" },
  trustTwoTitle: { zh: "CLI 输出稳定 JSON", en: "Stable JSON from the CLI" },
  trustTwoDesc: { zh: "适合终端、Shell 脚本与自动测试", en: "Built for terminals, shell scripts and automated tests" },
  trustThreeTitle: { zh: "MCP 提供 12 个工具", en: "12 MCP tools" },
  trustThreeDesc: { zh: "让 AI 发现并调用完整串口能力", en: "Let AI discover and call the complete serial toolkit" },
  aiEyebrow: { zh: "新增 · AI 与自动化控制", en: "New · AI and automation control" },
  aiTitle: { zh: "同一个串口会话，三种操作方式", en: "One serial session, three ways to work" },
  aiDescription: { zh: "在 GUI 中观察和调整，在 CLI 中编排脚本，在 MCP 客户端中直接让 AI 调用工具。三者共享会话、协议解析、收发记录和实时曲线。", en: "Observe and adjust in the GUI, orchestrate scripts through the CLI, or let AI call tools through an MCP client. All three share sessions, protocol parsing, traffic records and live plots." },
  cliTitle: { zh: "为终端和自动测试而生", en: "Built for terminals and automated tests" },
  cliDescription: { zh: "端口扫描、会话选择、连接、文本/HEX 收发、记录读取、协议选择和绘图控制均返回稳定 JSON。", en: "Port discovery, session selection, connection, text/HEX I/O, record retrieval, protocol selection and plot control all return stable JSON." },
  mcpTitle: { zh: "把串口能力变成 AI 工具", en: "Turn serial capabilities into AI tools" },
  mcpDescription: { zh: "标准 stdio MCP 服务提供 12 个可发现工具、JSON Schema 参数和结构化结果，业务错误可由模型识别并修正。", en: "The standard stdio MCP server exposes 12 discoverable tools with JSON Schema inputs and structured results, including actionable errors models can correct." },
  viewAiDocs: { zh: "查看 CLI、MCP 与 IPC 接入文档", en: "Read the CLI, MCP and IPC integration guide" },
  consoleTitle: { zh: "控制当前 GUI 会话", en: "Control the active GUI session" },
  consoleCliLabel: { zh: "扫描、发送、读取", en: "Discover, send, read" },
  consoleMcpLabel: { zh: "一次配置，按需调用", en: "Configure once, call on demand" },
  flowClients: { zh: "AI 客户端 / 脚本", en: "AI client / script" },
  flowIpc: { zh: "用户级本地 IPC", en: "User-scoped local IPC" },
  flowGui: { zh: "Fluent GUI 会话", en: "Fluent GUI session" },
  flowGuiDetail: { zh: "协议 · 记录 · 曲线", en: "Protocols · records · plots" },
  flowDevice: { zh: "串口设备", en: "Serial device" },
  flowDeviceDetail: { zh: "由 GUI 唯一持有", en: "Owned only by the GUI" },
  capabilitiesEyebrow: { zh: "不止是收发窗口", en: "Beyond send and receive" },
  capabilitiesTitle: { zh: "从一次连接，走到完整测试流程", en: "From first connection to a complete test flow" },
  capabilitiesDescription: { zh: "常用功能保持顺手，复杂能力按需展开。无论临时看日志，还是搭建可重复的设备测试，都不需要切换工具。", en: "Everyday actions stay close while advanced tools unfold when needed. Inspect a quick log or build a repeatable device test without switching apps." },
  featureTerminalTitle: { zh: "清晰的串口终端", en: "A clear serial terminal" },
  featureTerminalDesc: { zh: "独立配置收发编码，支持文本、HEX、混合显示、搜索过滤、时间戳、自动断帧与多标签会话。", en: "Configure receive and send encodings separately, with text, HEX, mixed view, search, timestamps, automatic framing and multi-tab sessions." },
  featureProtocolTitle: { zh: "协议与校验工具", en: "Protocol and checksum tools" },
  featureProtocolDesc: { zh: "用协议模板拆解帧结构，内置 Modbus RTU 与常见 CRC、LRC、XOR、SUM8 计算及发送追加。", en: "Break frames down with protocol templates and use built-in Modbus RTU plus CRC, LRC, XOR and SUM8 calculation and appending." },
  featureAutomationTitle: { zh: "从宏命令到 AI 工具", en: "From macros to AI tools" },
  featureAutomationDesc: { zh: "内置宏和 JavaScript 处理桌面自动化；机器可读 CLI 与 MCP 把同一套能力开放给脚本、测试和 AI。", en: "Built-in macros and JavaScript cover desktop automation, while the machine-readable CLI and MCP expose the same capabilities to scripts, tests and AI." },
  featureVisualTitle: { zh: "高性能实时绘图", en: "High-performance live plotting" },
  featureVisualDesc: { zh: "从分隔值、键值对或 JSON 中提取多通道数字，以高性能实时曲线呈现并导出 CSV；CLI/MCP 也可直接打开和配置曲线。", en: "Extract multiple channels from delimited values, key/value pairs or JSON and render high-performance live plots with CSV export; CLI/MCP can open and configure them directly." },
  featureSendTitle: { zh: "面向现场的发送工具", en: "Practical sending tools" },
  featureSendDesc: { zh: "常用包、发送历史、循环发送、自动应答和分块文件发送覆盖调试现场的高频操作。", en: "Saved packets, history, cyclic sending, automatic replies and chunked file transfer cover common field workflows." },
  featureRecordTitle: { zh: "完整记录与恢复", en: "Complete logging and recovery" },
  featureRecordDesc: { zh: "自动日志支持 TXT、CSV、BIN 与滚动存储；会话参数、规则和测试配置可在下次启动时恢复。", en: "Automatic logging supports TXT, CSV, BIN and file rotation; session settings, rules and tests return on the next launch." },
  workspaceEyebrow: { zh: "真实软件界面", en: "The real application" },
  workspaceTitle: { zh: "熟悉的串口操作，放进更安静的工作区", en: "Familiar serial tasks in a calmer workspace" },
  workspaceDescription: { zh: "连接配置和接收选项留在左侧，搜索、统计与终端记录集中在主区域，发送输入始终触手可及。浅色、深色和系统主题均可切换。", en: "Connection settings and receive options stay on the left; search, statistics and records share the main area; sending is always close. Choose light, dark or system themes." },
  workspacePointOne: { zh: "扫描端口并显示描述、厂商、VID / PID 与序列号", en: "Scan ports with descriptions, vendors, VID / PID and serial numbers" },
  workspacePointTwo: { zh: "RX / TX 统一记录，实时显示流量、速率和连接时长", en: "Unified RX / TX records with live totals, rates and connection time" },
  workspacePointThree: { zh: "简体中文与 English 可即时切换，无需重启", en: "Switch between Simplified Chinese and English without restarting" },
  workspaceCaption: { zh: "Fluent 串口助手终端工作台", en: "Fluent Serial Assistant terminal workbench" },
  downloadEyebrow: { zh: "最新稳定版", en: "Latest stable" },
  downloadTitle: { zh: "一次安装，同时获得 GUI、CLI 与 MCP", en: "One install gives you GUI, CLI and MCP" },
  downloadDescription: { zh: "Windows、macOS 与 Linux 安装包均已包含命令行和 MCP 服务程序。", en: "Windows, macOS and Linux packages all include the command-line and MCP server programs." },
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
  openTitle: { zh: "工具保持透明，工作流由你掌控", en: "Transparent tooling, workflows you control" },
  openDescription: { zh: "Fluent 串口助手基于 C++17、Qt 6 Widgets 与 FluentQtWidgets 构建，采用 GPL-3.0-or-later 许可证。", en: "Fluent Serial Assistant is built with C++17, Qt 6 Widgets and FluentQtWidgets, and licensed under GPL-3.0-or-later." },
  githubRepository: { zh: "GitHub 仓库", en: "GitHub repository" },
  reportIssue: { zh: "反馈问题", en: "Report an issue" },
  footerTagline: { zh: "让每一次串口会话更清楚、更可复用。", en: "Make every serial session clearer and reusable." },
};

let currentLanguage = "zh";
let latestRelease = null;

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
applyLanguage(savedLanguage);
refreshLatestRelease();
