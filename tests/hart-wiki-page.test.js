import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pageUrl = new URL("../hart-wiki/index.html", import.meta.url);
const scriptUrl = new URL("../hart-wiki/app.js", import.meta.url);
const styleUrl = new URL("../hart-wiki/styles.css", import.meta.url);
const mainPageUrl = new URL("../index.html", import.meta.url);
const hartPageUrl = new URL("../pages/devices/hart.html", import.meta.url);
const buildUrl = new URL("../scripts/build.mjs", import.meta.url);
const sitemapUrl = new URL("../sitemap.xml", import.meta.url);

test("HART Wiki presents a sourced protocol learning path", async () => {
  const [html, script, styles] = await Promise.all([
    readFile(pageUrl, "utf8"),
    readFile(scriptUrl, "utf8"),
    readFile(styleUrl, "utf8"),
  ]);

  assert.match(html, /HART 知识库/);
  assert.match(html, /4–20 mA/);
  assert.match(html, /Bell 202 FSK/);
  assert.match(html, /1200 bit\/s/);
  assert.match(html, /id="frames"/);
  assert.match(html, /id="commands"/);
  assert.match(html, /id="troubleshooting"/);
  assert.match(html, /Cmd 0/);
  assert.match(html, /Cmd 48/);
  assert.match(html, /Cmd 6 \/ 7/);
  assert.match(html, /Cmd 8/);
  assert.match(html, /Cmd 11/);
  assert.match(html, /Cmd 16 \/ 19/);
  assert.match(html, /Cmd 17 \/ 18/);
  assert.match(html, /Cmd 21/);
  assert.match(html, /Cmd 22/);
  assert.match(html, /Cmd 38/);
  assert.match(html, /fieldcommgroup\.org\/hart-specifications/);
  assert.match(html, /HART_ApplicationGuide_r7\.1\.pdf/);
  assert.match(html, /data-wiki-search/);
  assert.match(html, /loop-main-wire/);
  assert.match(html, /loop-modem-wire/);
  assert.match(html, /loop-alt-wire/);
  assert.match(html, /虚线：跨仪表端子/);
  assert.match(html, /请求帧/);
  assert.match(html, /约 9\.167 ms/);
  assert.match(html, /data-checksum-input/);
  assert.match(html, /多点 Multi-drop/);
  assert.match(html, /Cmd 0 返回的不是一个 ID/);
  assert.match(html, /data-status-byte-input/);
  assert.match(html, /More Status Available/);
  assert.match(script, /applySearch/);
  assert.match(script, /updateChecksum/);
  assert.match(script, /updateStatusByte/);
  assert.match(script, /IntersectionObserver/);
  assert.match(styles, /\.loop-svg/);
  assert.match(styles, /@media \(max-width: 700px\)/);
  assert.match(styles, /:root\[data-theme="dark"\]/);
});

test("main navigation and production build include the HART Wiki without changing the debug page", async () => {
  const [mainPage, hartPage, build, sitemap] = await Promise.all([
    readFile(mainPageUrl, "utf8"),
    readFile(hartPageUrl, "utf8"),
    readFile(buildUrl, "utf8"),
    readFile(sitemapUrl, "utf8"),
  ]);

  assert.match(mainPage, /href="\.\/hart-wiki\/"/);
  assert.doesNotMatch(hartPage, /href="\.\/hart-wiki\/"/);
  assert.match(build, /\["hart-wiki", "hart-wiki"\]/);
  assert.match(build, /join\(siteRoot, "hart-wiki", "index\.html"\)/);
  assert.match(sitemap, /https:\/\/modusignal\.cn\/hart-wiki\//);
});
