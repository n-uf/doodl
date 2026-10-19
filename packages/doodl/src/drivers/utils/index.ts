/**
 * Driver utilities
 *
 * Organized by domain:
 * - Dirty rectangle tracking (performance optimization)
 * - Drag bounds tracking
 * - Span rects caching
 * - Selection container validation
 * - Selection rect validation
 *
 * Note: Text layer CSS patching was removed because:
 * - CSS user-select only prevents selection START, not EXTENSION
 * - Browser ignores user-select during drag extension
 * - No CSS/JS workaround exists for containing selection within elements
 * - The real fix is post-processing filters (drag bounds, container-size, span validation)
 */

// Dirty rectangle tracking (performance optimization)
export {
  boundsIntersectsRegions,
  createDirtyRectManager,
  DirtyRectManager,
  type DirtyRectManagerOptions,
  type DirtyRegion,
} from "./dirty-rect-manager";

// Spatial indexing (performance optimization)
export {
  createSpatialIndex,
  SpatialIndex,
  type GetBoundsFunc,
  type SpatialIndexOptions,
  type SpatialItem,
} from "./spatial-index";

// Render batching (performance optimization)
export {
  batchShapesByStyle,
  createBatchRenderer,
  estimateBatchSavings,
  renderShapesBatched,
  type BatchStyle,
  type RenderBatch,
  type RenderBatchOptions,
} from "./render-batch";

// Drag bounds tracking
export {
  createDragBoundsTracker,
  DragBoundsTracker,
  type DragBounds,
} from "./drag-bounds-tracker";

// Span rects caching
export {
  createSpanRectsCache,
  getSpanRects,
  type SpanRectsCache,
} from "./span-rects-cache";

// Selection container validation
export {
  getSelectionClientRects,
  isSelectionWithinContainer,
  type SelectionRectsOptions,
} from "./selection-container";

// Selection rect validation
export {
  isLegitimateTextRect,
  isVerticallyBetween,
  rectsOverlap,
  SELECTION_OVERLAP_TOLERANCE,
} from "./selection-rect-validation";
