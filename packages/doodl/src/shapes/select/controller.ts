/**
 * Select Controller - Unified selection with transform (drag & resize)
 *
 * Handles:
 * - Click to select shapes
 * - Shift+click for multi-select
 * - Drag to move (translate)
 * - Handle drag to resize (scale)
 * - Double-click polygon to enter vertex edit mode
 * - Vertex dragging in edit mode
 */

import type { Bounds, DrawModifiers, Point, ShapeStyle } from "../../types";
import type {
  ControllerAction,
  ControllerContext,
  DrawingController,
} from "../common/controllers";
import { getShapeBounds, isShapeEditable } from "../common/dispatch";
import type { DrawShape } from "../common/registry";
import { mergeBounds } from "../common/utils/geometry";
import type { PolygonShape } from "../polygon/types";
import { type HandlePosition, hitTestHandle } from "./selection-ui";
import {
  applyTransformToShapes,
  calculateScale,
  calculateTranslate,
  type Transform,
  type TransformType,
} from "./transform";
import {
  addVertexAtEdge,
  createVertexEditState,
  deleteVertex,
  hitTestEdge,
  hitTestVertex,
  isVertexEditable,
  moveVertex,
  type VertexEditState,
} from "./vertex-edit";

// =============================================================================
// TYPES
// =============================================================================

/**
 * Controller mode
 */
type SelectMode = "idle" | "transforming" | "vertex-editing";

/**
 * Active transform state
 */
interface ActiveTransform {
  type: TransformType;
  startPoint: Point;
  handle: HandlePosition | null;
  originalBounds: Bounds;
  originalShapes: Map<string, DrawShape>;
}

/**
 * Controller state
 */
interface SelectState {
  mode: SelectMode;
  transform: ActiveTransform | null;
  /** Current working copies of shapes during transform */
  workingShapes: Map<string, DrawShape>;
  /** Vertex edit state (when editing polygon vertices) */
  vertexEdit: VertexEditState | null;
}

/**
 * Empty action constant
 */
const NO_ACTION: ControllerAction<DrawShape> = {};

// =============================================================================
// CONTROLLER
// =============================================================================

/**
 * Select controller with integrated transform support
 */
export class SelectController implements DrawingController<DrawShape> {
  private _state: SelectState = {
    mode: "idle",
    transform: null,
    workingShapes: new Map(),
    vertexEdit: null,
  };

  private _context: ControllerContext<DrawShape> | null = null;

  // ===========================================================================
  // CONTROLLER INTERFACE
  // ===========================================================================

  onStart(
    point: Point,
    _style: ShapeStyle,
    modifiers: DrawModifiers,
    context: ControllerContext<DrawShape>
  ): ControllerAction<DrawShape> {
    this._context = context;

    // Priority 0: If in vertex edit mode, check for vertex/edge hit first
    if (this._state.mode === "vertex-editing" && this._state.vertexEdit) {
      const shape = context.getShape(this._state.vertexEdit.shapeId);
      if (shape && isVertexEditable(shape)) {
        // Check vertex hit first (higher priority than edge)
        const vertexHit = hitTestVertex(point, shape);
        if (vertexHit) {
          return this._beginVertexDrag(point, vertexHit.vertexIndex, shape);
        }

        // Check edge hit - add new vertex at click position
        const edgeHit = hitTestEdge(point, shape);
        if (edgeHit) {
          return this._addVertexAtEdge(shape, edgeHit.edgeStartIndex, point);
        }

        // Click outside vertices/edges exits edit mode
        this._exitVertexEditMode();
      }
    }

    // Priority 1: Check resize handles on current selection (editable only)
    if (
      context.selectedIds.length > 0 &&
      this._state.mode !== "vertex-editing" &&
      this._selectionIsEditable(context)
    ) {
      const bounds = this._getSelectionBounds(context);
      if (bounds) {
        const handle = hitTestHandle(point, bounds, 4);
        if (handle) {
          return this._beginTransform("scale", point, handle, context);
        }
      }
    }

    // Priority 2: Check shape hit
    const hitShape = context.findShapeAtPoint(point);
    const hitId = hitShape?.id ?? null;

    // Clicked empty area
    if (hitId === null) {
      if (this._state.mode === "vertex-editing") {
        this._exitVertexEditMode();
      }
      if (!modifiers.shift && context.selectedIds.length > 0) {
        return { setSelection: [] };
      }
      return NO_ACTION;
    }

    const isSelected = context.selectedIds.includes(hitId);

    // Shift+click: toggle selection
    if (modifiers.shift) {
      if (isSelected) {
        return {
          setSelection: context.selectedIds.filter((id) => id !== hitId),
        };
      }
      return { setSelection: [...context.selectedIds, hitId] };
    }

    // Click on unselected shape: select it
    if (!isSelected) {
      return { setSelection: [hitId] };
    }

    // Click on already selected: begin move only when editable
    if (hitShape === null || !isShapeEditable(hitShape)) {
      return NO_ACTION;
    }
    return this._beginTransform("translate", point, null, context);
  }

