import test from "node:test";
import assert from "node:assert/strict";
import i18n from "../src/i18n.js";
import { renderPropertyPanel } from "../src/features/canvas/property-panel.js";

// Only the DOM operations this form needs; exercise its real input listeners and rerenders.
class Element {
  constructor(tag) { this.tagName = tag; this.children = []; this.listeners = {}; }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  addEventListener(type, listener) { this.listeners[type] = listener; }
  querySelectorAll(tag) {
    return this.children.flatMap((child) => [ ...(child.tagName === tag ? [child] : []), ...child.querySelectorAll(tag) ]);
  }
}

test("curve form renders every expression in both languages, edits separately and preserves across modes", () => {
  const originalDocument = globalThis.document;
  const originalLanguage = i18n.current;
  globalThis.document = { createElement: (tag) => new Element(tag) };
  try {
    const root = new Element("div");
    const widget = { id: "chart", type: "RealtimeChart", properties: { curveCount: 4 } };
    const ctx = { selected: [widget], project: {}, canPaste: () => false, change: (mutate) => mutate() };
    for (const [language, label] of [["zh", "转换表达式"], ["en", "Conversion expression"]]) {
      i18n.current = () => language;
      ["键值匹配", "JSON路径", "HEX字节提取", "Modbus"].forEach((mode, index) => { widget.properties[`_curve_${index}_parseMode`] = mode; });
      renderPropertyPanel(root, ctx);
      const expressions = root.querySelectorAll("fieldset").map((box) => {
        const last = box.children.at(-1);
        assert.equal(last.children[0].textContent, label);
        return last.children[1];
      });
      assert.equal(expressions.length, 4);
      expressions.forEach((input, index) => { input.value = `value + ${index}`; input.listeners.input(); });
      expressions.forEach((_, index) => assert.equal(widget.properties[`_curve_${index}_expression`], `value + ${index}`));
      widget.properties._curve_0_parseMode = "Modbus";
      renderPropertyPanel(root, ctx);
      assert.equal(root.querySelectorAll("label").find((node) => node.children[0]?.textContent === label).children[1].value, "value + 0");
    }
  } finally {
    globalThis.document = originalDocument;
    i18n.current = originalLanguage;
  }
});
