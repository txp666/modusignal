import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
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
  for (const side of ["source", "translated"]) {
    assert.ok(home.includes(`src="./pagebridge/assets/comparisons/bert-p3-${side}.png"`));
  }
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
  assert.match(sitemap, /https:\/\/modusignal\.cn\/pagebridge\/tests\//);
  assert.match(build, /join\(siteRoot, "pagebridge", "tests", "index\.html"\)/);
});


test("public PDF comparisons cover all 20 records with real paired images and honest test scope", async () => {
  const [html, comparisonHtml, comparisonScript, raw, imageRaw] = await Promise.all([
    readFile(pageUrl, "utf8"),
    readFile(new URL("../pagebridge/tests/index.html", import.meta.url), "utf8"),
    readFile(new URL("../pagebridge/tests/app.js", import.meta.url), "utf8"),
    readFile(new URL("../pagebridge/test-results.json", import.meta.url), "utf8"),
    readFile(new URL("../pagebridge/comparisons.json", import.meta.url), "utf8"),
  ]);
  const { aggregate, cases } = JSON.parse(raw);
  const comparisons = JSON.parse(imageRaw);
  const copySource = comparisonScript.match(/const COPY = (\{[\s\S]*?\n\});/);
  assert.ok(copySource, "the comparison page must expose its bilingual copy");
  const copy = runInNewContext(`(${copySource[1]})`, {}, { timeout: 1000 });
  const publicHosts = new Set([
    "aclanthology.org", "proceedings.mlr.press", "www.ti.com", "nvlpubs.nist.gov",
    "www.irs.gov", "ntrs.nasa.gov", "tsapps.nist.gov", "arxiv.org", "www.ietf.org",
    "www.uscis.gov", "www.caict.ac.cn", "www.inrs.fr", "www.berkshirehathaway.com",
    "www.unicef.org",
  ]);

  assert.equal(cases.length, 20);
  assert.equal(new Set(cases.map((item) => item.id)).size, 20);
  assert.equal(new Set(cases.map((item) => item.sourceSHA256)).size, 20);
  assert.deepEqual(comparisons.cases.map((item) => item.id), cases.map((item) => item.id));
  assert.equal(comparisons.caseCount, 20);
  assert.equal(comparisons.displayedPagePairs, 20);
  assert.equal(comparisons.testedPages, 134);
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
  for (const text of [raw, imageRaw]) {
    assert.doesNotMatch(text, /(?:file:\/\/|https?:\/\/(?:localhost|127\.|\[::1\]|10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)|\/Users\/|\/private\/|[A-Z]:\\Users\\)/i);
  }
  assert.match(html, /href="\.\/tests\/"/);
  assert.doesNotMatch(html, /<tr data-case=/, "the product page must not repeat the full results table");
  assert.match(comparisonHtml, /<select id="sampleSelect"/);
  assert.match(comparisonHtml, /href="\.\.\/test-results\.json"[^>]*download=/);
  assert.match(comparisonHtml, /<link rel="canonical" href="https:\/\/modusignal\.cn\/pagebridge\/tests\/"/);
  for (const [, key] of comparisonHtml.matchAll(/data-copy(?:-label)?="(\w+)"/g)) {
    for (const language of ["zh", "en"]) assert.ok(copy[key]?.[language], `missing ${language} comparison copy: ${key}`);
  }

  for (let index = 0; index < cases.length; index += 1) {
    const item = cases[index];
    const entry = comparisons.cases[index];
    const source = new URL(item.sourceUrl);
    assert.equal(source.protocol, "https:");
    assert.ok(publicHosts.has(source.hostname), `unrecognized public source for ${item.id}`);
    assert.equal(source.username + source.password, "");
    assert.match(item.sourceSHA256, /^[a-f0-9]{64}$/);
    assert.equal(item.originalUnchanged, true);
    assert.equal(new Set(item.testedPages).size, item.testedPages.length);
    assert.ok(item.testedPages.every((page) => Number.isInteger(page) && page >= 1 && page <= item.sourcePages));
    assert.equal(item.scope, item.testedPages.length === item.sourcePages ? "full" : "selected");
    assert.ok(Object.values(item.visualReview).flat().every((page) => item.testedPages.includes(page)));
    for (const field of ["category", "finding", "limitation"]) {
      for (const language of ["zh", "en"]) assert.ok(item[field][language], `${item.id} is missing ${language} ${field}`);
    }
    assert.equal(entry.pages.length, 1, "one representative pair is displayed per document");
    assert.equal(entry.representativePage, entry.pages[0].page);
    for (const page of entry.pages) {
      assert.ok(item.testedPages.includes(page.page), `${item.id} preview was not in the tested scope`);
      for (const [side, hashKey] of [["source", "sourceSHA256"], ["translation", "translationSHA256"]]) {
        assert.match(page[side], /^assets\/comparisons\/[a-z0-9-]+\.png$/);
        const bytes = await readFile(new URL(`../pagebridge/${page[side]}`, import.meta.url));
        assert.equal(createHash("sha256").update(bytes).digest("hex"), page[hashKey], `${item.id} ${side} differs from the recorded rendering`);
        assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
        assert.equal(bytes.readUInt32BE(16), page.width);
        assert.equal(bytes.readUInt32BE(20), page.height);
      }
      assert.equal(page.translationSameAsSource, page.sourceSHA256 === page.translationSHA256);
      if (item.outcome === "unsupported") assert.equal(page.translationSameAsSource, true, "unsupported Arabic must show the preserved original");
    }
  }
});
