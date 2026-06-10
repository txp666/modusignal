import { execSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const targetRoot = process.argv.includes("--root")
  ? join(projectRoot, process.argv[process.argv.indexOf("--root") + 1] ?? ".")
  : projectRoot;

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

function patchImportLines(content, version) {
  return content
    .split("\n")
    .map((line) => {
      if (!/^\s*(import|export)\s+/.test(line)) {
        return line;
      }

      return line.replace(/(from\s+)(["'])(\.[^"']+\.js)(?:\?v=[^"']*)?\2/, `$1$2$3?v=${version}$2`);
    })
    .join("\n");
}

function walkJsFiles(dir) {
  const files = [];

  for (const name of readdirSync(dir)) {
    const filePath = join(dir, name);
    const stats = statSync(filePath);

    if (stats.isDirectory()) {
      files.push(...walkJsFiles(filePath));
      continue;
    }

    if (name.endsWith(".js")) {
      files.push(filePath);
    }
  }

  return files;
}

function replaceAssetVersion(content, version) {
  return content.replaceAll("__ASSET_VERSION__", version);
}

function injectIntoTree(root, version) {
  const indexPath = join(root, "index.html");
  if (existsSync(indexPath)) {
    writeFileSync(indexPath, replaceAssetVersion(readFileSync(indexPath, "utf8"), version));
  }

  const versionPath = join(root, "src", "version.js");
  if (existsSync(versionPath)) {
    writeFileSync(versionPath, `export const ASSET_VERSION = "${version}";\n`);
  }

  const srcDir = join(root, "src");
  if (!existsSync(srcDir)) {
    return;
  }

  for (const filePath of walkJsFiles(srcDir)) {
    if (filePath === versionPath) {
      continue;
    }

    const content = readFileSync(filePath, "utf8");
    writeFileSync(filePath, patchImportLines(replaceAssetVersion(content, version), version));
  }
}

const version = resolveVersion();
injectIntoTree(targetRoot, version);
console.log(`Asset version injected into ${targetRoot}: ${version}`);
