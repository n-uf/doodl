/**
 * Decorative selection / marker chrome built on sharp freehand polylines.
 *
 * Hosts (e.g. annotate overlays) use these instead of hand-rolling 2-point
 * freehand segments to dodge quadratic smoothing.
 */

import type { ShapeStyle } from "../../types/style";
import { generateShapeId } from "../common/registry";
import { createPolylineShape, type FreehandShape } from "./types";

export interface InkBracketBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CreateInkBracketShapesOptions {
  /** Outset beyond the bounds before drawing arms (default: 2). */
  pad?: number;
  /** Max arm length along each edge (default: 10). */
  armMax?: number;
  /**
   * Stable id prefix; shapes are `${prefix}:tl` / `${prefix}:br`.
   * When omitted, each shape gets a fresh generated id.
   */
  idPrefix?: string;
}

/**
 * Two L-shaped corner marks (top-left + bottom-right) as sharp polylines.
 * Returns an empty array when the geometry cannot host a positive arm.
 */
export function createInkBracketShapes(
  bounds: InkBracketBounds,
  style: ShapeStyle,
  options: CreateInkBracketShapesOptions = {},
): FreehandShape[] {
  const pad = options.pad ?? 2;
  const armMax = options.armMax ?? 10;
  const arm = Math.min(armMax, bounds.width / 3, bounds.height / 2);
  if (arm <= 0) return [];

  const ox = bounds.x - pad;
  const oy = bounds.y - pad;
  const rx = bounds.x + bounds.width + pad;
  const by = bounds.y + bounds.height + pad;
  const idPrefix = options.idPrefix;

  return [
    createPolylineShape(
      [
        { x: ox, y: oy + arm },
        { x: ox, y: oy },
        { x: ox + arm, y: oy },
      ],
      style,
      { id: idPrefix !== undefined ? `${idPrefix}:tl` : generateShapeId() },
    ),
    createPolylineShape(
      [
        { x: rx, y: by - arm },
        { x: rx, y: by },
        { x: rx - arm, y: by },
      ],
      style,
      { id: idPrefix !== undefined ? `${idPrefix}:br` : generateShapeId() },
    ),
  ];
}

/** Axis-aligned rect an underline is measured against (page units). */
export interface UnderlineRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Where a length-limited underline sits within the available span. */
export type UnderlineAlign = "start" | "center" | "end";

export interface UnderlineBelowRectOptions {
  /**
   * Vertical gap between the rect's bottom edge and the underline (page units,
   * default 0). NOTE: a zero-area horizontal path is stroked *centred* on this
   * y, so with `ShapeStyle.screenSpaceStroke` the visible clearance is only
   * `gap` minus half the on-screen stroke width converted to page space — and
   * that clearance shrinks as the viewer zooms out. Pick a `gap` that clears
   * half the stroke in page space at the lowest zoom you care about.
   */
  gap?: number;
  /** Horizontal inset applied to each side before measuring (page units, default 0). */
  inset?: number;
  /**
   * Cap the underline length (page units). When omitted the line spans the
   * full inset width. Clamped to the available span.
   */
  maxWidth?: number;
  /** Placement of a `maxWidth`-limited line within the span (default `"start"`). */
  align?: UnderlineAlign;
  /** Stable shape id (a fresh id is generated when omitted). */
  id?: string;
}

/**
 * Pure geometry: a straight horizontal underline placed just *below* a rect's
 * bottom edge (`rect.y + rect.height + gap`). Returns a sharp two-point
 * polyline the consumer styles/positions in a layer; it performs NO text,
 * word, lexeme, or occurrence detection — the caller owns what/when to draw.
 *
 * Returns `null` when the inset span collapses to a non-positive width.
 */
export function underlineBelowRect(
  rect: UnderlineRect,
  style: ShapeStyle,
  options: UnderlineBelowRectOptions = {},
): FreehandShape | null {
  const gap = options.gap ?? 0;
  const inset = options.inset ?? 0;
  const align = options.align ?? "start";

  const spanStart = rect.x + inset;
  const spanEnd = rect.x + rect.width - inset;
  const available = spanEnd - spanStart;
  if (available <= 0) return null;

  const length =
    options.maxWidth !== undefined
      ? Math.min(options.maxWidth, available)
      : available;
  if (length <= 0) return null;

  const slack = available - length;
  const start =
    align === "center"
      ? spanStart + slack / 2
      : align === "end"
        ? spanEnd - length
        : spanStart;
  const y = rect.y + rect.height + gap;

  return createPolylineShape(
    [
      { x: start, y },
      { x: start + length, y },
    ],
    style,
    { id: options.id },
  );
}
