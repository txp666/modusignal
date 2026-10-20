const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseDownloadAsset(pathname) {
  const match = pathname.match(/^\/(HARTLinkStudio|HARTForgeStudio)\/ota\/releases\/v(\d+\.\d+\.\d+)\/([^/]+)$/);
  if (!match) return null;
  const [, product, version, filename] = match;
  const prefix = `${product}-${version}-`;
  if (!filename.startsWith(prefix)) return null;
  const platform = filename.slice(prefix.length).match(/^(windows)-(x64)-setup\.(exe)$|^(macos)-(arm64|x64)\.(dmg)$|^(linux)-(x64|arm64)\.(deb|tar\.gz)$/);
  if (!platform) return null;
  const [os, architecture, packageType] = platform.slice(1).filter(Boolean);
  return { product, version, os, architecture, packageType };
}

export function parseDownloadTracking(url) {
  if (!url.search) return { valid: true, id: null };
  const keys = [...url.searchParams.keys()];
  const id = url.searchParams.get("download_id");
  if (keys.length !== 2 || !keys.includes("source") || !keys.includes("download_id")
      || url.searchParams.get("source") !== "website" || !UUID.test(id || "") || !parseDownloadAsset(url.pathname)) {
    return { valid: false, id: null };
  }
  return { valid: true, id: id.toLowerCase() };
}

export function shouldCountDownload(request, response) {
  if (request.method !== "GET" || ![200, 206].includes(response.status) || !response.body) return false;
  if (response.headers.get("Content-Length") === "0") return false;
  if (/prefetch|prerender/i.test(`${request.headers.get("Purpose") || ""} ${request.headers.get("Sec-Purpose") || ""}`)) return false;
  if (request.cf?.botManagement?.verifiedBot) return false;
  const referrer = request.headers.get("Referer");
  if (referrer) {
    try { if (new URL(referrer).origin !== "https://modusignal.cn") return false; } catch { return false; }
  }
  return true;
}

export async function recordDownloadStart(db, pathname, id, timestamp = Date.now()) {
  const asset = parseDownloadAsset(pathname);
  if (!asset) throw new Error("Invalid installer path");
  // Shanghai calendar day. A single insert + SQL trigger is atomic, including concurrent ranges.
  const day = new Date(timestamp + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return db.prepare(`INSERT INTO website_downloads
    (download_id, asset_path, product, version, os, architecture, package_type, started_at, day)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(download_id, asset_path) DO NOTHING`)
    .bind(id, pathname, asset.product, asset.version, asset.os, asset.architecture, asset.packageType,
      new Date(timestamp).toISOString(), day).run();
}

export async function trackDownloadResponse(request, response, env, tracking, pathname) {
  if (!tracking.id) return response;
  if (shouldCountDownload(request, response)) {
    let recorded = false;
    // A retry is safe even if the first write succeeded but its acknowledgement was lost.
    for (let attempt = 0; attempt < 2 && !recorded; attempt += 1) {
      try {
        if (!env.DOWNLOAD_STATS) throw new Error("DOWNLOAD_STATS binding is missing");
        const result = await recordDownloadStart(env.DOWNLOAD_STATS, pathname, tracking.id);
        if (result.success === false) throw new Error("D1 write failed");
        recorded = true;
      } catch { /* Preserve file availability and emit a reconcilable event below. */ }
    }
    if (!recorded) console.error(JSON.stringify({
      event: "download_count_failed", download_id: tracking.id, asset_path: pathname,
      started_at: new Date().toISOString(), status: response.status,
    }));
  }
  // Store file bytes under the canonical URL only. A new download must reach the Worker,
  // even when this browser already has a previous download in its disk cache.
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "private, no-store");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
