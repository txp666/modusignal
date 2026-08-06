import {
  findHartLinkReleaseAsset,
  formatHartLinkReleaseDate,
  formatReleaseAssetSize,
  loadLatestHartLinkRelease,
} from "./release.js?v=release-module";

const PRIMARY_DOWNLOADS = {
  windows: {
    architecture: "x64",
    packageType: "exe",
    labelKey: "windowsPrimaryLabel",
  },
  macos: {
    architecture: "arm64",
    packageType: "dmg",
    labelKey: "macPrimaryLabel",
  },
  linux: {
    architecture: "x64",
    packageType: "deb",
    labelKey: "linuxPrimaryLabel",
  },
};

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
  const isEnglish = document.documentElement.lang.startsWith("en");
  const label = isEnglish
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
    theme === "dark" ? "#0b1419" : "#f3f7f6",
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

const COPY = {
  zh: {
    brandTagline: "HART 设备工作台",
    navCapabilities: "核心能力",
    navScreens: "软件界面",
    navDownloads: "下载",
    backToModusignal: "返回 modusignal",
    stableRelease: "稳定版",
    releaseDatePending: "自动同步最新版本",
    heroEyebrow: "跨平台 HART 主站软件",
    heroTitle: "把 HART 设备调试<br />做成一件清楚的事",
    heroDescription: "从连接、扫描、变量读取到通信帧解析，再到仪表设置、校准和 DD 工作区，一套桌面软件串起完整的设备调试流程。",
    downloadNow: "立即下载",
    allPlatforms: "查看全部平台",
    ddLicenseNote: "基础 HART 功能可直接使用；DD 解析与设备工作区需要有效许可证。",
    visualCaptionLead: "真实设备会话",
    visualCaptionTitle: "从原始帧到结构化结果，始终看得见",
    trustOneTitle: "单一通信入口",
    trustOneDesc: "事务队列、响应匹配、超时重试统一管理",
    trustTwoTitle: "可见的安全边界",
    trustTwoDesc: "写操作预览与确认，响应独立回读验证",
    trustThreeTitle: "三平台发布",
    trustThreeDesc: "Windows、macOS 与 Linux 原生安装包",
    capabilitiesEyebrow: "为真实调试流程设计",
    capabilitiesTitle: "不是一排命令按钮<br />而是一套完整工作台",
    capabilitiesDescription: "每个视图都围绕“当前设备、当前事务、当前结果”组织，让现场定位更快，也让复杂操作保持可追溯。",
    featureConnectTitle: "连接、发现与持续读取",
    featureConnectDesc: "支持短地址/长地址、轮询地址扫描、CMD 0 设备身份建立，以及 PV / SV / TV / QV 的持续读取。",
    featureConnectPointTwo: "自动建立在线设备身份",
    featureConnectPointThree: "变量卡片与实时曲线",
    featureTraceTitle: "通信 Trace 与帧解析",
    featureTraceDesc: "原始 TX/RX、结构化帧列表、响应码、设备状态和校验结果并列呈现，快速定位通信问题。",
    featureCommandTitle: "通用命令与自定义请求",
    featureCommandDesc: "内置通用命令表、请求帧预览与手动 Hex 请求；校验和由软件自动计算。",
    featureSettingsTitle: "仪表设置与校准",
    featureSettingsDesc: "集中管理量程、单位、阻尼、标识、日期、地址、回路电流与脉冲模式，并保留通信记录。",
    featureDdTitle: "DD 设备管理",
    featureDdDesc: "导入厂商 DD 压缩包，按设备身份匹配修订版本，为每台设备建立独立、可恢复的工作区。",
    featureUpdateTitle: "内置软件更新",
    featureUpdateDesc: "自动选择当前平台安装包，下载后执行文件大小与 SHA-256 双校验，再进入安装流程。",
    screensEyebrow: "真实软件界面",
    screensTitle: "信息密度很高<br />操作路径依然清晰",
    screenWorkbenchTitle: "通用设备工作台",
    screenWorkbenchDesc: "变量读取、通用命令、原始日志与结构化 Trace 同屏协作",
    screenDdTitle: "DD 设备管理",
    screenDdDesc: "许可证状态、DD 包导入与设备工作区集中管理",
    screenDdWorkspaceTitle: "DD 设备工作区",
    screenDdWorkspaceDesc: "DD 菜单、命令库与结构化 Trace 同屏定位",
    screenSettingsTitle: "仪表设置与校正",
    screenSettingsDesc: "输入输出校正、基本参数与脉冲模式操作集中呈现",
    previousScreen: "上一张",
    nextScreen: "下一张",
    workflowEyebrow: "三步进入工作状态",
    workflowTitle: "连接 HARTLink<br />然后专注设备本身",
    workflowOneTitle: "选择接口并连接",
    workflowOneDesc: "通过 HARTLink CDC 或兼容串口接入，软件使用标准 HART 串口参数。",
    workflowTwoTitle: "扫描并锁定身份",
    workflowTwoDesc: "扫描轮询地址，读取 CMD 0，并以设备身份约束后续 DD 与操作会话。",
    workflowThreeTitle: "读取、解析或配置",
    workflowThreeDesc: "从过程变量与通用命令开始，按需进入设置、校准或匹配的 DD 工作区。",
    downloadEyebrow: "HARTLink Studio 最新版",
    downloadTitle: "选择你的平台<br />开始设备调试",
    windowsPackageTitle: "中文安装程序",
    macDescription: "适用于搭载 Apple Silicon 的 Mac，打开镜像后拖入应用程序。",
    linuxDescription: "Debian / Ubuntu 推荐 DEB；其他发行版可使用便携 TAR.GZ。",
    fileSize: "文件大小",
    downloadWindows: "下载 Windows 版",
    downloadMac: "下载 macOS 版",
    windowsPrimaryLabel: "Windows x64 · 安装程序",
    macPrimaryLabel: "macOS · Apple Silicon · DMG",
    linuxPrimaryLabel: "Linux x64 · DEB",
    footerTagline: "让每一次 HART 会话都有迹可循。",
    contactForQuote: "联系 771454616@qq.com 获取报价",
    modusignalOnline: "modusignal 在线调试",
  },
  en: {
    brandTagline: "HART device workbench",
    navCapabilities: "Capabilities",
    navScreens: "Interface",
    navDownloads: "Download",
    backToModusignal: "Back to modusignal",
    stableRelease: "Stable",
    releaseDatePending: "Latest release synced automatically",
    heroEyebrow: "Cross-platform HART master software",
    heroTitle: "Make HART device work<br />clear from end to end",
    heroDescription: "Connection, discovery, live variables, frame analysis, instrument settings, calibration and DD workspaces—all in one focused desktop workflow.",
    downloadNow: "Download now",
    allPlatforms: "View all platforms",
    ddLicenseNote: "Core HART features are ready to use; DD parsing and device workspaces require a valid license.",
    visualCaptionLead: "Live device session",
    visualCaptionTitle: "From raw frames to structured results, nothing is hidden",
    trustOneTitle: "One communication path",
    trustOneDesc: "Unified transaction queue, response matching and retries",
    trustTwoTitle: "Visible safety boundaries",
    trustTwoDesc: "Write previews, confirmations and independent readback",
    trustThreeTitle: "Three-platform delivery",
    trustThreeDesc: "Native packages for Windows, macOS and Linux",
    capabilitiesEyebrow: "Built for real diagnostic workflows",
    capabilitiesTitle: "More than command buttons<br />A complete workbench",
    capabilitiesDescription: "Every view stays anchored to the current device, transaction and result, making field diagnosis faster and complex work traceable.",
    featureConnectTitle: "Connect, discover and monitor",
    featureConnectDesc: "Short and long addresses, polling-address scans, CMD 0 identity binding and continuous PV / SV / TV / QV reads.",
    featureConnectPointTwo: "Automatic online identity binding",
    featureConnectPointThree: "Variable cards and live charts",
    featureTraceTitle: "Communication trace and parsing",
    featureTraceDesc: "Raw TX/RX, structured frames, response codes, device status and checksum results stay side by side.",
    featureCommandTitle: "Universal and custom requests",
    featureCommandDesc: "Built-in universal commands, frame previews and manual Hex requests with automatic checksum calculation.",
    featureSettingsTitle: "Instrument settings and calibration",
    featureSettingsDesc: "Manage ranges, units, damping, tags, dates, addresses, loop current and burst mode with a retained communication log.",
    featureDdTitle: "DD device management",
    featureDdDesc: "Import vendor DD archives, match revisions to online identity and keep a restorable workspace for each device.",
    featureUpdateTitle: "Built-in updates",
    featureUpdateDesc: "Selects the right platform package, then verifies size and SHA-256 before installation.",
    screensEyebrow: "Actual product interface",
    screensTitle: "High information density<br />Clear interaction paths",
    screenWorkbenchTitle: "Universal device workbench",
    screenWorkbenchDesc: "Live variables, universal commands, raw logs and structured traces in one view",
    screenDdTitle: "DD device management",
    screenDdDesc: "License status, DD package imports and device workspaces",
    screenDdWorkspaceTitle: "DD device workspace",
    screenDdWorkspaceDesc: "DD menus, the command library and structured traces in one view",
    screenSettingsTitle: "Instrument settings and calibration",
    screenSettingsDesc: "I/O calibration, core parameters and burst-mode operations",
    previousScreen: "Previous",
    nextScreen: "Next",
    workflowEyebrow: "Ready in three steps",
    workflowTitle: "Connect HARTLink<br />Focus on the device",
    workflowOneTitle: "Select the interface and connect",
    workflowOneDesc: "Use HARTLink CDC or a compatible serial adapter with standard HART serial parameters.",
    workflowTwoTitle: "Discover and bind identity",
    workflowTwoDesc: "Scan polling addresses, read CMD 0 and scope DD and operation sessions to that identity.",
    workflowThreeTitle: "Read, parse or configure",
    workflowThreeDesc: "Start with variables and universal commands, then enter settings, calibration or the matching DD workspace.",
    downloadEyebrow: "HARTLink Studio latest release",
    downloadTitle: "Choose your platform<br />Start working with devices",
    windowsPackageTitle: "Chinese installer",
    macDescription: "For Apple Silicon Macs. Open the disk image and drag the app into Applications.",
    linuxDescription: "DEB is recommended for Debian / Ubuntu; other distributions can use the portable TAR.GZ.",
    fileSize: "File size",
    downloadWindows: "Download for Windows",
    downloadMac: "Download for macOS",
    windowsPrimaryLabel: "Windows x64 · Installer",
    macPrimaryLabel: "macOS · Apple Silicon · DMG",
    linuxPrimaryLabel: "Linux x64 · DEB",
    footerTagline: "Make every HART session traceable.",
    contactForQuote: "Contact 771454616@qq.com for pricing",
    modusignalOnline: "modusignal online tools",
  },
};

