/**
 * Text intersection utilities
 *
 * Utilities for finding text content that intersects with shape bounds.
 * Used by geometric shapes to extract text from underlying DOM text layers.
 */

import type { Bounds } from "../../../types/geometry";

// =============================================================================
// TYPES
// =============================================================================

/**
 * Text node with its bounding information
 */
export interface TextNodeInfo {
  /** Text content */
  text: string;
  /** Bounds in canvas coordinates */
  bounds: Bounds;
  /** Original DOM element */
  element: Element;
}

/**
 * Intersection mode
 */
export type IntersectionMode =
  | "intersect" // Any overlap
  | "contain"; // Text must be fully contained in bounds

// =============================================================================
// BOUNDS GEOMETRY HELPERS
// =============================================================================

/**
 * Check if two bounds intersect (any overlap)
 */
export function boundsIntersect(a: Bounds, b: Bounds): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

/**
 * Check if inner bounds are fully contained within outer bounds
 */
export function boundsContain(outer: Bounds, inner: Bounds): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height
  );
}

/**
 * Calculate intersection area between two bounds
 */
export function getIntersectionArea(a: Bounds, b: Bounds): number {
  const xOverlap = Math.max(
    0,
    Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)
  );
  const yOverlap = Math.max(
    0,
    Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y)
  );
  return xOverlap * yOverlap;
}

// =============================================================================
// DOM TEXT NODE EXTRACTION
// =============================================================================

/**
 * Get all text nodes with their bounds from a text layer element
 *
 * Walks the DOM tree and extracts text-containing elements with their
 * bounding rectangles converted to canvas coordinates.
 *
 * @param textLayer - The text layer DOM element
 * @param scale - Canvas scale factor
 * @param offset - Optional offset for canvas position
 */
export function getTextNodes(
  textLayer: HTMLElement,
  scale: number,
  offset: { x: number; y: number } = { x: 0, y: 0 }
): TextNodeInfo[] {
  const result: TextNodeInfo[] = [];
  const layerRect = textLayer.getBoundingClientRect();

  // Find all elements that contain text
  const walker = document.createTreeWalker(
    textLayer,
    NodeFilter.SHOW_TEXT,
    null
  );

  let node: Node | null = walker.nextNode();
  while (node) {
    const textContent = node.textContent?.trim();
    if (textContent && node.parentElement) {
      const range = document.createRange();
      range.selectNodeContents(node);
      const rects = range.getClientRects();

      for (const rect of rects) {
        if (rect.width > 0 && rect.height > 0) {
          // Convert to canvas coordinates
          const bounds: Bounds = {
            x: (rect.left - layerRect.left + offset.x) / scale,
            y: (rect.top - layerRect.top + offset.y) / scale,
            width: rect.width / scale,
            height: rect.height / scale,
          };

          result.push({
            text: textContent,
            bounds,
            element: node.parentElement,
          });
        }
      }
    }
    node = walker.nextNode();
  }

  return result;
}

/**
 * Get text from span elements (common in PDF text layers)
 *
 * Many PDF viewers render text as individual span elements.
 * This function extracts text from span-based text layers.
 */
export function getTextFromSpans(
  textLayer: HTMLElement,
  scale: number,
  offset: { x: number; y: number } = { x: 0, y: 0 }
): TextNodeInfo[] {
  const result: TextNodeInfo[] = [];
  const layerRect = textLayer.getBoundingClientRect();

  // Query all span elements (common in PDF.js text layers)
  const spans = textLayer.querySelectorAll("span");

  for (const span of spans) {
    const text = span.textContent?.trim();
    if (!text) continue;

    const rect = span.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;

    const bounds: Bounds = {
      x: (rect.left - layerRect.left + offset.x) / scale,
      y: (rect.top - layerRect.top + offset.y) / scale,
      width: rect.width / scale,
      height: rect.height / scale,
    };

    result.push({
      text,
      bounds,
      element: span,
    });
  }

  return result;
}

// =============================================================================
// TEXT INTERSECTION QUERIES
// =============================================================================

/**
 * Find text nodes that intersect with given bounds
 *
 * @param nodes - Text nodes to search
 * @param bounds - Shape bounds to check against
 * @param mode - Intersection mode ("intersect" or "contain")
 */
