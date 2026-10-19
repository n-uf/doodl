/**
 * Canvas utilities - rendering and style operations
 */

import type { BlendMode, ShapeStyle } from "../../../types/style";
import type { ImageSmoothingMode } from "../../../types/performance";

// =============================================================================
// DPR & HIGH-DPI UTILITIES
// =============================================================================

/**
 * Get device pixel ratio with fallback
 */
export function getDevicePixelRatio(): number {
  return typeof window !== "undefined" ? window.devicePixelRatio ?? 1 : 1;
}

/**
 * GPU-optimized canvas context options
 */
export interface CanvasContextOptions {
  /** Enable alpha channel (default: true for layered canvases) */
  alpha?: boolean;
  /** Enable desynchronized rendering for lower latency (default: true) */
  desynchronized?: boolean;
  /** Optimize for frequent pixel reads (default: false) */
  willReadFrequently?: boolean;
}

/**
 * Default GPU-optimized context options
 */
export const GPU_OPTIMIZED_CONTEXT_OPTIONS: CanvasContextOptions = {
  alpha: true,
  desynchronized: true,
  willReadFrequently: false,
};

/**
 * Get 2D context with GPU-optimized options
 */
export function getOptimizedContext(
  canvas: HTMLCanvasElement,
  options: CanvasContextOptions = GPU_OPTIMIZED_CONTEXT_OPTIONS
): CanvasRenderingContext2D | null {
  return canvas.getContext("2d", options) as CanvasRenderingContext2D | null;
}

/**
 * Configure canvas for high-DPI rendering
 *
 * This sets up the canvas buffer at physical pixel resolution
 * while CSS handles display sizing. The returned DPR should be
 * used to scale the context transform.
 *
 * @param canvas - The canvas element to configure
 * @param logicalWidth - Desired display width in CSS pixels
 * @param logicalHeight - Desired display height in CSS pixels
 * @param enableHighDPI - Whether to use DPR scaling (default: true)
 * @returns The effective device pixel ratio used
 */
export function configureCanvasForHighDPI(
  canvas: HTMLCanvasElement,
  logicalWidth: number,
  logicalHeight: number,
  enableHighDPI = true
): number {
  const dpr = enableHighDPI ? getDevicePixelRatio() : 1;

  // Set physical pixel dimensions
  canvas.width = Math.round(logicalWidth * dpr);
  canvas.height = Math.round(logicalHeight * dpr);

  // Set CSS display dimensions
  canvas.style.width = `${logicalWidth}px`;
  canvas.style.height = `${logicalHeight}px`;

  return dpr;
}

/**
 * Configure sharp rendering for crisp edges (UI elements, selection)
 *
 * Disables image smoothing for pixel-perfect rendering of lines and shapes.
 */
export function configureSharpRendering(
  ctx: CanvasRenderingContext2D,
  mode: ImageSmoothingMode = "disabled"
): void {
  switch (mode) {
    case "disabled":
      ctx.imageSmoothingEnabled = false;
      break;
    case "low":
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "low";
      break;
    case "medium":
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "medium";
      break;
    case "high":
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      break;
  }
}

// =============================================================================
// PIXEL SNAPPING UTILITIES
// =============================================================================

/**
 * Snap a coordinate to pixel boundary for crisp 1px lines
 *
 * Canvas draws lines centered on coordinates, so a 1px line at x=10
 * spans 9.5-10.5, causing anti-aliasing blur. Adding 0.5 aligns the
 * line to physical pixels.
 */
export function snapToPixel(value: number): number {
  return Math.round(value) + 0.5;
}

/**
 * Snap a coordinate to pixel boundary (without 0.5 offset)
 *
 * Use this for fills and rects where you want exact pixel alignment
 * without the line offset.
 */
export function snapToPixelFloor(value: number): number {
  return Math.round(value);
}

/**
 * Snap a rectangle to pixel boundaries for crisp rendering
 */
