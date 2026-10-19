/**
 * Ellipse shape module - self-registering
 */

import { registerShape, type ShapeModule } from "../common/registry";
import { hitTestEllipse, hitTestEllipseStroke } from "./hit-test";
import { renderEllipse } from "./render";
import { extractText } from "./text-extract";
import { getEllipsePosition, transformEllipse } from "./transform";
import type { EllipseShape } from "./types";
import { getEllipseBounds } from "./types";
import { isValidEllipse } from "./validate";

/**
 * Ellipse shape module - implements ShapeModule interface
 */
export const ELLIPSE_MODULE: ShapeModule<EllipseShape> = {
  render: renderEllipse,
  hitTestFill: hitTestEllipse,
  hitTestStroke: hitTestEllipseStroke,
  getBounds: getEllipseBounds,
  getPosition: getEllipsePosition,
  transform: transformEllipse,
  isValid: isValidEllipse,
  extractText,
  // Capture text on creation/transform for fallback when DOM unavailable
  capturesTextOnTransform: true,
};

// Self-register
registerShape<EllipseShape>("ellipse", ELLIPSE_MODULE);
