/**
 * Ellipse validation
 */

import { hasValidDrawShape } from "../common/utils/validation";
import type { EllipseShape } from "./types";

/**
 * Validate an ellipse shape
 */
export function isValidEllipse(obj: unknown): obj is EllipseShape {
  if (!hasValidDrawShape(obj, "ellipse")) return false;

  const shape = obj as EllipseShape;
  return (
    typeof shape.cx === "number" &&
    typeof shape.cy === "number" &&
    typeof shape.rx === "number" &&
    typeof shape.ry === "number" &&
    !isNaN(shape.cx) &&
    !isNaN(shape.cy) &&
    !isNaN(shape.rx) &&
    !isNaN(shape.ry)
  );
}