export function findIntersectingText(
  nodes: TextNodeInfo[],
  bounds: Bounds,
  mode: IntersectionMode = "intersect"
): TextNodeInfo[] {
  return nodes.filter((node) => {
    if (mode === "contain") {
      return boundsContain(bounds, node.bounds);
    }
    return boundsIntersect(bounds, node.bounds);
  });
}

/**
 * Calculate what percentage of text bounds is inside shape bounds
 */
function getOverlapRatio(shapeBounds: Bounds, textBounds: Bounds): number {
  const intersection = getIntersectionArea(shapeBounds, textBounds);
  const textArea = textBounds.width * textBounds.height;
  return textArea > 0 ? intersection / textArea : 0;
}

/**
 * Find text nodes sorted by reading order (top-to-bottom, left-to-right)
 *
 * Sorts by Y position first (grouping into rows), then by X position.
 * This ensures extracted text follows natural reading order.
 *
 * Only includes text nodes where >50% of the text is inside the shape bounds.
 * This prevents including text that barely overlaps with the shape edge.
 */
export function findIntersectingTextSorted(
  nodes: TextNodeInfo[],
  bounds: Bounds,
  minOverlapRatio: number = 0.5
): TextNodeInfo[] {
  const ROW_TOLERANCE = 5; // Pixels tolerance for same-row grouping

  return nodes
    .filter((node) => {
      // Require significant overlap - at least minOverlapRatio of text must be inside shape
      const ratio = getOverlapRatio(bounds, node.bounds);
      return ratio >= minOverlapRatio;
    })
    .sort((a, b) => {
      // Group by Y position (same row if within tolerance)
      const aY = a.bounds.y + a.bounds.height / 2; // Center Y
      const bY = b.bounds.y + b.bounds.height / 2;

      // If on same row (within tolerance), sort by X
      if (Math.abs(aY - bY) < ROW_TOLERANCE) {
        return a.bounds.x - b.bounds.x; // Left to right
      }

      // Otherwise sort by Y (top to bottom)
      return aY - bY;
    });
}

// =============================================================================
// CHARACTER-LEVEL EXTRACTION (Range API)
// =============================================================================

/**
 * Extract info needed for character-level extraction
 */
interface TextNodeWithDOMInfo {
  /** Text content */
  text: string;
  /** Bounds in canvas coordinates */
  bounds: Bounds;
  /** The actual DOM Text node (not the parent element) */
  textNode: Text;
  /** Parent element for reference */
  element: Element;
}

/**
 * Get text nodes with DOM Text node references for character-level extraction
 *
 * @param keepBlank - Also return whitespace-only nodes (PDF.js emits a span
 *   holding a single space between runs); word snapping needs them as separators
 */
function getTextNodesWithDOMInfo(
  textLayer: HTMLElement,
  scale: number,
  offset: { x: number; y: number } = { x: 0, y: 0 },
  keepBlank = false
): TextNodeWithDOMInfo[] {
  const result: TextNodeWithDOMInfo[] = [];
  const layerRect = textLayer.getBoundingClientRect();

  const walker = document.createTreeWalker(
    textLayer,
    NodeFilter.SHOW_TEXT,
    null
  );

  let node: Text | null = walker.nextNode() as Text | null;
  while (node) {
    const textContent = node.textContent ?? "";
    if (
      (keepBlank ? textContent.length > 0 : textContent.trim()) &&
      node.parentElement
    ) {
      const range = document.createRange();
      range.selectNodeContents(node);
      const rect = range.getBoundingClientRect();

      if (rect.width > 0 && rect.height > 0) {
        const bounds: Bounds = {
          x: (rect.left - layerRect.left + offset.x) / scale,
          y: (rect.top - layerRect.top + offset.y) / scale,
          width: rect.width / scale,
          height: rect.height / scale,
        };

        result.push({
          text: textContent,
          bounds,
          textNode: node,
          element: node.parentElement,
        });
      }
    }
    node = walker.nextNode() as Text | null;
  }

  return result;
}

/**
 * Convert shape bounds (canvas coordinates) to screen coordinates, the space
 * Range.getBoundingClientRect() reports in.
 */
