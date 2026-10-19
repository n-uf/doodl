/**
 * Region shape module - self-registering
 *
 * Handles detected document regions (handwriting, stamps, signatures, etc.)
 */

import { registerShape, type ShapeModule } from "../common/registry";
import { hitTestRegion, hitTestRegionStroke } from "./hit-test";
import { renderRegion } from "./render";
import { extractText } from "./text-extract";
import { getRegionPosition, transformRegion } from "./transform";
import type { RegionShape } from "./types";
import { getRegionBounds } from "./types";
import { isValidRegion } from "./validate";

/**
 * Region shape module - implements ShapeModule interface
 */
export const REGION_MODULE: ShapeModule<RegionShape> = {
  // Rendering
  render: renderRegion,

  // Hit testing
  hitTestFill: hitTestRegion,
  hitTestStroke: hitTestRegionStroke,

  // Geometry
  getBounds: getRegionBounds,
  getPosition: getRegionPosition,
  transform: transformRegion,

  // Validation
  isValid: isValidRegion,

  // Text extraction
  extractText,

  // Region shapes don't capture text on transform (they use metadata.detectedText)
  capturesTextOnTransform: false,
};

// Self-register
registerShape<RegionShape>("region", REGION_MODULE);
