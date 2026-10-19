/**
 * Tool configuration tokens
 */

import type { DrawTool } from "@n-uf/doodl";

export interface ToolDef {
  id: DrawTool;
  label: string;
  key: string;
  /** SVG path data for the icon (24x24 viewBox) */
  icon: string;
}

/**
 * Tool definitions with SVG icon paths (24x24 viewBox)
 */
export const TOOL_DEFINITIONS: ToolDef[] = [
  {
    id: "select",
    label: "SELECT",
    key: "V",
    // Arrow cursor pointing top-left
    icon: "M5 3L19 12L12 13L15 21L12 22L9 14L5 17V3Z",
  },
  {
    id: "rect",
    label: "RECT",
    key: "R",
    // Rectangle with rounded corners
    icon: "M4 6C4 4.9 4.9 4 6 4H18C19.1 4 20 4.9 20 6V18C20 19.1 19.1 20 18 20H6C4.9 20 4 19.1 4 18V6ZM6 6V18H18V6H6Z",
  },
  {
    id: "ellipse",
    label: "ELLIPSE",
    key: "O",
    // Circle/ellipse
    icon: "M12 4C16.4 4 20 7.6 20 12C20 16.4 16.4 20 12 20C7.6 20 4 16.4 4 12C4 7.6 7.6 4 12 4ZM12 6C8.7 6 6 8.7 6 12C6 15.3 8.7 18 12 18C15.3 18 18 15.3 18 12C18 8.7 15.3 6 12 6Z",
  },
  {
    id: "polygon",
    label: "POLY",
    key: "P",
    // Hexagon/polygon
    icon: "M12 2L21 7V17L12 22L3 17V7L12 2ZM12 4.5L5 8.5V15.5L12 19.5L19 15.5V8.5L12 4.5Z",
  },
  {
    id: "freehand",
    label: "DRAW",
    key: "F",
    // Pencil/pen
    icon: "M3 17.25V21H6.75L17.81 9.94L14.06 6.19L3 17.25ZM20.71 7.04C21.1 6.65 21.1 6.02 20.71 5.63L18.37 3.29C17.98 2.9 17.35 2.9 16.96 3.29L15.13 5.12L18.88 8.87L20.71 7.04Z",
  },
  {
    id: "text",
    label: "TEXT",
    key: "T",
    // Text cursor with T
    icon: "M5 4V7H10.5V19H13.5V7H19V4H5Z",
  },
  {
    id: "text-highlight",
    label: "MARK",
    key: "M",
    // Highlighter marker
    icon: "M15.5 4L19 7.5L8.5 18H5V14.5L15.5 4ZM17.5 8L16 9.5L14.5 8L16 6.5L17.5 8ZM6.5 15L13.5 8L15 9.5L8 16.5L6.5 16.5V15ZM3 20H21V22H3V20Z",
  },
  {
    id: "text-unhighlight",
    label: "ERASE",
    key: "U",
    // Eraser
    icon: "M16.24 3.56L21.19 8.5C21.97 9.29 21.97 10.55 21.19 11.34L12 20.53C10.44 22.09 7.91 22.09 6.34 20.53L2.81 17C2.03 16.21 2.03 14.95 2.81 14.16L13.41 3.56C14.2 2.78 15.46 2.78 16.24 3.56ZM4.22 15.58L7.76 19.11C8.54 19.9 9.8 19.9 10.59 19.11L13 16.7L7.29 11L4.22 14.16C4.03 14.36 4.03 14.68 4.22 14.87V15.58ZM3 22H21V24H3V22Z",
  },
];

export const TOOL_KEYMAP: Record<string, DrawTool> = {
  v: "select",
  r: "rect",
  o: "ellipse",
  p: "polygon",
  f: "freehand",
  t: "text",
  m: "text-highlight",
  u: "text-unhighlight",
};

export const KEYBOARD_SHORTCUTS: Array<[string, string]> = [
  ["V", "Select & move"],
  ["R O P", "Shape tools"],
  ["F", "Freehand draw"],
  ["T", "Add text"],
  ["M", "Text marker"],
  ["U", "Erase marker"],
  ["⌫", "Delete selected"],
  ["⎋", "Cancel / deselect"],
  ["⌘Z", "Undo action"],
];

/** PDF-specific keyboard shortcuts */
export const PDF_KEYBOARD_SHORTCUTS: Array<[string, string]> = [
  ["←/→", "Prev/next page"],
  ["Home", "First page"],
  ["End", "Last page"],
];
