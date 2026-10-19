/**
 * Text shape module - self-registering
 */

import { registerShape, type ShapeModule } from "../common/registry";
import { hitTestText, hitTestTextStroke } from "./hit-test";
import { renderText } from "./render";
import { extractText } from "./text-extract";
import { getTextPosition, transformText } from "./transform";
import { getTextBounds, type TextShape } from "./types";
import { isValidText } from "./validate";

/**
 * Text shape module - implements ShapeModule interface
 */
export const TEXT_MODULE: ShapeModule<TextShape> = {
  render: renderText,
  hitTestFill: hitTestText,
  hitTestStroke: hitTestTextStroke,
  getBounds: getTextBounds,
  getPosition: getTextPosition,
  transform: transformText,
  isValid: isValidText,
  extractText,
};

// Self-register
registerShape<TextShape>("text", TEXT_MODULE);
