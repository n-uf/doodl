/**
 * Text Highlight shape module - self-registering
 */

import { registerShape, type ShapeModule } from "../common/registry";
import { getTextHighlightBounds } from "./factory";
import { hitTestTextHighlight, hitTestTextHighlightStroke } from "./hit-test";
import { renderTextHighlight } from "./render";
import { extractText } from "./text-extract";
import { getTextHighlightPosition, transformTextHighlight } from "./transform";
import type { TextHighlightShape } from "./types";
import { isValidTextHighlight } from "./validate";

/**
 * Text Highlight shape module - implements ShapeModule interface
 *
 * Creation behavior:
 * - Uses DOM text selection (not canvas drawing)
 * - Requires text layer for selection events
 * - Canvas must be transparent to pointer events during creation
 */
export const TEXT_HIGHLIGHT_MODULE: ShapeModule<TextHighlightShape> = {
  // Rendering
  render: renderTextHighlight,

  // Hit testing
  hitTestFill: hitTestTextHighlight,
  hitTestStroke: hitTestTextHighlightStroke,

  // Geometry
  getBounds: getTextHighlightBounds,
  getPosition: getTextHighlightPosition,
  transform: transformTextHighlight,

  // Validation
  isValid: isValidTextHighlight,

  // Text extraction
  extractText,

  // Creation behavior - text selection mode
  creation: {
    mode: "text-selection",
    requiresTextLayer: true,
    canvasPointerEvents: "none", // Allow text selection through canvas
  },
};

// Self-register
registerShape<TextHighlightShape>("text-highlight", TEXT_HIGHLIGHT_MODULE);
