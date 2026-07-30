import assert from "node:assert/strict";
import test from "node:test";

import {
  findHartLinkReleaseAsset,
  formatReleaseAssetSize,
  loadLatestHartLinkRelease,
  parseHartLinkReleaseManifest,
} from "../hartlink-studio/release.js";

const manifest = {
  schema_version: 1,
  product: "HARTLinkStudio",
  channel: "stable",
  version: "9.8.7",
  published_at: "2026-07-27T10:30:38Z",
  release_notes_url: "https://modusignal.cn/hartlink-studio/",
  assets: [
    {
      os: "windows",
      architecture: "x64",
      package_type: "exe",
      filename: "HARTLinkStudio-9.8.7-windows-x64-setup.exe",
      size: 20_408_351,
      sha256: "354cdcf73bd51130dcd593e92ac46eb9e176f64ad51545af8e6f12dbbbc78eac",
      url: "https://download.modusignal.cn/HARTLinkStudio/ota/releases/v9.8.7/HARTLinkStudio-9.8.7-windows-x64-setup.exe",
    },
  ],
};

test("release manifest parser exposes validated current assets", () => {
  const release = parseHartLinkReleaseManifest(manifest);
  const asset = findHartLinkReleaseAsset(release, "windows", "x64", "exe");

  assert.equal(release.version, "9.8.7");
  assert.equal(asset.filename, "HARTLinkStudio-9.8.7-windows-x64-setup.exe");
  assert.equal(asset.packageType, "exe");
  assert.match(formatReleaseAssetSize(asset.size), /MB$/);
});

test("release manifest parser rejects non-modusignal release notes", () => {
  assert.throws(
    () => parseHartLinkReleaseManifest({ ...manifest, release_notes_url: "https://github.com/example/release" }),
    /modusignal\.cn/,
  );
});

test("release manifest parser rejects direct COS download URLs", () => {
  const directCosManifest = structuredClone(manifest);
  directCosManifest.assets[0].url =
    "https://hartlinkstudio-ota-ap-1257631357.cos.ap-hongkong.myqcloud.com/HARTLinkStudio/ota/releases/v9.8.7/HARTLinkStudio-9.8.7-windows-x64-setup.exe";

  assert.throws(() => parseHartLinkReleaseManifest(directCosManifest), /invalid asset/);
});

test("latest release loader imports the same-origin release module", async () => {
  let requestedSpecifier = "";
  const release = await loadLatestHartLinkRelease(async (specifier) => {
    requestedSpecifier = specifier;
    return { default: manifest };
  });

  assert.equal(release.version, "9.8.7");
  assert.match(requestedSpecifier, /^\/hartlink-studio\/latest-release\.js\?v=\d+$/);
});
