"use client";

/**
 * PdfAnnotationViewer - Multi-page PDF viewer with annotation support
 *
 * Features:
 * - Single page or scrollable multi-page view
 * - Per-page annotation storage
 * - Keyboard navigation (single mode)
 * - Text-highlight tool support via text layer capture
 */

import type {
  ActivationAnimationType,
  DrawShape,
  DrawTool,
  ShapeStyle,
} from "@n-uf/doodl";
import type { PageAnnotationController } from "@n-uf/doodl-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Document } from "react-pdf";
import type {
  PageAnnotations,
  PageDimensions,
  PdfSource,
  PdfViewMode,
} from "../types";
import { PdfAnnotationPage } from "./pdf-annotation-page";

// =============================================================================
// CONSTANTS
// =============================================================================

/** Default gap between pages in scroll mode */
const DEFAULT_PAGE_GAP = 24;

// =============================================================================
// TYPES
// =============================================================================

export interface PdfAnnotationViewerProps {
  /** PDF source - URL string or File object */
  source: PdfSource;
  /** Current scale factor */
  scale: number;
  /** View mode: "single" or "scroll" */
  viewMode?: PdfViewMode;
  /** Current page number (1-indexed, for single mode) */
  currentPage?: number;
  /** Callback when current page changes */
  onPageChange?: (page: number) => void;
  /** Per-page annotations */
  annotations?: PageAnnotations;
  /** Callback when annotations change for a page */
  onAnnotationsChange?: (page: number, shapes: DrawShape[]) => void;
  /** Current annotation tool */
  tool?: DrawTool;
  /** Current annotation style */
  style?: ShapeStyle;
  /** Whether annotations are enabled (default: true) */
  annotationsEnabled?: boolean;
  /** Selection-only mode (draw/edit disabled; select still works) */
  readOnly?: boolean;
  /** Allow activation-frame `ping()` animation (default: true) */
  enablePing?: boolean;
  /**
   * Default `ping()` animation when `type` is omitted (default: `"ping"`).
   */
  defaultActivationAnimation?: ActivationAnimationType;
  /** Merge overlapping text highlight rects (default: true) */
  mergeHighlights?: boolean;
  /** Callback when PDF loads */
  onPdfLoad?: (numPages: number) => void;
  /** Callback when PDF load fails */
  onPdfError?: (error: Error) => void;
  /** Callback when page dimensions are known */
  onDimensionsChange?: (dimensions: PageDimensions | null) => void;
  /** Callback when history changes (single mode) */
  onHistoryChange?: (state: { canUndo: boolean; canRedo: boolean }) => void;
  /** Controller ref for external access (single mode) */
  controllerRef?: React.MutableRefObject<PageAnnotationController | null>;
  /** Gap between pages in scroll mode */
  pageGap?: number;
  /** Render text layer (required for text-highlight) */
  renderTextLayer?: boolean;
  /** Custom loading component */
  loadingComponent?: React.ReactNode;
  /** Custom error component */
  errorComponent?: React.ReactNode;
  /** Additional className */
  className?: string;
  /** Additional style */
  style_?: React.CSSProperties;
}

export interface PdfAnnotationViewerHandle {
  /** Go to previous page (single mode) */
  prevPage: () => void;
  /** Go to next page (single mode) */
  nextPage: () => void;
  /** Go to specific page */
  goToPage: (page: number) => void;
  /** Get current page */
  getCurrentPage: () => number;
  /** Get total pages */
  getTotalPages: () => number;
}

// =============================================================================
// SCROLL MODE PAGE COMPONENT
// =============================================================================

interface ScrollModePageProps {
  pageNumber: number;
  scale: number;
  tool: DrawTool;
  style?: ShapeStyle;
  shapes: DrawShape[];
  annotationsEnabled: boolean;
  readOnly: boolean;
  enablePing: boolean;
  defaultActivationAnimation: ActivationAnimationType;
  mergeHighlights: boolean;
  onShapesChange: (shapes: DrawShape[]) => void;
  onHistoryChange?: (state: { canUndo: boolean; canRedo: boolean }) => void;
  onDimensionsChange?: (dims: PageDimensions) => void;
  renderTextLayer: boolean;
}

