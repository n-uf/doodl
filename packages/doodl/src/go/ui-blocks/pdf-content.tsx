"use client";

/**
 * PDF Content - Multi-page PDF rendering with annotation layer for DoodleGo
 *
 * Features:
 * - Per-page annotation storage
 * - Page navigation (prev/next, page selector)
 * - Keyboard shortcuts for navigation
 * - Scale-aware coordinate transformation
 * - Exploded mode: scroll through all pages
 *
 * Uses the react-pdf part (@n-uf/doodl/react-pdf) for core annotation functionality,
 * adding themed UI styling for DoodleGo.
 */

import type { DrawShape, DrawTool, ShapeStyle } from "../../../index";
import {
  type PageAnnotations,
  type PdfAnnotationPageProps,
  type PdfSource,
  usePdfAnnotations as usePdfAnnotationsCore,
} from "../../react-pdf";
import type { PageAnnotationController } from "../../react";
import React, {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ThemeTokens } from "../tokens/themes";

// Re-export types from doodl-pdf-react
export type { PageAnnotations, PdfSource };

// Dynamically import Document and PdfAnnotationPage from doodl-pdf-react
// IMPORTANT: Both must come from the same module to share React context
const ReactPdfDocument = lazy(() =>
  import("../../react-pdf/components").then((mod) => ({
    default: mod.PdfDocument,
  })),
);

const PdfAnnotationPage = lazy(() =>
  import("../../react-pdf/components").then((mod) => ({
    default: mod.PdfAnnotationPage,
  })),
) as React.LazyExoticComponent<React.ComponentType<PdfAnnotationPageProps>>;

// Configure PDF.js worker from the version-pinned CDN (client-side only).
// Shared helper from doodl-pdf-react — avoids bundler issues + version drift.
if (typeof window !== "undefined") {
  import("../../react-pdf/components").then((mod) => {
    mod.configureDefaultPdfWorker();
  });
}

/** View mode for PDF display */
export type PdfViewMode = "single" | "exploded";

export interface PdfContentProps {
  /** PDF source - URL string or File object */
  pdfSource: PdfSource;
  /** Current drawing tool */
  tool: DrawTool;
  /** Current style */
  style: ShapeStyle;
  /** Current scale (controlled by parent) */
  scale: number;
  /** Theme tokens */
  tokens: ThemeTokens;
  /** Dark mode flag */
  isDark: boolean;
  /** View mode: "single" (one page) or "exploded" (all pages scrollable) */
  viewMode?: PdfViewMode;
  /** Current page number (1-indexed, controlled by parent) - used in single mode */
  currentPage?: number;
  /** Callback when page changes */
  onPageChange?: (page: number) => void;
  /** Per-page annotations (controlled by parent) */
  annotations?: PageAnnotations;
  /** Callback when annotations change for a page */
  onAnnotationsChange?: (page: number, shapes: DrawShape[]) => void;
  /** Legacy: Shapes change callback (all shapes flat) */
  onShapesChange?: (shapes: DrawShape[]) => void;
  /** History change callback */
  onHistoryChange?: (state: { canUndo: boolean; canRedo: boolean }) => void;
  /** Controller ref for external access (single mode only) */
  controllerRef?: React.MutableRefObject<PageAnnotationController | null>;
  /** Callback when PDF dimensions are known */
  onDimensionsChange?: (
    dimensions: { width: number; height: number } | null,
  ) => void;
  /** Callback when PDF loads successfully */
  onPdfLoad?: (numPages: number) => void;
  /** Callback when text layer element changes (for text extraction) */
  onTextLayerChange?: (element: HTMLElement | null) => void;
  /** Show inline page navigator above PDF (default: false) - single mode only */
  showInlineNavigator?: boolean;
  /** Gap between pages in exploded mode (default: 8) */
  pageGap?: number;
  /** Merge overlapping text highlight rects (default: true) */
  mergeHighlights?: boolean;
  /**
   * Ephemeral overlay shapes for a page (e.g. find-in-document highlights),
   * merged into that page's shapes for rendering only. Shapes with
   * `behavior.persisted !== false` returned here would leak into saved
   * annotations if the caller doesn't also filter incoming
   * `onShapesChange`/`onAnnotationsChange` — callers should use a
   * non-persisted behavior (e.g. `usePdfFind`'s highlight shapes already do).
   */
  getOverlayShapesForPage?: (page: number) => DrawShape[];
}

// =============================================================================
// THEMED PAGE WRAPPER (EXPLODED MODE)
// =============================================================================

interface ThemedPageProps {
  pageNumber: number;
  scale: number;
  tool: DrawTool;
  style: ShapeStyle;
  shapes: DrawShape[];
  onShapesChange: (shapes: DrawShape[]) => void;
  onHistoryChange?: (state: { canUndo: boolean; canRedo: boolean }) => void;
  onDimensionsChange?: (dims: { width: number; height: number }) => void;
  tokens: ThemeTokens;
  isDark: boolean;
  mergeHighlights?: boolean;
}

/**
 * Themed wrapper for PdfAnnotationPage with page number badge
 */
