/**
 * Doodl - Canvas drawing library
 *
 * Shape-centric architecture with unified exports.
 */

import { registerBuiltinShapes } from "./shapes/register-builtins";
registerBuiltinShapes();
export { registerBuiltinShapes } from "./shapes/register-builtins";

// =============================================================================
// TYPES
// =============================================================================

// Geometry
export type { Bounds, Point, Size } from "./types/geometry";

// Style
export {
  ANNOTATION_STYLE,
  DEFAULT_SHAPE_STYLE,
  HIGHLIGHT_STYLE,
  REDACT_HIGHLIGHT_STYLE,
  REDACT_ZONE_STYLE,
} from "./types/style";
export type {
  BlendMode,
  ShapeOutline,
  ShapeOutlineGlow,
  ShapeShadow,
  ShapeStyle,
  StrokeAlign,
} from "./types/style";

// Input
export { DEFAULT_MODIFIERS } from "./types/input";
export type { DrawModifiers } from "./types/input";

// Base shape type and registry
export {
  DEFAULT_CREATION_BEHAVIOR,
  generateShapeId,
  getShapeCreationBehavior,
  getShapeModuleByType,
  getShapeTypes,
  isShapeType,
  registerShape,
} from "./shapes/common/registry";
export type {
  DrawShape,
  ShapeCreationBehavior,
  ShapeCreationMode,
} from "./shapes/common/registry";

// Tools (client-facing config)
export {
  getToolConfig,
  getToolTargetShape,
  TOOL_CONFIGS,
  TOOL_TARGET_SHAPE,
} from "./tools";
export type { DrawTool, ToolConfig } from "./tools";

// State
export type {
  ActiveDrawingState,
  BatchShapeUpdate,
  DoodlRuntimeState,
  DrawingMetadata,
  DrawingState,
  SelectionState,
  ShapeUpdate,
} from "./types/state";

export {
  createEmptySelection,
  createEmptyState,
  createIdleDrawingState,
  DRAWING_STATE_VERSION,
} from "./types/state";

// =============================================================================
// SHAPES (rendering, hit-testing, handlers, movement, selection UI)
// =============================================================================

export * from "./shapes";

// =============================================================================
// DRIVERS (state, input, history)
// =============================================================================

export * from "./drivers";

// =============================================================================
// DOODL (main API)
// =============================================================================

export {
  createDoodl,
  Doodl,
  defaultColorForAnimation,
  defaultDurationForAnimation,
  getActivationAnimationRenderer,
  registerActivationAnimation,
} from "./doodl";
export type {
  ActivationAnimationFrame,
  ActivationAnimationRenderer,
  ActivationAnimationType,
  BuiltinActivationAnimation,
  DoodlEvents,
  DoodlOptions,
  PingOptions,
} from "./doodl";

// =============================================================================
// DOCUMENT MODEL (multi-page annotation document, no DOM)
// =============================================================================

// Public surface only. Construction goes through the factory; the selection model,
// gesture lock, history class, click helpers, command runner and the DEFAULT_* and
// NUDGE_* constants stay internal (see ./document/index.ts for in-package use).
export { createAnnotationDocument, toPageId } from "./document";
export type {
  AnnotationDocument,
  AnnotationDocumentOptions,
  ClickOptions,
  ClickTarget,
  DocShape,
  DocumentChangeEvent,
  DocumentCommand,
  DocumentEventName,
  DocumentEvents,
  DocumentGesture,
  DocumentHistoryMode,
  DocumentHistoryOptions,
  DocumentHistoryState,
  DocumentPageView,
  DocumentPingOptions,
  DocumentSelection,
  DocumentSelectionChangeEvent,
  DocumentTransaction,
  GestureCommitOptions,
  GestureInfo,
  GestureOptions,
  GesturePreviewEvent,
  HistoryAppliedEvent,
  LocateEvent,
  PageId,
  PageIdInput,
  PageInfo,
  PageSize,
  SelectMode,
  SetPageShapesOptions,
  ShapePatch,
  ShapesChangeMeta,
  TransactionBuilder,
  TransactionPatch,
  TransactOptions,
} from "./document";
