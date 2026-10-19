/**
 * Text Highlight shape module
 */

export {
  TextHighlightController,
  createTextHighlightController,
} from "./controller";
export {
  DEFAULT_TEXT_HIGHLIGHT_STYLE,
  createTextHighlightShape,
  getTextHighlightBounds,
} from "./factory";
export { hitTestTextHighlight, hitTestTextHighlightStroke } from "./hit-test";
export {
  highlightShapesOverlap,
  mergeHighlightRects,
  mergeHighlightShapes,
  mergeWithExistingHighlights,
} from "./merge";
export type { HighlightMergeOptions, MergeWithExistingResult } from "./merge";
export {
  eraserOverlapsHighlight,
  subtractFromExistingHighlights,
} from "./subtract";
export type { SubtractOptions, SubtractResult } from "./subtract";
export { TEXT_HIGHLIGHT_MODULE } from "./module";
export {
  DEFAULT_MARKER_SETTINGS,
  markerSettings,
  renderTextHighlight,
  resetMarkerSettings,
  setMarkerSettings,
} from "./render";
export type { MarkerSettings } from "./render";
export { getTextHighlightPosition, transformTextHighlight } from "./transform";
export type { TextHighlightAnchor, TextHighlightShape } from "./types";
export { isValidTextHighlight } from "./validate";
