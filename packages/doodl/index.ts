/**
 * @n-uf/doodl - Canvas drawing and annotation library
 *
 * Shape-centric architecture: each shape type has its own module with
 * rendering, hit-testing, handlers, and movement logic.
 */

// Register first-party shapes before any consumer can call setShapes/getShapeModule.
import { registerBuiltinShapes } from "./src/shapes/register-builtins";
registerBuiltinShapes();
export { registerBuiltinShapes } from "./src/shapes/register-builtins";

// =============================================================================
// TYPES
// =============================================================================

// Geometry
export type { Bounds, Point, Size } from "./src/types/geometry";

// Bounds Policy
export {
  calculateConstrainDelta,
  calculateOverflow,
} from "./src/types/bounds-policy";
export type {
  BoundsEnforcementResult,
  BoundsOverflow,
  BoundsPolicy,
  CanvasBounds,
} from "./src/types/bounds-policy";

// Style
export {
  ANNOTATION_STYLE,
  DEFAULT_SHAPE_STYLE,
  HIGHLIGHT_STYLE,
  REDACT_HIGHLIGHT_STYLE,
  REDACT_ZONE_STYLE,
} from "./src/types/style";
export type {
  BlendMode,
  ShapeOutline,
  ShapeOutlineGlow,
  ShapeOutlineStyle,
  ShapeShadow,
  ShapeStyle,
  StrokeAlign,
} from "./src/types/style";

// Behavior
export {
  DEFAULT_BEHAVIOR,
  DEFAULT_BEHAVIOR_PRESET,
  extendBehavior,
  getStyleMode,
  getZOrder,
  isDeletable,
  isEditable,
  isPersisted,
  isSelectable,
  isTracked,
  resolveBehavior,
  SHAPE_BEHAVIORS,
} from "./src/types/behavior";
export type {
  ShapeBehavior,
  ShapeBehaviorPreset,
  ShapeBehaviorValue,
  ShapeStyleMode,
} from "./src/types/behavior";

// Input
export { DEFAULT_MODIFIERS } from "./src/types/input";
export type { DrawModifiers } from "./src/types/input";

// Base shape type and utilities
export {
  DEFAULT_CREATION_BEHAVIOR,
  generateShapeId,
  getShapeCreationBehavior,
  getShapeModuleByType,
  getShapeTypes,
  isShapeType,
  registerShape,
} from "./src/shapes/common/registry";
export type {
  DrawShape,
  ShapeCreationBehavior,
  ShapeCreationMode,
} from "./src/shapes/common/registry";

// Concrete shape types
export type {
  CreateInkBracketShapesOptions,
  EllipseShape,
  FreehandPathMode,
  FreehandShape,
  HighlightMergeOptions,
  InkBracketBounds,
  MarkerSettings,
  PolygonShape,
  RectShape,
  TextAlign,
  TextBaseline,
  TextHighlightAnchor,
  TextHighlightShape,
  TextShape,
  UnderlineAlign,
  UnderlineBelowRectOptions,
  UnderlineRect,
} from "./src/shapes";

export {
  createEllipseShape,
  createFreehandShape,
  createInkBracketShapes,
  createPolygonShape,
  createPolylineShape,
  createRectShape,
  createTextHighlightShape,
  createTextShape,
  DEFAULT_MARKER_SETTINGS,
  DEFAULT_TEXT_HIGHLIGHT_STYLE,
  getEllipseBounds,
  getFreehandBounds,
  getPolygonBounds,
  getRectBounds,
  getTextBounds,
  getTextHighlightBounds,
  markerSettings,
  mergeHighlightRects,
  resetMarkerSettings,
  setMarkerSettings,
  underlineBelowRect,
} from "./src/shapes";

// Tools (client-facing config)
export {
  getToolConfig,
  getToolTargetShape,
  TOOL_CONFIGS,
  TOOL_TARGET_SHAPE,
} from "./src/tools";
export type { DrawTool, ToolConfig as DrawToolConfig } from "./src/tools";

// Controller interfaces
export type {
  ControllerAction,
  ControllerContext,
  DrawingController,
  MultiClickController,
} from "./src/shapes";

// State types
export type {
  ActiveDrawingState,
  BatchShapeUpdate,
  DoodlRuntimeState,
  DrawingMetadata,
  DrawingState,
  SelectionState,
  ShapeUpdate,
} from "./src/types/state";

export {
  createEmptySelection,
  createEmptyState,
  createIdleDrawingState,
  DRAWING_STATE_VERSION,
} from "./src/types/state";

// =============================================================================
// SHAPES (rendering, hit-testing, handlers, movement, selection)
// =============================================================================

// Dispatch (unified shape operations)
export {
  clearCanvas,
  enforceShapeBounds,
  extractShapeText,
  fillBackground,
  // Behavior filtering
  filterDeletableShapes,
  filterEditableShapes,
  filterPersistedShapes,
  filterSelectableShapes,
  filterTrackedShapes,
  findShapesAtPoint,
  findTopmostShapeAtPoint,
  getShapeBounds,
  getShapeModule,
  getShapePosition,
  hitTestShape,
  isPointInShape,
  // Behavior checks (per-shape)
  isShapeDeletable,
  isShapeEditable,
  isShapeSelectable,
  isValidShape,
  renderShape,
  renderShapes,
  renderShapesWithBehavior,
  // Behavior-aware rendering
  renderShapeWithBehavior,
  sortShapesByBehavior,
  transformShape,
} from "./src/shapes";
export type {
  ExtractedText,
  HitTestResult,
  ShapeModule,
  TextExtractionContext,
} from "./src/shapes";

