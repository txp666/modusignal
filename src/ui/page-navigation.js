// Keep the existing #device links while giving every page a browser-history entry.
export function createPageNavigation({ browser = window, pageIds, onNavigate }) {
  const pages = new Set(["home", "request", ...pageIds]);
  let currentPage = null;
  let lastUrl = null;

  function readPage() {
    const hash = browser.location.hash.slice(1);
    if (pages.has(hash)) return hash;
    // Home section links remain ordinary anchors, including when traversing back.
    return "home";
  }

  function render(pageId, source) {
    if (currentPage === pageId) return;
    currentPage = pageId;
    onNavigate(pageId, { source });
  }

  function restore() {
    // A fragment traversal may fire both popstate and hashchange.
    if (lastUrl === browser.location.href) return;
    lastUrl = browser.location.href;
    render(readPage(), "history");
  }

  function start() {
    lastUrl = browser.location.href;
    render(readPage(), "initial");
    browser.addEventListener("popstate", restore);
    browser.addEventListener("hashchange", restore);
  }

  function navigate(pageId) {
    const nextPage = pages.has(pageId) ? pageId : "home";
    if (currentPage === nextPage) return;
    const url = new URL(browser.location.href);
    url.hash = nextPage;
    browser.history.pushState(null, "", url.href);
    lastUrl = browser.location.href;
    render(nextPage, "navigation");
  }

  function destroy() {
    browser.removeEventListener("popstate", restore);
    browser.removeEventListener("hashchange", restore);
  }

  return { start, navigate, destroy };
}
