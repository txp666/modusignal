import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import worker from "../workers/cos-download-proxy/src/index.js";
import { parseDownloadAsset, recordDownloadStart } from "../workers/cos-download-proxy/src/download-stats.js";
import { createDownloadLinks } from "../hartlink-studio/downloads.js";

const path = "/HARTLinkStudio/ota/releases/v0.3.21/HARTLinkStudio-0.3.21-windows-x64-setup.exe";
const direct = `https://download.modusignal.cn${path}`;
const id = "11111111-1111-4111-8111-111111111111";
const otherId = "22222222-2222-4222-8222-222222222222";
const tracked = `${direct}?source=website&download_id=${id}`;
const schema = readFileSync(new URL("../workers/cos-download-proxy/migrations/0001_download_stats.sql", import.meta.url), "utf8");

function createDb(t) {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(schema);
  t.after(() => sqlite.close());
  return {
    sqlite,
    prepare(sql) {
      return { bind: (...values) => ({ run: async () => ({ success: true, meta: sqlite.prepare(sql).run(...values) }) }) };
    },
    total: () => sqlite.prepare("SELECT COALESCE(SUM(downloads), 0) AS total FROM website_download_daily").get().total,
  };
}

test("official links share one ID across hero/card/tabs for 30 minutes; mirrors stay untracked", () => {
  let saved, time = 1000, nextId = id;
  const storage = { getItem: () => saved, setItem: (_key, value) => { saved = value; } };
  const options = { origin: "https://modusignal.cn", storage, now: () => time, randomUUID: () => nextId };
  const url = createDownloadLinks(options);
  assert.equal(url(direct), tracked);
  assert.equal(createDownloadLinks(options)(direct), tracked);
  nextId = otherId;
  time += 30 * 60 * 1000;
  assert.equal(new URL(url(direct)).searchParams.get("download_id"), otherId);
  for (const origin of ["null", "http://127.0.0.1:4174", "https://example.com", "https://modusignal.cn.evil.test"]) {
    assert.equal(createDownloadLinks({ ...options, origin })(direct), direct);
  }
  const blockedStorage = { getItem() { throw new Error(); }, setItem() { throw new Error(); } };
  const privateUrl = createDownloadLinks({ ...options, storage: blockedStorage });
  assert.equal(privateUrl(direct), privateUrl(direct));
});

test("only installers whose filenames match their product/version qualify", () => {
  assert.deepEqual(parseDownloadAsset(path), { product: "HARTLinkStudio", version: "0.3.21", os: "windows", architecture: "x64", packageType: "exe" });
  for (const suffix of ["macos-arm64.dmg", "linux-x64.deb", "linux-x64.tar.gz"]) {
    assert.ok(parseDownloadAsset(path.replace("windows-x64-setup.exe", suffix)));
  }
  for (const invalid of [`${path}.sha256`, path.replace("v0.3.21/", "v0.3.20/"), "/HARTLinkStudio/ota/latest.json"]) {
    assert.equal(parseDownloadAsset(invalid), null);
  }
});

test("real SQLite trigger counts parallel ranges and uncertain retries once, using Shanghai dates", async (t) => {
  const db = createDb(t);
  const instant = Date.parse("2026-10-20T16:01:00Z");
  await Promise.all(Array.from({ length: 16 }, () => recordDownloadStart(db, path, id, instant)));
  await recordDownloadStart(db, path, id, instant + 86400000);
  assert.equal(db.total(), 1);
  assert.equal(db.sqlite.prepare("SELECT day FROM website_download_daily").get().day, "2026-10-21");
  await recordDownloadStart(db, path, otherId, instant);
  await recordDownloadStart(db, path.replace("windows-x64-setup.exe", "linux-x64.deb"), otherId, instant);
  assert.equal(db.total(), 3);
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) AS total FROM website_downloads").get().total, 3);
});

