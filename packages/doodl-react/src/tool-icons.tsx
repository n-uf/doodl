/**
 * Default stroke icons for every doodl `DrawTool`.
 *
 * Each icon is a render prop `({ active, size }) => <svg>` on a 24×24 viewBox,
 * drawn with `stroke="currentColor"` so it follows the toolbar's text color.
 * No size is fixed: the toolbar passes the size it renders at.
 */

import type { DrawTool } from "@n-uf/doodl";
import type { ReactNode } from "react";

/** State a toolbar passes to a render-prop icon. */
export interface ToolIconState {
  /** Whether the tool is the active one */
  active: boolean;
  /** Rendered icon size in pixels (width and height) */
  size: number;
}

/** Render-prop form of a toolbar icon. */
export type ToolIconRenderer = (state: ToolIconState) => ReactNode;

function strokeIcon(children: ReactNode, toolId: DrawTool): ToolIconRenderer {
  const render: ToolIconRenderer = ({ size }) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      data-doodl-tool-icon={toolId}
    >
      {children}
    </svg>
  );
  return render;
}

/** Highlighter: the marker tip fills in while the tool is active. */
const highlightIcon: ToolIconRenderer = ({ active, size }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
    data-doodl-tool-icon="highlight"
    data-active={active ? "true" : undefined}
  >
    <path
      d="m9 11-6 6v3h9l3-3"
      fill={active ? "currentColor" : "none"}
      fillOpacity={active ? 0.35 : undefined}
    />
    <path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4" />
  </svg>
);

/**
 * Default icons for all built-in doodl tools.
 *
 * Use them as `ToolItem.icon` in a generic toolbar (`toToolItems()` does so by
 * default), or pick single icons for a custom UI.
 */
export const DRAW_TOOL_ICONS: Readonly<Record<DrawTool, ToolIconRenderer>> =
  Object.freeze({
    select: strokeIcon(
      <>
        <path d="M4 4l7 16 2.5-6.5L20 11z" />
        <path d="m13.5 13.5 5 5" />
      </>,
      "select"
    ),
    rect: strokeIcon(
      <rect x="4" y="5" width="16" height="14" rx="2" />,
      "rect"
    ),
    ellipse: strokeIcon(<ellipse cx="12" cy="12" rx="9" ry="7" />, "ellipse"),
    polygon: strokeIcon(
      <path d="M12 3l9 6.5-3.5 10.5h-11L3 9.5z" />,
      "polygon"
    ),
    freehand: strokeIcon(
      <>
        <path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z" />
        <path d="m15 5 4 4" />
      </>,
      "freehand"
    ),
    highlight: highlightIcon,
    text: strokeIcon(
      <>
        <path d="M5 6V4h14v2" />
        <path d="M12 4v16" />
        <path d="M9 20h6" />
      </>,
      "text"
    ),
    "text-highlight": strokeIcon(
      <>
        <path d="M6 16 11 4h2l5 12" />
        <path d="M8 12h8" />
        <path d="M3 20h18" />
      </>,
      "text-highlight"
    ),
    "text-unhighlight": strokeIcon(
      <>
        <path d="m7 21-4.3-4.3a1 1 0 0 1 0-1.4l9.6-9.6a1 1 0 0 1 1.4 0l5.6 5.6a1 1 0 0 1 0 1.4L13 21" />
        <path d="M22 21H7" />
        <path d="m5 11 9 9" />
      </>,
      "text-unhighlight"
    ),
  });
