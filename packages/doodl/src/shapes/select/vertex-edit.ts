/**
 * Vertex Editing - Figma-like polygon vertex manipulation
 *
 * Features:
 * - Double-click polygon to enter vertex edit mode
 * - Drag vertices to reposition them
 * - Visual feedback with vertex handles
 * - Exit edit mode by clicking outside or pressing Escape
 */

import type { Point } from "../../types/geometry";
import type { PolygonShape } from "../polygon/types";

// =============================================================================
// CONFIGURATION
// =============================================================================

/** Vertex handle size (slightly smaller than resize handles) */
export const VERTEX_HANDLE_SIZE = 8;

/** Vertex handle fill color */
export const VERTEX_HANDLE_FILL = "#FFFFFF";

/** Vertex handle border color */
export const VERTEX_HANDLE_BORDER = "#3B82F6";

/** Vertex handle hover/active color */
export const VERTEX_HANDLE_ACTIVE = "#2563EB";

/** Hit tolerance for vertex selection */
export const VERTEX_HIT_TOLERANCE = 6;

/** Edge hit tolerance for adding vertices */
export const EDGE_HIT_TOLERANCE = 8;

// =============================================================================
// TYPES
// =============================================================================

/**
 * Vertex edit state
 */
export interface VertexEditState {
  /** ID of shape being edited */
  shapeId: string;
  /** Index of vertex being dragged (null if not dragging) */
  draggingVertexIndex: number | null;
  /** Index of hovered vertex (for visual feedback) */
  hoveredVertexIndex: number | null;
  /** Index of hovered edge (for adding vertices) */
  hoveredEdgeIndex: number | null;
  /** Original points before drag started */
  originalPoints: Point[] | null;
  /** Start point of drag operation */
  dragStartPoint: Point | null;
}

/**
 * Vertex hit test result
 */
export interface VertexHitResult {
  /** Index of hit vertex */
  vertexIndex: number;
  /** Position of the vertex */
  position: Point;
}

/**
 * Edge hit test result (for adding vertices)
 */
export interface EdgeHitResult {
  /** Index of edge start vertex */
  edgeStartIndex: number;
  /** Closest point on edge */
  closestPoint: Point;
  /** Distance from click to edge */
  distance: number;
}

// =============================================================================
// HIT TESTING
// =============================================================================

/**
 * Hit test vertices of a polygon
 * Returns the index of the hit vertex, or null if none hit
 */
export function hitTestVertex(
  point: Point,
  polygon: PolygonShape,
  tolerance: number = VERTEX_HIT_TOLERANCE
): VertexHitResult | null {
  for (let i = 0; i < polygon.points.length; i++) {
    const vertex = polygon.points[i]!;
    const distance = Math.sqrt(
      (point.x - vertex.x) ** 2 + (point.y - vertex.y) ** 2
    );

    if (distance <= tolerance) {
      return { vertexIndex: i, position: vertex };
    }
  }

  return null;
}

/**
 * Hit test edges of a polygon (for adding new vertices)
 * Returns the closest edge if within tolerance
 */
export function hitTestEdge(
  point: Point,
  polygon: PolygonShape,
  tolerance: number = EDGE_HIT_TOLERANCE
): EdgeHitResult | null {
  const points = polygon.points;
  if (points.length < 2) return null;

  let closestEdge: EdgeHitResult | null = null;
  let minDistance = Infinity;

  for (let i = 0; i < points.length; i++) {
    const p1 = points[i]!;
    const p2 = points[(i + 1) % points.length]!;

    const result = closestPointOnSegment(point, p1, p2);

    if (result.distance < minDistance && result.distance <= tolerance) {
      minDistance = result.distance;
      closestEdge = {
        edgeStartIndex: i,
        closestPoint: result.point,
        distance: result.distance,
      };
    }
  }

  return closestEdge;
}

/**
 * Find closest point on a line segment
 */
function closestPointOnSegment(
  point: Point,
  segStart: Point,
  segEnd: Point
): { point: Point; distance: number } {
  const dx = segEnd.x - segStart.x;
  const dy = segEnd.y - segStart.y;
  const lengthSq = dx * dx + dy * dy;

  if (lengthSq === 0) {
    // Segment is a point
    const dist = Math.sqrt(
      (point.x - segStart.x) ** 2 + (point.y - segStart.y) ** 2
    );
    return { point: { ...segStart }, distance: dist };
  }

  // Project point onto line
  let t =
    ((point.x - segStart.x) * dx + (point.y - segStart.y) * dy) / lengthSq;
  t = Math.max(0, Math.min(1, t)); // Clamp to segment

  const closestPoint: Point = {
    x: segStart.x + t * dx,
    y: segStart.y + t * dy,
  };

  const distance = Math.sqrt(
    (point.x - closestPoint.x) ** 2 + (point.y - closestPoint.y) ** 2
  );

  return { point: closestPoint, distance };
}

// =============================================================================
// VERTEX OPERATIONS
// =============================================================================

