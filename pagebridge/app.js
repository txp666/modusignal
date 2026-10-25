const REPOSITORY = "txp666/PageBridge";
const RELEASE_API = `https://api.github.com/repos/${REPOSITORY}/releases/latest`;
const FALLBACK_RELEASE_DATE = "2026-10-25T07:20:02Z";

const copy = {
  skipLink: { zh: "跳到主要内容", en: "Skip to main content" },
  brandLabel: { zh: "PageBridge 首页", en: "PageBridge home" },
  brandTagline: { zh: "PDF 阅读与翻译", en: "Read and translate PDFs" },
  navLabel: { zh: "产品页面导航", en: "Product page navigation" },
  navReading: { zh: "对照阅读", en: "Side by side" },
  navFeatures: { zh: "功能", en: "Features" },
  navPlatforms: { zh: "双平台", en: "Mac & Windows" },
  navPrivacy: { zh: "数据与限制", en: "Data & limits" },
  navDownloads: { zh: "下载", en: "Download" },
  backToModusignal: { zh: "返回 modusignal", en: "Back to modusignal" },
  heroPlatforms: { zh: "macOS 14+ 与 Windows 11", en: "macOS 14+ and Windows 11" },
  heroTitle: { zh: "<span class=\"pb-title-line\">保留排版翻译 PDF</span><span class=\"pb-title-line\">原文与译文并排读</span>", en: "<span class=\"pb-title-line\">Translate PDFs, keep the layout,</span><span class=\"pb-title-line\">read both side by side</span>" },
  heroLede: { zh: "PageBridge 是 Mac 与 Windows 原生的 PDF 阅读工作区。整篇或按页翻译，图表、公式和版面留在原位；对照阅读时可以同步滚动、批注，也可以向文档助手提问。翻译用你自己的模型：本机 Ollama 或 OpenAI 兼容 API。", en: "PageBridge is a native PDF reading workspace for Mac and Windows. Translate a whole document or chosen pages while figures, formulas and layout stay where they were; then scroll the original and translation together, annotate, or ask the document assistant. Translation runs on your own model: local Ollama or any OpenAI-compatible API." },
  downloadNow: { zh: "立即下载", en: "Download" },
  allDownloads: { zh: "全部下载选项", en: "All downloads" },
  primaryOther: { zh: "在 Mac 或 Windows 电脑上安装", en: "Install on a Mac or Windows PC" },
  releaseSource: { zh: "下载链接来自 GitHub Releases，页面会自动检查最新版本。", en: "Download links come from GitHub Releases and are checked for the latest version automatically." },
  modeGroupLabel: { zh: "阅读视图", en: "Reading view" },
  modeOriginal: { zh: "原文", en: "Original" },
  modeDual: { zh: "对照", en: "Side by side" },
  modeTranslation: { zh: "译文", en: "Translation" },
  modeNoteOriginal: { zh: "原文：按 PDF 原样显示，可选择、搜索和批注文字。", en: "Original: the PDF as published, with text you can select, search and annotate." },
  modeNoteDual: { zh: "对照：左侧原文、右侧译文，可开启同步滚动。", en: "Side by side: original on the left, translation on the right, with optional synchronized scrolling." },
  modeNoteTranslation: { zh: "译文：沿用原 PDF 的版面、图表和页码，文字换成中文。", en: "Translation: the original layout, figures and page numbers, with the text in Chinese." },
  stageCaption: { zh: "示例文档：Rougier 等，<cite>Ten Simple Rules for Better Figures</cite>，PLOS Computational Biology 2014（CC0）。中文为 PageBridge 机器翻译结果，界面为 Mac 版 0.4.0。", en: "Sample: Rougier et al., <cite>Ten Simple Rules for Better Figures</cite>, PLOS Computational Biology 2014 (CC0). The Chinese is PageBridge's machine translation; the interface is the Mac app, version 0.4.0." },
  flowTitle: { zh: "从打开一篇 PDF 到导出译文", en: "From opening a PDF to exporting the translation" },
  stepImportTitle: { zh: "导入或检索", en: "Import or search" },
  stepImportDesc: { zh: "拖入 PDF 或点击 + 导入；也可以按标题、关键词或 DOI 检索 OpenAlex，下载全文后直接打开。", en: "Drop in a PDF or import it with +, or search OpenAlex by title, keyword or DOI and open the full text directly." },
  stepTranslateTitle: { zh: "选页翻译", en: "Translate pages" },
  stepTranslateDesc: { zh: "选择目标语言和页码，例如 <code>1-5, 8</code>。任务可随时取消，失败或取消都不会覆盖上次成功的译文。", en: "Pick the target language and pages, such as <code>1-5, 8</code>. You can cancel at any time; a failed or cancelled run never replaces the last good translation." },
  stepReadTitle: { zh: "对照阅读", en: "Read side by side" },
  stepReadDesc: { zh: "在原文、对照、译文间切换，同步滚动、文内搜索，用缩略图、目录和书签定位，边读边批注或提问。", en: "Switch between original, side-by-side and translation, scroll in sync, search, jump with thumbnails, outline and bookmarks, and annotate or ask as you read." },
  stepExportTitle: { zh: "导出", en: "Export" },
  stepExportDesc: { zh: "导出原文、译文或原译逐页交替的双语 PDF；批注另存为批注 PDF 或 Markdown 笔记。", en: "Export the original, the translation, or a bilingual PDF that alternates pages; save annotations as an annotated PDF or Markdown notes." },
  featuresTitle: { zh: "读的时候顺手做的事", en: "What you do while reading" },
  featuresDesc: { zh: "批注、提问和找文献都在同一个窗口里完成，不用在阅读器、翻译网站和笔记软件之间来回切换。", en: "Annotate, ask questions and find papers in the same window, without hopping between a reader, a translation site and a notes app." },
  notesTitle: { zh: "批注与笔记", en: "Annotations and notes" },
  notesDesc: { zh: "选中文字即可高亮、加下划线或写笔记，也可以给当前页加笔记和书签。笔记面板按页列出所有批注，点一下回到原处。", en: "Select text to highlight, underline or add a note, or note and bookmark the current page. The notes panel lists every annotation by page; click one to jump back to it." },
  notesPointSource: { zh: "原文和译文的批注分开保存，添加前可选择来源", en: "Annotations on the original and the translation are kept apart; choose which one before you add" },
  notesPointHash: { zh: "批注绑定 PDF 的哈希，重新翻译不会让旧批注错位", en: "Annotations are tied to the PDF's hash, so a new translation never misplaces old ones" },
  notesPointExport: { zh: "导出带批注的 PDF，或带页码和摘录的 Markdown 笔记", en: "Export an annotated PDF, or Markdown notes with page numbers and excerpts" },
  assistantTitle: { zh: "文档助手", en: "Document assistant" },
  assistantDesc: { zh: "在阅读时向文档提问，助手使用你已配置的模型，可以和翻译用不同的模型。回答里的 <code>[P3]</code> 引用能展开，核对当次实际交给模型的原文片段，并跳回对应页面。", en: "Ask the document questions as you read. The assistant uses a model you have already set up, which can differ from the one used for translation. Citations such as <code>[P3]</code> expand to the exact excerpt the model was given, and jump to that page." },
  scopeLabel: { zh: "提问范围与每次提供的内容", en: "Question scopes and what each one sends" },
  scopeDocTitle: { zh: "文档问答", en: "Document" },
  scopeDocDesc: { zh: "本机挑选相关片段，最多 6 页、12,000 字符", en: "Relevant excerpts picked on your computer, up to 6 pages and 12,000 characters" },
  scopePageTitle: { zh: "当前页", en: "Current page" },
  scopePageDesc: { zh: "最多 2,400 字符，不一定是整页", en: "Up to 2,400 characters, not always the whole page" },
  scopeSelectionTitle: { zh: "选中文字", en: "Selection" },
  scopeSelectionDesc: { zh: "当前选区，最多 6,000 字符", en: "The current selection, up to 6,000 characters" },
  scopeFreeTitle: { zh: "自由提问", en: "Open question" },
  scopeFreeDesc: { zh: "只发送问题和近期对话，不再提取 PDF", en: "Only your question and recent conversation; nothing new from the PDF" },
  assistantNote: { zh: "助手每次只看到有限的片段，不代表模型通读了全文；引用只说明该页片段被提供过，结论仍需对照原文。", en: "The assistant only sees limited excerpts each time, not the whole document. A citation shows that an excerpt was provided, not that the conclusion is right; check the original." },
  searchTitle: { zh: "在线文献检索", en: "Literature search" },
  searchDesc: { zh: "用标题、关键词或 DOI 检索 OpenAlex，选择全文来源后直接下载到文档库。下载会先校验文件；与库里已有的文档相同时，直接打开原来那份，保留译文和笔记。", en: "Search OpenAlex by title, keyword or DOI, choose a full-text source and download straight into your library. Downloads are checked first; if the file matches one you already have, that copy opens with its translation and notes intact." },
  searchPointQuery: { zh: "输入时不发请求，点击搜索后检索词才发送给 OpenAlex", en: "Nothing is sent while you type; the query goes to OpenAlex when you press Search" },
  searchPointVerify: { zh: "遇到网站验证时在应用内自行完成，应用不代答验证码", en: "If a site asks for verification, you complete it in the app; PageBridge never solves CAPTCHAs" },
  searchPointLimit: { zh: "单文件上限 100 MB，网页、登录页和无效文件不会被当作 PDF 导入", en: "Up to 100 MB per file; web pages, login pages and invalid files are never imported as PDFs" },
  alsoLabel: { zh: "其他功能", en: "Also included" },
  alsoLibraryTitle: { zh: "文档库", en: "Library" },
  alsoLibraryDesc: { zh: "文件夹、名称搜索、排序、收藏、最近阅读和回收站。", en: "Folders, name search, sorting, favorites, recent documents and a trash." },
  alsoModelsTitle: { zh: "翻译服务", en: "Translation services" },
  alsoModelsDesc: { zh: "DeepSeek、阿里云百炼、硅基流动、OpenAI、本机 Ollama，或任意 OpenAI 兼容 API。", en: "DeepSeek, Alibaba Cloud Bailian, SiliconFlow, OpenAI, local Ollama, or any OpenAI-compatible API." },
  alsoExportTitle: { zh: "导出", en: "Export" },
  alsoExportDesc: { zh: "原文、译文和逐页交替的双语 PDF，另存到你选择的位置。", en: "Original, translated and page-alternating bilingual PDFs, saved wherever you choose." },
  alsoUpdateTitle: { zh: "更新", en: "Updates" },
  alsoUpdateDesc: { zh: "应用内检查更新并校验签名，由你确认后再安装。", en: "Check for updates in the app; signatures are verified and nothing installs until you confirm." },
  platformsTitle: { zh: "Mac 和 Windows 各有一个原生版本", en: "A native app on Mac and on Windows" },
  platformsDesc: { zh: "两个版本共用同一套翻译引擎，界面分别用各自平台的原生框架编写，功能基本一致。", en: "Both versions share one translation engine; each interface is built with its platform's native framework, and the features largely match." },
  platformSystem: { zh: "系统", en: "System" },
  platformUi: { zh: "界面", en: "UI" },
  platformKeys: { zh: "密钥", en: "Keys" },
  platformUpdates: { zh: "更新", en: "Updates" },
  macSystem: { zh: "macOS 14 或更新，Apple Silicon", en: "macOS 14 or later, Apple Silicon" },
  macKeys: { zh: "macOS 钥匙串", en: "macOS Keychain" },
  macUpdates: { zh: "Sparkle，校验更新签名", en: "Sparkle, with signed updates" },
  windowsSystem: { zh: "Windows 11 x64", en: "Windows 11 x64" },
  windowsKeys: { zh: "Windows 凭据管理器", en: "Windows Credential Manager" },
  windowsUpdates: { zh: "签名更新清单，经你确认后运行安装向导", en: "Signed update manifest; the installer runs after you confirm" },
  platformsNote: { zh: "两端文档库格式不同，暂不支持直接互拷数据目录或跨平台同步。尚无 Intel Mac 和原生 Windows ARM64 版本。", en: "The two libraries use different formats, so data folders can't be copied across or synced yet. There is no Intel Mac or native Windows ARM64 build." },
  windowsNotes: { zh: "Windows 版功能与已知差异", en: "Windows features and known differences" },
  windowsCaption: { zh: "Windows 11 上的 PageBridge 0.4.0（浅色主题）", en: "PageBridge 0.4.0 on Windows 11 (light theme)" },
  privacyTitle: { zh: "哪些数据会离开你的电脑", en: "What leaves your computer" },
  privacyDesc: { zh: "文档解析与排版都在本机完成。只有你调用在线服务时，相应的内容才会发出去。", en: "Parsing and layout happen on your computer. Content is sent out only when you use an online service." },
  localTitle: { zh: "只留在本机", en: "Stays on your computer" },
  localPdf: { zh: "PDF 原文、译文和文档库", en: "Original PDFs, translations and the library" },
  localNotes: { zh: "批注、笔记和书签", en: "Annotations, notes and bookmarks" },
  localChat: { zh: "助手对话记录（每份文档最多保留最近 40 条）", en: "Assistant conversations (the latest 40 per document)" },
  localKeys: { zh: "API Key，保存在钥匙串或 Windows 凭据管理器", en: "API keys, kept in the Keychain or Windows Credential Manager" },
  sentTitle: { zh: "调用在线服务时发送", en: "Sent when you use an online service" },
  sentTranslateWhat: { zh: "待翻译的文本", en: "Text to translate" },
  sentTranslateWhere: { zh: "你选择的模型服务；用本机 Ollama 时不出本机", en: "The model service you chose; with local Ollama it stays on your computer" },
  sentAssistantWhat: { zh: "助手的问题、片段与近期对话", en: "Assistant questions, excerpts and recent conversation" },
  sentAssistantWhere: { zh: "你为助手选择的模型服务", en: "The model service you chose for the assistant" },
  sentSearchWhat: { zh: "文献检索词", en: "Literature search queries" },
  sentDoiWhat: { zh: "DOI 或下载请求", en: "DOIs or download requests" },
  sentDoiWhere: { zh: "你选择的全文来源", en: "The full-text source you chose" },
  limitsLabel: { zh: "使用限制", en: "Limitations" },
  limitOcr: { zh: "不提供通用 OCR，扫描件需要自带文本层。", en: "There is no general OCR; scanned PDFs need their own text layer." },
  limitAccuracy: { zh: "机器翻译和 AI 回答可能出错，公式、数字和关键条款请对照原文。", en: "Machine translation and AI answers can be wrong; check formulas, numbers and key clauses against the original." },
  limitModels: { zh: "应用不包含语言模型，也不附带云服务额度；Ollama 和模型需要另行安装。", en: "No language model or cloud credit is included; install Ollama and models separately." },
  downloadsTitle: { zh: "下载", en: "Download" },
  downloadsDesc: { zh: "安装包自带 Python 和翻译引擎，无需另装 Python；首次翻译可能还会下载字体和版面资源。", en: "Packages bundle Python and the translation engine, so there's nothing else to install; the first translation may download fonts and layout resources." },
  viewRelease: { zh: "在 GitHub 查看发行说明", en: "Release notes on GitHub" },
  matchDevice: { zh: "适合这台设备", en: "Matches this device" },
  macCardTitle: { zh: "Mac 版", en: "Mac" },
  macCardDesc: { zh: "解压后把 PageBridge.app 拖入“应用程序”。需要 macOS 14 或更新。", en: "Unzip and drag PageBridge.app to Applications. Requires macOS 14 or later." },
  format: { zh: "格式", en: "Format" },
  size: { zh: "大小", en: "Size" },
  downloadMac: { zh: "下载 Mac 版", en: "Download for Mac" },
  setupCardTitle: { zh: "Windows 安装器", en: "Windows installer" },
  setupCardDesc: { zh: "按向导选择目录和快捷方式，默认装到当前用户目录。卸载会保留文档库、配置和系统凭据。", en: "The wizard lets you choose a folder and shortcuts, installing for the current user by default. Uninstalling keeps your library, settings and stored credentials." },
  downloadSetup: { zh: "下载安装器", en: "Download installer" },
  portableCardTitle: { zh: "Windows 便携 ZIP", en: "Windows portable ZIP" },
  portableCardDesc: { zh: "完整解压后运行 PageBridge.Windows.exe，保留所有子目录。应用内更新会启动安装向导，不会就地替换便携目录。", en: "Extract everything and run PageBridge.Windows.exe, keeping all subfolders. In-app updates launch the installer rather than replacing the portable folder." },
  downloadPortable: { zh: "下载便携版", en: "Download portable" },
  signingNote: { zh: "Mac 包目前为 ad-hoc 签名，尚未经过 Developer ID 签名和 Apple 公证；Windows 安装器和程序尚无 Authenticode 签名。请核对下载来源和 SHA-256，再按系统提示确认打开。Windows 应用内的网页验证需要系统 WebView2 Runtime。", en: "The Mac package is ad-hoc signed and not yet Developer ID signed or notarized by Apple; the Windows installer and app are not Authenticode signed. Check the source and SHA-256, then confirm when your system asks. In-app web verification on Windows uses the system WebView2 Runtime." },
  openTitle: { zh: "开放源码", en: "Open source" },
  openDesc: { zh: "PageBridge 的原创代码采用 AGPL-3.0-only。翻译基于 <a href=\"https://github.com/PDFMathTranslate-next/PDFMathTranslate-next\" target=\"_blank\" rel=\"noreferrer\">PDFMathTranslate-next</a> 与 <a href=\"https://github.com/funstory-ai/BabelDOC\" target=\"_blank\" rel=\"noreferrer\">BabelDOC</a>，第三方组件保留各自的许可。每个发行版都附有项目源码和第三方对应源码。", en: "PageBridge's original code is licensed AGPL-3.0-only. Translation is built on <a href=\"https://github.com/PDFMathTranslate-next/PDFMathTranslate-next\" target=\"_blank\" rel=\"noreferrer\">PDFMathTranslate-next</a> and <a href=\"https://github.com/funstory-ai/BabelDOC\" target=\"_blank\" rel=\"noreferrer\">BabelDOC</a>; third-party components keep their own licenses. Every release includes the project source and the corresponding third-party source." },
  githubRepository: { zh: "GitHub 仓库", en: "GitHub repository" },
  userGuide: { zh: "使用指南", en: "User guide (Chinese)" },
  reportIssue: { zh: "反馈问题", en: "Report an issue" },
  footerTagline: { zh: "Mac 与 Windows 原生 PDF 阅读与翻译工作区。", en: "A native PDF reading and translation workspace for Mac and Windows." },
  footerNavLabel: { zh: "页脚导航", en: "Footer navigation" },
  footerCredits: { zh: "截图来自 PageBridge 0.4.0 实际界面。示例论文：Rougier 等 2014（CC0）与 Sandve 等 2013（CC BY）；译文和助手回答为机器生成。", en: "Screenshots show the actual PageBridge 0.4.0 interface. Sample papers: Rougier et al. 2014 (CC0) and Sandve et al. 2013 (CC BY); translations and assistant answers are machine-generated." },
};