function ThemedPage({
  pageNumber,
  scale,
  tool,
  style,
  shapes,
  onShapesChange,
  onHistoryChange,
  onDimensionsChange,
  tokens,
  isDark,
  mergeHighlights = true,
}: ThemedPageProps): React.ReactElement {
  return (
    <div className="relative flex flex-col items-center">
      {/* Page number badge */}
      <div
        className={`absolute -top-3 left-1/2 -translate-x-1/2 z-30 px-2 py-0.5 text-[9px] tracking-wider
          ${isDark ? "bg-zinc-800 text-zinc-400" : "bg-stone-200 text-stone-600"}
          border ${tokens.border} rounded-sm`}
      >
        {pageNumber}
      </div>

      <PdfAnnotationPage
        pageNumber={pageNumber}
        scale={scale}
        tool={tool}
        style={style}
        shapes={shapes}
        mergeHighlights={mergeHighlights}
        onShapesChange={onShapesChange}
        onHistoryChange={onHistoryChange}
        onDimensionsChange={onDimensionsChange}
        className="shadow-lg"
      />
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function PdfContent({
  pdfSource,
  tool,
  style,
  scale,
  tokens,
  isDark,
  viewMode = "single",
  currentPage: controlledPage,
  onPageChange,
  annotations: controlledAnnotations,
  onAnnotationsChange,
  onShapesChange,
  onHistoryChange,
  controllerRef,
  onDimensionsChange,
  onPdfLoad,
  onTextLayerChange,
  showInlineNavigator = false,
  pageGap = 8,
  mergeHighlights = true,
  getOverlayShapesForPage,
}: PdfContentProps): React.ReactElement {
  const [numPages, setNumPages] = useState(0);

  // Internal page state (used if not controlled)
  const [internalPage, setInternalPage] = useState(1);
  const currentPage = controlledPage ?? internalPage;

  // Internal annotations state (used if not controlled)
  const [internalAnnotations, setInternalAnnotations] =
    useState<PageAnnotations>(new Map());
  const annotations = controlledAnnotations ?? internalAnnotations;

  const shapesForPage = useCallback(
    (page: number): DrawShape[] => [
      ...(annotations.get(page) ?? []),
      ...(getOverlayShapesForPage?.(page) ?? []),
    ],
    [annotations, getOverlayShapesForPage],
  );

  // Get shapes for current page (single mode)
  const currentPageShapes = shapesForPage(currentPage);

  // Page numbers array for exploded mode
  const pageNumbers = useMemo(
    () => Array.from({ length: numPages }, (_, i) => i + 1),
    [numPages],
  );

  // Handle PDF load
  const handlePdfLoadSuccess = useCallback(
    ({ numPages: pages }: { numPages: number }) => {
      setNumPages(pages);
      onPdfLoad?.(pages);
    },
    [onPdfLoad],
  );

  // Handle shapes change for a specific page
  const handleShapesChangeForPage = useCallback(
    (pageNum: number, newShapes: DrawShape[]) => {
      // Update annotations map
      if (controlledAnnotations) {
        onAnnotationsChange?.(pageNum, newShapes);
      } else {
        setInternalAnnotations((prev) => {
          const next = new Map(prev);
          next.set(pageNum, newShapes);
          return next;
        });
      }

      // Legacy callback with all shapes flat
      if (onShapesChange) {
        // Start with new shapes for current page (ensures first shape isn't lost)
        const allShapes: DrawShape[] = [...newShapes];
        const annotationsToUse = controlledAnnotations ?? internalAnnotations;
        // Include shapes from OTHER pages
        for (const [page, shapes] of annotationsToUse) {
          if (page !== pageNum) {
            allShapes.push(...shapes);
          }
        }
        onShapesChange(allShapes);
      }
    },
    [
      controlledAnnotations,
      internalAnnotations,
      onAnnotationsChange,
      onShapesChange,
    ],
  );

  // Handle shapes change for current page (single mode)
  const handleShapesChange = useCallback(
    (newShapes: DrawShape[]) => {
      handleShapesChangeForPage(currentPage, newShapes);
    },
    [currentPage, handleShapesChangeForPage],
  );

  // Page navigation
  const goToPage = useCallback(
    (page: number) => {
      const clampedPage = Math.max(1, Math.min(page, numPages));
      if (clampedPage === currentPage) return;

      if (onPageChange) {
        onPageChange(clampedPage);
      } else {
        setInternalPage(clampedPage);
      }
    },
    [numPages, currentPage, onPageChange],
  );

  const prevPage = useCallback(() => {
    goToPage(currentPage - 1);
  }, [currentPage, goToPage]);

  const nextPage = useCallback(() => {
    goToPage(currentPage + 1);
  }, [currentPage, goToPage]);

  // Keyboard navigation (single mode only)
  useEffect(() => {
    if (viewMode !== "single") return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      switch (e.key) {
        case "ArrowLeft":
        case "PageUp":
          e.preventDefault();
          prevPage();
          break;
        case "ArrowRight":
        case "PageDown":
          e.preventDefault();
          nextPage();
          break;
        case "Home":
          e.preventDefault();
          goToPage(1);
          break;
        case "End":
          e.preventDefault();
          goToPage(numPages);
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [viewMode, prevPage, nextPage, goToPage, numPages]);

  // No PDF loaded state
  if (!pdfSource) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className={`text-center ${tokens.textDim}`}>
          <div className="text-4xl mb-4 opacity-30">◇</div>
          <div className="text-[10px] tracking-wider">NO PDF LOADED</div>
        </div>
      </div>
    );
  }

  const pdfLoadingFallback = (
    <div
      className={`flex items-center justify-center p-8 ${tokens.textMuted}`}
    >
      Loading PDF...
    </div>
  );

  // Exploded mode: show all pages in scrollable container
  if (viewMode === "exploded") {
    return (
      <div className="flex flex-col items-center py-4 px-4">
        <Suspense fallback={pdfLoadingFallback}>
          <ReactPdfDocument
            file={pdfSource}
            onLoadSuccess={handlePdfLoadSuccess}
            loading={pdfLoadingFallback}
            error={
              <div className="flex items-center justify-center p-8 text-red-500">
                Failed to load PDF
              </div>
            }
          >
            <div className="flex flex-col items-center" style={{ gap: pageGap }}>
              {pageNumbers.map((pageNum) => (
                <ThemedPage
                  key={pageNum}
                  pageNumber={pageNum}
                  scale={scale}
                  tool={tool}
                  style={style}
                  shapes={shapesForPage(pageNum)}
                  onShapesChange={(shapes) =>
                    handleShapesChangeForPage(pageNum, shapes)
                  }
                  onHistoryChange={onHistoryChange}
                  onDimensionsChange={
                    pageNum === 1 ? onDimensionsChange : undefined
                  }
                  tokens={tokens}
                  isDark={isDark}
                  mergeHighlights={mergeHighlights}
                />
              ))}
            </div>
          </ReactPdfDocument>
        </Suspense>
      </div>
    );
  }

  // Single page mode
  return (
    <div className="flex flex-col items-center justify-center min-h-full p-4">
      {/* Page navigation bar (controlled by showInlineNavigator prop) */}
      {showInlineNavigator && numPages > 1 && (
        <div
          className={`flex items-center gap-3 mb-4 px-4 py-2 ${
            isDark ? "bg-zinc-900/80" : "bg-stone-100/80"
          } backdrop-blur-sm rounded-sm border ${tokens.border}`}
        >
          <button
            onClick={prevPage}
            disabled={currentPage <= 1}
            className={`px-2 py-1 text-[10px] tracking-wider transition-colors
              ${
                currentPage <= 1
                  ? `${tokens.textDimmer} cursor-not-allowed`
                  : `${tokens.textMuted} hover:${tokens.text}`
              }`}
            title="Previous page (←)"
            type="button"
          >
            ◀ PREV
          </button>

          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={numPages}
              value={currentPage}
              onChange={(e) => goToPage(parseInt(e.target.value, 10))}
              className={`w-12 px-2 py-1 text-[10px] text-center ${tokens.input} border ${tokens.border} 
                focus:outline-none focus:border-amber-500/50`}
            />
            <span className={`text-[10px] ${tokens.textDim}`}>
              / {numPages}
            </span>
          </div>

          <button
            onClick={nextPage}
            disabled={currentPage >= numPages}
            className={`px-2 py-1 text-[10px] tracking-wider transition-colors
              ${
                currentPage >= numPages
                  ? `${tokens.textDimmer} cursor-not-allowed`
                  : `${tokens.textMuted} hover:${tokens.text}`
              }`}
            title="Next page (→)"
            type="button"
          >
            NEXT ▶
          </button>
        </div>
      )}

      {/* PDF Document */}
      <div className="flex justify-center shrink-0">
        <Suspense fallback={pdfLoadingFallback}>
          <ReactPdfDocument
            file={pdfSource}
            onLoadSuccess={handlePdfLoadSuccess}
            loading={pdfLoadingFallback}
            error={
              <div className="flex items-center justify-center p-8 text-red-500">
                Failed to load PDF
              </div>
            }
          >
            <PdfAnnotationPage
              key={`page-${currentPage}`}
              pageNumber={currentPage}
              scale={scale}
              tool={tool}
              style={style}
              shapes={currentPageShapes}
              mergeHighlights={mergeHighlights}
              onShapesChange={handleShapesChange}
              onHistoryChange={onHistoryChange}
              onDimensionsChange={onDimensionsChange}
              onTextLayerChange={onTextLayerChange}
              controllerRef={controllerRef}
              className="shadow-lg"
            />
          </ReactPdfDocument>
        </Suspense>
      </div>

      {/* Page indicator (shows even for single-page when navigation bar hidden) */}
      {numPages > 0 && numPages === 1 && (
        <div className={`mt-4 text-[10px] ${tokens.textDim} tracking-wider`}>
          PAGE 1 / 1
        </div>
      )}
    </div>
  );
}

// =============================================================================
// HOOKS FOR EXTERNAL USE
// =============================================================================

/**
 * Hook for managing PDF annotations state
 * Re-exported from @n-uf/doodl/react-pdf
 */
export const usePdfAnnotations = usePdfAnnotationsCore;
