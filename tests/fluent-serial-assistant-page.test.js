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
  assert.match(html, /FluentSerialAssistant-v0\.1\.9-windows-x64\.zip/);
  assert.match(html, /FluentSerialAssistant-v0\.1\.9-macos\.tar\.gz/);
  assert.match(html, /FluentSerialAssistant-v0\.1\.9-linux-x64\.tar\.gz/);
  assert.match(html, /github\.com\/txp666\/FluentSerialAssistant\/releases/);
  assert.equal((html.match(/data-asset="/g) || []).length, 3);
  assert.match(script, /api\.github\.com\/repos\/\$\{REPOSITORY\}\/releases\/latest/);
  assert.match(script, /browser_download_url/);
});

test("modusignal home and production build include Fluent Serial Assistant", async () => {
  const [home, build] = await Promise.all([readFile(homeUrl, "utf8"), readFile(buildUrl, "utf8")]);

  assert.match(home, /href="\.\/fluent-serial-assistant\/"/);
  assert.match(home, /href="\.\/fluent-serial-assistant\/#downloads"/);
  assert.match(home, /Fluent 串口助手/);
  assert.match(home, /src="\.\/fluent-serial-assistant\/assets\/show\.gif"/);
  assert.ok(home.lastIndexOf("hartlinkProductDialog") < home.lastIndexOf("fluentSerialCardTitle"));
  assert.ok(home.lastIndexOf("fluentSerialCardTitle") < home.lastIndexOf("architecture-card"));
  assert.match(build, /\["fluent-serial-assistant", "fluent-serial-assistant"\]/);
});
