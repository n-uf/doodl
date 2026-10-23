/**
 * Selection Container Utilities
 *
 * Utilities for checking if a browser Selection is within a container element.
 * Handles edge cases with backwards selections, transformed elements, and
 * PDF text layers with positioned spans.
 */

// =============================================================================
// SELECTION VALIDATION
// =============================================================================

/**
 * Check if a Selection is within a container element
 *
 * Handles multiple edge cases:
 * - Normal selections (commonAncestorContainer check)
 * - Backwards selections (anchor/focus node check)
 * - Transformed PDF spans (range intersection check)
 *
 * @param selection - The browser Selection to check
 * @param container - The container element that should contain the selection
 * @returns true if selection is within the container
 *
 * @example
 * ```ts
 * const selection = window.getSelection();
 * if (selection && isSelectionWithinContainer(selection, textLayer)) {
 *   // Process selection...
 * }
 * ```
 */
export function isSelectionWithinContainer(
  selection: Selection,
  container: HTMLElement
): boolean {
  if (selection.rangeCount === 0) return false;

  const range = selection.getRangeAt(0);

  // Check commonAncestorContainer first (fastest path)
  if (container.contains(range.commonAncestorContainer)) {
    return true;
  }

  // Fallback: Check if EITHER anchor or focus node is in container
  // This handles backwards selections that start/end on <br> or empty elements
  const { anchorNode, focusNode } = selection;

  if (anchorNode && container.contains(anchorNode)) {
    return true;
  }

  if (focusNode && container.contains(focusNode)) {
    return true;
  }

  // Last resort: Check if range intersects any child of the container
  // This catches edge cases with transformed text spans in PDFs
  try {
    const containerRange = document.createRange();
    containerRange.selectNodeContents(container);
    const intersects = !(
      range.compareBoundaryPoints(Range.END_TO_START, containerRange) > 0 ||
      range.compareBoundaryPoints(Range.START_TO_END, containerRange) < 0
    );
    return intersects;
  } catch {
    return false;
  }
}

// =============================================================================
// RECT EXTRACTION
// =============================================================================

/**
 * Options for extracting selection rects
 */
export interface SelectionRectsOptions {
  /** Reference element for coordinate conversion (default: uses container) */
  refElement?: HTMLElement;
  /** Scale factor for coordinate conversion (default: 1) */
  scale?: number;
}

/**
 * Get client rects from a Selection's range
 *
 * Filters out invalid rects (zero-size, outside container bounds).
 *
 * @param selection - The browser Selection
 * @param container - The container element for bounds checking
 * @returns Array of valid DOMRects in viewport coordinates
 */
export function getSelectionClientRects(
  selection: Selection,
  container: HTMLElement
): DOMRect[] {
  if (selection.rangeCount === 0) return [];

  const range = selection.getRangeAt(0);
  const clientRects = range.getClientRects();
  const containerRect = container.getBoundingClientRect();

  const validRects: DOMRect[] = [];

  for (let i = 0; i < clientRects.length; i++) {
    const rect = clientRects[i]!;

    // Filter out zero-width or zero-height rects
    if (rect.width < 1 || rect.height < 1) {
      continue;
    }

    // Filter out rects outside the container
    if (
      rect.right < containerRect.left ||
      rect.left > containerRect.right ||
      rect.bottom < containerRect.top ||
      rect.top > containerRect.bottom
    ) {
      continue;
    }

    validRects.push(rect);
  }

  return validRects;
}


/**
 * Get the line rects of the text nodes a range covers
 *
 * Unlike `range.getClientRects()`, this never returns the border boxes of
 * elements the range fully contains (a fully selected `<p>` or `<li>`
 * contributes its text lines, not its block box). Collapsed whitespace has
 * no layout and yields no (or zero-size) rects.
 *
 * @param range - The selection range
 * @returns DOMRects in viewport coordinates, in document order
 */
export function getRangeTextRects(range: Range): DOMRect[] {
  const root = range.commonAncestorContainer;
  const doc = root.ownerDocument ?? document;
  const rects: DOMRect[] = [];

  const collect = (node: Text): void => {
    const start = node === range.startContainer ? range.startOffset : 0;
    const end = node === range.endContainer ? range.endOffset : node.length;
    if (end <= start) return;

    const textRange = doc.createRange();
    textRange.setStart(node, start);
    textRange.setEnd(node, end);
    const nodeRects = textRange.getClientRects();
    for (let i = 0; i < nodeRects.length; i++) {
      rects.push(nodeRects[i]!);
    }
  };

  if (root.nodeType === Node.TEXT_NODE) {
    collect(root as Text);
    return rects;
  }

  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (range.intersectsNode(node)) collect(node as Text);
  }

  return rects;
}

// =============================================================================
// TEXT LAYER DETECTION
// =============================================================================

/**
 * Check if a container is a PDF.js-style text layer: text drawn as
 * absolutely positioned spans over a rendered page, where the browser's
 * selection produces phantom rects that need span validation.
 *
 * Ordinary HTML text (text nodes in `<p>`, `<li>`, inline spans in normal
 * flow) is not.
 */
export function isPositionedTextLayer(container: HTMLElement): boolean {
  const { classList } = container;
  if (
    classList.contains("textLayer") ||
    classList.contains("react-pdf__Page__textContent")
  ) {
    return true;
  }

  const view = container.ownerDocument.defaultView;
  if (!view) return false;

  for (const span of container.querySelectorAll("span")) {
    if (!span.textContent?.trim()) continue;
    // The first text-bearing span decides
    return view.getComputedStyle(span).position === "absolute";
  }

  return false;
}
