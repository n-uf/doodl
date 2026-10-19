/**
 * Region shape hit testing
 */

import type { Point } from "../../types/geometry";
import { isPointInBounds } from "../common/utils/geometry";
import type { RegionShape } from "./types";

/**
 * Test if a point is inside any of the region rects (fill)
 */
export function hitTestRegion(point: Point, shape: RegionShape): boolean {
  for (const rect of shape.rects) {
    if (isPointInBounds(point, rect)) {
      return true;
    }
  }
  return false;
}

/**
 * Test if a point is on the stroke of any region rect
 */
export function hitTestRegionStroke(
  point: Point,
  shape: RegionShape,
  tolerance: number
): boolean {
  for (const rect of shape.rects) {
    // Check if point is near the edges of the rect
    const nearLeft =
      Math.abs(point.x - rect.x) <= tolerance &&
      point.y >= rect.y - tolerance &&
      point.y <= rect.y + rect.height + tolerance;

    const nearRight =
      Math.abs(point.x - (rect.x + rect.width)) <= tolerance &&
      point.y >= rect.y - tolerance &&
      point.y <= rect.y + rect.height + tolerance;

    const nearTop =
      Math.abs(point.y - rect.y) <= tolerance &&
      point.x >= rect.x - tolerance &&
      point.x <= rect.x + rect.width + tolerance;

    const nearBottom =
      Math.abs(point.y - (rect.y + rect.height)) <= tolerance &&
      point.x >= rect.x - tolerance &&
      point.x <= rect.x + rect.width + tolerance;

    if (nearLeft || nearRight || nearTop || nearBottom) {
      return true;
    }
  }
  return false;
}
