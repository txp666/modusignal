import { execSync } from "node:child_process";
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

function copyStaticAssets() {
  const copies = [
    ["pages", "pages"],
    ["images", "images"],
    ["robots.txt", "robots.txt"],
    ["sitemap.xml", "sitemap.xml"],
    ["logo.ico", "logo.ico"],
    ["LICENSE.txt", "LICENSE.txt"],
    ["CNAME", "CNAME"],
  ];

  for (const [source, target] of copies) {
    const sourcePath = join(projectRoot, source);
    const targetPath = join(siteRoot, target);

    if (!existsSync(sourcePath)) {
      continue;
    }

    cpSync(sourcePath, targetPath, { recursive: true });
  }

  writeFileSync(join(siteRoot, ".nojekyll"), "");
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
  createProductionIndex(version);
  printBuildSummary();

  console.log(`Site built at ${siteRoot} (version ${version})`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
