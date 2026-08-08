import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pageUrl = new URL("../hartlink-studio/index.html", import.meta.url);
const appUrl = new URL("../hartlink-studio/app.js", import.meta.url);
const homeUrl = new URL("../pages/home.html", import.meta.url);
const i18nUrl = new URL("../src/i18n.js", import.meta.url);

test("HARTLink Studio product page resolves the latest release dynamically", async () => {
  const [html, app] = await Promise.all([readFile(pageUrl, "utf8"), readFile(appUrl, "utf8")]);

  assert.match(html, /HARTLink Studio/);
  assert.match(html, /data-release-version/);
  assert.match(html, /data-release-date/);
  assert.equal((html.match(/data-download-asset/g) || []).length, 6);
  assert.match(html, /data-package-type="exe"/);
  assert.doesNotMatch(html, /HARTLinkStudio-\d+\.\d+\.\d+/);
  assert.doesNotMatch(html, /Portable ZIP/);
  assert.match(app, /loadLatestHartLinkRelease/);
  assert.match(app, /formatReleaseAssetSize/);
  assert.match(app, /release\.js\?v=release-module/);
  assert.match(html, /app\.js\?v=release-module/);
  assert.doesNotMatch(app, /0\.3\.6/);
  assert.doesNotMatch(html, /github\.com/i);
  assert.equal((html.match(/data-carousel-slide/g) || []).length, 4);
  assert.match(html, /data-carousel-prev/);
  assert.match(html, /data-carousel-next/);
  assert.match(html, /dd-workspace\.png/);
  assert.doesNotMatch(html, /dd-menu\.png/);
  assert.doesNotMatch(html, /download-footnote|downloadPublished|downloadSource|screensDescription/);
  assert.match(html, /id="pricing"/);
  assert.match(html, /<strong>¥3000<\/strong>/);
  assert.match(html, /<strong>¥10000<\/strong>/);
  assert.match(html, /中文语义推测/);
  assert.match(html, /完整的 DD 菜单与方法实现/);
  assert.equal((html.match(/mailto:771454616@qq\.com/g) || []).length, 1);
  assert.equal((html.match(/771454616@qq\.com/g) || []).length, 2);
  assert.match(html, /data-copy="enterpriseDescription"/);
  assert.doesNotMatch(html, /data-copy="requestTrialCode"|data-copy="contactPurchase"/);
  assert.match(app, /pricingRoadmap: "持续升级中 · 在线 DD 库设计中"/);
});

test("modusignal home links to the independent HARTLink Studio page", async () => {
  const [html, i18n] = await Promise.all([readFile(homeUrl, "utf8"), readFile(i18nUrl, "utf8")]);
  assert.match(html, /href="\.\/hartlink-studio\/"/);
  assert.match(html, /href="\.\/hartlink-studio\/#downloads"/);
  assert.match(html, /src="\.\/hartlink-studio\/assets\/logo\.png"/);
  assert.match(html, /data-hartlink-release-kicker/);
  assert.match(html, /data-hartlink-release-download/);
  assert.doesNotMatch(html, /HARTLink Studio[^\n]*0\.3\.6|下载 0\.3\.6/);
  assert.doesNotMatch(i18n, /home\.hartlinkStudio(?:Kicker|Download)[^\n]*0\.3\.6/);
  assert.doesNotMatch(html, /src="\.\/hartlink-studio\/assets\/workbench\.png"/);
});
