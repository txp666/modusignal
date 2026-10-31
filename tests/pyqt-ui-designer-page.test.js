import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pageUrl = new URL("../pyqt-ui-designer/index.html", import.meta.url);
const scriptUrl = new URL("../pyqt-ui-designer/app.js", import.meta.url);
const homeUrl = new URL("../pages/home.html", import.meta.url);
const i18nUrl = new URL("../src/i18n.js", import.meta.url);
const buildUrl = new URL("../scripts/build.mjs", import.meta.url);
const headersUrl = new URL("../_headers", import.meta.url);
const sitemapUrl = new URL("../sitemap.xml", import.meta.url);

test("PyQt UI Designer page exposes GitHub Release downloads", async () => {
  const [html, script] = await Promise.all([readFile(pageUrl, "utf8"), readFile(scriptUrl, "utf8")]);

  assert.match(html, /PyQt UI Designer/);
  assert.match(html, /"softwareVersion": "0\.1\.6"/);
  assert.match(html, /PyQt-UI-Designer-v0\.1\.6-windows-x64\.zip/);
  assert.match(html, /PyQt-UI-Designer-v0\.1\.6-macos-arm64\.zip/);
  assert.match(html, /PyQt-UI-Designer-v0\.1\.6-macos-x64\.zip/);
  assert.match(html, /github\.com\/txp666\/PyQt-UI-Designer\/releases/);
  assert.match(html, /href="\.\/guide\/"/);
  assert.doesNotMatch(html, /temp<\/span>:/);
  assert.match(html, /TCP 或 MQTT/);
  assert.doesNotMatch(html, /正在开发中/);
  assert.match(html, /href="\.\.\/fluenthmi-studio\/"/);
  assert.equal((html.match(/data-asset="/g) || []).length, 3);
  assert.equal((html.match(/<article class="download-card(?: recommended)?" data-platform=/g) || []).length, 3);
  assert.match(html, /styles\.css\?v=20261031\.1/);
  assert.match(html, /app\.js\?v=20261031\.1/);
  assert.match(html, /id="workflow"/);
  assert.match(html, /src="\.\/assets\/designer\.jpg"/);
  assert.match(html, /src="\.\/assets\/preview\.jpg"/);
  assert.match(html, /src="\.\/assets\/demo\.jpg"/);

  const copyKeys = new Set([...script.matchAll(/^\s{2}(\w+): \{ zh: /gm)].map((match) => match[1]));
  for (const [, key] of html.matchAll(/data-copy="(\w+)"/g)) {
    assert.ok(copyKeys.has(key), `missing copy for ${key}`);
  }

  assert.match(script, /api\.github\.com\/repos\/\$\{REPOSITORY\}\/releases\/latest/);
  assert.match(script, /browser_download_url/);
  assert.match(script, /windows-x64\\\.zip/);
  assert.match(script, /macos-arm64\\\.zip/);
  assert.match(script, /macos-x64\\\.zip/);
  // The primary button follows the visitor's platform before the GitHub request starts.
  assert.match(script, /updatePrimaryDownload\(preferredPlatform\(\)\);\nrefreshLatestRelease\(\);\s*$/);
});

test("modusignal home and production build include PyQt UI Designer", async () => {
  const [home, i18n, build, headers, sitemap] = await Promise.all([
    readFile(homeUrl, "utf8"),
    readFile(i18nUrl, "utf8"),
    readFile(buildUrl, "utf8"),
    readFile(headersUrl, "utf8"),
    readFile(sitemapUrl, "utf8"),
  ]);

  assert.match(home, /href="\.\/pyqt-ui-designer\/"/);
  assert.match(home, /href="\.\/pyqt-ui-designer\/#downloads"/);
  assert.match(home, /href="https:\/\/github\.com\/txp666\/PyQt-UI-Designer"/);
  assert.match(home, /src="\.\/pyqt-ui-designer\/assets\/designer\.jpg"/);
  assert.ok(home.lastIndexOf("fluentSerialCardTitle") < home.lastIndexOf("pyqtDesignerCardTitle"));
  assert.ok(home.lastIndexOf("pyqtDesignerCardTitle") < home.lastIndexOf("architecture-card"));
  for (const [, key] of home.matchAll(/data-i18n="(home\.pyqtDesigner\w+)"/g)) {
    assert.match(i18n, new RegExp(`"${key.replace(".", "\\.")}"`));
  }
  assert.match(build, /\["pyqt-ui-designer", "pyqt-ui-designer"\]/);
  assert.match(build, /join\(siteRoot, "pyqt-ui-designer", "index\.html"\)/);
  assert.match(headers, /\/pyqt-ui-designer\/assets\/\*/);
  assert.match(sitemap, /https:\/\/modusignal\.cn\/pyqt-ui-designer\//);
});

test("PyQt UI Designer guide documents usage and protocols in both languages", async () => {
  const guideUrl = new URL("../pyqt-ui-designer/guide/index.html", import.meta.url);
  const guideScriptUrl = new URL("../pyqt-ui-designer/guide/guide.js", import.meta.url);
  const [html, script, build, sitemap] = await Promise.all([
    readFile(guideUrl, "utf8"),
    readFile(guideScriptUrl, "utf8"),
    readFile(buildUrl, "utf8"),
    readFile(sitemapUrl, "utf8"),
  ]);

  const sectionIds = ["quickstart", "serial", "network", "receive", "send", "modbus", "export", "faq"];
  for (const id of sectionIds) {
    assert.match(html, new RegExp(`<section id="${id}" class="guide-section">`));
    assert.match(html, new RegExp(`<a href="#${id}">`));
  }
  assert.equal((html.match(/<div data-lang="zh">/g) || []).length, sectionIds.length);
  assert.equal((html.match(/<div data-lang="en" hidden>/g) || []).length, sectionIds.length);

  // Example frames must match what the app's Modbus encoder sends.
  assert.match(html, /01 03 00 00 00 03 05 CB/);
  assert.match(html, /01 05 00 00 FF 00 8C 3A/);
  assert.match(html, /01 05 00 00 00 00 CD CA/);
  assert.match(html, /01 06 00 0A 01 F4 A9 DF/);
  assert.match(html, /01 03 06 03 E8 09 C4 00 64 02 DB/);
  assert.doesNotMatch(html, /A8 1B/);
  // Modbus TCP request and response for the same read, as the MBAP encoder builds them.
  assert.match(html, /00 01 00 00 00 06 01 03 00 00 00 03/);
  assert.match(html, /00 01 00 00 00 09 01 03 06 03 E8 09 C4 00 64/);

  assert.match(html, /href="\.\.\/styles\.css\?v=20261031\.1"/);
  assert.match(html, /src="\.\/guide\.js\?v=20261020\.1"/);
  assert.match(html, /href="\.\.\/\.\.\/pages\/shared\/editorial\.css\?v=__ASSET_VERSION__"/);

  const copyKeys = new Set([...script.matchAll(/^\s{2}(\w+): \{ zh: /gm)].map((match) => match[1]));
  for (const [, key] of html.matchAll(/data-copy="(\w+)"/g)) {
    assert.ok(copyKeys.has(key), `missing copy for ${key}`);
  }
  assert.match(script, /pyqt-ui-designer-language/);
  assert.match(html, /data-copy="fluentHmiNote"/);
  assert.match(html, /href="\.\.\/\.\.\/fluenthmi-studio\/"/);

  assert.match(build, /join\(siteRoot, "pyqt-ui-designer", "guide", "index\.html"\)/);
  assert.match(sitemap, /https:\/\/modusignal\.cn\/pyqt-ui-designer\/guide\//);
});
