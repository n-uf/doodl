/**
 * Rectangle shape module
 */

export { createRectController, RectController } from "./controller";
export { hitTestRect, hitTestRectStroke } from "./hit-test";
export { RECT_MODULE } from "./module";
export { renderRect } from "./render";
export { getRectPosition, transformRect } from "./transform";
export { createRectShape, getRectBounds, isRectShape } from "./types";
export type { RectShape } from "./types";
export { isValidRect } from "./validate";
