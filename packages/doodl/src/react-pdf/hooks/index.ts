/**
 * Hooks for PDF annotation functionality
 */

export { usePdfAnnotations } from "./use-pdf-annotations";
export { usePdfTextLayer, usePdfTextLayerAuto } from "./use-pdf-text-layer";
export {
  usePdfViewportScale,
  type PdfPageSize,
  type UsePdfViewportScaleOptions,
  type UsePdfViewportScaleReturn,
} from "./use-pdf-viewport-scale";
export {
  useCyclingFitMode,
  getPdfFitModeDescriptor,
  getPdfFitCycleTitle,
  fitCycleTitleFromReturn,
  nextPdfFitMode,
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
  type CyclingFitViewport,
  type PdfFitMode,
  type PdfFitModeDescriptor,
  type UseCyclingFitModeOptions,
  type UseCyclingFitModeReturn,
} from "./use-cycling-fit-mode";
export {
  computeFitWidthScale,
  computeFitHeightScale,
  computeFitPageScale,
  computeFitModeScale,
  resolveFitScale,
  resolveMeasuredAvailableSize,
  isFitScaleActive,
  PDF_FIT_SCALE_EPSILON,
  type FitScaleMode,
  type FitScaleClampRange,
  type FitAvailableSize,
  type PdfMeasureBox,
  type ContainerBoxMetrics,
  type MeasureBoxInsets,
} from "./fit-scale";
export {
  usePdfFind,
  type FindMatchRef,
  type UsePdfFindOptions,
  type UsePdfFindReturn,
} from "./use-pdf-find";

