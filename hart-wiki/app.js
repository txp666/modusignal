import { HART_COMMAND_FRAMES } from "./command-frames.js?v=1.4.0";

const root = document.documentElement;
const themeToggle = document.querySelector("[data-theme-toggle]");
const menuToggle = document.querySelector("[data-menu-toggle]");
const sidebar = document.querySelector("[data-wiki-sidebar]");
const searchInputs = [...document.querySelectorAll("[data-wiki-search]")];
const searchInput = searchInputs[0];
const searchStatus = document.querySelector("[data-search-status]");
const searchableItems = [...document.querySelectorAll("[data-searchable]")];
const sectionLinks = [...document.querySelectorAll("[data-section-link]")];
const copyButtons = [...document.querySelectorAll("[data-copy-target]")];
const checksumInput = document.querySelector("[data-checksum-input]");
const checksumResult = document.querySelector("[data-checksum-result]");
const checksumStatus = document.querySelector("[data-checksum-status]");
const statusByteInput = document.querySelector("[data-status-byte-input]");
const statusByteOutput = document.querySelector("[data-status-byte-output]");
const statusBinary = document.querySelector("[data-status-binary]");
const statusSummary = document.querySelector("[data-status-summary]");
const statusBitRows = [...document.querySelectorAll("[data-status-mask]")];
const commandFrameExplorer = document.querySelector("[data-command-frame-explorer]");
const commandFrameSelect = document.querySelector("[data-command-frame-select]");
const commandFrameResult = document.querySelector("[data-command-frame-result]");

function syncThemeButton() {
  if (!themeToggle) return;
  const dark = root.dataset.theme === "dark";
  themeToggle.textContent = dark ? "☀" : "☾";
  themeToggle.setAttribute("aria-label", dark ? "切换到浅色主题" : "切换到深色主题");
  themeToggle.title = dark ? "切换到浅色主题" : "切换到深色主题";
}

themeToggle?.addEventListener("click", () => {
  const next = root.dataset.theme === "dark" ? "light" : "dark";
  root.dataset.theme = next;
  root.style.colorScheme = next;
  localStorage.setItem("modusignal-theme", next);
  syncThemeButton();
});

menuToggle?.addEventListener("click", () => {
  const open = sidebar?.classList.toggle("open") ?? false;
  menuToggle.setAttribute("aria-expanded", String(open));
});

sectionLinks.forEach((link) => {
  link.addEventListener("click", () => {
    sidebar?.classList.remove("open");
    menuToggle?.setAttribute("aria-expanded", "false");
  });
});

function normalize(value) {
  return value.trim().toLocaleLowerCase("zh-CN");
}

function applySearch(value = searchInput?.value ?? "") {
  const query = normalize(value);
  let visible = 0;
  searchableItems.forEach((item) => {
    const matches = !query || normalize(item.textContent ?? "").includes(query);
    item.hidden = !matches;
    if (matches) visible += 1;
  });

  if (!searchStatus) return;
  if (!query) {
    searchStatus.textContent = "可搜索命令号、术语、故障现象与关键词";
  } else if (visible > 0) {
    searchStatus.textContent = `找到 ${visible} 条与“${value.trim()}”相关的内容`;
  } else {
    searchStatus.textContent = `没有找到“${value.trim()}”，试试“Cmd 0”“250 Ω”或“校验”`;
  }
}

searchInputs.forEach((input) => {
  input.addEventListener("input", () => {
    searchInputs.forEach((peer) => { if (peer !== input) peer.value = input.value; });
    applySearch(input.value);
  });
  input.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      searchInputs.forEach((peer) => { peer.value = ""; });
      applySearch("");
      input.blur();
    }
  });
});

window.addEventListener("keydown", (event) => {
  if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
  const target = event.target;
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target?.isContentEditable) return;
  event.preventDefault();
  (searchInputs.find((input) => input.offsetParent !== null) ?? searchInput)?.focus();
});

copyButtons.forEach((button) => {
  button.addEventListener("click", async () => {
    const target = document.querySelector(button.dataset.copyTarget);
    if (!target) return;
    const original = button.textContent;
    try {
      await navigator.clipboard.writeText(target.textContent.trim());
      button.textContent = "已复制";
    } catch {
      button.textContent = "复制失败";
    }
    setTimeout(() => { button.textContent = original; }, 1500);
  });
});