const MODE_NOTES = { original: "modeNoteOriginal", dual: "modeNoteDual", translation: "modeNoteTranslation" };
const PLATFORM_LABELS = {
  "macos-arm64": "macOS · Apple Silicon",
  "windows-setup": "Windows 11 x64",
  "windows-zip": "Windows 11 x64",
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
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#0b1118" : "#f5f7f8");
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

function setMode(mode) {
  if (!MODE_NOTES[mode]) return;
  document.querySelectorAll("[data-mode]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.mode === mode));
  });
  document.querySelectorAll("[data-mode-image]").forEach((image) => {
    const active = image.dataset.modeImage === mode;
    image.classList.toggle("is-active", active);
    if (active) image.removeAttribute("aria-hidden");
    else image.setAttribute("aria-hidden", "true");
  });
  const note = document.querySelector("[data-mode-note]");
  note.dataset.copy = MODE_NOTES[mode];
  note.innerHTML = copy[MODE_NOTES[mode]][currentLanguage];
}

function applyLanguage(language) {
  currentLanguage = language === "en" ? "en" : "zh";
  document.documentElement.lang = currentLanguage === "zh" ? "zh-CN" : "en";
  document.querySelectorAll("[data-copy]").forEach((element) => {
    const value = copy[element.dataset.copy]?.[currentLanguage];
    if (value) element.innerHTML = value;
  });
  document.querySelectorAll("[data-copy-label]").forEach((element) => {
    const value = copy[element.dataset.copyLabel]?.[currentLanguage];
    if (value) element.setAttribute("aria-label", value);
  });
  const toggle = document.querySelector("[data-language-toggle]");
  toggle.textContent = currentLanguage === "zh" ? "EN" : "中";
  toggle.setAttribute("aria-label", currentLanguage === "zh" ? "Switch to English" : "切换到中文");
  updateThemeButton();
  const releaseDate = latestRelease?.published_at || FALLBACK_RELEASE_DATE;
  document.querySelectorAll("[data-release-date]").forEach((element) => {
    element.textContent = formatReleaseDate(releaseDate);
  });
  updatePrimaryDownload(preferredPlatform());
  try { localStorage.setItem("pagebridge-language", currentLanguage); } catch {}
}

