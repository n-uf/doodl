/**
 * Coordinate transformation utilities for page annotation
 *
 * Handles conversion between:
 * - Page coordinates (native units, e.g., PDF points at 72 DPI)
 * - Canvas coordinates (screen pixels at current scale)
 */

import type { Bounds, DrawShape, Point } from "@n-uf/doodl";

/**
 * Transform a point by scale factor
 */
export function transformPoint(point: Point, scale: number): Point {
  return {
    x: point.x * scale,
    y: point.y * scale,
  };
}

/**
 * Transform bounds by scale factor
 */
export function transformBounds(bounds: Bounds, scale: number): Bounds {
  return {
    x: bounds.x * scale,
    y: bounds.y * scale,
    width: bounds.width * scale,
    height: bounds.height * scale,
  };
}

/**
 * Transform shape coordinates by scale factor
 * Handles all shape types: rect, ellipse, polygon, freehand, text, text-highlight
 */
export function transformShapeCoords(
  shape: DrawShape,
  scale: number
): DrawShape {
  // Use a more permissive type to allow dynamic property access
  const transformed = { ...shape } as DrawShape & {
    bounds?: Bounds;
    points?: Point[];
    position?: Point;
    fontSize?: number;
    rects?: Bounds[];
  };

  // Transform bounds (common to all shapes)
  if (transformed.bounds) {
    transformed.bounds = transformBounds(transformed.bounds, scale);
  }

  // Transform type-specific coordinates
  switch (shape.type) {
    case "rect":
    case "ellipse":
      // Bounds only - already handled
      break;

    case "polygon": {
      const polygonShape = shape as DrawShape & { points?: Point[] };
      if (polygonShape.points) {
        transformed.points = polygonShape.points.map((p) =>
          transformPoint(p, scale)
        );
      }
      break;
    }

    case "freehand": {
      const freehandShape = shape as DrawShape & { points?: Point[] };
      if (freehandShape.points) {
        transformed.points = freehandShape.points.map((p) =>
          transformPoint(p, scale)
        );
      }
      break;
    }

    case "text": {
      const textShape = shape as DrawShape & {
        position?: Point;
        fontSize?: number;
      };
      if (textShape.position) {
        transformed.position = transformPoint(textShape.position, scale);
      }
      // Scale font size
      if (textShape.fontSize !== undefined) {
        transformed.fontSize = textShape.fontSize * scale;
      }
      break;
    }

    case "text-highlight": {
      const highlightShape = shape as DrawShape & { rects?: Bounds[] };
      if (highlightShape.rects) {
        transformed.rects = highlightShape.rects.map((r) =>
          transformBounds(r, scale)
        );
      }
      break;
    }
  }

  return transformed as DrawShape;
}

/**
 * Convert page coordinates to canvas coordinates
 */
export function pageToCanvasCoords(shape: DrawShape, scale: number): DrawShape {
  return transformShapeCoords(shape, scale);
}

/**
 * Convert canvas coordinates to page coordinates
 */
export function canvasToPageCoords(shape: DrawShape, scale: number): DrawShape {
  return transformShapeCoords(shape, 1 / scale);
}
