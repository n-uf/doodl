/**
 * Region shape module exports
 */

// Module (self-registers on import)
export { REGION_MODULE } from "./module";

// Render
export { renderRegion } from "./render";

// Hit testing
export { hitTestRegion, hitTestRegionStroke } from "./hit-test";

// Transform
export { getRegionPosition, transformRegion } from "./transform";

// Types and factory
export {
  createRegionShape,
  getRegionBounds,
  type RegionMetadata,
  type RegionShape,
} from "./types";

// Validation
export { isValidRegion } from "./validate";

// Text extraction
export { extractText as extractRegionText } from "./text-extract";