  onMove(point: Point, modifiers: DrawModifiers): ControllerAction<DrawShape> {
    // Handle vertex edit mode
    if (this._state.mode === "vertex-editing" && this._state.vertexEdit) {
      // If dragging, update vertex position
      if (this._state.vertexEdit.draggingVertexIndex !== null) {
        return this._handleVertexDrag(point);
      }

      // Not dragging - update hover state for visual feedback
      return this._updateVertexHover(point);
    }

    if (this._state.mode !== "transforming" || !this._state.transform) {
      return NO_ACTION;
    }

    const { type, startPoint, handle, originalBounds, originalShapes } =
      this._state.transform;

    // Calculate transform based on type
    let transform: Transform;

    if (type === "translate") {
      transform = calculateTranslate(startPoint, point);
    } else {
      transform = calculateScale(
        originalBounds,
        startPoint,
        point,
        handle!,
        modifiers.shift
      );
    }

    // Apply transform to all shapes
    const updatedShapes = applyTransformToShapes(
      originalShapes,
      transform,
      originalBounds
    );

    // Update working copies
    this._state.workingShapes.clear();
    for (const shape of updatedShapes) {
      this._state.workingShapes.set(shape.id, shape);
    }

    return { updateShapes: updatedShapes };
  }

  onEnd(): ControllerAction<DrawShape> {
    // Handle vertex drag end
    if (
      this._state.mode === "vertex-editing" &&
      this._state.vertexEdit?.draggingVertexIndex !== null
    ) {
      return this._endVertexDrag();
    }

    if (this._state.mode !== "transforming") {
      return NO_ACTION;
    }

    // Commit final shapes
    const finalShapes = Array.from(this._state.workingShapes.values());
    this._resetTransform();

    if (finalShapes.length > 0) {
      return { updateShapes: finalShapes };
    }
    return NO_ACTION;
  }

  /**
   * Handle double-click - enters vertex edit mode for polygons
   */
  onDblClick(
    point: Point,
    _modifiers: DrawModifiers,
    context: ControllerContext<DrawShape>
  ): ControllerAction<DrawShape> {
    this._context = context;

    // Check if we clicked on a polygon
    const hitShape = context.findShapeAtPoint(point);
    if (hitShape && isShapeEditable(hitShape) && isVertexEditable(hitShape)) {
      // Enter vertex edit mode
      this._state = {
        mode: "vertex-editing",
        transform: null,
        workingShapes: new Map(),
        vertexEdit: createVertexEditState(hitShape.id),
      };
      // Keep the shape selected
      return { setSelection: [hitShape.id] };
    }

    return NO_ACTION;
  }

  /**
   * Handle keyboard events - Delete/Backspace removes hovered vertex
   */
  onKeyDown(
    key: string,
    _modifiers: DrawModifiers,
    context: ControllerContext<DrawShape>
  ): ControllerAction<DrawShape> {
    this._context = context;

    // Only handle in vertex edit mode
    if (this._state.mode !== "vertex-editing" || !this._state.vertexEdit) {
      return NO_ACTION;
    }

    // Delete/Backspace removes hovered or dragging vertex
    if (key === "Delete" || key === "Backspace") {
      const { vertexEdit } = this._state;
      const targetIndex =
        vertexEdit.draggingVertexIndex ?? vertexEdit.hoveredVertexIndex;

      if (targetIndex === null) {
        return NO_ACTION;
      }

      const shape = context.getShape(vertexEdit.shapeId);
      if (!shape || !isVertexEditable(shape)) {
        return NO_ACTION;
      }

      // Attempt to delete vertex (returns null if would make polygon invalid)
      const updatedShape = deleteVertex(shape, targetIndex);
      if (!updatedShape) {
        // Can't delete - polygon needs minimum 3 vertices
        return NO_ACTION;
      }

      // Reset hover/drag state (indices may have shifted)
      this._state.vertexEdit = {
        ...vertexEdit,
        draggingVertexIndex: null,
        hoveredVertexIndex: null,
        hoveredEdgeIndex: null,
        originalPoints: null,
        dragStartPoint: null,
      };

      return { updateShapes: [updatedShape] };
    }

    // Escape exits vertex edit mode
    if (key === "Escape") {
      this._exitVertexEditMode();
      return NO_ACTION;
    }

    return NO_ACTION;
  }

