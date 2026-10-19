/**
 * Polygon validation
 */

import { hasValidDrawShape, isValidPoint } from "../common/utils/validation";
import type { PolygonShape } from "./types";

/**
 * Validate a polygon shape
 */
export function isValidPolygon(obj: unknown): obj is PolygonShape {
  if (!hasValidDrawShape(obj, "polygon")) return false;

  const shape = obj as PolygonShape;
  return Array.isArray(shape.points) && shape.points.every(isValidPoint);
}
