/**
 * Polygon shape module
 */

export { PolygonController, createPolygonController } from "./controller";
export { hitTestPolygon, hitTestPolygonStroke } from "./hit-test";
export { POLYGON_MODULE } from "./module";
export { renderPolygon } from "./render";
export { getPolygonPosition, transformPolygon } from "./transform";
export { createPolygonShape, getPolygonBounds } from "./types";
export type { PolygonShape } from "./types";
export { isValidPolygon } from "./validate";
