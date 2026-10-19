/**
 * Text shape type definitions
 */

import type { Bounds, Point } from "../../types/geometry";
import type { ShapeStyle } from "../../types/style";
import type { DrawShape } from "../common/registry";
import { generateShapeId } from "../common/registry";

/**
 * Text alignment options
 */
export type TextAlign = "left" | "center" | "right";

/**
 * Text vertical alignment options
 */
export type TextBaseline = "top" | "middle" | "bottom";

/**
 * Text shape
 */
export interface TextShape extends DrawShape {
  type: "text";
  /** Text content */
  text: string;
  /** Position X (based on alignment) */
  x: number;
  /** Position Y (based on baseline) */
  y: number;
  /** Font size in pixels */
  fontSize: number;
  /** Font family */
  fontFamily: string;
  /** Font weight */
  fontWeight?: "normal" | "bold" | number;
  /** Font style */
  fontStyle?: "normal" | "italic";
  /** Text alignment */
  textAlign?: TextAlign;
  /** Text baseline */
  textBaseline?: TextBaseline;
  /** Maximum width (for wrapping, optional) */
  maxWidth?: number;
  /** Rotation in degrees (optional) */
  rotation?: number;
}

/**
 * Default text style
 */
export const DEFAULT_TEXT_STYLE: ShapeStyle = {
  fill: "#000000",
  fillOpacity: 1,
  stroke: "none",
  strokeWidth: 0,
};

/**
 * Default font settings
 */
export const DEFAULT_FONT_SIZE = 16;
export const DEFAULT_FONT_FAMILY = "sans-serif";

/**
 * Create a text shape
 */
export function createTextShape(
  text: string,
  x: number,
  y: number,
  options: {
    fontSize?: number;
    fontFamily?: string;
    fontWeight?: "normal" | "bold" | number;
    fontStyle?: "normal" | "italic";
    textAlign?: TextAlign;
    textBaseline?: TextBaseline;
    maxWidth?: number;
    style?: ShapeStyle;
  } = {}
): TextShape {
  return {
    id: generateShapeId(),
    type: "text",
    text,
    x,
    y,
    fontSize: options.fontSize ?? DEFAULT_FONT_SIZE,
    fontFamily: options.fontFamily ?? DEFAULT_FONT_FAMILY,
    fontWeight: options.fontWeight,
    fontStyle: options.fontStyle,
    textAlign: options.textAlign ?? "left",
    textBaseline: options.textBaseline ?? "top",
    maxWidth: options.maxWidth,
    style: options.style ?? { ...DEFAULT_TEXT_STYLE },
  };
}

/**
 * Get bounding box of a text shape
 * Note: This requires a canvas context for accurate measurement
 */
export function getTextBounds(
  text: TextShape,
  ctx?: CanvasRenderingContext2D
): Bounds {
  // If no context, estimate based on font size and text length
  const estimatedWidth = ctx
    ? measureTextWidth(text, ctx)
    : text.text.length * text.fontSize * 0.6;
  const height = text.fontSize * 1.2; // Line height approximation

  let x = text.x;
  let y = text.y;

  // Adjust x based on text alignment
  const align = text.textAlign ?? "left";
  if (align === "center") {
    x -= estimatedWidth / 2;
  } else if (align === "right") {
    x -= estimatedWidth;
  }

  // Adjust y based on baseline
  const baseline = text.textBaseline ?? "top";
  if (baseline === "middle") {
    y -= height / 2;
  } else if (baseline === "bottom") {
    y -= height;
  }

  return {
    x,
    y,
    width: estimatedWidth,
    height,
  };
}

/**
 * Measure text width using canvas context
 */
export function measureTextWidth(
  text: TextShape,
  ctx: CanvasRenderingContext2D
): number {
  ctx.save();
  ctx.font = buildFontString(text);
  const metrics = ctx.measureText(text.text);
  ctx.restore();
  return metrics.width;
}

/**
 * Build CSS font string from text shape properties
 */
export function buildFontString(text: TextShape): string {
  const style = text.fontStyle ?? "normal";
  const weight = text.fontWeight ?? "normal";
  const size = `${text.fontSize}px`;
  const family = text.fontFamily;
  return `${style} ${weight} ${size} ${family}`;
}

/**
 * Get text position
 */
export function getTextPosition(text: TextShape): Point {
  return { x: text.x, y: text.y };
}
