/**
 * Document model: one AnnotationDocument owns every mark of a multi-page
 * document, the one selection, tool, style, active page, gesture, history and events.
 */

export { AnnotationDocument, createAnnotationDocument } from "./annotation-document";
export {
  NUDGE_STEP,
  NUDGE_STEP_SHIFT,
  runDocumentCommand,
} from "./document-commands";
export {
  DEFAULT_COALESCE_MS,
  DEFAULT_MAX_HISTORY_ENTRIES,
  DocumentHistory,
} from "./document-history";
export {
  applyClick,
  groupByPage,
  makeSelection,
  SelectionModel,
} from "./document-selection";
export { GestureLock } from "./gesture-lock";
export { toPageId } from "./types";
export type {
  AnnotationDocumentOptions,
  ClickOptions,
  ClickTarget,
  DocShape,
  DocumentChangeEvent,
  DocumentCommand,
  DocumentEventName,
  DocumentEvents,
  DocumentGesture,
  DocumentHistoryMode,
  DocumentHistoryOptions,
  DocumentHistoryState,
  DocumentPageView,
  DocumentPingOptions,
  DocumentSelection,
  DocumentSelectionChangeEvent,
  DocumentTransaction,
  GestureCommitOptions,
  GestureInfo,
  GestureOptions,
  GesturePreviewEvent,
  HistoryAppliedEvent,
  LocateEvent,
  PageId,
  PageIdInput,
  PageInfo,
  PageSize,
  SelectMode,
  SetPageShapesOptions,
  ShapePatch,
  ShapesChangeMeta,
  TransactionBuilder,
  TransactionPatch,
  TransactOptions,
} from "./types";
