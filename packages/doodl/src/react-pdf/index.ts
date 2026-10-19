/**
 * @n-uf/doodl/react-pdf
 *
 * PDF annotation components and hooks for React.
 * Combines react-pdf rendering with doodl annotation capabilities.
 *
 * IMPORTANT: Components (PdfAnnotationPage, PdfAnnotationViewer) use react-pdf
 * which requires browser APIs. To avoid SSR issues, import components from
 * "@n-uf/doodl/react-pdf/components" using dynamic imports. This entry only
 * exports hooks and types, which are safe to import on the server.
 *
 * @example
 * ```tsx
 * import dynamic from "next/dynamic";
 * import { usePdfAnnotations, type PdfAnnotationViewerProps } from "@n-uf/doodl/react-pdf";
 *
 * // Dynamic import for client-only component
 * const PdfAnnotationViewer = dynamic(
 *   () => import("@n-uf/doodl/react-pdf/components").then(m => m.PdfAnnotationViewer),
 *   { ssr: false }
 * );
 *
 * function App() {
 *   const { annotations, setPageAnnotations } = usePdfAnnotations();
 *
 *   return (
 *     <PdfAnnotationViewer
 *       source="/document.pdf"
 *       scale={1.5}
 *       viewMode="scroll"
 *       annotations={annotations}
 *       onAnnotationsChange={setPageAnnotations}
 *       tool="text-highlight"
 *     />
 *   );
 * }
 * ```
 */

// Hooks (SSR-safe)
export {
  usePdfAnnotations,
  usePdfTextLayer,
  usePdfTextLayerAuto,
  usePdfViewportScale,
  useCyclingFitMode,
  getPdfFitModeDescriptor,
  getPdfFitCycleTitle,
  fitCycleTitleFromReturn,
  nextPdfFitMode,
  computeFitWidthScale,
  computeFitHeightScale,
  computeFitPageScale,
  computeFitModeScale,
  resolveFitScale,
  resolveMeasuredAvailableSize,
  isFitScaleActive,
  PDF_FIT_SCALE_EPSILON,
  PDF_FIT_CYCLE_ACTIVE_CLASS,
  PDF_FIT_CYCLE_BUTTON_CLASS,
  PDF_FIT_CYCLE_BUTTON_STYLE,
  PDF_FIT_CYCLE_LABEL_CLASS,
  PDF_FIT_CYCLE_LED_CLASS,
  PDF_FIT_CYCLE_LED_OFF_CLASS,
  PDF_FIT_CYCLE_LED_ON_CLASS,
  PDF_ZOOM_PERCENT_BUTTON_CLASS,
  PDF_ZOOM_PERCENT_BUTTON_STYLE,
  PDF_ZOOM_PERCENT_MAX_LABEL,
  PDF_ZOOM_STEP_BUTTON_CLASS,
  PDF_ZOOM_STEP_BUTTON_STYLE,
  PDF_FIT_MODE_ORDER,
  usePdfFind,
} from "./hooks";

// Utilities (SSR-safe - guard for document internally)
export {
  // Text layer utilities
  getAnnotationTextLayer,
  getAnnotationTextLayersByPage,
  getAnnotationTextLayerForPage,
  PDF_TEXT_LAYER_SELECTOR,
  // Annotation display utilities
  ANNOTATION_TYPE_LABELS,
  ANNOTATION_TYPE_ICONS,
  ANNOTATION_TYPE_ORDER,
  getAnnotationDisplayInfo,
  compareAnnotationTypes,
  type AnnotationDisplayInfo,
} from "./utils";

// Types (SSR-safe)
export type {
  PageAnnotations,
  PageDimensions,
  PageRenderResult,
  PdfAnnotationBaseProps,
  PdfSource,
  PdfViewMode,
  SerializedPageAnnotations,
  UsePdfAnnotationsReturn,
  UsePdfTextLayerReturn,
} from "./types";

// Zoom/fit + find types (SSR-safe)
export type {
  PdfPageSize,
  UsePdfViewportScaleOptions,
  UsePdfViewportScaleReturn,
  CyclingFitViewport,
  PdfFitMode,
  PdfFitModeDescriptor,
  UseCyclingFitModeOptions,
  UseCyclingFitModeReturn,
  FitScaleMode,
  FitScaleClampRange,
  FitAvailableSize,
  PdfMeasureBox,
  ContainerBoxMetrics,
  MeasureBoxInsets,
  FindMatchRef,
  UsePdfFindOptions,
  UsePdfFindReturn,
} from "./hooks";

// FindBar class tokens (SSR-safe strings)
export {
  FIND_BAR_CASE_SENSITIVE_TOGGLE_ACCENT_ON_CLASS,
  FIND_BAR_CASE_SENSITIVE_TOGGLE_CLASS,
  FIND_BAR_CASE_SENSITIVE_TOGGLE_OFF_CLASS,
  FIND_BAR_CASE_SENSITIVE_TOGGLE_ON_CLASS,
  FIND_BAR_CASE_SENSITIVE_TOGGLE_SIZE_CLASS,
  FIND_BAR_CASE_SENSITIVE_TOGGLE_SIZE_STYLE,
  FIND_BAR_CLEAR_BUTTON_CLASS,
  FIND_BAR_INPUT_WITH_CLEAR_CLASS,
  FIND_BAR_INPUT_WRAP_CLASS,
  FIND_BAR_INPUT_WRAP_STYLE,
  FIND_BAR_MATCH_COUNT_CLASS,
  FIND_BAR_MATCH_COUNT_STYLE,
  FIND_BAR_ROOT_CLASS,
  FIND_BAR_ROOT_STYLE,
} from "./components/find-bar";

// Component types only (not the implementations)
export type { PdfAnnotationPageProps } from "./components/pdf-annotation-page";
export type {
  PdfAnnotationViewerHandle,
  PdfAnnotationViewerProps,
} from "./components/pdf-annotation-viewer";
export type {
  FindBarChromeProps,
  FindBarControlledProps,
  FindBarFindProps,
  FindBarProps,
} from "./components/find-bar";

