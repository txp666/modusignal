import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { patchHtmlAssetUrls, patchRelativeModuleSpecifier } from "../../scripts/asset-version.mjs";

const projectRoot = new URL("../../", import.meta.url);
const pageRoot = new URL("pages/devices/microscope-power/", projectRoot);
const read = (url) => readFileSync(url, "utf8");

test("the embedded and standalone entries resolve the complete versioned MicroScope module graph", () => {
  const version = "microscope-sync-test";
  const wrapper = patchHtmlAssetUrls(read(new URL("pages/devices/microscope-power.html", projectRoot)), version);
  const iframe = wrapper.match(/<iframe\b[\s\S]*?<\/iframe>/)?.[0];
  assert.ok(iframe, "the actual registered device page embeds the standalone application");
  assert.match(iframe, /allow="[^"]*\busb\b/);
  const iframeSource = iframe.match(/\bsrc="([^"]+)"/)[1];
  assert.equal(iframeSource, `./pages/devices/microscope-power/index.html?v=${version}`);
  assert.ok(wrapper.includes(`href="${iframeSource}"`), "standalone opening uses the same app as the iframe");

  const entry = new URL(iframeSource, projectRoot);
  entry.search = "";
  const html = patchHtmlAssetUrls(read(entry), version);
  const moduleSource = html.match(/<script\b[^>]*type="module"[^>]*src="([^"]+)"/)?.[1];
  assert.ok(moduleSource);
  assert.match(html, /id="firmwareUpdateValue"/, "the modusignal firmware-update view remains available");
  const pending = [new URL(moduleSource, entry)];
  const visited = new Set();
  while (pending.length) {
    const url = pending.pop();
    assert.equal(url.searchParams.get("v"), version, "every module receives the build cache version");
    url.search = "";
    assert.ok(url.href.startsWith(pageRoot.href), "device modules remain in the copied static app directory");
    if (visited.has(url.href)) continue;
    visited.add(url.href);
    const source = patchRelativeModuleSpecifier(read(url), version);
    assert.doesNotMatch(source, /__ASSET_VERSION__/);
    for (const [, specifier] of source.matchAll(/\bfrom\s+["'](\.[^"']+)["']/g)) {
      pending.push(new URL(specifier, url));
    }
  }
  for (const module of ["app.js", "protocol.js", "plot.js", "commands.js", "statistics.js", "timeline.js"]) {
    assert.ok(visited.has(new URL(module, pageRoot).href), `${module} is reachable from the real page`);
  }
});
