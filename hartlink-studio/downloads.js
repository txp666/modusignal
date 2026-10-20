const OFFICIAL_ORIGIN = "https://modusignal.cn";
const DOWNLOAD_ORIGIN = "https://download.modusignal.cn";
const SESSION_MS = 30 * 60 * 1000;
const STORAGE_KEY = "modusignal-download-sessions-v1";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// An ID belongs to one file download, never to a person or device.
export function createDownloadLinks({ origin, storage, now = Date.now, randomUUID = () => crypto.randomUUID() }) {
  let sessions = {};
  return (assetUrl) => {
    if (origin !== OFFICIAL_ORIGIN) return assetUrl;
    const url = new URL(assetUrl);
    if (url.origin !== DOWNLOAD_ORIGIN || url.search || url.hash) return assetUrl;
    try {
      const saved = JSON.parse(storage?.getItem(STORAGE_KEY) || "null");
      if (saved && typeof saved === "object" && !Array.isArray(saved)) sessions = saved;
    } catch { /* Downloads also work when browser storage is disabled. */ }
    const timestamp = now();
    sessions = Object.fromEntries(Object.entries(sessions).filter(([, session]) =>
      session && UUID.test(session.id) && session.expires > timestamp && session.expires <= timestamp + SESSION_MS,
    ));
    if (!sessions[url.pathname]) {
      sessions[url.pathname] = { id: randomUUID(), expires: timestamp + SESSION_MS };
    }
    try { storage?.setItem(STORAGE_KEY, JSON.stringify(sessions)); } catch { /* Keep this tab's in-memory ID. */ }
    url.searchParams.set("source", "website");
    url.searchParams.set("download_id", sessions[url.pathname].id);
    return url.toString();
  };
}

export function bindOfficialDownloadLinks(document, location, storage) {
  const downloadUrl = createDownloadLinks({ origin: location.origin, storage });
  // Refresh before native navigation, including keyboard and new-tab downloads.
  const refresh = (event) => {
    const link = event.target.closest?.("a[data-download-url]");
    if (link) link.href = downloadUrl(link.dataset.downloadUrl);
  };
  for (const event of ["pointerdown", "click", "auxclick", "contextmenu", "focusin"]) {
    document.addEventListener(event, refresh);
  }
  return (link, assetUrl) => {
    if (!assetUrl) {
      delete link.dataset.downloadUrl;
      link.href = "#downloads";
      return;
    }
    link.dataset.downloadUrl = assetUrl;
    link.href = downloadUrl(assetUrl);
  };
}
