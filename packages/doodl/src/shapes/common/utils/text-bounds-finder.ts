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
 * Result of findTextInTextLayerDetailed
 */
export interface FindTextResult {
  /** Matches found, at most `maxMatches` */
  matches: TextMatch[];
  /** True when more matches exist than `maxMatches` allowed */
  truncated: boolean;
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
 * Horizontal gap between two spans, as a fraction of the span height, above
 * which a synthetic space is inserted (zoom-independent replacement for the
 * old fixed 2px).
 */
const WORD_GAP_RATIO = 0.15;

const SOFT_HYPHEN = "\u00AD";
/** Whitespace other than U+FEFF, at the end / start of a string. */
const SPACE_AT_END_RE = /[^\S\uFEFF]$/u;
const SPACE_AT_START_RE = /^[^\S\uFEFF]/u;

/**
 * Check if two DOM elements have visual separation (different lines or horizontal gap)
 *
 * Uses bounding rects to determine if elements are visually separated,
 * which indicates a word boundary vs. font subsetting split.
 *
 * @param prevElement - Previous element's parent span
 * @param currElement - Current element's parent span
 * @param gapRatio - Minimum horizontal gap, as a fraction of the previous
 *   span's height (a proxy for font size), to count as a word boundary
 *   (default: 0.15). Relative, so word joins do not depend on zoom.
 * @returns true if there's visual separation (should add space)
 */
function hasVisualSeparation(
  prevElement: Element | null,
  currElement: Element | null,
  gapRatio = WORD_GAP_RATIO,
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
  if (gap > prevRect.height * gapRatio) {
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
    // 5. Previous didn't end in a soft hyphen (a hyphenation point at a line
    //    wrap: "confi" + SHY, then "dential", is one word)
    // U+FEFF (a BOM) is not whitespace for this decision.
    const prevChar = fullTextChars[fullTextChars.length - 1] ?? "";
    const shouldAddSpace =
      prevNode &&
      fullTextChars.length > 0 &&
      prevSpan !== currSpan && // Different spans (same span = definitely same word)
      !SPACE_AT_END_RE.test(prevChar) &&
      !SPACE_AT_START_RE.test(text) &&
      prevChar !== SOFT_HYPHEN &&
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
// TEXT NORMALISATION (with an index map back to the original text)
// =============================================================================

/**
 * Normalised text plus, for every normalised UTF-16 unit, the half-open range
 * `[origStart[i], origEnd[i])` of the original text it came from. Match rects
 * stay exact because a match is converted back through this map.
 */
interface NormalizedText {
  text: string;
  origStart: number[];
  origEnd: number[];
}

/** Soft hyphen, ZWNJ and ZWJ: invisible inside a word, dropped, never matched. */
const IGNORABLE_RE = /[\u00AD\u200C\u200D]/u;
/**
 * Whitespace for matching: `\s` plus the zero-width space U+200B, which marks
 * a word break (U+FEFF is already in `\s`).
 */
const WHITESPACE_RE = /[\s\u200B]/u;
const COMBINING_MARK_RE = /\p{M}/u;

/**
 * Non-mark characters that still compose with the previous one under NFKC:
 * Hangul jamo vowels and trailing consonants (U+1160-U+11FF, U+D7B0-U+D7FF:
 * decomposed Hangul) and the half-width voiced / semi-voiced sound marks
 * (U+FF9E, U+FF9F: "ｶ" + "ﾞ" is "ガ").
 */
function isClusterExtender(cp: number): boolean {
  return (
    (cp >= 0x1160 && cp <= 0x11ff) ||
    (cp >= 0xd7b0 && cp <= 0xd7ff) ||
    cp === 0xff9e ||
    cp === 0xff9f
  );
}

/**
 * Normalise `source` for searching, keeping an index map.
 *
 * Both the layer text and the query go through this one function, so they are
 * compared in the same form:
 * - NFKC (ligatures like "ﬁ" become "fi"; NFC and NFD forms of an accent agree)
 * - soft hyphen (U+00AD) and the zero-width joiners U+200C and U+200D are
 *   dropped
 * - every run of whitespace (NBSP, tabs, newlines, synthetic separators, and
 *   the zero-width space U+200B and U+FEFF, which are word breaks) becomes a
 *   single space
 * - optionally lower-cased
 *
 * Work is done per cluster (a base character plus its combining marks) so a
 * decomposed "e" + U+0301 composes into "é". A normalised unit maps to the
 * whole original cluster, which is what keeps the length-changing cases
 * ("ﬁ" -> "fi", "İ" -> "i̇") from drifting the indices.
 */
function normalizeWithMap(source: string, ignoreCase: boolean): NormalizedText {
  const out: string[] = [];
  const origStart: number[] = [];
  const origEnd: number[] = [];

  const emit = (chunk: string, from: number, to: number) => {
    for (let k = 0; k < chunk.length; k++) {
      const ch = chunk[k]!;
      if (WHITESPACE_RE.test(ch)) {
        const last = out.length - 1;
        if (last >= 0 && out[last] === " ") {
          origEnd[last] = to; // extend the collapsed run
          continue;
        }
        out.push(" ");
      } else {
        out.push(ch);
      }
      origStart.push(from);
      origEnd.push(to);
    }
  };

  const flush = (from: number, to: number) => {
    if (to <= from) return;
    const cluster = source.slice(from, to);
    // Fast path: printable ASCII needs no Unicode normalisation.
    let chunk: string;
    if (/^[\x20-\x7e]+$/.test(cluster)) {
      chunk = ignoreCase ? cluster.toLowerCase() : cluster;
    } else {
      chunk = cluster.normalize("NFKC");
      if (ignoreCase) {
        // Final sigma is context-sensitive: fold it to the medial form, one
        // unit for one unit, so "οδος" and "ΟΔΟΣ" agree and the map is intact.
        chunk = chunk
          .toLowerCase()
          .normalize("NFKC")
          .replace(/\u03C2/g, "\u03C3");
      }
    }
    emit(chunk, from, to);
  };

  let clusterStart = 0;
  let i = 0;
  while (i < source.length) {
    const cp = source.codePointAt(i)!;
    const ch = String.fromCodePoint(cp);
    const next = i + ch.length;

    if (IGNORABLE_RE.test(ch)) {
      flush(clusterStart, i);
      clusterStart = next; // dropped: contributes nothing
    } else if (
      i > clusterStart &&
      (isClusterExtender(cp) || COMBINING_MARK_RE.test(ch))
    ) {
      // attaches to the cluster being built
    } else {
      flush(clusterStart, i);
      clusterStart = i;
    }
    i = next;
  }
  flush(clusterStart, source.length);

  return { text: out.join(""), origStart, origEnd };
}

/** Normalise a query: same as the layer text, then trimmed. */
function normalizeQuery(query: string, ignoreCase: boolean): string {
  return normalizeWithMap(query, ignoreCase).text.trim();
}

// =============================================================================
// WORD BOUNDARIES
// =============================================================================

/**
 * A word character is any Unicode letter, number or underscore. Combining
 * marks count too, so a boundary is never placed inside an accented letter
 * that has no precomposed form.
 */
const WORD_CHAR_RE = /[\p{L}\p{N}\p{M}_]/u;

/** Character just before `index` (a whole code point), or undefined at the start. */
function codePointBefore(text: string, index: number): string | undefined {
  if (index <= 0) return undefined;
  const low = text.charCodeAt(index - 1);
  if (low >= 0xdc00 && low <= 0xdfff && index >= 2) {
    const high = text.charCodeAt(index - 2);
    if (high >= 0xd800 && high <= 0xdbff) return text.slice(index - 2, index);
  }
  return text[index - 1];
}

/** Character starting at `index` (a whole code point), or undefined at the end. */
function codePointAt(text: string, index: number): string | undefined {
  const cp = text.codePointAt(index);
  return cp === undefined ? undefined : String.fromCodePoint(cp);
}

/**
 * Scripts written without spaces between words: every character is its own
 * potential boundary, so a word-mode query can match inside a run of them
 * ("東京" in "東京都庁"). U+30FC (prolonged sound mark) belongs to katakana
 * words but is script Common.
 */
const NO_SPACE_SCRIPT_RE =
  /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Thai}\p{Script=Lao}\p{Script=Khmer}\p{Script=Myanmar}\u30FC]/u;

/**
 * Start or end of text, any non-word character, or any character of a
 * no-space script is a boundary.
 */
function isWordBoundary(char: string | undefined): boolean {
  if (char === undefined) return true;
  return NO_SPACE_SCRIPT_RE.test(char) || !WORD_CHAR_RE.test(char);
}

/** True for a character of a no-space script (false for undefined). */
function isNoSpaceScript(char: string | undefined): boolean {
  return char !== undefined && NO_SPACE_SCRIPT_RE.test(char);
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
 * Layer text and query are normalised alike (NFKC, whitespace runs, soft
 * hyphen, case) and `startIndex`/`endIndex` refer to the original text.
 * Overlapping occurrences ("aa" in "aaaa") are merged into one match covering
 * all of them, so matches never overlap and none is left uncovered.
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
  return findTextInTextLayerDetailed(searchText, textLayer, options).matches;
}

/**
 * Same search as {@link findTextInTextLayer}, but also reports whether the
 * `maxMatches` cap cut the list short.
 *
 * `truncated` is true only when at least one further reportable match exists
 * beyond the returned ones, so a layer with exactly `maxMatches` matches is not
 * flagged. Callers that must not miss an occurrence (redaction) should use this
 * and raise `maxMatches` or warn when it is true.
 */
export function findTextInTextLayerDetailed(
  searchText: string,
  textLayer: HTMLElement,
  options: FindTextOptions,
): FindTextResult {
  const {
    scale,
    ignoreCase = true,
    maxMatches = 50,
    mergeRects = true,
    matchMode = "substring",
  } = options;

  const empty: FindTextResult = { matches: [], truncated: false };

  // Edge cases
  if (!searchText || !textLayer || scale === 0) {
    return empty;
  }

  // Build character position map
  const { fullText, charPositions } = buildTextLayerMap(textLayer);

  if (fullText.length === 0 || charPositions.length === 0) {
    return empty;
  }

  // Prepare for search: layer text and query are normalised the same way;
  // `norm` maps every normalised unit back to its original character range.
  const normalizedSearch = normalizeQuery(searchText, ignoreCase);
  if (normalizedSearch.length === 0) return empty;
  const norm = normalizeWithMap(fullText, ignoreCase);
  const normalizedFull = norm.text;
  const layerRect = textLayer.getBoundingClientRect();

  const matches: TextMatch[] = [];
  let truncated = false;
  let searchIdx = 0;

  // The last match may have been extended by overlapping candidates; rebuild
  // its text and bounds once, when it is complete.
  let lastExtended = false;
  const finalizeLast = () => {
    const last = matches[matches.length - 1];
    if (!last || !lastExtended) return;
    lastExtended = false;
    const bounds = boundsForMatch(
      charPositions,
      last.startIndex,
      last.endIndex,
      layerRect,
      scale,
      mergeRects,
    );
    last.text = fullText.slice(last.startIndex, last.endIndex);
    if (bounds.length > 0) last.bounds = bounds;
  };

  // Find all substring matches (one past the cap, to learn whether it cut)
  for (;;) {
    const matchStart = normalizedFull.indexOf(normalizedSearch, searchIdx);
    if (matchStart === -1) break;

    const matchEnd = matchStart + normalizedSearch.length;

    // For "word" mode, check word boundaries
    if (matchMode === "word") {
      // A side is a boundary when the neighbour is not a word character, or
      // when the query's own edge character is from a no-space script
      // ("駅" in "Tokyo駅"); "Tower" in "東京Tower" is judged on its neighbour.
      const startsAtBoundary =
        isWordBoundary(codePointBefore(normalizedFull, matchStart)) ||
        isNoSpaceScript(codePointAt(normalizedFull, matchStart));
      const endsAtBoundary =
        isWordBoundary(codePointAt(normalizedFull, matchEnd)) ||
        isNoSpaceScript(codePointBefore(normalizedFull, matchEnd));
      if (!startsAtBoundary || !endsAtBoundary) {
        // Not at word boundaries - skip this match
        searchIdx = matchStart + 1;
        continue;
      }
    }

    // Back to original (concatenated, un-normalised) character positions.
    const origStart = norm.origStart[matchStart]!;
    const origEnd = norm.origEnd[matchEnd - 1]!;

    // Reject matches whose character span is only synthetic separators
    // (shouldn't happen for real queries, but keeps geometry honest).
    const hasRealChars = charPositions
      .slice(origStart, origEnd)
      .some((p) => p && !p.synthetic);
    if (!hasRealChars) {
      searchIdx = matchStart + 1;
      continue;
    }

    // Candidates are always tried one unit further on, so no occurrence is
    // lost. One that overlaps the previous match (same original chars, or
    // "aa" in "aaaa") extends that match instead of being reported twice:
    // matches never overlap, and their union covers every occurrence.
    searchIdx = matchStart + 1;
    const last = matches[matches.length - 1];
    if (last && origStart < last.endIndex) {
      // Only the end moves while merging; text and bounds are rebuilt once
      // per merged match (finalizeLast), so a long run stays linear.
      if (origEnd > last.endIndex) {
        last.endIndex = origEnd;
        lastExtended = true;
      }
      continue;
    }
    finalizeLast();

    const bounds = boundsForMatch(
      charPositions,
      origStart,
      origEnd,
      layerRect,
      scale,
      mergeRects,
    );

    if (bounds.length > 0) {
      if (matches.length >= maxMatches) {
        truncated = true;
        break;
      }
      matches.push({
        text: fullText.slice(origStart, origEnd),
        bounds,
        startIndex: origStart,
        endIndex: origEnd,
      });
    }
  }

  finalizeLast();
  return { matches, truncated };
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

  const normalizedSearch = normalizeQuery(searchText, ignoreCase);
  if (normalizedSearch.length === 0) return false;
  const normalizedFull = normalizeWithMap(fullText, ignoreCase).text;

  return normalizedFull.includes(normalizedSearch);
}

// Exported for unit tests
export const __testOnly = {
  collectMatchSegments,
  mergeAdjacentBounds,
  normalizeWithMap,
  normalizeQuery,
  isWordBoundary,
};
