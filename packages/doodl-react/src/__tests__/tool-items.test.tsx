import { type DrawTool, TOOL_CONFIGS } from "@n-uf/doodl";
import { isValidElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  ANNOTATION_TOOL_DEFINITIONS,
  type AnnotationToolDefinition,
  getToolTooltip,
} from "../annotation-tools";
import {
  DRAW_TOOL_ICONS,
  isDrawTool,
  type ToolItemLike,
  toToolItems,
} from "../tool-items";

const ALL_TOOLS = Object.keys(TOOL_CONFIGS) as DrawTool[];

/**
 * Core tools deliberately left out of ANNOTATION_TOOL_DEFINITIONS (the
 * default toolbar is a subset). Adding a tool to core means adding it to the
 * definitions or to this list.
 */
const OMITTED_FROM_DEFAULT_TOOLBAR: readonly DrawTool[] = [
  "ellipse",
  "polygon",
  "highlight",
  "text",
];

function renderIcon(
  icon: ToolItemLike["icon"],
  state = { active: false, size: 20 }
): string {
  const node = typeof icon === "function" ? icon(state) : icon;
  return renderToStaticMarkup(<>{node}</>);
}

describe("toToolItems", () => {
  it("maps every default definition to a toolbar item", () => {
    const items = toToolItems();
    expect(items.map((i) => i.id)).toEqual(
      ANNOTATION_TOOL_DEFINITIONS.map((d) => d.id)
    );
    for (const [index, item] of items.entries()) {
      const def = ANNOTATION_TOOL_DEFINITIONS[index]!;
      expect(item.label).toBe(def.label);
      expect(item.shortcut).toBe(def.shortcut);
      expect(item.group).toBe(def.category);
      expect(item.tooltip).toBe(
        def.description ? `${def.description} (${def.shortcut})` : undefined
      );
      expect(item.icon).toBe(DRAW_TOOL_ICONS[def.id]);
      expect(item.disabled).toBeUndefined();
      expect(item.hidden).toBeUndefined();
    }
  });

  it("adds the shortcut to the tooltip", () => {
    const freehand = toToolItems().find((i) => i.id === "freehand")!;
    expect(freehand.tooltip).toBe("Freehand drawing (F)");
  });

  it("maps custom definitions and leaves tooltip unset without a description", () => {
    const defs: AnnotationToolDefinition[] = [
      { id: "ellipse", label: "Oval", shortcut: "O", category: "shape" },
    ];
    expect(toToolItems(defs)).toEqual([
      {
        id: "ellipse",
        label: "Oval",
        shortcut: "O",
        group: "shape",
        icon: DRAW_TOOL_ICONS.ellipse,
      },
    ]);
  });

  it("keeps only the listed tools, in definition order", () => {
    const items = toToolItems(undefined, { only: ["rect", "select"] });
    expect(items.map((i) => i.id)).toEqual(["select", "rect"]);
  });

  it("applies shortcut and icon overrides per tool", () => {
    const customIcon = <span>R</span>;
    const items = toToolItems(undefined, {
      shortcuts: { rect: "X", select: "" },
      icons: { rect: customIcon },
    });
    const rect = items.find((i) => i.id === "rect")!;
    const select = items.find((i) => i.id === "select")!;
    const freehand = items.find((i) => i.id === "freehand")!;
    expect(rect.shortcut).toBe("X");
    expect(rect.tooltip).toBe("Draw rectangle shapes (X)");
    expect(rect.icon).toBe(customIcon);
    expect(select.shortcut).toBeUndefined();
    expect(select.tooltip).toBe("Select and move annotations");
    expect(select.icon).toBe(DRAW_TOOL_ICONS.select);
    expect(freehand.shortcut).toBe("F");
  });

  it("omits icons when icons is false", () => {
    for (const item of toToolItems(undefined, { icons: false })) {
      expect("icon" in item).toBe(false);
    }
  });

  it("does not mutate the definitions", () => {
    const before = structuredClone(ANNOTATION_TOOL_DEFINITIONS);
    toToolItems(undefined, { shortcuts: { rect: "X" } });
    expect(ANNOTATION_TOOL_DEFINITIONS).toEqual(before);
  });
});

describe("isDrawTool", () => {
  it("accepts every doodl tool id", () => {
    for (const tool of ALL_TOOLS) expect(isDrawTool(tool)).toBe(true);
  });

  it("rejects other ids, including inherited object keys", () => {
    for (const id of ["", "pen", "Select", "toString", "__proto__"]) {
      expect(isDrawTool(id)).toBe(false);
    }
  });
});

describe("DRAW_TOOL_ICONS", () => {
  it("has exactly one icon per doodl tool", () => {
    expect(Object.keys(DRAW_TOOL_ICONS).sort()).toEqual([...ALL_TOOLS].sort());
  });

  it.each(ALL_TOOLS)("renders the %s icon as a sized stroke svg", (tool) => {
    const icon = DRAW_TOOL_ICONS[tool];
    const node = icon({ active: false, size: 18 });
    expect(isValidElement(node)).toBe(true);
    const html = renderIcon(icon, { active: false, size: 18 });
    expect(html).toMatch(/^<svg /);
    expect(html).toContain('viewBox="0 0 24 24"');
    expect(html).toContain('stroke="currentColor"');
    expect(html).toContain('width="18"');
    expect(html).toContain('height="18"');
    expect(html).toContain(`data-doodl-tool-icon="${tool}"`);
    expect(html).toMatch(/<(path|rect|ellipse)\b/);
  });

  it("fills the highlighter icon only while active", () => {
    const idle = renderIcon(DRAW_TOOL_ICONS.highlight, {
      active: false,
      size: 24,
    });
    const active = renderIcon(DRAW_TOOL_ICONS.highlight, {
      active: true,
      size: 24,
    });
    expect(idle).not.toContain('fill="currentColor"');
    expect(active).toContain('fill="currentColor"');
  });
});

describe("shortcut table", () => {
  it("covers every core tool with a shortcut or lists it as omitted", () => {
    const defined = new Set(ANNOTATION_TOOL_DEFINITIONS.map((d) => d.id));
    for (const tool of ALL_TOOLS) {
      if (!TOOL_CONFIGS[tool].shortcut) continue;
      expect(
        defined.has(tool) !== OMITTED_FROM_DEFAULT_TOOLBAR.includes(tool),
        `${tool} must be in exactly one of ANNOTATION_TOOL_DEFINITIONS and OMITTED_FROM_DEFAULT_TOOLBAR`
      ).toBe(true);
    }
  });

  it("matches doodl core TOOL_CONFIGS for every defined tool", () => {
    for (const def of ANNOTATION_TOOL_DEFINITIONS) {
      expect(def.shortcut).toBe(TOOL_CONFIGS[def.id].shortcut);
    }
  });

  it("keeps the deprecated tooltip helper working", () => {
    const freehand = ANNOTATION_TOOL_DEFINITIONS.find(
      (d) => d.id === "freehand"
    )!;
    expect(getToolTooltip(freehand)).toBe("Pencil (F)");
  });
});
