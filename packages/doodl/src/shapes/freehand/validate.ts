/**
 * Freehand validation
 */

import { hasValidDrawShape, isValidPoint } from "../common/utils/validation";
import type { FreehandShape } from "./types";

/**
 * Validate a freehand shape
 */
export function isValidFreehand(obj: unknown): obj is FreehandShape {
  if (!hasValidDrawShape(obj, "freehand")) return false;

  const shape = obj as FreehandShape;
  const pathModeOk =
    shape.pathMode === undefined ||
    shape.pathMode === "smooth" ||
    shape.pathMode === "linear";
  return (
    Array.isArray(shape.points) &&
    shape.points.every(isValidPoint) &&
    typeof shape.closed === "boolean" &&
    pathModeOk
  );
}
