import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pageUrl = new URL("../hartlink-studio/index.html", import.meta.url);
const appUrl = new URL("../hartlink-studio/app.js", import.meta.url);
const homeUrl = new URL("../pages/home.html", import.meta.url);
const i18nUrl = new URL("../src/i18n.js", import.meta.url);
const buildUrl = new URL("../scripts/build.mjs", import.meta.url);
const snapshotImageUrl = new URL("../hartlink-studio/assets/configuration-snapshot.png", import.meta.url);
const cloneImageUrl = new URL("../hartlink-studio/assets/configuration-clone.png", import.meta.url);

test("HARTLink Studio product page resolves the latest release dynamically", async () => {
  const [html, app] = await Promise.all([readFile(pageUrl, "utf8"), readFile(appUrl, "utf8")]);

  assert.match(html, /HARTLink Studio/);
  assert.match(html, /data-release-version/);
  assert.match(html, /data-release-date/);
  assert.equal((html.match(/data-download-asset/g) || []).length, 4);
  assert.match(html, /data-package-type="exe"/);
  assert.doesNotMatch(html, /HARTLinkStudio-\d+\.\d+\.\d+/);
  assert.doesNotMatch(html, /Portable ZIP/);
  assert.match(app, /loadLatestHartLinkRelease/);
  assert.match(app, /formatReleaseAssetSize/);
  assert.match(app, /release\.js\?v=__ASSET_VERSION__/);
  assert.match(html, /app\.js\?v=__ASSET_VERSION__/);
  assert.doesNotMatch(app, /0\.3\.6/);
  assert.doesNotMatch(html, /github\.com/i);
  assert.equal((html.match(/data-carousel-slide/g) || []).length, 6);
  assert.match(html, /data-carousel-prev/);
  assert.match(html, /data-carousel-next/);
  assert.match(html, /dd-workspace\.png/);
  assert.match(html, /configuration-snapshot\.png/);
  assert.match(html, /configuration-clone\.png/);
  assert.match(html, /配置快照与历史比较/);
  assert.match(html, /比较历史并管理受管记录/);
  assert.match(html, /受控配置克隆/);
  assert.match(app, /screenSnapshotTitle/);
  assert.match(app, /screenCloneTitle/);
  assert.match(app, /compare history, and manage stored records/);
  assert.doesNotMatch(html, /data-os="linux" data-architecture="arm64"/);
  assert.doesNotMatch(html, /x64 \/ ARM64/);
  assert.doesNotMatch(`${html}\n${app}`, /release-module|1\.0\.2|1\.0\.3/);
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

test("HARTLink Studio product screenshots are de-identified PNG assets", async () => {
  const [snapshot, clone] = await Promise.all([readFile(snapshotImageUrl), readFile(cloneImageUrl)]);
  const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.deepEqual(snapshot.subarray(0, 8), pngSignature);
  assert.deepEqual(clone.subarray(0, 8), pngSignature);
  assert.deepEqual([snapshot.readUInt32BE(16), snapshot.readUInt32BE(20)], [1040, 720]);
  assert.deepEqual([clone.readUInt32BE(16), clone.readUInt32BE(20)], [1000, 740]);
  assert.equal(
    createHash("sha256").update(snapshot).digest("hex"),
    "7923f94d89dc7587c54a772fb0590822d5d291c3cc1e08b2ffffa480e5643331",
  );
  assert.equal(
    createHash("sha256").update(clone).digest("hex"),
    "fce4c93de8ebe60f0b9f32afdba11bc7d31a3c4789b975ad044366a03c29e469",
  );
});

test("production build versions HARTLink Studio assets before syncing the release snapshot", async () => {
  const build = await readFile(buildUrl, "utf8");
  assert.match(build, /join\(siteRoot, "hartlink-studio"\)/);
  assert.ok(build.lastIndexOf("injectStaticAssetVersion(version)") < build.lastIndexOf("syncHartLinkReleaseManifest()"));
});

test("modusignal home links to the independent HARTLink Studio page", async () => {
  const [html, i18n] = await Promise.all([readFile(homeUrl, "utf8"), readFile(i18nUrl, "utf8")]);
  assert.match(html, /href="\.\/hartlink-studio\/"/);
  assert.match(html, /href="\.\/hartlink-studio\/#downloads"/);
  assert.match(html, /src="\.\/hartlink-studio\/assets\/logo\.png"/);
  assert.match(html, /data-hartlink-release-kicker/);
  assert.match(html, /data-hartlink-release-download/);
  assert.match(html, /data-i18n="home\.hartlinkStudioConfig"/);
  assert.match(i18n, /"home\.hartlinkStudioConfig"/);
  assert.doesNotMatch(html, /HARTLink Studio[^\n]*0\.3\.6|下载 0\.3\.6/);
  assert.doesNotMatch(i18n, /home\.hartlinkStudio(?:Kicker|Download)[^\n]*0\.3\.6/);
  assert.doesNotMatch(html, /src="\.\/hartlink-studio\/assets\/workbench\.png"/);
});
