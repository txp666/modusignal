// Container layouts of the canvas editor, as FluentHMI Studio's designer has them
// (CanvasItem::layoutMode / relayoutChildren): a laid-out container places its visible children
// when they are added, removed or resized and when it changes. The file keeps the positions, so a
// running project shows children where the file has them. Pure: no DOM.

import { WIDGET_TYPES } from "./widget-registry.js";

export const FREE_LAYOUT = "自由";
export const TAB_LAYOUTS = ["自由", "垂直", "水平", "弹性(Flex)"];
const PADDING = 8;
const TITLE_HEIGHT = 22;
const GROUP_TITLE_HEIGHT = 28;
/** Where a tab page starts below the tab bar, as in PyQt UI Designer. */
export const TAB_PAGE_TOP = 33;

const props = (widget) => (widget.properties && typeof widget.properties === "object" ? widget.properties : {});

/** The pages of a TabWidget: one per non-empty line of tabNames, at least one. */
export function tabNames(widget) {
  const text = String(props(widget).tabNames ?? "标签1\n标签2\n标签3");
  const names = text.split("\n").map((name) => name.trim()).filter(Boolean);
  return names.length ? names : ["标签1"];
}

export function clampTabIndex(index, count) {
  const number = Math.trunc(Number(index) || 0);
  return Math.max(0, Math.min(number, Math.max(0, count - 1)));
}

/** The page a TabWidget shows in the file (currentTab, clamped). */
export function currentTab(widget) {
  return clampTabIndex(props(widget).currentTab ?? 0, tabNames(widget).length);
}

/** The page a child of a TabWidget is on (tabIndex, missing = page 0, clamped). */
export function childTab(tabs, child) {
  return clampTabIndex(child.tabIndex ?? 0, tabNames(tabs).length);
}

/** A container's layout: 自由 / 垂直 / 水平 / 弹性(Flex) / 弹性列. A TabWidget's is its current page's _tabLayout_{n}. */
export function layoutMode(widget) {
  switch (widget.type) {
    case "HBoxLayout": return "水平";
    case "VBoxLayout":
    case "GroupBox": return "垂直";
    case "FlexLayout": return props(widget).direction === "column" ? "弹性列" : "弹性(Flex)";
    case "CardContainer": return String(props(widget).layout ?? FREE_LAYOUT);
    case "TabWidget": return String(props(widget)[`_tabLayout_${currentTab(widget)}`] ?? FREE_LAYOUT);
    default: return FREE_LAYOUT;
  }
}

/** Where a container's content starts. */
export function contentTop(widget) {
  switch (widget.type) {
    case "HBoxLayout":
    case "VBoxLayout":
    case "FlexLayout": return TITLE_HEIGHT;
    case "GroupBox": return GROUP_TITLE_HEIGHT;
    case "CardContainer": return Math.max(PADDING, String(props(widget).title ?? "") ? GROUP_TITLE_HEIGHT : PADDING);
    case "TabWidget": return TAB_PAGE_TOP;
    default: return 0;
  }
}

const num = (value, fallback) => (typeof value === "number" && Number.isFinite(value) ? value : fallback);

function size(widget) {
  const meta = WIDGET_TYPES[widget.type];
  const g = widget.geometry ?? {};
  return { w: num(g.w, meta?.size[0] ?? 120), h: num(g.h, meta?.size[1] ?? 40) };
}

function place(child, x, y, w) {
  const g = child.geometry && typeof child.geometry === "object" ? child.geometry : {};
  const { w: width, h } = size(child);
  child.geometry = { ...g, x, y, w: w ?? width, h };
}

/** The children a container shows: a TabWidget's current page, every other container's all. */
export function visibleChildren(container) {
  const children = Array.isArray(container.children) ? container.children.filter((child) => child && typeof child === "object") : [];
  if (container.type !== "TabWidget") return children;
  const page = currentTab(container);
  return children.filter((child) => childTab(container, child) === page);
}

/** Places a container's visible children by its layout; nothing moves in a free one. */
export function relayout(container) {
  const mode = layoutMode(container);
  if (mode === FREE_LAYOUT) return;
  const visible = visibleChildren(container);
  if (!visible.length) return;
  const spacing = num(Number(props(container).spacing ?? 8), 8);
  const top = contentTop(container);
  const { w: width, h: height } = size(container);
  if (mode === "水平") {
    let x = PADDING;
    for (const child of visible) {
      place(child, x, top);
      x += size(child).w + spacing;
    }
  } else if (mode === "垂直") {
    let y = top;
    for (const child of visible) {
      const minimum = WIDGET_TYPES[child.type]?.min[0] ?? 10;
      place(child, PADDING, y, Math.max(minimum, width - 2 * PADDING));
      y += size(child).h + spacing;
    }
  } else if (mode === "弹性(Flex)") {
    let x = PADDING;
    let y = top;
    let rowHeight = 0;
    for (const child of visible) {
      const { w, h } = size(child);
      if (x + w > width - PADDING && x > PADDING) {
        x = PADDING;
        y += rowHeight + spacing;
        rowHeight = 0;
      }
      place(child, x, y);
      x += w + spacing;
      rowHeight = Math.max(rowHeight, h);
    }
  } else if (mode === "弹性列") {
    let x = PADDING;
    let y = top;
    let columnWidth = 0;
    for (const child of visible) {
      const { w, h } = size(child);
      if (y + h > height - PADDING && y > top) {
        y = top;
        x += columnWidth + spacing;
        columnWidth = 0;
      }
      place(child, x, y);
      y += h + spacing;
      columnWidth = Math.max(columnWidth, w);
    }
  }
}
