/**
 * Selection Rect Validation Utilities
 *
 * Validates browser selection rects against text layer spans.
 * Filters phantom rects that occur when selecting from blank zones in PDFs.
 */

// =============================================================================
// CONSTANTS
// =============================================================================

/** Overlap tolerance in pixels for span validation */
export const SELECTION_OVERLAP_TOLERANCE = 2;

// =============================================================================
// RECT OVERLAP
// =============================================================================

/**
 * Check if two DOMRects overlap with tolerance
 */
export function rectsOverlap(
  a: DOMRect,
  b: DOMRect,
  tolerance: number = SELECTION_OVERLAP_TOLERANCE
): boolean {
  return !(
    a.right + tolerance < b.left ||
    b.right + tolerance < a.left ||
    a.bottom + tolerance < b.top ||
    b.bottom + tolerance < a.top
  );
}

// =============================================================================
// TEXT RECT VALIDATION
// =============================================================================

/**
 * Check if a selection rect legitimately corresponds to a text span
 * A legitimate rect should:
 * 1. Have similar height to the span it overlaps
 * 2. Have its vertical start (top) within or very close to the span's vertical extent
 *
 * This filters out:
 * - Container rects (page-sized rects that overlap all spans)
 * - Phantom rects from blank zone selection (rects that start above text but extend down to overlap it)
 */
export function isLegitimateTextRect(
  selectionRect: DOMRect,
  spanRect: DOMRect,
  tolerance: number = SELECTION_OVERLAP_TOLERANCE
): boolean {
  // Selection rect height shouldn't be more than 3x the span height
  // This filters out container rects that span multiple lines
  const heightRatio = selectionRect.height / spanRect.height;
  if (heightRatio > 3) {
    return false;
  }

  // CRITICAL FIX: Selection rect top must be within or close to span's vertical extent
  // This filters out phantom rects that start in blank zones (above text) but extend down to overlap text
  // A valid selection rect should start AT or NEAR the text line it's selecting
  //
  // Example of phantom rect:
  //   - User starts selecting in blank zone above "Developer:" (y=200)
  //   - Browser creates rect from y=200 to text at y=400 (the "Developer:" line)
  //   - This phantom rect has top=200, which is far above the span top=400
  //   - We reject this because selectionRect.top (200) > spanRect.bottom (420)
  //
  // Valid selection rect:
  //   - User selects text "Developer:" directly
  //   - Selection rect has top close to span top (both ~400)
  //   - selectionRect.top (400) is NOT > spanRect.bottom (420), so it passes
  const selectionStartsAboveSpan = selectionRect.top + tolerance < spanRect.top;
  const selectionStartsBelowSpan =
    selectionRect.top > spanRect.bottom + tolerance;

  // If selection rect starts outside the span's vertical extent, it's likely a phantom rect
  // Allow some tolerance for line height variations
  if (selectionStartsAboveSpan || selectionStartsBelowSpan) {
    return false;
  }

  return true;
}

// =============================================================================
// CONNECTOR RECT VALIDATION
// =============================================================================

/**
 * Maximum gap ratio for connector rects.
 * A connector rect should bridge a gap no larger than this multiplier
 * times the average height of adjacent spans.
 *
 * This prevents phantom rects in large blank zones between paragraphs
 * from being treated as valid connectors.
 */
const MAX_CONNECTOR_GAP_RATIO = 1.5;

/**
 * Check if a rect is vertically between two other rects (connector rect)
 * Used for valid rects that span the gap between text lines.
 *
 * A valid connector rect must:
 * 1. Have text spans above AND below it (with horizontal overlap)
 * 2. The gap it bridges must be small (adjacent lines, not paragraph gaps)
 *
 * This filters out phantom rects that appear in blank zones between paragraphs.
 */
export function isVerticallyBetween(
  rect: DOMRect,
  spanRects: DOMRect[],
  tolerance: number = SELECTION_OVERLAP_TOLERANCE
): boolean {
  if (spanRects.length < 2) return false;

  // Find the CLOSEST span above and below with horizontal overlap
  // We need to verify the gap is small enough (same paragraph, adjacent lines)
  let closestAbove: DOMRect | null = null;
  let closestBelow: DOMRect | null = null;

  for (const spanRect of spanRects) {
    // Check horizontal overlap (spans must be in same column)
    const hasHorizontalOverlap = !(
      spanRect.right + tolerance < rect.left ||
      rect.right + tolerance < spanRect.left
    );
    if (!hasHorizontalOverlap) continue;

    // Span is above rect (span bottom is above rect top)
    if (spanRect.bottom <= rect.top + tolerance) {
      // Track closest (highest bottom value)
      if (!closestAbove || spanRect.bottom > closestAbove.bottom) {
        closestAbove = spanRect;
      }
    }

    // Span is below rect (span top is below rect bottom)
    if (spanRect.top >= rect.bottom - tolerance) {
      // Track closest (lowest top value)
      if (!closestBelow || spanRect.top < closestBelow.top) {
        closestBelow = spanRect;
      }
    }
  }

  // Must have spans both above and below
  if (!closestAbove || !closestBelow) {
    return false;
  }

  // CRITICAL FIX: Check if the gap is reasonable (adjacent lines, not paragraph gaps)
  // Calculate the gap between the closest spans
  const gapBetweenSpans = closestBelow.top - closestAbove.bottom;

  // Use the average height of the two spans as reference for typical line height
  const avgSpanHeight = (closestAbove.height + closestBelow.height) / 2;

  // If the gap is too large compared to typical line height, it's a paragraph gap
  // Reject the connector rect as it's likely a phantom rect in a blank zone
  if (gapBetweenSpans > avgSpanHeight * MAX_CONNECTOR_GAP_RATIO) {
    return false;
  }

  return true;
}