export function snapRectToPixel(
  x: number,
  y: number,
  width: number,
  height: number
): { x: number; y: number; width: number; height: number } {
  const snappedX = snapToPixelFloor(x);
  const snappedY = snapToPixelFloor(y);
  return {
    x: snappedX,
    y: snappedY,
    width: snapToPixelFloor(x + width) - snappedX,
    height: snapToPixelFloor(y + height) - snappedY,
  };
}

/**
 * Snap a rectangle to device-pixel edges under the current CTM (DPR × scale).
 *
 * Prefer this over {@link snapRectToPixel} when the context has a non-identity
 * transform so edges land on physical pixels after `setTransform`.
 */
export function snapRectToDevicePixels(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number
): { x: number; y: number; width: number; height: number } {
  const transform = ctx.getTransform();
  const scaleX = transform.a;
  const scaleY = transform.d;

  if (
    !Number.isFinite(scaleX) ||
    !Number.isFinite(scaleY) ||
    scaleX === 0 ||
    scaleY === 0
  ) {
    return snapRectToPixel(x, y, width, height);
  }

  const x0 = Math.round(x * scaleX) / scaleX;
  const y0 = Math.round(y * scaleY) / scaleY;
  const x1 = Math.round((x + width) * scaleX) / scaleX;
  const y1 = Math.round((y + height) * scaleY) / scaleY;

  return {
    x: x0,
    y: y0,
    width: x1 - x0,
    height: y1 - y0,
  };
}

// =============================================================================
// CANVAS OPERATIONS
// =============================================================================

/**
 * Clear entire canvas
 */
export function clearCanvas(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): void {
  ctx.clearRect(0, 0, width, height);
}

/**
 * Fill canvas with background color
 */
export function fillBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  color: string
): void {
  ctx.save();
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

// =============================================================================
// STYLE UTILITIES
// =============================================================================

/**
 * Map BlendMode to Canvas globalCompositeOperation
 */
export function mapBlendMode(blendMode: BlendMode): GlobalCompositeOperation {
  switch (blendMode) {
    case "multiply":
      return "multiply";
    case "screen":
      return "screen";
    case "overlay":
      return "overlay";
    case "darken":
      return "darken";
    case "lighten":
      return "lighten";
    case "normal":
    default:
      return "source-over";
  }
}

/**
 * Apply style to canvas context
 */
export function applyStyle(
  ctx: CanvasRenderingContext2D,
  style: ShapeStyle
): void {
  if (style.fill && style.fill !== "none") {
    ctx.fillStyle = style.fill;
    ctx.globalAlpha = style.fillOpacity ?? 1;
  }

  if (style.stroke && style.stroke !== "none") {
    ctx.strokeStyle = style.stroke;
    ctx.lineWidth = style.strokeWidth ?? 2;
  }

  if (style.strokeDash && style.strokeDash.length > 0) {
    ctx.setLineDash(style.strokeDash);
  } else {
    ctx.setLineDash([]);
  }

  if (style.strokeDashOffset !== undefined) {
    ctx.lineDashOffset = style.strokeDashOffset;
  }

  if (style.strokeLineCap !== undefined) {
    ctx.lineCap = style.strokeLineCap;
  }
  if (style.strokeLineJoin !== undefined) {
    ctx.lineJoin = style.strokeLineJoin;
  }
  if (style.miterLimit !== undefined) {
    ctx.miterLimit = style.miterLimit;
  }

  if (style.shadow !== undefined) {
    ctx.shadowColor = style.shadow.color;
    ctx.shadowBlur = style.shadow.blur ?? 0;
    ctx.shadowOffsetX = style.shadow.offsetX ?? 0;
    ctx.shadowOffsetY = style.shadow.offsetY ?? 0;
  }

  if (style.blendMode) {
    ctx.globalCompositeOperation = mapBlendMode(style.blendMode);
  }
}

/**
 * Reset canvas context to defaults
 */
export function resetStyle(ctx: CanvasRenderingContext2D): void {
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  ctx.setLineDash([]);
  ctx.lineDashOffset = 0;
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
}