function toScreenBounds(
  shapeBounds: Bounds,
  layerRect: DOMRect,
  scale: number,
  offset: { x: number; y: number }
): Bounds {
  return {
    x: shapeBounds.x * scale + layerRect.left - offset.x,
    y: shapeBounds.y * scale + layerRect.top - offset.y,
    width: shapeBounds.width * scale,
    height: shapeBounds.height * scale,
  };
}

/**
 * Extract characters from a text node that fall within shape bounds
 * Uses Range API for accurate character positioning
 *
 * @param textNode - The DOM Text node
 * @param shapeBounds - Shape bounds in screen coordinates
 * @param layerRect - Text layer's bounding rect for coordinate conversion
 * @param scale - Scale factor
 * @param offset - Optional offset
 * @returns Characters that fall within bounds
 */
function extractCharsInBounds(
  textNode: Text,
  shapeBounds: Bounds,
  layerRect: DOMRect,
  scale: number,
  offset: { x: number; y: number } = { x: 0, y: 0 }
): string {
  const text = textNode.textContent ?? "";
  if (!text) return "";

  // Convert shape bounds to screen coordinates for comparison
  const screenBounds = toScreenBounds(shapeBounds, layerRect, scale, offset);

  let result = "";

  for (let i = 0; i < text.length; i++) {
    try {
      const range = document.createRange();
      range.setStart(textNode, i);
      range.setEnd(textNode, i + 1);
      const charRect = range.getBoundingClientRect();

      // Check if character center is within shape bounds
      const charCenterX = charRect.left + charRect.width / 2;
      const charCenterY = charRect.top + charRect.height / 2;

      const isInside =
        charCenterX >= screenBounds.x &&
        charCenterX <= screenBounds.x + screenBounds.width &&
        charCenterY >= screenBounds.y &&
        charCenterY <= screenBounds.y + screenBounds.height;

      if (isInside) {
        result += text[i];
      }
    } catch {
      // Range API can throw for certain edge cases, skip character
      continue;
    }
  }

  return result;
}

// =============================================================================
// WORD SNAPPING
// =============================================================================

/**
 * One character of the text layer with its measured box.
 *
 * `rect` is in the same coordinate space as the area handed to `snapToWords`.
 * `node` identifies the text node (span) the character came from; two characters
 * with the same `node` belong to the same run of text.
 */
interface MeasuredChar {
  char: string;
  rect: Bounds;
  node: unknown;
}

/**
 * A gap between two characters of different spans no wider than this many
 * character heights is not visible, so the spans hold one word. A space glyph is
 * about 0.22 character heights wide.
 */
const WORD_JOIN_GAP_RATIO = 0.1;

/**
 * Two spans that overlap by more than this many character heights are not one
 * word (a stretched span running over its neighbour); rounding overlaps are
 * about a pixel.
 */
const WORD_JOIN_OVERLAP_RATIO = 0.2;

/** Share of a line's height a mark must cover to count as a mark on that line (rule 3). */
const LINE_TOUCH_RATIO = 0.5;

/** Share of a word's width that must lie inside the mark for the word to be taken. */
const WORD_TAKE_RATIO = 0.5;

/** Edge characters dropped from the extracted text: spaces, `: ; , . ! ?`, dashes, bullets. */
const EDGE_TRIM = /^[\s:;,.!?\-‐-―−•‣◦⁃∙·●○▪■]+|[\s:;,.!?\-‐-―−•‣◦⁃∙·●○▪■]+$/g;

interface TextWord {
  text: string;
  left: number;
  right: number;
  /** Mean vertical centre of the word's characters. */
  centerY: number;
  chars: MeasuredChar[];
}

function charCenterY(c: MeasuredChar): number {
  return c.rect.y + c.rect.height / 2;
}

/**
 * Group measured characters into visual lines: characters whose boxes share at
 * least half of the smaller height with the line's first character. Lines come
 * back top to bottom, each ordered by `orderLine`.
 */
