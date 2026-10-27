import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

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
