/**
 * Ellipse hit testing
 */

import type { EllipseShape, Point } from "../../types";
import { DEFAULT_STROKE_TOLERANCE } from "../common/utils/geometry";

/**
 * Test if a point is inside an ellipse
 */
export function hitTestEllipse(point: Point, ellipse: EllipseShape): boolean {
  const dx = (point.x - ellipse.cx) / ellipse.rx;
  const dy = (point.y - ellipse.cy) / ellipse.ry;
  return dx * dx + dy * dy <= 1;
}

/**
 * Test if a point is on the stroke of an ellipse
 */
export function hitTestEllipseStroke(
  point: Point,
  ellipse: EllipseShape,
  tolerance: number = DEFAULT_STROKE_TOLERANCE
): boolean {
  const strokeWidth = ellipse.style.strokeWidth ?? 2;
  const halfStroke = strokeWidth / 2 + tolerance;

  // Outer ellipse
  const outerRx = ellipse.rx + halfStroke;
  const outerRy = ellipse.ry + halfStroke;
  const dxOuter = (point.x - ellipse.cx) / outerRx;
  const dyOuter = (point.y - ellipse.cy) / outerRy;
  const outsideOuter = dxOuter * dxOuter + dyOuter * dyOuter > 1;

  if (outsideOuter) return false;

  // Inner ellipse
  const innerRx = Math.max(0, ellipse.rx - halfStroke);
  const innerRy = Math.max(0, ellipse.ry - halfStroke);
  if (innerRx === 0 || innerRy === 0) return true;

  const dxInner = (point.x - ellipse.cx) / innerRx;
  const dyInner = (point.y - ellipse.cy) / innerRy;
  const insideInner = dxInner * dxInner + dyInner * dyInner <= 1;

  return !insideInner;
}
