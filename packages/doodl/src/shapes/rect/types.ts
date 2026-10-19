/**
 * Rectangle type definitions
 */

import type { Bounds } from "../../types/geometry";
import type { ShapeStyle } from "../../types/style";
import { DEFAULT_SHAPE_STYLE } from "../../types/style";
import type { DrawShape } from "../common/registry";
import { generateShapeId } from "../common/registry";

/**
 * Rectangle shape
 * Axis-aligned bounding box
 */
export interface RectShape extends DrawShape {
  type: "rect";
  /** Top-left X coordinate */
  x: number;
  /** Top-left Y coordinate */
  y: number;
  /** Width */
  width: number;
  /** Height */
  height: number;
  /** Rotation in degrees (optional) */
  rotation?: number;
}

/**
 * Create a rectangle shape
 */
export function createRectShape(
  x: number,
  y: number,
  width: number,
  height: number,
  style: ShapeStyle = DEFAULT_SHAPE_STYLE
): RectShape {
  return {
    id: generateShapeId(),
    type: "rect",
    x,
    y,
    width,
    height,
    style,
  };
}

/**
 * Get bounding box of a rectangle
 */
export function getRectBounds(rect: RectShape): Bounds {
  return {
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
  };
}

/**
 * Type guard to check if a DrawShape is a RectShape
 */
export function isRectShape(shape: DrawShape): shape is RectShape {
  return shape.type === "rect";
}