function groupIntoLines(chars: MeasuredChar[]): MeasuredChar[][] {
  const lines: { top: number; bottom: number; chars: MeasuredChar[] }[] = [];

  for (const c of chars) {
    const top = c.rect.y;
    const bottom = c.rect.y + c.rect.height;
    const line = lines.find((l) => {
      const overlap = Math.min(bottom, l.bottom) - Math.max(top, l.top);
      const smaller = Math.min(bottom - top, l.bottom - l.top);
      return overlap > 0 && overlap >= smaller * 0.5;
    });
    if (line) {
      line.chars.push(c);
    } else {
      lines.push({ top, bottom, chars: [c] });
    }
  }

  lines.sort((a, b) => a.top + a.bottom - (b.top + b.bottom));
  return lines.map((l) => orderLine(l.chars));
}

/**
 * Put the characters of one line left to right without interleaving spans.
 *
 * A span's characters keep their text order; the spans (one text node on this
 * line) are ordered by where they start. Sorting single characters would mix the
 * tails of neighbouring spans whose boxes overlap, which PDF.js text layers do
 * when a fallback font is wider than the PDF's font.
 */
function orderLine(chars: MeasuredChar[]): MeasuredChar[] {
  const segments = new Map<unknown, MeasuredChar[]>();
  for (const c of chars) {
    const segment = segments.get(c.node);
    if (segment) segment.push(c);
    else segments.set(c.node, [c]);
  }
  const left = (segment: MeasuredChar[]): number =>
    Math.min(...segment.map((c) => c.rect.x));
  return [...segments.values()]
    .sort((a, b) => left(a) - left(b))
    .flat();
}

/**
 * Split one line (left to right) into words: runs of non-space characters. A run
 * continues across two spans when there is no whitespace and no visible gap
 * between them.
 */
function splitLineIntoWords(line: MeasuredChar[]): TextWord[] {
  const words: TextWord[] = [];
  let current: MeasuredChar[] = [];

  const flush = (): void => {
    if (current.length === 0) return;
    words.push({
      text: current.map((c) => c.char).join(""),
      left: Math.min(...current.map((c) => c.rect.x)),
      right: Math.max(...current.map((c) => c.rect.x + c.rect.width)),
      centerY: current.reduce((sum, c) => sum + charCenterY(c), 0) / current.length,
      chars: current,
    });
    current = [];
  };

  for (const c of line) {
    if (/\s/.test(c.char)) {
      flush();
      continue;
    }
    const prev = current[current.length - 1];
    if (prev && prev.node !== c.node) {
      const gap = c.rect.x - (prev.rect.x + prev.rect.width);
      const height = Math.min(prev.rect.height, c.rect.height);
      // Neither a visible gap nor a deep overlap (two unrelated spans on top of each other).
      if (
        gap > height * WORD_JOIN_GAP_RATIO ||
        gap < -height * WORD_JOIN_OVERLAP_RATIO
      ) {
        flush();
      }
    }
    current.push(c);
  }
  flush();

  return words;
}

/** True when the two boxes share some area (touching edges do not count). */
function boxesOverlap(a: Bounds, b: Bounds): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

/** Drop edge spaces and edge punctuation (`: ; , . ! ?`, dashes, bullets). */
function trimEdges(text: string): string {
  return text.replace(EDGE_TRIM, "");
}

/**
 * Text under an area mark, snapped to whole words.
 *
 * 1. Words are runs of non-space characters on one line, joined across spans
 *    when there is no whitespace and no visible gap between them.
 * 2. A word is taken whole when at least half of its width is inside `area`
 *    (and its vertical centre is), otherwise it is left out.
 * 3. When `area` touches characters but no word passes rule 2, the words it
 *    touches are taken on the one line it overlaps vertically the most (ties:
 *    the line closer to its vertical centre), never from a neighbouring line.
 *    That line counts only if the mark covers at least half of its height or
 *    its vertical centre lies on it, so a graze returns nothing. A small mark
 *    inside one word still returns that word.
 * 4. The result reads top to bottom, left to right, with edge spaces and edge
 *    punctuation (`: ; , . ! ?`, dashes, bullets) trimmed. Brackets, quotes,
 *    currency signs and inner punctuation stay.
 *
 * Pure: takes measured characters and the area in the same coordinate space.
 */
