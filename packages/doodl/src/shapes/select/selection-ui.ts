/**
 * Selection UI - Outlines, handles, rendering
 *
 * Renders selection bounds and resize handles for selected shapes.
 * Uses pixel snapping for crisp 1px lines on all displays.
 */

import type { Bounds, DrawShape, Point } from "../../types";
import { getShapeBounds, isEditable } from "../../types";
import { isPointInBounds, mergeBounds } from "../common/utils/geometry";
import { snapToPixel, snapToPixelFloor } from "../common/utils/canvas";

// =============================================================================
// CONFIGURATION
// =============================================================================

/** Handle size in pixels */
export const HANDLE_SIZE = 8;

/** Handle border width */
export const HANDLE_BORDER_WIDTH = 1;

/** Selection outline width */
export const SELECTION_OUTLINE_WIDTH = 1;

/** Selection outline color */
export const SELECTION_OUTLINE_COLOR = "#3B82F6";

/** Selection outline dash pattern */
export const SELECTION_OUTLINE_DASH = [4, 4];

/** Handle fill color */
export const HANDLE_FILL_COLOR = "#FFFFFF";

/** Handle border color */
export const HANDLE_BORDER_COLOR = "#3B82F6";

// =============================================================================
// HANDLE POSITIONS
// =============================================================================

/**
 * Handle position identifiers
 */
export type HandlePosition =
  | "top-left"
  | "top"
  | "top-right"
  | "right"
  | "bottom-right"
  | "bottom"
  | "bottom-left"
  | "left";

/**
 * Get handle positions for a bounding box
 */
export function getHandlePositions(bounds: Bounds): Map<HandlePosition, Point> {
  const halfHandle = HANDLE_SIZE / 2;
  const { x, y, width, height } = bounds;

  return new Map<HandlePosition, Point>([
    ["top-left", { x: x - halfHandle, y: y - halfHandle }],
    ["top", { x: x + width / 2 - halfHandle, y: y - halfHandle }],
    ["top-right", { x: x + width - halfHandle, y: y - halfHandle }],
    ["right", { x: x + width - halfHandle, y: y + height / 2 - halfHandle }],
    ["bottom-right", { x: x + width - halfHandle, y: y + height - halfHandle }],
    ["bottom", { x: x + width / 2 - halfHandle, y: y + height - halfHandle }],
    ["bottom-left", { x: x - halfHandle, y: y + height - halfHandle }],
    ["left", { x: x - halfHandle, y: y + height / 2 - halfHandle }],
  ]);
}

/**
 * Get cursor for a handle position
 */
export function getHandleCursor(position: HandlePosition): string {
  switch (position) {
    case "top-left":
    case "bottom-right":
      return "nwse-resize";
    case "top-right":
    case "bottom-left":
      return "nesw-resize";
    case "top":
    case "bottom":
      return "ns-resize";
    case "left":
    case "right":
      return "ew-resize";
  }
}

/**
 * Hit test for handle at a point
 */
export function hitTestHandle(
  point: Point,
  bounds: Bounds,
  tolerance: number = 0
): HandlePosition | null {
  const positions = getHandlePositions(bounds);

  for (const [position, handlePoint] of positions) {
    const handleBounds: Bounds = {
      x: handlePoint.x - tolerance,
      y: handlePoint.y - tolerance,
      width: HANDLE_SIZE + tolerance * 2,
      height: HANDLE_SIZE + tolerance * 2,
    };

    if (isPointInBounds(point, handleBounds)) {
      return position;
    }
  }

  return null;
}

// =============================================================================
// RENDERING
// =============================================================================

/**
 * Render selection outline for a shape
 */
export function renderSelectionOutline(
  ctx: CanvasRenderingContext2D,
  shape: DrawShape
): void {
  const bounds = getShapeBounds(shape);
  renderSelectionBounds(ctx, bounds);
}

/**
 * Render selection outline for bounds
 *
 * Uses pixel snapping for crisp 1px lines.
 */
export function renderSelectionBounds(
  ctx: CanvasRenderingContext2D,
  bounds: Bounds
): void {
  ctx.save();

  ctx.strokeStyle = SELECTION_OUTLINE_COLOR;
  ctx.lineWidth = SELECTION_OUTLINE_WIDTH;
  ctx.setLineDash(SELECTION_OUTLINE_DASH);

  // Snap to pixel boundaries for crisp 1px lines
  // The +0.5 offset ensures the line falls on physical pixels
  const x = snapToPixel(bounds.x);
  const y = snapToPixel(bounds.y);
  const w = snapToPixelFloor(bounds.width);
  const h = snapToPixelFloor(bounds.height);

  ctx.strokeRect(x, y, w, h);

  ctx.restore();
}

/**
 * Render resize handles for a shape
 */
export function renderSelectionHandles(
  ctx: CanvasRenderingContext2D,
  shape: DrawShape
): void {
  const bounds = getShapeBounds(shape);
  renderHandlesForBounds(ctx, bounds);
}

/**
 * Render resize handles for bounds
 *
 * Uses pixel snapping for crisp handle borders.
 */
export function renderHandlesForBounds(
  ctx: CanvasRenderingContext2D,
  bounds: Bounds
): void {
  ctx.save();

  const positions = getHandlePositions(bounds);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- _position is intentionally unused in destructuring
  for (const [_position, point] of positions) {
    // Snap to pixel boundaries for crisp rendering
    const x = snapToPixelFloor(point.x);
    const y = snapToPixelFloor(point.y);

    // Fill (no snapping offset needed for fills)
    ctx.fillStyle = HANDLE_FILL_COLOR;
    ctx.fillRect(x, y, HANDLE_SIZE, HANDLE_SIZE);

    // Border with pixel snapping for crisp 1px stroke
    ctx.strokeStyle = HANDLE_BORDER_COLOR;
    ctx.lineWidth = HANDLE_BORDER_WIDTH;
    ctx.setLineDash([]);
    ctx.strokeRect(snapToPixel(point.x), snapToPixel(point.y), HANDLE_SIZE, HANDLE_SIZE);
  }

  ctx.restore();
}

/**
 * Render complete selection (outline + handles) for a shape.
 * Non-editable shapes get outline only (no resize chrome).
 */
export function renderSelection(
  ctx: CanvasRenderingContext2D,
  shape: DrawShape
): void {
  renderSelectionOutline(ctx, shape);
  if (isEditable(shape.behavior)) {
    renderSelectionHandles(ctx, shape);
  }
}

/**
 * Render complete selection for multiple shapes
 */
export function renderMultiSelection(
  ctx: CanvasRenderingContext2D,
  shapes: DrawShape[]
): void {
  if (shapes.length === 0) return;

  // Render individual outlines
  for (const shape of shapes) {
    renderSelectionOutline(ctx, shape);
  }

  // Render handles only on the combined bounding box
  const combinedBounds = getCombinedBounds(shapes);
  if (combinedBounds) {
    renderHandlesForBounds(ctx, combinedBounds);
  }
}

/**
 * Get combined bounding box of multiple shapes
 */
export function getCombinedBounds(shapes: DrawShape[]): Bounds | null {
  if (shapes.length === 0) return null;
  const allBounds = shapes.map(getShapeBounds);
  return mergeBounds(allBounds);
}
