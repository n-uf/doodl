/**
 * Document model types
 *
 * The AnnotationDocument owns every mark of a multi-page document (each tagged
 * with its page), the one selection, tool and style, the active page, the one
 * gesture in progress, one undo history, and the events. It has no DOM.
 */

import type { DrawShape } from "../shapes/common/types/shape";
import type { DrawTool } from "../tools";
import type { Bounds, Point } from "../types/geometry";
import type { ShapeStyle } from "../types/style";

// =============================================================================
// IDS AND RECORDS
// =============================================================================

/** Page identifier. PDF hosts use `String(pageNumber)`; APIs also accept a number. */
export type PageId = string;

/** A page id as callers may pass it (numbers are normalised with `String`). */
export type PageIdInput = PageId | number;

/** Normalise a page id input to a `PageId`. */
export function toPageId(id: PageIdInput): PageId {
  return typeof id === "number" ? String(id) : id;
}

/** Size of a page in page units. */
export interface PageSize {
  width: number;
  height: number;
}

/** A registered page. */
export interface PageInfo extends PageSize {
  id: PageId;
}

/** A shape record as the document stores it: always tagged with its page. */
export type DocShape = DrawShape & { pageId: PageId };

// =============================================================================
// TRANSACTIONS AND HISTORY
// =============================================================================

/**
 * One shape change inside a transaction.
 * `before === null` is an add, `after === null` is a remove, both set is an update.
 */
export interface ShapePatch {
  pageId: PageId;
  id: string;
  before: DocShape | null;
  after: DocShape | null;
  /** Position in the page's list (before-position, or after-position for an add). */
  index: number;
}

/** One history entry: a user action (gesture, command, burst, programmatic transact). */
export interface Transaction {
  /** Unique, increasing per document. Carried by `shapesChange`. */
  id: number;
  label: string;
  patches: ShapePatch[];
  selectionBefore: string[];
  selectionAfter: string[];
  /** Pages touched by the patches. */
  pageIds: PageId[];
  origin: string;
  /** Milliseconds (document clock) at commit. */
  time: number;
  /** Entries with the same key recorded in quick succession merge (nudge bursts). */
  coalesceKey?: string;
}

export type DocumentHistoryMode = "document" | "per-page";

export interface DocumentHistoryOptions {
  /** `"document"` (default): one ordered stack. `"per-page"`: undo/redo take a page id. */
  mode?: DocumentHistoryMode;
  /** Oldest entries are dropped beyond this many (default 100). */
  maxEntries?: number;
  /** Window for merging entries with the same `coalesceKey` (default 800 ms). */
  coalesceMs?: number;
}

export interface DocumentHistoryState {
  canUndo: boolean;
  canRedo: boolean;
  undoLabel: string | null;
  redoLabel: string | null;
  /** Pages the next undo changes. */
  undoPageIds: PageId[];
  /** Pages the next redo changes. */
  redoPageIds: PageId[];
}

// =============================================================================
// SELECTION
// =============================================================================

export type SelectMode = "replace" | "add" | "toggle";

/** The document selection: ids in selection order, and the same ids grouped by page. */
export interface DocumentSelection {
  ids: string[];
  byPage: Map<PageId, string[]>;
}

export interface SelectionChangeEvent extends DocumentSelection {
  /** Who caused it: `"user"`, `"host"`, `"undo"`, `"redo"`, or a caller string. */
  origin: string;
}

/** What a pointer press landed on (the page view or binder works this out). */
export type ClickTarget =
  | { kind: "shape"; id: string }
  /** Empty paper of a page. */
  | { kind: "paper"; pageId: PageIdInput }
  /** The root outside any page (the gap between pages, margins). */
  | { kind: "gap" }
  /** Outside the document root (side panel, toolbar): keeps the selection. */
  | { kind: "outside" };

export interface ClickOptions {
  /** Shift held: toggle the mark, keep the rest. */
  shift?: boolean;
  /**
   * When the press is on a mark that is already selected, keep the whole selection
   * (so a group can be dragged). The caller collapses it on release without a drag.
   */
  preserveGroup?: boolean;
}

// =============================================================================
// GESTURES
// =============================================================================

export interface GestureOptions {
  /** `"draw"`, `"move"`, `"resize"`, `"vertex"`, `"polygon"`, `"select"`, or a caller string. */
  kind?: string;
  pointerId?: number | null;
  /** Several clicks make one gesture (polygon). Defaults to `kind === "polygon"`. */
  multiClick?: boolean;
}

export interface GestureInfo {
  id: number;
  pageId: PageId;
  pointerId: number | null;
  kind: string;
  multiClick: boolean;
}

export interface GestureCommitOptions {
  label?: string;
  /**
   * Selection after the commit: `"new"` (default) selects the added marks, if any;
   * `"keep"` leaves it; or explicit ids.
   */
  select?: "new" | "keep" | readonly string[];
}

/** The gesture in progress. Owned by the document; the page view holds a handle. */
export interface DocumentGesture extends GestureInfo {
  readonly active: boolean;
  /** Clicks so far (multi-click gestures). */
  readonly points: readonly Point[];
  /** Working copies shown by the view. Never in history until commit. */
  readonly shapes: readonly DocShape[];
  /** Replace the working copies (new ids are adds, existing ids are updates). */
  setPreview(shapes: readonly DrawShape[]): void;
  /** Append a click (multi-click gestures). */
  addPoint(point: Point): void;
  /**
   * Commit as one transaction. A polygon with 3+ points is built from its points,
   * with fewer it is dropped. Returns null when nothing was committed.
   */
  commit(options?: GestureCommitOptions): Transaction | null;
  /** Drop the working copies and release the lock. */
  cancel(): void;
}

