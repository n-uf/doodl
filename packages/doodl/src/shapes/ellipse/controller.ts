/**
 * Ellipse Controller
 *
 * Handles ellipse/circle drawing with modifier support.
 * - Shift: Constrain to circle
 * - Alt: Draw from center
 */

import { BaseController } from "../common/controllers";
import type { DrawShape } from "../common/registry";
import { generateShapeId } from "../common/registry";
import { boundsToEllipse } from "../common/utils/geometry";
import type { EllipseShape } from "./types";

/**
 * Minimum radius for a valid ellipse (in pixels)
 */
const MIN_ELLIPSE_RADIUS = 2;

/**
 * Ellipse controller
 */
export class EllipseController extends BaseController {
  /**
   * Create the ellipse shape from current bounds
   */
  protected createShape(): DrawShape | null {
    const bounds = this.calculateBounds();
    if (!bounds || !this._style) return null;

    const ellipse = boundsToEllipse(bounds);
    if (ellipse.rx < MIN_ELLIPSE_RADIUS || ellipse.ry < MIN_ELLIPSE_RADIUS) {
      return null;
    }

    const shape: EllipseShape = {
      id: generateShapeId(),
      type: "ellipse",
      cx: ellipse.cx,
      cy: ellipse.cy,
      rx: ellipse.rx,
      ry: ellipse.ry,
      style: { ...this._style },
    };

    return shape;
  }

  /**
   * Create preview ellipse for rendering
   */
  protected createPreview(): DrawShape | null {
    if (!this._isDrawing || !this._style) return null;

    const bounds = this.calculateBounds();
    if (!bounds) return null;

    const ellipse = boundsToEllipse(bounds);

    const preview: EllipseShape = {
      id: "preview-ellipse",
      type: "ellipse",
      cx: ellipse.cx,
      cy: ellipse.cy,
      rx: ellipse.rx,
      ry: ellipse.ry,
      style: { ...this._style },
    };

    return preview;
  }
}

/**
 * Create a new ellipse controller
 */
export function createEllipseController(): EllipseController {
  return new EllipseController();
}