function parseChecksumBytes(value) {
  const compact = value.replaceAll(/0x/gi, "").replaceAll(/[\s,;:-]+/g, "");
  if (!compact || compact.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(compact)) return null;
  return compact.match(/.{2}/g).map((byte) => Number.parseInt(byte, 16));
}

function updateChecksum() {
  if (!checksumInput || !checksumResult || !checksumStatus) return;
  const bytes = parseChecksumBytes(checksumInput.value);
  const valid = Array.isArray(bytes) && bytes.length > 0;
  checksumInput.classList.toggle("invalid", !valid);
  checksumResult.classList.toggle("invalid", !valid);
  if (!valid) {
    checksumResult.textContent = "--";
    checksumStatus.textContent = "请输入完整的十六进制字节";
    return;
  }
  const checksum = bytes.reduce((result, byte) => result ^ byte, 0);
  checksumResult.textContent = checksum.toString(16).toUpperCase().padStart(2, "0");
  checksumStatus.textContent = `${bytes.length} bytes · XOR 结果`;
}

checksumInput?.addEventListener("input", updateChecksum);
updateChecksum();

function parseStatusByte(value) {
  const compact = value.trim().replace(/^0x/i, "");
  if (!/^[0-9a-f]{1,2}$/i.test(compact)) return null;
  return Number.parseInt(compact, 16);
}

function updateStatusByte() {
  if (!statusByteInput || !statusByteOutput || !statusBinary || !statusSummary) return;
  const byte = parseStatusByte(statusByteInput.value);
  const valid = Number.isInteger(byte);
  statusByteInput.classList.toggle("invalid", !valid);
  statusByteOutput.classList.toggle("invalid", !valid);
  if (!valid) {
    statusByteOutput.textContent = "--";
    statusBinary.textContent = "---- ----";
    statusSummary.textContent = "请输入 00–FF 的十六进制字节";
    statusBitRows.forEach((row) => row.classList.remove("active"));
    return;
  }

  const hex = byte.toString(16).toUpperCase().padStart(2, "0");
  const binary = byte.toString(2).padStart(8, "0");
  const activeLabels = [];
  statusByteOutput.textContent = `0x${hex}`;
  statusBinary.textContent = `${binary.slice(0, 4)} ${binary.slice(4)}`;
  statusBitRows.forEach((row) => {
    const active = (byte & Number.parseInt(row.dataset.statusMask, 16)) !== 0;
    row.classList.toggle("active", active);
    if (active) activeLabels.push(row.querySelector("strong")?.textContent ?? "");
  });
  statusSummary.textContent = activeLabels.filter(Boolean).join(" · ") || "未设置基础设备状态位";
}

statusByteInput?.addEventListener("input", updateStatusByte);
updateStatusByte();

function hexByte(value) {
  return Number(value).toString(16).toUpperCase().padStart(2, "0");
}

function exampleDataBytes(value) {
  if (!value) return [];
  return value.trim().split(/\s+/).map((byte) => Number.parseInt(byte, 16));
}

function buildRequestExample(definition) {
  const data = exampleDataBytes(definition.requestExample);
  const shortAddress = definition.address === "short" || definition.address === "discovery";
  const header = shortAddress
    ? [0x02, 0x80]
    : [0x82, 0x92, 0x34, 0x56, 0x78, 0x9a];
  const body = [...header, definition.command, data.length, ...data];
  const checksum = body.reduce((result, byte) => result ^ byte, 0);
  return [...Array(5).fill(0xff), ...body, checksum].map(hexByte).join(" ");
}

function buildResponseTemplate(definition) {
  const shortAddress = definition.address === "short" || definition.address === "discovery";
  const header = shortAddress ? "06 A0" : "86 A0 A1 A2 A3 A4";
  const byteCount = Number.isInteger(definition.responseLength)
    ? hexByte(definition.responseLength + 2)
    : "BC";
  const data = definition.responseLength === 0 ? "" : " DATA";
  return `FF × N ${header} ${hexByte(definition.command)} ${byteCount} RC DS${data} CS`;
}

function renderFrameFields(title, fields) {
  return `<section class="frame-data-panel"><h4>${title}</h4><div class="frame-field-table">${fields.map((field) => `
    <div><code>${field.offset}</code><span>${field.type}</span><p>${field.description}</p></div>`).join("")}</div></section>`;
}

