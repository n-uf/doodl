/**
 * Polygon Controller
 *
 * Handles polygon drawing with click-to-add-vertex interaction.
 * - Click: Add vertex
 * - Double-click: Close polygon
 * - Click near start: Close polygon
 * - Escape: Cancel
 */

import { MIN_POLYGON_VERTICES, POLYGON_CLOSE_THRESHOLD } from "../../config";
import type { DrawModifiers, Point } from "../../types";
import type { ShapeStyle } from "../../types/style";
import {
  NO_ACTION,
  type ControllerAction,
  type ControllerContext,
  type MultiClickController,
} from "../common/controllers";
import type { DrawShape } from "../common/registry";
import { generateShapeId } from "../common/registry";
import type { PolygonShape } from "./types";

/**
 * Polygon controller
 */
export class PolygonController implements MultiClickController<DrawShape> {
  private _isDrawing: boolean = false;
  private _points: Point[] = [];
  private _currentPoint: Point | null = null;
  private _style: ShapeStyle | null = null;
  private _modifiers: DrawModifiers = { shift: false, ctrl: false, alt: false };

  /* eslint-disable @typescript-eslint/no-unused-vars */ // Parameters prefixed with _ are intentionally unused
  onStart(
    point: Point,
    style: ShapeStyle,
    modifiers: DrawModifiers,
    _context: ControllerContext<DrawShape>
  ): ControllerAction<DrawShape> {
    if (!this._isDrawing) {
      // First click - start new polygon
      this._isDrawing = true;
      this._points = [{ ...point }];
      this._currentPoint = { ...point };
      this._style = { ...style };
      this._modifiers = { ...modifiers };
    } else {
      // Subsequent click - add vertex
      this.addVertex(point);
    }
    return { preview: this.createPreview() };
  }

  onMove(point: Point, modifiers: DrawModifiers): ControllerAction<DrawShape> {
    if (!this._isDrawing) return NO_ACTION;
    this._currentPoint = { ...point };
    this._modifiers = { ...modifiers };
    return { preview: this.createPreview() };
  }

  onEnd(): ControllerAction<DrawShape> {
    if (!this._isDrawing) return NO_ACTION;

    // Check if clicking near start to close
    if (this.isNearStart()) {
      return this.closeAndFinish();
    }

    // Stay in drawing mode, just return preview
    return { preview: this.createPreview() };
  }

  /* eslint-disable @typescript-eslint/no-unused-vars */ // Parameters prefixed with _ are intentionally unused
  onDblClick(
    _point?: Point,
    _modifiers?: DrawModifiers,
    _context?: ControllerContext<DrawShape>
  ): ControllerAction<DrawShape> {
    if (this.canClose()) {
      return this.closeAndFinish();
    }
    this.reset();
    return { clearPreview: true };
  }

  canClose(): boolean {
    return this._points.length >= MIN_POLYGON_VERTICES;
  }

  isNearStart(): boolean {
    if (!this._currentPoint || this._points.length < MIN_POLYGON_VERTICES) {
      return false;
    }
    const start = this._points[0]!;
    const distance = Math.sqrt(
      (this._currentPoint.x - start.x) ** 2 +
        (this._currentPoint.y - start.y) ** 2
    );
    return distance < POLYGON_CLOSE_THRESHOLD;
  }

  onCancel(): void {
    this.reset();
  }

  reset(): void {
    this._isDrawing = false;
    this._points = [];
    this._currentPoint = null;
    this._style = null;
    this._modifiers = { shift: false, ctrl: false, alt: false };
  }

  /**
   * Add a vertex at the given point
   */
  private addVertex(point: Point): void {
    // Check if clicking near start to close
    if (this._points.length >= MIN_POLYGON_VERTICES) {
      const start = this._points[0]!;
      const distance = Math.sqrt(
        (point.x - start.x) ** 2 + (point.y - start.y) ** 2
      );
      if (distance < POLYGON_CLOSE_THRESHOLD) {
        // Will close on onEnd, don't add vertex
        return;
      }
    }

    // Add new vertex
    this._points.push({ ...point });
  }

  /**
   * Close polygon and return finished shape
   */
  private closeAndFinish(): ControllerAction<DrawShape> {
    if (!this._style || this._points.length < MIN_POLYGON_VERTICES) {
      this.reset();
      return { clearPreview: true };
    }

    const shape: PolygonShape = {
      id: generateShapeId(),
      type: "polygon",
      points: [...this._points],
      style: { ...this._style },
    };

    this.reset();

    return {
      addShape: shape,
      setSelection: [shape.id],
      clearPreview: true,
    };
  }

  /**
   * Create preview polygon for rendering
   */
  private createPreview(): DrawShape | null {
    if (!this._isDrawing || !this._style || this._points.length === 0) {
      return null;
    }

    // Create preview with current cursor position as last vertex
    const previewPoints = [...this._points];
    if (this._currentPoint) {
      previewPoints.push({ ...this._currentPoint });
    }

    const preview: PolygonShape = {
      id: "preview-polygon",
      type: "polygon",
      points: previewPoints,
      style: {
        ...this._style,
        // Make preview slightly transparent
        fillOpacity: (this._style.fillOpacity ?? 1) * 0.5,
      },
    };

    return preview;
  }
}

/**
 * Create a new polygon controller
 */
export function createPolygonController(): PolygonController {
  return new PolygonController();
}
