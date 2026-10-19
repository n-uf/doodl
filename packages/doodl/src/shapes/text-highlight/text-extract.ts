/**
 * Text extraction for text-highlight shapes
 *
 * Uses DOM-based extraction from highlight rects for accuracy.
 * This approach is more reliable than stored text during merge/split operations.
 */

import type {
  ExtractedText,
  TextExtractionContext,
  TextExtractor,
} from "../common/types/text-extract";
import { extractTextFromBounds } from "../common/utils/text-intersection";
import type { TextHighlightShape } from "./types";

/**
 * Extract text from a text-highlight shape
 *
 * Extracts text from DOM using the highlight's rect bounds.
 * Falls back to stored text property if:
 * - No text layer available
 * - Rects are undefined/empty (e.g., unresolved search highlights)
 */
export const extractText: TextExtractor<TextHighlightShape> = (
  shape,
  context: TextExtractionContext
): ExtractedText => {
  // If no text layer, fall back to stored text
  if (!context.textLayer) {
    return {
      content: shape.text,
      source: "shape-property",
    };
  }

  // If no rects (e.g., unresolved search highlight), fall back to stored text
  if (!shape.rects || shape.rects.length === 0) {
    return {
      content: shape.text,
      source: "shape-property",
    };
  }

  // Extract text from each rect and combine
  const textParts: string[] = [];

  for (const rect of shape.rects) {
    const text = extractTextFromBounds(
      context.textLayer,
      rect,
      context.scale,
      context.offset
    );
    if (text.trim()) {
      textParts.push(text.trim());
    }
  }

  const extractedText = textParts.join(" ").replace(/\s+/g, " ").trim();

  // If DOM extraction found text, use it; otherwise fall back to stored text
  if (extractedText) {
    return {
      content: extractedText,
      source: "dom-intersection",
    };
  }

  // Fallback to stored text
  return {
    content: shape.text,
    source: "shape-property",
  };
};
