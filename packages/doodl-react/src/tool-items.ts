/**
 * Adapter: doodl annotation tool definitions → generic toolbar items.
 *
 * `ToolItemLike` is a structural twin of the generic `ToolItem` used by
 * toolbar kits such as `ToolToolbar` in `@n-uf/harbuz`. doodl does not depend
 * on those kits (nor they on doodl); the shapes simply match.
 *
 * Also available as the standalone subpath `@n-uf/doodl-react/tool-items`.
 * Like the rest of doodl-react it is a client module (`"use client"`): call it
 * from client components.
 */

import type { DrawTool } from "@n-uf/doodl";
import type { ReactNode } from "react";
import {
  ANNOTATION_TOOL_DEFINITIONS,
  type AnnotationToolDefinition,
} from "./annotation-tools";
import { DRAW_TOOL_ICONS, type ToolIconState } from "./tool-icons";

export { DRAW_TOOL_ICONS } from "./tool-icons";
export type { ToolIconRenderer, ToolIconState } from "./tool-icons";
export type { AnnotationToolDefinition } from "./annotation-tools";

/**
 * Generic toolbar item, structurally compatible with `ToolItem` from
 * `@n-uf/angiospermae` (not imported: doodl has no dependency on it).
 */
export interface ToolItemLike<Id extends string = string> {
  id: Id;
  label: string;
  icon?: ReactNode | ((s: ToolIconState) => ReactNode);
  tooltip?: string;
  shortcut?: string;
  group?: string;
  disabled?: boolean;
  hidden?: boolean;
}

/** Options for {@link toToolItems}. */
export interface ToToolItemsOptions {
  /** Keep only these tools (definition order is preserved). */
  only?: readonly DrawTool[];
  /** Override shortcut keys per tool; an empty string removes the shortcut. */
  shortcuts?: Partial<Record<DrawTool, string>>;
  /** Override icons per tool (merged over `DRAW_TOOL_ICONS`), or `false` for no icons. */
  icons?: Partial<Record<DrawTool, ToolItemLike["icon"]>> | false;
}

/**
 * Exhaustive set of doodl tool ids. `satisfies` makes the compiler flag a
 * missing entry when `DrawTool` grows.
 */
const DRAW_TOOL_IDS = {
  select: true,
  rect: true,
  ellipse: true,
  polygon: true,
  freehand: true,
  highlight: true,
  text: true,
  "text-highlight": true,
  "text-unhighlight": true,
} as const satisfies Record<DrawTool, true>;

/** Type guard: narrows a toolbar item id back to a doodl `DrawTool`. */
export function isDrawTool(id: string): id is DrawTool {
  return Object.prototype.hasOwnProperty.call(DRAW_TOOL_IDS, id);
}

/**
 * Map doodl annotation tool definitions to generic toolbar items.
 *
 * - `label`, `shortcut` and `id` carry over; `category` becomes `group`.
 * - `tooltip` is `"<description> (<SHORTCUT>)"`, or just the description when
 *   the tool has no shortcut (after overrides). Without a description it stays
 *   unset, so the toolbar's default "Label (K)" tooltip applies.
 * - Icons default to `DRAW_TOOL_ICONS`.
 *
 * @example
 * ```tsx
 * <ToolToolbar
 *   items={toToolItems()}
 *   activeId={tool}
 *   onChange={(id) => isDrawTool(id) && setTool(id)}
 * />
 * ```
 */
export function toToolItems(
  defs: readonly AnnotationToolDefinition[] = ANNOTATION_TOOL_DEFINITIONS,
  opts: ToToolItemsOptions = {}
): ToolItemLike<DrawTool>[] {
  const { only, shortcuts, icons } = opts;
  const selected = only ? defs.filter((d) => only.includes(d.id)) : defs;

  return selected.map((def) => {
    const shortcut =
      shortcuts && def.id in shortcuts ? shortcuts[def.id] : def.shortcut;
    const icon =
      icons === false
        ? undefined
        : icons && def.id in icons
          ? icons[def.id]
          : DRAW_TOOL_ICONS[def.id];

    const item: ToolItemLike<DrawTool> = {
      id: def.id,
      label: def.label,
      group: def.category,
    };
    if (icon !== undefined) item.icon = icon;
    if (shortcut) item.shortcut = shortcut;
    if (def.description) {
      item.tooltip = shortcut
        ? `${def.description} (${shortcut.toUpperCase()})`
        : def.description;
    }
    return item;
  });
}