  onCancel(): void {
    this.reset();
  }

  reset(): void {
    this._state = {
      mode: "idle",
      transform: null,
      workingShapes: new Map(),
      vertexEdit: null,
    };
    this._context = null;
  }

  private _resetTransform(): void {
    this._state.mode = "idle";
    this._state.transform = null;
    this._state.workingShapes.clear();
  }

  // ===========================================================================
  // TRANSFORM OPERATIONS
  // ===========================================================================

  private _beginTransform(
    type: TransformType,
    point: Point,
    handle: HandlePosition | null,
    context: ControllerContext<DrawShape>
  ): ControllerAction<DrawShape> {
    const bounds = this._getSelectionBounds(context);
    if (!bounds) return NO_ACTION;

    // Capture original shapes
    const originalShapes = new Map<string, DrawShape>();
    for (const id of context.selectedIds) {
      const shape = context.getShape(id);
      if (shape) {
        originalShapes.set(id, { ...shape });
      }
    }

    this._state = {
      mode: "transforming",
      transform: {
        type,
        startPoint: { ...point },
        handle,
        originalBounds: bounds,
        originalShapes,
      },
      workingShapes: new Map(originalShapes),
      vertexEdit: null,
    };

    return NO_ACTION;
  }

  // ===========================================================================
  // VERTEX EDITING OPERATIONS
  // ===========================================================================

  private _beginVertexDrag(
    point: Point,
    vertexIndex: number,
    shape: PolygonShape
  ): ControllerAction<DrawShape> {
    if (!this._state.vertexEdit) return NO_ACTION;

    this._state.vertexEdit = {
      ...this._state.vertexEdit,
      draggingVertexIndex: vertexIndex,
      originalPoints: [...shape.points.map((p) => ({ ...p }))],
      dragStartPoint: { ...point },
    };

    // Store working copy
    this._state.workingShapes.set(shape.id, { ...shape });

    return NO_ACTION;
  }

  /**
   * Add a new vertex at the clicked edge position
   */
  private _addVertexAtEdge(
    shape: PolygonShape,
    edgeStartIndex: number,
    position: Point
  ): ControllerAction<DrawShape> {
    // Insert new vertex at exact click position
    const updatedShape = addVertexAtEdge(shape, edgeStartIndex, position);

    // The new vertex index is edgeStartIndex + 1
    const newVertexIndex = edgeStartIndex + 1;

    // Update vertex edit state to reflect the new point
    if (this._state.vertexEdit) {
      this._state.vertexEdit = {
        ...this._state.vertexEdit,
        hoveredVertexIndex: newVertexIndex,
        hoveredEdgeIndex: null,
      };
    }

    // Immediately start dragging the new vertex for smooth UX
    this._state.workingShapes.set(updatedShape.id, updatedShape);
    this._state.vertexEdit = {
      ...this._state.vertexEdit!,
      draggingVertexIndex: newVertexIndex,
      originalPoints: [...updatedShape.points.map((p) => ({ ...p }))],
      dragStartPoint: { ...position },
    };

    return { updateShapes: [updatedShape] };
  }

  private _handleVertexDrag(point: Point): ControllerAction<DrawShape> {
    const { vertexEdit } = this._state;
    if (
      !vertexEdit ||
      vertexEdit.draggingVertexIndex === null ||
      !this._context
    ) {
      return NO_ACTION;
    }

    const shape = this._state.workingShapes.get(vertexEdit.shapeId);
    if (!shape || !isVertexEditable(shape)) return NO_ACTION;

    // Move the vertex to the new position
    const updatedShape = moveVertex(
      shape,
      vertexEdit.draggingVertexIndex,
      point
    );
    this._state.workingShapes.set(vertexEdit.shapeId, updatedShape);

    return { updateShapes: [updatedShape] };
  }

  private _endVertexDrag(): ControllerAction<DrawShape> {
    const { vertexEdit } = this._state;
    if (!vertexEdit) return NO_ACTION;

    const shape = this._state.workingShapes.get(vertexEdit.shapeId);

    // Reset drag state but stay in vertex edit mode
    this._state.vertexEdit = {
      ...vertexEdit,
      draggingVertexIndex: null,
      originalPoints: null,
      dragStartPoint: null,
    };
    this._state.workingShapes.clear();

    if (shape) {
      return { updateShapes: [shape] };
    }
    return NO_ACTION;
  }

