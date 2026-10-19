/**
 * Polygon hit testing
 */

import type { Point } from "../../types";
import {
  DEFAULT_STROKE_TOLERANCE,
  distanceToLineSegment,
} from "../common/utils/geometry";

/**
 * Test if a point is inside a polygon using ray casting algorithm
 */
export function hitTestPolygon(point: Point, vertices: Point[]): boolean {
  if (vertices.length < 3) return false;

  let inside = false;
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    const xi = vertices[i]!.x;
    const yi = vertices[i]!.y;
    const xj = vertices[j]!.x;
    const yj = vertices[j]!.y;

    if (
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi
    ) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * Test if a point is on the stroke of a polygon
 */
export function hitTestPolygonStroke(
  point: Point,
  vertices: Point[],
  strokeWidth: number = 2,
  tolerance: number = DEFAULT_STROKE_TOLERANCE
): boolean {
  if (vertices.length < 2) return false;

  const halfStroke = strokeWidth / 2 + tolerance;

  for (let i = 0; i < vertices.length; i++) {
    const p1 = vertices[i]!;
    const p2 = vertices[(i + 1) % vertices.length]!;
    const distance = distanceToLineSegment(point, p1, p2);
    if (distance <= halfStroke) {
      return true;
    }
  }

  return false;
}