function setupWorker(t) {
  const db = createDb(t), puts = [], pending = [], cacheReads = [], originReads = [];
  let cacheHit = null, originStatus = 200;
  t.mock.method(globalThis, "fetch", async (url, options) => {
    originReads.push({ url, options });
    return new Response(options.method === "HEAD" || originStatus === 304 ? null : "file bytes", {
      status: originStatus,
      headers: { "Content-Length": "10", "Content-Type": "application/octet-stream", "Accept-Ranges": "bytes" },
    });
  });
  const previous = Object.getOwnPropertyDescriptor(globalThis, "caches");
  Object.defineProperty(globalThis, "caches", { configurable: true, value: { default: {
    match: async (request) => { cacheReads.push(request); return cacheHit?.clone(); },
    put: async (request, response) => { puts.push({ request, response }); },
  } } });
  t.after(() => { if (previous) Object.defineProperty(globalThis, "caches", previous); else delete globalThis.caches; });
  const env = { COS_BUCKET: "test", COS_REGION: "test", COS_SECRET_ID: "test", COS_SECRET_KEY: "test", DOWNLOAD_STATS: db };
  const send = (url = tracked, options = {}) => worker.fetch(new Request(url, options), env, { waitUntil: (promise) => pending.push(promise) });
  return { db, env, send, puts, pending, cacheReads, originReads,
    cache: (response) => { cacheHit = response; }, status: (value) => { originStatus = value; } };
}

test("origin and cached ranges count once without fragmenting the file cache or COS signature", async (t) => {
  const fixture = setupWorker(t);
  let response = await fixture.send();
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "file bytes");
  assert.equal(fixture.db.total(), 1);
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  await Promise.all(fixture.pending);
  assert.equal(fixture.puts[0].request.url, direct);
  assert.match(fixture.puts[0].response.headers.get("Cache-Control"), /immutable/);
  assert.equal(new URL(fixture.originReads[0].url).search, "");
  fixture.cache(new Response("range", { status: 206, headers: { "Content-Range": "bytes 0-4/10", "Content-Length": "5" } }));
  response = await fixture.send(tracked, { headers: { Range: "bytes=0-4" } });
  assert.equal(response.status, 206);
  assert.equal(response.headers.get("Content-Range"), "bytes 0-4/10");
  assert.equal(fixture.cacheReads.at(-1).url, direct);
  assert.equal(fixture.db.total(), 1);
  await fixture.send(tracked.replace(id, otherId), { headers: { Range: "bytes=0-4" } });
  assert.equal(fixture.db.total(), 2);
  assert.equal(fixture.originReads.length, 1);
});

test("plain OTA, HEAD, errors, manifests, checksums, prefetches and foreign referrers do not count", async (t) => {
  const f = setupWorker(t);
  await f.send(direct);
  await f.send(tracked, { method: "HEAD" });
  for (const status of [304, 403, 404, 416, 500]) { f.status(status); await f.send(); }
  f.status(200);
  for (const headers of [{ Purpose: "prefetch" }, { "Sec-Purpose": "prefetch;prerender" }, { Referer: "https://fork.example/hartlink-studio/" }]) {
    await f.send(tracked, { headers });
  }
  for (const invalid of [`${tracked}&extra=1`, `${direct}?v=1`, tracked.replace(path, "/HARTLinkStudio/ota/latest.json"), tracked.replace(".exe?", ".exe.sha256?")]) {
    assert.equal((await f.send(invalid)).status, 404);
  }
  assert.equal(f.db.total(), 0);
});

test("D1 write acknowledgement loss retries idempotently; database failure keeps download available and logs a recovery event", async (t) => {
  const f = setupWorker(t);
  const realPrepare = f.db.prepare.bind(f.db);
  let calls = 0;
  f.db.prepare = (sql) => ({ bind: (...values) => ({ run: async () => {
    const result = await realPrepare(sql).bind(...values).run();
    if (++calls === 1) throw new Error("Lost acknowledgement");
    return result;
  } }) });
  assert.equal((await f.send()).status, 200);
  assert.equal(f.db.total(), 1);
  assert.equal(calls, 2);
  const errors = [];
  t.mock.method(console, "error", (message) => errors.push(JSON.parse(message)));
  delete f.env.DOWNLOAD_STATS;
  const response = await f.send(tracked.replace(id, otherId));
  assert.equal(await response.text(), "file bytes");
  assert.equal(errors[0].event, "download_count_failed");
  assert.equal(errors[0].download_id, otherId);
});
