/**
 * Drawing Controllers
 *
 * Base classes for controller implementations.
 */

import type { Bounds, Point } from "../../types/geometry";
import type { DrawModifiers } from "../../types/input";
import type { ShapeStyle } from "../../types/style";
import type { DrawShape } from "./registry";
import type {
  ControllerAction,
  ControllerContext,
  DrawingController,
  MultiClickController,
} from "./types/controller";
import { calculateDrawingBounds } from "./utils/geometry";

// Re-export types
export type {
  ControllerAction,
  ControllerContext,
  DrawingController,
  MultiClickController,
} from "./types/controller";

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Empty action (no changes)
 */
export const NO_ACTION: ControllerAction<DrawShape> = {};

// =============================================================================
// TYPE GUARDS
// =============================================================================

/**
 * Check if controller supports multi-click
 */
export function isMultiClickController(
  controller: DrawingController<DrawShape>
): controller is MultiClickController<DrawShape> {
  return "canClose" in controller && "isNearStart" in controller;
}

// =============================================================================
// BASE CONTROLLER
// =============================================================================

/**
 * Base controller with common functionality for drawing controllers.
 *
 * Manages:
 * - Drawing state (isDrawing, startPoint, currentPoint)
 * - Style and modifiers
 * - Bounds calculation with shift/alt modifiers
 *
 * Subclasses implement:
 * - createShape(): Create the final shape from current state
 * - createPreview(): Create preview shape for rendering
 */
export abstract class BaseController implements DrawingController<DrawShape> {
  protected _isDrawing: boolean = false;
  protected _startPoint: Point | null = null;
  protected _currentPoint: Point | null = null;
  protected _style: ShapeStyle | null = null;
  protected _modifiers: DrawModifiers = {
    shift: false,
    ctrl: false,
    alt: false,
  };

  onStart(
    point: Point,
    style: ShapeStyle,
    modifiers: DrawModifiers,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- Parameter prefixed with _ is intentionally unused
    _context: ControllerContext<DrawShape>
  ): ControllerAction<DrawShape> {
    this._isDrawing = true;
    this._startPoint = { ...point };
    this._currentPoint = { ...point };
    this._style = { ...style };
    this._modifiers = { ...modifiers };
    return { preview: this.createPreview() };
  }

  onMove(point: Point, modifiers: DrawModifiers): ControllerAction<DrawShape> {
    if (!this._isDrawing) return NO_ACTION;
    this._currentPoint = { ...point };
    this._modifiers = { ...modifiers };
    return { preview: this.createPreview() };
  }

  onEnd(): ControllerAction<DrawShape> {
    if (!this._isDrawing || !this._style) {
      this.reset();
      return { clearPreview: true };
    }

    const shape = this.createShape();
    this.reset();

    if (shape) {
      return {
        addShape: shape,
        setSelection: [shape.id],
        clearPreview: true,
      };
    }
    return { clearPreview: true };
  }

  onCancel(): void {
    this.reset();
  }

  reset(): void {
    this._isDrawing = false;
    this._startPoint = null;
    this._currentPoint = null;
    this._style = null;
    this._modifiers = { shift: false, ctrl: false, alt: false };
  }

  /**
   * Create the final shape from current state
   * Returns null if shape is invalid (too small, etc.)
   */
  protected abstract createShape(): DrawShape | null;

  /**
   * Create preview shape for rendering
   * Returns null if no valid preview
   */
  protected abstract createPreview(): DrawShape | null;

  /**
   * Calculate bounds from start to current point
   * Applies shift (constrain) and alt (center) modifiers
   */
  protected calculateBounds(): Bounds | null {
    if (!this._startPoint || !this._currentPoint) return null;
    return calculateDrawingBounds(
      this._startPoint,
      this._currentPoint,
      this._modifiers
    );
  }
}