function detectPlatform() {
  const platform = `${navigator.userAgentData?.platform || ""} ${navigator.platform || ""} ${navigator.userAgent || ""}`.toLowerCase();
  if (platform.includes("mac")) return "macos";
  if (platform.includes("linux")) return "linux";
  return "windows";
}

function currentLanguage() {
  return document.documentElement.lang.startsWith("en") ? "en" : "zh";
}

function configurePrimaryDownload(release = latestRelease) {
  const platform = detectPlatform();
  const preference = PRIMARY_DOWNLOADS[platform];
  const asset = findHartLinkReleaseAsset(
    release,
    platform,
    preference.architecture,
    preference.packageType,
  );
  const labelText = COPY[currentLanguage()][preference.labelKey];
  const link = document.querySelector("[data-primary-download]");
  const label = document.querySelector("[data-primary-download-label]");
  link.href = asset?.url || "#downloads";
  link.dataset.downloadLabel = labelText;
  label.textContent = labelText;
  document.querySelector(`[data-platform="${platform}"]`)?.classList.add("recommended");
}

function renderLatestRelease(release = latestRelease) {
  if (!release) {
    configurePrimaryDownload(null);
    return;
  }

  const language = currentLanguage();
  const formattedDate = formatHartLinkReleaseDate(release.publishedAt, language);
  document.querySelectorAll("[data-release-version]").forEach((element) => {
    element.textContent = release.version;
  });
  document.querySelectorAll("[data-release-date]").forEach((element) => {
    element.textContent = language === "en" ? `Released ${formattedDate}` : `${formattedDate} 发布`;
  });

  const downloadEyebrow = document.querySelector('[data-copy="downloadEyebrow"]');
  if (downloadEyebrow) {
    downloadEyebrow.textContent = `HARTLink Studio ${release.version}`;
  }

  document.querySelectorAll("[data-download-asset]").forEach((link) => {
    const asset = findHartLinkReleaseAsset(
      release,
      link.dataset.os,
      link.dataset.architecture,
      link.dataset.packageType,
    );
    if (!asset) return;

    link.href = asset.url;
    link.title = `SHA-256: ${asset.sha256}`;
    if (link.dataset.assetLabel) {
      link.textContent = `${link.dataset.assetLabel} · ${formatReleaseAssetSize(asset.size, language)}`;
    }

    const card = link.closest(".download-card");
    if (card && !link.closest(".linux-downloads")) {
      const size = card.querySelector("[data-asset-size]");
      const digest = card.querySelector("[data-asset-sha]");
      if (size) size.textContent = formatReleaseAssetSize(asset.size, language);
      if (digest) {
        digest.textContent = `${asset.sha256.slice(0, 8)}…${asset.sha256.slice(-3)}`;
        digest.title = asset.sha256;
      }
    }
  });

  const schemaElement = document.querySelector("[data-release-schema]");
  const windowsAsset = findHartLinkReleaseAsset(release, "windows", "x64", "exe");
  if (schemaElement && windowsAsset) {
    const schema = JSON.parse(schemaElement.textContent);
    schema.softwareVersion = release.version;
    schema.datePublished = release.publishedAt;
    schema.downloadUrl = windowsAsset.url;
    schemaElement.textContent = JSON.stringify(schema);
  }

  configurePrimaryDownload(release);
}

