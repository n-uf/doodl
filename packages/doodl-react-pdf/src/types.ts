/**
 * Types for PDF annotation functionality
 */

import type {
  ActivationAnimationType,
  DrawShape,
  DrawTool,
  ShapeStyle,
} from "@n-uf/doodl";
import type {
  PageAnnotationController,
  PageAnnotations as _PageAnnotations,
  SerializedPageAnnotations as _SerializedPageAnnotations,
} from "@n-uf/doodl-react";

// =============================================================================
// PDF SOURCE
// =============================================================================

/**
 * PDF source - can be a URL string, File object, or null
 */
export type PdfSource = string | File | null;

// =============================================================================
// ANNOTATIONS (re-exported from doodl-react for backwards compatibility)
// =============================================================================

/**
 * Per-page annotation storage
 * @see @n-uf/doodl-react for canonical definition
 */
export type PageAnnotations = _PageAnnotations;

/**
 * Serializable version of PageAnnotations
 * @see @n-uf/doodl-react for canonical definition
 */
export type SerializedPageAnnotations = _SerializedPageAnnotations;

// =============================================================================
// VIEW MODES
// =============================================================================

/**
 * View mode for PDF display
 * - single: Show one page at a time with navigation
 * - scroll: Scrollable view of all pages (virtualized)
 */
export type PdfViewMode = "single" | "scroll";

// =============================================================================
// PAGE DIMENSIONS
// =============================================================================

/**
 * PDF page dimensions in points (72 DPI)
 */
export interface PageDimensions {
  width: number;
  height: number;
}

/**
 * Result from react-pdf page render
 */
export interface PageRenderResult {
  width: number;
  height: number;
  originalWidth: number;
  originalHeight: number;
}

// =============================================================================
// COMPONENT PROPS
// =============================================================================

/**
 * Base props for annotation-enabled PDF components
 */
export interface PdfAnnotationBaseProps {
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
   * When false, `ping()` is a no-op.
   */
  enablePing?: boolean;
  /**
   * Default `ping()` animation when `type` is omitted (default: `"ping"`).
   * Built-ins: `"ping"` | `"locateFlash"` | `"pulse"`.
   */
  defaultActivationAnimation?: ActivationAnimationType;
  /** Merge overlapping text highlight rects (default: true) */
  mergeHighlights?: boolean;
}

/**
 * Props for a single annotated PDF page
 */
export interface PdfAnnotationPageProps extends PdfAnnotationBaseProps {
  /** Page number (1-indexed) */
  pageNumber: number;
  /** Current scale factor */
  scale: number;
  /** Shapes for this page */
  shapes?: DrawShape[];
  /** Callback when shapes change */
  onShapesChange?: (shapes: DrawShape[]) => void;
  /** Callback when history state changes */
  onHistoryChange?: (state: { canUndo: boolean; canRedo: boolean }) => void;
  /** Controller ref for external access */
  controllerRef?: React.MutableRefObject<PageAnnotationController | null>;
  /** Additional className for the container */
  className?: string;
}

/**
 * Props for multi-page PDF annotation viewer
 */
export interface PdfAnnotationViewerProps extends PdfAnnotationBaseProps {
  /** PDF source - URL or File */
  source: PdfSource;
  /** Current scale factor */
  scale: number;
  /** View mode */
  viewMode?: PdfViewMode;
  /** Current page (for single view mode, controlled) */
  currentPage?: number;
  /** Callback when current page changes */
  onPageChange?: (page: number) => void;
  /** Per-page annotations (controlled) */
  annotations?: PageAnnotations;
  /** Callback when annotations change for any page */
  onAnnotationsChange?: (page: number, shapes: DrawShape[]) => void;
  /** Callback when PDF loads successfully */
  onPdfLoad?: (numPages: number) => void;
  /** Callback when PDF dimensions are known */
  onDimensionsChange?: (dimensions: PageDimensions | null) => void;
  /** Gap between pages in scroll mode (default: 24) */
  pageGap?: number;
  /** Additional className */
  className?: string;
}

// =============================================================================
// HOOK RETURN TYPES
// =============================================================================

/**
 * Return type for usePdfAnnotations hook
 */
export interface UsePdfAnnotationsReturn {
  /** Current annotations map */
  annotations: PageAnnotations;
  /** Set annotations for a specific page */
  setPageAnnotations: (page: number, shapes: DrawShape[]) => void;
  /** Get annotations for a specific page */
  getPageAnnotations: (page: number) => DrawShape[];
  /** Clear all annotations */
  clearAllAnnotations: () => void;
  /** Get all shapes as flat array */
  getAllShapesFlat: () => DrawShape[];
  /** Export annotations as JSON string */
  exportAnnotations: () => string;
  /** Import annotations from JSON string */
  importAnnotations: (json: string) => boolean;
}

/**
 * Return type for usePdfTextLayer hook
 */
export interface UsePdfTextLayerReturn {
  /** Ref to attach to container element */
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** The captured text layer element (or null if not found) */
  textLayerElement: HTMLElement | null;
  /** Trigger a refresh of the text layer capture */
  refresh: () => void;
}
