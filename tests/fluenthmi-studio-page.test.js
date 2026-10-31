import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pageUrl = new URL("../fluenthmi-studio/index.html", import.meta.url);
const scriptUrl = new URL("../fluenthmi-studio/app.js", import.meta.url);
const homeUrl = new URL("../pages/home.html", import.meta.url);
const i18nUrl = new URL("../src/i18n.js", import.meta.url);
const homeCssUrl = new URL("../src/home.css", import.meta.url);
const buildUrl = new URL("../scripts/build.mjs", import.meta.url);
const headersUrl = new URL("../_headers", import.meta.url);
const sitemapUrl = new URL("../sitemap.xml", import.meta.url);

test("FluentHMI Studio page exposes GitHub Release downloads", async () => {
  const [html, script] = await Promise.all([readFile(pageUrl, "utf8"), readFile(scriptUrl, "utf8")]);

  assert.match(html, /FluentHMI Studio/);
  assert.match(html, /"softwareVersion": "0\.1\.0"/);
  assert.match(html, /FluentHMI-Studio-v0\.1\.0-windows-x64\.zip/);
  assert.match(html, /FluentHMI-Studio-v0\.1\.0-macos-universal\.zip/);
  assert.match(html, /github\.com\/txp666\/FluentHMI-Studio\/releases/);
  assert.equal((html.match(/data-asset="/g) || []).length, 2);
  assert.equal((html.match(/<article class="download-card(?: recommended)?" data-platform=/g) || []).length, 2);
  assert.match(html, /styles\.css\?v=20261031\.1/);
  assert.match(html, /app\.js\?v=20261031\.1/);
  assert.match(html, /id="compare"/);
  assert.match(html, /href="\.\.\/pyqt-ui-designer\/"/);
  // Both apps share one project format, so the Python version's guide covers this one too.
  assert.ok((html.match(/href="\.\.\/pyqt-ui-designer\/guide\/"/g) || []).length >= 3);
  for (const image of ["designer", "preview", "widgets-light", "widgets-dark"]) {
    assert.match(html, new RegExp(`src="\\./assets/${image}\\.jpg"`));
  }

  const copyKeys = new Set([...script.matchAll(/^\s{2}(\w+): \{ zh: /gm)].map((match) => match[1]));
  for (const [, key] of html.matchAll(/data-copy="(\w+)"/g)) {
    assert.ok(copyKeys.has(key), `missing copy for ${key}`);
  }

  assert.match(script, /api\.github\.com\/repos\/\$\{REPOSITORY\}\/releases\/latest/);
  assert.match(script, /txp666\/FluentHMI-Studio/);
  assert.match(script, /browser_download_url/);
  assert.match(script, /windows-x64\\\.zip/);
  assert.match(script, /macos-universal\\\.zip/);
  assert.match(script, /fluenthmi-studio-language/);
  // The primary button follows the visitor's platform before the GitHub request starts.
  assert.match(script, /updatePrimaryDownload\(preferredPlatform\(\)\);\nrefreshLatestRelease\(\);\s*$/);
});

test("modusignal home and production build include FluentHMI Studio", async () => {
  const [home, i18n, homeCss, build, headers, sitemap] = await Promise.all([
    readFile(homeUrl, "utf8"),
    readFile(i18nUrl, "utf8"),
    readFile(homeCssUrl, "utf8"),
    readFile(buildUrl, "utf8"),
    readFile(headersUrl, "utf8"),
    readFile(sitemapUrl, "utf8"),
  ]);

  assert.match(home, /href="\.\/fluenthmi-studio\/"/);
  assert.match(home, /href="\.\/fluenthmi-studio\/#downloads"/);
  assert.match(home, /href="https:\/\/github\.com\/txp666\/FluentHMI-Studio"/);
  assert.match(home, /src="\.\/fluenthmi-studio\/assets\/designer\.jpg"/);
  // The C++ version sits right before the Python version it replaces.
  assert.ok(home.lastIndexOf("fluentSerialCardTitle") < home.lastIndexOf("fluentHmiCardTitle"));
  assert.ok(home.lastIndexOf("fluentHmiCardTitle") < home.lastIndexOf("pyqtDesignerCardTitle"));
  for (const [, key] of home.matchAll(/data-i18n="(home\.fluentHmi\w+)"/g)) {
    assert.match(i18n, new RegExp(`"${key.replace(".", "\\.")}"`));
  }
  // The screenshot keeps its own aspect ratio instead of the hardware photo crop.
  assert.match(homeCss, /\.fluenthmi-card-media, /);
  assert.match(homeCss, /:not\(\.fluenthmi-card-media\)/);
  assert.match(build, /\["fluenthmi-studio", "fluenthmi-studio"\]/);
  assert.match(build, /join\(siteRoot, "fluenthmi-studio"\)/);
  assert.match(build, /join\(siteRoot, "fluenthmi-studio", "index\.html"\)/);
  assert.match(headers, /\/fluenthmi-studio\/assets\/\*/);
  assert.match(sitemap, /https:\/\/modusignal\.cn\/fluenthmi-studio\//);
});
