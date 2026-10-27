import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import { runInNewContext } from "node:vm";

const pageUrl = new URL("../pagebridge/index.html", import.meta.url);
const scriptUrl = new URL("../pagebridge/app.js", import.meta.url);
const homeUrl = new URL("../pages/home.html", import.meta.url);
const i18nUrl = new URL("../src/i18n.js", import.meta.url);
const buildUrl = new URL("../scripts/build.mjs", import.meta.url);
const headersUrl = new URL("../_headers", import.meta.url);
const sitemapUrl = new URL("../sitemap.xml", import.meta.url);

test("PageBridge page exposes v0.5.0 GitHub Release downloads with checksums", async () => {
  const [html, script] = await Promise.all([readFile(pageUrl, "utf8"), readFile(scriptUrl, "utf8")]);

  assert.match(html, /"softwareVersion": "0\.5\.0"/);
  for (const asset of ["PageBridge-0.5.0-macOS-arm64.zip", "PageBridge-0.5.0-windows-x64-setup.exe", "PageBridge-0.5.0-windows-x64.zip"]) {
    const escaped = asset.replaceAll(".", "\\.");
    assert.match(html, new RegExp(`releases/download/v0\\.5\\.0/${escaped}"`));
    assert.match(html, new RegExp(`releases/download/v0\\.5\\.0/${escaped}\\.sha256"`));
  }
  assert.equal((html.match(/data-asset="/g) || []).length, 3);
  assert.equal((html.match(/data-checksum="/g) || []).length, 3);
  assert.equal((html.match(/<article class="download-card(?: recommended)?" data-platform=/g) || []).length, 3);
  assert.match(html, /styles\.css\?v=__ASSET_VERSION__/);
  assert.match(html, /app\.js\?v=__ASSET_VERSION__/);
  assert.match(html, /href="\.\.\/pages\/shared\/editorial\.css\?v=__ASSET_VERSION__"/);

  const copyKeys = new Set([...script.matchAll(/^\s{2}(\w+): \{ zh: /gm)].map((match) => match[1]));
  for (const [, key] of html.matchAll(/data-copy(?:-label)?="(\w+)"/g)) {
    assert.ok(copyKeys.has(key), `missing copy for ${key}`);
  }

  assert.match(script, /api\.github\.com\/repos\/\$\{REPOSITORY\}\/releases\/latest/);
  assert.match(script, /browser_download_url/);
  assert.match(script, /macOS-arm64\\\.zip/);
  assert.match(script, /windows-x64-setup\\\.exe/);
  assert.match(script, /windows-x64\\\.zip/);
  assert.match(script, /pagebridge-language/);
});

test("PageBridge reading-mode switch has a real screenshot for every view", async () => {
  const [html, script] = await Promise.all([readFile(pageUrl, "utf8"), readFile(scriptUrl, "utf8")]);

  for (const mode of ["original", "dual", "translation"]) {
    assert.match(html, new RegExp(`<button type="button" data-mode="${mode}" aria-pressed="(?:true|false)"`));
    assert.match(html, new RegExp(`data-mode-image="${mode}"\\s+src="\\./assets/reader-${mode}-050\\.jpg"`));
    await access(new URL(`../pagebridge/assets/reader-${mode}-050.jpg`, import.meta.url));
  }
  assert.equal((html.match(/aria-pressed="true"/g) || []).length, 1);
  assert.match(html, /class="is-active"\s+data-mode-image="dual"\s+src="\.\/assets\/reader-dual-050\.jpg"/);
  for (const note of ["modeNoteOriginal", "modeNoteDual", "modeNoteTranslation"]) {
    assert.match(script, new RegExp(`^\\s{2}${note}: \\{ zh: `, "m"));
  }
  // Literature search is shown with the public-PDF source, as in the promo material.
  assert.match(html, /全文来源为公开 PDF/);
});

test("modusignal home and production build include PageBridge", async () => {
  const [home, i18n, build, headers, sitemap] = await Promise.all([
    readFile(homeUrl, "utf8"),
    readFile(i18nUrl, "utf8"),
    readFile(buildUrl, "utf8"),
    readFile(headersUrl, "utf8"),
    readFile(sitemapUrl, "utf8"),
  ]);

  assert.match(home, /href="\.\/pagebridge\/"/);
  assert.match(home, /href="\.\/pagebridge\/#downloads"/);
  assert.match(home, /href="https:\/\/github\.com\/txp666\/PageBridge"/);
  assert.match(home, /src="\.\/pagebridge\/assets\/reading-050\.png"/);
  assert.ok(home.lastIndexOf("pyqtDesignerCardTitle") < home.lastIndexOf("pageBridgeCardTitle"));
  assert.ok(home.lastIndexOf("pageBridgeCardTitle") < home.lastIndexOf("architecture-card"));
  for (const [, key] of home.matchAll(/data-i18n="(home\.pageBridge\w+)"/g)) {
    assert.match(i18n, new RegExp(`"${key.replace(".", "\\.")}"`));
  }
  assert.match(build, /\["pagebridge", "pagebridge"\]/);
  assert.match(build, /join\(siteRoot, "pagebridge", "index\.html"\)/);
  assert.match(build, /join\(siteRoot, "pagebridge"\),/);
  assert.match(headers, /\/pagebridge\/assets\/\*/);
  assert.match(sitemap, /https:\/\/modusignal\.cn\/pagebridge\//);
});


test("public PDF regression records match all 20 bilingual table rows and tested coverage", async () => {
  const [html, script, raw] = await Promise.all([
    readFile(pageUrl, "utf8"),
    readFile(scriptUrl, "utf8"),
    readFile(new URL("../pagebridge/test-results.json", import.meta.url), "utf8"),
  ]);
  const { aggregate, cases } = JSON.parse(raw);
  const copySource = script.match(/const copy = (\{[\s\S]*?\n\});/);
  assert.ok(copySource, "the language copy must remain inspectable");
  const copy = runInNewContext(`(${copySource[1]})`, {}, { timeout: 1000 });
  const rows = [...html.matchAll(/<tr data-case="([^"]+)">([\s\S]*?)<\/tr>/g)];
  const decode = (value) => value.replace(/&(amp|lt|gt|quot|#39|#x27);/g, (_, entity) => ({
    amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", "#x27": "'",
  })[entity]);
  const publicHosts = new Set([
    "aclanthology.org", "proceedings.mlr.press", "www.ti.com", "nvlpubs.nist.gov",
    "www.irs.gov", "ntrs.nasa.gov", "tsapps.nist.gov", "arxiv.org", "www.ietf.org",
    "www.uscis.gov", "www.caict.ac.cn", "www.inrs.fr", "www.berkshirehathaway.com",
    "www.unicef.org",
  ]);

  assert.equal(cases.length, 20);
  assert.equal(new Set(cases.map((item) => item.id)).size, 20);
  assert.equal(new Set(cases.map((item) => item.sourceSHA256)).size, 20);
  assert.equal(rows.length, 20);
  assert.deepEqual(rows.map((row) => row[1]), cases.map((item) => item.id));
  assert.equal(cases.reduce((sum, item) => sum + item.sourcePages, 0), 746);
  assert.equal(cases.reduce((sum, item) => sum + item.testedPages.length, 0), 134);
  const outcomes = Object.fromEntries(["complete", "partial", "unsupported"].map((outcome) => [
    outcome, cases.filter((item) => item.outcome === outcome).length,
  ]));
  assert.deepEqual(outcomes, { complete: 18, partial: 1, unsupported: 1 });
  assert.equal(aggregate.documents, 20);
  assert.equal(aggregate.sourcePages, 746);
  assert.equal(aggregate.testedPages, 134);
  for (const [outcome, count] of Object.entries(outcomes)) assert.equal(aggregate[outcome], count);
  assert.equal(aggregate.originalsUnchanged, true);
  assert.equal(aggregate.semanticQualityPassClaimed, false);
  assert.doesNotMatch(raw, /(?:file:\/\/|https?:\/\/(?:localhost|127\.|\[::1\]|10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)|\/Users\/|\/private\/|[A-Z]:\\Users\\)/i);
  assert.match(html, /href="\.\/test-results\.json"[^>]*download=/);

  cases.forEach((item, index) => {
    const row = rows[index][2];
    const source = new URL(item.sourceUrl);
    assert.equal(source.protocol, "https:");
    assert.ok(publicHosts.has(source.hostname), `unrecognized public source for ${item.id}`);
    assert.equal(source.username + source.password, "");
    assert.match(item.sourceSHA256, /^[a-f0-9]{64}$/);
    assert.equal(item.originalUnchanged, true);
    assert.equal(new Set(item.testedPages).size, item.testedPages.length);
    assert.ok(item.testedPages.every((page) => Number.isInteger(page) && page >= 1 && page <= item.sourcePages));
    const isFull = item.testedPages.length === item.sourcePages;
    assert.equal(item.scope, isFull ? "full" : "selected");
    assert.ok(Object.values(item.visualReview).flat().every((page) => item.testedPages.includes(page)));
    const link = row.match(/<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
    assert.equal(decode(link?.[1] || ""), item.sourceUrl);
    assert.equal(decode(link?.[2] || ""), item.title);
    assert.ok(row.includes(`pb-case-${item.outcome}`));
    const prefix = `case${String(index + 1).padStart(2, "0")}`;
    const coverage = isFull
      ? { zh: `全文 ${item.sourcePages} 页（1–${item.sourcePages}）`, en: `Full document: ${item.sourcePages} pages (1–${item.sourcePages})` }
      : { zh: `选测 ${item.testedPages.length} / ${item.sourcePages} 页：${item.testedPages.join("、")}`, en: `${item.testedPages.length} of ${item.sourcePages} pages: ${item.testedPages.join(", ")}` };
    for (const [field, expected] of Object.entries({ Category: item.category, Coverage: coverage, Finding: item.finding, Limitation: item.limitation })) {
      const key = `${prefix}${field}`;
      const value = row.match(new RegExp(`data-copy="${key}">([\\s\\S]*?)<\\/`));
      assert.equal(decode(value?.[1] || ""), expected.zh, `${item.id} ${field}: HTML differs from record`);
      for (const language of ["zh", "en"]) {
        assert.equal(copy[key]?.[language], expected[language], `${item.id} ${field}: ${language} differs from record`);
      }
    }
  });
});
