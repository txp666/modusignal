const copy = {
  skipLink: { zh: "跳到主要内容", en: "Skip to main content" },
  brandTagline: { zh: "使用说明与协议说明", en: "User guide and protocols" },
  navProduct: { zh: "产品介绍", en: "Overview" },
  navGuide: { zh: "使用说明", en: "Guide" },
  navDownloads: { zh: "下载", en: "Downloads" },
  backToModusignal: { zh: "返回 modusignal", en: "Back to modusignal" },
  heroEyebrow: { zh: "使用说明 · 协议说明", en: "User guide · Protocols" },
  heroTitle: { zh: "PyQt UI Designer 使用说明", en: "PyQt UI Designer guide" },
  heroDescription: { zh: "从设计界面、绑定串口数据、预览运行到导出打包的完整流程，以及下位机需要遵循的接收与发送格式。文中的示例帧和 CRC 都可以直接用于联调。", en: "The full workflow from designing the UI and binding serial data to previewing, exporting and packaging, plus the receive and send formats your device firmware should follow. Every example frame and CRC here can be used as-is for bring-up." },
  metaVersion: { zh: "适用于 0.1.3", en: "For version 0.1.3" },
  metaSerial: { zh: "串口通信", en: "Serial communication" },
  tocTitle: { zh: "目录", en: "Contents" },
  tocQuickstart: { zh: "快速上手", en: "Quick start" },
  tocSerial: { zh: "串口与解析模式", en: "Serial and parse modes" },
  tocReceive: { zh: "接收：数据绑定", en: "Receiving: binding" },
  tocSend: { zh: "发送：命令配置", en: "Sending: commands" },
  tocModbus: { zh: "Modbus RTU 参考", en: "Modbus RTU reference" },
  tocExport: { zh: "导出与打包", en: "Export and packaging" },
  tocFaq: { zh: "常见问题", en: "FAQ" },
  footerTagline: { zh: "面向硬件工程师的可视化上位机设计工具。", en: "A visual host-app designer for hardware engineers." },
  backToTop: { zh: "返回顶部", en: "Back to top" },
};

const titles = {
  zh: "PyQt UI Designer 使用说明与协议说明",
  en: "PyQt UI Designer guide and protocols",
};

let currentLanguage = "zh";
const LANGUAGE_STORAGE_KEY = "pyqt-ui-designer-language";
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

function applyLanguage(language) {
  currentLanguage = language === "en" ? "en" : "zh";
  document.documentElement.lang = currentLanguage === "zh" ? "zh-CN" : "en";
  document.title = titles[currentLanguage];
  document.querySelectorAll("[data-copy]").forEach((element) => {
    const value = copy[element.dataset.copy]?.[currentLanguage];
    if (value) element.innerHTML = value;
  });
  document.querySelectorAll("[data-lang]").forEach((element) => {
    element.hidden = element.dataset.lang !== currentLanguage;
  });
  const toggle = document.querySelector("[data-language-toggle]");
  toggle.textContent = currentLanguage === "zh" ? "EN" : "中";
  toggle.setAttribute("aria-label", currentLanguage === "zh" ? "Switch to English" : "切换到中文");
  updateThemeButton();
  try { localStorage.setItem(LANGUAGE_STORAGE_KEY, currentLanguage); } catch {}
}

function initTocHighlight() {
  const links = [...document.querySelectorAll("[data-guide-toc] a")];
  const sections = links.map((link) => document.querySelector(link.getAttribute("href"))).filter(Boolean);
  if (!sections.length || !("IntersectionObserver" in window)) return;

  const visible = new Set();
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) visible.add(entry.target);
      else visible.delete(entry.target);
    }
    const current = sections.find((section) => visible.has(section));
    if (!current) return;
    for (const link of links) {
      const active = link.getAttribute("href") === `#${current.id}`;
      link.classList.toggle("active", active);
      if (active) link.setAttribute("aria-current", "true");
      else link.removeAttribute("aria-current");
    }
  }, { rootMargin: "-96px 0px -55% 0px" });

  sections.forEach((section) => observer.observe(section));
}

document.querySelector("[data-language-toggle]").addEventListener("click", () => {
  applyLanguage(currentLanguage === "zh" ? "en" : "zh");
});

let savedLanguage = "zh";
try { savedLanguage = localStorage.getItem(LANGUAGE_STORAGE_KEY) || "zh"; } catch {}
initTheme();
applyLanguage(savedLanguage);
initTocHighlight();
