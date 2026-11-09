// The custom device page: a .uidp canvas. Design mode edits the project (palette, canvas with
// selection, drag, resize, grid snapping, clipboard and undo, property panel); run mode shows the
// controls live, connected through the link cards on the canvas. The current project is kept in
// localStorage. The page is standalone: no shared transport, log or sidebar.

import i18n from "../../i18n.js";
import {
  CONTAINER_TYPES, PALETTE, createEmptyProject, linkCards, createExampleProject, createWidget, findWidget,
  geometryOf, isShown, isSupported, nextWidgetId, parseProject, serializeProject, walkAllWidgets, walkWidgets, widgetMeta,
} from "../../hmi/uidp.js";
import { FREE_LAYOUT, childTab, clampTabIndex, currentTab, layoutMode, relayout, tabNames } from "../../hmi/layout.js";
import { createCanvasRuntime } from "./canvas-runtime.js";
import { noticeText, projectErrorText, statusText, statusTip } from "./canvas-messages.js";
import { fitTextarea, renderPropertyPanel, widgetName } from "./property-panel.js";
import { createWidgetView } from "./widget-views.js";
import { WIDGET_ICONS } from "./widget-icons.js";

export const CANVAS_STORAGE_KEY = "modusignal.customCanvas.v1";
const PANELS_STORAGE_KEY = "modusignal.customCanvas.panels.v1";
const GRID_STORAGE_KEY = "modusignal.customCanvas.grid.v1";
const ZOOM_STEP = 1.15;
const UNDO_LIMIT = 50;
const COALESCE_MS = 1200;
const DESIGN_MIN_WIDTH = 900;
const HANDLES = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
const DRAG_TYPE = "application/x-modusignal-widget";

const clone = (value) => JSON.parse(JSON.stringify(value));

function loadStoredProject() {
  try {
    const text = localStorage.getItem(CANVAS_STORAGE_KEY);
    if (text) return parseProject(text);
  } catch {
    // An unreadable stored project starts afresh.
  }
  return createEmptyProject();
}

function isTyping(target) {
  return Boolean(target?.closest?.("input, textarea, select, [contenteditable='true']"));
}

/**
 * options: root (the page section), appShell. While the page shows, the app's sidebar is hidden,
 * its footer too, and the canvas toolbar sits in the site header row.
 */
