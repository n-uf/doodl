/**
 * Region shape renderer
 *
 * Renders detected regions with fill and stroke.
 * Similar to rectangle rendering but supports multiple rects.
 */

import { mapBlendMode } from "../common/utils/canvas";
import type { RegionShape } from "./types";

/**
 * Render a region shape
 */
export function renderRegion(
  ctx: CanvasRenderingContext2D,
  shape: RegionShape
): void {
  if (shape.rects.length === 0) return;

  ctx.save();

  // Apply blend mode
  if (shape.style.blendMode) {
    ctx.globalCompositeOperation = mapBlendMode(shape.style.blendMode);
  }

  // Render each rect
  for (const rect of shape.rects) {
    // Fill
    if (shape.style.fill && shape.style.fill !== "none") {
      ctx.fillStyle = shape.style.fill;
      ctx.globalAlpha = shape.style.fillOpacity ?? 1;
      ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
    }

    // Stroke
    if (
      shape.style.stroke &&
      shape.style.stroke !== "none" &&
      (shape.style.strokeWidth ?? 0) > 0
    ) {
      ctx.strokeStyle = shape.style.stroke;
      ctx.lineWidth = shape.style.strokeWidth ?? 1;
      ctx.globalAlpha = shape.style.strokeOpacity ?? 1;
      ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
    }
  }

  ctx.restore();
}
