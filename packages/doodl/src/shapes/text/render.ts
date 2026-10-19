/**
 * Text rendering
 */

import { applyStyle, resetStyle } from "../common/utils/canvas";
import { buildFontString, type TextShape } from "./types";

/**
 * Render a text shape
 */
export function renderText(
  ctx: CanvasRenderingContext2D,
  text: TextShape
): void {
  ctx.save();

  // Apply font
  ctx.font = buildFontString(text);
  ctx.textAlign = text.textAlign ?? "left";
  ctx.textBaseline = text.textBaseline ?? "top";

  // Apply rotation if present
  if (text.rotation) {
    ctx.translate(text.x, text.y);
    ctx.rotate((text.rotation * Math.PI) / 180);
    ctx.translate(-text.x, -text.y);
  }

  // Apply style and draw
  applyStyle(ctx, text.style);

  // Draw fill
  if (text.style.fill && text.style.fill !== "none") {
    ctx.fillStyle = text.style.fill;
    ctx.globalAlpha = text.style.fillOpacity ?? 1;

    if (text.maxWidth) {
      ctx.fillText(text.text, text.x, text.y, text.maxWidth);
    } else {
      ctx.fillText(text.text, text.x, text.y);
    }
  }

  // Draw stroke
  if (
    text.style.stroke &&
    text.style.stroke !== "none" &&
    text.style.strokeWidth
  ) {
    ctx.strokeStyle = text.style.stroke;
    ctx.lineWidth = text.style.strokeWidth;
    ctx.globalAlpha = text.style.strokeOpacity ?? 1;

    if (text.maxWidth) {
      ctx.strokeText(text.text, text.x, text.y, text.maxWidth);
    } else {
      ctx.strokeText(text.text, text.x, text.y);
    }
  }

  resetStyle(ctx);
  ctx.restore();
}
