/**
 * Shape style type definitions
 */

/**
 * Canvas blend modes
 */
export type BlendMode =
  | "normal"
  | "multiply"
  | "screen"
  | "overlay"
  | "darken"
  | "lighten";

/**
 * Where the stroke is painted relative to the path.
 * - `center` — Canvas default (half inside / half outside)
 * - `outside` — stroke sits entirely outside the fill bounds
 * - `inside` — stroke sits entirely inside the fill bounds
 *
 * Fully supported on rects and ellipses. Other shapes treat unknown aligns as `center`.
 */
export type StrokeAlign = "center" | "outside" | "inside";

/**
 * Soft glow for secondary outlines (selection chrome).
 * `blur` is always in CSS pixels (screen space), matching CSS box-shadow.
 */
export interface ShapeOutlineGlow {
  color: string;
  /** Blur radius in CSS pixels (default 12) */
  blur?: number;
}

/**
 * Outline geometry variant.
 * - `"ring"` (default) — a full (rounded) rect just outside the shape.
 * - `"corner-bracket"` — four sharp L-shaped corner marks; no rounding,
 *   no connecting edges (a camera-focus / crop style selection accent).
 */
export type ShapeOutlineStyle = "ring" | "corner-bracket";

/**
 * Secondary outline drawn outside the shape (e.g. selection accent).
 * Widths/offset honor `ShapeStyle.screenSpaceStroke` when set on the parent style.
 */
export interface ShapeOutline {
  stroke: string;
  /** Outline width (default 2) */
  strokeWidth?: number;
  /** Gap between shape bounds and outline inner edge (default 0) */
  offset?: number;
  strokeOpacity?: number;
  strokeDash?: number[];
  /** Soft glow behind the outline */
  glow?: ShapeOutlineGlow;
  /** Outline geometry — full `"ring"` (default) or `"corner-bracket"`. */
  style?: ShapeOutlineStyle;
  /**
   * Corner-bracket arm length along each edge (page units, or CSS px when the
   * parent style sets `screenSpaceStroke`). Clamped to half the shorter side.
   * Default 10. Ignored when `style` is `"ring"`.
   */
  armLength?: number;
}

/**
 * Drop shadow applied while filling/stroking (canvas shadow* attrs).
 * Offsets and blur are CSS pixels (unaffected by the page CTM), matching CSS box-shadow.
 */
export interface ShapeShadow {
  color: string;
  /** Blur radius in CSS pixels (default 0) */
  blur?: number;
  /** Horizontal offset in CSS pixels (default 0) */
  offsetX?: number;
  /** Vertical offset in CSS pixels (default 0) */
  offsetY?: number;
}

/**
 * Shape styling options
 */
export interface ShapeStyle {
  /** Fill color (CSS color string) or "none" */
  fill?: string;
  /** Fill opacity (0-1), default 1 */
  fillOpacity?: number;
  /** Stroke color (CSS color string) or "none" */
  stroke?: string;
  /** Stroke width in pixels, default 2 */
  strokeWidth?: number;
  /** Stroke opacity (0-1), default 1 */
  strokeOpacity?: number;
  /** Dash pattern [on, off, …] */
  strokeDash?: number[];
  /** Dash phase offset (same units as strokeDash / strokeWidth) */
  strokeDashOffset?: number;
  /** Stroke alignment relative to path (default `"center"`) */
  strokeAlign?: StrokeAlign;
  /**
   * When true, `strokeWidth`, `strokeDash`, `strokeDashOffset`, `cornerRadius`,
   * and outline width/offset are in CSS pixels and stay constant under page scale.
   */
  screenSpaceStroke?: boolean;
  /** Canvas line cap (useful for dotted approximations with round caps) */
  strokeLineCap?: CanvasLineCap;
  /** Canvas line join */
  strokeLineJoin?: CanvasLineJoin;
  /** Canvas miter limit when `strokeLineJoin` is `"miter"` */
  miterLimit?: number;
  /** Corner radius for axis-aligned rects (page units, or CSS px if screenSpaceStroke) */
  cornerRadius?: number;
  /**
   * Secondary outside outline (selection chrome). Drawn after the main stroke;
   * does not replace status/stroke color.
   */
  outline?: ShapeOutline;
  /** Drop shadow for fill/stroke (CSS-pixel blur/offsets) */
  shadow?: ShapeShadow;
  /** Blend mode, default "normal" */
  blendMode?: BlendMode;
}

/**
 * Default shape style
 */
export const DEFAULT_SHAPE_STYLE: ShapeStyle = {
  fill: "#3B82F6",
  fillOpacity: 0.3,
  stroke: "#3B82F6",
  strokeWidth: 2,
  strokeOpacity: 1,
  blendMode: "normal",
};

// =============================================================================
// STYLE PRESETS
// =============================================================================

/**
 * Highlight style preset (semi-transparent yellow)
 */
export const HIGHLIGHT_STYLE: ShapeStyle = {
  fill: "#FFEB3B",
  fillOpacity: 0.3,
  stroke: "none",
  strokeWidth: 0,
  blendMode: "multiply",
};

/**
 * Redaction zone style preset (solid black)
 */
export const REDACT_ZONE_STYLE: ShapeStyle = {
  fill: "#000000",
  fillOpacity: 1,
  stroke: "none",
  strokeWidth: 0,
  blendMode: "normal",
};

/**
 * Redaction highlight style preset (semi-transparent red)
 */
export const REDACT_HIGHLIGHT_STYLE: ShapeStyle = {
  fill: "#FF5722",
  fillOpacity: 0.3,
  stroke: "none",
  strokeWidth: 0,
  blendMode: "multiply",
};

/**
 * Default annotation style
 */
export const ANNOTATION_STYLE: ShapeStyle = {
  fill: "#3B82F6",
  fillOpacity: 0.2,
  stroke: "#3B82F6",
  strokeWidth: 2,
  strokeOpacity: 1,
  blendMode: "normal",
};
