import {
  findHartLinkReleaseAsset,
  formatHartLinkReleaseDate,
  formatReleaseAssetSize,
  loadLatestHartLinkRelease,
} from "./release.js?v=__ASSET_VERSION__";

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
    navCapabilities: "功能介绍",
    navScreens: "软件界面",
    navPricing: "授权价格",
    navDownloads: "下载",
    backToModusignal: "返回 modusignal",
    stableRelease: "稳定版",
    releaseDatePending: "自动同步最新版本",
    heroEyebrow: "跨平台 HART 主站软件",
    heroTitle: "HART 设备调试<br />与参数配置",
    heroDescription: "支持设备扫描、变量读取、通信帧解析和仪表校验。可导入 DD、保存配置快照、比较历史记录，并在核对源、目标设备身份后克隆配置。",
    downloadNow: "立即下载",
    allPlatforms: "查看全部平台",
    ddLicenseNote: "基础功能免费；DD 专业版按席位收费，永久授权并免费更新升级维护。",
    visualCaptionLead: "设备连接演示",
    visualCaptionTitle: "变量读取、通信日志与帧解析",
    trustOneTitle: "通信请求管理",
    trustOneDesc: "事务队列、响应匹配、超时重试统一管理",
    trustTwoTitle: "写入检查与回读",
    trustTwoDesc: "写入前核对设备身份与计划，逐项执行并在完成后复核",
    trustThreeTitle: "三平台发布",
    trustThreeDesc: "Windows、macOS 与 Linux 原生安装包",
    capabilitiesEyebrow: "功能介绍",
    capabilitiesTitle: "设备连接、命令读写<br />与配置管理",
    capabilitiesDescription: "按任务选择变量监测、通信日志、仪表设置或 DD 工作区，查看对应设备的参数和命令结果。",
    featureConnectTitle: "连接、发现与持续读取",
    featureConnectDesc: "支持短地址/长地址、轮询地址扫描、CMD 0 设备身份建立，以及 PV / SV / TV / QV 的持续读取。",
    featureConnectPointTwo: "自动建立在线设备身份",
    featureConnectPointThree: "变量卡片与实时曲线",
    featureTraceTitle: "通信 Trace 与帧解析",
    featureTraceDesc: "对照查看原始 TX/RX 字节和解析后的帧字段，包括响应码、设备状态和校验结果。",
    featureCommandTitle: "通用命令与自定义请求",
    featureCommandDesc: "内置通用命令表、请求帧预览与手动 Hex 请求；校验和由软件自动计算。",
    featureSettingsTitle: "仪表设置与校验记录",
    featureSettingsDesc: "集中管理量程、单位、阻尼、标识、地址与回路电流；记录 PV/AO 校验点，并保存 JSON 或导出 PDF。",
    featureDdTitle: "DD 工作区与配置克隆",
    featureDdDesc: "按在线身份匹配 DD，浏览菜单与命令；保存配置快照、比较历史，并在源/目标身份核对后执行受控克隆和最终复核。",
    featureUpdateTitle: "内置软件更新",
    featureUpdateDesc: "自动选择当前平台安装包，下载后执行文件大小与 SHA-256 双校验，再进入安装流程。",
    screensEyebrow: "界面截图",
    screensTitle: "变量、日志与仪表设置",
    screenWorkbenchTitle: "通用设备工作台",
    screenWorkbenchDesc: "查看变量、执行通用命令，并对照原始日志与解析结果",
    screenDdTitle: "DD 设备管理",
    screenDdDesc: "许可证状态、DD 包导入与设备工作区集中管理",
    screenDdWorkspaceTitle: "DD 设备工作区",
    screenDdWorkspaceDesc: "查看 DD 菜单、命令库和对应的通信记录",
    screenSettingsTitle: "仪表设置与校正",
    screenSettingsDesc: "输入输出校正、基本参数与脉冲模式操作集中呈现",
    screenSnapshotTitle: "配置快照与历史比较",
    screenSnapshotDesc: "读取配置并保存为 JSON/PDF，管理已存记录并比较历史版本",
    screenCloneTitle: "受控配置克隆",
    screenCloneDesc: "核对源/目标身份，预览可执行项，逐项写入并完成最终复核",
    previousScreen: "上一张",
    nextScreen: "下一张",
    workflowEyebrow: "连接步骤",
    workflowTitle: "连接并读取设备",
    workflowOneTitle: "选择接口并连接",
    workflowOneDesc: "通过 HARTLink CDC 或兼容串口接入，软件使用标准 HART 串口参数。",
    workflowTwoTitle: "扫描并识别设备",
    workflowTwoDesc: "扫描轮询地址并读取 CMD 0，后续 DD 匹配和操作使用该设备的身份信息。",
    workflowThreeTitle: "读取、解析或配置",
    workflowThreeDesc: "从过程变量与通用命令开始，按需进入设置、校准或匹配的 DD 工作区。",
    pricingEyebrow: "授权方案",
    pricingTitle: "基础功能免费<br />DD 专业版按席位收费",
    pricingDescription: "永久授权，更新、升级与维护免费。",
    pricingCoreName: "基础功能",
    pricingFreeBadge: "免费使用",
    pricingCoreDescription: "连接、扫描、变量读取、通信 Trace 与基础仪表操作可直接使用。",
    pricingDownload: "下载使用",
    pricingRecommended: "专业版",
    pricingPerSeat: "/ 席位",
    pricingProDescription: "永久授权，包含 DD 解析、设备工作区与配置管理；更新、升级与维护免费。",
    pricingFeatureSemantic: "中文语义推测",
    pricingFeatureMethods: "完整的 DD 菜单与方法实现",
    pricingFeatureClone: "配置快照、历史比较与受控克隆",
    pricingTeamName: "团队版",
    pricingTeamBadge: "5 席位",
    pricingFiveSeats: "/ 5 席位",
    pricingTeamDescription: "包含 DD Pro 全部能力，适合工程团队统一采购，并享受免费更新、升级与维护。",
    enterpriseEyebrow: "企业与项目授权",
    enterpriseTitle: "企业版、离线批量授权、定制兼容",
    enterpriseDescription: "体验码、席位购买与企业授权统一联系 771454616@qq.com",
    pricingRoadmap: "在线 DD 库设计中",
    downloadEyebrow: "HARTLink Studio 最新版",
    downloadTitle: "下载安装包",
    windowsPackageTitle: "中文安装程序",
    macDescription: "适用于搭载 Apple Silicon 的 Mac，打开镜像后拖入应用程序。",
    linuxDescription: "Debian / Ubuntu 推荐 DEB；其他发行版可使用便携 TAR.GZ。",
    fileSize: "文件大小",
    downloadWindows: "下载 Windows 版",
    downloadMac: "下载 macOS 版",
    windowsPrimaryLabel: "Windows x64 · 安装程序",
    macPrimaryLabel: "macOS · Apple Silicon · DMG",
    linuxPrimaryLabel: "Linux x64 · DEB",
    footerTagline: "跨平台 HART 设备调试软件",
    contactForQuote: "发送邮件",
    modusignalOnline: "modusignal 在线调试",
  },
  en: {
    brandTagline: "HART device workbench",
    navCapabilities: "Features",
    navScreens: "Interface",
    navPricing: "Pricing",
    navDownloads: "Download",
    backToModusignal: "Back to modusignal",
    stableRelease: "Stable",
    releaseDatePending: "Latest release synced automatically",
    heroEyebrow: "Cross-platform HART master software",
    heroTitle: "HART device testing<br />and configuration",
    heroDescription: "Scan devices, read variables, inspect communication frames and calibrate instruments. Import DDs, save configuration snapshots, compare history and clone configurations after checking source and target identities.",
    downloadNow: "Download now",
    allPlatforms: "View all platforms",
    ddLicenseNote: "Core features are free. DD Pro is licensed per seat with a perpetual license and free updates, upgrades and maintenance.",
    visualCaptionLead: "Device connection demo",
    visualCaptionTitle: "Variable readings, communication logs and frame parsing",
    trustOneTitle: "Request handling",
    trustOneDesc: "Unified transaction queue, response matching and retries",
    trustTwoTitle: "Write checks and readback",
    trustTwoDesc: "Identity and plan checks before writes, staged execution and final verification",
    trustThreeTitle: "Three-platform delivery",
    trustThreeDesc: "Native packages for Windows, macOS and Linux",
    capabilitiesEyebrow: "Features",
    capabilitiesTitle: "Device connections, commands<br />and configuration",
    capabilitiesDescription: "Use variable monitoring, communication logs, instrument settings or DD workspaces to view device parameters and command results.",
    featureConnectTitle: "Connect, discover and monitor",
    featureConnectDesc: "Short and long addresses, polling-address scans, CMD 0 identity binding and continuous PV / SV / TV / QV reads.",
    featureConnectPointTwo: "Automatic online identity binding",
    featureConnectPointThree: "Variable cards and live charts",
    featureTraceTitle: "Communication trace and parsing",
    featureTraceDesc: "Compare raw TX/RX bytes with parsed fields, including response codes, device status and checksum results.",
    featureCommandTitle: "Universal and custom requests",
    featureCommandDesc: "Built-in universal commands, frame previews and manual Hex requests with automatic checksum calculation.",
    featureSettingsTitle: "Instrument settings and calibration records",
    featureSettingsDesc: "Manage ranges, units, damping, tags, addresses and loop current; record PV/AO calibration points and save JSON or export PDF.",
    featureDdTitle: "DD workspaces and configuration cloning",
    featureDdDesc: "Match DDs to the online identity, browse menus and commands, save snapshots, compare history, and run controlled cloning with source/target identity checks and final verification.",
    featureUpdateTitle: "Built-in updates",
    featureUpdateDesc: "Selects the right platform package, then verifies size and SHA-256 before installation.",
    screensEyebrow: "Screenshots",
    screensTitle: "Variables, logs and instrument settings",
    screenWorkbenchTitle: "Universal device workbench",
    screenWorkbenchDesc: "Read variables, run universal commands and compare raw logs with parsed frames",
    screenDdTitle: "DD device management",
    screenDdDesc: "License status, DD package imports and device workspaces",
    screenDdWorkspaceTitle: "DD device workspace",
    screenDdWorkspaceDesc: "View DD menus, the command library and related communication records",
    screenSettingsTitle: "Instrument settings and calibration",
    screenSettingsDesc: "I/O calibration, core parameters and burst-mode operations",
    screenSnapshotTitle: "Configuration snapshots and history",
    screenSnapshotDesc: "Read configurations, save JSON/PDF records and compare saved versions",
    screenCloneTitle: "Controlled configuration cloning",
    screenCloneDesc: "Verify source and target identities, preview eligible writes, execute them step by step, and finish with verification",
    previousScreen: "Previous",
    nextScreen: "Next",
    workflowEyebrow: "Connection steps",
    workflowTitle: "Connect and read a device",
    workflowOneTitle: "Select the interface and connect",
    workflowOneDesc: "Use HARTLink CDC or a compatible serial adapter with standard HART serial parameters.",
    workflowTwoTitle: "Scan and identify the device",
    workflowTwoDesc: "Scan polling addresses and read CMD 0. Use that identity for DD matching and subsequent operations.",
    workflowThreeTitle: "Read, parse or configure",
    workflowThreeDesc: "Start with variables and universal commands, then enter settings, calibration or the matching DD workspace.",
    pricingEyebrow: "Licensing",
    pricingTitle: "Core features are free<br />DD Pro is licensed per seat",
    pricingDescription: "Perpetual licenses with free updates, upgrades and maintenance.",
    pricingCoreName: "Core features",
    pricingFreeBadge: "Free",
    pricingCoreDescription: "Connection, discovery, live variables, communication traces and core instrument operations are ready to use.",
    pricingDownload: "Download free",
    pricingRecommended: "Pro",
    pricingPerSeat: "/ seat",
    pricingProDescription: "A perpetual license for DD parsing, device workspaces and configuration management, with free updates, upgrades and maintenance.",
    pricingFeatureSemantic: "Chinese semantic inference",
    pricingFeatureMethods: "Complete DD menu and method implementation",
    pricingFeatureClone: "Configuration snapshots, history comparison and controlled cloning",
    pricingTeamName: "Team",
    pricingTeamBadge: "5 seats",
    pricingFiveSeats: "/ 5 seats",
    pricingTeamDescription: "Includes every DD Pro capability for engineering teams, with free updates, upgrades and maintenance.",
    enterpriseEyebrow: "Enterprise and project licensing",
    enterpriseTitle: "Enterprise, offline volume licensing and custom compatibility",
    enterpriseDescription: "Trial codes, seat purchases and enterprise licensing: 771454616@qq.com",
    pricingRoadmap: "Online DD library in design",
    downloadEyebrow: "HARTLink Studio latest release",
    downloadTitle: "Download an installer",
    windowsPackageTitle: "Chinese installer",
    macDescription: "For Apple Silicon Macs. Open the disk image and drag the app into Applications.",
    linuxDescription: "DEB is recommended for Debian / Ubuntu; other distributions can use the portable TAR.GZ.",
    fileSize: "File size",
    downloadWindows: "Download for Windows",
    downloadMac: "Download for macOS",
    windowsPrimaryLabel: "Windows x64 · Installer",
    macPrimaryLabel: "macOS · Apple Silicon · DMG",
    linuxPrimaryLabel: "Linux x64 · DEB",
    footerTagline: "Cross-platform HART device tools",
    contactForQuote: "Send email",
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
