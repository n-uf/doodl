/**
 * Text transformation
 */

import type { Point } from "../../types/geometry";
import { getTextBounds, type TextShape } from "./types";

/**
 * Get text position
 */
export function getTextPosition(text: TextShape): Point {
  return { x: text.x, y: text.y };
}

/**
 * Transform text by delta
 */
export function transformText(text: TextShape, delta: Point): TextShape {
  return {
    ...text,
    x: text.x + delta.x,
    y: text.y + delta.y,
  };
}

/**
 * Get text center point
 */
export function getTextCenter(
  text: TextShape,
  ctx?: CanvasRenderingContext2D
): Point {
  const bounds = getTextBounds(text, ctx);
  return {
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2,
  };
}
