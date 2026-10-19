/**
 * Ellipse transformation
 */

import type { EllipseShape, Point } from "../../types";

/**
 * Transform an ellipse by delta
 */
export function transformEllipse(
  ellipse: EllipseShape,
  delta: Point
): EllipseShape {
  return {
    ...ellipse,
    cx: ellipse.cx + delta.x,
    cy: ellipse.cy + delta.y,
  };
}

/**
 * Get position of an ellipse (center)
 */
export function getEllipsePosition(ellipse: EllipseShape): Point {
  return { x: ellipse.cx, y: ellipse.cy };
}
