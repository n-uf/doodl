"use client";

/**
 * Hook for capturing react-pdf's text layer element
 *
 * React-pdf renders a text layer as a child element with class
 * `.react-pdf__Page__textContent`. This hook captures that element
 * for use with PageAnnotationLayer's text-highlight tool.
 */

import { useCallback, useRef, useState } from "react";
import type { UsePdfTextLayerReturn } from "../types";

/** CSS selector for react-pdf text layer */
const TEXT_LAYER_SELECTOR = ".react-pdf__Page__textContent";

/**
 * Hook for capturing react-pdf text layer element
 *
 * Attach `containerRef` to the element containing the PDF page,
 * then use `textLayerElement` with PageAnnotationLayer.
 *
 * @example
 * ```tsx
 * const { containerRef, textLayerElement, refresh } = usePdfTextLayer();
 *
 * // After PDF page renders
 * useEffect(() => {
 *   refresh();
 * }, [pageNumber, refresh]);
 *
 * return (
 *   <div ref={containerRef}>
 *     <Page pageNumber={pageNumber} onRenderSuccess={() => refresh()} />
 *     <PageAnnotationLayer
 *       textLayerElement={textLayerElement}
 *       // ...
 *     />
 *   </div>
 * );
 * ```
 */
export function usePdfTextLayer(): UsePdfTextLayerReturn {
  const containerRef = useRef<HTMLDivElement>(null);
  const [textLayerElement, setTextLayerElement] = useState<HTMLElement | null>(
    null
  );

  const refresh = useCallback(() => {
    // Use requestAnimationFrame to ensure DOM has updated
    requestAnimationFrame(() => {
      const container = containerRef.current;
      if (!container) {
        setTextLayerElement(null);
        return;
      }

      const textLayer = container.querySelector(
        TEXT_LAYER_SELECTOR
      ) as HTMLElement | null;
      setTextLayerElement(textLayer);
    });
  }, []);

  return {
    containerRef,
    textLayerElement,
    refresh,
  };
}

/**
 * Hook variant that auto-refreshes on dependencies change
 *
 * @param deps - Dependencies that trigger refresh (e.g., pageNumber, scale)
 */
export function usePdfTextLayerAuto(
  deps: React.DependencyList
): UsePdfTextLayerReturn {
  const result = usePdfTextLayer();

  // Auto-refresh when deps change
  React.useEffect(() => {
    result.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deps array is intentionally dynamic
  }, deps);

  return result;
}

// Need React import for useEffect in usePdfTextLayerAuto
import React from "react";

