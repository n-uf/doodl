/**
 * Rectangle transformation
 */

import type { Point, RectShape } from "../../types";

/**
 * Transform a rectangle by delta
 */
export function transformRect(rect: RectShape, delta: Point): RectShape {
  return {
    ...rect,
    x: rect.x + delta.x,
    y: rect.y + delta.y,
  };
}

/**
 * Get position of a rectangle (top-left corner)
 */
export function getRectPosition(rect: RectShape): Point {
  return { x: rect.x, y: rect.y };
}
