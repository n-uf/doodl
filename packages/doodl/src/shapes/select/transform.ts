/**
 * Transform System - Unified transformation for shapes
 *
 * Provides a clean abstraction for:
 * - Translate (move/drag)
 * - Scale (resize via handles)
 * - Future: Rotate, Skew
 *
 * @module shapes/select/transform
 */

import type { Bounds, Point } from "../../types";
import { getShapeBounds } from "../common/dispatch";
import type { DrawShape } from "../common/registry";
import { getShapeModule } from "../common/registry";
import type { HandlePosition } from "./selection-ui";

// =============================================================================
// TRANSFORM TYPES
// =============================================================================

/**
 * Transform operation type
 */
export type TransformType = "translate" | "scale";

/**
 * Transform origin for scale operations
 */
export interface TransformOrigin {
  x: number;
  y: number;
}

/**
 * Transform parameters
 */
export interface Transform {
  type: TransformType;
  /** Translation delta */
  translate?: Point;
  /** Scale factors */
  scale?: { x: number; y: number };
  /** Origin point for scaling */
  origin?: TransformOrigin;
  /** New bounds after transformation */
  bounds?: Bounds;
}

/**
 * Transform state for tracking an active transformation
 */
export interface TransformState {
  /** Transform type in progress */
  type: TransformType;
  /** Starting mouse position */
  startPoint: Point;
  /** Current mouse position */
  currentPoint: Point;
  /** Original bounds of selection */
  originalBounds: Bounds;
  /** Handle being dragged (for scale) */
  handle: HandlePosition | null;
  /** Whether to constrain proportions */
  constrain: boolean;
  /** Original shapes before transform */
  originalShapes: Map<string, DrawShape>;
}

// =============================================================================
// TRANSFORM CALCULATIONS
// =============================================================================

/**
 * Calculate translate transform from drag delta
 */
export function calculateTranslate(
  startPoint: Point,
  currentPoint: Point
): Transform {
  return {
    type: "translate",
    translate: {
      x: currentPoint.x - startPoint.x,
      y: currentPoint.y - startPoint.y,
    },
  };
}

/**
 * Calculate scale transform from handle drag
 */
export function calculateScale(
  originalBounds: Bounds,
  startPoint: Point,
  currentPoint: Point,
  handle: HandlePosition,
  constrain: boolean
): Transform {
  const dx = currentPoint.x - startPoint.x;
  const dy = currentPoint.y - startPoint.y;

  let { x, y, width, height } = originalBounds;

  // Apply delta based on handle position
  switch (handle) {
    case "top-left":
      x += dx;
      y += dy;
      width -= dx;
      height -= dy;
      break;
    case "top":
      y += dy;
      height -= dy;
      break;
    case "top-right":
      y += dy;
      width += dx;
      height -= dy;
      break;
    case "right":
      width += dx;
      break;
    case "bottom-right":
      width += dx;
      height += dy;
      break;
    case "bottom":
      height += dy;
      break;
    case "bottom-left":
      x += dx;
      width -= dx;
      height += dy;
      break;
    case "left":
      x += dx;
      width -= dx;
      break;
  }

  // Enforce minimum size
  const minSize = 1;
  if (width < minSize) {
    width = minSize;
    if (
      handle === "left" ||
      handle === "top-left" ||
      handle === "bottom-left"
    ) {
      x = originalBounds.x + originalBounds.width - minSize;
    }
  }
  if (height < minSize) {
    height = minSize;
    if (handle === "top" || handle === "top-left" || handle === "top-right") {
      y = originalBounds.y + originalBounds.height - minSize;
    }
  }

  // Constrain aspect ratio
  if (constrain && originalBounds.width > 0 && originalBounds.height > 0) {
    const ratio = originalBounds.width / originalBounds.height;
    const newRatio = width / height;

    if (newRatio > ratio) {
      width = height * ratio;
    } else {
      height = width / ratio;
    }
  }

  const scaleX = width / originalBounds.width;
  const scaleY = height / originalBounds.height;

  return {
    type: "scale",
    scale: { x: scaleX, y: scaleY },
    origin: { x: originalBounds.x, y: originalBounds.y },
    bounds: { x, y, width, height },
  };
}

