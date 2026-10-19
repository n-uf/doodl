/**
 * Type exports for Doodl
 */

// Geometry
export type { Bounds, Point, Size } from "./geometry";

// Bounds Policy
export { calculateConstrainDelta, calculateOverflow } from "./bounds-policy";
export type {
  BoundsEnforcementResult,
  BoundsOverflow,
  BoundsPolicy,
  CanvasBounds,
} from "./bounds-policy";

// Style
export {
  ANNOTATION_STYLE,
  DEFAULT_SHAPE_STYLE,
  HIGHLIGHT_STYLE,
  REDACT_HIGHLIGHT_STYLE,
  REDACT_ZONE_STYLE,
} from "./style";
export type {
  BlendMode,
  ShapeOutline,
  ShapeOutlineGlow,
  ShapeOutlineStyle,
  ShapeShadow,
  ShapeStyle,
  StrokeAlign,
} from "./style";

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
} from "./behavior";
export type {
  ShapeBehavior,
  ShapeBehaviorPreset,
  ShapeBehaviorValue,
  ShapeStyleMode,
} from "./behavior";

// Input
export { DEFAULT_MODIFIERS } from "./input";
export type { DrawModifiers } from "./input";

// Tools (client-facing config)
export { getToolConfig, TOOL_CONFIGS } from "../tools";
export type { DrawTool, ToolConfig } from "../tools";

// Shapes (types, factories, utilities)
export type {
  CreateInkBracketShapesOptions,
  DrawShape,
  EllipseShape,
  FreehandPathMode,
  FreehandShape,
  InkBracketBounds,
  PolygonShape,
  RectShape,
  UnderlineAlign,
  UnderlineBelowRectOptions,
  UnderlineRect,
} from "../shapes";

export {
  createEllipseShape,
  createFreehandShape,
  createInkBracketShapes,
  createPolygonShape,
  createPolylineShape,
  createRectShape,
  generateShapeId,
  underlineBelowRect,
  getEllipseBounds,
  getFreehandBounds,
  getPolygonBounds,
  getRectBounds,
  getShapeBounds,
} from "../shapes";

// State
export type {
  ActiveDrawingState,
  BatchShapeUpdate,
  DoodlRuntimeState,
  DrawingMetadata,
  DrawingState,
  SelectionState,
  ShapeUpdate,
} from "./state";

export {
  createEmptySelection,
  createEmptyState,
  createIdleDrawingState,
  DRAWING_STATE_VERSION,
} from "./state";

// Performance
export {
  createPerformanceConfig,
  DEFAULT_PERFORMANCE_CONFIG,
  DEFAULT_RENDERING_CONFIG,
} from "./performance";
export type {
  DoodlPerformanceConfig,
  ImageSmoothingMode,
  RenderingQualityConfig,
  ResolvedDoodlPerformanceConfig,
} from "./performance";
