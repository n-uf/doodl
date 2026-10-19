/**
 * Polygon transformation
 */

import type { Point, PolygonShape } from "../../types";

/**
 * Transform a polygon by delta
 */
export function transformPolygon(
  polygon: PolygonShape,
  delta: Point
): PolygonShape {
  return {
    ...polygon,
    points: polygon.points.map((p) => ({
      x: p.x + delta.x,
      y: p.y + delta.y,
    })),
  };
}

/**
 * Get position of a polygon (first point)
 */
export function getPolygonPosition(polygon: PolygonShape): Point {
  return polygon.points[0] ? { ...polygon.points[0] } : { x: 0, y: 0 };
}