// Common utilities
export {
  applyStyle,
  BaseController,
  boundsToEllipse,
  calculateDrawingBounds,
  DEFAULT_STROKE_TOLERANCE,
  distanceBetweenPoints,
  distanceToLineSegment,
  // Text bounds finder (text → bounds)
  findTextInTextLayer,
  hasTextInTextLayer,
  isMultiClickController,
  isPointInBounds,
  mapBlendMode,
  mergeBounds,
  NO_ACTION,
  resetStyle,
} from "./src/shapes";
export type { FindTextOptions, TextMatch } from "./src/shapes";

// Rect
export {
  createRectController,
  getRectPosition,
  hitTestRect,
  hitTestRectStroke,
  isRectShape,
  RectController,
  renderRect,
  transformRect,
} from "./src/shapes";

// Ellipse
export {
  createEllipseController,
  EllipseController,
  getEllipsePosition,
  hitTestEllipse,
  hitTestEllipseStroke,
  renderEllipse,
  transformEllipse,
} from "./src/shapes";

// Polygon
export {
  createPolygonController,
  getPolygonPosition,
  hitTestPolygon,
  hitTestPolygonStroke,
  PolygonController,
  renderPolygon,
  transformPolygon,
} from "./src/shapes";

// Freehand
export {
  createFreehandController,
  createHighlightController,
  DEFAULT_EPSILON,
  FreehandController,
  getFreehandPosition,
  getPathLength,
  hitTestFreehandFill,
  hitTestFreehandStroke,
  renderFreehand,
  resamplePath,
  simplifyPath,
  simplifyPathWithMinPoints,
  smoothPath,
  transformFreehand,
} from "./src/shapes";

// Select (controller + UI + transform)
export {
  // Transform utilities
  applyScale,
  applyTransform,
  applyTransformToShapes,
  applyTranslate,
  calculateScale,
  calculateTranslate,
  // Controller
  createSelectController,
  // Selection UI
  getCombinedBounds,
  getHandleCursor,
  getHandlePositions,
  HANDLE_BORDER_COLOR,
  HANDLE_BORDER_WIDTH,
  HANDLE_FILL_COLOR,
  HANDLE_SIZE,
  hitTestHandle,
  renderHandlesForBounds,
  renderMultiSelection,
  renderSelection,
  renderSelectionBounds,
  renderSelectionHandles,
  renderSelectionOutline,
  SelectController,
  SELECTION_OUTLINE_COLOR,
  SELECTION_OUTLINE_DASH,
  SELECTION_OUTLINE_WIDTH,
} from "./src/shapes";
export type {
  HandlePosition,
  Transform,
  TransformOrigin,
  TransformState,
  TransformType,
} from "./src/shapes";

// Shape validation
export {
  hasValidDrawShape,
  isValidEllipse,
  isValidFreehand,
  isValidPoint,
  isValidPolygon,
  isValidRect,
  isValidStyle,
  isValidText,
} from "./src/shapes";

// Text utilities
export {
  buildFontString,
  DEFAULT_FONT_FAMILY,
  DEFAULT_FONT_SIZE,
  DEFAULT_TEXT_STYLE,
  measureTextWidth,
} from "./src/shapes";

// Configuration
export {
  DEFAULT_HISTORY_SIZE,
  DEFAULT_HIT_TOLERANCE,
  DEFAULT_SIMPLIFICATION_EPSILON,
  HANDLE_HIT_TOLERANCE,
  MIN_POLYGON_VERTICES,
  MIN_SHAPE_SIZE,
  MIN_SIMPLIFIED_POINTS,
  POLYGON_CLOSE_THRESHOLD,
} from "./src/config";

// =============================================================================
// DRIVERS
// =============================================================================

// History Driver
export { createHistoryDriver, HistoryDriver } from "./src/drivers";
export type {
  HistoryChangeCallback,
  HistoryDriverOptions,
  HistoryState,
} from "./src/drivers";

// Keyboard Driver
export {
  createKeyboardDriver,
  isEditableKeyboardTarget,
  KeyboardDriver,
} from "./src/drivers";
export type {
  KeyboardCommand,
  KeyboardDriverCallbacks,
  KeyboardDriverOptions,
} from "./src/drivers";

// Mouse Driver (legacy)
export { createMouseDriver, MouseDriver } from "./src/drivers";
export type { MouseDriverCallbacks, MouseDriverOptions } from "./src/drivers";

// Pointer Driver (unified input: mouse, touch, pen)
export { createPointerDriver, PointerDriver } from "./src/drivers";
export type {
  PointerDriverCallbacks,
  PointerDriverOptions,
  PointerPoint,
} from "./src/drivers";

// Render Driver
export { createRenderDriver, RenderDriver } from "./src/drivers";
export type { RenderDriverOptions, RenderStateProvider } from "./src/drivers";

// Selection Driver (DOM text selection for text-highlight tool)
export { createSelectionDriver, SelectionDriver } from "./src/drivers";
export type {
  SelectionDriverCallbacks,
  SelectionDriverOptions,
} from "./src/drivers";

// State Driver (validation, serialization, utilities)
export {
  cloneState,
  createFromShapes,
  deserializeFromObject,
  deserializeState,
  extractShapes,
  isValidMetadata,
  isValidState,
  mergeStates,
  repairState,
  serializeState,
  serializeToObject,
  StateError,
} from "./src/drivers";

// =============================================================================
// DOODL (main API)
// =============================================================================

export {
  createDoodl,
  defaultColorForAnimation,
  defaultDurationForAnimation,
  Doodl,
  getActivationAnimationRenderer,
  registerActivationAnimation,
} from "./src/doodl";
export type {
  ActivationAnimationFrame,
  ActivationAnimationRenderer,
  ActivationAnimationType,
  BuiltinActivationAnimation,
  DoodlEvents,
  DoodlOptions,
  PingOptions,
} from "./src/doodl";