function renderCommandFrame(command) {
  if (!commandFrameResult) return;
  const definition = HART_COMMAND_FRAMES.find((entry) => entry.command === Number(command)) ?? HART_COMMAND_FRAMES[0];
  const addressLabel = definition.address === "short"
    ? "短地址帧"
    : definition.address === "discovery"
      ? "发现阶段可用短地址"
      : "建立身份后使用长地址";
  const requestSize = Number.isInteger(definition.requestLength) ? `${definition.requestLength} byte` : `${definition.requestLength} bytes`;
  const responseSize = Number.isInteger(definition.responseLength) ? `${definition.responseLength} bytes` : `${definition.responseLength}`;
  const requestExample = buildRequestExample(definition);
  const responseTemplate = buildResponseTemplate(definition);

  commandFrameResult.innerHTML = `
    <header class="command-frame-selected">
      <div><span>Cmd ${definition.command}</span><h3>${definition.label}</h3></div>
      <div class="command-frame-meta"><span>${definition.category}</span><span>${addressLabel}</span><span>TX Data ${requestSize}</span><span>RX Data ${responseSize}</span></div>
    </header>
    <div class="command-frame-lanes">
      <div class="command-frame-lane tx"><div><strong>发送示例</strong><small>${definition.address === "long" ? "示例长地址：Type 0x1234 · ID 0x56789A" : "示例短地址：Primary Master · Polling Address 0"}</small></div><code data-frame-copy-source="tx">${requestExample}</code><button type="button" data-frame-copy="tx">复制</button></div>
      <div class="command-frame-lane rx"><div><strong>响应模板</strong><small>BC 包含 RC、DS 与 Response Data；实际字段以收到的 Byte Count 为界</small></div><code data-frame-copy-source="rx">${responseTemplate}</code><button type="button" data-frame-copy="rx">复制</button></div>
    </div>
    <div class="frame-data-grid">
      ${renderFrameFields("Request Data", definition.requestFields)}
      ${renderFrameFields("Response Data", definition.responseFields)}
    </div>
    <aside class="command-parse-rule"><strong>解析与验证</strong><p>${definition.verify}</p></aside>`;

  commandFrameResult.querySelectorAll("[data-frame-copy]").forEach((button) => {
    button.addEventListener("click", async () => {
      const source = commandFrameResult.querySelector(`[data-frame-copy-source="${button.dataset.frameCopy}"]`);
      const original = button.textContent;
      try {
        await navigator.clipboard.writeText(source?.textContent?.trim() ?? "");
        button.textContent = "已复制";
      } catch {
        button.textContent = "复制失败";
      }
      setTimeout(() => { button.textContent = original; }, 1500);
    });
  });
}

if (commandFrameExplorer && commandFrameSelect && commandFrameResult) {
  const groups = new Map();
  HART_COMMAND_FRAMES.forEach((definition) => {
    if (!groups.has(definition.category)) groups.set(definition.category, []);
    groups.get(definition.category).push(definition);
  });
  groups.forEach((definitions, label) => {
    const group = document.createElement("optgroup");
    group.label = label;
    definitions.forEach((definition) => {
      const option = document.createElement("option");
      option.value = String(definition.command);
      option.textContent = `Cmd ${definition.command} · ${definition.label}`;
      group.append(option);
    });
    commandFrameSelect.append(group);
  });
  commandFrameSelect.addEventListener("change", () => renderCommandFrame(commandFrameSelect.value));
  renderCommandFrame(commandFrameSelect.value || 0);
}

const observedSections = sectionLinks
  .map((link) => document.querySelector(link.getAttribute("href")))
  .filter(Boolean);

if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver((entries) => {
    const current = entries
      .filter((entry) => entry.isIntersecting)
      .sort((left, right) => left.boundingClientRect.top - right.boundingClientRect.top)[0];
    if (!current) return;
    sectionLinks.forEach((link) => {
      const active = link.getAttribute("href") === `#${current.target.id}`;
      link.classList.toggle("active", active);
      if (active) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    });
  }, { rootMargin: "-18% 0px -70%", threshold: 0 });
  observedSections.forEach((section) => observer.observe(section));
}

syncThemeButton();
