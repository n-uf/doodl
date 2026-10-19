/**
 * Text Bounds Finder
 *
 * Utilities for finding text in a DOM text layer and returning bounding rectangles.
 * This is the reverse operation of text-intersection.ts:
 * - text-intersection: bounds → text (what text is inside this region?)
 * - text-bounds-finder: text → bounds (where does this text appear?)
 *
 * Geometry strategy for PDF.js text layers:
 * Spans use `transform: scaleX(--scale-x)`, which makes
 * `Range.getClientRects()` unreliable for substring matches (wrong/phantom
 * rects, often full-span or misaligned). Instead we:
 * 1. Map concatenated text → DOM char positions
 * 2. Find substring matches
 * 3. Derive bounds from each parent span's *visual*
 *    `getBoundingClientRect()` sliced proportionally by character offsets
 *    within that span (matches how PDF.js lays out glyph advances)
 */

import type { Bounds } from "../../../types/geometry";

// =============================================================================
// TYPES
// =============================================================================

/**
 * Character position mapping to DOM text node.
 * Synthetic separators (inserted for visual word/line gaps) have `synthetic: true`
 * and must not be used as Range endpoints.
 */
interface CharPosition {
  /** The DOM Text node containing this character (null for synthetic separators) */
  textNode: Text | null;
  /** Index of this character within the text node (-1 for synthetic) */
  charIndex: number;
  /** True when this slot is a synthetic space, not a real DOM character */
  synthetic: boolean;
}

/**
 * Text layer map for efficient substring searching
 */
interface TextLayerMap {
  /** Concatenated text from all text nodes */
  fullText: string;
  /** Mapping from fullText index to DOM position */
  charPositions: CharPosition[];
}

/**
 * Match result with bounding rectangles
 */
export interface TextMatch {
  /** Matched text (may differ in case from search) */
  text: string;
  /** Bounding rectangles (multiple for multi-line / multi-span matches) */
  bounds: Bounds[];
  /** Start index in concatenated text */
  startIndex: number;
  /** End index in concatenated text */
  endIndex: number;
}

/**
 * Match mode for text search
 *
 * - "substring": Match anywhere in text (e.g., "STD" matches inside "STANDARD")
 * - "word": Match only at word boundaries (e.g., "STD" won't match inside "STANDARD")
 */
export type TextMatchMode = "substring" | "word";

/**
 * Options for findTextInTextLayer
 */
export interface FindTextOptions {
  /** Scale factor for coordinate conversion */
  scale: number;
  /** Case-insensitive matching (default: true) */
  ignoreCase?: boolean;
  /** Maximum matches to find (default: 50) */
  maxMatches?: number;
  /** Merge adjacent/overlapping rects (default: true) */
  mergeRects?: boolean;
  /**
   * Match mode (default: "substring")
   *
   * - "substring": Find text anywhere (handles PDF font subsetting where
   *   "SOFTWARE" may be split as "SOFT"+"WARE" across text nodes)
   * - "word": Require word boundaries around match (prevents "STD" matching
   *   inside "STANDARD")
   */
  matchMode?: TextMatchMode;
}

// =============================================================================
// TEXT LAYER MAP BUILDING
// =============================================================================

/**
 * Check if two DOM elements have visual separation (different lines or horizontal gap)
 *
 * Uses bounding rects to determine if elements are visually separated,
 * which indicates a word boundary vs. font subsetting split.
 *
 * @param prevElement - Previous element's parent span
 * @param currElement - Current element's parent span
 * @param threshold - Minimum gap to consider as word boundary (default: 2px)
 * @returns true if there's visual separation (should add space)
 */
function hasVisualSeparation(
  prevElement: Element | null,
  currElement: Element | null,
  threshold = 2,
): boolean {
  if (!prevElement || !currElement) return false;

  const prevRect = prevElement.getBoundingClientRect();
  const currRect = currElement.getBoundingClientRect();

  // Different lines: significant Y difference (more than line height variation)
  const yDiff = Math.abs(currRect.top - prevRect.top);
  if (yDiff > prevRect.height * 0.5) {
    return true;
  }

  // Same line but horizontal gap: space between end of prev and start of curr
  const gap = currRect.left - prevRect.right;
  if (gap > threshold) {
    return true;
  }

  return false;
}

