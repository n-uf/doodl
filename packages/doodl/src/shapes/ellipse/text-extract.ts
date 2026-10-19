/**
 * Text extraction for ellipse shapes
 *
 * Ellipses use DOM intersection to find text within their bounding box.
 */

import type {
  ExtractedText,
  TextExtractionContext,
  TextExtractor,
} from "../common/types/text-extract";
import { extractTextFromBounds } from "../common/utils/text-intersection";
import { getEllipseBounds, type EllipseShape } from "./types";

/**
 * Extract text from an ellipse shape
 *
 * Finds text in the DOM text layer that intersects with the ellipse's bounding box.
 * Note: Uses rectangular bounds, not precise ellipse intersection.
 */
export const extractText: TextExtractor<EllipseShape> = (
  shape,
  context: TextExtractionContext
): ExtractedText => {
  if (!context.textLayer) {
    return { content: "", source: "none" };
  }

  const bounds = getEllipseBounds(shape);
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

