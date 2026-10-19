/**
 * Text shape module
 */

export { createTextController, TextController } from "./controller";
export type { TextControllerOptions } from "./controller";
export { hitTestText, hitTestTextStroke } from "./hit-test";
export { TEXT_MODULE } from "./module";
export { getTextPosition, transformText } from "./transform";
export { renderText } from "./render";
export {
  buildFontString,
  createTextShape,
  DEFAULT_FONT_FAMILY,
  DEFAULT_FONT_SIZE,
  DEFAULT_TEXT_STYLE,
  getTextBounds,
  measureTextWidth,
} from "./types";
export type { TextAlign, TextBaseline, TextShape } from "./types";
export { isValidText } from "./validate";
