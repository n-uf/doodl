/**
 * Document Annotation Module
 *
 * Multi-page document annotation management with configurable history modes.
 */

// Types
export type {
  DocumentAnnotationData,
  DocumentAnnotationEventName,
  DocumentAnnotationEvents,
  DocumentAnnotationManagerOptions,
  GlobalHistoryEntry,
  HistoryConfig,
  HistoryMode,
  HistoryState,
  PageAnnotationState,
  PageHistory,
  TransitionBehavior,
  UndoRedoResult,
  ViewMode,
} from "./types";

export { DEFAULT_HISTORY_CONFIG } from "./types";

// History managers
export { PerPageHistoryManager } from "./per-page-history";
export { GlobalHistoryManager } from "./global-history";

// Main manager
export {
  createDocumentAnnotationManager,
  DocumentAnnotationManager,
} from "./document-annotation-manager";

// React hook
export {
  useDocumentAnnotations,
  type UseDocumentAnnotationsOptions,
  type UseDocumentAnnotationsReturn,
} from "./use-document-annotations";

