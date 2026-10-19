/**
 * Freehand Controller
 *
 * Handles freehand path drawing with continuous point capture.
 * - Mouse down: Start path
 * - Mouse move: Capture points
 * - Mouse up: Complete path with simplification
 */

import type { Point } from "../../types/geometry";
import type { DrawModifiers } from "../../types/input";
import type { ShapeStyle } from "../../types/style";
import {
  NO_ACTION,
  type ControllerAction,
  type ControllerContext,
  type DrawingController,
} from "../common/controllers";
import type { DrawShape } from "../common/registry";
import { generateShapeId } from "../common/registry";
import { DEFAULT_EPSILON, simplifyPath } from "./simplification";
import type { FreehandShape } from "./types";

/**
 * Minimum distance between captured points (prevents too many points)
 */
const MIN_POINT_DISTANCE = 2;

/**
 * Minimum points for a valid freehand path
 */
const MIN_FREEHAND_POINTS = 3;

/**
 * Freehand controller
 */
export class FreehandController implements DrawingController<DrawShape> {
  private _isDrawing: boolean = false;
  private _points: Point[] = [];
  private _style: ShapeStyle | null = null;
  private _modifiers: DrawModifiers = { shift: false, ctrl: false, alt: false };
  private _epsilon: number = DEFAULT_EPSILON;
  private _closePath: boolean = false;

  /**
   * Set simplification epsilon
   */
  setEpsilon(epsilon: number): void {
    this._epsilon = Math.max(0.1, epsilon);
  }

  /**
   * Set whether to close the path
   */
  setClosePath(close: boolean): void {
    this._closePath = close;
  }

  onStart(
    point: Point,
    style: ShapeStyle,
    modifiers: DrawModifiers,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- Parameter prefixed with _ is intentionally unused
    _context: ControllerContext<DrawShape>
  ): ControllerAction<DrawShape> {
    this._isDrawing = true;
    this._points = [{ ...point }];
    this._style = { ...style };
    this._modifiers = { ...modifiers };
    return { preview: this.createPreview() };
  }

  onMove(point: Point, modifiers: DrawModifiers): ControllerAction<DrawShape> {
    if (!this._isDrawing) return NO_ACTION;
    this._modifiers = { ...modifiers };

    // Only add point if it's far enough from the last point
    const lastPoint = this._points[this._points.length - 1];
    if (lastPoint) {
      const distance = Math.sqrt(
        (point.x - lastPoint.x) ** 2 + (point.y - lastPoint.y) ** 2
      );
      if (distance >= MIN_POINT_DISTANCE) {
        this._points.push({ ...point });
      }
    }

    return { preview: this.createPreview() };
  }

  onEnd(): ControllerAction<DrawShape> {
    if (!this._isDrawing || !this._style) {
      this.reset();
      return { clearPreview: true };
    }

    if (this._points.length < MIN_FREEHAND_POINTS) {
      this.reset();
      return { clearPreview: true };
    }

    // Simplify the path
    const simplifiedPoints = simplifyPath(this._points, this._epsilon);

    const shape: FreehandShape = {
      id: generateShapeId(),
      type: "freehand",
      points: simplifiedPoints,
      closed: this._closePath,
      style: { ...this._style },
    };

    this.reset();

    return {
      addShape: shape,
      setSelection: [shape.id],
      clearPreview: true,
    };
  }

  onCancel(): void {
    this.reset();
  }

  reset(): void {
    this._isDrawing = false;
    this._points = [];
    this._style = null;
    this._modifiers = { shift: false, ctrl: false, alt: false };
    this._closePath = false;
  }

  /**
   * Create preview freehand for rendering
   */
  private createPreview(): DrawShape | null {
    if (!this._isDrawing || !this._style || this._points.length < 2) {
      return null;
    }

    // For preview, show raw points (no simplification)
    const preview: FreehandShape = {
      id: "preview-freehand",
      type: "freehand",
      points: [...this._points],
      closed: this._closePath,
      style: { ...this._style },
    };

    return preview;
  }
}

/**
 * Create a new freehand controller
 */
export function createFreehandController(): FreehandController {
  return new FreehandController();
}

/**
 * Create a highlight controller (freehand with closed path)
 */
export function createHighlightController(): FreehandController {
  const controller = new FreehandController();
  controller.setClosePath(true);
  controller.setEpsilon(4);
  return controller;
}
