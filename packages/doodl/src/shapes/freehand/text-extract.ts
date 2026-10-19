/**
 * Text extraction for freehand shapes
 *
 * Freehand paths use DOM intersection to find text within their bounding box.
 */

import type {
  ExtractedText,
  TextExtractionContext,
  TextExtractor,
} from "../common/types/text-extract";
import { extractTextFromBounds } from "../common/utils/text-intersection";
import { getFreehandBounds, type FreehandShape } from "./types";

/**
 * Extract text from a freehand shape
 *
 * Finds text in the DOM text layer that intersects with the path's bounding box.
 * Note: Uses rectangular bounds, not precise path intersection.
 */
export const extractText: TextExtractor<FreehandShape> = (
  shape,
  context: TextExtractionContext
): ExtractedText => {
  if (!context.textLayer) {
    return { content: "", source: "none" };
  }

  const bounds = getFreehandBounds(shape);

  // Handle empty path
  if (bounds.width === 0 || bounds.height === 0) {
    return { content: "", source: "none" };
  }

  const text = extractTextFromBounds(
    context.textLayer,
    bounds,
    context.scale,
    context.offset
  );

  if (!text) {
    return { content: "", source: "none" };
  }

  return {
    content: text,
    source: "dom-intersection",
    partial: true,
  };
};

