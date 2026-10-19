/**
 * Ellipse renderer
 */

import type { EllipseShape } from "../../types";
import type { StrokeAlign } from "../../types/style";
import { mapBlendMode } from "../common/utils/canvas";
import { getShapeRenderContext } from "../common/utils/render-context";
import {
  alignedEllipseRadii,
  applyShapeShadow,
  applyStrokePaint,
  resolveStyleLength,
} from "../common/utils/stroke";

/**
 * Render an ellipse
 */
export function renderEllipse(
  ctx: CanvasRenderingContext2D,
  ellipse: EllipseShape
): void {
  ctx.save();

  const renderContext = getShapeRenderContext();
  const style = ellipse.style;
  const screenSpace = style.screenSpaceStroke ?? false;
  const scale = renderContext.scale;
  const toPage = (value: number): number =>
    resolveStyleLength(value, screenSpace, scale);

  if (ellipse.rotation) {
    ctx.translate(ellipse.cx, ellipse.cy);
    ctx.rotate((ellipse.rotation * Math.PI) / 180);
    ctx.translate(-ellipse.cx, -ellipse.cy);
  }

  applyShapeShadow(ctx, style.shadow);

  // Fill at geometric radii
  if (style.fill && style.fill !== "none") {
    ctx.beginPath();
    ctx.ellipse(
      ellipse.cx,
      ellipse.cy,
      ellipse.rx,
      ellipse.ry,
      0,
      0,
      Math.PI * 2
    );
    ctx.fillStyle = style.fill;
    ctx.globalAlpha = style.fillOpacity ?? 1;
    if (style.blendMode) {
      ctx.globalCompositeOperation = mapBlendMode(style.blendMode);
    }
    ctx.fill();
  }

  // Stroke with optional align (inflate/deflate radii)
  if (style.stroke && style.stroke !== "none") {
    const strokeWidth = toPage(style.strokeWidth ?? 2);
    if (strokeWidth > 0) {
      const align: StrokeAlign = style.strokeAlign ?? "center";
      const radii = alignedEllipseRadii(
        ellipse.rx,
        ellipse.ry,
        strokeWidth,
        align
      );
      ctx.beginPath();
      ctx.ellipse(
        ellipse.cx,
        ellipse.cy,
        radii.rx,
        radii.ry,
        0,
        0,
        Math.PI * 2
      );
      ctx.strokeStyle = style.stroke;
      ctx.globalAlpha = style.strokeOpacity ?? 1;
      applyStrokePaint(ctx, style, strokeWidth, scale);
      ctx.stroke();
    }
  }

  ctx.restore();
}
