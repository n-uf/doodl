/**
 * Text Highlight factory and defaults
 */

import type { Bounds } from "../../types/geometry";
import type { ShapeStyle } from "../../types/style";
import { generateShapeId } from "../common/registry";
import type { TextHighlightAnchor, TextHighlightShape } from "./types";

/**
 * Default text highlight style (yellow marker)
 */
export const DEFAULT_TEXT_HIGHLIGHT_STYLE: ShapeStyle = {
  fill: "#FFEB3B",
  fillOpacity: 0.4,
  stroke: "none",
  strokeWidth: 0,
  blendMode: "multiply",
};

/**
 * Create a text highlight shape
 */
export function createTextHighlightShape(
  rects: Bounds[],
  text: string,
  style: ShapeStyle = DEFAULT_TEXT_HIGHLIGHT_STYLE,
  anchor?: TextHighlightAnchor
): TextHighlightShape {
  return {
    id: generateShapeId(),
    type: "text-highlight",
    rects: rects.map((r) => ({ ...r })),
    text,
    style: { ...style },
    anchor,
  };
}

/**
 * Get bounding box of a text highlight (combined bounds of all rects)
 */
export function getTextHighlightBounds(shape: TextHighlightShape): Bounds {
  if (shape.rects.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const rect of shape.rects) {
    minX = Math.min(minX, rect.x);
    minY = Math.min(minY, rect.y);
    maxX = Math.max(maxX, rect.x + rect.width);
    maxY = Math.max(maxY, rect.y + rect.height);
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}
