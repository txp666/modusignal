const REPOSITORY = "txp666/FluentSerialAssistant";
const RELEASE_API = `https://api.github.com/repos/${REPOSITORY}/releases/latest`;

const copy = {
  skipLink: { zh: "跳到主要内容", en: "Skip to main content" },
  brandTagline: { zh: "现代串口调试工作台", en: "Modern serial debugging workbench" },
  navCapabilities: { zh: "核心能力", en: "Capabilities" },
  navWorkspace: { zh: "软件界面", en: "Workspace" },
  navDownloads: { zh: "下载", en: "Downloads" },
  backToModusignal: { zh: "返回 modusignal", en: "Back to modusignal" },
  stableRelease: { zh: "最新稳定版", en: "Latest stable" },
  heroEyebrow: { zh: "跨平台 · 开源 · Fluent Design", en: "Cross-platform · Open source · Fluent Design" },
  heroTitle: { zh: "串口调试，<br />从连接到自动化", en: "Serial debugging,<br />from connection to automation" },
  heroDescription: { zh: "一套专注日常效率的桌面串口工作台。看清每一帧数据，组织常用指令，绘制实时曲线，再用宏命令和脚本把重复测试交给软件。", en: "A desktop serial workbench built for daily efficiency. Inspect every frame, organize frequent commands, plot live data, then hand repetitive tests to macros and scripts." },
  downloadNow: { zh: "立即下载", en: "Download now" },
  allPlatforms: { zh: "查看全部平台", en: "All platforms" },
  releaseSource: { zh: "下载信息来自 GitHub Releases，页面会自动检查最新稳定版。", en: "Download information comes from GitHub Releases and is refreshed automatically." },
  visualCaptionLead: { zh: "多标签终端工作台", en: "Multi-tab terminal workbench" },
  visualCaptionTitle: { zh: "参数、记录和发送区各就各位", en: "Settings, records and sending stay in their place" },
  trustOneTitle: { zh: "看清数据", en: "See the data" },
  trustOneDesc: { zh: "文本、HEX、混合显示与自动断帧", en: "Text, HEX, mixed view and automatic framing" },
  trustTwoTitle: { zh: "组织流程", en: "Organize the flow" },
  trustTwoDesc: { zh: "常用包、协议模板、宏命令和自动应答", en: "Packets, templates, macros and auto replies" },
  trustThreeTitle: { zh: "跨平台发布", en: "Cross-platform releases" },
  trustThreeDesc: { zh: "Windows、macOS 与 Linux 原生构建", en: "Native Windows, macOS and Linux builds" },
  capabilitiesEyebrow: { zh: "不止是收发窗口", en: "Beyond send and receive" },
  capabilitiesTitle: { zh: "从一次连接，走到完整测试流程", en: "From first connection to a complete test flow" },
  capabilitiesDescription: { zh: "常用功能保持顺手，复杂能力按需展开。无论临时看日志，还是搭建可重复的设备测试，都不需要切换工具。", en: "Everyday actions stay close while advanced tools unfold when needed. Inspect a quick log or build a repeatable device test without switching apps." },
  featureTerminalTitle: { zh: "清晰的串口终端", en: "A clear serial terminal" },
  featureTerminalDesc: { zh: "独立配置收发编码，支持文本、HEX、混合显示、搜索过滤、时间戳、自动断帧与多标签会话。", en: "Configure receive and send encodings separately, with text, HEX, mixed view, search, timestamps, automatic framing and multi-tab sessions." },
  featureProtocolTitle: { zh: "协议与校验工具", en: "Protocol and checksum tools" },
  featureProtocolDesc: { zh: "用协议模板拆解帧结构，内置 Modbus RTU 与常见 CRC、LRC、XOR、SUM8 计算及发送追加。", en: "Break frames down with protocol templates and use built-in Modbus RTU plus CRC, LRC, XOR and SUM8 calculation and appending." },
  featureAutomationTitle: { zh: "可复用的自动化", en: "Reusable automation" },
  featureAutomationDesc: { zh: "宏命令支持多步骤、等待响应、循环和失败中止；JavaScript 脚本可读取记录并控制发送。", en: "Macros support multiple steps, response waits, loops and stop-on-failure; JavaScript can inspect records and control sending." },
  featureVisualTitle: { zh: "实时曲线与数据表格", en: "Live plots and data tables" },
  featureVisualDesc: { zh: "从分隔值、键值对或 JSON 中提取多通道数字，实时绘图并导出 CSV；也可逐帧排序和过滤。", en: "Extract multiple channels from delimited values, key/value pairs or JSON, plot them live, export CSV, and sort or filter individual frames." },
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
  downloadTitle: { zh: "选择你的平台，开始串口调试", en: "Choose your platform and start debugging" },
  viewRelease: { zh: "在 GitHub 查看 Release", en: "View release on GitHub" },
  recommended: { zh: "推荐", en: "Recommended" },
  windowsDescription: { zh: "免安装便携包，解压后运行 FluentSerialAssistant.exe。", en: "Portable package. Extract it and run FluentSerialAssistant.exe." },
  macDescription: { zh: "适用于 macOS 的应用归档，解压后将应用移入“应用程序”。", en: "Application archive for macOS. Extract it and move the app to Applications." },
  linuxDescription: { zh: "包含启动脚本和运行依赖的便携归档，解压后即可运行。", en: "Portable archive with launcher and runtime dependencies, ready after extraction." },
  format: { zh: "格式", en: "Format" },
  size: { zh: "大小", en: "Size" },
  downloadWindows: { zh: "下载 Windows 版", en: "Download for Windows" },
  downloadMac: { zh: "下载 macOS 版", en: "Download for macOS" },
  downloadLinux: { zh: "下载 Linux 版", en: "Download for Linux" },
  downloadNote: { zh: "下载按钮直接连接 GitHub Release 附件；如自动检查失败，仍会使用页面内置的已验证版本。", en: "Buttons link directly to GitHub Release assets. If the live check fails, the verified built-in release remains available." },
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
  if (latestRelease?.published_at) {
    document.querySelectorAll("[data-release-date]").forEach((element) => {
      element.textContent = formatReleaseDate(latestRelease.published_at);
    });
  }
  try { localStorage.setItem("fluent-serial-language", currentLanguage); } catch {}
}

function assetPlatform(assetName) {
  if (/windows-x64\.zip$/i.test(assetName)) return "windows";
  if (/macos\.tar\.gz$/i.test(assetName)) return "macos";
  if (/linux-x64\.tar\.gz$/i.test(assetName)) return "linux";
  return null;
}

function preferredPlatform() {
  const hint = `${navigator.userAgent} ${navigator.platform}`.toLowerCase();
  if (hint.includes("mac")) return "macos";
  if (hint.includes("linux")) return "linux";
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