function assetPlatform(assetName) {
  const name = assetName.replace(/\.sha256$/i, "");
  if (/macOS-arm64\.zip$/i.test(name)) return "macos-arm64";
  if (/windows-x64-setup\.exe$/i.test(name)) return "windows-setup";
  if (/windows-x64\.zip$/i.test(name)) return "windows-zip";
  return null;
}

function preferredPlatform() {
  const hint = `${navigator.userAgent} ${navigator.platform}`.toLowerCase();
  // iPadOS reports a Mac user agent; touch points tell it apart from a real Mac.
  const touchMac = hint.includes("mac") && navigator.maxTouchPoints > 1;
  if (touchMac || /iphone|ipad|ipod|android|mobile|linux|cros/.test(hint)) return "other";
  if (hint.includes("mac")) return "macos-arm64";
  return "windows-setup";
}

function updatePrimaryDownload(platform) {
  const primary = document.querySelector("[data-primary-download]");
  const label = primary.querySelector("[data-primary-download-label]");
  document.querySelectorAll("[data-platform]").forEach((card) => {
    const matched = card.dataset.platform === platform;
    card.classList.toggle("recommended", matched);
    card.querySelector("[data-match-note]")?.toggleAttribute("hidden", !matched);
    const button = card.querySelector("[data-asset]");
    button?.classList.toggle("button-primary", matched);
    button?.classList.toggle("button-secondary", !matched);
  });

  const source = document.querySelector(`[data-asset="${platform}"]`);
  if (!source) {
    primary.href = "#downloads";
    label.textContent = copy.primaryOther[currentLanguage];
    return;
  }
  const card = source.closest("[data-platform]");
  const format = card.querySelector("dd")?.textContent;
  const size = document.querySelector(`[data-asset-size="${platform}"]`)?.textContent;
  primary.href = source.href;
  label.textContent = [PLATFORM_LABELS[platform], format, size].filter(Boolean).join(" · ");
}