async function refreshLatestRelease() {
  try {
    latestRelease = await loadLatestHartLinkRelease();
    renderLatestRelease(latestRelease);
  } catch (error) {
    console.error("Unable to refresh the HARTLink Studio release", error);
  }
}

function applyLanguage(language) {
  const copy = COPY[language] || COPY.zh;
  document.documentElement.lang = language === "en" ? "en-US" : "zh-CN";
  document.querySelectorAll("[data-copy]").forEach((element) => {
    const value = copy[element.dataset.copy];
    if (!value) return;
    if (value.includes("<br")) element.innerHTML = value;
    else element.textContent = value;
  });
  const toggle = document.querySelector("[data-language-toggle]");
  toggle.textContent = language === "en" ? "中文" : "EN";
  toggle.setAttribute("aria-label", language === "en" ? "切换到中文" : "Switch to English");
  updateThemeButton();
  document.querySelector("[data-screen-carousel]")?.setAttribute("aria-label", language === "en" ? "Software interface carousel" : "软件界面轮播");
  document.querySelectorAll("[data-carousel-dot]").forEach((dot, index) => {
    dot.setAttribute("aria-label", language === "en" ? `Show image ${index + 1}` : `查看第 ${index + 1} 张`);
  });
  document.querySelectorAll("[data-lightbox-title-key]").forEach((element) => {
    element.dataset.lightboxTitle = copy[element.dataset.lightboxTitleKey];
  });
  renderLatestRelease(latestRelease);
  try {
    localStorage.setItem("modusignal-lang", language);
  } catch {}
}

