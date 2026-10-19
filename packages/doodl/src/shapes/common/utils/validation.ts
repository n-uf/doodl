/**
 * Common validation utilities
 */

import type { Point } from "../../../types/geometry";
import type { ShapeStyle, StrokeAlign } from "../../../types/style";

const STROKE_ALIGNS: ReadonlySet<StrokeAlign> = new Set([
  "center",
  "outside",
  "inside",
]);

const LINE_CAPS: ReadonlySet<CanvasLineCap> = new Set([
  "butt",
  "round",
  "square",
]);

const LINE_JOINS: ReadonlySet<CanvasLineJoin> = new Set([
  "round",
  "bevel",
  "miter",
]);

/**
 * Validate a point object
 */
export function isValidPoint(obj: unknown): obj is Point {
  return (
    typeof obj === "object" &&
    obj !== null &&
    typeof (obj as Point).x === "number" &&
    typeof (obj as Point).y === "number" &&
    !isNaN((obj as Point).x) &&
    !isNaN((obj as Point).y)
  );
}

function isValidOutline(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const outline = value as {
    stroke?: unknown;
    strokeWidth?: unknown;
    offset?: unknown;
    strokeOpacity?: unknown;
    strokeDash?: unknown;
    glow?: unknown;
    style?: unknown;
    armLength?: unknown;
  };
  if (typeof outline.stroke !== "string") return false;
  if (
    outline.strokeWidth !== undefined &&
    typeof outline.strokeWidth !== "number"
  ) {
    return false;
  }
  if (outline.offset !== undefined && typeof outline.offset !== "number") {
    return false;
  }
  if (
    outline.style !== undefined &&
    outline.style !== "ring" &&
    outline.style !== "corner-bracket"
  ) {
    return false;
  }
  if (outline.armLength !== undefined && typeof outline.armLength !== "number") {
    return false;
  }
  if (
    outline.strokeOpacity !== undefined &&
    typeof outline.strokeOpacity !== "number"
  ) {
    return false;
  }
  if (outline.strokeDash !== undefined && !Array.isArray(outline.strokeDash)) {
    return false;
  }
  if (outline.glow !== undefined) {
    if (typeof outline.glow !== "object" || outline.glow === null) return false;
    const glow = outline.glow as { color?: unknown; blur?: unknown };
    if (typeof glow.color !== "string") return false;
    if (glow.blur !== undefined && typeof glow.blur !== "number") return false;
  }
  return true;
}

function isValidShadow(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const shadow = value as {
    color?: unknown;
    blur?: unknown;
    offsetX?: unknown;
    offsetY?: unknown;
  };
  if (typeof shadow.color !== "string") return false;
  if (shadow.blur !== undefined && typeof shadow.blur !== "number") return false;
  if (shadow.offsetX !== undefined && typeof shadow.offsetX !== "number") {
    return false;
  }
  if (shadow.offsetY !== undefined && typeof shadow.offsetY !== "number") {
    return false;
  }
  return true;
}

/**
 * Validate a shape style object
 */
export function isValidStyle(obj: unknown): obj is ShapeStyle {
  if (typeof obj !== "object" || obj === null) return false;
  const style = obj as ShapeStyle;

  if (style.fill !== undefined && typeof style.fill !== "string") return false;
  if (style.fillOpacity !== undefined && typeof style.fillOpacity !== "number")
    return false;
  if (style.stroke !== undefined && typeof style.stroke !== "string")
    return false;
  if (style.strokeWidth !== undefined && typeof style.strokeWidth !== "number")
    return false;
  if (
    style.strokeOpacity !== undefined &&
    typeof style.strokeOpacity !== "number"
  )
    return false;
  if (style.strokeDash !== undefined && !Array.isArray(style.strokeDash))
    return false;
  if (
    style.strokeDashOffset !== undefined &&
    typeof style.strokeDashOffset !== "number"
  ) {
    return false;
  }
  if (
    style.strokeAlign !== undefined &&
    !STROKE_ALIGNS.has(style.strokeAlign)
  ) {
    return false;
  }
  if (
    style.screenSpaceStroke !== undefined &&
    typeof style.screenSpaceStroke !== "boolean"
  ) {
    return false;
  }
  if (
    style.strokeLineCap !== undefined &&
    !LINE_CAPS.has(style.strokeLineCap)
  ) {
    return false;
  }
  if (
    style.strokeLineJoin !== undefined &&
    !LINE_JOINS.has(style.strokeLineJoin)
  ) {
    return false;
  }
  if (style.miterLimit !== undefined && typeof style.miterLimit !== "number") {
    return false;
  }
  if (
    style.cornerRadius !== undefined &&
    typeof style.cornerRadius !== "number"
  ) {
    return false;
  }
  if (style.outline !== undefined && !isValidOutline(style.outline)) {
    return false;
  }
  if (style.shadow !== undefined && !isValidShadow(style.shadow)) {
    return false;
  }
  if (style.blendMode !== undefined && typeof style.blendMode !== "string")
    return false;

  return true;
}

/**
 * Validate base shape properties (id, type, style)
 */
export function hasValidDrawShape(obj: unknown, expectedType: string): boolean {
  if (typeof obj !== "object" || obj === null) return false;
  const shape = obj as { id?: unknown; type?: unknown; style?: unknown };

  if (typeof shape.id !== "string" || shape.id.length === 0) return false;
  if (shape.type !== expectedType) return false;
  if (!isValidStyle(shape.style)) return false;

  return true;
}