/**
 * Move a vertex to a new position
 */
export function moveVertex(
  polygon: PolygonShape,
  vertexIndex: number,
  newPosition: Point
): PolygonShape {
  const newPoints = [...polygon.points];
  newPoints[vertexIndex] = { ...newPosition };

  return {
    ...polygon,
    points: newPoints,
  };
}

/**
 * Add a vertex at an edge
 */
export function addVertexAtEdge(
  polygon: PolygonShape,
  edgeStartIndex: number,
  position: Point
): PolygonShape {
  const newPoints = [...polygon.points];
  // Insert after the edge start
  newPoints.splice(edgeStartIndex + 1, 0, { ...position });

  return {
    ...polygon,
    points: newPoints,
  };
}

/**
 * Delete a vertex (if polygon would still be valid)
 */
export function deleteVertex(
  polygon: PolygonShape,
  vertexIndex: number
): PolygonShape | null {
  // Need at least 3 vertices for a valid polygon
  if (polygon.points.length <= 3) {
    return null;
  }

  const newPoints = polygon.points.filter((_, i) => i !== vertexIndex);

  return {
    ...polygon,
    points: newPoints,
  };
}

// =============================================================================
// RENDERING
// =============================================================================

/**
 * Render vertex handles for a polygon in edit mode
 */
export function renderVertexHandles(
  ctx: CanvasRenderingContext2D,
  polygon: PolygonShape,
  hoveredIndex: number | null = null,
  draggingIndex: number | null = null
): void {
  ctx.save();

  const halfSize = VERTEX_HANDLE_SIZE / 2;

  for (let i = 0; i < polygon.points.length; i++) {
    const point = polygon.points[i]!;
    const isHovered = i === hoveredIndex;
    const isDragging = i === draggingIndex;
    const isActive = isHovered || isDragging;

    // Draw handle (circle for vertices, unlike square for resize handles)
    ctx.beginPath();
    ctx.arc(point.x, point.y, halfSize, 0, Math.PI * 2);

    // Fill
    ctx.fillStyle = isActive ? VERTEX_HANDLE_ACTIVE : VERTEX_HANDLE_FILL;
    ctx.fill();

    // Border
    ctx.strokeStyle = VERTEX_HANDLE_BORDER;
    ctx.lineWidth = isActive ? 2 : 1.5;
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Render edge midpoint handles (for adding vertices)
 */
export function renderEdgeMidpoints(
  ctx: CanvasRenderingContext2D,
  polygon: PolygonShape,
  hoveredEdge: number | null = null
): void {
  ctx.save();

  const points = polygon.points;
  const halfSize = VERTEX_HANDLE_SIZE / 2 - 1; // Slightly smaller

  for (let i = 0; i < points.length; i++) {
    const p1 = points[i]!;
    const p2 = points[(i + 1) % points.length]!;
    const midpoint: Point = {
      x: (p1.x + p2.x) / 2,
      y: (p1.y + p2.y) / 2,
    };

    const isHovered = i === hoveredEdge;

    // Draw smaller handle at midpoint
    ctx.beginPath();
    ctx.arc(midpoint.x, midpoint.y, halfSize, 0, Math.PI * 2);

    // More subtle appearance
    ctx.fillStyle = isHovered ? VERTEX_HANDLE_FILL : "rgba(255, 255, 255, 0.6)";
    ctx.fill();

    ctx.strokeStyle = isHovered
      ? VERTEX_HANDLE_ACTIVE
      : "rgba(59, 130, 246, 0.5)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Render complete vertex edit overlay
 */
export function renderVertexEditOverlay(
  ctx: CanvasRenderingContext2D,
  polygon: PolygonShape,
  state: {
    hoveredVertexIndex: number | null;
    draggingVertexIndex: number | null;
    hoveredEdgeIndex?: number | null;
    showEdgeMidpoints?: boolean;
  }
): void {
  // Draw edge midpoints (for adding vertices) - optional
  if (state.showEdgeMidpoints) {
    renderEdgeMidpoints(ctx, polygon, state.hoveredEdgeIndex ?? null);
  }

  // Draw vertex handles on top
  renderVertexHandles(
    ctx,
    polygon,
    state.hoveredVertexIndex,
    state.draggingVertexIndex
  );
}

// =============================================================================
// STATE MANAGEMENT
// =============================================================================

/**
 * Create initial vertex edit state
 */
export function createVertexEditState(shapeId: string): VertexEditState {
  return {
    shapeId,
    draggingVertexIndex: null,
    hoveredVertexIndex: null,
    hoveredEdgeIndex: null,
    originalPoints: null,
    dragStartPoint: null,
  };
}

/**
 * Check if a shape supports vertex editing
 */
export function isVertexEditable(shape: unknown): shape is PolygonShape {
  return (
    typeof shape === "object" &&
    shape !== null &&
    "type" in shape &&
    shape.type === "polygon" &&
    "points" in shape &&
    Array.isArray((shape as PolygonShape).points)
  );
}
