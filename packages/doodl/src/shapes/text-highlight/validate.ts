/**
 * Text Highlight validation
 */

import { isValidStyle } from "../common/utils/validation";
import type { TextHighlightShape } from "./types";

/**
 * Validate a text highlight shape
 */
export function isValidTextHighlight(obj: unknown): obj is TextHighlightShape {
  if (typeof obj !== "object" || obj === null) return false;

  const shape = obj as Record<string, unknown>;

  // Type check
  if (shape.type !== "text-highlight") return false;

  // ID check
  if (typeof shape.id !== "string" || shape.id.length === 0) return false;

  // Rects check
  if (!Array.isArray(shape.rects)) return false;
  for (const rect of shape.rects) {
    if (!isValidRect(rect)) return false;
  }

  // Text check
  if (typeof shape.text !== "string") return false;

  // Style check
  if (!isValidStyle(shape.style)) return false;

  return true;
}

/**
 * Validate a bounds/rect object
 */
function isValidRect(obj: unknown): boolean {
  if (typeof obj !== "object" || obj === null) return false;

  const rect = obj as Record<string, unknown>;

  return (
    typeof rect.x === "number" &&
    typeof rect.y === "number" &&
    typeof rect.width === "number" &&
    typeof rect.height === "number" &&
    isFinite(rect.x) &&
    isFinite(rect.y) &&
    isFinite(rect.width) &&
    isFinite(rect.height) &&
    rect.width >= 0 &&
    rect.height >= 0
  );
}
