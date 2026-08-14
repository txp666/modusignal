import assert from "node:assert/strict";
import test from "node:test";

import {
  patchHtmlAssetUrls,
  patchRelativeModuleSpecifier,
  replaceAssetVersion,
  validateAssetVersion,
} from "../scripts/asset-version.mjs";

test("asset versions accept release tags and commit ids but reject unsafe input", () => {
  for (const value of ["v0.3.17", "44f78db", "build_2026-08-14"]) {
    assert.equal(validateAssetVersion(value), value);
  }

  for (const value of ["", "bad value", "bad$", "bad?", "bad&", "bad#", "../bad", "a".repeat(65)]) {
    assert.throws(() => validateAssetVersion(value));
  }
});

test("HTML asset versioning covers normal and lightbox URLs without touching external links", () => {
  const source = [
    '<link href="./styles.css?v=old" />',
    '<img src="./assets/screen.png?v=__ASSET_VERSION__" />',
    '<button data-lightbox-src="./assets/screen.png?v=__ASSET_VERSION__"></button>',
    '<a href="#downloads">Download</a>',
    '<a href="mailto:test@example.com">Mail</a>',
    '<a href="https://example.com/app.js">External</a>',
  ].join("\n");

  const expected = patchHtmlAssetUrls(source, "test-build-123");
  assert.match(expected, /href="\.\/styles\.css\?v=test-build-123"/);
  assert.equal((expected.match(/screen\.png\?v=test-build-123/g) || []).length, 2);
  assert.match(expected, /href="#downloads"/);
  assert.match(expected, /href="mailto:test@example\.com"/);
  assert.match(expected, /href="https:\/\/example\.com\/app\.js"/);
  assert.equal(patchHtmlAssetUrls(expected, "test-build-123"), expected);
});

test("module versioning covers static and dynamic relative imports idempotently", () => {
  const source = [
    'import value from "./value.js?v=old";',
    'const lazy = import("../lazy.js?v=__ASSET_VERSION__");',
    'const external = import("https://example.com/external.js");',
  ].join("\n");
  const expected = patchRelativeModuleSpecifier(source, "test-build-123");
  assert.match(expected, /\.\/value\.js\?v=test-build-123/);
  assert.match(expected, /\.\.\/lazy\.js\?v=test-build-123/);
  assert.match(expected, /https:\/\/example\.com\/external\.js/);
  assert.equal(patchRelativeModuleSpecifier(expected, "test-build-123"), expected);
});

test("sentinel replacement validates the requested version", () => {
  assert.equal(replaceAssetVersion("asset?v=__ASSET_VERSION__", "abc_123"), "asset?v=abc_123");
  assert.throws(() => replaceAssetVersion("asset?v=__ASSET_VERSION__", "bad/version"));
});
