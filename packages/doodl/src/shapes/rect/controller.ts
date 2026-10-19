/**
 * Rectangle Controller
 *
 * Handles rectangle/square drawing with modifier support.
 * - Shift: Constrain to square
 * - Alt: Draw from center
 */

import { MIN_SHAPE_SIZE } from "../../config";
import { BaseController } from "../common/controllers";
import type { DrawShape } from "../common/registry";
import { generateShapeId } from "../common/registry";
import type { RectShape } from "./types";

/**
 * Rectangle controller
 */
export class RectController extends BaseController {
  /**
   * Create the rectangle shape from current bounds
   */
  protected createShape(): DrawShape | null {
    const bounds = this.calculateBounds();
    if (
      !bounds ||
      !this._style ||
      bounds.width < MIN_SHAPE_SIZE ||
      bounds.height < MIN_SHAPE_SIZE
    ) {
      return null;
    }

    const shape: RectShape = {
      id: generateShapeId(),
      type: "rect",
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      style: { ...this._style },
    };

    return shape;
  }

  /**
   * Create preview rectangle for rendering
   */
  protected createPreview(): DrawShape | null {
    if (!this._isDrawing || !this._style) return null;

    const bounds = this.calculateBounds();
    if (!bounds) return null;

    const preview: RectShape = {
      id: "preview-rect",
      type: "rect",
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      style: { ...this._style },
    };

    return preview;
  }
}

/**
 * Create a new rectangle controller
 */
export function createRectController(): RectController {
  return new RectController();
}
