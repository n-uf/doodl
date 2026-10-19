/**
 * Path Simplification - Ramer-Douglas-Peucker Algorithm
 *
 * Reduces the number of points in a path while preserving its shape.
 */

import type { Point } from "../../types";

/**
 * Default epsilon (tolerance) for simplification
 */
export const DEFAULT_EPSILON = 2.0;

/**
 * Calculate perpendicular distance from a point to a line segment
 */
function perpendicularDistance(
  point: Point,
  lineStart: Point,
  lineEnd: Point
): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;

  // Handle degenerate case where line is actually a point
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) {
    return Math.sqrt(
      (point.x - lineStart.x) ** 2 + (point.y - lineStart.y) ** 2
    );
  }

  // Calculate perpendicular distance using cross product
  const numerator = Math.abs(
    dy * point.x -
      dx * point.y +
      lineEnd.x * lineStart.y -
      lineEnd.y * lineStart.x
  );
  const denominator = Math.sqrt(lengthSquared);

  return numerator / denominator;
}

/**
 * Ramer-Douglas-Peucker algorithm implementation
 *
 * Recursively simplifies a polyline by removing points that don't
 * significantly affect the shape.
 *
 * @param points - Input points
 * @param epsilon - Maximum distance a point can be from the line
 * @returns Simplified points
 */
export function simplifyPath(
  points: Point[],
  epsilon: number = DEFAULT_EPSILON
): Point[] {
  if (points.length < 3) {
    return [...points];
  }

  // Find the point with the maximum distance from the line
  let maxDistance = 0;
  let maxIndex = 0;

  const start = points[0]!;
  const end = points[points.length - 1]!;

  for (let i = 1; i < points.length - 1; i++) {
    const distance = perpendicularDistance(points[i]!, start, end);
    if (distance > maxDistance) {
      maxDistance = distance;
      maxIndex = i;
    }
  }

  // If max distance is greater than epsilon, recursively simplify
  if (maxDistance > epsilon) {
    // Recursive simplification
    const left = simplifyPath(points.slice(0, maxIndex + 1), epsilon);
    const right = simplifyPath(points.slice(maxIndex), epsilon);

    // Combine results (removing duplicate middle point)
    return [...left.slice(0, -1), ...right];
  }

  // All points are within epsilon, return just endpoints
  return [start, end];
}

/**
 * Simplify path with minimum point count
 *
 * Ensures the simplified path has at least minPoints points.
 *
 * @param points - Input points
 * @param epsilon - Maximum distance tolerance
 * @param minPoints - Minimum number of points to keep
 * @returns Simplified points with at least minPoints
 */
export function simplifyPathWithMinPoints(
  points: Point[],
  epsilon: number = DEFAULT_EPSILON,
  minPoints: number = 2
): Point[] {
  if (points.length <= minPoints) {
    return [...points];
  }

  let result = simplifyPath(points, epsilon);

  // If we have too few points, reduce epsilon and try again
  let currentEpsilon = epsilon;
  while (result.length < minPoints && currentEpsilon > 0.1) {
    currentEpsilon /= 2;
    result = simplifyPath(points, currentEpsilon);
  }

  // If still not enough, just sample evenly from original
  if (result.length < minPoints) {
    const step = (points.length - 1) / (minPoints - 1);
    result = [];
    for (let i = 0; i < minPoints; i++) {
      const index = Math.round(i * step);
      result.push({ ...points[index]! });
    }
  }

  return result;
}

/**
 * Calculate path length
 */
export function getPathLength(points: Point[]): number {
  if (points.length < 2) return 0;

  let length = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i]!.x - points[i - 1]!.x;
    const dy = points[i]!.y - points[i - 1]!.y;
    length += Math.sqrt(dx * dx + dy * dy);
  }

  return length;
}

/**
 * Resample path to have evenly spaced points
 *
 * @param points - Input points
 * @param numPoints - Number of points in output
 * @returns Resampled points
 */
export function resamplePath(points: Point[], numPoints: number): Point[] {
  if (points.length < 2 || numPoints < 2) {
    return [...points];
  }

  const totalLength = getPathLength(points);
  if (totalLength === 0) {
    return [{ ...points[0]! }];
  }

  const segmentLength = totalLength / (numPoints - 1);
  const result: Point[] = [{ ...points[0]! }];

  let currentLength = 0;
  let targetLength = segmentLength;
  let prevPoint = points[0]!;

  for (let i = 1; i < points.length; i++) {
    const point = points[i]!;
    const dx = point.x - prevPoint.x;
    const dy = point.y - prevPoint.y;
    const segLen = Math.sqrt(dx * dx + dy * dy);

    while (
      currentLength + segLen >= targetLength &&
      result.length < numPoints - 1
    ) {
      const t = (targetLength - currentLength) / segLen;
      const newPoint = {
        x: prevPoint.x + t * dx,
        y: prevPoint.y + t * dy,
      };
      result.push(newPoint);
      targetLength += segmentLength;
    }

    currentLength += segLen;
    prevPoint = point;
  }

  // Add last point
  if (result.length < numPoints) {
    result.push({ ...points[points.length - 1]! });
  }

  return result;
}

/**
 * Smooth path using moving average
 *
 * @param points - Input points
 * @param windowSize - Size of the smoothing window (must be odd)
 * @returns Smoothed points
 */
export function smoothPath(points: Point[], windowSize: number = 3): Point[] {
  if (points.length < windowSize) {
    return [...points];
  }

  // Ensure window size is odd
  const halfWindow = Math.floor(windowSize / 2);
  const result: Point[] = [];

  for (let i = 0; i < points.length; i++) {
    let sumX = 0;
    let sumY = 0;
    let count = 0;

    for (let j = -halfWindow; j <= halfWindow; j++) {
      const index = i + j;
      if (index >= 0 && index < points.length) {
        sumX += points[index]!.x;
        sumY += points[index]!.y;
        count++;
      }
    }

    result.push({
      x: sumX / count,
      y: sumY / count,
    });
  }

  return result;
}

