/**
 * Text Highlight transformation
 */

import type { Point } from "../../types/geometry";
import { getTextHighlightBounds } from "./factory";
import type { TextHighlightShape } from "./types";

/**
 * Get the position of a text highlight (top-left of combined bounds)
 */
export function getTextHighlightPosition(shape: TextHighlightShape): Point {
  const bounds = getTextHighlightBounds(shape);
  return { x: bounds.x, y: bounds.y };
}

/**
 * Transform a text highlight by a delta
 * Transforms all rects by the same delta
 */
export function transformTextHighlight(
  shape: TextHighlightShape,
  delta: Point
): TextHighlightShape {
  return {
    ...shape,
    rects: shape.rects.map((rect) => ({
      x: rect.x + delta.x,
      y: rect.y + delta.y,
      width: rect.width,
      height: rect.height,
    })),
    // Clear anchor since position has changed
    anchor: undefined,
  };
}
