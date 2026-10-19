/**
 * Freehand transformation
 */

import type { FreehandShape, Point } from "../../types";

/**
 * Transform a freehand path by delta
 */
export function transformFreehand(
  freehand: FreehandShape,
  delta: Point
): FreehandShape {
  return {
    ...freehand,
    points: freehand.points.map((p) => ({
      x: p.x + delta.x,
      y: p.y + delta.y,
    })),
  };
}

/**
 * Get position of a freehand path (first point)
 */
export function getFreehandPosition(freehand: FreehandShape): Point {
  return freehand.points[0] ? { ...freehand.points[0] } : { x: 0, y: 0 };
}