/**
 * Get the parent span element for a text node (for position checking)
 */
function getParentSpan(textNode: Text): Element | null {
  let parent: Node | null = textNode.parentNode;
  while (parent && parent.nodeType !== Node.ELEMENT_NODE) {
    parent = parent.parentNode;
  }
  return parent as Element | null;
}

/**
 * Build a character position map from a text layer element
 *
 * Walks all text nodes in the DOM tree and creates a mapping from
 * each character position in the concatenated text to its source
 * DOM Text node and local character index.
 *
 * Uses position-aware concatenation:
 * - Visually adjacent text (font subsetting): "SOFT" + "WARE" → "SOFTWARE"
 * - Line breaks or word gaps: "software" + "development" → "software development"
 *
 * @param textLayer - The text layer DOM element
 * @returns TextLayerMap with fullText and charPositions
 */
function buildTextLayerMap(textLayer: HTMLElement): TextLayerMap {
  const fullTextChars: string[] = [];
  const charPositions: CharPosition[] = [];

  const walker = document.createTreeWalker(textLayer, NodeFilter.SHOW_TEXT);
  let node: Text | null = walker.nextNode() as Text | null;
  let prevNode: Text | null = null;
  let prevSpan: Element | null = null;

  while (node) {
    const text = node.textContent ?? "";
    if (text.length === 0) {
      node = walker.nextNode() as Text | null;
      continue;
    }

    const currSpan = getParentSpan(node);

    // Check if we need to add a space between this node and previous
    // Only add space if:
    // 1. There was a previous node with content
    // 2. Previous didn't end with whitespace
    // 3. Current doesn't start with whitespace
    // 4. There's visual separation (different lines or horizontal gap)
    const shouldAddSpace =
      prevNode &&
      fullTextChars.length > 0 &&
      prevSpan !== currSpan && // Different spans (same span = definitely same word)
      !/\s$/.test(fullTextChars[fullTextChars.length - 1] ?? "") &&
      !/^\s/.test(text) &&
      hasVisualSeparation(prevSpan, currSpan);

    if (shouldAddSpace) {
      // Synthetic separator — not a real DOM character. Must not be used as a
      // Range endpoint (old code mapped these to charIndex 0 of the next node,
      // which corrupted substring geometry).
      fullTextChars.push(" ");
      charPositions.push({ textNode: null, charIndex: -1, synthetic: true });
    }

    // Map each character to its node position
    for (let i = 0; i < text.length; i++) {
      fullTextChars.push(text[i] ?? "");
      charPositions.push({ textNode: node, charIndex: i, synthetic: false });
    }

    prevNode = node;
    prevSpan = currSpan;
    node = walker.nextNode() as Text | null;
  }

  return { fullText: fullTextChars.join(""), charPositions };
}

// =============================================================================
// BOUNDS MERGING
// =============================================================================

/**
 * Merge adjacent or overlapping bounds into fewer rectangles
 *
 * Groups bounds that are on the same line (similar Y position) and
 * merges horizontally adjacent bounds.
 */
function mergeAdjacentBounds(bounds: Bounds[]): Bounds[] {
  if (bounds.length <= 1) return bounds;

  // Sort by Y then X
  const sorted = [...bounds].sort((a, b) => {
    const yDiff = a.y - b.y;
    if (Math.abs(yDiff) < 5) {
      // Same line (within 5px tolerance)
      return a.x - b.x;
    }
    return yDiff;
  });

  const merged: Bounds[] = [];
  let current = { ...sorted[0]! };

  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i]!;

    // Check if same line and horizontally adjacent/overlapping
    const sameLineY = Math.abs(current.y - next.y) < 5;
    const horizontallyAdjacent = next.x <= current.x + current.width + 2;

    if (sameLineY && horizontallyAdjacent) {
      // Merge: extend current to include next
      const newRight = Math.max(current.x + current.width, next.x + next.width);
      current.width = newRight - current.x;
      // Take max height
      current.height = Math.max(current.height, next.height);
    } else {
      // Push current and start new
      merged.push(current);
      current = { ...next };
    }
  }

  merged.push(current);
  return merged;
}

