/**
 * Polygon renderer
 */

import type { PolygonShape } from "../../types";
import type { Point } from "../../types/geometry";
import { mapBlendMode } from "../common/utils/canvas";
import { getShapeRenderContext } from "../common/utils/render-context";
import {
  applyShapeShadow,
  applyStrokePaint,
  resolveStyleLength,
} from "../common/utils/stroke";

// =============================================================================
// PREVIEW CONSTANTS
// =============================================================================

/** Vertex marker radius */
const VERTEX_RADIUS = 4;

/** Close indicator radius (when hovering near start) */
const CLOSE_INDICATOR_RADIUS = 8;

/** Distance threshold to show close indicator */
const CLOSE_THRESHOLD = 15;

/** Rubber-band line dash pattern */
const RUBBER_BAND_DASH = [4, 4];

// =============================================================================
// MAIN RENDERER
// =============================================================================

/**
 * Render a polygon
 */
export function renderPolygon(
  ctx: CanvasRenderingContext2D,
  polygon: PolygonShape
): void {
  // Handle preview rendering (in-progress drawing)
  if (polygon.id.startsWith("preview-")) {
    renderPolygonPreview(ctx, polygon);
    return;
  }

  // Final polygon requires at least 3 points
  if (polygon.points.length < 3) return;

  renderClosedPolygon(ctx, polygon);
}

// =============================================================================
// CLOSED POLYGON (final shape)
// =============================================================================

/**
 * Render a closed polygon (final shape)
 */
function renderClosedPolygon(
  ctx: CanvasRenderingContext2D,
  polygon: PolygonShape
): void {
  ctx.save();

  const renderContext = getShapeRenderContext();
  const style = polygon.style;
  const scale = renderContext.scale;
  const screenSpace = style.screenSpaceStroke ?? false;
  const strokeWidth = resolveStyleLength(
    style.strokeWidth ?? 2,
    screenSpace,
    scale
  );

  ctx.beginPath();
  ctx.moveTo(polygon.points[0]!.x, polygon.points[0]!.y);
  for (let i = 1; i < polygon.points.length; i++) {
    ctx.lineTo(polygon.points[i]!.x, polygon.points[i]!.y);
  }
  ctx.closePath();

  applyShapeShadow(ctx, style.shadow);

  // Fill
  if (style.fill && style.fill !== "none") {
    ctx.fillStyle = style.fill;
    ctx.globalAlpha = style.fillOpacity ?? 1;
    if (style.blendMode) {
      ctx.globalCompositeOperation = mapBlendMode(style.blendMode);
    }
    ctx.fill();
  }

  // Stroke (center align only — path offset for outside/inside is non-trivial)
  if (style.stroke && style.stroke !== "none" && strokeWidth > 0) {
    ctx.strokeStyle = style.stroke;
    ctx.globalAlpha = style.strokeOpacity ?? 1;
    applyStrokePaint(ctx, style, strokeWidth, scale);
    ctx.stroke();
  }

  ctx.restore();
}

// =============================================================================
// PREVIEW POLYGON (in-progress drawing)
// =============================================================================

/**
 * Render polygon preview with:
 * - Edges between placed vertices
 * - Vertex markers (dots)
 * - Rubber-band line to cursor
 * - Close indicator when near start
 */
function renderPolygonPreview(
  ctx: CanvasRenderingContext2D,
  polygon: PolygonShape
): void {
  const points = polygon.points;
  if (points.length === 0) return;

  const strokeColor = polygon.style.stroke ?? "#000000";
  const fillColor = polygon.style.fill ?? strokeColor;
  const strokeWidth = polygon.style.strokeWidth ?? 2;

  // Last point is cursor position (rubber-band target)
  const placedVertices = points.slice(0, -1);
  const cursorPoint = points[points.length - 1]!;

  // If only cursor point exists (no placed vertices yet), just show cursor indicator
  if (placedVertices.length === 0) {
    renderVertexMarker(ctx, cursorPoint, strokeColor, fillColor);
    return;
  }

  ctx.save();

  // Check if near start (for close indicator)
  const canClose = placedVertices.length >= 3;
  const startPoint = placedVertices[0]!;
  const isNearStart =
    canClose && distance(cursorPoint, startPoint) < CLOSE_THRESHOLD;

  // 1. Draw edges between placed vertices
  if (placedVertices.length >= 2) {
    ctx.beginPath();
    ctx.moveTo(placedVertices[0]!.x, placedVertices[0]!.y);
    for (let i = 1; i < placedVertices.length; i++) {
      ctx.lineTo(placedVertices[i]!.x, placedVertices[i]!.y);
    }
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeWidth;
    ctx.globalAlpha = polygon.style.strokeOpacity ?? 1;
    ctx.stroke();
  }

  // 2. Draw rubber-band line from last vertex to cursor
  const lastVertex = placedVertices[placedVertices.length - 1]!;
  ctx.beginPath();
  ctx.moveTo(lastVertex.x, lastVertex.y);
  ctx.lineTo(cursorPoint.x, cursorPoint.y);
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = strokeWidth;
  ctx.globalAlpha = 0.5;
  ctx.setLineDash(RUBBER_BAND_DASH);
  ctx.stroke();
  ctx.setLineDash([]);

  // 3. Draw closing line preview (from cursor back to start) if can close
  if (canClose) {
    ctx.beginPath();
    ctx.moveTo(cursorPoint.x, cursorPoint.y);
    ctx.lineTo(startPoint.x, startPoint.y);
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeWidth * 0.5;
    ctx.globalAlpha = 0.3;
    ctx.setLineDash([2, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.restore();

  // 4. Draw vertex markers
  for (const vertex of placedVertices) {
    renderVertexMarker(ctx, vertex, strokeColor, fillColor);
  }

  // 5. Draw close indicator if near start
  if (isNearStart) {
    renderCloseIndicator(ctx, startPoint, strokeColor);
  }
}

// =============================================================================
// HELPER RENDERERS
// =============================================================================

/**
 * Render a vertex marker (small filled circle)
 */
function renderVertexMarker(
  ctx: CanvasRenderingContext2D,
  point: Point,
  strokeColor: string,
  fillColor: string
): void {
  ctx.save();
  ctx.beginPath();
  ctx.arc(point.x, point.y, VERTEX_RADIUS, 0, Math.PI * 2);
  ctx.fillStyle = fillColor;
  ctx.globalAlpha = 1;
  ctx.fill();
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}

/**
 * Render close indicator (larger circle around start point)
 */
function renderCloseIndicator(
  ctx: CanvasRenderingContext2D,
  point: Point,
  color: string
): void {
  ctx.save();
  ctx.beginPath();
  ctx.arc(point.x, point.y, CLOSE_INDICATOR_RADIUS, 0, Math.PI * 2);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.8;
  ctx.stroke();
  ctx.restore();
}

/**
 * Calculate distance between two points
 */
function distance(p1: Point, p2: Point): number {
  return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
}
