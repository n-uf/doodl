/**
 * Region shape transformation
 */

import type { Point } from "../../types/geometry";
import type { RegionShape } from "./types";
import { getRegionBounds } from "./types";

/**
 * Get the position of a region (top-left of combined bounds)
 */
export function getRegionPosition(shape: RegionShape): Point {
  const bounds = getRegionBounds(shape);
  return { x: bounds.x, y: bounds.y };
}

/**
 * Transform a region by a delta
 * Transforms all rects by the same delta
 */
export function transformRegion(shape: RegionShape, delta: Point): RegionShape {
  return {
    ...shape,
    rects: shape.rects.map((rect) => ({
      x: rect.x + delta.x,
      y: rect.y + delta.y,
      width: rect.width,
      height: rect.height,
    })),
  };
}
