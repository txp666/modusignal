export const ASSET_VERSION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

export function validateAssetVersion(value) {
  const version = String(value ?? "").trim();
  if (!ASSET_VERSION_PATTERN.test(version)) {
    throw new Error("ASSET_VERSION must use 1-64 letters, digits, dots, underscores, or hyphens");
  }
  return version;
}

export function replaceAssetVersion(content, version) {
  return content.replaceAll("__ASSET_VERSION__", validateAssetVersion(version));
}

export function patchHtmlAssetUrls(content, version) {
  const safeVersion = validateAssetVersion(version);
  return replaceAssetVersion(content, safeVersion).replace(
    /((?:src|href)=["'])(\.[^"']+\.(?:css|gif|html|ico|jpeg|jpg|js|png|svg|webp))(?:\?v=[^"']*)?(["'])/g,
    `$1$2?v=${safeVersion}$3`,
  );
}

export function patchRelativeModuleSpecifier(content, version) {
  const safeVersion = validateAssetVersion(version);
  return replaceAssetVersion(content, safeVersion)
    .replace(/(from\s+)(["'])(\.[^"']+\.js)(?:\?v=[^"']*)?\2/g, `$1$2$3?v=${safeVersion}$2`)
    .replace(/(import\s*\(\s*)(["'])(\.[^"']+\.js)(?:\?v=[^"']*)?\2/g, `$1$2$3?v=${safeVersion}$2`);
}
