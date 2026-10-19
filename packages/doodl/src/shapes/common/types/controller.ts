/**
 * Drawing Controller type definitions
 *
 * Unified interface for all drawing and selection controllers.
 */

import type { Point } from "../../../types/geometry";
import type { DrawModifiers } from "../../../types/input";
import type { ShapeStyle } from "../../../types/style";

// =============================================================================
// CONTROLLER CONTEXT
// =============================================================================

/**
 * Context provided to controllers during operations
 * Generic TShape defaults to shape with id property
 */
export interface ControllerContext<TShape = { id: string }> {
  /** All shapes */
  shapes: TShape[];
  /** Currently selected shape IDs */
  selectedIds: string[];
  /** Get shape by ID */
  getShape: (id: string) => TShape | undefined;
  /** Find topmost shape at point */
  findShapeAtPoint: (point: Point) => TShape | null;
}

// =============================================================================
// CONTROLLER ACTION
// =============================================================================

/**
 * Action returned by controller operations
 * Generic TShape defaults to shape with id property
 */
export interface ControllerAction<TShape = { id: string }> {
  /** Shape to add */
  addShape?: TShape;
  /** New selection (replaces current) */
  setSelection?: string[];
  /** Updated shapes (for move operations) */
  updateShapes?: TShape[];
  /** Preview shape to render */
  preview?: TShape | null;
  /** Clear preview */
  clearPreview?: boolean;
}

// =============================================================================
// DRAWING CONTROLLER
// =============================================================================

/**
 * Unified drawing controller interface
 *
 * All controllers (drawing, select, etc.) implement this interface.
 */
export interface DrawingController<TShape = { id: string }> {
  /** Handle mouse down */
  onStart(
    point: Point,
    style: ShapeStyle,
    modifiers: DrawModifiers,
    context: ControllerContext<TShape>
  ): ControllerAction<TShape>;

  /** Handle mouse move */
  onMove(point: Point, modifiers: DrawModifiers): ControllerAction<TShape>;

  /** Handle mouse up */
  onEnd(): ControllerAction<TShape>;

  /**
   * Handle double-click (optional)
   * Can receive point and context for advanced operations (e.g., vertex editing)
   */
  onDblClick?(
    point?: Point,
    modifiers?: DrawModifiers,
    context?: ControllerContext<TShape>
  ): ControllerAction<TShape>;

  /**
   * Handle keyboard events (optional)
   * Used for Delete/Backspace in vertex edit mode, etc.
   */
  onKeyDown?(
    key: string,
    modifiers: DrawModifiers,
    context: ControllerContext<TShape>
  ): ControllerAction<TShape>;

  /** Cancel current operation */
  onCancel(): void;

  /** Reset controller state */
  reset(): void;
}

// =============================================================================
// MULTI-CLICK CONTROLLER
// =============================================================================

/**
 * Extended interface for polygon-like controllers (multi-click)
 */
export interface MultiClickController<TShape = { id: string }>
  extends DrawingController<TShape> {
  /** Check if can close (enough points) */
  canClose(): boolean;
  /** Check if near start point */
  isNearStart(): boolean;
}
