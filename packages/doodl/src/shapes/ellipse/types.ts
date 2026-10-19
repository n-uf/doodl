/**
 * Ellipse type definitions
 */

import type { Bounds } from "../../types/geometry";
import type { ShapeStyle } from "../../types/style";
import { DEFAULT_SHAPE_STYLE } from "../../types/style";
import type { DrawShape } from "../common/registry";
import { generateShapeId } from "../common/registry";

/**
 * Ellipse shape
 * Defined by center and radii
 */
export interface EllipseShape extends DrawShape {
  type: "ellipse";
  /** Center X coordinate */
  cx: number;
  /** Center Y coordinate */
  cy: number;
  /** Horizontal radius */
  rx: number;
  /** Vertical radius */
  ry: number;
  /** Rotation in degrees (optional) */
  rotation?: number;
}

/**
 * Create an ellipse shape
 */
export function createEllipseShape(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  style: ShapeStyle = DEFAULT_SHAPE_STYLE
): EllipseShape {
  return {
    id: generateShapeId(),
    type: "ellipse",
    cx,
    cy,
    rx,
    ry,
    style,
  };
}

/**
 * Get bounding box of an ellipse
 */
export function getEllipseBounds(ellipse: EllipseShape): Bounds {
  return {
    x: ellipse.cx - ellipse.rx,
    y: ellipse.cy - ellipse.ry,
    width: ellipse.rx * 2,
    height: ellipse.ry * 2,
  };
}
