import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pageUrl = new URL("../hartlink-studio/index.html", import.meta.url);
const homeUrl = new URL("../pages/home.html", import.meta.url);

test("HARTLink Studio product page exposes the current release downloads", async () => {
  const html = await readFile(pageUrl, "utf8");

  assert.match(html, /HARTLink Studio/);
  assert.match(html, /HARTLinkStudio-0\.3\.6-windows-x64\.zip/);
  assert.match(html, /HARTLinkStudio-0\.3\.6-macos-arm64\.dmg/);
  assert.match(html, /HARTLinkStudio-0\.3\.6-linux-x64\.deb/);
  assert.match(html, /HARTLinkStudio-0\.3\.6-linux-arm64\.deb/);
  assert.match(html, /hartlinkstudio-ota-ap-1257631357\.cos\.ap-hongkong\.myqcloud\.com/);
  assert.doesNotMatch(html, /github\.com/i);
  assert.equal((html.match(/data-carousel-slide/g) || []).length, 4);
  assert.match(html, /data-carousel-prev/);
  assert.match(html, /data-carousel-next/);
  assert.match(html, /dd-workspace\.png/);
  assert.doesNotMatch(html, /dd-menu\.png/);
  assert.doesNotMatch(html, /download-footnote|downloadPublished|downloadSource|screensDescription/);
});

test("modusignal home links to the independent HARTLink Studio page", async () => {
  const html = await readFile(homeUrl, "utf8");
  assert.match(html, /href="\.\/hartlink-studio\/"/);
  assert.match(html, /href="\.\/hartlink-studio\/#downloads"/);
  assert.match(html, /src="\.\/hartlink-studio\/assets\/logo\.png"/);
  assert.doesNotMatch(html, /src="\.\/hartlink-studio\/assets\/workbench\.png"/);
});
