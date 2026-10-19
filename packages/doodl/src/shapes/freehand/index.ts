/**
 * Freehand shape module
 */

export {
  createInkBracketShapes,
  type CreateInkBracketShapesOptions,
  type InkBracketBounds,
  underlineBelowRect,
  type UnderlineAlign,
  type UnderlineBelowRectOptions,
  type UnderlineRect,
} from "./chrome";
export {
  createFreehandController,
  createHighlightController,
  FreehandController,
} from "./controller";
export { hitTestFreehandFill, hitTestFreehandStroke } from "./hit-test";
export { FREEHAND_MODULE } from "./module";
export { renderFreehand } from "./render";
export {
  DEFAULT_EPSILON,
  getPathLength,
  resamplePath,
  simplifyPath,
  simplifyPathWithMinPoints,
  smoothPath,
} from "./simplification";
export { getFreehandPosition, transformFreehand } from "./transform";
export {
  createFreehandShape,
  createPolylineShape,
  getFreehandBounds,
} from "./types";
export type { FreehandPathMode, FreehandShape } from "./types";
export { isValidFreehand } from "./validate";
