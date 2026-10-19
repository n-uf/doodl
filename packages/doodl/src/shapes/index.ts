/**
 * Shapes module - Re-export catalog
 */

export { registerBuiltinShapes } from "./register-builtins";

// =============================================================================
// COMMON (types, utils, registry, dispatch, controllers)
// =============================================================================

export {
  // Stroke / screen-space / alignment
  alignedEllipseRadii,
  alignedStrokeRect,
  applyShapeShadow,
  applyStrokePaint,
  applyStyle,
  BaseController,
  // Text intersection utilities (bounds → text)
  boundsContain,
  boundsIntersect,
  boundsToEllipse,
  calculateDrawingBounds,
  clearCanvas,
  // Canvas configuration
  configureCanvasForHighDPI,
  configureSharpRendering,
  DEFAULT_STROKE_TOLERANCE,
  distanceBetweenPoints,
  distanceToLineSegment,
  EMPTY_EXTRACTED_TEXT,
  enforceShapeBounds,
  // Text extraction dispatch
  extractShapeText,
  extractTextFromBounds,
  fillBackground,
  // Behavior filtering
  filterDeletableShapes,
  filterEditableShapes,
  filterPersistedShapes,
  filterSelectableShapes,
  filterTrackedShapes,
  findIntersectingText,
  findIntersectingTextSorted,
  findShapesAtPoint,
  // Text bounds finder (text → bounds)
  findTextInTextLayer,
  findTopmostShapeAtPoint,
  generateShapeId,
  // DPR utilities
  getDevicePixelRatio,
  getIntersectionArea,
  getOptimizedContext,
  getShapeBounds,
  getShapeModule,
  getShapeModuleByType,
  getShapePosition,
  getShapeRenderContext,
  getShapeTypes,
  getTextFromSpans,
  getTextNodes,
  GPU_OPTIMIZED_CONTEXT_OPTIONS,
  hasTextInBounds,
  hasTextInTextLayer,
  hasValidDrawShape,
  hitTestShape,
  inflateRect,
  isMultiClickController,
  isPointInBounds,
  isPointInShape,
  // Behavior checks (per-shape)
  isShapeDeletable,
  isShapeEditable,
  isShapeSelectable,
  isShapeType,
  isValidPoint,
  isValidShape,
  isValidStyle,
  mapBlendMode,
  mergeBounds,
  NO_ACTION,
  registerShape,
  renderShape,
  // Shape-centric edit mode & selection rendering
  renderShapeEditMode,
  renderShapes,
  renderShapeSelection,
  renderShapesWithBehavior,
  // Behavior-aware rendering
  renderShapeWithBehavior,
  resetStyle,
  resolveStyleLength,
  runWithShapeRenderContext,
  setShapeRenderContext,
  shapeSupportsEditMode,
  // Shape capability checks
  shapeWantsCapturedText,
  // Pixel snapping
  snapRectToDevicePixels,
  snapRectToPixel,
  snapToPixel,
  snapToPixelFloor,
  sortShapesByBehavior,
  styleRenderPadding,
  transformShape,
} from "./common";

export type {
  CanvasContextOptions,
  ControllerAction,
  ControllerContext,
  DrawingController,
  DrawShape,
  ExtractedText,
  FindTextOptions,
  HitTestResult,
  IntersectionMode,
  MultiClickController,
  RectGeom,
  ShapeEditMode,
  ShapeEditState,
  ShapeModule,
  ShapeRenderContext,
  TextExtractionContext,
  TextExtractor,
  TextMatch,
  TextNodeInfo,
  TextSource,
} from "./common";

// =============================================================================
// RECT
// =============================================================================

export {
  createRectController,
  createRectShape,
  getRectBounds,
  getRectPosition,
  hitTestRect,
  hitTestRectStroke,
  isRectShape,
  isValidRect,
  RectController,
  renderRect,
  transformRect,
} from "./rect";
export type { RectShape } from "./rect";

// =============================================================================
// ELLIPSE
// =============================================================================

export {
  createEllipseController,
  createEllipseShape,
  EllipseController,
  getEllipseBounds,
  getEllipsePosition,
  hitTestEllipse,
  hitTestEllipseStroke,
  isValidEllipse,
  renderEllipse,
  transformEllipse,
} from "./ellipse";
export type { EllipseShape } from "./ellipse";

// =============================================================================
// POLYGON
// =============================================================================

export {
  createPolygonController,
  createPolygonShape,
  getPolygonBounds,
  getPolygonPosition,
  hitTestPolygon,
  hitTestPolygonStroke,
  isValidPolygon,
  PolygonController,
  renderPolygon,
  transformPolygon,
} from "./polygon";
export type { PolygonShape } from "./polygon";

