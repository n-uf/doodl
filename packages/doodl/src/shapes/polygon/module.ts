/**
 * Polygon shape module - self-registering
 */

import type { Point } from "../../types/geometry";
import { registerShape, type ShapeModule } from "../common/registry";
import type { ShapeEditState } from "../common/types/module";
import {
  renderEdgeMidpoints,
  renderVertexHandles,
  type VertexEditState,
} from "../select/vertex-edit";
import { hitTestPolygon, hitTestPolygonStroke } from "./hit-test";
import { renderPolygon } from "./render";
import { extractText } from "./text-extract";
import { getPolygonPosition, transformPolygon } from "./transform";
import type { PolygonShape } from "./types";
import { getPolygonBounds } from "./types";
import { isValidPolygon } from "./validate";

/**
 * Polygon shape module - implements ShapeModule interface
 */
export const POLYGON_MODULE: ShapeModule<PolygonShape> = {
  render: renderPolygon,

  hitTestFill: (point: Point, shape: PolygonShape) =>
    hitTestPolygon(point, shape.points),

  hitTestStroke: (point: Point, shape: PolygonShape, tolerance: number) =>
    hitTestPolygonStroke(
      point,
      shape.points,
      shape.style.strokeWidth,
      tolerance
    ),

  getBounds: getPolygonBounds,
  getPosition: getPolygonPosition,
  transform: transformPolygon,
  isValid: isValidPolygon,
  extractText,
  // Capture text on creation/transform for fallback when DOM unavailable
  capturesTextOnTransform: true,

  // -------------------------------------------------------------------------
  // Edit Mode Support (Figma-like vertex editing)
  // -------------------------------------------------------------------------

  supportsEditMode: true,

  renderEditMode(
    ctx: CanvasRenderingContext2D,
    shape: PolygonShape,
    editState: ShapeEditState
  ): void {
    if (editState.mode === "vertex") {
      const vertexState = editState.data as VertexEditState;

      // Render edge midpoints (for adding vertices) - show when not dragging
      if (vertexState.draggingVertexIndex === null) {
        renderEdgeMidpoints(ctx, shape, vertexState.hoveredEdgeIndex);
      }

      // Render vertex handles on top
      renderVertexHandles(
        ctx,
        shape,
        vertexState.hoveredVertexIndex,
        vertexState.draggingVertexIndex
      );
    }
  },
};

// Self-register
registerShape<PolygonShape>("polygon", POLYGON_MODULE);
