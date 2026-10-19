/**
 * Freehand hit testing
 */

import type { Point } from "../../types";
import {
  DEFAULT_STROKE_TOLERANCE,
  distanceToLineSegment,
} from "../common/utils/geometry";
import { hitTestPolygon } from "../polygon/hit-test";

/**
 * Test if a point is on a freehand path stroke
 */
export function hitTestFreehandStroke(
  point: Point,
  path: Point[],
  closed: boolean,
  strokeWidth: number = 2,
  tolerance: number = DEFAULT_STROKE_TOLERANCE
): boolean {
  if (path.length < 2) return false;

  const halfStroke = strokeWidth / 2 + tolerance;
  const segmentCount = closed ? path.length : path.length - 1;

  for (let i = 0; i < segmentCount; i++) {
    const p1 = path[i]!;
    const p2 = path[(i + 1) % path.length]!;
    const distance = distanceToLineSegment(point, p1, p2);
    if (distance <= halfStroke) {
      return true;
    }
  }

  return false;
}

/**
 * Test if a point is inside a closed freehand path
 * (Uses polygon hit test for closed paths)
 */
export function hitTestFreehandFill(point: Point, path: Point[]): boolean {
  return hitTestPolygon(point, path);
}
