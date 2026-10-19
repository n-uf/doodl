/**
 * Polygon type definitions
 */

import type { Bounds, Point } from "../../types/geometry";
import type { ShapeStyle } from "../../types/style";
import { DEFAULT_SHAPE_STYLE } from "../../types/style";
import type { DrawShape } from "../common/registry";
import { generateShapeId } from "../common/registry";

/**
 * Polygon shape
 * Closed polygon defined by ordered vertex array
 */
export interface PolygonShape extends DrawShape {
  type: "polygon";
  /** Ordered vertices (auto-closed) */
  points: Point[];
}

/**
 * Create a polygon shape
 */
export function createPolygonShape(
  points: Point[],
  style: ShapeStyle = DEFAULT_SHAPE_STYLE
): PolygonShape {
  return {
    id: generateShapeId(),
    type: "polygon",
    points: [...points],
    style,
  };
}

/**
 * Get bounding box of a polygon
 */
export function getPolygonBounds(polygon: PolygonShape): Bounds {
  if (polygon.points.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
  const xs = polygon.points.map((p) => p.x);
  const ys = polygon.points.map((p) => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}
