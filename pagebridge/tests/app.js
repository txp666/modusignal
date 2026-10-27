const COPY = {
  skip: { zh: "跳到主要内容", en: "Skip to main content" },
  brandSubtitle: { zh: "PDF 实测对比", en: "PDF test comparisons" },
  back: { zh: "返回软件介绍", en: "Back to PageBridge" },
  title: { zh: "真实 PDF，逐份看效果", en: "Real PDFs. See the results." },
  intro: { zh: "20 份原件，实测 134 / 746 页。每份展示 1 个代表页；选择样本，查看原文、译文和实际结论。", en: "20 originals, 134 of 746 pages tested. One representative page per document: choose a sample to compare the original, translation and actual findings." },
  overallTitle: { zh: "总体结论：适合辅助阅读，关键内容仍需核对", en: "Overall: useful for reading, with key details to verify" },
  overallResult: { zh: "18 份处理完成，Adam 部分完成，阿语扫描不支持。处理完成不等于翻译质量全部合格。", en: "Processing completed for 18 documents. Adam was partial, and the Arabic scan was unsupported. Completing a run does not mean every translation is correct." },
  overallFixed: { zh: "背景、色块、细边框及图表位置的修复有效；本轮无公式占位符泄漏。财报 5 页的 516 个数值区域核对未改变原数字。", en: "Fixes preserved tested backgrounds, colored areas, fine borders and figure positions, with no formula-placeholder leaks. Checks of 516 numeric regions across five financial-report pages found no changed source numbers." },
  overallLimits: { zh: "复杂公式仍可能丢符号，金融与技术术语会误译，密集表格和参考文献常需展开。图像为页内视图，不包含应用中点击展开的长译文。", en: "Complex formulas can lose symbols, financial and technical terms can be mistranslated, and dense tables or references may need expansion. Images show the page view, without the longer text available by expanding it in the app." },
  chooseSample: { zh: "选择测试文档", en: "Choose a test document" },
  choosePage: { zh: "对比页", en: "Preview page" },
  selectionNote: { zh: "共 20 份，每次查看 1 份", en: "20 documents, one at a time" },
  loading: { zh: "正在载入实测清单…", en: "Loading test records…" },
  loadError: { zh: "实测清单暂时无法载入。请刷新页面重试，或下载下方完整清单；当前保留 BERT 示例。", en: "The test records could not load. Refresh to retry or download the full record below. The BERT example remains visible." },
  openPdf: { zh: "查看原始 PDF", en: "Open original PDF" },
  findingLabel: { zh: "观察结果", en: "Findings" },
  limitationLabel: { zh: "仍需核对", en: "Remaining issues" },
  viewLabel: { zh: "对比视图", en: "Comparison view" },
  original: { zh: "原文", en: "Original" },
  sideBySide: { zh: "并排对比", en: "Side by side" },
  translation: { zh: "译文", en: "Translation" },
  originalPreserved: { zh: "保留原页", en: "Original preserved" },
  openImage: { zh: "打开大图", en: "Open full image" },
  imageCaption: { zh: "真实 Mac 生产画布渲染，非重新排版的示意图。可打开大图核对细节。", en: "Actual production Mac canvas renders, not a recreated mockup. Open either image to inspect the details." },
  unsupportedCaption: { zh: "本页不支持阿语扫描识别，右侧保留原页，没有生成中文译文。两图相同是实际结果。", en: "Arabic scan recognition is unsupported for this page. The right side preserves the original; no Chinese translation was generated. The identical images are the actual result." },
  imageError: { zh: "对比图未能完整载入，请刷新重试；仍可查看文档来源和测试结论。", en: "The comparison images did not fully load. Refresh to retry; the source document and findings remain available." },
  methodTitle: { zh: "测试范围与方法", en: "Test scope and method" },
  methodScope: { zh: "6 份全文共 87 页，另外 14 份选页共 47 页；不是 746 页全部翻译。134 个测试页均已重开，原 PDF 哈希未变。全文处理不等于逐字审校，视觉复查包含全页总览和原尺寸抽查。", en: "Six full documents account for 87 pages, with 47 selected pages from 14 others—not all 746 source pages. All 134 tested pages reopened and original PDF hashes stayed unchanged. Full-document processing is not word-by-word proofreading; visual review combined overviews with full-size spot checks." },
  methodEnvironment: { zh: "测试于 2026-10-27，使用 MinerU 4.0.12 Basic / ONNX CPU 与 DeepSeek deepseek-flash。图像来自 Mac 生产画布；Windows 另选 6 类文档各 1 页实测，并完成安装与升级验收。", en: "Tested October 27, 2026 with MinerU 4.0.12 Basic / ONNX CPU and DeepSeek deepseek-flash. Images come from the production Mac canvas. Windows separately tested one page from each of six document types, plus installation and upgrade acceptance." },
  methodSources: { zh: "每份只展示 1 个代表页，完整实测页范围列于样本信息。公开原件可能随来源更新，结论对应本次留存版本；完整清单包含原件哈希和视觉抽查范围。", en: "One representative page is shown for each document; the full tested range is listed with the sample. Public source files may change. Findings refer to the tested snapshots; the complete record includes original hashes and visual-review scope." },
  downloadRecord: { zh: "下载完整实测清单", en: "Download the full test record" },
  verification: { zh: "完整验证记录", en: "Full verification record" },
  downloadApp: { zh: "下载 PageBridge", en: "Download PageBridge" },
};

