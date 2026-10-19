/**
 * Rectangle validation
 */

import { hasValidDrawShape } from "../common/utils/validation";
import type { RectShape } from "./types";

/**
 * Validate a rectangle shape
 */
export function isValidRect(obj: unknown): obj is RectShape {
  if (!hasValidDrawShape(obj, "rect")) return false;

  const shape = obj as RectShape;
  return (
    typeof shape.x === "number" &&
    typeof shape.y === "number" &&
    typeof shape.width === "number" &&
    typeof shape.height === "number" &&
    !isNaN(shape.x) &&
    !isNaN(shape.y) &&
    !isNaN(shape.width) &&
    !isNaN(shape.height)
  );
}
