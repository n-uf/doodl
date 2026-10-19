/**
 * Text extraction for region shapes
 *
 * Region shapes typically have detected text stored in metadata.
 * Falls back to DOM-based extraction if metadata is unavailable.
 */

import type {
  ExtractedText,
  TextExtractionContext,
  TextExtractor,
} from "../common/types/text-extract";
import { extractTextFromBounds } from "../common/utils/text-intersection";
import type { RegionShape } from "./types";

/**
 * Extract text from a region shape
 *
 * Priority:
 * 1. Use metadata.detectedText if available (from document analysis)
 * 2. Use shape.text if available (stored text)
 * 3. Fall back to DOM extraction from rects
 */
export const extractText: TextExtractor<RegionShape> = (
  shape,
  context: TextExtractionContext
): ExtractedText => {
  // Priority 1: Use detected text from metadata
  if (shape.metadata?.detectedText) {
    return {
      content: shape.metadata.detectedText,
      source: "shape-property",
    };
  }

  // Priority 2: Use stored text property
  if (shape.text) {
    return {
      content: shape.text,
      source: "shape-property",
    };
  }

  // Priority 3: Fall back to DOM extraction if text layer available
  if (!context.textLayer) {
    return {
      content: "",
      source: "shape-property",
    };
  }

  // If no rects, return empty
  if (!shape.rects || shape.rects.length === 0) {
    return {
      content: "",
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

  return {
    content: extractedText,
    source: extractedText ? "dom-intersection" : "shape-property",
  };
};