function snapToWords(chars: MeasuredChar[], area: Bounds): string {
  const usable = chars.filter((c) => c.rect.width > 0 || c.rect.height > 0);
  const lines = groupIntoLines(usable);
  const lineWords = lines.map(splitLineIntoWords);
  const words = lineWords.flat();

  const areaRight = area.x + area.width;
  const areaBottom = area.y + area.height;

  const taken = words.filter((w) => {
    // A punctuation-only word (a dash, a bullet) says nothing and must not block rule 3.
    if (trimEdges(w.text) === "") return false;
    if (w.centerY < area.y || w.centerY > areaBottom) return false;
    const width = w.right - w.left;
    if (width <= 0) return w.left >= area.x && w.left <= areaRight;
    const inside = Math.min(w.right, areaRight) - Math.max(w.left, area.x);
    return inside / width >= WORD_TAKE_RATIO - 1e-9;
  });

  const chosen = taken.length > 0 ? taken : touchedWordsOnBestLine(lineWords, area);

  return trimEdges(chosen.map((w) => w.text).join(" "));
}

/**
 * Rule 3: the words `area` touches, on the single line that overlaps `area`
 * vertically the most (ties: the line whose centre is closer to the centre of
 * `area`). Never words from a neighbouring line.
 */
function touchedWordsOnBestLine(
  lineWords: TextWord[][],
  area: Bounds
): TextWord[] {
  const areaBottom = area.y + area.height;
  const areaCenter = area.y + area.height / 2;
  let best: { words: TextWord[]; overlap: number; distance: number } | null =
    null;

  for (const words of lineWords) {
    const touched = words.filter((w) =>
      w.chars.some((c) => boxesOverlap(c.rect, area))
    );
    if (touched.length === 0) continue;

    const rects = words.flatMap((w) => w.chars.map((c) => c.rect));
    const top = Math.min(...rects.map((r) => r.y));
    const bottom = Math.max(...rects.map((r) => r.y + r.height));
    const overlap = Math.min(bottom, areaBottom) - Math.max(top, area.y);
    // A graze (a big mark around a signature below the line) is not a mark on the
    // line: it must cover half the line's height, or have its centre on the line.
    const centerOnLine = areaCenter >= top && areaCenter <= bottom;
    if (overlap < (bottom - top) * LINE_TOUCH_RATIO - 1e-9 && !centerOnLine) {
      continue;
    }
    const distance = Math.abs((top + bottom) / 2 - areaCenter);

    if (
      !best ||
      overlap > best.overlap + 1e-9 ||
      (Math.abs(overlap - best.overlap) <= 1e-9 && distance < best.distance)
    ) {
      best = { words: touched, overlap, distance };
    }
  }

  return best ? best.words : [];
}

/**
 * Text nodes that can hold a word touched by `area`: the nodes intersecting it,
 * plus, repeatedly, nodes on the same line that start where a chosen one ends
 * without a visible gap (PDF.js splits one word over several spans). Returns
 * indexes into `nodes`.
 */
function selectWordCandidates(
  nodes: { bounds: Bounds }[],
  area: Bounds
): number[] {
  const chosen = new Set<number>();
  nodes.forEach((n, i) => {
    if (boundsIntersect(area, n.bounds)) chosen.add(i);
  });

  const queue = [...chosen];
  for (let next = queue.pop(); next !== undefined; next = queue.pop()) {
    const a = nodes[next]?.bounds;
    if (!a) continue;
    nodes.forEach((n, i) => {
      if (chosen.has(i)) return;
      const b = n.bounds;
      const overlap =
        Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
      if (overlap < Math.min(a.height, b.height) * 0.5) return;
      const tolerance = Math.min(a.height, b.height) * WORD_JOIN_GAP_RATIO;
      const gap = Math.max(a.x - (b.x + b.width), b.x - (a.x + a.width));
      if (gap <= tolerance) {
        chosen.add(i);
        queue.push(i);
      }
    });
  }

  return [...chosen].sort((x, y) => x - y);
}

/**
 * Measure every character of the given text nodes with the Range API, in screen
 * coordinates.
 */
