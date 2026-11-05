import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";

const homeUrl = new URL("../pages/home.html", import.meta.url);
const i18nUrl = new URL("../src/i18n.js", import.meta.url);

test("the desktop software section links each app to its own site", async () => {
  const [home, i18n] = await Promise.all([readFile(homeUrl, "utf8"), readFile(i18nUrl, "utf8")]);
  const start = home.indexOf("data-software-showcase");
  const section = home.slice(start, home.indexOf("</section>", home.indexOf('class="sw-board"', start)));
  for (const site of ["hart", "serial", "hmi", "pagebridge"]) {
    assert.match(section, new RegExp(`href="https://${site}\\.modusignal\\.cn/"`), site);
  }
  // the component library has its own site, but no card here
  assert.doesNotMatch(section, /fluentqt/i);
  for (const [, src] of section.matchAll(/(?:src|poster)="\.\/([^"]+)"/g)) {
    assert.ok(existsSync(new URL(`../${src}`, import.meta.url)), src);
  }
  for (const [, key] of section.matchAll(/data-i18n(?:-aria-label)?="([^"]+)"/g)) {
    assert.match(i18n, new RegExp(`"${key.replace(/\./g, "\\.")}"`), key);
  }
});

test("the HARTLink Studio card shows the latest release", async () => {
  const home = await readFile(homeUrl, "utf8");
  assert.match(home, /data-hartlink-release-kicker/);
  assert.match(home, /data-hartlink-release-download/);
});
