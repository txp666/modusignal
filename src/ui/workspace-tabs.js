// Reuse the actual form nodes: changing a pane must not reset unsaved values.
export function initWorkspaceTabs(root = document) {
  root.querySelectorAll("[data-compact-tabs]").forEach((group) => {
    const panes = [...group.children].filter((node) => node.matches("section, article"));
    if (panes.length < 2) return;
    const nav = document.createElement("div");
    nav.className = "workspace-pane-tabs";
    nav.setAttribute("role", "tablist");
    nav.setAttribute("aria-label", group.dataset.compactTabs);
    const tabs = panes.map((pane, index) => {
      const heading = pane.querySelector("h2, h4");
      const tab = document.createElement("button");
      tab.type = "button";
      tab.id = `${group.id}-tab-${index}`;
      tab.setAttribute("role", "tab");
      tab.textContent = heading?.textContent || String(index + 1);
      if (heading?.dataset.i18n) tab.dataset.i18n = heading.dataset.i18n;
      pane.id ||= `${group.id}-pane-${index}`;
      pane.setAttribute("role", "tabpanel");
      pane.setAttribute("aria-labelledby", tab.id);
      tab.setAttribute("aria-controls", pane.id);
      nav.append(tab);
      return tab;
    });
    function select(index, focus = false) {
      tabs.forEach((tab, i) => {
        tab.setAttribute("aria-selected", String(i === index));
        tab.tabIndex = i === index ? 0 : -1;
        panes[i].hidden = i !== index;
      });
      if (focus) tabs[index].focus();
    }
    tabs.forEach((tab, index) => {
      tab.addEventListener("click", () => select(index));
      tab.addEventListener("keydown", (event) => {
        const next = { ArrowRight: (index + 1) % tabs.length, ArrowLeft: (index + tabs.length - 1) % tabs.length, Home: 0, End: tabs.length - 1 }[event.key];
        if (next === undefined) return;
        event.preventDefault();
        select(next, true);
      });
    });
    group.prepend(nav);
    group.classList.add("has-workspace-tabs");
    select(0);
  });
}
