const REPOSITORY = "txp666/PageBridge";
const RELEASE_API = `https://api.github.com/repos/${REPOSITORY}/releases/latest`;
const FALLBACK_RELEASE_DATE = "2026-10-27T13:06:48Z";

const copy = {
  validationRecord: { zh: "查看安装、升级与完整验证记录", en: "Installation, upgrade and full verification record" },
  case20Limitation: { zh: "当前MinerU Basic/ONNX不支持无阿语文本层的扫描页；本例没有生成中文译文。", en: "The pinned MinerU Basic/ONNX runtime does not support Arabic scans without an Arabic text layer; no Chinese translation was generated." },
  case20Finding: { zh: "所选5页明确保留原页，彩色背景、插画与边框完整，没有错误OCR译文叠印。", en: "All five selected pages explicitly preserve the original, including colored backgrounds, illustrations and borders, with no incorrect OCR overlays." },
  case20Coverage: { zh: "选测 5 / 62 页：7、9、12、38、46", en: "5 of 62 pages: 7, 9, 12, 38, 46" },
  case20Category: { zh: "阿拉伯语 / 扫描或轮廓字 / 插画", en: "Arabic / scanned or outlined text / illustrations" },
  case19Limitation: { zh: "第1页专利引用列合并成段落，第6页旋转图注方向/内容错误；部分编号、日期需展开。", en: "Citation columns collapse into prose on page 1; rotated captions have incorrect orientation/content on page 6, and some numbers/dates need expansion." },
  case19Finding: { zh: "条码经逐像素复核完整，剖面图、细线、箭头和双栏正文区域保留。", en: "Pixel checks confirm the barcode is intact; cross-section drawings, fine lines, arrows and two-column body areas remain." },
  case19Coverage: { zh: "选测 5 / 14 页：1、5、6、11、12", en: "5 of 14 pages: 1, 5, 6, 11, 12" },
  case19Category: { zh: "扫描专利 / 双栏 / 旋转线稿", en: "Scanned patent / two columns / rotated line art" },
  case18Limitation: { zh: "26处小图注/页脚等需展开；文字变化后，原链接下划线可能仍停留在原坐标。", en: "26 small caption/footer regions need expansion; original link underlines may remain at source coordinates after text changes." },
  case18Finding: { zh: "PCB图、原理图、曲线、Logo、细表格线与已识别公式图像保留。", en: "PCB artwork, schematics, plots, logos, fine table rules and recognized formula images remain intact." },
  case18Coverage: { zh: "选测 5 / 15 页：4、5、6、7、8", en: "5 of 15 pages: 4, 5, 6, 7, 8" },
  case18Category: { zh: "工程手册 / 原理图 / PCB", en: "Engineering guide / schematics / PCB" },
  case17Limitation: { zh: "封面小页脚需展开，专业词/缩写仍需核对；6个数字字框边沿有差异，但数字笔画未被遮盖。", en: "The small cover footer needs expansion and terms/abbreviations need checking; six numeric-box edges differ, but numeric strokes are not covered." },
  case17Finding: { zh: "照片背景、Logo、彩色填充、细网格及数值位置保留，标题阴影覆盖问题已修复。", en: "Photo backgrounds, logos, colored fills, fine grids and number positions remain; the title-shadow coverage issue is fixed." },
  case17Coverage: { zh: "选测 5 / 24 页：1、5、6、8、18", en: "5 of 24 pages: 1, 5, 6, 8, 18" },
  case17Category: { zh: "彩色横版幻灯片 / 照片背景", en: "Color landscape slides / photo backgrounds" },
  case16Limitation: { zh: "1个IBNR标题需展开；Goodwill、ALAE、Development等金融术语仍有误译或不一致。", en: "One IBNR heading needs expansion; financial terms such as Goodwill, ALAE and Development remain mistranslated or inconsistent." },
  case16Finding: { zh: "5页灰条纹、细线和财务数值列保留；516个数值区域核对未改变原数字，邻近标题未被擦除。", en: "Across five pages, gray bands, fine rules and numeric columns remain; 516 checked numeric regions preserve source numbers and nearby headings are not erased." },
  case16Coverage: { zh: "选测 5 / 150 页：88、89、113、117、124", en: "5 of 150 pages: 88, 89, 113, 117, 124" },
  case16Category: { zh: "财务年报 / 多列数字 / 灰底表格", en: "Annual report / numeric columns / shaded tables" },
  case15Limitation: { zh: "第14页“12+三角”被识别并译为“12吨”；部分图内法文保留，短表格片段语序生硬。", en: "On page 14, “12 + triangle” becomes “12 tons”; some figure labels stay French and short table fragments read awkwardly." },
  case15Finding: { zh: "照片、灰底、彩色装饰、细表框与危险品编号保留；混色标题保留原图并可展开中文。", en: "Photos, gray fills, colored decoration, fine table borders and dangerous-goods numbers remain; mixed-color headings retain their image with expandable Chinese." },
  case15Coverage: { zh: "选测 5 / 24 页：8、12、14、19、20", en: "5 of 24 pages: 8, 12, 14, 19, 20" },
  case15Category: { zh: "法语手册 / 照片 / 装饰 / 表格", en: "French guide / photos / decoration / tables" },
  case14Limitation: { zh: "英文膨胀使多处表头、单元格、标题与脚注截断，需点击展开；图内中文保持原图。", en: "Expanded English clips several table cells, headers, headings and footnotes; click to expand. Chinese text inside figures remains in the original image." },
  case14Finding: { zh: "5个选页的斜水印、架构图和表格细线保留，未见白块覆盖图片或跨栏正文。", en: "The five selected pages retain diagonal watermarks, architecture figures and fine table rules, without observed white-box image erasure or body text crossing columns." },
  case14Coverage: { zh: "选测 5 / 64 页：13、18、21、22、28", en: "5 of 64 pages: 13, 18, 21, 22, 28" },
  case14Category: { zh: "中文报告译英文 / 水印 / 表格", en: "Chinese-to-English report / watermarks / tables" },
  case13Limitation: { zh: "共8处表头/图注等需展开；第5页objective断词后的tive残留，译文未做逐字专业审校。", en: "Eight headers/captions need expansion; a broken “objective” leaves “tive” in the page-5 caption. Translation has not had a word-by-word expert review." },
  case13Finding: { zh: "全文25页生成；总览图像区域保留，原尺寸抽查公式分式线、公式编号和结果表数值位置稳定。", en: "All 25 pages were generated; image regions remain in overviews, and full-size checks retain fraction bars, equation numbers and numeric table positions." },
  case13Coverage: { zh: "全文 25 页（1–25）", en: "Full document: 25 pages (1–25)" },
  case13Category: { zh: "论文 / 密集公式 / 彩色图像", en: "Paper / dense equations / color figures" },
  case12Limitation: { zh: "99处需展开：48处表格、46处参考文献、5处图注/脚注，密集区域不能只看页内缩略译文。", en: "99 regions need expansion: 48 table labels, 46 references and five captions/footnotes; dense areas cannot be fully read in the page view." },
  case12Finding: { zh: "全文12页生成；双栏、网络图、曲线及数值列保留，普通正文没有记录到区域溢出。", en: "All 12 pages were generated; columns, network diagrams, plots and numeric columns remain, with no recorded overflow in ordinary body paragraphs." },
  case12Coverage: { zh: "全文 12 页（1–12）", en: "Full document: 12 pages (1–12)" },
  case12Category: { zh: "双栏论文 / 网络图 / 数值表", en: "Two-column paper / network diagrams / tables" },
  case11Limitation: { zh: "第14页1个含7个公式的段落重试后仍保留原文；参考文献及短图注等23处需展开。", en: "One paragraph with seven formulas on page 14 remains untranslated after retry; 23 reference/caption regions need expansion." },
  case11Finding: { zh: "15页已生成并重开；公式、算法框和图表的原位置保留，已识别公式附件显示。", en: "All 15 pages were generated and reopened; formulas, algorithm frames and graphs retain their positions, and recognized formula images render." },
  case11Coverage: { zh: "全文 15 页（1–15）", en: "Full document: 15 pages (1–15)" },
  case11Category: { zh: "论文 / 密集行内公式 / 算法", en: "Paper / dense inline math / algorithms" },
  case10Limitation: { zh: "部分说明有未译片段或分离的引用数字，6处短标签/页脚需展开。", en: "Some instructions retain untranslated fragments or detached reference numbers; six short labels/footers need expansion." },
  case10Finding: { zh: "全文4页生成；复选框、空白输入框、灰表头和签名区保留，混色说明保留原文并可点开译文。", en: "All four pages were generated; checkboxes, blank fields, gray headers and signature areas remain, with mixed-color instructions preserved and translations available on click." },
  case10Coverage: { zh: "全文 4 页（1–4）", en: "Full document: 4 pages (1–4)" },
  case10Category: { zh: "空白官方表单 / 多栏字段", en: "Blank official form / multi-column fields" },
  case09Limitation: { zh: "部分ABNF行被当作正文翻译，代码保留并不完整；Value标题有字面误译。", en: "Some ABNF lines are translated as prose, so code preservation is incomplete; a Value heading is mistranslated literally." },
  case09Finding: { zh: "全文生成；抽查目录点线、页码和JSON示例缩进保留，多数语法/代码块保持原文。", en: "All pages were generated; inspected contents leaders, page numbers and JSON indentation remain, with most grammar/code kept as source." },
  case09Coverage: { zh: "全文 16 页（1–16）", en: "Full document: 16 pages (1–16)" },
  case09Category: { zh: "技术规范 / 等宽代码 / ABNF", en: "Technical standard / monospace code / ABNF" },
  case08Limitation: { zh: "第9/10页表头有2处需展开；h、train、Transformer存在“小时/火车/变压器”等误译。", en: "Two headers on pages 9/10 need expansion; h, train and Transformer have incorrect literal translations." },
  case08Finding: { zh: "全文生成；总览未见大面积图像擦除或数值列移位，抽查注意力图、公式和结果表保持原位置。", en: "All pages were generated; overviews show no gross image erasure or numeric-column shifts, and inspected attention diagrams, formulas and result tables stay in place." },
  case08Coverage: { zh: "全文 15 页（1–15）", en: "Full document: 15 pages (1–15)" },
  case08Category: { zh: "论文 / 公式 / 架构图 / 表格", en: "Paper / formulas / architecture / tables" },
  case07Limitation: { zh: "短译文增加留白，原页标签仍为日文，部分术语翻译较直译。", en: "Shorter translations add whitespace; the page label remains Japanese and some terms are literal." },
  case07Finding: { zh: "第7页浅青底色和圆角细边框连续完整，中文正文未碰到边框。", en: "Page 7 retains the pale-cyan fill and continuous rounded border, with Chinese text staying inside it." },
  case07Coverage: { zh: "选测 1 / 52 页：7", en: "1 of 52 pages: 7" },
  case07Category: { zh: "日文报告 / 彩色提示框", en: "Japanese report / colored callout" },
  case06Limitation: { zh: "仅测1页；兼容文字画布使用较小固定字号，留白和标题居中改变，未复刻扫描纹理。", en: "Only one page was tested. The compatibility text canvas uses small fixed-size text with changed whitespace and heading alignment, not the original scan texture." },
  case06Finding: { zh: "所测第9页生成9个可读译文块，段落起点保持，无失败块或可见OCR乱码。", en: "The tested page 9 produces nine readable translated blocks, retaining paragraph starts without fallback blocks or visible OCR gibberish." },
  case06Coverage: { zh: "选测 1 / 107 页：9", en: "1 of 107 pages: 9" },
  case06Category: { zh: "历史扫描技术报告", en: "Historical scanned technical report" },
  case05Limitation: { zh: "短字段说明、链接及日期/页脚等12处需展开；这不是可填写译文表单的验收。", en: "12 short instructions, links or date/footer labels require expansion; this does not validate an editable translated form." },
  case05Finding: { zh: "复选框、纳税人号码框、签名线和细边框保留；混色标题保留原图，可点击查看译文。", en: "Checkboxes, taxpayer-number boxes, signature lines and fine borders remain; mixed-color headings retain their source image with click-to-view translation." },
  case05Coverage: { zh: "选测 1 / 6 页：1", en: "1 of 6 pages: 1" },
  case05Category: { zh: "空白官方表单 / 细边框", en: "Blank official form / fine borders" },
  case04Limitation: { zh: "部分原文断词残留，中英文片段混杂；MAP/GOVERN术语不统一，居中标题会偏左。", en: "Broken-word fragments remain, MAP/GOVERN terminology varies, and formerly centered headings can appear left-aligned." },
  case04Finding: { zh: "目录缩进和右侧页码对齐，表格细线、分行边界与标识编号保留。", en: "Contents indentation and page-number columns align; table rules, row boundaries and identifiers remain intact." },
  case04Coverage: { zh: "选测 2 / 48 页：4、28", en: "2 of 48 pages: 4, 28" },
  case04Category: { zh: "英文报告 / 目录 / 表格", en: "English report / contents / tables" },
  case03Limitation: { zh: "23处紧凑标签、条件或页脚需展开；工程符号En曾被误译成“恩”，需核对原文。", en: "23 compact labels, conditions or footers require expansion; the engineering symbol En is mistranslated as “恩”." },
  case03Finding: { zh: "第6页细表格线、灰色表头和MIN/TYP/MAX数值列保持原行列位置。", en: "Page 6 keeps fine table rules, the gray header and MIN/TYP/MAX values in their original cells." },
  case03Coverage: { zh: "选测 1 / 68 页：6", en: "1 of 68 pages: 6" },
  case03Category: { zh: "芯片数据手册 / 参数表", en: "Chip datasheet / electrical table" },
  case02Limitation: { zh: "一个Jacobian分式未识别成公式而被压平；数值稳定项epsilon符号仍丢失。", en: "One Jacobian fraction is flattened as text; the numerical-stability epsilon symbol is still missing." },
  case02Finding: { zh: "第3页双栏、页眉横线和独立公式保留，21个已识别行内公式附件显示，无占位符泄漏。", en: "Page 3 keeps both columns, the header rule and displayed equations; 21 recognized inline formula images render without placeholder leaks." },
  case02Coverage: { zh: "选测 1 / 9 页：3", en: "1 of 9 pages: 3" },
  case02Category: { zh: "双栏论文 / 密集数学公式", en: "Two-column paper / dense math" },
  case01Limitation: { zh: "未单独识别的上标/下标仍有扁平化或丢失；引用样式、换行和留白与原稿不同。", en: "Some unrecognized superscripts/subscripts are flattened or lost; citation styling, line breaks and whitespace differ." },
  case01Finding: { zh: "双栏、示意图、细框与数值列保持原区域，已识别行内公式正常显示。", en: "Columns, diagrams, fine borders and numeric columns remain in their source areas; recognized inline formulas render." },
  case01Coverage: { zh: "选测 5 / 16 页：1、3、5、11、16", en: "5 of 16 pages: 1, 3, 5, 11, 16" },
  case01Category: { zh: "双栏论文 / 图表 / 公式", en: "Two-column paper / figures / formulas" },
  validationSourceNote: { zh: "公开原件可能随来源更新；这里的页数与结论对应本次留存版本。完整清单包含原件哈希与每份的视觉抽查范围。", en: "Public source files may change. Page counts and findings refer to the tested snapshots; the full record includes original hashes and each document’s visual-review scope." },
  validationData: { zh: "下载完整实测清单（JSON）", en: "Download the full test record (JSON)" },
  caseUnsupported: { zh: "不支持，保留原页", en: "Unsupported; original kept" },
  casePartial: { zh: "部分完成", en: "Partial" },
  caseComplete: { zh: "处理完成", en: "Complete" },
  caseFinding: { zh: "观察与剩余问题", en: "Findings and remaining issues" },
  caseOutcome: { zh: "处理结果", en: "Processing result" },
  caseCoverage: { zh: "实际测试范围", en: "Tested pages" },
  caseDocument: { zh: "文档与类型", en: "Document and type" },
  validationWindows: { zh: "这组 20 份的排版回归使用 Mac 生产画布。Windows 另选论文、财报、彩色幻灯片、表单、法语手册与扫描稿各 1 页实测，共 6 页；同时完成首次安装与升级验收。", en: "The 20-document layout regression used the production Mac canvas. Windows separately tested one page each from a paper, financial report, color slide deck, form, French manual and scan—six pages in total—along with fresh installation and upgrade acceptance." },
  validationMethod: { zh: "测试环境：MinerU 4.0.12 Basic / ONNX CPU + DeepSeek deepseek-flash，2026-10-27。全部 134 页已重新打开，原 PDF 哈希均未变。视觉复查包含总览和原尺寸抽查，不等于逐字专业审校。", en: "Test environment: MinerU 4.0.12 Basic / ONNX CPU with DeepSeek deepseek-flash, October 27, 2026. All 134 pages reopened and original PDF hashes stayed unchanged. Visual review included overviews and full-size spot checks, not professional word-by-word proofreading." },
  validationLimits: { zh: "复杂内容仍有限制：部分公式符号会丢失，金融与技术术语会误译；密集表格和参考文献常需点击展开。阿语扫描本例没有生成中文译文。", en: "Complex content still has limits: some formula symbols are lost, financial and technical terms can be mistranslated, and dense tables or references may need expansion. The Arabic scan in this set produced no Chinese translation." },
  validationFixed: { zh: "版式修复有效：所测背景、色块、细边框和图表位置得到保留；公式占位符泄漏为 0。财报 5 页的 516 个数值区域核对未改变原数字。", en: "The layout fixes helped: tested backgrounds, colored areas, fine borders and figure positions were retained, with zero formula-placeholder leaks. Checks of 516 numeric regions across five financial-report pages found no changed source numbers." },
  validationConclusion: { zh: "18 份处理完成，Adam 部分完成，阿语扫描不支持。这组结果说明原页对照阅读已经可用，但不能将“处理完成”当成翻译质量全部合格。", en: "Processing completed for 18 documents. Adam was partial, and the Arabic scan was unsupported. Original-page reading is usable within this scope, but completing a run does not mean every translation is correct." },
  validationConclusionTitle: { zh: "结论：适合辅助阅读，关键内容仍需核对", en: "Conclusion: useful for reading, with key details to verify" },
  validationScope: { zh: "20 份原件共 746 页，实际测试 134 个不重复物理页：6 份全文共 87 页，14 份选页共 47 页。页码从 1 开始，按 PDF 物理页计算。", en: "The 20 originals contain 746 pages; we tested 134 unique physical pages: 87 pages across six full documents and 47 selected pages from 14 others. Page numbers are 1-based physical PDF pages." },
  validationIntro: { zh: "覆盖论文、财报、技术手册、表单、彩色幻灯片与扫描件。下面列的是修复后的真实结果，包括仍未解决的问题。点击文档标题可查看公开原件。", en: "Papers, financial statements, manuals, forms, colorful slides and scans. These are the actual results after the layout fixes, including unresolved issues. Open a document title to view its public source." },
  validationTitle: { zh: "20 份 PDF，测了什么", en: "What we tested across 20 PDFs" },
  navValidation: { zh: "实测结果", en: "PDF tests" },
  reflowPreviewLabel: { zh: "查看重排 PDF 的原文、对照与译文", en: "Preview the original, side-by-side and translated reflow PDF" },
  readingCaption: { zh: "PageBridge 0.5.0，Windows 实际界面。示例：<a href=\"https://ntrs.nasa.gov/citations/20240009082\" target=\"_blank\" rel=\"noreferrer\">2024 NASA Balloon Program Overview</a>，本次仅翻译第 1 页；下方未选页保留原文。译文为机器生成。", en: "Actual PageBridge 0.5.0 interface on Windows. Sample: <a href=\"https://ntrs.nasa.gov/citations/20240009082\" target=\"_blank\" rel=\"noreferrer\">2024 NASA Balloon Program Overview</a>. Only page 1 was translated in this run; unselected pages below keep the original. Translation is machine-generated." },
  verificationLink: { zh: "查看 20 份 PDF 与测试结论", en: "See all 20 PDFs and conclusions" },
  verificationText: { zh: "0.5.0 回归覆盖 20 份 PDF 的 134 个物理页；完成 Windows 首次安装与 Mac、Windows 0.4 → 0.5 升级验收。", en: "The 0.5.0 regression covered 134 physical pages across 20 PDFs. Windows fresh installation and Mac/Windows upgrades from 0.4 to 0.5 were verified." },
  reflowDetails: { zh: "可搜索、批注和导出；字距、换行或局部布局可能变化。适合需要保存或分享译文的情况。", en: "Search, annotate and export the result. Spacing, line breaks or local layout may change. Use this when you need to save or share a translation." },
  reflowDesc: { zh: "文字按译后长度重新排版，生成独立的译文 PDF，也能生成原译交替页。", en: "Text is reflowed to fit its translated length in a separate PDF, with an optional alternating original-and-translation version." },
  reflowTag: { zh: "适合导出与批注", en: "For export and annotation" },
  reflowTitle: { zh: "重排 PDF", en: "Create a reflow PDF" },
  canvasLimit: { zh: "阅读稿暂不支持自身搜索、批注或 PDF 导出。", en: "This reading view does not yet support its own search, annotations or PDF export." },
  canvasOverflow: { zh: "已识别行内公式使用原页裁图；文字放不下时点击展开。", en: "Recognized inline formulas use crops from the original. Expand text that does not fit in its area." },
  canvasTables: { zh: "原生表格保留数字与格线，翻译文字标签；扫描表格保留原图并提供辅助译文。", en: "Native tables keep numbers and grid lines while labels are translated. Scanned tables retain their image with a supporting translation." },
  canvasLayout: { zh: "尽量保留背景、色块、细边框和图表位置。", en: "Preserves backgrounds, colored areas, fine borders and figure positions where possible." },
  canvasDesc: { zh: "译文回到原段落区域，原文与译文的页顶、缩放和滚动保持一致。", en: "Translations sit in the original paragraph areas, with matching page tops, zoom and synchronized scrolling." },
  canvasTag: { zh: "0.5 新增 · 默认方式", en: "New in 0.5 · Default" },
  canvasTitle: { zh: "对照阅读", en: "Read side by side" },
  readingIntro: { zh: "阅读时优先保留原页位置；需要带走译文时，生成可导出的 PDF。原 PDF 始终保留。", en: "Keep the page structure for reading, or create a PDF to take with you. Your original PDF stays intact." },
  readingTitle: { zh: "同一份原文，两种翻译方式", en: "One original. Two ways to translate." },
  limitReading: { zh: "对照阅读稿暂不支持自身全文搜索、批注或 PDF 导出；密集文字可能需要点击展开。", en: "The reading view does not yet support its own full-text search, annotations or PDF export. Dense text may need to be expanded." },
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
  heroTitle: { zh: "<span class=\"pb-title-line\">循着原来的版式</span><span class=\"pb-title-line\">读懂另一种语言</span>", en: "<span class=\"pb-title-line\">A new language.</span><span class=\"pb-title-line\">A familiar page.</span>" },
  heroLede: { zh: "在原文旁读译文，两边一起滚动。PageBridge 0.5 用 MinerU 在本机识别 PDF 与扫描页，把译文放回原段落的位置，尽量保留分栏、图片和表格。翻译使用你选择的 Ollama 或 OpenAI 兼容服务。", en: "Read a translation beside the original and scroll both together. PageBridge 0.5 uses MinerU to recognize PDFs and scans locally, placing translated text in its original area while preserving columns, images and tables where possible. Choose your own Ollama or OpenAI-compatible translation service." },
  downloadNow: { zh: "立即下载", en: "Download" },
  allDownloads: { zh: "全部下载选项", en: "All downloads" },
  primaryOther: { zh: "在 Mac 或 Windows 电脑上安装", en: "Install on a Mac or Windows PC" },
  releaseSource: { zh: "下载链接来自 GitHub Releases，页面会自动检查最新版本。", en: "Download links come from GitHub Releases and are checked for the latest version automatically." },
  modeGroupLabel: { zh: "阅读视图", en: "Reading view" },
  modeOriginal: { zh: "原文", en: "Original" },
  modeDual: { zh: "对照", en: "Side by side" },
  modeTranslation: { zh: "译文", en: "Translation" },
  modeNoteOriginal: { zh: "重排模式 · 原文：按 PDF 原样显示，文本页可选择、搜索和批注。", en: "Reflow mode · Original: the PDF as published; text pages can be selected, searched and annotated." },
  modeNoteDual: { zh: "重排模式 · 对照：左侧原文、右侧译文，可开启同步滚动。", en: "Reflow mode · Side by side: the original and reflow translation, with optional synchronized scrolling." },
  modeNoteTranslation: { zh: "重排模式 · 译文：中文随内容长度重新排版，可搜索、批注和导出。", en: "Reflow mode · Translation: Chinese text reflows to fit, with search, annotations and export." },
  stageCaption: { zh: "Mac 版 0.5.0 的重排 PDF 模式，非 MinerU 阅读稿。示例：Rougier 等，<cite>Ten Simple Rules for Better Figures</cite>，2014（CC0）。中文为机器翻译。", en: "Reflow PDF mode in PageBridge 0.5.0 on Mac, not the MinerU reading view. Sample: Rougier et al., <cite>Ten Simple Rules for Better Figures</cite>, 2014 (CC0). Chinese text is machine-translated." },
  flowTitle: { zh: "从打开 PDF 到开始阅读", en: "From opening a PDF to reading it" },
  stepImportTitle: { zh: "导入或检索", en: "Import or search" },
  stepImportDesc: { zh: "拖入 PDF 或点击 + 导入；也可以按标题、关键词或 DOI 检索 OpenAlex，下载全文后直接打开。", en: "Drop in a PDF or import it with +, or search OpenAlex by title, keyword or DOI and open the full text directly." },
  stepTranslateTitle: { zh: "选页翻译", en: "Translate pages" },
  stepTranslateDesc: { zh: "默认生成对照阅读稿，选择语言与页码，例如 <code>1-5, 8</code>。首次使用会下载识别组件；取消或整体失败会保留上次成功的阅读稿。", en: "Choose a language and pages, such as <code>1-5, 8</code>, to create a side-by-side reading view. Recognition components download on first use. Cancellation or a failed run keeps the last successful view." },
  stepReadTitle: { zh: "对照阅读", en: "Read side by side" },
  stepReadDesc: { zh: "原文和译文按同一页对齐，双向同步滚动，也可关闭同步分别读。密集段落可以点击展开全文，失败的段落可单独重试。", en: "Keep both sides aligned on the same page and scroll in either direction, or turn sync off to read independently. Click dense text to read it in full; retry failed paragraphs individually." },
  stepExportTitle: { zh: "需要 PDF 时", en: "Need a PDF file?" },
  stepExportDesc: { zh: "在翻译窗口选择“重排 PDF”，生成可导出的译文或原译逐页交替的双语 PDF。对照阅读稿与重排 PDF 分开保存。", en: "Choose the reflow PDF option in the translation dialog to create an exportable translation or page-alternating bilingual PDF. The reading view and reflow PDF are saved separately." },
  featuresTitle: { zh: "读的时候顺手做的事", en: "What you do while reading" },
  featuresDesc: { zh: "在同一个工作区管理文档、查找文献和向助手提问。原文与重排 PDF 还支持文字搜索、批注和笔记。", en: "Manage documents, find papers and ask the assistant in one workspace. Original and reflow PDFs also support text search, annotations and notes." },
  notesTitle: { zh: "批注与笔记", en: "Annotations and notes" },
  notesDesc: { zh: "在原文或重排 PDF 中选中文字，即可高亮、加下划线或写笔记，也可以添加页笔记和书签。笔记面板按页列出批注，点击回到原处。对照阅读稿暂不支持自身批注。", en: "Select text in the original or a reflow PDF to highlight, underline or add a note. Add page notes and bookmarks, then jump back from the notes panel. The side-by-side reading view does not yet support its own annotations." },
  notesPointSource: { zh: "原文和重排译文的批注分开保存，添加前可选择来源", en: "Annotations for the original and reflow translation are saved separately; choose the source before adding one" },
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
  alsoExportDesc: { zh: "重排模式可导出译文和逐页交替的双语 PDF；对照阅读稿暂不支持 PDF 导出。", en: "Reflow mode exports translated and page-alternating bilingual PDFs. The reading view does not yet export to PDF." },
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
  windowsCaption: { zh: "Windows 11 上的 PageBridge 0.5.0：空白 IRS W-9 表的对照阅读稿，未填写个人资料。", en: "PageBridge 0.5.0 on Windows 11: a side-by-side reading view of a blank IRS W-9 form, with no personal information filled in." },
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
  limitOcr: { zh: "MinerU 支持文本页与扫描页识别；复杂公式、低清扫描仍可能识别错误。阿语扫描页没有阿语文本层时暂不支持。", en: "MinerU recognizes text pages and scans. Complex formulas and low-quality scans can be misread; Arabic scans without an Arabic text layer are not supported yet." },
  limitAccuracy: { zh: "机器翻译和 AI 回答可能出错，公式、数字和关键条款请对照原文。", en: "Machine translation and AI answers can be wrong; check formulas, numbers and key clauses against the original." },
  limitModels: { zh: "应用不包含语言模型，也不附带云服务额度；Ollama 和模型需要另行安装。", en: "No language model or cloud credit is included; install Ollama and models separately." },
  downloadsTitle: { zh: "下载", en: "Download" },
  downloadsDesc: { zh: "安装包自带基础运行环境，无需另装 Python。首次使用对照阅读时会下载独立的识别环境与模型，请联网并预留约 4 GB 空间；模型权重不包含在安装包内。", en: "Packages include the base runtime; no separate Python installation is needed. The first side-by-side translation downloads a recognition environment and models. Connect to the internet and allow about 4 GB of free space; model weights are not bundled." },
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
  openDesc: { zh: "PageBridge 的原创代码采用 AGPL-3.0-only。对照阅读使用 <a href=\"https://github.com/opendatalab/MinerU\" target=\"_blank\" rel=\"noreferrer\">MinerU</a> 解析，重排 PDF 使用 <a href=\"https://github.com/PDFMathTranslate-next/PDFMathTranslate-next\" target=\"_blank\" rel=\"noreferrer\">PDFMathTranslate-next</a> 与 <a href=\"https://github.com/funstory-ai/BabelDOC\" target=\"_blank\" rel=\"noreferrer\">BabelDOC</a>。第三方组件保留各自许可，每个发行版附项目源码与第三方对应源码。", en: "PageBridge’s original code is licensed AGPL-3.0-only. <a href=\"https://github.com/opendatalab/MinerU\" target=\"_blank\" rel=\"noreferrer\">MinerU</a> parses documents for side-by-side reading; <a href=\"https://github.com/PDFMathTranslate-next/PDFMathTranslate-next\" target=\"_blank\" rel=\"noreferrer\">PDFMathTranslate-next</a> and <a href=\"https://github.com/funstory-ai/BabelDOC\" target=\"_blank\" rel=\"noreferrer\">BabelDOC</a> power reflow PDF translation. Third-party components retain their licenses. Every release includes project and corresponding third-party source." },
  githubRepository: { zh: "GitHub 仓库", en: "GitHub repository" },
  userGuide: { zh: "使用指南", en: "User guide (Chinese)" },
  reportIssue: { zh: "反馈问题", en: "Report an issue" },
  footerTagline: { zh: "Mac 与 Windows 原生 PDF 阅读与翻译工作区。", en: "A native PDF reading and translation workspace for Mac and Windows." },
  footerNavLabel: { zh: "页脚导航", en: "Footer navigation" },
  footerCredits: { zh: "对照阅读与重排 PDF 截图来自 0.5.0；批注、助手和检索示例保留 0.4.0 界面。文档来源：NASA、IRS、Rougier 等 2014（CC0）、Sandve 等 2013（CC BY）。译文与助手回答为机器生成。", en: "Reading and reflow PDF screenshots show 0.5.0; annotation, assistant and search examples retain the 0.4.0 interface. Sources: NASA, IRS, Rougier et al. 2014 (CC0), and Sandve et al. 2013 (CC BY). Translations and assistant answers are machine-generated." },
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
    // Keep the v0.5.0 links already in the page.
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
