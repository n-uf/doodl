/**
 * Text Highlight Merge - Merge overlapping/adjacent highlight rects
 *
 * Supports:
 * 1. Intra-shape: Merge rects within a single selection
 * 2. Inter-shape: Merge new highlight with existing highlights
 *
 * Algorithm:
 * 1. Group rects by Y-center (same text line)
 * 2. Sort each row by X
 * 3. Merge overlapping/adjacent rects in row
 */

import type { Bounds } from "../../types/geometry";
import type { TextHighlightShape } from "./types";

// =============================================================================
// TYPES
// =============================================================================

export interface HighlightMergeOptions {
  /** Y-tolerance for same-row grouping (default: 3) */
  rowTolerance?: number;
  /** X-gap tolerance for adjacent merge (default: 2) */
  gapTolerance?: number;
}

// =============================================================================
// MAIN FUNCTION
// =============================================================================

/**
 * Merge overlapping/adjacent highlight rects into minimal set
 */
export function mergeHighlightRects(
  rects: Bounds[],
  options: HighlightMergeOptions = {}
): Bounds[] {
  const { rowTolerance = 3, gapTolerance = 2 } = options;

  if (rects.length <= 1) return rects;

  // Group by Y-center (same text line)
  const rows = groupByRow(rects, rowTolerance);

  // Merge each row
  const merged: Bounds[] = [];
  for (const row of rows) {
    merged.push(...mergeRow(row, gapTolerance));
  }

  return merged;
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Group rects into rows based on Y-center proximity
 */
function groupByRow(rects: Bounds[], tolerance: number): Bounds[][] {
  const sorted = [...rects].sort((a, b) => centerY(a) - centerY(b));
  const rows: Bounds[][] = [];
  let currentRow: Bounds[] = [];
  let currentY = -Infinity;

  for (const rect of sorted) {
    const y = centerY(rect);
    if (y - currentY > tolerance && currentRow.length > 0) {
      rows.push(currentRow);
      currentRow = [];
    }
    currentRow.push(rect);
    currentY = y;
  }

  if (currentRow.length > 0) {
    rows.push(currentRow);
  }

  return rows;
}

/**
 * Merge overlapping/adjacent rects within a single row
 */
function mergeRow(rects: Bounds[], gap: number): Bounds[] {
  if (rects.length <= 1) return rects;

  // Sort by X position
  const sorted = [...rects].sort((a, b) => a.x - b.x);
  const merged: Bounds[] = [];
  let current = { ...sorted[0]! };

  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i]!;

    // Check if rects overlap or are adjacent (within gap tolerance)
    if (next.x <= current.x + current.width + gap) {
      // Merge: extend current rect to encompass both
      const right = Math.max(current.x + current.width, next.x + next.width);
      const top = Math.min(current.y, next.y);
      const bottom = Math.max(current.y + current.height, next.y + next.height);

      current = {
        x: current.x,
        y: top,
        width: right - current.x,
        height: bottom - top,
      };
    } else {
      // Gap too large, finalize current and start new
      merged.push(current);
      current = { ...next };
    }
  }

  // Don't forget the last rect
  merged.push(current);

  return merged;
}

/**
 * Get Y-center of a rect
 */
function centerY(rect: Bounds): number {
  return rect.y + rect.height / 2;
}

// =============================================================================
// INTER-SHAPE MERGING
// =============================================================================

/**
 * Check if two bounds overlap or are adjacent
 */
function boundsOverlap(a: Bounds, b: Bounds, tolerance: number = 2): boolean {
  return !(
    a.x + a.width + tolerance < b.x ||
    b.x + b.width + tolerance < a.x ||
    a.y + a.height + tolerance < b.y ||
    b.y + b.height + tolerance < a.y
  );
}

/**
 * Check if two text highlight shapes have any overlapping rects
 */
export function highlightShapesOverlap(
  a: TextHighlightShape,
  b: TextHighlightShape,
  options: HighlightMergeOptions = {}
): boolean {
  const { gapTolerance = 2, rowTolerance = 3 } = options;

  for (const rectA of a.rects) {
    for (const rectB of b.rects) {
      // Check if rects are on same row (Y overlap)
      const aCenter = centerY(rectA);
      const bCenter = centerY(rectB);
      if (
        Math.abs(aCenter - bCenter) <=
        rowTolerance + Math.max(rectA.height, rectB.height) / 2
      ) {
        // Check X overlap
        if (boundsOverlap(rectA, rectB, gapTolerance)) {
          return true;
        }
      }
    }
  }
  return false;
}

/**
 * Intelligently combine text from two highlights
 * Avoids duplication when texts overlap or one contains the other
 */
function combineHighlightText(textA: string, textB: string): string {
  // Exact match
  if (textA === textB) return textA;

  // One contains the other
  if (textA.includes(textB)) return textA;
  if (textB.includes(textA)) return textB;

  // Check for significant overlap (one ends where other begins)
  const minOverlap = Math.min(textA.length, textB.length, 10);
  for (let i = minOverlap; i >= 3; i--) {
    // Check if end of A matches start of B
    if (textA.slice(-i) === textB.slice(0, i)) {
      return textA + textB.slice(i);
    }
    // Check if end of B matches start of A
    if (textB.slice(-i) === textA.slice(0, i)) {
      return textB + textA.slice(i);
    }
  }

  // No overlap found - concatenate with space
  // But use the longer text if one is much shorter (likely a subset)
  if (textA.length > textB.length * 2) return textA;
  if (textB.length > textA.length * 2) return textB;

  return `${textA} ${textB}`.trim();
}

/**
 * Merge two text highlight shapes into one
 * Combines all rects and merges overlapping ones
 */
export function mergeHighlightShapes(
  a: TextHighlightShape,
  b: TextHighlightShape,
  options: HighlightMergeOptions = {}
): TextHighlightShape {
  // Combine all rects and merge them
  const allRects = [...a.rects, ...b.rects];
  const mergedRects = mergeHighlightRects(allRects, options);

  // Intelligently combine text (avoid duplication)
  const combinedText = combineHighlightText(a.text, b.text);

  return {
    id: a.id, // Keep the first shape's ID
    type: "text-highlight",
    rects: mergedRects,
    text: combinedText,
    style: { ...a.style }, // Keep first shape's style
  };
}

/**
 * Result of trying to merge a new highlight with existing shapes
 */
export interface MergeWithExistingResult {
  /** The merged shape (or original if no merge) */
  shape: TextHighlightShape;
  /** IDs of shapes that were merged (to be removed) */
  mergedIds: string[];
}

/**
 * Try to merge a new highlight shape with existing highlight shapes
 * Returns the merged shape and IDs of shapes that were consumed
 */
export function mergeWithExistingHighlights(
  newShape: TextHighlightShape,
  existingShapes: TextHighlightShape[],
  options: HighlightMergeOptions = {}
): MergeWithExistingResult {
  let result = newShape;
  const mergedIds: string[] = [];

  for (const existing of existingShapes) {
    if (highlightShapesOverlap(result, existing, options)) {
      result = mergeHighlightShapes(result, existing, options);
      mergedIds.push(existing.id);
    }
  }

  return { shape: result, mergedIds };
}
