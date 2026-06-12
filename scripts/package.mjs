import { execSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const siteRoot = join(projectRoot, "_site");
const releaseDir = join(projectRoot, "_release");

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

function sanitizeFileName(value) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-");
}

function writeOfflineGuide() {
  const guidePath = join(siteRoot, "OFFLINE.txt");
  writeFileSync(
    guidePath,
    [
      "modusignal offline package",
      "",
      "1. Unzip to any folder.",
      "2. Start a static server in this folder, for example:",
      "   python -m http.server 4173",
      "3. Open http://localhost:4173 in Chrome or Edge.",
      "",
      "Web Serial requires Chrome/Edge and localhost or HTTPS.",
      "",
      "modusignal 离线包",
      "",
      "1. 解压到任意目录。",
      "2. 在本目录启动静态服务，例如：",
      "   python -m http.server 4173",
      "3. 用 Chrome / Edge 打开 http://localhost:4173。",
      "",
      "串口功能需要 Chrome/Edge，且需在 localhost 或 HTTPS 下使用。",
      "",
    ].join("\n"),
    "utf8",
  );

  return guidePath;
}

function createZipArchive(archivePath) {
  rmSync(archivePath, { force: true });
  execSync(`zip -rq "${archivePath}" .`, { cwd: siteRoot, stdio: "inherit" });
}

function createTarArchive(archivePath) {
  rmSync(archivePath, { force: true });
  execSync(`tar -czf "${archivePath}" .`, { cwd: siteRoot, stdio: "inherit" });
}

function main() {
  if (!existsSync(siteRoot)) {
    console.error("Build output not found. Run npm run build first.");
    process.exit(1);
  }

  const version = sanitizeFileName(resolveVersion());
  const baseName = `modusignal-offline-${version}`;
  mkdirSync(releaseDir, { recursive: true });

  const guidePath = writeOfflineGuide();

  let archivePath = join(releaseDir, `${baseName}.zip`);

  try {
    createZipArchive(archivePath);
  } catch (error) {
    console.warn("zip failed, falling back to tar.gz:", error.message);
    archivePath = join(releaseDir, `${baseName}.tar.gz`);
    createTarArchive(archivePath);
  }

  rmSync(guidePath, { force: true });

  console.log(`Offline package created at ${archivePath}`);
}

main();
