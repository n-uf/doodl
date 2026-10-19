/**
 * Text validation
 */

import { hasValidDrawShape } from "../common/utils/validation";
import type { TextShape } from "./types";

/**
 * Validate text shape
 */
export function isValidText(obj: unknown): obj is TextShape {
  if (!hasValidDrawShape(obj, "text")) return false;

  const text = obj as TextShape;

  // Required fields
  if (typeof text.text !== "string") return false;
  if (typeof text.x !== "number" || isNaN(text.x)) return false;
  if (typeof text.y !== "number" || isNaN(text.y)) return false;
  if (typeof text.fontSize !== "number" || text.fontSize <= 0) return false;
  if (typeof text.fontFamily !== "string" || text.fontFamily.length === 0)
    return false;

  // Optional fields
  if (text.fontWeight !== undefined) {
    if (
      typeof text.fontWeight !== "string" &&
      typeof text.fontWeight !== "number"
    ) {
      return false;
    }
  }

  if (text.fontStyle !== undefined) {
    if (text.fontStyle !== "normal" && text.fontStyle !== "italic") {
      return false;
    }
  }

  if (text.textAlign !== undefined) {
    if (!["left", "center", "right"].includes(text.textAlign)) {
      return false;
    }
  }

  if (text.textBaseline !== undefined) {
    if (!["top", "middle", "bottom"].includes(text.textBaseline)) {
      return false;
    }
  }

  if (text.maxWidth !== undefined) {
    if (typeof text.maxWidth !== "number" || text.maxWidth <= 0) {
      return false;
    }
  }

  if (text.rotation !== undefined) {
    if (typeof text.rotation !== "number" || isNaN(text.rotation)) {
      return false;
    }
  }

  return true;
}
