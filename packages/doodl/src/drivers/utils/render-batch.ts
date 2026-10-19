/**
 * RenderBatch - Style-based shape batching for reduced context state changes
 *
 * Groups shapes by style properties to minimize ctx.save()/restore() calls
 * and style application overhead during rendering.
 */

import type { ShapeStyle } from "../../types";
import type { DrawShape } from "../../shapes/common/types/shape";
import { getShapeModule } from "../../shapes/common/registry";
import { getStyleMode, getZOrder } from "../../types/behavior";
import { applyStyle, resetStyle } from "../../shapes/common/utils/canvas";

// =============================================================================
// TYPES
// =============================================================================

/**
 * A batch of shapes that share the same style properties
 */
export interface RenderBatch {
  /** Style properties shared by all shapes in batch */
  style: BatchStyle;
  /** Shapes in this batch */
  shapes: DrawShape[];
}

/**
 * Style properties used for batching
 */
export interface BatchStyle {
  fill: string | null;
  stroke: string | null;
  strokeWidth: number;
  fillOpacity: number;
  strokeOpacity: number;
  blendMode: string;
}

/**
 * Options for batch rendering
 */
export interface RenderBatchOptions {
  /** Minimum batch size to use batching (default: 3) */
  minBatchSize?: number;
}

// =============================================================================
// BATCHING
// =============================================================================

/**
 * Get a stable key for style-based batching
 */
function getBatchKey(style: ShapeStyle): string {
  return [
    style.fill ?? "none",
    style.stroke ?? "none",
    String(style.strokeWidth ?? 2),
    String(style.fillOpacity ?? 1),
    String(style.strokeOpacity ?? 1),
    style.blendMode ?? "normal",
  ].join("|");
}

/**
 * Extract batch style from shape style
 */
function extractBatchStyle(style: ShapeStyle): BatchStyle {
  return {
    fill: style.fill ?? null,
    stroke: style.stroke ?? null,
    strokeWidth: style.strokeWidth ?? 2,
    fillOpacity: style.fillOpacity ?? 1,
    strokeOpacity: style.strokeOpacity ?? 1,
    blendMode: style.blendMode ?? "normal",
  };
}

/**
 * Group shapes by style for batched rendering
 *
 * @param shapes - Shapes to batch
 * @returns Array of render batches
 */
export function batchShapesByStyle(shapes: DrawShape[]): RenderBatch[] {
  const batches = new Map<string, RenderBatch>();

  for (const shape of shapes) {
    const key = getBatchKey(shape.style);

    let batch = batches.get(key);
    if (!batch) {
      batch = {
        style: extractBatchStyle(shape.style),
        shapes: [],
      };
      batches.set(key, batch);
    }
    batch.shapes.push(shape);
  }

  return Array.from(batches.values());
}

// =============================================================================
// BATCHED RENDERING
// =============================================================================

/**
 * Map our blend mode string to Canvas GlobalCompositeOperation
 */
function mapBlendMode(blendMode: string): GlobalCompositeOperation {
  const mapping: Record<string, GlobalCompositeOperation> = {
    normal: "source-over",
    multiply: "multiply",
    screen: "screen",
    overlay: "overlay",
    darken: "darken",
    lighten: "lighten",
    "color-dodge": "color-dodge",
    "color-burn": "color-burn",
    "hard-light": "hard-light",
    "soft-light": "soft-light",
    difference: "difference",
    exclusion: "exclusion",
  };
  return mapping[blendMode] ?? "source-over";
}

/**
 * Apply batch style to context
 */
function applyBatchStyle(
  ctx: CanvasRenderingContext2D,
  style: BatchStyle
): void {
  if (style.fill) {
    ctx.fillStyle = style.fill;
  }
  if (style.stroke) {
    ctx.strokeStyle = style.stroke;
    ctx.lineWidth = style.strokeWidth;
  }
  ctx.globalAlpha = style.fillOpacity;
  ctx.globalCompositeOperation = mapBlendMode(style.blendMode);
}

/**
 * Render shapes with batching by style
 *
 * Reduces context state changes by grouping shapes with same styles.
 * Still respects z-order within batches.
 *
 * @param ctx - Canvas rendering context
 * @param shapes - Shapes to render
 * @param options - Batching options
 */
export function renderShapesBatched(
  ctx: CanvasRenderingContext2D,
  shapes: DrawShape[],
  options: RenderBatchOptions = {}
): void {
  const { minBatchSize = 3 } = options;

  // If few shapes, just render normally (batching overhead not worth it)
  if (shapes.length < minBatchSize) {
    for (const shape of shapes) {
      ctx.save();
      applyStyle(ctx, shape.style);
      getShapeModule(shape).render(ctx, shape);
      resetStyle(ctx);
      ctx.restore();
    }
    return;
  }

  // Sort by zOrder first to maintain correct layering
  const sorted = [...shapes].sort(
    (a, b) => getZOrder(a.behavior) - getZOrder(b.behavior)
  );

  // Batch by style
  const batches = batchShapesByStyle(sorted);

  // Render each batch
  for (const batch of batches) {
    ctx.save();
    applyBatchStyle(ctx, batch.style);

    for (const shape of batch.shapes) {
      // Individual shapes may need style mode adjustments
      const styleMode = getStyleMode(shape.behavior);

      if (styleMode !== "normal") {
        // Shape has special style mode - apply individually
        ctx.save();
        applyStyleModeOverrides(ctx, styleMode);
        getShapeModule(shape).render(ctx, shape);
        ctx.restore();
      } else {
        // Normal style mode - render directly
        getShapeModule(shape).render(ctx, shape);
      }
    }

    resetStyle(ctx);
    ctx.restore();
  }
}

/**
 * Apply style mode overrides (muted, ghost, glass)
 */
function applyStyleModeOverrides(
  ctx: CanvasRenderingContext2D,
  styleMode: string
): void {
  switch (styleMode) {
    case "muted":
      ctx.globalAlpha = 0.5;
      break;
    case "ghost":
      ctx.globalAlpha = 0.3;
      ctx.setLineDash([4, 2]);
      break;
    case "glass":
      ctx.globalCompositeOperation = "multiply";
      break;
  }
}

// =============================================================================
// FACTORY & HELPERS
// =============================================================================

/**
 * Create a batch renderer function with options preset
 */
export function createBatchRenderer(
  options: RenderBatchOptions = {}
): (ctx: CanvasRenderingContext2D, shapes: DrawShape[]) => void {
  return (ctx, shapes) => renderShapesBatched(ctx, shapes, options);
}

/**
 * Estimate how many context state changes batching will save
 */
export function estimateBatchSavings(shapes: DrawShape[]): {
  withoutBatching: number;
  withBatching: number;
  savings: number;
} {
  const batches = batchShapesByStyle(shapes);

  const withoutBatching = shapes.length * 4; // save, applyStyle, resetStyle, restore
  const withBatching = batches.length * 4; // same per batch instead of per shape

  return {
    withoutBatching,
    withBatching,
    savings: withoutBatching - withBatching,
  };
}

