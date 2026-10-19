/**
 * Bounds Policy Types
 *
 * Defines how shapes that exceed canvas bounds are handled.
 */

import type { Bounds, Point } from "./geometry";

/**
 * Policy for shapes that exceed canvas bounds.
 * Applied to ALL shape operations (add, update, import, move).
 *
 * - "constrain": Translate/crop shape to fit within bounds (default)
 * - "reject": Don't add shape, log warning
 * - "allow": Allow shape outside bounds (no enforcement)
 */
export type BoundsPolicy = "constrain" | "reject" | "allow";

/**
 * Result of bounds enforcement
 */
export type BoundsEnforcementResult<T> =
  | { status: "unchanged"; shape: T }
  | { status: "constrained"; shape: T; delta: Point }
  | { status: "rejected"; reason: string }
  | { status: "allowed"; shape: T };

/**
 * Canvas bounds for enforcement
 */
export interface CanvasBounds {
  width: number;
  height: number;
}

/**
 * Overflow details for a shape
 */
export interface BoundsOverflow {
  left: number;
  top: number;
  right: number;
  bottom: number;
  exceeds: boolean;
}

/**
 * Calculate overflow of shape bounds relative to canvas
 */
export function calculateOverflow(
  shapeBounds: Bounds,
  canvasBounds: CanvasBounds
): BoundsOverflow {
  const left = Math.max(0, -shapeBounds.x);
  const top = Math.max(0, -shapeBounds.y);
  const right = Math.max(
    0,
    shapeBounds.x + shapeBounds.width - canvasBounds.width
  );
  const bottom = Math.max(
    0,
    shapeBounds.y + shapeBounds.height - canvasBounds.height
  );

  return {
    left,
    top,
    right,
    bottom,
    exceeds: left > 0 || top > 0 || right > 0 || bottom > 0,
  };
}

/**
 * Calculate translation delta to move shape into canvas bounds
 */
export function calculateConstrainDelta(
  shapeBounds: Bounds,
  canvasBounds: CanvasBounds
): Point {
  let dx = 0;
  let dy = 0;

  // Shape extends past left edge
  if (shapeBounds.x < 0) {
    dx = -shapeBounds.x;
  }
  // Shape extends past right edge (and not already pushed left)
  else if (shapeBounds.x + shapeBounds.width > canvasBounds.width) {
    // Move left, but don't go negative
    dx = Math.max(
      -shapeBounds.x,
      canvasBounds.width - (shapeBounds.x + shapeBounds.width)
    );
  }

  // Shape extends past top edge
  if (shapeBounds.y < 0) {
    dy = -shapeBounds.y;
  }
  // Shape extends past bottom edge (and not already pushed up)
  else if (shapeBounds.y + shapeBounds.height > canvasBounds.height) {
    // Move up, but don't go negative
    dy = Math.max(
      -shapeBounds.y,
      canvasBounds.height - (shapeBounds.y + shapeBounds.height)
    );
  }

  return { x: dx, y: dy };
}
