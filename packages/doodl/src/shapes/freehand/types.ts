/**
 * Freehand type definitions
 */

import type { Bounds, Point } from "../../types/geometry";
import type { ShapeStyle } from "../../types/style";
import { DEFAULT_SHAPE_STYLE } from "../../types/style";
import type { DrawShape } from "../common/registry";
import { generateShapeId } from "../common/registry";

/**
 * How freehand vertices are connected when painted.
 * - `"smooth"` (default) — quadratic mid-point curves (pen look).
 * - `"linear"` — straight segments between vertices (sharp corners / polylines).
 */
export type FreehandPathMode = "smooth" | "linear";

/**
 * Freehand shape
 * Path with optional closure; default render uses smooth curves.
 */
export interface FreehandShape extends DrawShape {
  type: "freehand";
  /** Path points (may be simplified) */
  points: Point[];
  /** Whether the path is closed */
  closed: boolean;
  /**
   * Vertex connection mode. Omitted / `"smooth"` keeps historical pen curves;
   * `"linear"` draws sharp polylines (brackets, markers, technical chrome).
   */
  pathMode?: FreehandPathMode;
}

/**
 * Create a freehand shape
 */
export function createFreehandShape(
  points: Point[],
  closed: boolean = false,
  style: ShapeStyle = DEFAULT_SHAPE_STYLE,
  pathMode: FreehandPathMode = "smooth",
): FreehandShape {
  return {
    id: generateShapeId(),
    type: "freehand",
    points: [...points],
    closed,
    style,
    ...(pathMode === "smooth" ? {} : { pathMode }),
  };
}

/**
 * Create a sharp polyline (freehand with {@link FreehandPathMode} `"linear"`).
 * Prefer this over 2-point freehand segments when you need multi-vertex
 * corners (L-brackets, underlines with joins, etc.).
 */
export function createPolylineShape(
  points: Point[],
  style: ShapeStyle = DEFAULT_SHAPE_STYLE,
  options: { closed?: boolean; id?: string } = {},
): FreehandShape {
  return {
    id: options.id ?? generateShapeId(),
    type: "freehand",
    points: [...points],
    closed: options.closed ?? false,
    pathMode: "linear",
    style,
  };
}

/**
 * Get bounding box of a freehand path
 */
export function getFreehandBounds(freehand: FreehandShape): Bounds {
  if (freehand.points.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
  const xs = freehand.points.map((p) => p.x);
  const ys = freehand.points.map((p) => p.y);
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