export function createCanvasPage(options) {
  const { root, appShell } = options;
  const $ = (id) => root.querySelector(`#${id}`);
  const dom = {
    designButton: $("hmiModeDesign"),
    runButton: $("hmiModeRun"),
    newButton: $("hmiNew"),
    openButton: $("hmiOpen"),
    saveButton: $("hmiSave"),
    undoButton: $("hmiUndo"),
    redoButton: $("hmiRedo"),
    exampleButton: $("hmiExample"),
    fitButton: $("hmiZoomFit"),
    zoomButton: $("hmiZoom100"),
    zoomInButton: $("hmiZoomIn"),
    zoomOutButton: $("hmiZoomOut"),
    alignButton: $("hmiAlign"),
    gridButton: $("hmiGrid"),
    file: $("hmiFile"),
    status: $("hmiStatus"),
    narrowNote: $("hmiNarrowNote"),
    workspace: $("hmiWorkspace"),
    palette: $("hmiPalette"),
    viewport: $("hmiViewport"),
    stage: $("hmiStage"),
    canvas: $("hmiCanvas"),
    properties: $("hmiProperties"),
    toast: $("hmiToast"),
    sidebarButton: $("hmiSidebar"),
    paletteToggle: $("hmiTogglePalette"),
    propsToggle: $("hmiToggleProps"),
    paletteClose: $("hmiPaletteClose"),
    propsClose: $("hmiPropsClose"),
    noLinkHint: $("hmiNoLinkHint"),
  };

  let project = loadStoredProject();
  let mode = "design";
  let zoom = "fit";
  // The grid shows or hides; snapping follows the grid size either way, as in the designers.
  let showGrid = (() => {
    try {
      return localStorage.getItem(GRID_STORAGE_KEY) !== "0";
    } catch {
      return true;
    }
  })();
  let scale = 1;
  let selection = new Set();
  let undoStack = [];
  let redoStack = [];
  let lastCoalesce = null;
  let clipboard = [];
  let clipboardParent = null;
  let views = new Map();
  let runtime = null;
  let runStatus = null;
  // The page each TabWidget shows while running (switching tabs there changes no file).
  let runTabs = new Map();
  let active = false;
  let saveTimer = null;
  let toastTimer = null;
  const panels = loadPanels();
  // The toolbar moves into the site header while the page shows, and back when it leaves.
  const toolbar = root.querySelector(".hmi-toolbar");
  const toolbarHome = toolbar.parentElement;
  const narrowQuery = window.matchMedia(`(max-width: ${DESIGN_MIN_WIDTH - 0.02}px)`);

  // -- side panels: the palette and the property panel show or hide on their own -----------

  function loadPanels() {
    try {
      const saved = JSON.parse(localStorage.getItem(PANELS_STORAGE_KEY) ?? "{}");
      return { palette: saved.palette !== false, props: saved.props !== false };
    } catch {
      return { palette: true, props: true };
    }
  }

  function setPanel(name, open) {
    panels[name] = open;
    try {
      localStorage.setItem(PANELS_STORAGE_KEY, JSON.stringify(panels));
    } catch {
      // Not remembered; the page keeps working.
    }
    updateToolbar();
    applyScale();
    // A field fitted while the panel was hidden gets its height now.
    if (name === "props" && open) dom.properties.querySelectorAll("textarea").forEach(fitTextarea);
  }

  // -- persistence and history --------------------------------------------------------------

  function persist() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        localStorage.setItem(CANVAS_STORAGE_KEY, serializeProject(project));
      } catch {
        // Storage may be full or blocked; the page keeps working.
      }
    }, 250);
  }

  function pushUndo(coalesce) {
    const now = Date.now();
    if (coalesce && lastCoalesce && lastCoalesce.key === coalesce && now - lastCoalesce.at < COALESCE_MS) {
      lastCoalesce.at = now;
      return;
    }
    undoStack.push(serializeProject(project));
    if (undoStack.length > UNDO_LIMIT) undoStack.shift();
    redoStack = [];
    lastCoalesce = coalesce ? { key: coalesce, at: now } : null;
  }

  /** Every edit: undo snapshot, apply, redraw, save. */
  function change(mutate, { panel = false, coalesce } = {}) {
    const before = serializeProject(project);
    const result = mutate(project);
    const after = serializeProject(project);
    if (result === false || before === after) return;
    const now = Date.now();
    if (!(coalesce && lastCoalesce && lastCoalesce.key === coalesce && now - lastCoalesce.at < COALESCE_MS)) {
      undoStack.push(before);
      if (undoStack.length > UNDO_LIMIT) undoStack.shift();
    }
    lastCoalesce = coalesce ? { key: coalesce, at: now } : null;
    redoStack = [];
    pruneSelection();
    renderCanvas();
    if (panel) renderPanel();
    updateToolbar();
    persist();
  }

  function restore(text) {
    project = JSON.parse(text);
    pruneSelection();
    lastCoalesce = null;
    renderAll();
    persist();
  }

  function undo() {
    if (!undoStack.length) return;
    redoStack.push(serializeProject(project));
    restore(undoStack.pop());
  }

  function redo() {
    if (!redoStack.length) return;
    undoStack.push(serializeProject(project));
    restore(redoStack.pop());
  }

  function replaceProject(next) {
    pushUndo();
    project = next;
    selection = new Set();
    lastCoalesce = null;
    restartRuntime();
    renderAll();
    persist();
  }

  // -- selection ----------------------------------------------------------------------------

  function pruneSelection() {
    const ids = new Set([...walkWidgets(project.widgets)].map((entry) => entry.widget.id));
    selection = new Set([...selection].filter((id) => ids.has(id)));
  }

  function selectedWidgets() {
    return [...selection].map((id) => findWidget(project, id)?.widget).filter(Boolean);
  }

  function select(ids, { add = false } = {}) {
    if (!add) selection = new Set();
    for (const id of ids) {
      if (add && selection.has(id)) selection.delete(id);
      else selection.add(id);
    }
    syncSelection();
    renderPanel();
    updateToolbar();
  }

  /** The absolute canvas position of a widget: its geometry plus its containers'. */
  function absolutePosition(id) {
    const chain = [];
    let entry = findWidget(project, id);
    while (entry) {
      chain.push(entry.widget);
      entry = entry.parent ? findWidget(project, entry.parent.id) : null;
    }
    return chain.reduce((sum, widget) => {
      const g = geometryOf(widget);
      return { x: sum.x + g.x, y: sum.y + g.y };
    }, { x: 0, y: 0 });
  }

  // -- rendering ----------------------------------------------------------------------------

  function canvasSize() {
    const canvas = project.canvas && typeof project.canvas === "object" ? project.canvas : {};
    return { width: canvas.width ?? 1200, height: canvas.height ?? 800, grid: Math.max(1, canvas.gridSize ?? 10) };
  }

  /** "Fit" fills the viewport, enlarging as well as shrinking; design mode can also show 100 %. */
  function computeScale() {
    if (mode === "design" && zoom !== "fit") return zoom;
    const { width, height } = canvasSize();
    const style = getComputedStyle(dom.viewport);
    const padX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight) + 2;
    const padY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom) + 2;
    const availableWidth = Math.max(120, dom.viewport.clientWidth - padX);
    const availableHeight = dom.viewport.clientHeight - padY;
    const byWidth = availableWidth / width;
    // A viewport without a height of its own (stacked on a phone) fits the width only.
    const fit = availableHeight > 120 ? Math.min(byWidth, availableHeight / height) : byWidth;
    return Math.max(0.1, fit);
  }

  function applyScale() {
    const { width, height, grid } = canvasSize();
    scale = computeScale();
    Object.assign(dom.canvas.style, { width: `${width}px`, height: `${height}px`, transform: `scale(${scale})` });
    Object.assign(dom.stage.style, { width: `${width * scale}px`, height: `${height * scale}px` });
    dom.canvas.style.setProperty("--hmi-grid", `${grid}px`);
    dom.canvas.style.setProperty("--hmi-scale", String(scale));
  }

  function destroyViews() {
    for (const view of views.values()) view.destroy();
    views = new Map();
  }

  function renderCanvas() {
    destroyViews();
    dom.canvas.replaceChildren();
    dom.viewport.classList.toggle("hmi-design", mode === "design");
    dom.viewport.classList.toggle("hmi-run", mode === "run");
    const ctx = {
      mode, project, runtime, send: (widget, event) => runtime?.send(widget, event), pollText: () => statusText(runStatus),
      pageOf, selectTab,
    };
    const build = (list, host, parent = null, offsetY = 0) => {
      if (!Array.isArray(list)) return;
      for (const widget of list) {
        if (!widget || typeof widget !== "object") continue;
        const view = createWidgetView(widget, { ...ctx, offsetY });
        if (widget.id) views.set(widget.id, view);
        if (parent?.type === "TabWidget") {
          view.el.dataset.tabPage = String(childTab(parent, widget));
          view.el.hidden = childTab(parent, widget) !== pageOf(parent);
        }
        host.append(view.el);
        if (isSupported(widget) && CONTAINER_TYPES.has(widget.type)) build(widget.children, view.body, widget, view.childOffsetY ?? 0);
      }
    };
    build(project.widgets, dom.canvas);
    applyScale();
    syncSelection();
    if (mode === "run") requestAnimationFrame(() => views.forEach((view) => view.resize()));
  }

  function syncSelection() {
    dom.canvas.querySelectorAll(".hmi-handle").forEach((handle) => handle.remove());
    for (const [id, view] of views) {
      const selected = mode === "design" && selection.has(id);
      view.el.classList.toggle("selected", selected);
      view.el.setAttribute("aria-selected", String(selected));
    }
    if (mode !== "design" || selection.size !== 1) return;
    const view = views.get([...selection][0]);
    if (!view) return;
    for (const handle of HANDLES) {
      const node = document.createElement("span");
      node.className = `hmi-handle hmi-handle-${handle}`;
      node.dataset.handle = handle;
      view.el.append(node);
    }
  }

  function renderPanel() {
    if (mode !== "design") return;
    renderPropertyPanel(dom.properties, {
      project,
      selected: selectedWidgets(),
      // An edit lays the containers around the edited widget out again, as the designer does.
      change: (mutate, options) => change((p) => {
        const result = mutate(p);
        if (result !== false) for (const widget of selectedWidgets()) relayoutAround(widget);
        return result;
      }, options),
      renameWidget,
      removeSelected,
      copySelection: () => {
        copySelection();
        renderPanel();
      },
      paste,
      canPaste: () => clipboard.length > 0,
    });
  }

  function renderPalette() {
    dom.palette.replaceChildren();
    for (const group of PALETTE) {
      const section = document.createElement("section");
      const heading = document.createElement("h3");
      heading.textContent = i18n(`hmi.group.${group.id}`);
      section.append(heading);
      const list = document.createElement("div");
      list.className = "hmi-palette-list";
      for (const type of group.types) {
        const item = document.createElement("button");
        item.type = "button";
        item.className = "hmi-palette-item";
        item.draggable = true;
        item.dataset.type = type;
        item.title = `${widgetName(type)} (${type}) · ${i18n("hmi.palette.hint")}`;
        const icon = document.createElement("span");
        icon.className = "hmi-palette-icon";
        icon.setAttribute("aria-hidden", "true");
        icon.innerHTML = WIDGET_ICONS[type] ?? "";
        const name = document.createElement("span");
        name.textContent = widgetName(type);
        item.append(icon, name);
        item.addEventListener("dragstart", (event) => {
          event.dataTransfer.setData(DRAG_TYPE, type);
          event.dataTransfer.effectAllowed = "copy";
        });
        item.addEventListener("click", () => addWidgetAtCenter(type));
        list.append(item);
      }
      section.append(list);
      dom.palette.append(section);
    }
  }

  function updateToolbar() {
    const narrow = narrowQuery.matches;
    dom.designButton.setAttribute("aria-pressed", String(mode === "design"));
    dom.runButton.setAttribute("aria-pressed", String(mode === "run"));
    dom.designButton.disabled = narrow;
    dom.narrowNote.hidden = !narrow;
    for (const node of [root, toolbar]) {
      node.classList.toggle("hmi-mode-run", mode === "run");
      node.classList.toggle("hmi-mode-design", mode === "design");
    }
    dom.undoButton.disabled = !undoStack.length;
    dom.redoButton.disabled = !redoStack.length;
    dom.fitButton.setAttribute("aria-pressed", String(zoom === "fit"));
    dom.zoomButton.setAttribute("aria-pressed", String(zoom === 1));
    dom.gridButton.setAttribute("aria-pressed", String(showGrid));
    dom.viewport.classList.toggle("hmi-no-grid", !showGrid);
    dom.alignButton.disabled = alignable().length < 2;
    root.classList.toggle("hmi-no-palette", !panels.palette);
    root.classList.toggle("hmi-no-props", !panels.props);
    dom.paletteToggle.setAttribute("aria-pressed", String(panels.palette));
    dom.propsToggle.setAttribute("aria-pressed", String(panels.props));
    dom.noLinkHint.hidden = !(mode === "run" && !linkCards(project).length);
    dom.sidebarButton.setAttribute("aria-pressed", String(!appShell?.classList.contains("hmi-sidebar-hidden")));
    updateStatus();
  }

  function updateStatus() {
    if (mode === "run") {
      dom.status.textContent = statusText(runStatus);
      dom.status.title = statusTip(runStatus);
      return;
    }
    const count = [...walkAllWidgets(project.widgets)].length;
    dom.status.textContent = i18n("hmi.status.design").replace("{name}", project.appName ?? "").replace("{count}", String(count));
    dom.status.title = "";
  }

  function renderAll() {
    renderCanvas();
    renderPanel();
    updateToolbar();
  }

  // -- run mode -----------------------------------------------------------------------------

  /** Ends the run: polling stops and every link card disconnects. */
  function stopRuntime() {
    void runtime?.stop();
    runtime = null;
    runStatus = null;
  }

  /** In run mode, a runtime whose links the cards connect; the canvas is drawn after it. */
  function startRuntime() {
    stopRuntime();
    runTabs = new Map();
    if (mode !== "run" || !active) return;
    runtime = createCanvasRuntime({
      project,
      // A binding on a hidden tab page is not polled.
      isShown: (widget) => isShown(project, widget, pageOf),
      onValue: (id, value) => views.get(id)?.setValue(value),
      onCurvePoint: (id, index, number) => views.get(id)?.addPoint?.(index, number),
      onStatus: (status) => {
        runStatus = status;
        updateStatus();
        views.forEach((view) => view.refresh?.());
      },
      notify,
    });
    runtime.start();
  }

  function restartRuntime() {
    if (mode === "run" && active) {
      startRuntime();
      renderCanvas();
    }
  }

  function setMode(next) {
    closeMenu();
    const target = narrowQuery.matches ? "run" : next;
    if (target === mode) return;
    mode = target;
    selection = new Set();
    startRuntime();
    renderAll();
  }

  function notify(level, code, args = []) {
    const text = noticeText(code, args);
    dom.toast.textContent = text;
    dom.toast.dataset.level = level;
    dom.toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      dom.toast.hidden = true;
    }, 2600);
  }

  // -- editing ------------------------------------------------------------------------------

  function renameWidget(widget, id) {
    if (!id) return i18n("hmi.err.idEmpty");
    if (id === widget.id) return null;
    for (const other of walkAllWidgets(project.widgets)) {
      if (other !== widget && other.id === id) return i18n("hmi.err.idTaken").replace("{id}", id);
    }
    const wasSelected = selection.has(widget.id);
    change(() => {
      widget.id = id;
    }, { panel: true });
    if (wasSelected) {
      selection = new Set([id]);
      syncSelection();
      renderPanel();
    }
    return null;
  }

  function snap(value) {
    const { grid } = canvasSize();
    return Math.round(value / grid) * grid;
  }

  /** The container (supported GroupBox / CardContainer) under an absolute canvas point, skipping `exclude` and its children. */
  function containerAt(x, y, exclude = null) {
    let found = null;
    for (const { widget } of walkWidgets(project.widgets)) {
      if (!isSupported(widget) || !CONTAINER_TYPES.has(widget.type) || widget === exclude) continue;
      if (!isShown(project, widget, pageOf)) continue;
      if (exclude && isInside(widget, exclude)) continue;
      const position = absolutePosition(widget.id);
      const g = geometryOf(widget);
      if (x >= position.x && y >= position.y && x < position.x + g.w && y < position.y + g.h) found = widget;
    }
    return found;
  }

  function isInside(widget, ancestor) {
    let entry = findWidget(project, widget.id);
    while (entry?.parent) {
      if (entry.parent === ancestor) return true;
      entry = findWidget(project, entry.parent.id);
    }
    return false;
  }

  function listOf(parent) {
    if (!parent) return project.widgets;
    parent.children ??= [];
    return parent.children;
  }

  /** Puts a widget into a container (null: the top level) and lays the container out. */
  function adopt(container, widget) {
    if (container?.type === "TabWidget") {
      const page = currentTab(container);
      if (page) widget.tabIndex = page;
      else delete widget.tabIndex;
    } else {
      delete widget.tabIndex;
    }
    listOf(container).push(widget);
    if (container) relayout(container);
  }

  /** Lays out the containers around a widget: itself (when it is one) and its parent. */
  function relayoutAround(widget) {
    const entry = [...walkWidgets(project.widgets)].find((item) => item.widget === widget);
    if (!entry) return;
    if (CONTAINER_TYPES.has(widget.type)) relayout(widget);
    if (entry.parent) relayout(entry.parent);
  }

  function addWidget(type, x, y) {
    const container = containerAt(x, y);
    const origin = container ? absolutePosition(container.id) : { x: 0, y: 0 };
    const widget = createWidget(project, type, snap(x - origin.x), snap(y - origin.y));
    change(() => {
      if (!Array.isArray(project.widgets)) project.widgets = [];
      adopt(container, widget);
    }, { panel: true });
    select([widget.id]);
  }

  /** The page a TabWidget shows: its currentTab in design mode, the clicked one while running. */
  function pageOf(tabs) {
    if (mode === "run" && runTabs.has(tabs)) return clampTabIndex(runTabs.get(tabs), tabNames(tabs).length);
    return currentTab(tabs);
  }

  /** A click on a tab: in design mode the TabWidget's currentTab (laid out again), while running only the view. */
  function selectTab(tabs, index) {
    if (mode === "design") {
      change(() => {
        tabs.properties ??= {};
        tabs.properties.currentTab = index;
        relayout(tabs);
      }, { panel: true });
      if (tabs.id) select([tabs.id]);
      return;
    }
    runTabs.set(tabs, index);
    const view = tabs.id ? views.get(tabs.id) : null;
    view?.showPage(index);
    requestAnimationFrame(() => views.forEach((item) => item.resize()));
    runtime?.refreshPolling();
  }

  function addWidgetAtCenter(type) {
    if (mode !== "design") return;
    const rect = dom.viewport.getBoundingClientRect();
    const x = (dom.viewport.scrollLeft + Math.min(rect.width, canvasSize().width * scale) / 3) / scale;
    const y = (dom.viewport.scrollTop + Math.min(rect.height, canvasSize().height * scale) / 3) / scale;
    addWidget(type, x, y);
  }

  function removeSelected() {
    if (!selection.size) return;
    const ids = new Set(selection);
    change(() => {
      const prune = (list) => {
        if (!Array.isArray(list)) return list;
        const kept = list.filter((widget) => !ids.has(widget?.id));
        for (const widget of kept) {
          if (isSupported(widget) && CONTAINER_TYPES.has(widget.type) && Array.isArray(widget.children)) {
            const before = widget.children.length;
            widget.children = prune(widget.children);
            if (widget.children.length !== before) relayout(widget);
            if (!widget.children.length) delete widget.children;
          }
        }
        return kept;
      };
      project.widgets = prune(project.widgets);
    });
    selection = new Set();
    renderPanel();
  }

  function nudge(dx, dy) {
    const widgets = selectedWidgets();
    if (!widgets.length) return;
    change(() => {
      for (const widget of widgets) {
        const g = geometryOf(widget);
        widget.geometry = { ...(widget.geometry ?? {}), x: g.x + dx, y: g.y + dy, w: g.w, h: g.h };
      }
    }, { coalesce: "nudge", panel: true });
  }

  /** Copies of the selected widgets: together in one container they paste back into it, else at the top level. */
  function copySelection() {
    const widgets = selectedWidgets().filter((widget) => !selectedWidgets().some((other) => other !== widget && isInside(widget, other)));
    const parents = new Set(widgets.map((widget) => findWidget(project, widget.id)?.parent ?? null));
    clipboardParent = parents.size === 1 ? [...parents][0] : null;
    clipboard = widgets.map((widget) => {
      const copy = clone(widget);
      if (!clipboardParent) {
        const position = absolutePosition(widget.id);
        copy.geometry = { ...geometryOf(widget), x: position.x, y: position.y };
        delete copy.tabIndex;
      }
      return copy;
    });
  }

  function paste() {
    if (!clipboard.length) return;
    const { grid } = canvasSize();
    const pasted = clipboard.map(clone);
    const taken = new Set();
    for (const top of pasted) {
      for (const widget of walkAllWidgets([top])) {
        const id = nextWidgetId(project, widget.type, taken);
        taken.add(id);
        widget.id = id;
      }
      top.geometry.x += grid;
      top.geometry.y += grid;
    }
    // The source container, while it is still in the project and on screen.
    const parent = clipboardParent && [...walkWidgets(project.widgets)].some((item) => item.widget === clipboardParent)
      && isShown(project, clipboardParent, pageOf) ? clipboardParent : null;
    change(() => {
      if (!Array.isArray(project.widgets)) project.widgets = [];
      for (const widget of pasted) {
        if (!parent) delete widget.tabIndex;
        if (parent) adopt(parent, widget);
        else project.widgets.push(widget);
      }
    });
    // The next paste lands one more step along.
    clipboard = pasted.map(clone);
    select(pasted.map((widget) => widget.id));
  }

  // -- pointer interaction ------------------------------------------------------------------

  function canvasPoint(event) {
    const rect = dom.canvas.getBoundingClientRect();
    return { x: (event.clientX - rect.left) / scale, y: (event.clientY - rect.top) / scale };
  }

  let drag = null;

  function onPointerDown(event) {
    if (mode !== "design" || event.button !== 0) return;
    const handle = event.target.closest(".hmi-handle");
    const node = event.target.closest(".hmi-widget");
    dom.viewport.focus({ preventScroll: true });
    if (!node) {
      // Empty canvas: a rubber band selects what it touches; Shift adds to the selection.
      if (event.target.closest("#hmiCanvas") || event.target === dom.stage || event.target === dom.viewport) {
        event.preventDefault();
        drag = { kind: "marquee", start: canvasPoint(event), additive: event.shiftKey, base: new Set(selection), moved: false };
        dom.viewport.setPointerCapture(event.pointerId);
      }
      return;
    }
    const id = node.dataset.widgetId;
    if (!id) return;
    if (event.target.closest(".hmi-tab")) {
      // The tab's click switches the page; pressing it selects the TabWidget without dragging.
      if (!selection.has(id)) select([id]);
      return;
    }
    event.preventDefault();
    if (handle) {
      const widget = findWidget(project, id).widget;
      drag = { kind: "resize", handle: handle.dataset.handle, id, start: canvasPoint(event), origin: geometryOf(widget), moved: false };
    } else {
      if (event.shiftKey) {
        select([id], { add: true });
        return;
      }
      if (!selection.has(id)) select([id]);
      const origins = new Map(selectedWidgets().map((widget) => [widget.id, geometryOf(widget)]));
      drag = { kind: "move", id, start: canvasPoint(event), origins, moved: false };
    }
    dom.viewport.setPointerCapture(event.pointerId);
  }

  // -- middle-button pan --------------------------------------------------------------------
  // The viewport is the scroll container, so panning is scrolling it. The listeners run in the capture phase
  // so a middle press over a widget (or a chart/control inside it) pans instead of reaching that widget.

  let pan = null;

  function onPanDown(event) {
    if (event.button !== 1) return;
    event.preventDefault(); // no autoscroll circle, no middle-click paste
    event.stopPropagation();
    if (pan || drag) return;
    pan = { id: event.pointerId, x: event.clientX, y: event.clientY, left: dom.viewport.scrollLeft, top: dom.viewport.scrollTop };
    dom.viewport.classList.add("hmi-panning");
    dom.viewport.setPointerCapture(event.pointerId);
  }

  function onPanMove(event) {
    if (!pan || event.pointerId !== pan.id) return;
    event.stopPropagation();
    if (!(event.buttons & 4)) { endPan(event); return; } // middle released while another button was still down: no pointerup
    dom.viewport.scrollLeft = pan.left - (event.clientX - pan.x);
    dom.viewport.scrollTop = pan.top - (event.clientY - pan.y);
  }

  function endPan(event) {
    if (!pan || (event.pointerId !== undefined && event.pointerId !== pan.id)) return;
    if (event.type === "pointerup" && event.button !== 1) return;
    if (event.type === "pointerup" || event.type === "pointercancel") event.stopPropagation();
    pan = null;
    dom.viewport.classList.remove("hmi-panning");
  }

  function suppressMiddle(event) {
    if (event.button !== 1) return;
    event.preventDefault();
    event.stopPropagation();
  }

  function onPointerMove(event) {
    if (!drag) return;
    const point = canvasPoint(event);
    const dx = point.x - drag.start.x;
    const dy = point.y - drag.start.y;
    if (!drag.moved && Math.abs(dx) < 2 && Math.abs(dy) < 2) return;
    drag.moved = true;
    if (drag.kind === "marquee") {
      drag.rect = { x: Math.min(drag.start.x, point.x), y: Math.min(drag.start.y, point.y), w: Math.abs(dx), h: Math.abs(dy) };
      drag.band ??= dom.canvas.appendChild(Object.assign(document.createElement("div"), { className: "hmi-marquee" }));
      Object.assign(drag.band.style, { left: `${drag.rect.x}px`, top: `${drag.rect.y}px`, width: `${drag.rect.w}px`, height: `${drag.rect.h}px` });
      const touched = marqueeHits(drag.rect);
      selection = new Set(drag.additive ? [...drag.base, ...touched] : touched);
      syncSelection();
      return;
    }
    if (drag.kind === "move") {
      drag.next = new Map();
      for (const [id, g] of drag.origins) {
        // Top-level widgets snap to the grid when moved; a container's children do not.
        const inContainer = Boolean(findWidget(project, id)?.parent);
        const next = inContainer ? { ...g, x: Math.round(g.x + dx), y: Math.round(g.y + dy) } : { ...g, x: snap(g.x + dx), y: snap(g.y + dy) };
        drag.next.set(id, next);
        const view = views.get(id);
        if (view) Object.assign(view.el.style, { left: `${next.x}px`, top: `${next.y - view.offsetY}px` });
      }
      if (drag.origins.size === 1) {
        const widget = findWidget(project, drag.id).widget;
        dom.canvas.querySelectorAll(".drop-target").forEach((node) => node.classList.remove("drop-target"));
        const target = containerAt(point.x, point.y, widget);
        if (target) views.get(target.id)?.el.classList.add("drop-target");
      }
      return;
    }
    const meta = widgetMeta(findWidget(project, drag.id).widget.type);
    const [minW, minH] = meta?.min ?? [10, 10];
    const g = { ...drag.origin };
    const { handle } = drag;
    if (handle.includes("e")) g.w = Math.max(minW, snap(drag.origin.x + drag.origin.w + dx) - drag.origin.x);
    if (handle.includes("s")) g.h = Math.max(minH, snap(drag.origin.y + drag.origin.h + dy) - drag.origin.y);
    if (handle.includes("w")) {
      const right = drag.origin.x + drag.origin.w;
      g.x = Math.min(snap(drag.origin.x + dx), right - minW);
      g.w = right - g.x;
    }
    if (handle.includes("n")) {
      const bottom = drag.origin.y + drag.origin.h;
      g.y = Math.min(snap(drag.origin.y + dy), bottom - minH);
      g.h = bottom - g.y;
    }
    drag.next = g;
    const view = views.get(drag.id);
    if (view) Object.assign(view.el.style, { left: `${g.x}px`, top: `${g.y - view.offsetY}px`, width: `${g.w}px`, height: `${g.h}px` });
  }

  function onPointerUp(event) {
    if (!drag) return;
    const current = drag;
    drag = null;
    dom.canvas.querySelectorAll(".drop-target").forEach((node) => node.classList.remove("drop-target"));
    if (current.kind === "marquee") {
      current.band?.remove();
      if (!current.moved && !current.additive) selection = new Set();
      syncSelection();
      renderPanel();
      updateToolbar();
      return;
    }
    if (!current.moved || !current.next) return;
    if (current.kind === "resize") {
      const widget = findWidget(project, current.id).widget;
      change(() => {
        widget.geometry = { ...(widget.geometry ?? {}), ...current.next };
        relayoutAround(widget);
      }, { panel: true });
      return;
    }
    const point = canvasPoint(event);
    change(() => {
      for (const [id, next] of current.next) {
        const entry = findWidget(project, id);
        entry.widget.geometry = { ...(entry.widget.geometry ?? {}), x: next.x, y: next.y, w: next.w, h: next.h };
      }
      if (current.next.size !== 1) {
        for (const id of current.next.keys()) relayoutAround(findWidget(project, id).widget);
        return;
      }
      // Dropped into a container (or out of one): it becomes that container's child.
      const entry = findWidget(project, current.id);
      const target = containerAt(point.x, point.y, entry.widget);
      if (target === entry.parent || (target === null && entry.parent === null)) {
        relayoutAround(entry.widget);
        return;
      }
      const absolute = absolutePosition(entry.widget.id);
      const origin = target ? absolutePosition(target.id) : { x: 0, y: 0 };
      entry.list.splice(entry.list.indexOf(entry.widget), 1);
      if (entry.parent && entry.parent.children.length === 0) delete entry.parent.children;
      if (entry.parent) relayout(entry.parent);
      entry.widget.geometry.x = absolute.x - origin.x;
      entry.widget.geometry.y = absolute.y - origin.y;
      adopt(target, entry.widget);
    }, { panel: true });
  }

  function onDragOver(event) {
    if (mode !== "design") return;
    const types = [...(event.dataTransfer?.types ?? [])];
    if (types.includes(DRAG_TYPE) || types.includes("Files")) {
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
    }
  }

  function onDrop(event) {
    const type = event.dataTransfer?.getData(DRAG_TYPE);
    if (type && mode === "design") {
      event.preventDefault();
      const point = canvasPoint(event);
      addWidget(type, point.x, point.y);
      return;
    }
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      event.preventDefault();
      void openFile(file);
    }
  }

  // -- the context menu ----------------------------------------------------------------------

  let menu = null;
  const mac = /Mac|iPhone|iPad/.test(navigator.platform);
  const shortcut = (key) => (mac ? `⌘${key}` : `Ctrl+${key}`);

  function closeMenu() {
    if (!menu) return;
    menu.remove();
    menu = null;
    document.removeEventListener("pointerdown", onOutsidePointer, true);
    document.removeEventListener("keydown", onMenuKey, true);
    window.removeEventListener("scroll", closeMenu, true);
    window.removeEventListener("blur", closeMenu);
  }

  function onOutsidePointer(event) {
    if (menu && !menu.contains(event.target)) closeMenu();
  }

  function onMenuKey(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closeMenu();
      dom.viewport.focus({ preventScroll: true });
    }
  }

  /** Moves the selected widgets to the end (top) or start (bottom) of their parent's list. */
  function reorderSelected(toTop) {
    const widgets = selectedWidgets();
    if (!widgets.length) return;
    change(() => {
      for (const widget of widgets) {
        const entry = [...walkWidgets(project.widgets)].find((item) => item.widget === widget);
        if (!entry) continue;
        entry.list.splice(entry.list.indexOf(widget), 1);
        if (toTop) entry.list.push(widget);
        else entry.list.unshift(widget);
        if (entry.parent) relayout(entry.parent);
      }
    }, { panel: true });
  }

  function menuButton(key, keys, run, enabled) {
    const button = document.createElement("button");
    button.type = "button";
    button.setAttribute("role", "menuitem");
    button.disabled = !enabled;
    const label = document.createElement("span");
    label.textContent = i18n(key);
    const hint = document.createElement("kbd");
    hint.textContent = keys;
    button.append(label, hint);
    if (run) {
      button.addEventListener("click", () => {
        closeMenu();
        run();
      });
    }
    return button;
  }

  function fillMenu(node, items) {
    for (const item of items) {
      if (!item) {
        node.append(Object.assign(document.createElement("div"), { className: "hmi-menu-separator" }));
        continue;
      }
      if (item.submenu) {
        // A submenu: shown beside its item on hover, focus or click.
        const wrap = Object.assign(document.createElement("div"), { className: "hmi-submenu" });
        const button = menuButton(item.key, "▸", null, true);
        button.setAttribute("aria-haspopup", "menu");
        const sub = Object.assign(document.createElement("div"), { className: "hmi-context-menu hmi-submenu-list" });
        sub.setAttribute("role", "menu");
        fillMenu(sub, item.submenu);
        const show = () => {
          sub.classList.add("open");
          const box = sub.getBoundingClientRect();
          if (box.right > window.innerWidth - 4) sub.classList.add("left");
        };
        button.addEventListener("click", show);
        wrap.addEventListener("pointerenter", show);
        wrap.addEventListener("pointerleave", () => sub.classList.remove("open"));
        button.addEventListener("keydown", (event) => {
          if (event.key === "ArrowRight") {
            show();
            sub.querySelector("button:not(:disabled)")?.focus();
          }
        });
        wrap.append(button, sub);
        node.append(wrap);
        continue;
      }
      node.append(menuButton(...item));
    }
  }

  /** A menu at a point (fixed position): items are [key, shortcut, run, enabled], null, or { key, submenu }. */
  function openMenu(x, y, items) {
    closeMenu();
    menu = document.createElement("div");
    menu.className = "hmi-context-menu";
    menu.setAttribute("role", "menu");
    fillMenu(menu, items);
    document.body.append(menu);
    const rect = menu.getBoundingClientRect();
    menu.style.left = `${Math.max(4, Math.min(x, window.innerWidth - rect.width - 4))}px`;
    menu.style.top = `${Math.max(4, Math.min(y, window.innerHeight - rect.height - 4))}px`;
    menu.querySelector("button:not(:disabled)")?.focus();
    document.addEventListener("pointerdown", onOutsidePointer, true);
    document.addEventListener("keydown", onMenuKey, true);
    window.addEventListener("scroll", closeMenu, true);
    window.addEventListener("blur", closeMenu);
  }

  function onContextMenu(event) {
    if (mode !== "design") return;
    const node = event.target.closest(".hmi-widget");
    if (!node?.dataset.widgetId) return;
    event.preventDefault();
    const id = node.dataset.widgetId;
    if (!selection.has(id)) select([id]);
    dom.viewport.focus({ preventScroll: true });
    const items = [
      ["hmi.action.delete", "Delete", removeSelected, true],
      ["hmi.action.copy", shortcut("C"), copySelection, true],
      ["hmi.action.paste", shortcut("V"), paste, clipboard.length > 0],
      ["hmi.action.duplicate", shortcut("D"), () => { copySelection(); paste(); }, true],
      null,
      ["hmi.action.toTop", "", () => reorderSelected(true), true],
      ["hmi.action.toBottom", "", () => reorderSelected(false), true],
    ];
    if (selection.size >= 2) items.push(null, { key: "hmi.align", submenu: alignItems() });
    openMenu(event.clientX, event.clientY, items);
  }

  // -- zoom, rubber band and alignment ---------------------------------------------------------

  function zoomBy(factor) {
    if (mode !== "design") return;
    zoom = Math.max(0.1, Math.min(8, scale * factor));
    applyScale();
    updateToolbar();
  }

  /** The widgets on screen whose canvas rectangle the band touches (Qt's IntersectsItemShape). */
  function marqueeHits(rect) {
    const hits = [];
    for (const { widget } of walkWidgets(project.widgets)) {
      if (!widget.id || !isShown(project, widget, pageOf)) continue;
      const position = absolutePosition(widget.id);
      const g = geometryOf(widget);
      if (position.x < rect.x + rect.w && rect.x < position.x + g.w && position.y < rect.y + rect.h && rect.y < position.y + g.h) hits.push(widget.id);
    }
    return hits;
  }

  /**
   * The selected widgets alignment moves (selection_manager.selected_items): free ones (not children
   * of a laid-out container) whose containers are not selected too.
   */
  function alignable() {
    const widgets = selectedWidgets();
    return widgets.filter((widget) => {
      const entry = findWidget(project, widget.id);
      if (entry?.parent && layoutMode(entry.parent) !== FREE_LAYOUT) return false;
      let parent = entry?.parent;
      while (parent) {
        if (selection.has(parent.id)) return false;
        parent = findWidget(project, parent.id)?.parent;
      }
      return true;
    });
  }

  function sceneRect(widget) {
    const position = absolutePosition(widget.id);
    const g = geometryOf(widget);
    return { left: position.x, top: position.y, right: position.x + g.w, bottom: position.y + g.h, width: g.w, height: g.h };
  }

  /** One alignment as one undo step: moves = [[widget, dx, dy]] in canvas units. */
  function applyMoves(moves) {
    change(() => {
      for (const [widget, dx, dy] of moves) {
        const g = geometryOf(widget);
        widget.geometry = { ...(widget.geometry ?? {}), x: Math.round(g.x + dx), y: Math.round(g.y + dy), w: g.w, h: g.h };
      }
    }, { panel: true });
  }

  function alignEdge(edge) {
    const items = alignable();
    if (items.length < 2) return;
    const values = items.map((widget) => sceneRect(widget)[edge]);
    const target = edge === "right" || edge === "bottom" ? Math.max(...values) : Math.min(...values);
    applyMoves(items.map((widget, index) => (edge === "left" || edge === "right" ? [widget, target - values[index], 0] : [widget, 0, target - values[index]])));
  }

  function alignCenter(horizontal) {
    const items = alignable();
    if (items.length < 2) return;
    const rects = items.map(sceneRect);
    const middle = horizontal
      ? (Math.min(...rects.map((r) => r.left)) + Math.max(...rects.map((r) => r.right))) / 2
      : (Math.min(...rects.map((r) => r.top)) + Math.max(...rects.map((r) => r.bottom))) / 2;
    applyMoves(items.map((widget, index) => {
      const r = rects[index];
      return horizontal ? [widget, middle - (r.left + r.width / 2), 0] : [widget, 0, middle - (r.top + r.height / 2)];
    }));
  }

  function distribute(horizontal) {
    const items = alignable();
    if (items.length < 3) return;
    const entries = items.map((widget) => ({ widget, rect: sceneRect(widget) }))
      .sort((a, b) => (horizontal ? a.rect.left - b.rect.left : a.rect.top - b.rect.top) || String(a.widget.id).localeCompare(String(b.widget.id)));
    const start = Math.min(...entries.map(({ rect }) => (horizontal ? rect.left : rect.top)));
    const stop = Math.max(...entries.map(({ rect }) => (horizontal ? rect.right : rect.bottom)));
    const sizes = entries.reduce((sum, { rect }) => sum + (horizontal ? rect.width : rect.height), 0);
    const gap = (stop - start - sizes) / (entries.length - 1);
    let cursor = start;
    const moves = entries.map(({ widget, rect }) => {
      const delta = cursor - (horizontal ? rect.left : rect.top);
      cursor += (horizontal ? rect.width : rect.height) + gap;
      return horizontal ? [widget, delta, 0] : [widget, 0, delta];
    });
    applyMoves(moves);
  }

  /** The 对齐 menu's items, disabled while too few widgets can move. */
  function alignItems() {
    const count = alignable().length;
    return [
      ["hmi.alignLeft", "", () => alignEdge("left"), count >= 2],
      ["hmi.alignRight", "", () => alignEdge("right"), count >= 2],
      ["hmi.alignTop", "", () => alignEdge("top"), count >= 2],
      ["hmi.alignBottom", "", () => alignEdge("bottom"), count >= 2],
      ["hmi.alignHCenter", "", () => alignCenter(true), count >= 2],
      ["hmi.alignVCenter", "", () => alignCenter(false), count >= 2],
      ["hmi.distributeH", "", () => distribute(true), count >= 3],
      ["hmi.distributeV", "", () => distribute(false), count >= 3],
    ];
  }

  function onKeyDown(event) {
    // Wherever focus is (the header toolbar too), except while typing.
    if (!active || mode !== "design" || isTyping(event.target)) return;
    if (event.target.closest?.("dialog[open]")) return;
    const command = event.metaKey || event.ctrlKey;
    const key = event.key.toLowerCase();
    if (command && (key === "=" || key === "+")) {
      event.preventDefault();
      zoomBy(ZOOM_STEP);
      return;
    }
    if (command && (key === "-" || key === "_")) {
      event.preventDefault();
      zoomBy(1 / ZOOM_STEP);
      return;
    }
    if (command && key === "0") {
      event.preventDefault();
      zoom = "fit";
      applyScale();
      updateToolbar();
      return;
    }
    if (command && key === "z") {
      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
    } else if (command && key === "y") {
      event.preventDefault();
      redo();
    } else if (command && key === "c" && selection.size) {
      event.preventDefault();
      copySelection();
    } else if (command && key === "v" && clipboard.length) {
      event.preventDefault();
      paste();
    } else if (command && key === "d" && selection.size) {
      event.preventDefault();
      copySelection();
      paste();
    } else if ((event.key === "Delete" || event.key === "Backspace") && selection.size) {
      event.preventDefault();
      removeSelected();
    } else if (event.key.startsWith("Arrow") && selection.size) {
      event.preventDefault();
      const step = event.shiftKey ? 10 : 1;
      const delta = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[event.key];
      nudge(...delta);
    } else if (event.key === "Escape" && selection.size) {
      select([]);
    }
  }

  // -- files --------------------------------------------------------------------------------

  async function openFile(file) {
    try {
      const text = await file.text();
      const next = parseProject(text);
      replaceProject(next);
      notifyText("info", i18n("hmi.file.opened").replace("{name}", file.name));
    } catch (error) {
      notifyText("error", `${i18n("hmi.file.rejected")}${projectErrorText(error)}`);
    }
  }

  function notifyText(level, text) {
    dom.toast.textContent = text;
    dom.toast.dataset.level = level;
    dom.toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      dom.toast.hidden = true;
    }, level === "error" ? 6000 : 2600);
  }

  function saveFile() {
    const name = `${String(project.appName || "project").replace(/[\\/:*?"<>|]+/g, "_")}.uidp`;
    const blob = new Blob([serializeProject(project)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // -- wiring -------------------------------------------------------------------------------

  dom.designButton.addEventListener("click", () => setMode("design"));
  dom.runButton.addEventListener("click", () => setMode("run"));
  dom.newButton.addEventListener("click", () => replaceProject(createEmptyProject()));
  dom.exampleButton.addEventListener("click", () => replaceProject(createExampleProject()));
  dom.openButton.addEventListener("click", () => dom.file.click());
  dom.file.addEventListener("change", () => {
    const file = dom.file.files?.[0];
    dom.file.value = "";
    if (file) void openFile(file);
  });
  dom.saveButton.addEventListener("click", saveFile);
  dom.undoButton.addEventListener("click", undo);
  dom.redoButton.addEventListener("click", redo);
  dom.paletteToggle.addEventListener("click", () => setPanel("palette", !panels.palette));
  dom.propsToggle.addEventListener("click", () => setPanel("props", !panels.props));
  dom.paletteClose.addEventListener("click", () => setPanel("palette", false));
  dom.propsClose.addEventListener("click", () => setPanel("props", false));
  dom.sidebarButton.addEventListener("click", () => {
    appShell?.classList.toggle("hmi-sidebar-hidden");
    updateToolbar();
    applyScale();
  });
  dom.fitButton.addEventListener("click", () => {
    zoom = "fit";
    applyScale();
    updateToolbar();
  });
  dom.zoomButton.addEventListener("click", () => {
    zoom = 1;
    applyScale();
    updateToolbar();
  });
  dom.zoomInButton.addEventListener("click", () => zoomBy(ZOOM_STEP));
  dom.zoomOutButton.addEventListener("click", () => zoomBy(1 / ZOOM_STEP));
  dom.gridButton.addEventListener("click", () => {
    showGrid = !showGrid;
    try {
      localStorage.setItem(GRID_STORAGE_KEY, showGrid ? "1" : "0");
    } catch {
      // Not remembered.
    }
    updateToolbar();
  });
  dom.alignButton.addEventListener("click", () => {
    const rect = dom.alignButton.getBoundingClientRect();
    openMenu(rect.left, rect.bottom + 4, alignItems());
  });
  dom.viewport.addEventListener("pointerdown", onPanDown, true);
  dom.viewport.addEventListener("mousedown", suppressMiddle, true);
  dom.viewport.addEventListener("auxclick", suppressMiddle, true);
  dom.viewport.addEventListener("pointermove", onPanMove, true);
  dom.viewport.addEventListener("pointerup", endPan, true);
  dom.viewport.addEventListener("pointercancel", endPan, true);
  dom.viewport.addEventListener("lostpointercapture", endPan);
  window.addEventListener("blur", endPan);
  dom.viewport.addEventListener("pointerdown", onPointerDown);
  dom.viewport.addEventListener("pointermove", onPointerMove);
  dom.viewport.addEventListener("pointerup", onPointerUp);
  dom.viewport.addEventListener("pointercancel", onPointerUp);
  dom.viewport.addEventListener("dragover", onDragOver);
  dom.viewport.addEventListener("drop", onDrop);
  dom.viewport.addEventListener("contextmenu", onContextMenu);
  document.addEventListener("keydown", onKeyDown);
  narrowQuery.addEventListener?.("change", () => {
    if (narrowQuery.matches && mode === "design") setMode("run");
    else updateToolbar();
  });
  const resizeObserver = typeof ResizeObserver === "function" ? new ResizeObserver(() => {
    if (!active) return;
    applyScale();
    views.forEach((view) => view.resize());
  }) : null;
  resizeObserver?.observe(dom.viewport);

  renderPalette();

  return {
    activate() {
      active = true;
      appShell?.classList.add("hmi-sidebar-hidden", "hmi-page-shown");
      const actions = appShell?.querySelector(".topbar-actions");
      if (actions) actions.before(toolbar);
      if (narrowQuery.matches) mode = "run";
      startRuntime();
      renderAll();
    },
    deactivate() {
      closeMenu();
      if (!active) return;
      active = false;
      appShell?.classList.remove("hmi-sidebar-hidden", "hmi-page-shown");
      toolbarHome.prepend(toolbar);
      stopRuntime();
      destroyViews();
    },
    isActive: () => active,
    localize() {
      renderPalette();
      if (active) renderAll();
    },
  };
}
