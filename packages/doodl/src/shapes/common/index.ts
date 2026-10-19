/**
 * Common shape utilities
 */

// =============================================================================
// TYPES
// =============================================================================

export type {
  ControllerAction,
  ControllerContext,
  DrawShape,
  DrawingController,
  ExtractedText,
  HitTestResult,
  MultiClickController,
  ShapeCreationBehavior,
  ShapeCreationMode,
  ShapeEditMode,
  ShapeEditState,
  ShapeModule,
  TextExtractionContext,
  TextExtractor,
  TextSource,
} from "./types";

export { DEFAULT_CREATION_BEHAVIOR, EMPTY_EXTRACTED_TEXT } from "./types";

// =============================================================================
// UTILS (pure functions)
// =============================================================================

export {
  DEFAULT_STROKE_TOLERANCE,
  // Canvas
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
  // Stroke helpers / render context
  alignedEllipseRadii,
  alignedStrokeRect,
  applyShapeShadow,
  applyStrokePaint,
  getShapeRenderContext,
  inflateRect,
  resolveStyleLength,
  runWithShapeRenderContext,
  setShapeRenderContext,
  styleRenderPadding,
  // Geometry
  boundsToEllipse,
  calculateDrawingBounds,
  distanceBetweenPoints,
  distanceToLineSegment,
  // Validation
  hasValidDrawShape,
  isPointInBounds,
  isValidPoint,
  isValidStyle,
  mergeBounds,
  // Text intersection (bounds → text)
  boundsContain,
  boundsIntersect,
  extractTextFromBounds,
  findIntersectingText,
  findIntersectingTextSorted,
  getIntersectionArea,
  getTextFromSpans,
  getTextNodes,
  hasTextInBounds,
  // Text bounds finder (text → bounds)
  findTextInTextLayer,
  hasTextInTextLayer,
} from "./utils";

export type {
  CanvasContextOptions,
  FindTextOptions,
  IntersectionMode,
  RectGeom,
  ShapeRenderContext,
  TextMatch,
  TextMatchMode,
  TextNodeInfo,
} from "./utils";

// =============================================================================
// REGISTRY (shape type → module mapping)
// =============================================================================

export {
  generateShapeId,
  getShapeCreationBehavior,
  getShapeModule,
  getShapeModuleByType,
  getShapeTypes,
  isShapeType,
  registerShape,
} from "./registry";

// =============================================================================
// DISPATCH (unified shape operations)
// =============================================================================

export {
  enforceShapeBounds,
  extractShapeText,
  findShapesAtPoint,
  findTopmostShapeAtPoint,
  getShapeBounds,
  getShapePosition,
  hitTestShape,
  isPointInShape,
  isValidShape,
  renderShape,
  // Shape-centric edit mode & selection rendering
  renderShapeEditMode,
  renderShapeSelection,
  renderShapes,
  shapeSupportsEditMode,
  // Shape capability checks
  shapeWantsCapturedText,
  transformShape,
  // Behavior-aware rendering
  renderShapeWithBehavior,
  renderShapesWithBehavior,
  sortShapesByBehavior,
  // Behavior filtering
  filterDeletableShapes,
  filterEditableShapes,
  filterPersistedShapes,
  filterSelectableShapes,
  filterTrackedShapes,
  // Behavior checks (per-shape)
  isShapeDeletable,
  isShapeEditable,
  isShapeSelectable,
} from "./dispatch";

// =============================================================================
// CONTROLLERS (drawing interaction)
// =============================================================================

export {
  BaseController,
  NO_ACTION,
  isMultiClickController,
} from "./controllers";
