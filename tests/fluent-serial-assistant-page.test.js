import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pageUrl = new URL("../fluent-serial-assistant/index.html", import.meta.url);
const scriptUrl = new URL("../fluent-serial-assistant/app.js", import.meta.url);
const homeUrl = new URL("../pages/home.html", import.meta.url);
const buildUrl = new URL("../scripts/build.mjs", import.meta.url);

test("Fluent Serial Assistant page exposes GitHub Release downloads", async () => {
  const [html, script] = await Promise.all([readFile(pageUrl, "utf8"), readFile(scriptUrl, "utf8")]);

  assert.match(html, /Fluent 串口助手/);
  assert.match(html, /"softwareVersion": "0\.1\.11"/);
  assert.match(html, /FluentSerialAssistant-0\.1\.11-windows-x64-setup\.exe/);
  assert.match(html, /FluentSerialAssistant-0\.1\.11-macos-arm64\.dmg/);
  assert.match(html, /FluentSerialAssistant-0\.1\.11-linux-x64\.deb/);
  assert.match(html, /FluentSerialAssistant-0\.1\.11-linux-arm64\.deb/);
  assert.match(html, /Program Files/);
  assert.match(html, /高性能实时绘图/);
  assert.match(html, /README_EN\.md/);
  assert.match(html, /CODE_SIGNING_POLICY\.md/);
  assert.match(html, /github\.com\/txp666\/FluentSerialAssistant\/releases/);
  assert.equal((html.match(/data-asset="/g) || []).length, 4);
  assert.equal((html.match(/<article class="download-card(?: recommended)?" data-platform=/g) || []).length, 3);
  assert.match(html, /data-platform="linux"/);
  assert.doesNotMatch(html, /data-platform="linux-(?:x64|arm64)"/);
  assert.match(html, /styles\.css\?v=20260729\.1/);
  assert.match(html, /app\.js\?v=20260729\.1/);
  assert.match(html, /<span class="hero-title-line">串口调试<\/span>/);
  assert.match(html, /<span class="hero-title-line">现在交给 AI<\/span>/);
  assert.match(html, /id="ai-control"/);
  assert.match(html, /fluentserial-cli ports/);
  assert.match(html, /fluentserial-mcp/);
  assert.match(html, /MCP 提供 12 个工具/);
  assert.match(html, /GUI \+ CLI \+ MCP/);
  assert.doesNotMatch(html, /串口调试，/);
  assert.match(script, /api\.github\.com\/repos\/\$\{REPOSITORY\}\/releases\/latest/);
  assert.match(script, /browser_download_url/);
  assert.match(script, /windows-x64-setup\\\.exe/);
  assert.match(script, /linux-arm64\\\.deb/);
  assert.match(script, /aarch64/);
});

test("modusignal home and production build include Fluent Serial Assistant", async () => {
  const [home, build] = await Promise.all([readFile(homeUrl, "utf8"), readFile(buildUrl, "utf8")]);

  assert.match(home, /href="\.\/fluent-serial-assistant\/"/);
  assert.match(home, /href="\.\/fluent-serial-assistant\/#downloads"/);
  assert.match(home, /Fluent 串口助手/);
  assert.match(home, /v0\.1\.11/);
  assert.match(home, /机器可读 CLI/);
  assert.match(home, /stdio MCP/);
  assert.match(home, />下载最新版<\/a>/);
  assert.doesNotMatch(home, />下载 0\.1\.10<\/a>/);
  assert.match(home, /src="\.\/fluent-serial-assistant\/assets\/show\.gif"/);
  assert.ok(home.lastIndexOf("hartlinkProductDialog") < home.lastIndexOf("fluentSerialCardTitle"));
  assert.ok(home.lastIndexOf("fluentSerialCardTitle") < home.lastIndexOf("architecture-card"));
  assert.match(build, /\["fluent-serial-assistant", "fluent-serial-assistant"\]/);
});
