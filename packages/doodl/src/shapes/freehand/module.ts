/**
 * Freehand shape module - self-registering
 */

import type { Point } from "../../types/geometry";
import { registerShape, type ShapeModule } from "../common/registry";
import { hitTestFreehandFill, hitTestFreehandStroke } from "./hit-test";
import { renderFreehand } from "./render";
import { extractText } from "./text-extract";
import { getFreehandPosition, transformFreehand } from "./transform";
import type { FreehandShape } from "./types";
import { getFreehandBounds } from "./types";
import { isValidFreehand } from "./validate";

/**
 * Freehand shape module - implements ShapeModule interface
 */
export const FREEHAND_MODULE: ShapeModule<FreehandShape> = {
  render: renderFreehand,
  hitTestFill: (point: Point, shape: FreehandShape) =>
    shape.closed ? hitTestFreehandFill(point, shape.points) : false,
  hitTestStroke: (point: Point, shape: FreehandShape, tolerance: number) =>
    hitTestFreehandStroke(
      point,
      shape.points,
      shape.closed,
      shape.style.strokeWidth,
      tolerance
    ),
  getBounds: getFreehandBounds,
  getPosition: getFreehandPosition,
  transform: transformFreehand,
  isValid: isValidFreehand,
  extractText,
  // Capture text on creation/transform for fallback when DOM unavailable
  capturesTextOnTransform: true,
};

// Self-register
registerShape<FreehandShape>("freehand", FREEHAND_MODULE);
