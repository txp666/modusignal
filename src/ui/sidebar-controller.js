import i18n from "../i18n.js";

const STORAGE_KEY = "modusignal.sidebarPanels.v1";
const MOBILE_LAYOUT_QUERY = "(max-width: 1050px)";

export function createSidebarController({ root = document } = {}) {
  const mediaQuery = window.matchMedia(MOBILE_LAYOUT_QUERY);

  function getPanels() {
    return [...root.querySelectorAll(".sidebar-panel[data-sidebar-panel]")].flatMap((panel) => {
      const panelId = panel.dataset.sidebarPanel;
      const toggle = panel.querySelector(".sidebar-collapse-toggle");
      return toggle && panelId ? [{ panel, panelId, toggle }] : [];
    });
  }

  function loadState() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  }

  function persistState() {
    const state = {};
    getPanels().forEach(({ panel, panelId }) => {
      state[panelId] = panel.classList.contains("collapsed");
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function setCollapsed(panel, toggle, collapsed) {
    panel.classList.toggle("collapsed", collapsed);
    toggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
    toggle.title = collapsed ? i18n("panel.expand") : i18n("panel.collapse");
    toggle.textContent = collapsed ? "▸" : "▾";

    const label = panel.querySelector("h2")?.textContent?.trim() || i18n("panel.default");
    const action = collapsed ? i18n("panel.expand") : i18n("panel.collapse");
    toggle.setAttribute("aria-label", `${action}${label}`);
  }

  function applyLayout({ persistOnDesktop = false } = {}) {
    const saved = loadState();
    const mobile = mediaQuery.matches;
    getPanels().forEach(({ panel, panelId, toggle }) => {
      setCollapsed(panel, toggle, mobile || saved[panelId] === true);
    });
    if (persistOnDesktop && !mobile) {
      persistState();
    }
  }

  function bind() {
    applyLayout();
    getPanels().forEach(({ panel, toggle }) => {
      toggle.addEventListener("click", () => {
        setCollapsed(panel, toggle, !panel.classList.contains("collapsed"));
        if (!mediaQuery.matches) {
          persistState();
        }
      });
    });
    mediaQuery.addEventListener("change", () => applyLayout());
  }

  return { applyLayout, bind };
}
