/**
 * Text Highlight Subtract - Remove/split highlight regions
 *
 * Supports:
 * 1. Full removal: Eraser covers entire highlight rect
 * 2. Edge trim: Eraser covers left or right edge
 * 3. Middle split: Eraser in middle → split into two rects
 *
 * Algorithm:
 * 1. For each highlight rect, check overlap with eraser rects
 * 2. Apply subtraction operations based on overlap type
 * 3. Combine results into modified/removed/split shapes
 */

import type { Bounds } from "../../types/geometry";
import { generateShapeId } from "../common/registry";
import type { TextHighlightShape } from "./types";

// =============================================================================
// TYPES
// =============================================================================

export interface SubtractOptions {
  /** Y-tolerance for same-row detection (default: 3) */
  rowTolerance?: number;
  /** X-overlap tolerance for subtraction (default: 2) */
  overlapTolerance?: number;
  /** Minimum width for resulting rect pieces (default: 5) */
  minWidth?: number;
}

export interface SubtractResult {
  /** Shapes that were modified (rects changed) */
  modifiedShapes: TextHighlightShape[];
  /** IDs of shapes that should be removed (fully erased) */
  removedIds: string[];
  /** New shapes created from splits */
  splitShapes: TextHighlightShape[];
}

// =============================================================================
// MAIN FUNCTION
// =============================================================================

/**
 * Apply eraser to all existing highlight shapes
 */
export function subtractFromExistingHighlights(
  eraserRects: Bounds[],
  existingShapes: TextHighlightShape[],
  options: SubtractOptions = {}
): SubtractResult {
  const result: SubtractResult = {
    modifiedShapes: [],
    removedIds: [],
    splitShapes: [],
  };

  for (const shape of existingShapes) {
    const subtracted = subtractFromHighlightShape(shape, eraserRects, options);

    if (subtracted.remove) {
      // Shape fully erased
      result.removedIds.push(shape.id);
    } else if (subtracted.modified) {
      // Shape was modified
      result.modifiedShapes.push(subtracted.modified);

      // Add any split shapes
      if (subtracted.splits && subtracted.splits.length > 0) {
        result.splitShapes.push(...subtracted.splits);
      }
    }
    // If neither remove nor modified, shape was unchanged
  }

  return result;
}

// =============================================================================
// SHAPE-LEVEL SUBTRACTION
// =============================================================================

interface ShapeSubtractResult {
  /** Shape should be removed */
  remove: boolean;
  /** Modified shape (if rects changed) */
  modified: TextHighlightShape | null;
  /** New shapes from splits */
  splits: TextHighlightShape[];
}

/**
 * Subtract eraser rects from a single highlight shape
 */
function subtractFromHighlightShape(
  shape: TextHighlightShape,
  eraserRects: Bounds[],
  options: SubtractOptions
): ShapeSubtractResult {
  const { minWidth = 5 } = options;

  // Apply all eraser rects to shape's rects
  let currentRects = [...shape.rects];

  for (const eraser of eraserRects) {
    const newRects: Bounds[] = [];

    for (const rect of currentRects) {
      const subtracted = subtractFromRect(rect, eraser, options);
      // Filter out pieces that are too small
      const validPieces = subtracted.filter((r) => r.width >= minWidth);
      newRects.push(...validPieces);
    }

    currentRects = newRects;

    // Early exit if all rects removed
    if (currentRects.length === 0) {
      return { remove: true, modified: null, splits: [] };
    }
  }

  // Check if any changes were made
  if (areRectsEqual(currentRects, shape.rects)) {
    // No changes
    return { remove: false, modified: null, splits: [] };
  }

  // Check if we have multiple disconnected groups (splits)
  const groups = groupConnectedRects(currentRects, options);

  if (groups.length === 1) {
    // Single group - just modified
    return {
      remove: false,
      modified: {
        ...shape,
        rects: currentRects,
      },
      splits: [],
    };
  }

  // Multiple groups - main shape gets first group, rest are splits
  const [mainGroup, ...splitGroups] = groups;

  // Estimate text portions based on rect coverage
  // This is a rough approximation since we don't have exact text-to-rect mapping
  const totalWidth = shape.rects.reduce((sum, r) => sum + r.width, 0);
  const mainWidth = (mainGroup ?? []).reduce((sum, r) => sum + r.width, 0);
  const mainRatio = totalWidth > 0 ? mainWidth / totalWidth : 1;

  // For the main group, keep most of the text proportionally
  // For split groups, mark as partial since we can't reliably split text
  const originalText = shape.text;
  const textLength = originalText.length;

  const modified: TextHighlightShape = {
    ...shape,
    rects: mainGroup ?? [],
    // Estimate text portion (rough approximation)
    text: mainRatio > 0.8 
      ? originalText 
      : originalText.slice(0, Math.ceil(textLength * mainRatio)).trim() || originalText,
  };

  const splits: TextHighlightShape[] = splitGroups.map((rects, index) => {
    const groupWidth = rects.reduce((sum, r) => sum + r.width, 0);
    const ratio = totalWidth > 0 ? groupWidth / totalWidth : 0;
    const startRatio = mainRatio + splitGroups.slice(0, index).reduce((sum, g) => {
      return sum + g.reduce((s, r) => s + r.width, 0) / totalWidth;
    }, 0);

    return {
    id: generateShapeId(),
    type: "text-highlight",
    rects,
      // Estimate text portion for split piece
      text: ratio > 0.3
        ? originalText.slice(
            Math.floor(textLength * startRatio),
            Math.ceil(textLength * (startRatio + ratio))
          ).trim() || `[${originalText.slice(0, 20)}...]`
        : `[${originalText.slice(0, 20)}...]`,
    style: { ...shape.style },
    };
  });

  return { remove: false, modified, splits };
}

