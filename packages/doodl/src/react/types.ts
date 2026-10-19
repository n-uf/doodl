/**
 * Types for Page Annotation (multi-page document support)
 */

import type {
  ActivationAnimationType,
  DrawShape,
  DrawTool,
  ShapeStyle,
} from "../../index";

// =============================================================================
// MULTI-PAGE ANNOTATIONS
// =============================================================================

/**
 * Per-page annotation storage
 * Key: page number (1-indexed)
 * Value: array of shapes for that page
 */
export type PageAnnotations = Map<number, DrawShape[]>;

/**
 * Serializable version of PageAnnotations for JSON export/import
 */
export interface SerializedPageAnnotations {
  version: 1;
  pages: Array<{
    pageNumber: number;
    shapes: DrawShape[];
  }>;
}

// =============================================================================
// PAGE COORDINATE CONTEXT
// =============================================================================

/**
 * Page coordinate context for transforms
 */
export interface PageCoordinateContext {
  /** Page width in native units (e.g., PDF points at 72 DPI) */
  pageWidth: number;
  /** Page height in native units */
  pageHeight: number;
  /** Current render scale */
  scale: number;
}

/**
 * Options for creating a page annotation controller
 */
export interface PageAnnotationControllerOptions {
  /** Page width in native units */
  pageWidth: number;
  /** Page height in native units */
  pageHeight: number;
  /** Initial scale factor */
  scale?: number;
  /** Initial shapes (in page coordinates) */
  initialShapes?: DrawShape[];
  /** Initial tool */
  initialTool?: DrawTool;
  /** Initial style */
  initialStyle?: ShapeStyle;
  /** Merge overlapping text highlight rects (default: true) */
  mergeHighlights?: boolean;
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
}

/**
 * Events emitted by PageAnnotationController
 */
export interface PageAnnotationEvents {
  /** Fired when shapes change (shapes in page coordinates) */
  shapesChange: (shapes: DrawShape[]) => void;
  /** Fired when tool changes */
  toolChange: (tool: DrawTool) => void;
  /** Fired when style changes */
  styleChange: (style: ShapeStyle) => void;
  /** Fired when history state changes */
  historyChange: (state: { canUndo: boolean; canRedo: boolean }) => void;
  /** Fired when selection changes (selected shape IDs) */
  selectionChange: (selectedIds: string[]) => void;
}

export type PageAnnotationEventName = keyof PageAnnotationEvents;
