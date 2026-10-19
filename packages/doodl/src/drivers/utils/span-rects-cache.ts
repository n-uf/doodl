/**
 * Span Rects Cache
 *
 * Caches DOMRect objects for text spans in a container element.
 * Used for validating selection rects against actual text positions.
 *
 * PDF text layers render text as positioned span elements. By caching
 * their rects, we can efficiently validate which selection rects
 * correspond to actual text vs phantom blank-zone rects.
 */

// =============================================================================
// TYPES
// =============================================================================

export interface SpanRectsCache {
  /** Get cached span rects (lazy initialization) */
  getRects(): DOMRect[];
  /** Clear the cache (call when container content changes) */
  clear(): void;
  /** Check if cache has rects */
  hasRects(): boolean;
}

// =============================================================================
// IMPLEMENTATION
// =============================================================================

/**
 * Create a span rects cache for a text container
 *
 * @param container - The text layer element containing spans
 * @returns Cache interface for getting span DOMRects
 *
 * @example
 * ```ts
 * const cache = createSpanRectsCache(textLayer);
 *
 * // On mousedown, clear cache for fresh rects
 * cache.clear();
 *
 * // During selection, get cached rects
 * const spanRects = cache.getRects();
 *
 * // Validate selection rects against span rects
 * for (const rect of selectionRects) {
 *   const overlapsText = spanRects.some(span => rectsOverlap(rect, span));
 * }
 * ```
 */
export function createSpanRectsCache(container: HTMLElement): SpanRectsCache {
  let cachedRects: DOMRect[] | null = null;

  return {
    getRects(): DOMRect[] {
      if (cachedRects !== null) {
        return cachedRects;
      }

      const rects: DOMRect[] = [];
      const spans = container.querySelectorAll("span");

      for (const span of spans) {
        // Skip empty or whitespace-only spans
        const text = span.textContent;
        if (!text || text.trim().length === 0) {
          continue;
        }

        const rect = span.getBoundingClientRect();
        // Skip zero-dimension spans
        if (rect.width > 0 && rect.height > 0) {
          rects.push(rect);
        }
      }

      cachedRects = rects;
      return rects;
    },

    clear(): void {
      cachedRects = null;
    },

    hasRects(): boolean {
      if (cachedRects === null) {
        // Peek without caching - check if there are any spans
        const spans = container.querySelectorAll("span");
        return spans.length > 0;
      }
      return cachedRects.length > 0;
    },
  };
}

/**
 * Get span rects from a container (non-cached, one-shot)
 *
 * Use this when you don't need caching behavior.
 *
 * @param container - The text layer element containing spans
 * @returns Array of DOMRects for text spans
 */
export function getSpanRects(container: HTMLElement): DOMRect[] {
  const rects: DOMRect[] = [];
  const spans = container.querySelectorAll("span");

  for (const span of spans) {
    const text = span.textContent;
    if (!text || text.trim().length === 0) {
      continue;
    }

    const rect = span.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      rects.push(rect);
    }
  }

  return rects;
}
