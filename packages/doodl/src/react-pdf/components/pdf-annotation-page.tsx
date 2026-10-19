"use client";

/**
 * PdfAnnotationPage - Single PDF page with annotation overlay
 *
 * Composes:
 * - react-pdf Page component for PDF rendering
 * - PageAnnotationLayer from the react part for annotation canvas
 * - Text layer capture for text-highlight tool
 *
 * Text-layer CSS: react-pdf's `TextLayer.css` is imported here so every
 * consumer gets invisible-but-selectable text (`color: transparent`) and
 * absolute positioning (`inset: 0`) matching the PDF canvas. Without it,
 * spans paint as a mis-scaled ghost layer and annotation overlays diverge.
 * `@n-uf/doodl/react`'s text-layer.css (font-size / --total-scale-factor)
 * is pulled in via PageAnnotationLayer.
 */

import {
  registerBuiltinShapes,
  type ActivationAnimationType,
  type DrawShape,
  type DrawTool,
  type ShapeStyle,
} from "../../../index";
import {
  PageAnnotationLayer,
  type PageAnnotationController,
} from "../../react";

// PdfAnnotationPage is a common exclusive import path — keep shapes registered
// even when consumers never import from the core entry directly.
registerBuiltinShapes();
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Page } from "react-pdf";
// Side-effect: transparent, page-sized text layer for find/selection.
import "react-pdf/dist/Page/TextLayer.css";
import type { PageDimensions, PageRenderResult } from "../types";

// =============================================================================
// TYPES
// =============================================================================

export interface PdfAnnotationPageProps {
  /** Page number (1-indexed) */
  pageNumber: number;
  /** Current scale factor */
  scale: number;
  /** Shapes for this page (page coordinates) */
  shapes?: DrawShape[];
  /** Current annotation tool */
  tool?: DrawTool;
  /** Current annotation style */
  style?: ShapeStyle;
  /** Whether annotations are enabled (default: true) */
  annotationsEnabled?: boolean;
  /**
   * Selection-only mode (default: false).
   * Disables draw/edit/drag/resize; pointer selection still works.
   */
  readOnly?: boolean;
  /**
   * Allow activation-frame `ping()` animation (default: true).
   * When false, `ping()` is a no-op (locate/select still work).
   */
  enablePing?: boolean;
  /**
   * Default `ping()` animation when `type` is omitted (default: `"ping"`).
   * Built-ins: `"ping"` | `"locateFlash"` | `"pulse"`.
   */
  defaultActivationAnimation?: ActivationAnimationType;
  /** Merge overlapping text highlight rects (default: true) */
  mergeHighlights?: boolean;
  /** Callback when shapes change */
  onShapesChange?: (shapes: DrawShape[]) => void;
  /** Callback when history state changes */
  onHistoryChange?: (state: { canUndo: boolean; canRedo: boolean }) => void;
  /** Callback when page dimensions are known */
  onDimensionsChange?: (dimensions: PageDimensions) => void;
  /** Callback when page renders successfully */
  onRenderSuccess?: (page: PageRenderResult) => void;
  /** Callback when text layer element is captured */
  onTextLayerChange?: (element: HTMLElement | null) => void;
  /** Controller ref for external access */
  controllerRef?: React.MutableRefObject<PageAnnotationController | null>;
  /** Render text layer (required for text-highlight tool, default: true) */
  renderTextLayer?: boolean;
  /** Render annotation layer from PDF (default: false) */
  renderAnnotationLayer?: boolean;
  /** Additional className for the container */
  className?: string;
  /** Additional style for the container */
  style_?: React.CSSProperties;
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Single PDF page with annotation overlay
 *
 * @example
 * ```tsx
 * <Document file={pdfFile}>
 *   <PdfAnnotationPage
 *     pageNumber={1}
 *     scale={1.5}
 *     tool="text-highlight"
 *     shapes={pageShapes}
 *     onShapesChange={setPageShapes}
 *   />
 * </Document>
 * ```
 */
export const PdfAnnotationPage: React.FC<PdfAnnotationPageProps> = ({
  pageNumber,
  scale,
  shapes,
  tool = "select",
  style,
  annotationsEnabled = true,
  readOnly = false,
  enablePing = true,
  defaultActivationAnimation = "ping",
  mergeHighlights = true,
  onShapesChange,
  onHistoryChange,
  onDimensionsChange,
  onRenderSuccess,
  onTextLayerChange,
  controllerRef,
  renderTextLayer = true,
  renderAnnotationLayer = false,
  className = "",
  style_,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [textLayerElement, setTextLayerElement] = useState<HTMLElement | null>(
    null
  );
  const [pageDimensions, setPageDimensions] = useState<PageDimensions | null>(
    null
  );

  // Notify parent when text layer changes
  useEffect(() => {
    onTextLayerChange?.(textLayerElement);
  }, [textLayerElement, onTextLayerChange]);

  // Handle page render success
  const handleRenderSuccess = useCallback(
    (page: PageRenderResult) => {
      const dims: PageDimensions = {
        width: page.originalWidth,
        height: page.originalHeight,
      };
      setPageDimensions(dims);

      onDimensionsChange?.(dims);
      onRenderSuccess?.(page);

      // Capture text layer after render
      requestAnimationFrame(() => {
        const container = containerRef.current;
        if (container) {
          const textLayer = container.querySelector(
            ".react-pdf__Page__textContent"
          ) as HTMLElement | null;
          setTextLayerElement(textLayer);
        }
      });
    },
    [onDimensionsChange, onRenderSuccess]
  );

  // Re-capture text layer when scale prop changes
  useEffect(() => {
    requestAnimationFrame(() => {
      const container = containerRef.current;
      if (container) {
        const textLayer = container.querySelector(
          ".react-pdf__Page__textContent"
        ) as HTMLElement | null;
        setTextLayerElement(textLayer);
      }
    });
  }, [scale]);

  return (
    <div ref={containerRef} className={`relative ${className}`} style={style_}>
      {/* PDF Page */}
      <Page
        pageNumber={pageNumber}
        scale={scale}
        onRenderSuccess={handleRenderSuccess}
        renderTextLayer={renderTextLayer}
        renderAnnotationLayer={renderAnnotationLayer}
      />

      {/* Annotation Layer */}
      {annotationsEnabled && pageDimensions && (
        <PageAnnotationLayer
          pageWidth={pageDimensions.width}
          pageHeight={pageDimensions.height}
          scale={scale}
          textLayerElement={textLayerElement}
          tool={tool}
          style={style}
          shapes={shapes}
          enabled
          readOnly={readOnly}
          enablePing={enablePing}
          defaultActivationAnimation={defaultActivationAnimation}
          mergeHighlights={mergeHighlights}
          onShapesChange={onShapesChange}
          onHistoryChange={onHistoryChange}
          controllerRef={controllerRef}
          className="pointer-events-auto"
        />
      )}
    </div>
  );
};

export default PdfAnnotationPage;
