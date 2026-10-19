/**
 * Stroke geometry helpers — alignment, screen-space widths, dirty padding.
 */

import type {
  ShapeShadow,
  ShapeStyle,
  StrokeAlign,
} from "../../../types/style";

export interface RectGeom {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Convert a style length to page units.
 * When `screenSpace` is true, `value` is CSS px and is divided by page scale.
 */
export function resolveStyleLength(
  value: number,
  screenSpace: boolean,
  scale: number
): number {
  if (!screenSpace) return value;
  const safeScale = scale === 0 ? 1 : scale;
  return value / safeScale;
}

/**
 * Inflate (positive) or deflate (negative) a rect uniformly.
 */
export function inflateRect(rect: RectGeom, amount: number): RectGeom {
  return {
    x: rect.x - amount,
    y: rect.y - amount,
    width: rect.width + amount * 2,
    height: rect.height + amount * 2,
  };
}

/**
 * Adjust a path rect so a centered canvas stroke paints inside / outside / center.
 * Also returns the corner radius to use for the stroked path.
 */
export function alignedStrokeRect(
  rect: RectGeom,
  strokeWidth: number,
  align: StrokeAlign,
  cornerRadius = 0
): { rect: RectGeom; cornerRadius: number } {
  if (strokeWidth <= 0 || align === "center") {
    return { rect, cornerRadius };
  }

  const half = strokeWidth / 2;
  if (align === "outside") {
    return {
      rect: inflateRect(rect, half),
      cornerRadius: cornerRadius > 0 ? cornerRadius + half : 0,
    };
  }

  // inside
  const inset = Math.min(half, rect.width / 2, rect.height / 2);
  return {
    rect: inflateRect(rect, -inset),
    cornerRadius: Math.max(0, cornerRadius - inset),
  };
}

/**
 * Ellipse radii adjustment for strokeAlign (page units).
 */
export function alignedEllipseRadii(
  rx: number,
  ry: number,
  strokeWidth: number,
  align: StrokeAlign
): { rx: number; ry: number } {
  if (strokeWidth <= 0 || align === "center") {
    return { rx, ry };
  }
  const half = strokeWidth / 2;
  if (align === "outside") {
    return { rx: rx + half, ry: ry + half };
  }
  return {
    rx: Math.max(0, rx - half),
    ry: Math.max(0, ry - half),
  };
}

/**
 * Apply dash / cap / join / miter for a stroke already sized in page units.
 * Dash segments and dashOffset are converted when `screenSpaceStroke` is set.
 */
export function applyStrokePaint(
  ctx: CanvasRenderingContext2D,
  style: ShapeStyle,
  strokeWidthPage: number,
  scale: number,
  defaults?: {
    lineCap?: CanvasLineCap;
    lineJoin?: CanvasLineJoin;
  }
): void {
  const screenSpace = style.screenSpaceStroke ?? false;
  ctx.lineWidth = strokeWidthPage;
  ctx.lineCap = style.strokeLineCap ?? defaults?.lineCap ?? "butt";
  ctx.lineJoin = style.strokeLineJoin ?? defaults?.lineJoin ?? "miter";
  if (style.miterLimit !== undefined) {
    ctx.miterLimit = style.miterLimit;
  }

  if (style.strokeDash !== undefined && style.strokeDash.length > 0) {
    ctx.setLineDash(
      style.strokeDash.map((segment) =>
        resolveStyleLength(segment, screenSpace, scale)
      )
    );
    ctx.lineDashOffset =
      style.strokeDashOffset !== undefined
        ? resolveStyleLength(style.strokeDashOffset, screenSpace, scale)
        : 0;
  } else {
    ctx.setLineDash([]);
    ctx.lineDashOffset = 0;
  }
}

/**
 * Apply canvas shadow from style (CSS-pixel blur/offsets).
 */
export function applyShapeShadow(
  ctx: CanvasRenderingContext2D,
  shadow: ShapeShadow | undefined
): void {
  if (shadow === undefined) {
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    return;
  }
  ctx.shadowColor = shadow.color;
  ctx.shadowBlur = shadow.blur ?? 0;
  ctx.shadowOffsetX = shadow.offsetX ?? 0;
  ctx.shadowOffsetY = shadow.offsetY ?? 0;
}

/**
 * Extra padding (page units) needed around shape bounds for dirty rects /
 * clipping so outside strokes, outlines, shadows, and glows are not clipped.
 */
export function styleRenderPadding(style: ShapeStyle, scale: number): number {
  const screenSpace = style.screenSpaceStroke ?? false;
  const toPage = (value: number): number =>
    resolveStyleLength(value, screenSpace, scale);

  const strokeWidth = toPage(style.strokeWidth ?? 2);
  const align: StrokeAlign = style.strokeAlign ?? "center";
  let pad =
    align === "outside"
      ? strokeWidth
      : align === "inside"
        ? 0
        : strokeWidth / 2;

  const outline = style.outline;
  if (outline !== undefined) {
    const outlineWidth = toPage(outline.strokeWidth ?? 2);
    const outlineOffset = toPage(outline.offset ?? 0);
    pad = Math.max(pad, outlineOffset + outlineWidth);
    const glow = outline.glow;
    if (glow !== undefined) {
      const glowPad = resolveStyleLength(glow.blur ?? 12, true, scale);
      pad = Math.max(pad, outlineOffset + outlineWidth + glowPad);
    }
  }

  const shadow = style.shadow;
  if (shadow !== undefined) {
    const blurPad = resolveStyleLength(shadow.blur ?? 0, true, scale);
    const ox = resolveStyleLength(Math.abs(shadow.offsetX ?? 0), true, scale);
    const oy = resolveStyleLength(Math.abs(shadow.offsetY ?? 0), true, scale);
    pad = Math.max(pad, blurPad + Math.max(ox, oy));
  }

  return pad + 2;
}