function measureChars(textNodes: Text[]): MeasuredChar[] {
  const result: MeasuredChar[] = [];
  const range = document.createRange();

  for (const textNode of textNodes) {
    const text = textNode.textContent ?? "";
    for (let i = 0; i < text.length; i++) {
      try {
        range.setStart(textNode, i);
        range.setEnd(textNode, i + 1);
        const r = range.getBoundingClientRect();
        result.push({
          char: text.charAt(i),
          rect: { x: r.left, y: r.top, width: r.width, height: r.height },
          node: textNode,
        });
      } catch {
        // Range API can throw for certain edge cases, skip character
        continue;
      }
    }
  }

  return result;
}

// =============================================================================
// CONVENIENCE FUNCTIONS
// =============================================================================

/**
 * How extracted text is cut at the edge of the bounds.
 *
 * - `"char"` (default): each character whose centre is inside the bounds, exactly
 *   what a text highlight or a region needs.
 * - `"word"`: whole words, for area marks (rect, ellipse, polygon, freehand); see
 *   `snapToWords` for the rule.
 */
export type TextSnapMode = "char" | "word";

/** Options of `extractTextFromBounds`. */
export interface ExtractTextOptions {
  /** How the text is cut at the edge of the bounds. Default `"char"`. */
  snap?: TextSnapMode;
}

/**
 * Extract text content from a DOM region
 *
 * Character-level precision by default (`options.snap` `"char"`); `"word"`
 * snaps the result to whole words (area marks).
 *
 * Uses hybrid approach:
 * 1. Fast element-level shortlist (any intersection)
 * 2. Character-level extraction using Range API on candidates
 *
 * @param textLayer - Text layer DOM element
 * @param bounds - Shape bounds in canvas coordinates
 * @param scale - Canvas scale factor
 * @param offset - Optional offset
 * @param options - Optional: `snap` selects character or word precision
 * @returns Concatenated text from characters inside bounds
 */
export function extractTextFromBounds(
  textLayer: HTMLElement,
  bounds: Bounds,
  scale: number,
  offset: { x: number; y: number } = { x: 0, y: 0 },
  options: ExtractTextOptions = {}
): string {
  const layerRect = textLayer.getBoundingClientRect();

  // Step 1: Get all text nodes with DOM references
  const nodes = getTextNodesWithDOMInfo(
    textLayer,
    scale,
    offset,
    options.snap === "word"
  );

  if (options.snap === "word") {
    const picked = selectWordCandidates(nodes, bounds).flatMap((i) => {
      const node = nodes[i];
      return node ? [node] : [];
    });
    if (picked.length === 0) {
      return "";
    }
    return snapToWords(
      measureChars(picked.map((node) => node.textNode)),
      toScreenBounds(bounds, layerRect, scale, offset)
    );
  }

  // Step 2: Fast shortlist - filter to nodes that have ANY intersection
  const candidates = nodes.filter((node) =>
    boundsIntersect(bounds, node.bounds)
  );

  if (candidates.length === 0) {
    return "";
  }

  // Step 3: Sort candidates by reading order (top-to-bottom, left-to-right)
  const ROW_TOLERANCE = 5;
  candidates.sort((a, b) => {
    const aY = a.bounds.y + a.bounds.height / 2;
    const bY = b.bounds.y + b.bounds.height / 2;

    if (Math.abs(aY - bY) < ROW_TOLERANCE) {
      return a.bounds.x - b.bounds.x;
    }
    return aY - bY;
  });

  // Step 4: Character-level extraction on candidates using Range API
  const extractedParts: string[] = [];

  for (const candidate of candidates) {
    const chars = extractCharsInBounds(
      candidate.textNode,
      bounds,
      layerRect,
      scale,
      offset
    );

    if (chars.trim()) {
      extractedParts.push(chars.trim());
    }
  }

  // Join with spaces, collapse multiple spaces
  return extractedParts.join(" ").replace(/\s+/g, " ").trim();
}

/**
 * Check if any text intersects with bounds
 *
 * Quick check without extracting all text content.
 */
export function hasTextInBounds(
  textLayer: HTMLElement,
  bounds: Bounds,
  scale: number,
  offset: { x: number; y: number } = { x: 0, y: 0 }
): boolean {
  const nodes = getTextFromSpans(textLayer, scale, offset);
  return nodes.some((node) => boundsIntersect(bounds, node.bounds));
}

// Exported for unit tests
export const __testOnly = {
  snapToWords,
  selectWordCandidates,
};
