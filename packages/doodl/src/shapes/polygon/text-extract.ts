/**
 * Text extraction for polygon shapes
 *
 * Polygons use DOM intersection to find text within their bounding box.
 */

import type {
  ExtractedText,
  TextExtractionContext,
  TextExtractor,
} from "../common/types/text-extract";
import { extractTextFromBounds } from "../common/utils/text-intersection";
import { getPolygonBounds, type PolygonShape } from "./types";

/**
 * Extract text from a polygon shape
 *
 * Finds text in the DOM text layer that intersects with the polygon's bounding box.
 * Note: Uses rectangular bounds, not precise polygon intersection.
 */
export const extractText: TextExtractor<PolygonShape> = (
  shape,
  context: TextExtractionContext
): ExtractedText => {
  if (!context.textLayer) {
    return { content: "", source: "none" };
  }

  const bounds = getPolygonBounds(shape);

  // Handle empty polygon
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