const SHORT_NAMES = {
  bert: "BERT", "batch-normalization": "Batch Normalization", "ti-lm358": "TI LM358",
  "nist-en": "NIST AI RMF", "irs-w9": "IRS W-9", "nasa-scan": "NASA dynamic stall",
  "nist-ja": "NIST AI RMF (日本語)", "attention-is-all-you-need": "Attention Is All You Need",
  "rfc8259-json": "RFC 8259 / JSON", "uscis-i9": "USCIS I-9", adam: "Adam", resnet: "ResNet", ddpm: "DDPM",
  "caict-ai-development-2024": "CAICT AI Development 2024", "inrs-lithium-fr": "INRS Lithium (français)",
  "berkshire-2024-annual": "Berkshire Hathaway 2024", "nasa-balloon-2024-slides": "NASA Balloon Program 2024",
  "ti-lm5160-evm": "TI LM5160 EVM", "nasa-patent-8108023": "NASA US 8,108,023", "unicef-child-rights-ar": "UNICEF Child Rights (العربية)",
};

const $ = (selector) => document.querySelector(selector);
let language = "zh";
let theme = "light";
let records = null;
let comparisons = null;
let selectedCase = null;
let selectedPage = null;
let view = window.matchMedia("(max-width: 600px)").matches ? "translation" : "both";
let loadingFailed = false;