function initialLanguage() {
  try {
    return localStorage.getItem("modusignal-lang") === "en" ? "en" : "zh";
  } catch {
    return "zh";
  }
}

function bindLanguageToggle() {
  const toggle = document.querySelector("[data-language-toggle]");
  toggle.addEventListener("click", () => {
    applyLanguage(document.documentElement.lang.startsWith("en") ? "zh" : "en");
  });
}

function bindStickyHeader() {
  const header = document.querySelector("[data-sticky-header]");
  const update = () => header.classList.toggle("scrolled", window.scrollY > 10);
  update();
  window.addEventListener("scroll", update, { passive: true });
}

function bindImageDialog() {
  const dialog = document.querySelector("[data-image-dialog]");
  const image = document.querySelector("[data-image-dialog-image]");
  const title = document.querySelector("[data-image-dialog-title]");
  const closeButton = document.querySelector("[data-image-dialog-close]");

  document.querySelectorAll("[data-lightbox-src]").forEach((button) => {
    button.addEventListener("click", () => {
      image.src = button.dataset.lightboxSrc;
      image.alt = button.querySelector("img")?.alt || "HARTLink Studio";
      title.textContent = button.dataset.lightboxTitle;
      document.body.classList.add("dialog-open");
      dialog.showModal();
    });
  });

  const close = () => {
    dialog.close();
    document.body.classList.remove("dialog-open");
  };
  closeButton.addEventListener("click", close);
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) close();
  });
  dialog.addEventListener("close", () => document.body.classList.remove("dialog-open"));
}

