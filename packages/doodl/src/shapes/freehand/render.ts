/**
 * Freehand path renderer
 */

import type { FreehandShape } from "../../types";
import { mapBlendMode } from "../common/utils/canvas";
import { getShapeRenderContext } from "../common/utils/render-context";
import {
  applyShapeShadow,
  applyStrokePaint,
  resolveStyleLength,
} from "../common/utils/stroke";

/**
 * Render a freehand path
 */
export function renderFreehand(
  ctx: CanvasRenderingContext2D,
  freehand: FreehandShape,
): void {
  if (freehand.points.length < 2) return;

  ctx.save();

  const renderContext = getShapeRenderContext();
  const style = freehand.style;
  const scale = renderContext.scale;
  const screenSpace = style.screenSpaceStroke ?? false;
  const strokeWidth = resolveStyleLength(
    style.strokeWidth ?? 2,
    screenSpace,
    scale,
  );

  const pathMode = freehand.pathMode ?? "smooth";

  ctx.beginPath();
  ctx.moveTo(freehand.points[0]!.x, freehand.points[0]!.y);

  if (pathMode === "linear") {
    // Sharp polyline — every vertex is a real corner (no quadratic ease).
    for (let i = 1; i < freehand.points.length; i++) {
      const point = freehand.points[i]!;
      ctx.lineTo(point.x, point.y);
    }
  } else {
    // Historical pen look: quadratic curves through mid-points.
    for (let i = 1; i < freehand.points.length - 1; i++) {
      const p1 = freehand.points[i]!;
      const p2 = freehand.points[i + 1]!;
      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;
      ctx.quadraticCurveTo(p1.x, p1.y, midX, midY);
    }
    const lastPoint = freehand.points[freehand.points.length - 1]!;
    ctx.lineTo(lastPoint.x, lastPoint.y);
  }

  if (freehand.closed) {
    ctx.closePath();
  }

  applyShapeShadow(ctx, style.shadow);

  // Fill (only if closed)
  if (freehand.closed && style.fill && style.fill !== "none") {
    ctx.fillStyle = style.fill;
    ctx.globalAlpha = style.fillOpacity ?? 1;
    if (style.blendMode) {
      ctx.globalCompositeOperation = mapBlendMode(style.blendMode);
    }
    ctx.fill();
  }

  // Stroke — round pen for smooth paths; miter joins suit sharp polylines
  // unless the author overrides via style.
  if (style.stroke && style.stroke !== "none" && strokeWidth > 0) {
    ctx.strokeStyle = style.stroke;
    ctx.globalAlpha = style.strokeOpacity ?? 1;
    applyStrokePaint(ctx, style, strokeWidth, scale, {
      lineCap: pathMode === "linear" ? "butt" : "round",
      lineJoin: pathMode === "linear" ? "miter" : "round",
    });
    ctx.stroke();
  }

  ctx.restore();
}
