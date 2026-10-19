/**
 * Rectangle renderer
 */

import type { RectShape } from "../../types";
import type { StrokeAlign } from "../../types/style";
import {
  mapBlendMode,
  snapRectToDevicePixels,
} from "../common/utils/canvas";
import { getShapeRenderContext } from "../common/utils/render-context";
import {
  alignedStrokeRect,
  applyShapeShadow,
  applyStrokePaint,
  inflateRect,
  resolveStyleLength,
  type RectGeom,
} from "../common/utils/stroke";

/**
 * Build a (rounded) rect path. Uses `roundRect` when available.
 */
function pathRect(
  ctx: CanvasRenderingContext2D,
  rect: RectGeom,
  cornerRadius: number
): void {
  ctx.beginPath();
  const radius = Math.max(
    0,
    Math.min(cornerRadius, Math.min(rect.width, rect.height) / 2)
  );

  if (radius <= 0) {
    ctx.rect(rect.x, rect.y, rect.width, rect.height);
    return;
  }

  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(rect.x, rect.y, rect.width, rect.height, radius);
    return;
  }

  const { x, y, width, height } = rect;
  const r = radius;
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

/** Default corner-bracket arm length (page/screen units — see ShapeOutline). */
const DEFAULT_OUTLINE_ARM_LENGTH = 10;

/**
 * Build four sharp L-shaped corner marks (no rounding, no connecting edges)
 * as open subpaths on the current context. Arms are clamped to half the
 * shorter side so they never cross the midpoint on tiny rects.
 */
function pathCornerBrackets(
  ctx: CanvasRenderingContext2D,
  rect: RectGeom,
  armLength: number
): void {
  const arm = Math.max(
    0,
    Math.min(armLength, rect.width / 2, rect.height / 2)
  );
  if (arm <= 0) return;

  const { x, y, width, height } = rect;
  const right = x + width;
  const bottom = y + height;

  ctx.beginPath();
  // top-left
  ctx.moveTo(x, y + arm);
  ctx.lineTo(x, y);
  ctx.lineTo(x + arm, y);
  // top-right
  ctx.moveTo(right - arm, y);
  ctx.lineTo(right, y);
  ctx.lineTo(right, y + arm);
  // bottom-right
  ctx.moveTo(right, bottom - arm);
  ctx.lineTo(right, bottom);
  ctx.lineTo(right - arm, bottom);
  // bottom-left
  ctx.moveTo(x + arm, bottom);
  ctx.lineTo(x, bottom);
  ctx.lineTo(x, bottom - arm);
}

/**
 * Render a rectangle
 */
export function renderRect(
  ctx: CanvasRenderingContext2D,
  rect: RectShape
): void {
  ctx.save();

  const renderContext = getShapeRenderContext();
  const style = rect.style;
  const screenSpace = style.screenSpaceStroke ?? false;
  const scale = renderContext.scale;
  const toPage = (value: number): number =>
    resolveStyleLength(value, screenSpace, scale);

  let geom: RectGeom = {
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
  };

  const rotation = rect.rotation ?? 0;
  const axisAligned = rotation === 0;

  if (!axisAligned) {
    const cx = geom.x + geom.width / 2;
    const cy = geom.y + geom.height / 2;
    ctx.translate(cx, cy);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.translate(-cx, -cy);
  }

  // Pixel-snap axis-aligned rects when enabled (accounts for DPR × scale CTM)
  if (
    axisAligned &&
    renderContext.enablePixelSnapping &&
    geom.width > 0 &&
    geom.height > 0
  ) {
    geom = snapRectToDevicePixels(
      ctx,
      geom.x,
      geom.y,
      geom.width,
      geom.height
    );
  }

  const cornerRadius = toPage(style.cornerRadius ?? 0);
  applyShapeShadow(ctx, style.shadow);

  // Fill
  if (style.fill && style.fill !== "none") {
    ctx.fillStyle = style.fill;
    ctx.globalAlpha = style.fillOpacity ?? 1;
    if (style.blendMode) {
      ctx.globalCompositeOperation = mapBlendMode(style.blendMode);
    }
    pathRect(ctx, geom, cornerRadius);
    ctx.fill();
  }

  // Primary stroke
  if (style.stroke && style.stroke !== "none") {
    const strokeWidth = toPage(style.strokeWidth ?? 2);
    if (strokeWidth > 0) {
      const align: StrokeAlign = style.strokeAlign ?? "center";
      const stroked = alignedStrokeRect(
        geom,
        strokeWidth,
        align,
        cornerRadius
      );

      ctx.strokeStyle = style.stroke;
      ctx.globalAlpha = style.strokeOpacity ?? 1;
      applyStrokePaint(ctx, style, strokeWidth, scale);
      pathRect(ctx, stroked.rect, stroked.cornerRadius);
      ctx.stroke();
    }
  }

  // Clear shadow for outline so glow is controlled explicitly
  applyShapeShadow(ctx, undefined);

  // Secondary outside outline (selection chrome) — drawn after status stroke
  const outline = style.outline;
  if (outline !== undefined && outline.stroke !== "none") {
    const outlineWidth = toPage(outline.strokeWidth ?? 2);
    const outlineOffset = toPage(outline.offset ?? 0);

    if (outlineWidth > 0) {
      ctx.save();
      ctx.strokeStyle = outline.stroke;
      ctx.globalAlpha = outline.strokeOpacity ?? 1;
      applyStrokePaint(
        ctx,
        {
          ...style,
          strokeDash: outline.strokeDash,
          strokeDashOffset: undefined,
        },
        outlineWidth,
        scale
      );

      const glow = outline.glow;
      if (glow !== undefined) {
        ctx.shadowColor = glow.color;
        ctx.shadowBlur = glow.blur ?? 12;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
      }

      if ((outline.style ?? "ring") === "corner-bracket") {
        // Sharp L-corners: centre the stroke on a path outset by
        // offset + half-width so the marks sit fully outside the shape.
        const armLength = toPage(outline.armLength ?? DEFAULT_OUTLINE_ARM_LENGTH);
        const bracketBase = inflateRect(geom, outlineOffset + outlineWidth / 2);
        ctx.lineJoin = "miter";
        pathCornerBrackets(ctx, bracketBase, armLength);
        ctx.stroke();
      } else {
        const outlineBase = inflateRect(geom, outlineOffset);
        const stroked = alignedStrokeRect(
          outlineBase,
          outlineWidth,
          "outside",
          cornerRadius > 0 ? cornerRadius + outlineOffset : 0
        );
        pathRect(ctx, stroked.rect, stroked.cornerRadius);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  ctx.restore();
}
