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
 */
function getTextNodesWithDOMInfo(
  textLayer: HTMLElement,
  scale: number,
  offset: { x: number; y: number } = { x: 0, y: 0 }
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
    if (textContent.trim() && node.parentElement) {
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
  const screenBounds: Bounds = {
    x: shapeBounds.x * scale + layerRect.left - offset.x,
    y: shapeBounds.y * scale + layerRect.top - offset.y,
    width: shapeBounds.width * scale,
    height: shapeBounds.height * scale,
  };

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
// CONVENIENCE FUNCTIONS
// =============================================================================

/**
 * Extract text content from a DOM region with character-level precision
 *
 * Uses hybrid approach:
 * 1. Fast element-level shortlist (any intersection)
 * 2. Character-level extraction using Range API on candidates
 *
 * @param textLayer - Text layer DOM element
 * @param bounds - Shape bounds in canvas coordinates
 * @param scale - Canvas scale factor
 * @param offset - Optional offset
 * @returns Concatenated text from characters inside bounds
 */
export function extractTextFromBounds(
  textLayer: HTMLElement,
  bounds: Bounds,
  scale: number,
  offset: { x: number; y: number } = { x: 0, y: 0 }
): string {
  const layerRect = textLayer.getBoundingClientRect();

  // Step 1: Get all text nodes with DOM references
  const nodes = getTextNodesWithDOMInfo(textLayer, scale, offset);

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
