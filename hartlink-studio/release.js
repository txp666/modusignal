export const HARTLINK_RELEASE_MODULE_PATH = "/hartlink-studio/latest-release.js";
export const HARTLINK_RELEASE_SOURCE_URL =
  "https://download.modusignal.cn/HARTLinkStudio/ota/latest.json";

const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:[.-][0-9A-Za-z.-]+)?$/;
const ASSET_HOST = "download.modusignal.cn";
const RELEASE_NOTES_PREFIX = "https://modusignal.cn/hartlink-studio/";

function requireString(value, field) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`HARTLink Studio release manifest has an invalid ${field}`);
  }
  return value.trim();
}

export function parseHartLinkReleaseManifest(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("HARTLink Studio release manifest must be an object");
  }
  if (value.schema_version !== 1 || value.product !== "HARTLinkStudio" || value.channel !== "stable") {
    throw new Error("HARTLink Studio release manifest identity does not match");
  }

  const version = requireString(value.version, "version");
  if (!VERSION_PATTERN.test(version)) {
    throw new Error("HARTLink Studio release manifest has an invalid version");
  }

  const publishedAt = requireString(value.published_at, "published_at");
  if (!Number.isFinite(Date.parse(publishedAt))) {
    throw new Error("HARTLink Studio release manifest has an invalid published_at");
  }

  const releaseNotesUrl = requireString(value.release_notes_url, "release_notes_url");
  if (!releaseNotesUrl.startsWith(RELEASE_NOTES_PREFIX)) {
    throw new Error("HARTLink Studio release notes must use modusignal.cn");
  }
  if (!Array.isArray(value.assets) || value.assets.length === 0) {
    throw new Error("HARTLink Studio release manifest has no assets");
  }

  const assets = value.assets.map((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error("HARTLink Studio release manifest has an invalid asset");
    }

    const asset = {
      os: requireString(entry.os, "asset os").toLowerCase(),
      architecture: requireString(entry.architecture, "asset architecture").toLowerCase(),
      packageType: requireString(entry.package_type, "asset package_type").toLowerCase(),
      filename: requireString(entry.filename, "asset filename"),
      size: Number(entry.size),
      sha256: requireString(entry.sha256, "asset sha256").toLowerCase(),
      url: requireString(entry.url, "asset url"),
    };

    const assetUrl = new URL(asset.url);
    if (
      assetUrl.protocol !== "https:" ||
      assetUrl.hostname !== ASSET_HOST ||
      !Number.isSafeInteger(asset.size) ||
      asset.size <= 0 ||
      !/^[0-9a-f]{64}$/.test(asset.sha256) ||
      decodeURIComponent(assetUrl.pathname.split("/").at(-1) || "") !== asset.filename
    ) {
      throw new Error(`HARTLink Studio release manifest has an invalid asset: ${asset.filename}`);
    }

    return asset;
  });

  return {
    version,
    publishedAt,
    releaseNotesUrl,
    assets,
  };
}

export async function loadLatestHartLinkRelease(
  importImplementation = (specifier) => import(specifier),
) {
  if (typeof importImplementation !== "function") {
    throw new Error("Module loading is unavailable");
  }

  const separator = HARTLINK_RELEASE_MODULE_PATH.includes("?") ? "&" : "?";
  const module = await importImplementation(
    `${HARTLINK_RELEASE_MODULE_PATH}${separator}v=${Date.now()}`,
  );
  return parseHartLinkReleaseManifest(module.default);
}

export function findHartLinkReleaseAsset(release, operatingSystem, architecture, packageType) {
  return release?.assets.find(
    (asset) =>
      asset.os === operatingSystem &&
      asset.architecture === architecture &&
      asset.packageType === packageType,
  );
}

export function formatReleaseAssetSize(bytes, language = "zh") {
  const megabytes = bytes / (1024 * 1024);
  return `${new Intl.NumberFormat(language === "en" ? "en-US" : "zh-CN", {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  }).format(megabytes)} MB`;
}

export function formatHartLinkReleaseDate(timestamp, language = "zh") {
  return new Intl.DateTimeFormat(language === "en" ? "en-CA" : "zh-CN", {
    dateStyle: "medium",
    timeZone: "Asia/Shanghai",
  }).format(new Date(timestamp));
}
