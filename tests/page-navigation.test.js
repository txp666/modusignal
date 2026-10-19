import test from "node:test";
import assert from "node:assert/strict";
import { createPageNavigation } from "../src/ui/page-navigation.js";

function fixture(hash = "") {
  const entries = [new URL(`https://example.test/workbench/?v=123${hash}`)];
  const events = new Map();
  const rendered = [];
  let index = 0;
  let writes = 0;
  const browser = {
    get location() { return entries[index]; },
    history: {
      pushState(_state, _title, url) {
        entries.splice(++index, Infinity, new URL(url));
        writes += 1;
      },
    },
    addEventListener(name, listener) { events.set(name, listener); },
    removeEventListener(name) { events.delete(name); },
  };
  const navigation = createPageNavigation({
    browser,
    pageIds: ["aomaster", "modbus", "hart", "mqtt", "websocket", "custom", "microscope-power"],
    onNavigate: (page, context) => rendered.push({ page, ...context }),
  });
  navigation.start();
  return {
    navigation, browser, rendered,
    get writes() { return writes; },
    get count() { return entries.length; },
    back() { index -= 1; events.get("popstate")?.(); events.get("hashchange")?.(); },
    forward() { index += 1; events.get("popstate")?.(); events.get("hashchange")?.(); },
    anchor(hash) {
      const url = new URL(browser.location.href);
      url.hash = hash;
      entries.splice(++index, Infinity, url);
      events.get("hashchange")?.();
    },
  };
}

test("page visits create traversable history without pushing again on back/forward", () => {
  const app = fixture();
  app.navigation.navigate("modbus");
  app.navigation.navigate("hart");
  app.navigation.navigate("request");
  app.back(); app.back(); app.back();
  app.forward(); app.forward(); app.forward();
  assert.deepEqual(app.rendered.map(({ page }) => page), [
    "home", "modbus", "hart", "request", "hart", "modbus", "home", "modbus", "hart", "request",
  ]);
  assert.equal(app.writes, 3);
  assert.equal(app.count, 4);
  assert.equal(app.browser.location.search, "?v=123");
  assert.equal(app.browser.location.pathname, "/workbench/");
});

test("same-page clicks do not add duplicate entries or reinitialize the device", () => {
  const app = fixture("#modbus");
  app.navigation.navigate("modbus");
  app.navigation.navigate("modbus");
  assert.equal(app.writes, 0);
  assert.deepEqual(app.rendered, [{ page: "modbus", source: "initial" }]);
});

test("every device deep link and the request page initialize without extra history", () => {
  for (const page of ["aomaster", "modbus", "hart", "mqtt", "websocket", "custom", "microscope-power", "request"]) {
    const app = fixture(`#${page}`);
    assert.deepEqual(app.rendered, [{ page, source: "initial" }]);
    assert.equal(app.count, 1);
    assert.equal(app.writes, 0);
  }
});

test("home section anchors return to home when traversing from a device", () => {
  const app = fixture();
  app.anchor("home-tools");
  app.navigation.navigate("modbus");
  app.back();
  assert.equal(app.browser.location.hash, "#home-tools");
  assert.deepEqual(app.rendered.map(({ page }) => page), ["home", "modbus", "home"]);
  app.back();
  assert.equal(app.browser.location.hash, "");
  assert.equal(app.rendered.length, 3);
  app.forward(); app.forward();
  assert.equal(app.rendered.at(-1).page, "modbus");
});

test("manual fragment changes are handled once and invalid routes fall back to home", () => {
  const app = fixture("#hart");
  app.anchor("mqtt");
  assert.equal(app.rendered.at(-1).page, "mqtt");
  app.anchor("missing-device");
  assert.equal(app.rendered.at(-1).page, "home");
  assert.equal(app.writes, 0);
});

test("a new visit after going back replaces the forward branch", () => {
  const app = fixture();
  app.navigation.navigate("modbus");
  app.navigation.navigate("hart");
  app.back();
  app.navigation.navigate("mqtt");
  assert.equal(app.count, 3);
  app.back(); app.forward();
  assert.equal(app.rendered.at(-1).page, "mqtt");
});

test("destroy detaches history listeners", () => {
  const app = fixture();
  app.navigation.navigate("modbus");
  app.navigation.destroy();
  app.back();
  assert.equal(app.rendered.at(-1).page, "modbus");
});
