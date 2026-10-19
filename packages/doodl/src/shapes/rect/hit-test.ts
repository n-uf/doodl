/**
 * Rectangle hit testing
 */

import type { Point, RectShape } from "../../types";
import { DEFAULT_STROKE_TOLERANCE } from "../common/utils/geometry";

/**
 * Test if a point is inside a rectangle
 */
export function hitTestRect(point: Point, rect: RectShape): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}

/**
 * Test if a point is on the stroke of a rectangle
 */
export function hitTestRectStroke(
  point: Point,
  rect: RectShape,
  tolerance: number = DEFAULT_STROKE_TOLERANCE
): boolean {
  const strokeWidth = rect.style.strokeWidth ?? 2;
  const halfStroke = strokeWidth / 2 + tolerance;

  // Check if point is within stroke distance of any edge
  const left = rect.x;
  const right = rect.x + rect.width;
  const top = rect.y;
  const bottom = rect.y + rect.height;

  // Check each edge
  const nearLeft =
    Math.abs(point.x - left) <= halfStroke &&
    point.y >= top - halfStroke &&
    point.y <= bottom + halfStroke;
  const nearRight =
    Math.abs(point.x - right) <= halfStroke &&
    point.y >= top - halfStroke &&
    point.y <= bottom + halfStroke;
  const nearTop =
    Math.abs(point.y - top) <= halfStroke &&
    point.x >= left - halfStroke &&
    point.x <= right + halfStroke;
  const nearBottom =
    Math.abs(point.y - bottom) <= halfStroke &&
    point.x >= left - halfStroke &&
    point.x <= right + halfStroke;

  return nearLeft || nearRight || nearTop || nearBottom;
}
