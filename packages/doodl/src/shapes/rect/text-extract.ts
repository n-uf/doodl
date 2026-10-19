/**
 * Text extraction for rectangle shapes
 *
 * Rectangles use DOM intersection to find text within their bounds.
 * Falls back to stored text property when DOM extraction fails.
 */

import type {
  ExtractedText,
  TextExtractionContext,
  TextExtractor,
} from "../common/types/text-extract";
import { extractTextFromBounds } from "../common/utils/text-intersection";
import { getRectBounds, type RectShape } from "./types";

/**
 * Extract text from a rectangle shape
 *
 * Finds text in the DOM text layer that intersects with the rectangle bounds.
 * Falls back to stored text property only when text layer is unavailable.
 *
 * When text layer IS available, always returns "dom-intersection" source,
 * even if empty (valid signal for blank zones).
 */
export const extractText: TextExtractor<RectShape> = (
  shape,
  context: TextExtractionContext
): ExtractedText => {
  // If no text layer, fall back to stored text
  if (!context.textLayer) {
    if (shape.text) {
      return { content: shape.text, source: "shape-property" };
    }
    return { content: "", source: "none" };
  }

  // Text layer available - always use DOM extraction result
  // Empty string is valid (shape over blank zone)
  const bounds = getRectBounds(shape);
  const text = extractTextFromBounds(
    context.textLayer,
    bounds,
    context.scale,
    context.offset
  );

  return {
    content: text,
    source: "dom-intersection",
    partial: true,
  };
};