// =============================================================================
// FREEHAND
// =============================================================================

export {
  createFreehandController,
  createFreehandShape,
  createHighlightController,
  createInkBracketShapes,
  createPolylineShape,
  DEFAULT_EPSILON,
  FreehandController,
  getFreehandBounds,
  getFreehandPosition,
  getPathLength,
  hitTestFreehandFill,
  hitTestFreehandStroke,
  isValidFreehand,
  renderFreehand,
  resamplePath,
  simplifyPath,
  simplifyPathWithMinPoints,
  smoothPath,
  transformFreehand,
  underlineBelowRect,
} from "./freehand";
export type {
  CreateInkBracketShapesOptions,
  FreehandPathMode,
  FreehandShape,
  InkBracketBounds,
  UnderlineAlign,
  UnderlineBelowRectOptions,
  UnderlineRect,
} from "./freehand";

// =============================================================================
// TEXT
// =============================================================================

export {
  buildFontString,
  createTextController,
  createTextShape,
  DEFAULT_FONT_FAMILY,
  DEFAULT_FONT_SIZE,
  DEFAULT_TEXT_STYLE,
  getTextBounds,
  getTextPosition,
  hitTestText,
  hitTestTextStroke,
  isValidText,
  measureTextWidth,
  renderText,
  TEXT_MODULE,
  TextController,
  transformText,
} from "./text";
export type {
  TextAlign,
  TextBaseline,
  TextControllerOptions,
  TextShape,
} from "./text";

// =============================================================================
// TEXT HIGHLIGHT
// =============================================================================

export {
  createTextHighlightController,
  createTextHighlightShape,
  DEFAULT_MARKER_SETTINGS,
  DEFAULT_TEXT_HIGHLIGHT_STYLE,
  getTextHighlightBounds,
  getTextHighlightPosition,
  highlightShapesOverlap,
  hitTestTextHighlight,
  hitTestTextHighlightStroke,
  isValidTextHighlight,
  markerSettings,
  mergeHighlightRects,
  mergeHighlightShapes,
  mergeWithExistingHighlights,
  renderTextHighlight,
  resetMarkerSettings,
  setMarkerSettings,
  TEXT_HIGHLIGHT_MODULE,
  TextHighlightController,
  transformTextHighlight,
} from "./text-highlight";
export type {
  HighlightMergeOptions,
  MarkerSettings,
  MergeWithExistingResult,
  TextHighlightAnchor,
  TextHighlightShape,
} from "./text-highlight";

// =============================================================================
// REGION (detected document regions)
// =============================================================================

export {
  createRegionShape,
  extractRegionText,
  getRegionBounds,
  getRegionPosition,
  hitTestRegion,
  hitTestRegionStroke,
  isValidRegion,
  REGION_MODULE,
  renderRegion,
  transformRegion,
} from "./region";
export type { RegionMetadata, RegionShape } from "./region";

// =============================================================================
// SELECT (selection controller + UI)
// =============================================================================

export {
  // Vertex editing
  addVertexAtEdge,
  // Transform
  applyScale,
  applyTransform,
  applyTransformToShapes,
  applyTranslate,
  calculateScale,
  calculateTranslate,
  // Controller
  createSelectController,
  createVertexEditState,
  deleteVertex,
  EDGE_HIT_TOLERANCE,
  // Selection UI
  getCombinedBounds,
  getHandleCursor,
  getHandlePositions,
  HANDLE_BORDER_COLOR,
  HANDLE_BORDER_WIDTH,
  HANDLE_FILL_COLOR,
  HANDLE_SIZE,
  hitTestEdge,
  hitTestHandle,
  hitTestVertex,
  isVertexEditable,
  moveVertex,
  renderEdgeMidpoints,
  renderHandlesForBounds,
  renderMultiSelection,
  renderSelection,
  renderSelectionBounds,
  renderSelectionHandles,
  renderSelectionOutline,
  renderVertexEditOverlay,
  renderVertexHandles,
  SelectController,
  SELECTION_OUTLINE_COLOR,
  SELECTION_OUTLINE_DASH,
  SELECTION_OUTLINE_WIDTH,
  VERTEX_HANDLE_ACTIVE,
  VERTEX_HANDLE_BORDER,
  VERTEX_HANDLE_FILL,
  VERTEX_HANDLE_SIZE,
  VERTEX_HIT_TOLERANCE,
} from "./select";
export type {
  EdgeHitResult,
  HandlePosition,
  Transform,
  TransformOrigin,
  TransformState,
  TransformType,
  VertexEditState,
  VertexHitResult,
} from "./select";