function initScreenCarousel() {
  const carousel = document.querySelector("[data-screen-carousel]");
  const track = carousel?.querySelector("[data-carousel-track]");
  const slides = [...(carousel?.querySelectorAll("[data-carousel-slide]") || [])];
  const dots = [...(carousel?.querySelectorAll("[data-carousel-dot]") || [])];
  const previous = carousel?.querySelector("[data-carousel-prev]");
  const next = carousel?.querySelector("[data-carousel-next]");
  const status = carousel?.querySelector("[data-carousel-status]");
  if (!carousel || !track || slides.length === 0) return;

  let activeIndex = 0;
  let touchStartX = null;

  const show = (requestedIndex) => {
    activeIndex = (requestedIndex + slides.length) % slides.length;
    track.style.transform = `translate3d(-${activeIndex * 100}%, 0, 0)`;
    slides.forEach((slide, index) => {
      const active = index === activeIndex;
      slide.setAttribute("aria-hidden", String(!active));
      slide.tabIndex = active ? 0 : -1;
    });
    dots.forEach((dot, index) => dot.setAttribute("aria-current", String(index === activeIndex)));
    status.textContent = `${activeIndex + 1} / ${slides.length}`;
  };

  previous.addEventListener("click", () => show(activeIndex - 1));
  next.addEventListener("click", () => show(activeIndex + 1));
  dots.forEach((dot, index) => dot.addEventListener("click", () => show(index)));
  carousel.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") show(activeIndex - 1);
    if (event.key === "ArrowRight") show(activeIndex + 1);
  });
  carousel.addEventListener("touchstart", (event) => {
    touchStartX = event.changedTouches[0]?.clientX ?? null;
  }, { passive: true });
  carousel.addEventListener("touchend", (event) => {
    if (touchStartX === null) return;
    const distance = (event.changedTouches[0]?.clientX ?? touchStartX) - touchStartX;
    touchStartX = null;
    if (Math.abs(distance) < 45) return;
    show(activeIndex + (distance < 0 ? 1 : -1));
  }, { passive: true });

  show(0);
}

function initMotion() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const motionGroups = [
    [".hero-copy > *", 70],
    [".hero-visual", 0],
    [".trust-grid > p", 80],
    [".section-heading > *", 70],
    [".capability-card", 65],
    [".screen-card", 90],
    [".workflow-list > li", 90],
    [".download-heading > *", 80],
    [".download-card", 90],
    [".footer-grid > *", 70],
  ];

  const motionElements = [];
  motionGroups.forEach(([selector, delayStep]) => {
    document.querySelectorAll(selector).forEach((element, index) => {
      element.dataset.motion = "reveal";
      element.style.setProperty("--motion-delay", `${Math.min(index * delayStep, 360)}ms`);
      motionElements.push(element);
    });
  });

  document.documentElement.classList.add("motion-ready");

  const reveal = (element) => element.classList.add("is-visible");
  if (!("IntersectionObserver" in window)) {
    motionElements.forEach(reveal);
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      reveal(entry.target);
      observer.unobserve(entry.target);
    });
  }, { rootMargin: "0px 0px -7% 0px", threshold: 0.08 });

  motionElements.forEach((element) => observer.observe(element));
}

initTheme();
configurePrimaryDownload();
applyLanguage(initialLanguage());
void refreshLatestRelease();
bindLanguageToggle();
bindStickyHeader();
bindImageDialog();
initScreenCarousel();
initMotion();