// =============================================================================
// MATCH GEOMETRY (span-proportional)
// =============================================================================

interface SpanSegment {
  textNode: Text;
  /** Inclusive start index within the text node */
  startChar: number;
  /** Exclusive end index within the text node */
  endChar: number;
}

/**
 * Collapse a match's charPositions into contiguous per-text-node segments,
 * skipping synthetic separator slots.
 */
function collectMatchSegments(
  charPositions: CharPosition[],
  matchStart: number,
  matchEnd: number,
): SpanSegment[] {
  const segments: SpanSegment[] = [];
  let current: SpanSegment | null = null;

  for (let i = matchStart; i < matchEnd; i++) {
    const pos = charPositions[i];
    if (!pos || pos.synthetic || pos.textNode === null || pos.charIndex < 0) {
      // Break segment across synthetic gaps
      current = null;
      continue;
    }

    if (
      current &&
      current.textNode === pos.textNode &&
      current.endChar === pos.charIndex
    ) {
      current.endChar = pos.charIndex + 1;
    } else {
      current = {
        textNode: pos.textNode,
        startChar: pos.charIndex,
        endChar: pos.charIndex + 1,
      };
      segments.push(current);
    }
  }

  return segments;
}

/**
 * Bounds for one span segment via proportional slice of the span's visual rect.
 *
 * PDF.js stretches each span with scaleX so the *element* box matches glyph
 * advances; character fractions of that box are the reliable substring quads.
 * Range.getClientRects() is not used here — it misbehaves under scaleX.
 */
function boundsForSpanSegment(
  segment: SpanSegment,
  layerRect: DOMRect,
  scale: number,
): Bounds | null {
  const span = getParentSpan(segment.textNode);
  if (!span) return null;

  const spanText = segment.textNode.textContent ?? "";
  if (spanText.length === 0) return null;

  const start = Math.max(0, Math.min(segment.startChar, spanText.length));
  const end = Math.max(start, Math.min(segment.endChar, spanText.length));
  if (end <= start) return null;

  const spanRect = span.getBoundingClientRect();
  if (spanRect.width <= 0 || spanRect.height <= 0) return null;

  const leftFrac = start / spanText.length;
  const rightFrac = end / spanText.length;

  const left = spanRect.left + spanRect.width * leftFrac;
  const right = spanRect.left + spanRect.width * rightFrac;

  return {
    x: (left - layerRect.left) / scale,
    y: (spanRect.top - layerRect.top) / scale,
    width: (right - left) / scale,
    height: spanRect.height / scale,
  };
}

/**
 * Compute page-space bounds for a match using span-proportional geometry.
 */
function boundsForMatch(
  charPositions: CharPosition[],
  matchStart: number,
  matchEnd: number,
  layerRect: DOMRect,
  scale: number,
  mergeRects: boolean,
): Bounds[] {
  const segments = collectMatchSegments(charPositions, matchStart, matchEnd);
  const bounds: Bounds[] = [];

  for (const segment of segments) {
    const bound = boundsForSpanSegment(segment, layerRect, scale);
    if (bound && bound.width > 0 && bound.height > 0) {
      bounds.push(bound);
    }
  }

  return mergeRects ? mergeAdjacentBounds(bounds) : bounds;
}

// =============================================================================
// MAIN FUNCTION
// =============================================================================