  private _exitVertexEditMode(): void {
    this._state = {
      mode: "idle",
      transform: null,
      workingShapes: new Map(),
      vertexEdit: null,
    };
  }

  /**
   * Update vertex/edge hover state for visual feedback
   */
  private _updateVertexHover(point: Point): ControllerAction<DrawShape> {
    const { vertexEdit } = this._state;
    if (!vertexEdit || !this._context) {
      return NO_ACTION;
    }

    const shape = this._context.getShape(vertexEdit.shapeId);
    if (!shape || !isVertexEditable(shape)) {
      return NO_ACTION;
    }

    // Check vertex hit first (higher priority)
    const vertexHit = hitTestVertex(point, shape);
    if (vertexHit) {
      // Update hover state if changed
      if (
        vertexEdit.hoveredVertexIndex !== vertexHit.vertexIndex ||
        vertexEdit.hoveredEdgeIndex !== null
      ) {
        this._state.vertexEdit = {
          ...vertexEdit,
          hoveredVertexIndex: vertexHit.vertexIndex,
          hoveredEdgeIndex: null,
        };
      }
      return NO_ACTION;
    }

    // Check edge hit
    const edgeHit = hitTestEdge(point, shape);
    if (edgeHit) {
      if (
        vertexEdit.hoveredEdgeIndex !== edgeHit.edgeStartIndex ||
        vertexEdit.hoveredVertexIndex !== null
      ) {
        this._state.vertexEdit = {
          ...vertexEdit,
          hoveredVertexIndex: null,
          hoveredEdgeIndex: edgeHit.edgeStartIndex,
        };
      }
      return NO_ACTION;
    }

    // Clear hover state
    if (
      vertexEdit.hoveredVertexIndex !== null ||
      vertexEdit.hoveredEdgeIndex !== null
    ) {
      this._state.vertexEdit = {
        ...vertexEdit,
        hoveredVertexIndex: null,
        hoveredEdgeIndex: null,
      };
    }

    return NO_ACTION;
  }

  // ===========================================================================
  // HELPERS
  // ===========================================================================

  private _getSelectionBounds(
    context: ControllerContext<DrawShape>
  ): Bounds | null {
    if (context.selectedIds.length === 0) return null;

    const allBounds: Bounds[] = [];
    for (const id of context.selectedIds) {
      const shape = context.getShape(id);
      if (shape) {
        allBounds.push(getShapeBounds(shape));
      }
    }

    return allBounds.length > 0 ? mergeBounds(allBounds) : null;
  }

  /** True when every selected shape allows drag/resize */
  private _selectionIsEditable(
    context: ControllerContext<DrawShape>
  ): boolean {
    if (context.selectedIds.length === 0) return false;
    for (const id of context.selectedIds) {
      const shape = context.getShape(id);
      if (shape === undefined || !isShapeEditable(shape)) {
        return false;
      }
    }
    return true;
  }

  // ===========================================================================
  // PUBLIC API
  // ===========================================================================

  /**
   * Get current mode
   */
  getMode(): SelectMode {
    return this._state.mode;
  }

  /**
   * Get active transform type (if transforming)
   */
  getTransformType(): TransformType | null {
    return this._state.transform?.type ?? null;
  }

  /**
   * Get active resize handle (if scaling)
   */
  getActiveHandle(): HandlePosition | null {
    return this._state.transform?.handle ?? null;
  }

  /**
   * Check if currently transforming
   */
  isTransforming(): boolean {
    return this._state.mode === "transforming";
  }

  /**
   * Check if in vertex edit mode
   */
  isVertexEditing(): boolean {
    return this._state.mode === "vertex-editing";
  }

  /**
   * Get vertex edit state (if editing)
   */
  getVertexEditState(): VertexEditState | null {
    return this._state.vertexEdit;
  }

  /**
   * Exit vertex edit mode programmatically
   */
  exitVertexEdit(): void {
    if (this._state.mode === "vertex-editing") {
      this._exitVertexEditMode();
    }
  }

  /**
   * Enter vertex edit mode for a polygon
   */
  enterVertexEdit(shapeId: string): boolean {
    if (!this._context) return false;

    const shape = this._context.getShape(shapeId);
    if (!shape || !isVertexEditable(shape)) return false;

    this._state = {
      mode: "vertex-editing",
      transform: null,
      workingShapes: new Map(),
      vertexEdit: createVertexEditState(shapeId),
    };

    return true;
  }
}

/**
 * Create select controller instance
 */
export function createSelectController(): SelectController {
  return new SelectController();
}
