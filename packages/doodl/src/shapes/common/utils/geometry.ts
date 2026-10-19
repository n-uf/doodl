/**
 * Geometry utilities shared across shapes
 */

import type { Bounds, Point } from "../../../types/geometry";
import type { DrawModifiers } from "../../../types/input";

// =============================================================================
// CONSTANTS
// =============================================================================

/** Default tolerance for stroke hit testing (pixels) */
export const DEFAULT_STROKE_TOLERANCE = 5;

// =============================================================================
// POINT UTILITIES
// =============================================================================

/**
 * Calculate distance between two points
 */
export function distanceBetweenPoints(p1: Point, p2: Point): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calculate distance from a point to a line segment
 */
export function distanceToLineSegment(
  point: Point,
  p1: Point,
  p2: Point
): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) {
    return distanceBetweenPoints(point, p1);
  }

  let t = ((point.x - p1.x) * dx + (point.y - p1.y) * dy) / lengthSquared;
  t = Math.max(0, Math.min(1, t));

  const closestX = p1.x + t * dx;
  const closestY = p1.y + t * dy;

  return distanceBetweenPoints(point, { x: closestX, y: closestY });
}

// =============================================================================
// BOUNDS UTILITIES
// =============================================================================

/**
 * Test if a point is inside bounds
 */
export function isPointInBounds(point: Point, bounds: Bounds): boolean {
  return (
    point.x >= bounds.x &&
    point.x <= bounds.x + bounds.width &&
    point.y >= bounds.y &&
    point.y <= bounds.y + bounds.height
  );
}

/**
 * Calculate drawing bounds from start/current points with modifier support
 * - Shift: Constrain to square (equal width/height)
 * - Alt: Draw from center
 */
export function calculateDrawingBounds(
  startPoint: Point,
  currentPoint: Point,
  modifiers: DrawModifiers
): Bounds {
  let width = currentPoint.x - startPoint.x;
  let height = currentPoint.y - startPoint.y;

  if (modifiers.shift) {
    const maxDim = Math.max(Math.abs(width), Math.abs(height));
    width = Math.sign(width) * maxDim;
    height = Math.sign(height) * maxDim;
  }

  if (modifiers.alt) {
    return {
      x: startPoint.x - Math.abs(width),
      y: startPoint.y - Math.abs(height),
      width: Math.abs(width) * 2,
      height: Math.abs(height) * 2,
    };
  }

  const x = width < 0 ? startPoint.x + width : startPoint.x;
  const y = height < 0 ? startPoint.y + height : startPoint.y;

  return {
    x,
    y,
    width: Math.abs(width),
    height: Math.abs(height),
  };
}

/**
 * Merge multiple bounds into one encompassing bounds
 */
export function mergeBounds(boundsList: Bounds[]): Bounds | null {
  if (boundsList.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const bounds of boundsList) {
    minX = Math.min(minX, bounds.x);
    minY = Math.min(minY, bounds.y);
    maxX = Math.max(maxX, bounds.x + bounds.width);
    maxY = Math.max(maxY, bounds.y + bounds.height);
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/**
 * Convert bounds to ellipse parameters (center and radii)
 */
export function boundsToEllipse(bounds: Bounds): {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
} {
  return {
    cx: bounds.x + bounds.width / 2,
    cy: bounds.y + bounds.height / 2,
    rx: bounds.width / 2,
    ry: bounds.height / 2,
  };
}