// =============================================================================
// APPLY TRANSFORMS
// =============================================================================

/**
 * Apply a transform to a single shape
 */
export function applyTransform(
  shape: DrawShape,
  transform: Transform,
  originalBounds: Bounds
): DrawShape {
  switch (transform.type) {
    case "translate":
      return applyTranslate(shape, transform.translate!);
    case "scale":
      return applyScale(shape, transform, originalBounds);
    default:
      return shape;
  }
}

/**
 * Apply translation to a shape using the shape registry's transform function
 */
export function applyTranslate(shape: DrawShape, delta: Point): DrawShape {
  const module = getShapeModule(shape);
  return module.transform(shape, delta);
}

/**
 * Apply scale transform to a shape
 *
 * Note: Scale is more complex than translate - each shape type needs specific
 * handling for its geometry. Unlike translate (which uses registry.transform()),
 * scale logic is centralized here since shapes have different scaling semantics.
 */
export function applyScale(
  shape: DrawShape,
  transform: Transform,
  selectionBounds: Bounds
): DrawShape {
  const { scale, bounds: newBounds } = transform;
  if (!scale || !newBounds) return shape;

  const shapeBounds = getShapeBounds(shape);
  const type = shape.type;

  // Calculate relative position within selection
  const relX = (shapeBounds.x - selectionBounds.x) / selectionBounds.width;
  const relY = (shapeBounds.y - selectionBounds.y) / selectionBounds.height;
  const relW = shapeBounds.width / selectionBounds.width;
  const relH = shapeBounds.height / selectionBounds.height;

  // Calculate new position and size
  const newX = newBounds.x + relX * newBounds.width;
  const newY = newBounds.y + relY * newBounds.height;
  const newW = relW * newBounds.width;
  const newH = relH * newBounds.height;

  if (type === "rect") {
    return {
      ...shape,
      x: newX,
      y: newY,
      width: newW,
      height: newH,
    } as DrawShape;
  }

  if (type === "ellipse") {
    // Ellipse uses cx, cy (center) and rx, ry (radii)
    return {
      ...shape,
      cx: newX + newW / 2,
      cy: newY + newH / 2,
      rx: newW / 2,
      ry: newH / 2,
    } as DrawShape;
  }

  if (type === "polygon" || type === "freehand") {
    const s = shape as DrawShape & { points: Point[] };
    const scaledPoints = s.points.map((p) => ({
      x: newX + ((p.x - shapeBounds.x) / shapeBounds.width) * newW,
      y: newY + ((p.y - shapeBounds.y) / shapeBounds.height) * newH,
    }));

    return {
      ...shape,
      points: scaledPoints,
    } as DrawShape;
  }

  if (type === "text") {
    // Text: update position, scale font size proportionally
    const s = shape as DrawShape & { x: number; y: number; fontSize: number };
    return {
      ...shape,
      x: newX,
      y: newY,
      fontSize: s.fontSize * ((scale.x + scale.y) / 2),
    } as DrawShape;
  }

  if (type === "text-highlight") {
    // Text highlight: scale all rects proportionally
    const s = shape as DrawShape & { rects: Bounds[] };
    const scaledRects = s.rects.map((rect) => ({
      x: newX + ((rect.x - shapeBounds.x) / shapeBounds.width) * newW,
      y: newY + ((rect.y - shapeBounds.y) / shapeBounds.height) * newH,
      width: (rect.width / shapeBounds.width) * newW,
      height: (rect.height / shapeBounds.height) * newH,
    }));

    return {
      ...shape,
      rects: scaledRects,
      anchor: undefined, // Clear anchor since position changed
    } as DrawShape;
  }

  return shape;
}

/**
 * Apply transform to multiple shapes
 */
export function applyTransformToShapes(
  shapes: Map<string, DrawShape>,
  transform: Transform,
  originalBounds: Bounds
): DrawShape[] {
  const result: DrawShape[] = [];

  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- _id is intentionally unused in destructuring
  for (const [_id, shape] of shapes) {
    result.push(applyTransform(shape, transform, originalBounds));
  }

  return result;
}