const ScrollModePage: React.FC<ScrollModePageProps> = ({
  pageNumber,
  scale,
  tool,
  style,
  shapes,
  annotationsEnabled,
  readOnly,
  enablePing,
  defaultActivationAnimation,
  mergeHighlights,
  onShapesChange,
  onHistoryChange,
  onDimensionsChange,
  renderTextLayer,
}) => {
  return (
    <div className="relative shadow-lg">
      <PdfAnnotationPage
        pageNumber={pageNumber}
        scale={scale}
        tool={tool}
        style={style}
        shapes={shapes}
        annotationsEnabled={annotationsEnabled}
        readOnly={readOnly}
        enablePing={enablePing}
        defaultActivationAnimation={defaultActivationAnimation}
        mergeHighlights={mergeHighlights}
        onShapesChange={onShapesChange}
        onHistoryChange={onHistoryChange}
        onDimensionsChange={onDimensionsChange}
        renderTextLayer={renderTextLayer}
      />
    </div>
  );
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

/**
 * Multi-page PDF viewer with annotation support
 *
 * @example
 * ```tsx
 * const { annotations, setPageAnnotations } = usePdfAnnotations();
 *
 * <PdfAnnotationViewer
 *   source={pdfFile}
 *   scale={1.5}
 *   viewMode="scroll"
 *   annotations={annotations}
 *   onAnnotationsChange={setPageAnnotations}
 *   tool="text-highlight"
 * />
 * ```
 */
export const PdfAnnotationViewer = React.forwardRef<
  PdfAnnotationViewerHandle,
  PdfAnnotationViewerProps
>(
  (
    {
      source,
      scale,
      viewMode = "single",
      currentPage: controlledPage,
      onPageChange,
      annotations,
      onAnnotationsChange,
      tool = "select",
      style,
      annotationsEnabled = true,
      readOnly = false,
      enablePing = true,
      defaultActivationAnimation = "ping",
      mergeHighlights = true,
      onPdfLoad,
      onPdfError,
      onDimensionsChange,
      onHistoryChange,
      controllerRef,
      pageGap = DEFAULT_PAGE_GAP,
      renderTextLayer = true,
      loadingComponent,
      errorComponent,
      className = "",
      style_,
    },
    ref
  ) => {
    // State
    const [numPages, setNumPages] = useState(0);
    const [internalPage, setInternalPage] = useState(1);
    const [internalAnnotations, setInternalAnnotations] =
      useState<PageAnnotations>(new Map());
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- pageDimensions kept for future use
    const [pageDimensions, setPageDimensions] = useState<PageDimensions | null>(
      null
    );

    // Controlled vs uncontrolled
    const currentPage = controlledPage ?? internalPage;
    const effectiveAnnotations = annotations ?? internalAnnotations;

    // Page numbers array for scroll mode
    const pageNumbers = useMemo(
      () => Array.from({ length: numPages }, (_, i) => i + 1),
      [numPages]
    );

    // Shapes for current page (single mode)
    const currentPageShapes = effectiveAnnotations.get(currentPage) ?? [];

    // PDF load handler
    const handleDocumentLoadSuccess = useCallback(
      ({ numPages: pages }: { numPages: number }) => {
        setNumPages(pages);
        onPdfLoad?.(pages);
      },
      [onPdfLoad]
    );

    // PDF error handler
    const handleDocumentLoadError = useCallback(
      (error: Error) => {
        console.error("[PdfAnnotationViewer] PDF load error:", error);
        onPdfError?.(error);
      },
      [onPdfError]
    );

    // Shapes change handler for specific page
    const handleShapesChangeForPage = useCallback(
      (pageNum: number, newShapes: DrawShape[]) => {
        if (annotations) {
          // Controlled mode
          onAnnotationsChange?.(pageNum, newShapes);
        } else {
          // Uncontrolled mode
          setInternalAnnotations((prev) => {
            const next = new Map(prev);
            if (newShapes.length === 0) {
              next.delete(pageNum);
            } else {
              next.set(pageNum, newShapes);
            }
            return next;
          });
        }
      },
      [annotations, onAnnotationsChange]
    );

    // Shapes change handler for current page (single mode)
    const handleShapesChange = useCallback(
      (newShapes: DrawShape[]) => {
        handleShapesChangeForPage(currentPage, newShapes);
      },
      [currentPage, handleShapesChangeForPage]
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
      [numPages, currentPage, onPageChange]
    );

    const prevPage = useCallback(() => {
      goToPage(currentPage - 1);
    }, [currentPage, goToPage]);

    const nextPage = useCallback(() => {
      goToPage(currentPage + 1);
    }, [currentPage, goToPage]);

    // Expose imperative handle
    React.useImperativeHandle(
      ref,
      () => ({
        prevPage,
        nextPage,
        goToPage,
        getCurrentPage: () => currentPage,
        getTotalPages: () => numPages,
      }),
      [prevPage, nextPage, goToPage, currentPage, numPages]
    );

    // Keyboard navigation (single mode only)
    useEffect(() => {
      if (viewMode !== "single") return;

      const handleKeyDown = (e: KeyboardEvent) => {
        // Don't intercept if user is typing
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

    // No source provided
    if (!source) {
      return (
        <div
          className={`flex items-center justify-center ${className}`}
          style={style_}
        >
          <div className="text-center text-gray-500">
            <div className="text-4xl mb-4 opacity-30">◇</div>
            <div className="text-sm">No PDF loaded</div>
          </div>
        </div>
      );
    }

    // Default loading component
    const defaultLoading = loadingComponent ?? (
      <div className="flex items-center justify-center p-8 text-gray-500">
        Loading PDF...
      </div>
    );

    // Default error component
    const defaultError = errorComponent ?? (
      <div className="flex items-center justify-center p-8 text-red-500">
        Failed to load PDF
      </div>
    );

    return (
      <div className={`${className}`} style={style_}>
        <Document
          file={source}
          onLoadSuccess={handleDocumentLoadSuccess}
          onLoadError={handleDocumentLoadError}
          loading={defaultLoading}
          error={defaultError}
        >
          {viewMode === "scroll" ? (
            // Scroll mode: all pages
            <div
              className="flex flex-col items-center"
              style={{ gap: pageGap }}
            >
              {pageNumbers.map((pageNum) => (
                <ScrollModePage
                  key={pageNum}
                  pageNumber={pageNum}
                  scale={scale}
                  tool={tool}
                  style={style}
                  shapes={effectiveAnnotations.get(pageNum) ?? []}
                  annotationsEnabled={annotationsEnabled}
                  readOnly={readOnly}
                  enablePing={enablePing}
                  defaultActivationAnimation={defaultActivationAnimation}
                  mergeHighlights={mergeHighlights}
                  onShapesChange={(shapes) =>
                    handleShapesChangeForPage(pageNum, shapes)
                  }
                  onHistoryChange={onHistoryChange}
                  onDimensionsChange={
                    pageNum === 1
                      ? (dims) => {
                          setPageDimensions(dims);
                          onDimensionsChange?.(dims);
                        }
                      : undefined
                  }
                  renderTextLayer={renderTextLayer}
                />
              ))}
            </div>
          ) : (
            // Single mode: one page
            <PdfAnnotationPage
              key={`page-${currentPage}`}
              pageNumber={currentPage}
              scale={scale}
              tool={tool}
              style={style}
              shapes={currentPageShapes}
              annotationsEnabled={annotationsEnabled}
              readOnly={readOnly}
              enablePing={enablePing}
              defaultActivationAnimation={defaultActivationAnimation}
              mergeHighlights={mergeHighlights}
              onShapesChange={handleShapesChange}
              onHistoryChange={onHistoryChange}
              onDimensionsChange={(dims) => {
                setPageDimensions(dims);
                onDimensionsChange?.(dims);
              }}
              controllerRef={controllerRef}
              renderTextLayer={renderTextLayer}
              className="shadow-lg"
            />
          )}
        </Document>
      </div>
    );
  }
);

PdfAnnotationViewer.displayName = "PdfAnnotationViewer";

export default PdfAnnotationViewer;