// =============================================================================
// RECT-LEVEL SUBTRACTION
// =============================================================================

/**
 * Subtract eraser from a single rect
 * Returns 0 (full removal), 1 (edge trim), or 2 (middle split) rects
 */
function subtractFromRect(
  rect: Bounds,
  eraser: Bounds,
  options: SubtractOptions
): Bounds[] {
  const { rowTolerance = 3, overlapTolerance = 2 } = options;

  // Check if on same row (Y overlap)
  if (!rectsOnSameRow(rect, eraser, rowTolerance)) {
    return [rect]; // No overlap, keep original
  }

  // Check X overlap
  const rectRight = rect.x + rect.width;
  const eraserRight = eraser.x + eraser.width;

  // No X overlap?
  if (eraser.x >= rectRight + overlapTolerance || eraserRight <= rect.x - overlapTolerance) {
    return [rect]; // No overlap, keep original
  }

  // Case 1: Eraser completely covers rect
  if (eraser.x <= rect.x + overlapTolerance && eraserRight >= rectRight - overlapTolerance) {
    return []; // Remove entirely
  }

  // Case 2: Eraser covers left edge
  if (eraser.x <= rect.x + overlapTolerance && eraserRight < rectRight) {
    return [
      {
        x: eraserRight,
        y: rect.y,
        width: rectRight - eraserRight,
        height: rect.height,
      },
    ];
  }

  // Case 3: Eraser covers right edge
  if (eraser.x > rect.x && eraserRight >= rectRight - overlapTolerance) {
    return [
      {
        x: rect.x,
        y: rect.y,
        width: eraser.x - rect.x,
        height: rect.height,
      },
    ];
  }

  // Case 4: Eraser in middle → SPLIT
  if (eraser.x > rect.x && eraserRight < rectRight) {
    return [
      {
        x: rect.x,
        y: rect.y,
        width: eraser.x - rect.x,
        height: rect.height,
      },
      {
        x: eraserRight,
        y: rect.y,
        width: rectRight - eraserRight,
        height: rect.height,
      },
    ];
  }

  return [rect]; // Fallback: no effective overlap
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Check if two rects are on the same row (Y overlap)
 */
function rectsOnSameRow(a: Bounds, b: Bounds, tolerance: number): boolean {
  const aCenterY = a.y + a.height / 2;
  const bCenterY = b.y + b.height / 2;

  // Check if Y centers are within tolerance + half heights
  const maxDistance = tolerance + Math.max(a.height, b.height) / 2;
  return Math.abs(aCenterY - bCenterY) <= maxDistance;
}

/**
 * Check if two rect arrays are equal
 */
function areRectsEqual(a: Bounds[], b: Bounds[]): boolean {
  if (a.length !== b.length) return false;

  for (let i = 0; i < a.length; i++) {
    const ra = a[i]!;
    const rb = b[i]!;
    if (ra.x !== rb.x || ra.y !== rb.y || ra.width !== rb.width || ra.height !== rb.height) {
      return false;
    }
  }

  return true;
}

/**
 * Group rects into connected components (same row, adjacent X)
 * Used to detect when subtraction creates disconnected pieces
 */
function groupConnectedRects(
  rects: Bounds[],
  options: SubtractOptions
): Bounds[][] {
  const { rowTolerance = 3 } = options;

  if (rects.length <= 1) {
    return rects.length === 0 ? [] : [rects];
  }

  // Sort by Y then X
  const sorted = [...rects].sort((a, b) => {
    const yCenterA = a.y + a.height / 2;
    const yCenterB = b.y + b.height / 2;
    if (Math.abs(yCenterA - yCenterB) > rowTolerance) {
      return yCenterA - yCenterB;
    }
    return a.x - b.x;
  });

  const groups: Bounds[][] = [];
  let currentGroup: Bounds[] = [sorted[0]!];

  for (let i = 1; i < sorted.length; i++) {
    const rect = sorted[i]!;
    const lastInGroup = currentGroup[currentGroup.length - 1]!;

    // Check if connected (same row and X overlap/adjacent)
    const sameRow = rectsOnSameRow(rect, lastInGroup, rowTolerance);
    const xAdjacent = rect.x <= lastInGroup.x + lastInGroup.width + 10; // 10px gap allowed

    if (sameRow && xAdjacent) {
      currentGroup.push(rect);
    } else {
      groups.push(currentGroup);
      currentGroup = [rect];
    }
  }

  groups.push(currentGroup);
  return groups;
}

/**
 * Check if any eraser rect overlaps with any highlight rect
 */
export function eraserOverlapsHighlight(
  eraserRects: Bounds[],
  highlightRects: Bounds[],
  options: SubtractOptions = {}
): boolean {
  const { rowTolerance = 3, overlapTolerance = 2 } = options;

  for (const eraser of eraserRects) {
    for (const highlight of highlightRects) {
      if (!rectsOnSameRow(eraser, highlight, rowTolerance)) continue;

      const highlightRight = highlight.x + highlight.width;
      const eraserRight = eraser.x + eraser.width;

      // Check X overlap
      if (
        eraser.x < highlightRight + overlapTolerance &&
        eraserRight > highlight.x - overlapTolerance
      ) {
        return true;
      }
    }
  }

  return false;
}

