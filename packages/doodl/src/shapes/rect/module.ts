/**
 * Rectangle shape module - self-registering
 */

import { registerShape, type ShapeModule } from "../common/registry";
import { hitTestRect, hitTestRectStroke } from "./hit-test";
import { renderRect } from "./render";
import { extractText } from "./text-extract";
import { getRectPosition, transformRect } from "./transform";
import type { RectShape } from "./types";
import { getRectBounds } from "./types";
import { isValidRect } from "./validate";

/**
 * Rect shape module - implements ShapeModule interface
 */
export const RECT_MODULE: ShapeModule<RectShape> = {
  render: renderRect,
  hitTestFill: hitTestRect,
  hitTestStroke: hitTestRectStroke,
  getBounds: getRectBounds,
  getPosition: getRectPosition,
  transform: transformRect,
  isValid: isValidRect,
  extractText,
  // Capture text on creation/transform for fallback when DOM unavailable
  capturesTextOnTransform: true,
};

// Self-register
registerShape<RectShape>("rect", RECT_MODULE);
