/**
 * Common utilities
 */

// Canvas
export {
  applyStyle,
  clearCanvas,
  configureCanvasForHighDPI,
  configureSharpRendering,
  fillBackground,
  getDevicePixelRatio,
  getOptimizedContext,
  GPU_OPTIMIZED_CONTEXT_OPTIONS,
  mapBlendMode,
  resetStyle,
  snapRectToDevicePixels,
  snapRectToPixel,
  snapToPixel,
  snapToPixelFloor,
} from "./canvas";

export type { CanvasContextOptions } from "./canvas";
export type { RectGeom } from "./stroke";
export type { ShapeRenderContext } from "./render-context";

// Stroke / screen-space / alignment
export {
  alignedEllipseRadii,
  alignedStrokeRect,
  applyShapeShadow,
  applyStrokePaint,
  inflateRect,
  resolveStyleLength,
  styleRenderPadding,
} from "./stroke";

// Per-frame render context
export {
  getShapeRenderContext,
  runWithShapeRenderContext,
  setShapeRenderContext,
} from "./render-context";

// Geometry
export {
  boundsToEllipse,
  calculateDrawingBounds,
  DEFAULT_STROKE_TOLERANCE,
  distanceBetweenPoints,
  distanceToLineSegment,
  isPointInBounds,
  mergeBounds,
} from "./geometry";

// Validation
export { hasValidDrawShape, isValidPoint, isValidStyle } from "./validation";

// Text intersection
export {
  boundsContain,
  boundsIntersect,
  extractTextFromBounds,
  findIntersectingText,
  findIntersectingTextSorted,
  getIntersectionArea,
  getTextFromSpans,
  getTextNodes,
  hasTextInBounds,
} from "./text-intersection";
export type { IntersectionMode, TextNodeInfo } from "./text-intersection";

// Text bounds finder (reverse of text-intersection: text → bounds)
export {
  findTextInTextLayer,
  hasTextInTextLayer,
} from "./text-bounds-finder";
export type {
  FindTextOptions,
  TextMatch,
  TextMatchMode,
} from "./text-bounds-finder";
