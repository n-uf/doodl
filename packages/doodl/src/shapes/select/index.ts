/**
 * Shape selection module
 */

// Controller (unified interface)
export { SelectController, createSelectController } from "./controller";

// Transform system
export {
  applyScale,
  applyTransform,
  applyTransformToShapes,
  applyTranslate,
  calculateScale,
  calculateTranslate,
} from "./transform";
export type {
  Transform,
  TransformOrigin,
  TransformState,
  TransformType,
} from "./transform";

// Selection UI (outlines, handles, rendering)
export {
  HANDLE_BORDER_COLOR,
  HANDLE_BORDER_WIDTH,
  HANDLE_FILL_COLOR,
  HANDLE_SIZE,
  SELECTION_OUTLINE_COLOR,
  SELECTION_OUTLINE_DASH,
  SELECTION_OUTLINE_WIDTH,
  getCombinedBounds,
  getHandleCursor,
  getHandlePositions,
  hitTestHandle,
  renderHandlesForBounds,
  renderMultiSelection,
  renderSelection,
  renderSelectionBounds,
  renderSelectionHandles,
  renderSelectionOutline,
} from "./selection-ui";
export type { HandlePosition } from "./selection-ui";

// Vertex editing (Figma-like polygon vertex manipulation)
export {
  EDGE_HIT_TOLERANCE,
  VERTEX_HANDLE_ACTIVE,
  VERTEX_HANDLE_BORDER,
  VERTEX_HANDLE_FILL,
  VERTEX_HANDLE_SIZE,
  VERTEX_HIT_TOLERANCE,
  addVertexAtEdge,
  createVertexEditState,
  deleteVertex,
  hitTestEdge,
  hitTestVertex,
  isVertexEditable,
  moveVertex,
  renderEdgeMidpoints,
  renderVertexEditOverlay,
  renderVertexHandles,
} from "./vertex-edit";
export type {
  EdgeHitResult,
  VertexEditState,
  VertexHitResult,
} from "./vertex-edit";
