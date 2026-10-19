/**
 * Components for PDF annotation functionality
 */

export {
  PdfAnnotationPage,
  type PdfAnnotationPageProps,
} from "./pdf-annotation-page";
export {
  PdfAnnotationViewer,
  type PdfAnnotationViewerHandle,
  type PdfAnnotationViewerProps,
} from "./pdf-annotation-viewer";
export { ZoomControls, type ZoomControlsProps } from "./zoom-controls";
export {
  FindBar,
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
  type FindBarChromeProps,
  type FindBarControlledProps,
  type FindBarFindProps,
  type FindBarProps,
} from "./find-bar";

// Re-export Document from react-pdf to ensure context sharing
// When Document and Page come from the same module instance, React context works
export { Document as PdfDocument, pdfjs } from "react-pdf";

// Default PDF.js worker configuration (version-pinned jsDelivr CDN)
export {
  configureDefaultPdfWorker,
  pdfWorkerCdnUrl,
  type ConfigureDefaultPdfWorkerOptions,
} from "./pdf-worker";

