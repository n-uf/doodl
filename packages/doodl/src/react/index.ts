/**
 * @n-uf/doodl/react
 *
 * React bindings for Doodl canvas drawing library.
 * Includes multi-page document annotation support with coordinate transformation.
 */

// =============================================================================
// MAIN REACT COMPONENT
// =============================================================================

export { Doodl, default as DoodlComponent } from "./doodl";
export type { DoodlProps, DoodlRef } from "./doodl";

// =============================================================================
// COMPONENTS
// =============================================================================

export { TextEditor } from "./components";
export type { TextEditorProps, TextEditorState } from "./components";

// =============================================================================
// MAIN REACT HOOK
// =============================================================================

export { useDoodl } from "./use-doodl";
export type { UseDoodlOptions, UseDoodlReturn } from "./use-doodl";

// =============================================================================
// PAGE ANNOTATION (multi-page documents)
// =============================================================================

export {
  PageAnnotationController,
  createPageAnnotationController,
} from "./page-annotation-controller";

export type {
  PageAnnotationControllerOptions,
  PageAnnotationEventName,
  PageAnnotationEvents,
  PageAnnotations,
  PageCoordinateContext,
  SerializedPageAnnotations,
} from "./types";

// =============================================================================
// PAGE ANNOTATION REACT
// =============================================================================

export { PageAnnotationLayer } from "./page-annotation-layer";
export type { PageAnnotationLayerProps } from "./page-annotation-layer";

export { usePageAnnotation } from "./use-page-annotation";
export type {
  UsePageAnnotationOptions,
  UsePageAnnotationReturn,
} from "./use-page-annotation";

// =============================================================================
// TRANSFORMS
// =============================================================================

export {
  canvasToPageCoords,
  pageToCanvasCoords,
  transformBounds,
  transformPoint,
  transformShapeCoords,
} from "./transform";

// =============================================================================
// DOCUMENT ANNOTATION (multi-page with configurable history)
// =============================================================================

export {
  DEFAULT_HISTORY_CONFIG,
  DocumentAnnotationManager,
  // History managers (for advanced use)
  GlobalHistoryManager,
  PerPageHistoryManager,
  // Main manager
  createDocumentAnnotationManager,
  // React hook
  useDocumentAnnotations,
} from "./document-annotation";

export type {
  DocumentAnnotationData,
  DocumentAnnotationEventName,
  DocumentAnnotationEvents,
  DocumentAnnotationManagerOptions,
  GlobalHistoryEntry,
  HistoryConfig,
  HistoryMode,
  HistoryState,
  PageAnnotationState,
  PageHistory,
  TransitionBehavior,
  UndoRedoResult,
  UseDocumentAnnotationsOptions,
  UseDocumentAnnotationsReturn,
  ViewMode,
} from "./document-annotation";

// =============================================================================
// ANNOTATION TOOLS (shared logic for Kavun/Harbuz)
// =============================================================================

export {
  ANNOTATION_TOOL_DEFINITIONS,
  formatShortcut,
  getToolDefinition,
  getToolsByCategory,
  getToolTooltip,
  useAnnotationShortcuts,
} from "./annotation-tools";

export type {
  AnnotationToolDefinition,
  UseAnnotationShortcutsOptions,
} from "./annotation-tools";

// =============================================================================
// CANVAS POOL (performance optimization)
// =============================================================================

export {
  annotationCanvasPool,
  CanvasPool,
  createCanvasPool,
} from "./canvas-pool";

export type { CanvasPoolOptions } from "./canvas-pool";

// =============================================================================
// RE-EXPORT DOODL TYPES (convenience)
// =============================================================================

export type {
  Bounds,
  DrawShape,
  DrawTool,
  Point,
  ShapeStyle,
} from "../../index";

export { DEFAULT_SHAPE_STYLE, registerBuiltinShapes } from "../../index";
