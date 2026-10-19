/**
 * Text hit testing
 */

import type { Point } from "../../types/geometry";
import { isPointInBounds } from "../common/utils/geometry";
import { getTextBounds, type TextShape } from "./types";

/**
 * Hit test for text fill (bounding box based)
 */
export function hitTestText(
  point: Point,
  text: TextShape,
  ctx?: CanvasRenderingContext2D
): boolean {
  const bounds = getTextBounds(text, ctx);
  return isPointInBounds(point, bounds);
}

/**
 * Hit test for text stroke (same as fill for text)
 */
export function hitTestTextStroke(
  point: Point,
  text: TextShape,
  _tolerance: number,
  ctx?: CanvasRenderingContext2D
): boolean {
  // For text, stroke hit test is same as fill (bounding box)
  return hitTestText(point, text, ctx);
}