function readPreference(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function savePreference(key, value) {
  try { localStorage.setItem(key, value); } catch {}
}
function t(key) { return COPY[key]?.[language] || ""; }
function setText(selector, text) { $(selector).textContent = text; }

function updateThemeButton() {
  const next = theme === "dark" ? "light" : "dark";
  const label = language === "zh" ? `切换到${next === "dark" ? "深色" : "浅色"}主题` : `Switch to ${next} theme`;
  const button = $("[data-theme-toggle]");
  button.textContent = theme === "dark" ? "☀" : "☾";
  button.setAttribute("aria-label", label);
  button.setAttribute("aria-pressed", String(theme === "dark"));
  button.title = label;
}
function applyTheme(value) {
  theme = value === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  $('meta[name="theme-color"]').content = theme === "dark" ? "#0b1118" : "#f5f7f8";
  updateThemeButton();
}
function applyLanguage(value) {
  language = value === "en" ? "en" : "zh";
  document.documentElement.lang = language === "en" ? "en" : "zh-CN";
  document.title = language === "en" ? "PDF Test Comparisons · PageBridge" : "PDF 实测对比 · PageBridge";
  document.querySelectorAll("[data-copy]").forEach((element) => { element.textContent = t(element.dataset.copy); });
  document.querySelectorAll("[data-copy-label]").forEach((element) => { element.setAttribute("aria-label", t(element.dataset.copyLabel)); });
  const button = $("[data-language-toggle]");
  button.textContent = language === "zh" ? "EN" : "中";
  button.setAttribute("aria-label", language === "zh" ? "Switch to English" : "切换到中文");
  updateThemeButton();
  if (records) {
    populateCases();
    renderCase();
  }
  if (loadingFailed) setText("[data-loading]", t("loadError"));
  savePreference("pagebridge-language", language);
}

function populateCases() {
  const select = $("#sampleSelect");
  select.replaceChildren(...records.cases.map((item) => {
    const option = document.createElement("option");
    option.value = item.id;
    option.textContent = `${SHORT_NAMES[item.id] || item.title} · ${item.category[language]}`;
    return option;
  }));
  if (selectedCase) select.value = selectedCase.id;
}
function resolveSelection() {
  const params = new URL(location.href).searchParams;
  selectedCase = records.cases.find((item) => item.id === params.get("case")) || records.cases[0];
  const entry = comparisons.cases.find((item) => item.id === selectedCase.id);
  const requested = Number(params.get("page"));
  selectedPage = entry.pages.find((page) => page.page === requested)
    || entry.pages.find((page) => page.page === entry.representativePage) || entry.pages[0];
}
function updateUrl(replace = false) {
  const url = new URL(location.href);
  url.searchParams.set("case", selectedCase.id);
  url.searchParams.set("page", String(selectedPage.page));
  if (url.href !== location.href) history[replace ? "replaceState" : "pushState"]({}, "", url);
}
function selectCase(id) {
  selectedCase = records.cases.find((item) => item.id === id);
  const entry = comparisons.cases.find((item) => item.id === id);
  selectedPage = entry.pages.find((page) => page.page === entry.representativePage) || entry.pages[0];
  updateUrl();
  renderCase();
}
function setImage(imageSelector, linkSelectors, path, label) {
  const image = $(imageSelector);
  const assetUrl = new URL(`../${path}`, location.href);
  assetUrl.searchParams.set("v", "__ASSET_VERSION__");
  const url = assetUrl.href;
  image.width = selectedPage.width;
  image.height = selectedPage.height;
  image.alt = language === "zh" ? `${selectedCase.title}，第 ${selectedPage.page} 页${label}` : `${selectedCase.title}, page ${selectedPage.page}, ${label}`;
  if (image.src !== url) image.src = url;
  for (const selector of linkSelectors) $(selector).href = url;
}
function renderCase() {
  if (!selectedCase || !selectedPage) return;
  $("#sampleSelect").value = selectedCase.id;
  setText("#sampleTitle", selectedCase.title);
  setText("[data-case-category]", selectedCase.category[language]);
  $("[data-original-pdf]").href = selectedCase.sourceUrl;
  const pages = selectedCase.testedPages;
  const coverage = selectedCase.scope === "full"
    ? (language === "zh" ? `实测全文 ${pages.length} 页（1–${pages.length}）` : `Full document tested: ${pages.length} pages (1–${pages.length})`)
    : (language === "zh" ? `实测 ${pages.length} / ${selectedCase.sourcePages} 页：${pages.join("、")}` : `${pages.length} of ${selectedCase.sourcePages} pages tested: ${pages.join(", ")}`);
  setText("[data-case-coverage]", coverage);
  setText("[data-case-outcome]", records.outcomeLabels[selectedCase.outcome][language]);
  $("[data-case-outcome]").dataset.outcome = selectedCase.outcome;
  setText("[data-case-finding]", selectedCase.finding[language]);
  setText("[data-case-limitation]", selectedCase.limitation[language]);
  const available = comparisons.cases.find((item) => item.id === selectedCase.id).pages;
  $(".page-field").hidden = available.length < 2;
  $("#pageSelect").replaceChildren(...available.map((page) => {
    const option = document.createElement("option");
    option.value = page.page;
    option.textContent = language === "zh" ? `第 ${page.page} 页` : `Page ${page.page}`;
    return option;
  }));
  $("#pageSelect").value = String(selectedPage.page);
  setText("[data-preview-page]", language === "zh" ? `当前展示 PDF 物理第 ${selectedPage.page} 页` : `Showing physical PDF page ${selectedPage.page}`);
  const preserved = selectedCase.outcome === "unsupported" || selectedPage.translationSameAsSource;
  const translatedLabel = t(preserved ? "originalPreserved" : "translation");
  setText("[data-translation-label]", translatedLabel);
  setText("[data-translation-tab]", translatedLabel);
  $("[data-image-notice]").hidden = true;
  setImage("[data-source-image]", ["[data-source-link]", "[data-open-source]"], selectedPage.source, t("original"));
  setImage("[data-translation-image]", ["[data-translation-link]", "[data-open-translation]"], selectedPage.translation, translatedLabel);
  setText("[data-image-caption]", t(preserved ? "unsupportedCaption" : "imageCaption"));
  applyView(view);
}
function applyView(value) {
  view = value;
  $(".comparison-grid").dataset.view = view;
  document.querySelectorAll("[data-view]").forEach((element) => {
    if (element.tagName === "BUTTON") element.setAttribute("aria-pressed", String(element.dataset.view === view));
  });
}

async function loadRecords() {
  $(".sample-workspace").setAttribute("aria-busy", "true");
  $("[data-loading]").hidden = false;
  try {
    const [recordResponse, imageResponse] = await Promise.all([fetch("../test-results.json?v=__ASSET_VERSION__"), fetch("../comparisons.json?v=__ASSET_VERSION__")]);
    if (!recordResponse.ok || !imageResponse.ok) throw new Error("Unable to load records");
    [records, comparisons] = await Promise.all([recordResponse.json(), imageResponse.json()]);
    resolveSelection();
    populateCases();
    renderCase();
    updateUrl(true);
    $("[data-loading]").hidden = true;
  } catch {
    loadingFailed = true;
    setText("[data-loading]", t("loadError"));
  } finally {
    $(".sample-workspace").setAttribute("aria-busy", "false");
  }
}

const darkPreference = window.matchMedia("(prefers-color-scheme: dark)");
applyTheme(readPreference("modusignal-theme") || (darkPreference.matches ? "dark" : "light"));
applyLanguage(readPreference("pagebridge-language") || "zh");
applyView(view);
$("[data-theme-toggle]").addEventListener("click", () => {
  applyTheme(theme === "dark" ? "light" : "dark");
  savePreference("modusignal-theme", theme);
});
darkPreference.addEventListener("change", (event) => {
  if (!readPreference("modusignal-theme")) applyTheme(event.matches ? "dark" : "light");
});
$("[data-language-toggle]").addEventListener("click", () => applyLanguage(language === "zh" ? "en" : "zh"));
$("#sampleSelect").addEventListener("change", (event) => { if (records) selectCase(event.target.value); });
$("#pageSelect").addEventListener("change", (event) => {
  if (!selectedCase) return;
  selectedPage = comparisons.cases.find((item) => item.id === selectedCase.id).pages.find((page) => page.page === Number(event.target.value));
  updateUrl();
  renderCase();
});
document.querySelectorAll("button[data-view]").forEach((button) => button.addEventListener("click", () => applyView(button.dataset.view)));
window.addEventListener("popstate", () => { if (records && comparisons) { resolveSelection(); renderCase(); } });
for (const image of document.querySelectorAll(".page-image-link img")) {
  image.addEventListener("error", () => { setText("[data-image-notice]", t("imageError")); $("[data-image-notice]").hidden = false; });
}
loadRecords();
