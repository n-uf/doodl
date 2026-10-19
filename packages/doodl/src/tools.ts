/**
 * Tool configuration for Doodl (client-facing)
 */

import { DEFAULT_TEXT_HIGHLIGHT_STYLE } from "./shapes/text-highlight/factory";
import type { ShapeStyle } from "./types/style";
import { HIGHLIGHT_STYLE } from "./types/style";

// =============================================================================
// TOOL TYPES
// =============================================================================

/**
 * Available drawing tools
 */
export type DrawTool =
  | "select" // Selection/manipulation mode
  | "rect" // Rectangle drawing
  | "ellipse" // Ellipse drawing
  | "polygon" // Polygon drawing
  | "freehand" // Freehand drawing
  | "highlight" // Highlight mode (freehand with preset style)
  | "text" // Text placement
  | "text-highlight" // DOM text highlighting
  | "text-unhighlight"; // DOM text unhighlight (eraser)

// =============================================================================
// TOOL CONFIGURATION
// =============================================================================

/**
 * Tool configuration (UI + runtime)
 */
export interface ToolConfig {
  /** Tool identifier */
  id: DrawTool;
  /** Display name */
  name: string;
  /** Keyboard shortcut */
  shortcut?: string;
  /** Tool icon (emoji or icon name) */
  icon: string;
  /** Cursor style */
  cursor: string;
  /** Style override (e.g., highlight uses HIGHLIGHT_STYLE) */
  styleOverride?: ShapeStyle;
}

/**
 * Tool configurations (single source of truth)
 */
export const TOOL_CONFIGS: Record<DrawTool, ToolConfig> = {
  select: {
    id: "select",
    name: "Select",
    shortcut: "V",
    icon: "cursor",
    cursor: "default",
  },
  rect: {
    id: "rect",
    name: "Rectangle",
    shortcut: "R",
    icon: "square",
    cursor: "crosshair",
  },
  ellipse: {
    id: "ellipse",
    name: "Ellipse",
    shortcut: "O",
    icon: "circle",
    cursor: "crosshair",
  },
  polygon: {
    id: "polygon",
    name: "Polygon",
    shortcut: "P",
    icon: "pentagon",
    cursor: "crosshair",
  },
  freehand: {
    id: "freehand",
    name: "Freehand",
    shortcut: "F",
    icon: "pencil",
    cursor: "crosshair",
  },
  highlight: {
    id: "highlight",
    name: "Highlight",
    shortcut: "H",
    icon: "marker",
    cursor: "crosshair",
    styleOverride: HIGHLIGHT_STYLE,
  },
  text: {
    id: "text",
    name: "Text",
    shortcut: "T",
    icon: "text",
    cursor: "text",
  },
  "text-highlight": {
    id: "text-highlight",
    name: "Text Highlight",
    shortcut: "M",
    icon: "marker",
    cursor: "text",
    styleOverride: DEFAULT_TEXT_HIGHLIGHT_STYLE,
  },
  "text-unhighlight": {
    id: "text-unhighlight",
    name: "Unhighlight Text",
    shortcut: "U",
    icon: "eraser",
    cursor: "text",
    styleOverride: {
      ...DEFAULT_TEXT_HIGHLIGHT_STYLE,
      fill: "#ff6b6b", // Red-ish for eraser preview
      fillOpacity: 0.3,
    },
  },
};

/**
 * Get tool config by ID
 */
export function getToolConfig(tool: DrawTool): ToolConfig {
  return TOOL_CONFIGS[tool];
}

// =============================================================================
// TOOL → SHAPE MAPPING
// =============================================================================

/**
 * Maps tools to the shape type they create/modify
 *
 * null = tool doesn't create shapes (e.g., select)
 * Used to derive creation behavior from shape registry.
 */
export const TOOL_TARGET_SHAPE: Record<DrawTool, string | null> = {
  select: null, // Selection, not creation
  rect: "rect",
  ellipse: "ellipse",
  polygon: "polygon",
  freehand: "freehand",
  highlight: "freehand", // Creates freehand with highlight style
  text: "text",
  "text-highlight": "text-highlight",
  "text-unhighlight": "text-highlight", // Modifies text-highlight shapes
};

/**
 * Get the target shape type for a tool
 *
 * @param tool - The drawing tool
 * @returns Shape type string or null if tool doesn't target a shape
 */
export function getToolTargetShape(tool: DrawTool): string | null {
  return TOOL_TARGET_SHAPE[tool];
}
