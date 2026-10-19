/**
 * Text Layer Utilities for PDF Annotations
 *
 * Functions for querying react-pdf text layer elements.
 * Supports both single-page and multipage (exploded) modes.
 */

// =============================================================================
// CONSTANTS
// =============================================================================

/** Default CSS selector for react-pdf text layer */
export const PDF_TEXT_LAYER_SELECTOR = ".react-pdf__Page__textContent";

/** CSS selector for react-pdf page container */
const PDF_PAGE_CONTAINER_SELECTOR = ".react-pdf__Page";

/** Data attribute for page number on react-pdf page container */
const PAGE_NUMBER_ATTRIBUTE = "data-page-number";

// =============================================================================
// SINGLE PAGE UTILITIES
// =============================================================================

/**
 * Query a single text layer element from the DOM
 *
 * Returns the first visible text layer matching the selector.
 * Use for single-page mode or when page number doesn't matter.
 *
 * @param selector - CSS selector for text layer (default: react-pdf selector)
 * @returns Text layer element or null if not found/not visible
 */
export function getAnnotationTextLayer(
  selector: string = PDF_TEXT_LAYER_SELECTOR
): HTMLElement | null {
  if (typeof document === "undefined") return null;

  const el = document.querySelector(selector) as HTMLElement | null;
  if (el) {
    const rect = el.getBoundingClientRect();
    // Only return if element has dimensions (is properly rendered)
    if (rect.width > 0 && rect.height > 0) {
      return el;
    }
  }

  return null;
}

// =============================================================================
// MULTIPAGE UTILITIES
// =============================================================================

/**
 * Query all PDF text layers and map them to their page numbers
 *
 * For react-pdf, each page container has a `data-page-number` attribute.
 * This function finds all text layers and maps them to their respective pages.
 *
 * IMPORTANT: When multiple PDFs exist on the page, pass a container element
 * to scope the query. Otherwise, text layers from ALL PDFs will be returned,
 * causing cross-contamination when page numbers overlap.
 *
 * @param selector - CSS selector for text layer elements
 * @param container - Optional container to scope the query (required for multi-PDF pages)
 * @returns Map of page number to text layer element
 *
 * @example
 * ```ts
 * // Scoped to specific PDF container (recommended)
 * const textLayersByPage = getAnnotationTextLayersByPage(undefined, containerRef.current);
 *
 * // Global query (only safe for single-PDF pages)
 * const textLayersByPage = getAnnotationTextLayersByPage();
 * ```
 */
export function getAnnotationTextLayersByPage(
  selector: string = PDF_TEXT_LAYER_SELECTOR,
  container?: HTMLElement | null
): Map<number, HTMLElement> {
  const map = new Map<number, HTMLElement>();

  if (typeof document === "undefined") return map;

  // Query text layers - scoped to container if provided
  const queryRoot = container ?? document;
  const textLayers = queryRoot.querySelectorAll(selector);

  for (const layer of textLayers) {
    if (!(layer instanceof HTMLElement)) continue;

    // Check if element has dimensions (is properly rendered)
    const rect = layer.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;

    // Find parent .react-pdf__Page to get page number
    const pageContainer = layer.closest(PDF_PAGE_CONTAINER_SELECTOR);
    const pageNumAttr = pageContainer?.getAttribute(PAGE_NUMBER_ATTRIBUTE);

    if (pageNumAttr) {
      const pageNum = parseInt(pageNumAttr, 10);
      if (!isNaN(pageNum)) {
        map.set(pageNum, layer);
      }
    } else {
      // Fallback: if no page container found, assume single page (page 1)
      // This handles non-react-pdf text layers (e.g., text mode)
      map.set(1, layer);
      break; // Only use first valid layer for single-page mode
    }
  }

  return map;
}

/**
 * Get the text layer for a specific page number
 *
 * Convenience function that queries all text layers and returns
 * the one for the specified page.
 *
 * @param pageNumber - Page number (1-indexed)
 * @param selector - CSS selector for text layer elements
 * @returns Text layer element for the page, or null if not found
 */
export function getAnnotationTextLayerForPage(
  pageNumber: number,
  selector: string = PDF_TEXT_LAYER_SELECTOR
): HTMLElement | null {
  const textLayersByPage = getAnnotationTextLayersByPage(selector);
  return textLayersByPage.get(pageNumber) ?? null;
}