/**
 * Find all occurrences of text in a text layer and return their bounds
 *
 * 1. Build char→node position map from text layer
 * 2. Find substring matches in concatenated text
 * 3. Derive substring-accurate bounds from parent span visual rects
 *    (proportional character slices — safe under PDF.js scaleX transforms)
 *
 * @param searchText - Text to search for
 * @param textLayer - The text layer DOM element
 * @param options - Search options
 * @returns Array of TextMatch with bounds
 *
 * @example
 * ```typescript
 * const matches = findTextInTextLayer("BlueForge", textLayerEl, { scale: 1.5 });
 * // Returns: [{ text: "BlueForge", bounds: [{x, y, width, height}], ... }]
 * ```
 */
export function findTextInTextLayer(
  searchText: string,
  textLayer: HTMLElement,
  options: FindTextOptions,
): TextMatch[] {
  const {
    scale,
    ignoreCase = true,
    maxMatches = 50,
    mergeRects = true,
    matchMode = "substring",
  } = options;

  // Edge cases
  if (!searchText || !textLayer || scale === 0) {
    return [];
  }

  // Build character position map
  const { fullText, charPositions } = buildTextLayerMap(textLayer);

  if (fullText.length === 0 || charPositions.length === 0) {
    return [];
  }

  // Prepare for search
  const normalizedSearch = ignoreCase ? searchText.toLowerCase() : searchText;
  const normalizedFull = ignoreCase ? fullText.toLowerCase() : fullText;
  const layerRect = textLayer.getBoundingClientRect();

  // Word boundary check for "word" match mode
  const isWordBoundary = (char: string | undefined): boolean => {
    if (char === undefined) return true; // Start/end of text is a boundary
    // Word boundary: whitespace, punctuation, or non-alphanumeric
    return !/[a-zA-Z0-9]/.test(char);
  };

  const matches: TextMatch[] = [];
  let searchIdx = 0;

  // Find all substring matches
  while (matches.length < maxMatches) {
    const matchStart = normalizedFull.indexOf(normalizedSearch, searchIdx);
    if (matchStart === -1) break;

    const matchEnd = matchStart + searchText.length;

    // For "word" mode, check word boundaries
    if (matchMode === "word") {
      const charBefore = normalizedFull[matchStart - 1];
      const charAfter = normalizedFull[matchEnd];
      if (!isWordBoundary(charBefore) || !isWordBoundary(charAfter)) {
        // Not at word boundaries - skip this match
        searchIdx = matchStart + 1;
        continue;
      }
    }

    // Reject matches whose character span is only synthetic separators
    // (shouldn't happen for real queries, but keeps geometry honest).
    const hasRealChars = charPositions
      .slice(matchStart, matchEnd)
      .some((p) => p && !p.synthetic);
    if (!hasRealChars) {
      searchIdx = matchStart + 1;
      continue;
    }

    const bounds = boundsForMatch(
      charPositions,
      matchStart,
      matchEnd,
      layerRect,
      scale,
      mergeRects,
    );

    if (bounds.length > 0) {
      matches.push({
        text: fullText.slice(matchStart, matchEnd),
        bounds,
        startIndex: matchStart,
        endIndex: matchEnd,
      });
    }

    // Move past this match to find next
    searchIdx = matchStart + 1;
  }

  return matches;
}

/**
 * Check if text layer contains the search text
 *
 * Quick existence check without computing bounds.
 *
 * @param searchText - Text to search for
 * @param textLayer - The text layer DOM element
 * @param ignoreCase - Case-insensitive matching (default: true)
 * @returns true if text is found
 */
export function hasTextInTextLayer(
  searchText: string,
  textLayer: HTMLElement,
  ignoreCase = true,
): boolean {
  if (!searchText || !textLayer) return false;

  const { fullText } = buildTextLayerMap(textLayer);

  const normalizedSearch = ignoreCase ? searchText.toLowerCase() : searchText;
  const normalizedFull = ignoreCase ? fullText.toLowerCase() : fullText;

  return normalizedFull.includes(normalizedSearch);
}

// Exported for unit tests
export const __testOnly = {
  collectMatchSegments,
  mergeAdjacentBounds,
};
