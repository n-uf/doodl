/**
 * Drivers - Logical containers for related functionality
 *
 * Similar to React hooks, drivers bundle related operations
 * into cohesive, reusable units.
 */

// =============================================================================
// HISTORY DRIVER - Undo/redo management
// =============================================================================

export { HistoryDriver, createHistoryDriver } from "./history-driver";
export type {
  HistoryChangeCallback,
  HistoryDriverOptions,
  HistoryState,
} from "./history-driver";

// =============================================================================
// KEYBOARD DRIVER - Keyboard input handling
// =============================================================================

export {
  KeyboardDriver,
  createKeyboardDriver,
  isEditableKeyboardTarget,
} from "./keyboard-driver";
export type {
  KeyboardCommand,
  KeyboardDriverCallbacks,
  KeyboardDriverOptions,
} from "./keyboard-driver";

// =============================================================================
// MOUSE DRIVER - Mouse input handling (legacy)
// =============================================================================

export { MouseDriver, createMouseDriver } from "./mouse-driver";
export type { MouseDriverCallbacks, MouseDriverOptions } from "./mouse-driver";

// =============================================================================
// POINTER DRIVER - Unified input (mouse, touch, pen)
// =============================================================================

export { PointerDriver, createPointerDriver } from "./pointer-driver";
export type {
  PointerDriverCallbacks,
  PointerDriverOptions,
  PointerPoint,
} from "./pointer-driver";

// =============================================================================
// RENDER DRIVER - Canvas rendering with RAF
// =============================================================================

export { RenderDriver, createRenderDriver } from "./render-driver";
export type { PingEffect, RenderDriverOptions, RenderStateProvider } from "./render-driver";

// =============================================================================
// SELECTION DRIVER - DOM text selection handling
// =============================================================================

export { SelectionDriver, createSelectionDriver } from "./selection-driver";
export type {
  SelectionDriverCallbacks,
  SelectionDriverOptions,
} from "./selection-driver";

// =============================================================================
// STATE DRIVER - State management (validation, serialization, utilities)
// =============================================================================

export {
  StateError,
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
} from "./state-driver";

// =============================================================================
// UTILS - Selection utilities
// =============================================================================

// Dirty rectangle tracking (performance optimization)
export {
  boundsIntersectsRegions,
  createDirtyRectManager,
  DirtyRectManager,
  type DirtyRectManagerOptions,
  type DirtyRegion,
} from "./utils";

// Spatial indexing (performance optimization)
export {
  createSpatialIndex,
  SpatialIndex,
  type GetBoundsFunc,
  type SpatialIndexOptions,
  type SpatialItem,
} from "./utils";

// Drag bounds tracking
export {
  DragBoundsTracker,
  createDragBoundsTracker,
  type DragBounds,
} from "./utils";

// Span rects caching
export {
  createSpanRectsCache,
  getSpanRects,
  type SpanRectsCache,
} from "./utils";

// Selection container validation
export {
  getSelectionClientRects,
  isSelectionWithinContainer,
  type SelectionRectsOptions,
} from "./utils";

// Selection rect validation
export {
  SELECTION_OVERLAP_TOLERANCE,
  isLegitimateTextRect,
  isVerticallyBetween,
  rectsOverlap,
} from "./utils";