function applyRelease(release) {
  latestRelease = release;
  const version = String(release.tag_name || "").replace(/^v/i, "");
  if (version) document.querySelectorAll("[data-release-version]").forEach((element) => { element.textContent = version; });
  if (release.published_at) document.querySelectorAll("[data-release-date]").forEach((element) => { element.textContent = formatReleaseDate(release.published_at); });
  if (release.html_url) document.querySelectorAll("[data-release-page]").forEach((element) => { element.href = release.html_url; });

  for (const asset of release.assets || []) {
    const platform = assetPlatform(asset.name);
    if (!platform || !asset.browser_download_url) continue;
    if (/\.sha256$/i.test(asset.name)) {
      const checksum = document.querySelector(`[data-checksum="${platform}"]`);
      if (checksum) checksum.href = asset.browser_download_url;
      continue;
    }
    const link = document.querySelector(`[data-asset="${platform}"]`);
    const size = document.querySelector(`[data-asset-size="${platform}"]`);
    if (link) link.href = asset.browser_download_url;
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
    // Keep the v0.4.0 links already in the page.
  }
}

document.querySelector("[data-language-toggle]").addEventListener("click", () => {
  applyLanguage(currentLanguage === "zh" ? "en" : "zh");
});

document.querySelectorAll("[data-mode]").forEach((button) => {
  button.addEventListener("click", () => setMode(button.dataset.mode));
});

let savedLanguage = "zh";
try { savedLanguage = localStorage.getItem("pagebridge-language") || "zh"; } catch {}
initTheme();
applyLanguage(savedLanguage);
refreshLatestRelease();