// =============================================================================
// EVENTS
// =============================================================================

export interface ShapesChangeMeta {
  origin: string;
  label: string | null;
  /**
   * Id of the commit (gesture end, command, undo/redo of that entry, amend).
   * `null` for host syncs that record no history.
   */
  transactionId: number | null;
}

export interface ChangeEvent {
  pageIds: PageId[];
  origin: string;
  transactionId: number | null;
}

export interface HistoryAppliedEvent {
  kind: "undo" | "redo";
  label: string;
  transactionId: number;
  /** Pages that actually changed (the host can scroll to the first). */
  pageIds: PageId[];
}

export interface GesturePreviewEvent {
  gestureId: number;
  pageId: PageId;
  kind: string;
  /** Working copy; empty when the gesture ended. Never written to history. */
  shapes: readonly DocShape[];
}

export interface LocateEvent {
  id: string;
  pageId: PageId;
  bounds: Bounds | null;
  ping: boolean;
}

export interface DocumentPingOptions {
  type?: string;
  duration?: number;
  color?: [number, number, number];
}

export interface DocumentEvents {
  /** Once per commit per page. Never during a gesture. */
  shapesChange: (
    pageId: PageId,
    shapes: readonly DocShape[],
    meta: ShapesChangeMeta
  ) => void;
  /** Once per transaction, after the per-page `shapesChange` events. */
  change: (event: ChangeEvent) => void;
  selectionChange: (event: SelectionChangeEvent) => void;
  historyChange: (state: DocumentHistoryState) => void;
  historyApplied: (event: HistoryAppliedEvent) => void;
  toolChange: (tool: DrawTool) => void;
  styleChange: (style: ShapeStyle) => void;
  readOnlyChange: (readOnly: boolean) => void;
  activePageChange: (pageId: PageId | null) => void;
  gestureChange: (gesture: GestureInfo | null) => void;
  /** Optional live working copy of a gesture, without history. */
  gesturePreview: (event: GesturePreviewEvent) => void;
  locate: (event: LocateEvent) => void;
}

export type DocumentEventName = keyof DocumentEvents;

// =============================================================================
// TRANSACTIONS API
// =============================================================================

/** The builder passed to `transact` and `amendTransaction`. */
export interface TransactionBuilder {
  /** Add a mark to a page (an existing id on that page is updated instead). */
  add(pageId: PageIdInput, shape: DrawShape): void;
  /** Replace a mark by id (stays on its page). Returns false when the id is unknown. */
  update(shape: DrawShape): boolean;
  /** Remove a mark by id. Returns false when the id is unknown. */
  remove(id: string): boolean;
  /** Read a mark as it stands inside the transaction. */
  get(id: string): DocShape | undefined;
  /** Change the selection as part of the transaction (default mode `"replace"`). */
  select(ids: readonly string[], mode?: SelectMode): void;
}

export interface TransactOptions {
  /** Who made the change, reported on events (default `"user"`). */
  origin?: string;
  /** Record in history (default true). */
  history?: boolean;
  /** Merge with the previous entry that has the same key, within the coalesce window. */
  coalesceKey?: string;
  /**
   * Run even when the document is read-only (default false). Meant for hosts that
   * change the data themselves; people's edits never bypass `readOnly`.
   * `setPageShapes` and `amendTransaction` always bypass it.
   */
  bypassReadOnly?: boolean;
  /**
   * Record every patch in history, including untracked marks (anchored, staged and
   * the like). Default false: only tracked marks are undoable. A person's Delete
   * uses it, so deleting any mark can be undone.
   */
  trackAll?: boolean;
}

/** Declarative form of a transaction patch, for `amendTransaction`. */
export interface TransactionPatch {
  add?: readonly { pageId: PageIdInput; shape: DrawShape }[];
  update?: readonly DrawShape[];
  remove?: readonly string[];
}

export interface SetPageShapesOptions {
  /** Record the sync as an undoable step (default false). */
  history?: boolean;
  /** Default `"host"`. */
  origin?: string;
}

// =============================================================================
// VIEWS
// =============================================================================

/**
 * What the document needs from a page view. Views attach and detach freely
 * (mount, unmount, zoom, virtualisation) without touching state or history.
 */
export interface DocumentPageView {
  /** The page's marks, selection or gesture preview changed: redraw. */
  invalidate?(): void;
  /** Play the ping for a mark on this page. */
  ping?(shapeId: string, options?: DocumentPingOptions): void;
}

// =============================================================================
// COMMANDS
// =============================================================================

export type DocumentCommand =
  | "delete"
  | "undo"
  | "redo"
  | "escape"
  | "selectAll"
  | { nudge: readonly [number, number] }
  /** Per-page history mode: undo/redo the latest entry that touches the page. */
  | { undo: PageIdInput }
  | { redo: PageIdInput };

// =============================================================================
// OPTIONS
// =============================================================================

export interface AnnotationDocumentOptions {
  pages?: readonly { id: PageIdInput; width: number; height: number }[];
  initialShapes?: Iterable<readonly [PageIdInput, readonly DrawShape[]]>;
  tool?: DrawTool;
  style?: ShapeStyle;
  readOnly?: boolean;
  history?: DocumentHistoryOptions;
  /** Development warnings (duplicate selectable ids, unknown selection ids). Default `console.warn`. */
  warn?: (message: string) => void;
  /** Clock in milliseconds (default `Date.now`); tests inject one. */
  now?: () => number;
}
