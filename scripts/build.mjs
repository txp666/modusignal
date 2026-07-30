import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import * as esbuild from "esbuild";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  HARTLINK_RELEASE_SOURCE_URL,
  parseHartLinkReleaseManifest,
} from "../hartlink-studio/release.js";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const siteRoot = join(projectRoot, "_site");
const distDir = join(siteRoot, "dist");

function resolveVersion() {
  if (process.env.ASSET_VERSION?.trim()) {
    return process.env.ASSET_VERSION.trim();
  }

  try {
    return execSync("git rev-parse --short HEAD", { cwd: projectRoot, stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return "dev";
  }
}

function replaceAssetVersion(content, version) {
  return content.replaceAll("__ASSET_VERSION__", version);
}

function patchHtmlAssetUrls(content, version) {
  return content.replace(
    /((?:src|href)=["'])(\.[^"']+\.(?:css|gif|html|ico|jpeg|jpg|js|png|svg|webp))(?:\?v=[^"']*)?(["'])/g,
    `$1$2?v=${version}$3`,
  );
}

function patchRelativeModuleSpecifier(content, version) {
  return content
    .replace(/(from\s+)(["'])(\.[^"']+\.js)(?:\?v=[^"']*)?\2/g, `$1$2$3?v=${version}$2`)
    .replace(/(import\s*\(\s*)(["'])(\.[^"']+\.js)(?:\?v=[^"']*)?\2/g, `$1$2$3?v=${version}$2`);
}

function walkFilesWithExtensions(dir, extensions) {
  if (!existsSync(dir)) {
    return [];
  }

  const files = [];

  for (const name of readdirSync(dir)) {
    const filePath = join(dir, name);
    const stats = statSync(filePath);

    if (stats.isDirectory()) {
      files.push(...walkFilesWithExtensions(filePath, extensions));
      continue;
    }

    if (extensions.some((extension) => name.endsWith(extension))) {
      files.push(filePath);
    }
  }

  return files;
}

function injectStaticAssetVersion(version) {
  const pagesRoot = join(siteRoot, "pages");

  for (const filePath of walkFilesWithExtensions(pagesRoot, [".html"])) {
    const content = readFileSync(filePath, "utf8");
    writeFileSync(filePath, patchHtmlAssetUrls(replaceAssetVersion(content, version), version));
  }

  for (const filePath of walkFilesWithExtensions(pagesRoot, [".js"])) {
    const content = readFileSync(filePath, "utf8");
    writeFileSync(filePath, patchRelativeModuleSpecifier(replaceAssetVersion(content, version), version));
  }
}

function copyStaticAssets() {
  const copies = [
    ["pages", "pages"],
    ["hartlink-studio", "hartlink-studio"],
    ["fluent-serial-assistant", "fluent-serial-assistant"],
    [
      "images",
      "images",
      {
        // The large README demo is not referenced by the deployed site.
        filter: (source) => source !== join(projectRoot, "images", "show.gif"),
      },
    ],
    ["robots.txt", "robots.txt"],
    ["sitemap.xml", "sitemap.xml"],
    ["logo.ico", "logo.ico"],
    ["LICENSE.txt", "LICENSE.txt"],
    ["CNAME", "CNAME"],
    ["_headers", "_headers"],
  ];

  for (const [source, target, options = {}] of copies) {
    const sourcePath = join(projectRoot, source);
    const targetPath = join(siteRoot, target);

    if (!existsSync(sourcePath)) {
      continue;
    }

    cpSync(sourcePath, targetPath, { recursive: true, ...options });
  }

  writeFileSync(join(siteRoot, ".nojekyll"), "");
}

async function syncHartLinkReleaseManifest() {
  const sourceUrl = process.env.HARTLINK_RELEASE_MANIFEST_URL?.trim() || HARTLINK_RELEASE_SOURCE_URL;
  const response = await fetch(sourceUrl, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`Unable to sync HARTLink Studio release manifest (${response.status})`);
  }

  const manifest = await response.json();
  const release = parseHartLinkReleaseManifest(manifest);
  writeFileSync(
    join(siteRoot, "hartlink-studio", "latest-release.js"),
    `export default ${JSON.stringify(manifest, null, 2)};\n`,
  );
  console.log(`Synced HARTLink Studio ${release.version} release manifest`);
}

function createProductionIndex(version) {
  const source = readFileSync(join(projectRoot, "index.html"), "utf8");
  const html = source
    .replace(
      /<script type="module" src="\.\/src\/app\.js\?v=__ASSET_VERSION__"><\/script>/,
      `<script type="module" src="./dist/app.js?v=${version}"></script>`,
    )
    .replace(
      /<link rel="stylesheet" href="\.\/src\/styles\.css\?v=__ASSET_VERSION__" \/>/,
      `<link rel="stylesheet" href="./dist/styles.css?v=${version}" />`,
    );

  writeFileSync(join(siteRoot, "index.html"), replaceAssetVersion(html, version));
}

function injectContentSecurityPolicyHashes() {
  const htmlFiles = [
    join(siteRoot, "index.html"),
    join(siteRoot, "hartlink-studio", "index.html"),
    join(siteRoot, "fluent-serial-assistant", "index.html"),
  ];
  const hashes = [];

  for (const filePath of htmlFiles) {
    const html = readFileSync(filePath, "utf8");
    for (const match of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)) {
      if (!match[1].trim()) continue;
      hashes.push(`'sha256-${createHash("sha256").update(match[1]).digest("base64")}'`);
    }
  }

  const headersPath = join(siteRoot, "_headers");
  const headers = readFileSync(headersPath, "utf8");
  if (!headers.includes("__INLINE_SCRIPT_HASHES__")) {
    throw new Error("_headers is missing the CSP hash placeholder");
  }
  writeFileSync(headersPath, headers.replace("__INLINE_SCRIPT_HASHES__", hashes.join(" ")));
}

function createAssetVersionPlugin(version) {
  return {
    name: "asset-version",
    setup(build) {
      build.onLoad({ filter: /version\.js$/ }, () => ({
        contents: `export const ASSET_VERSION = "${version}";\n`,
        loader: "js",
      }));
    },
  };
}

async function bundleApp(version) {
  await esbuild.build({
    entryPoints: {
      app: join(projectRoot, "src/app.js"),
      styles: join(projectRoot, "src/styles.css"),
    },
    outdir: distDir,
    bundle: true,
    splitting: true,
    format: "esm",
    platform: "browser",
    target: ["es2020", "chrome90", "edge90", "firefox90", "safari14"],
    minify: true,
    legalComments: "none",
    entryNames: "[name]",
    chunkNames: "chunks/[name]-[hash]",
    assetNames: "assets/[name]-[hash]",
    plugins: [createAssetVersionPlugin(version)],
    logLevel: "info",
  });
}

function formatBytes(bytes) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function walkFiles(dir) {
  const files = [];

  for (const name of readdirSync(dir)) {
    const filePath = join(dir, name);
    const stats = statSync(filePath);

    if (stats.isDirectory()) {
      files.push(...walkFiles(filePath));
      continue;
    }

    files.push(filePath);
  }

  return files;
}

function printBuildSummary() {
  const files = walkFiles(distDir)
    .map((filePath) => ({
      path: filePath.slice(distDir.length + 1),
      size: statSync(filePath).size,
    }))
    .sort((left, right) => right.size - left.size);

  console.log("Build output:");
  for (const file of files) {
    console.log(`  ${file.path}  ${formatBytes(file.size)}`);
  }
}

async function main() {
  const version = resolveVersion();

  rmSync(siteRoot, { recursive: true, force: true });
  mkdirSync(distDir, { recursive: true });

  await bundleApp(version);
  copyStaticAssets();
  await syncHartLinkReleaseManifest();
  injectStaticAssetVersion(version);
  createProductionIndex(version);
  injectContentSecurityPolicyHashes();
  printBuildSummary();

  console.log(`Site built at ${siteRoot} (version ${version})`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
