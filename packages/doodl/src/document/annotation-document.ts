/**
 * AnnotationDocument: the one owner of everything a person thinks of as "the
 * document" (core, no DOM).
 *
 * It holds every mark tagged with its page, the one selection, tool, style and
 * readOnly flag, the active page, the single gesture lock, one undo history,
 * the pending locate/ping queue and the events. Page views are thin: they draw
 * a page's marks, hit-test, and forward input here.
 */

import { getShapeBounds } from "../shapes/common/dispatch";
import type { DrawShape } from "../shapes/common/types/shape";
import { createPolygonShape } from "../shapes/polygon/types";
import type { DrawTool } from "../tools";
import { isDeletable, isSelectable, isTracked } from "../types/behavior";
import type { Bounds, Point } from "../types/geometry";
import { DEFAULT_SHAPE_STYLE, type ShapeStyle } from "../types/style";
import { runDocumentCommand } from "./document-commands";
import {
  DocumentHistory,
  deepEqual,
  patchPageIds,
} from "./document-history";
import { applyClick, makeSelection, SelectionModel } from "./document-selection";
import { GestureLock } from "./gesture-lock";
import {
  type AnnotationDocumentOptions,
  type ClickOptions,
  type ClickTarget,
  type DocShape,
  type DocumentCommand,
  type DocumentEventName,
  type DocumentEvents,
  type DocumentGesture,
  type DocumentPageView,
  type DocumentPingOptions,
  type DocumentSelection,
  type GestureCommitOptions,
  type GestureInfo,
  type GestureOptions,
  type DocumentHistoryState,
  type PageId,
  type PageIdInput,
  type PageInfo,
  type PageSize,
  type SelectMode,
  type SetPageShapesOptions,
  type ShapePatch,
  type ShapesChangeMeta,
  type TransactOptions,
  type Transaction,
  type TransactionBuilder,
  type TransactionPatch,
  toPageId,
} from "./types";

const EMPTY_SHAPES: readonly DocShape[] = Object.freeze([]);
const MAX_PENDING_PINGS_PER_PAGE = 20;

const DEFAULT_GESTURE_LABELS: Record<string, string> = {
  draw: "Draw",
  polygon: "Draw",
  move: "Move",
  resize: "Resize",
  vertex: "Edit",
};

function tag(shape: DrawShape, pageId: PageId): DocShape {
  return shape.pageId === pageId ? (shape as DocShape) : { ...shape, pageId };
}

const isTrackedPatch = (p: ShapePatch): boolean =>
  isTracked((p.after ?? p.before)?.behavior);

// =============================================================================
// STAGING (copy-on-write edits, turned into patches)
// =============================================================================

interface StagedFirst {
  pageId: PageId;
  id: string;
  before: DocShape | null;
  index: number;
}

/** Edits applied to copies of page lists; `finish()` yields the patches and changed pages. */
class Staging {
  private working = new Map<PageId, DocShape[]>();
  private first = new Map<string, StagedFirst>();

  constructor(
    private readonly read: (pageId: PageId) => readonly DocShape[],
    private readonly pageOfId: (id: string) => PageId | undefined
  ) {}

  private view(pageId: PageId): readonly DocShape[] {
    return this.working.get(pageId) ?? this.read(pageId);
  }

  private arr(pageId: PageId): DocShape[] {
    let a = this.working.get(pageId);
    if (!a) {
      a = [...this.read(pageId)];
      this.working.set(pageId, a);
    }
    return a;
  }

  private note(pageId: PageId, id: string, before: DocShape | null, index: number): void {
    const key = `${pageId}\u0000${id}`;
    if (!this.first.has(key)) this.first.set(key, { pageId, id, before, index });
  }

  find(id: string, hint?: PageId): { pageId: PageId; index: number } | null {
    if (hint !== undefined) {
      const i = this.view(hint).findIndex((s) => s.id === id);
      return i >= 0 ? { pageId: hint, index: i } : null;
    }
    for (const pid of this.working.keys()) {
      const i = this.view(pid).findIndex((s) => s.id === id);
      if (i >= 0) return { pageId: pid, index: i };
    }
    const pid = this.pageOfId(id);
    if (pid !== undefined && !this.working.has(pid)) {
      const i = this.view(pid).findIndex((s) => s.id === id);
      if (i >= 0) return { pageId: pid, index: i };
    }
    return null;
  }

  get(id: string): DocShape | undefined {
    const f = this.find(id);
    return f ? this.view(f.pageId)[f.index] : undefined;
  }

  add(pageId: PageId, shape: DrawShape): void {
    const existing = this.find(shape.id, pageId);
    if (existing) {
      this.update(shape, pageId);
      return;
    }
    const a = this.arr(pageId);
    this.note(pageId, shape.id, null, a.length);
    a.push(tag(shape, pageId));
  }

  update(shape: DrawShape, pageId?: PageId): boolean {
    const hint = pageId ?? shape.pageId;
    const found =
      (hint !== undefined ? this.find(shape.id, hint) : null) ??
      (pageId === undefined ? this.find(shape.id) : null);
    if (!found) return false;
    const existing = this.view(found.pageId)[found.index] as DocShape;
    const next = tag(shape, found.pageId);
    if (existing === next || deepEqual(existing, next)) return true;
    this.note(found.pageId, shape.id, existing, found.index);
    this.arr(found.pageId)[found.index] = next;
    return true;
  }

  remove(id: string, pageId?: PageId): boolean {
    const found = this.find(id, pageId);
    if (!found) return false;
    const existing = this.view(found.pageId)[found.index] as DocShape;
    this.note(found.pageId, id, existing, found.index);
    this.arr(found.pageId).splice(found.index, 1);
    return true;
  }

  /** Put the page's list in the given id order (ids not listed keep their relative order at the end). */
  setOrder(pageId: PageId, ids: readonly string[]): void {
    const cur = this.view(pageId);
    const byId = new Map(cur.map((s) => [s.id, s] as const));
    const next: DocShape[] = [];
    for (const id of ids) {
      const s = byId.get(id);
      if (s) {
        next.push(s);
        byId.delete(id);
      }
    }
    for (const s of byId.values()) next.push(s);
    if (next.length === cur.length && next.every((s, i) => s === cur[i])) return;
    this.working.set(pageId, next);
  }

  /** Apply one patch in a direction. Missing targets are skipped, never resurrected or clobbered. */
  restore(patch: ShapePatch, direction: "undo" | "redo"): void {
    const to = direction === "undo" ? patch.before : patch.after;
    const from = direction === "undo" ? patch.after : patch.before;
    const found = this.find(patch.id, patch.pageId);
    if (to === null) {
      if (found && from !== null) this.remove(patch.id, patch.pageId);
    } else if (from === null) {
      if (!found) {
        const a = this.arr(patch.pageId);
        const i = Math.min(Math.max(patch.index, 0), a.length);
        this.note(patch.pageId, patch.id, null, i);
        a.splice(i, 0, to);
      }
    } else if (found) {
      const existing = this.view(found.pageId)[found.index] as DocShape;
      if (!deepEqual(existing, to)) {
        this.note(found.pageId, patch.id, existing, found.index);
        this.arr(found.pageId)[found.index] = to;
      }
    }
  }

  finish(): { patches: ShapePatch[]; pages: Map<PageId, DocShape[]> } {
    const patches: ShapePatch[] = [];
    for (const e of this.first.values()) {
      const list = this.working.get(e.pageId) ?? this.read(e.pageId);
      const idx = list.findIndex((s) => s.id === e.id);
      const after = idx >= 0 ? (list[idx] as DocShape) : null;
      if (e.before === null && after === null) continue;
      if (e.before && after && (e.before === after || deepEqual(e.before, after))) continue;
      patches.push({
        pageId: e.pageId,
        id: e.id,
        before: e.before,
        after,
        index: e.before ? e.index : idx,
      });
    }
    const pages = new Map<PageId, DocShape[]>();
    for (const [pid, a] of this.working) {
      const orig = this.read(pid);
      if (a.length !== orig.length || a.some((s, i) => s !== orig[i])) pages.set(pid, a);
    }
    return { patches, pages };
  }
}

/** The builder handed to `transact`. */
class TxBuilder implements TransactionBuilder {
  selection: SelectionModel | null = null;

  constructor(
    readonly staging: Staging,
    private readonly currentSelection: () => string[]
  ) {}

  add(pageId: PageIdInput, shape: DrawShape): void {
    this.staging.add(toPageId(pageId), shape);
  }

  update(shape: DrawShape): boolean {
    return this.staging.update(shape);
  }

  remove(id: string): boolean {
    return this.staging.remove(id);
  }

  get(id: string): DocShape | undefined {
    return this.staging.get(id);
  }

  select(ids: readonly string[], mode: SelectMode = "replace"): void {
    this.selection ??= new SelectionModel(this.currentSelection());
    this.selection.apply(ids, mode);
  }
}

// =============================================================================
// GESTURE SESSION
// =============================================================================

interface GestureHooks {
  preview(g: GestureSession): void;
  cancel(g: GestureSession): void;
  commit(
    g: GestureSession,
    shapes: readonly DocShape[],
    options: GestureCommitOptions
  ): Transaction | null;
  style(): ShapeStyle;
}

class GestureSession implements DocumentGesture {
  readonly id: number;
  readonly pageId: PageId;
  readonly pointerId: number | null;
  readonly kind: string;
  readonly multiClick: boolean;
  private _active = true;
  private _points: Point[] = [];
  private _shapes: DocShape[] = [];

  constructor(info: GestureInfo, private readonly hooks: GestureHooks) {
    this.id = info.id;
    this.pageId = info.pageId;
    this.pointerId = info.pointerId;
    this.kind = info.kind;
    this.multiClick = info.multiClick;
  }

  get active(): boolean {
    return this._active;
  }

  get points(): readonly Point[] {
    return this._points;
  }

  get shapes(): readonly DocShape[] {
    return this._shapes;
  }

  setPreview(shapes: readonly DrawShape[]): void {
    if (!this._active) return;
    this._shapes = shapes.map((s) => tag(s, this.pageId));
    this.hooks.preview(this);
  }

  addPoint(point: Point): void {
    if (!this._active) return;
    this._points.push({ x: point.x, y: point.y });
  }

  commit(options: GestureCommitOptions = {}): Transaction | null {
    if (!this._active) return null;
    let shapes: readonly DocShape[] = this._shapes;
    if (this.kind === "polygon") {
      // A polygon is always decided from the clicks, never from the preview: the
      // preview may carry a rubber-band cursor vertex. Fewer than 3 clicks drop it;
      // with 3 or more the shape is built from the clicks, keeping the preview's
      // id and style when a preview was set.
      if (this._points.length < 3) {
        this.cancel();
        return null;
      }
      const preview = this._shapes[0];
      const built = createPolygonShape(
        this._points,
        preview ? { ...preview.style } : { ...this.hooks.style() }
      );
      if (preview) built.id = preview.id;
      shapes = [tag(built, this.pageId)];
    }
    this._active = false;
    return this.hooks.commit(this, shapes, options);
  }

  cancel(): void {
    if (!this._active) return;
    this._active = false;
    this.hooks.cancel(this);
  }

  /** @internal marks the session over (document side already released the lock). */
  _deactivate(): void {
    this._active = false;
  }
}

// =============================================================================
// DOCUMENT
// =============================================================================

type Listener = (...args: never[]) => void;

export class AnnotationDocument {
  private readonly pages = new Map<PageId, PageInfo>();
  private readonly store = new Map<PageId, readonly DocShape[]>();
  private readonly versions = new Map<PageId, number>();
  private readonly selection = new SelectionModel();
  private readonly lock = new GestureLock();
  private readonly listeners = new Map<DocumentEventName, Set<Listener>>();
  private readonly views = new Map<PageId, Set<DocumentPageView>>();
  private readonly pendingPings = new Map<
    PageId,
    { id: string; options?: DocumentPingOptions }[]
  >();
  private readonly warned = new Set<string>();
  private readonly warnFn: (message: string) => void;
  private readonly now: () => number;

  readonly history: DocumentHistory;

  private _tool: DrawTool;
  private _style: ShapeStyle;
  private _readOnly: boolean;
  private _active: PageId | null = null;
  private session: GestureSession | null = null;
  private idIndex: Map<string, { pageId: PageId; selectable: boolean }> | null = null;
  private txCounter = 0;
  private builder: TxBuilder | null = null;

  constructor(options: AnnotationDocumentOptions = {}) {
    this._tool = options.tool ?? "select";
    this._style = options.style ?? DEFAULT_SHAPE_STYLE;
    this._readOnly = options.readOnly ?? false;
    this.history = new DocumentHistory(options.history);
    this.now = options.now ?? Date.now;
    this.warnFn =
      options.warn ??
      ((m) => {
        if (typeof process !== "undefined" && process.env?.NODE_ENV === "production") return;
        console.warn(`[doodl] ${m}`);
      });
    for (const p of options.pages ?? []) this.definePage(p.id, p);
    if (options.initialShapes) {
      for (const [pageId, shapes] of options.initialShapes) {
        this.setPageShapes(pageId, shapes, { origin: "init" });
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Events
  // ---------------------------------------------------------------------------

  on<K extends DocumentEventName>(event: K, handler: DocumentEvents[K]): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(handler as unknown as Listener);
    return () => this.off(event, handler);
  }

  off<K extends DocumentEventName>(event: K, handler: DocumentEvents[K]): void {
    this.listeners.get(event)?.delete(handler as unknown as Listener);
  }

  private emit<K extends DocumentEventName>(
    event: K,
    ...args: Parameters<DocumentEvents[K]>
  ): void {
    const set = this.listeners.get(event);
    if (!set || set.size === 0) return;
    let firstError: unknown;
    let failed = false;
    for (const fn of [...set]) {
      try {
        (fn as (...a: unknown[]) => void)(...args);
      } catch (error) {
        if (!failed) {
          failed = true;
          firstError = error;
        }
      }
    }
    if (failed) throw firstError;
  }

  private warn(key: string, message: string): void {
    if (this.warned.has(key)) return;
    this.warned.add(key);
    this.warnFn(message);
  }

  // ---------------------------------------------------------------------------
  // Pages
  // ---------------------------------------------------------------------------

  /** Register a page (or update its size). The first page becomes the active page. */
  definePage(id: PageIdInput, size: PageSize): void {
    const pageId = toPageId(id);
    this.pages.set(pageId, { id: pageId, width: size.width, height: size.height });
    if (this._active === null) this.setActivePage(pageId);
  }

  /**
   * Unregister a page. Its marks and the history stay (so re-registering the page
   * restores everything) unless `discardShapes` is set, which empties the page as a
   * host sync (no history) and forgets it.
   */
  removePage(id: PageIdInput, options: { discardShapes?: boolean } = {}): void {
    const pageId = toPageId(id);
    this.pages.delete(pageId);
    if (options.discardShapes) {
      this.setPageShapes(pageId, [], { origin: "host" });
      this.store.delete(pageId);
      this.versions.delete(pageId);
      this.pendingPings.delete(pageId);
      this.idIndex = null;
    }
    if (this._active === pageId) {
      const next = this.pages.keys().next();
      this.setActivePage(next.done ? null : next.value);
    }
  }

  getPageInfo(id: PageIdInput): PageInfo | undefined {
    return this.pages.get(toPageId(id));
  }

  /** Registered page ids, in registration order. */
  getPageIds(): PageId[] {
    return [...this.pages.keys()];
  }

  // ---------------------------------------------------------------------------
  // Shapes (read)
  // ---------------------------------------------------------------------------

  /** The page's marks. The array is replaced, never mutated, on every change. */
  getPageShapes(id: PageIdInput): readonly DocShape[] {
    return this.store.get(toPageId(id)) ?? EMPTY_SHAPES;
  }

  /** Bumps whenever the page's list is replaced. */
  getPageVersion(id: PageIdInput): number {
    return this.versions.get(toPageId(id)) ?? 0;
  }

  getAllShapes(): DocShape[] {
    const all: DocShape[] = [];
    for (const list of this.store.values()) all.push(...list);
    return all;
  }

  getShape(id: string): DocShape | undefined {
    const pid = this.pageOf(id);
    return pid === undefined ? undefined : this.getPageShapes(pid).find((s) => s.id === id);
  }

  /** The page a mark is on. */
  pageOf(id: string): PageId | undefined {
    return this.index().get(id)?.pageId;
  }

  private index(): Map<string, { pageId: PageId; selectable: boolean }> {
    if (this.idIndex) return this.idIndex;
    const idx = new Map<string, { pageId: PageId; selectable: boolean }>();
    for (const [pageId, list] of this.store) {
      for (const s of list) {
        const selectable = isSelectable(s.behavior);
        const existing = idx.get(s.id);
        if (!existing) {
          idx.set(s.id, { pageId, selectable });
        } else if (existing.pageId !== pageId) {
          if (selectable && existing.selectable) {
            this.warn(
              `dup:${s.id}`,
              `duplicate selectable shape id "${s.id}" on pages ${existing.pageId} and ${pageId}; ids must be unique per document`
            );
          } else if (selectable && !existing.selectable) {
            idx.set(s.id, { pageId, selectable });
          }
        }
      }
    }
    this.idIndex = idx;
    return idx;
  }

  private filterSelectable(ids: readonly string[], warnUnknown = false): string[] {
    const idx = this.index();
    const out: string[] = [];
    for (const id of ids) {
      const e = idx.get(id);
      if (e?.selectable) {
        if (!out.includes(id)) out.push(id);
      } else if (warnUnknown) {
        this.warn(`sel:${id}`, `select(): "${id}" is not a selectable mark in this document; dropped`);
      }
    }
    return out;
  }

  // ---------------------------------------------------------------------------
  // Tool, style, readOnly, active page
  // ---------------------------------------------------------------------------

  get tool(): DrawTool {
    return this._tool;
  }

  setTool(tool: DrawTool): void {
    if (tool === this._tool) return;
    // Changing tool finishes an open polygon (3+ points) or drops it.
    if (this.session?.multiClick) this.session.commit();
    this._tool = tool;
    this.emit("toolChange", tool);
  }

  get style(): ShapeStyle {
    return this._style;
  }

  setStyle(style: ShapeStyle): void {
    if (style === this._style) return;
    this._style = style;
    this.emit("styleChange", style);
  }

  get readOnly(): boolean {
    return this._readOnly;
  }

  setReadOnly(readOnly: boolean): void {
    if (readOnly === this._readOnly) return;
    this._readOnly = readOnly;
    if (readOnly) this.session?.cancel();
    this.emit("readOnlyChange", readOnly);
  }

  /**
   * The page the person works on: the page of the last pointerdown, else the page
   * of the selection (when a mark is selected programmatically), else set by the host.
   * The first registered page is active until something else is.
   */
  get activePageId(): PageId | null {
    return this._active;
  }

  setActivePage(id: PageIdInput | null): void {
    const next = id === null ? null : toPageId(id);
    if (next === this._active) return;
    this._active = next;
    this.emit("activePageChange", next);
  }

  // ---------------------------------------------------------------------------
  // Selection
  // ---------------------------------------------------------------------------

  getSelection(): DocumentSelection {
    return makeSelection(this.selection.ids(), (id) => this.pageOf(id));
  }

  isSelected(id: string): boolean {
    return this.selection.has(id);
  }

  /**
   * Select marks. Ids not in the document (or not selectable) are dropped with a
   * development warning. Marks may be on unmounted pages. A non-empty result makes
   * the page of its last mark the active page (unless `keepActive`).
   */
  select(
    ids: readonly string[],
    options: { mode?: SelectMode; origin?: string; keepActive?: boolean } = {}
  ): void {
    const valid = this.filterSelectable(ids, true);
    const before = this.selection.ids();
    const changed = this.selection.apply(valid, options.mode ?? "replace");
    if (changed) this.emitSelection(before, options.origin ?? "host");
    const last = valid[valid.length - 1];
    if (last !== undefined && !options.keepActive) {
      const pid = this.pageOf(last);
      if (pid !== undefined) this.setActivePage(pid);
    }
  }

  clearSelection(origin = "host"): boolean {
    const before = this.selection.ids();
    if (!this.selection.clear()) return false;
    this.emitSelection(before, origin);
    return true;
  }

  /** Select every selectable mark on a page (default: the active page). */
  selectAll(options: { pageId?: PageIdInput; origin?: string } = {}): boolean {
    const pid = options.pageId !== undefined ? toPageId(options.pageId) : this._active;
    if (pid === null) return false;
    const ids = this.getPageShapes(pid)
      .filter((s) => isSelectable(s.behavior))
      .map((s) => s.id);
    if (ids.length === 0) return false;
    const before = this.selection.ids();
    const changed = this.selection.replace(ids);
    if (changed) this.emitSelection(before, options.origin ?? "user");
    return changed;
  }

  /**
   * Apply a pointer press to the selection (rules 2 to 4) and make its page active.
   * Returns true when the selection changed.
   */
  click(target: ClickTarget, options: ClickOptions = {}): boolean {
    let pageId: PageId | undefined;
    if (target.kind === "shape") {
      const e = this.index().get(target.id);
      if (!e?.selectable) return false;
      pageId = e.pageId;
    } else if (target.kind === "paper") {
      pageId = toPageId(target.pageId);
    }
    const before = this.selection.ids();
    const changed = applyClick(this.selection, target, options);
    if (changed) this.emitSelection(before, "user");
    if (pageId !== undefined) this.setActivePage(pageId);
    return changed;
  }

  private emitSelection(before: string[], origin: string): void {
    const sel = this.getSelection();
    this.emit("selectionChange", { ...sel, origin });
    this.invalidate(this.pagesOfIdDiff(before, sel.ids));
  }

  private pagesOfIdDiff(a: readonly string[], b: readonly string[]): PageId[] {
    const sa = new Set(a);
    const sb = new Set(b);
    const pages = new Set<PageId>();
    for (const id of sa) if (!sb.has(id)) this.addPage(pages, id);
    for (const id of sb) if (!sa.has(id)) this.addPage(pages, id);
    return [...pages];
  }

  private addPage(into: Set<PageId>, id: string): void {
    const pid = this.pageOf(id);
    if (pid !== undefined) into.add(pid);
  }

  // ---------------------------------------------------------------------------
  // Mutations
  // ---------------------------------------------------------------------------

  /**
   * Run edits as one transaction: one history entry, one `shapesChange` per page
   * and one `change` event, even across pages. Returns the transaction, or null
   * when nothing changed or the document is read-only (host origin is exempt).
   * Throwing inside `fn` discards the edits.
   */
  transact(
    label: string,
    fn: (tx: TransactionBuilder) => void,
    options: TransactOptions = {}
  ): Transaction | null {
    const origin = options.origin ?? "user";
    if (this.builder) {
      fn(this.builder);
      return null;
    }
    if (this._readOnly && origin !== "host") return null;
    const builder = this.newBuilder();
    this.builder = builder;
    try {
      fn(builder);
    } finally {
      this.builder = null;
    }
    return this.runStaged(builder.staging, {
      label,
      origin,
      record: options.history !== false,
      assignId: true,
      coalesceKey: options.coalesceKey,
      selection: builder.selection?.ids(),
    }).tx;
  }

  /**
   * Host sync of one page's marks. Records no history by default, keeps the
   * selection for ids that still exist, and does nothing (no event) when the list
   * is structurally the same. Marks keep their identity when unchanged.
   * Allowed in read-only documents.
   */
  setPageShapes(
    id: PageIdInput,
    shapes: readonly DrawShape[],
    options: SetPageShapesOptions = {}
  ): boolean {
    const pid = toPageId(id);
    const staging = this.newStaging();
    const order: string[] = [];
    const seen = new Set<string>();
    for (const s of shapes) {
      if (seen.has(s.id)) {
        this.warn(`dupsync:${pid}:${s.id}`, `setPageShapes(${pid}): duplicate id "${s.id}" ignored`);
        continue;
      }
      seen.add(s.id);
      order.push(s.id);
      if (staging.find(s.id, pid)) staging.update(s, pid);
      else staging.add(pid, s);
    }
    for (const existing of this.getPageShapes(pid)) {
      if (!seen.has(existing.id)) staging.remove(existing.id, pid);
    }
    staging.setOrder(pid, order);
    const record = options.history === true;
    return this.runStaged(staging, {
      label: "Sync",
      origin: options.origin ?? "host",
      record,
      assignId: record,
    }).changed;
  }

  /** Remove the selected marks that may be deleted, across pages, as one transaction. */
  deleteSelected(): boolean {
    if (this._readOnly || this.session) return false;
    const ids = this.selection.ids();
    if (ids.length === 0) return false;
    const tx = this.transact(
      "Delete",
      (b) => {
        for (const id of ids) {
          const s = b.get(id);
          if (s && isDeletable(s.behavior)) b.remove(id);
        }
      },
      { origin: "user" }
    );
    return tx !== null;
  }

  /**
   * Attach derived changes to the latest history entry (for example linked search
   * highlights for a new mark), so one undo removes both and one redo restores both.
   * Refused (false) for any id that is not the latest entry, including one already
   * undone. Amended patches bypass the tracked-only filter. Emits one `shapesChange`
   * per touched page carrying the same transaction id.
   */
  amendTransaction(
    transactionId: number,
    patch: TransactionPatch | ((tx: TransactionBuilder) => void)
  ): boolean {
    const top = this.history.topUndo();
    if (!top || top.id !== transactionId) return false;
    const builder = this.newBuilder();
    if (typeof patch === "function") {
      patch(builder);
    } else {
      for (const a of patch.add ?? []) builder.add(a.pageId, a.shape);
      for (const s of patch.update ?? []) builder.update(s);
      for (const rid of patch.remove ?? []) builder.remove(rid);
    }
    const selectionBefore = this.selection.ids();
    const { patches, pages } = builder.staging.finish();
    if (pages.size === 0) return true;
    this.applyPages(pages);
    const selChanged = this.selection.replace(
      this.filterSelectable(builder.selection?.ids() ?? selectionBefore)
    );
    this.history.amendLatest(transactionId, patches, this.selection.ids());
    this.flush({
      pageIds: [...pages.keys()],
      origin: "host",
      label: top.label,
      transactionId,
      selectionBefore: selChanged ? selectionBefore : null,
      historyChanged: true,
    });
    return true;
  }

  private newStaging(): Staging {
    return new Staging(
      (pid) => this.store.get(pid) ?? EMPTY_SHAPES,
      (id) => this.pageOf(id)
    );
  }

  private newBuilder(): TxBuilder {
    return new TxBuilder(this.newStaging(), () => this.selection.ids());
  }

  private applyPages(pages: Map<PageId, DocShape[]>): void {
    for (const [pid, list] of pages) {
      this.store.set(pid, list);
      this.versions.set(pid, (this.versions.get(pid) ?? 0) + 1);
    }
    if (pages.size > 0) this.idIndex = null;
  }

  private runStaged(
    staging: Staging,
    o: {
      label: string;
      origin: string;
      record: boolean;
      assignId: boolean;
      coalesceKey?: string;
      selection?: string[];
    }
  ): { tx: Transaction | null; changed: boolean } {
    const { patches, pages } = staging.finish();
    const selectionBefore = this.selection.ids();
    if (pages.size === 0 && o.selection === undefined) return { tx: null, changed: false };
    this.applyPages(pages);
    const wanted = o.selection ?? selectionBefore;
    const selChanged = this.selection.replace(this.filterSelectable(wanted));
    const selectionAfter = this.selection.ids();

    let tx: Transaction | null = null;
    let historyChanged = false;
    if (patches.length > 0 && (o.assignId || o.record)) {
      tx = {
        id: ++this.txCounter,
        label: o.label,
        patches,
        selectionBefore,
        selectionAfter,
        pageIds: patchPageIds(patches),
        origin: o.origin,
        time: this.now(),
        coalesceKey: o.coalesceKey,
      };
      if (o.record) {
        const tracked = patches.filter(isTrackedPatch);
        if (tracked.length > 0) {
          this.history.record({ ...tx, patches: tracked, pageIds: patchPageIds(tracked) });
          historyChanged = true;
        }
      }
    }
    this.flush({
      pageIds: [...pages.keys()],
      origin: o.origin,
      label: o.label,
      transactionId: tx?.id ?? null,
      selectionBefore: selChanged ? selectionBefore : null,
      historyChanged,
    });
    return { tx, changed: pages.size > 0 || selChanged };
  }

  /** Emit the events of one commit: shapesChange per page, change once, selection, history. */
  private flush(a: {
    pageIds: PageId[];
    origin: string;
    label: string | null;
    transactionId: number | null;
    selectionBefore: string[] | null;
    historyChanged: boolean;
  }): void {
    const meta: ShapesChangeMeta = {
      origin: a.origin,
      label: a.label,
      transactionId: a.transactionId,
    };
    const touched = new Set(a.pageIds);
    let selectionPages: PageId[] = [];
    if (a.selectionBefore) {
      selectionPages = this.pagesOfIdDiff(a.selectionBefore, this.selection.ids());
      for (const p of selectionPages) touched.add(p);
    }
    this.invalidate([...touched]);
    for (const pid of a.pageIds) {
      this.emit("shapesChange", pid, this.getPageShapes(pid), meta);
    }
    if (a.pageIds.length > 0) {
      this.emit("change", {
        pageIds: a.pageIds,
        origin: a.origin,
        transactionId: a.transactionId,
      });
    }
    if (a.selectionBefore) {
      const sel = this.getSelection();
      this.emit("selectionChange", { ...sel, origin: a.origin });
    }
    if (a.historyChanged) this.emit("historyChange", this.historyState());
  }

  // ---------------------------------------------------------------------------
  // History
  // ---------------------------------------------------------------------------

  historyState(): DocumentHistoryState {
    return this.history.state(
      this.history.mode === "per-page" ? (this._active ?? undefined) : undefined
    );
  }

  canUndo(pageId?: PageIdInput): boolean {
    return this.history.canUndo(this.historyPage(pageId));
  }

  canRedo(pageId?: PageIdInput): boolean {
    return this.history.canRedo(this.historyPage(pageId));
  }

  /**
   * Revert the latest history entry (any page). In per-page mode, the latest entry
   * touching `pageId` (default: the active page); the whole entry is reverted.
   * Refused while a gesture is running or in a read-only document.
   */
  undo(pageId?: PageIdInput): boolean {
    return this.applyHistory("undo", pageId);
  }

  redo(pageId?: PageIdInput): boolean {
    return this.applyHistory("redo", pageId);
  }

  clearHistory(): void {
    if (this.history.clear()) this.emit("historyChange", this.historyState());
  }

  private historyPage(pageId?: PageIdInput): PageId | undefined {
    if (this.history.mode !== "per-page") return undefined;
    return pageId !== undefined ? toPageId(pageId) : (this._active ?? undefined);
  }

  private applyHistory(kind: "undo" | "redo", pageId?: PageIdInput): boolean {
    if (this._readOnly || this.session) return false;
    const pid = this.historyPage(pageId);
    const tx = kind === "undo" ? this.history.takeUndo(pid) : this.history.takeRedo(pid);
    if (!tx) return false;

    const staging = this.newStaging();
    const patches = kind === "undo" ? [...tx.patches].reverse() : tx.patches;
    for (const p of patches) staging.restore(p, kind);
    const { pages } = staging.finish();

    const selectionBefore = this.selection.ids();
    this.applyPages(pages);
    const selChanged = this.selection.replace(
      this.filterSelectable(kind === "undo" ? tx.selectionBefore : tx.selectionAfter)
    );
    if (kind === "undo") this.history.pushRedo(tx);
    else this.history.pushUndo(tx);

    const pageIds = [...pages.keys()];
    this.flush({
      pageIds,
      origin: kind,
      label: tx.label,
      transactionId: tx.id,
      selectionBefore: selChanged ? selectionBefore : null,
      historyChanged: true,
    });
    this.emit("historyApplied", { kind, label: tx.label, transactionId: tx.id, pageIds });
    return true;
  }

  // ---------------------------------------------------------------------------
  // Gestures
  // ---------------------------------------------------------------------------

  /** The gesture in progress, if any. */
  get gesture(): DocumentGesture | null {
    return this.session;
  }

  /**
   * Start a gesture on a page. Refused (null) while another gesture runs, with one
   * exception: an open multi-click gesture (polygon) on another page is finished
   * first (3+ points) or dropped, then the new gesture starts (Q12).
   */
  beginGesture(pageId: PageIdInput, options: GestureOptions = {}): DocumentGesture | null {
    const pid = toPageId(pageId);
    const open = this.session;
    if (open && open.multiClick && open.pageId !== pid) open.commit();
    const info = this.lock.tryBegin(pid, options);
    if (!info) return null;
    const session = new GestureSession(info, {
      preview: (g) => this.emitPreview(g),
      cancel: (g) => this.endGesture(g),
      commit: (g, shapes, o) => this.commitGesture(g, shapes, o),
      style: () => this._style,
    });
    this.session = session;
    this.emit("gestureChange", { ...info });
    return session;
  }

  private emitPreview(g: GestureSession): void {
    this.emit("gesturePreview", {
      gestureId: g.id,
      pageId: g.pageId,
      kind: g.kind,
      shapes: g.shapes,
    });
    this.invalidate([g.pageId]);
  }

  private endGesture(g: GestureSession): void {
    if (this.session !== g) return;
    const hadPreview = g.shapes.length > 0;
    g._deactivate();
    this.lock.release(g.id);
    this.session = null;
    if (hadPreview) {
      this.emit("gesturePreview", {
        gestureId: g.id,
        pageId: g.pageId,
        kind: g.kind,
        shapes: EMPTY_SHAPES,
      });
    }
    this.emit("gestureChange", null);
    this.invalidate([g.pageId]);
  }

  private commitGesture(
    g: GestureSession,
    shapes: readonly DocShape[],
    options: GestureCommitOptions
  ): Transaction | null {
    this.endGesture(g);
    if (this._readOnly || shapes.length === 0) return null;
    const label = options.label ?? DEFAULT_GESTURE_LABELS[g.kind] ?? capitalise(g.kind);
    return this.transact(
      label,
      (tx) => {
        const added: string[] = [];
        for (const s of shapes) {
          if (tx.get(s.id)) {
            tx.update(s);
          } else {
            tx.add(g.pageId, s);
            added.push(s.id);
          }
        }
        const select = options.select ?? "new";
        if (select === "new") {
          if (added.length > 0) tx.select(added, "replace");
        } else if (select !== "keep") {
          tx.select(select, "replace");
        }
      },
      { origin: "user" }
    );
  }

  // ---------------------------------------------------------------------------
  // Views, locate and ping
  // ---------------------------------------------------------------------------

  /**
   * Attach a page view. Attaching and detaching never changes state or history.
   * A queued ping for the page is delivered on attach. Returns the detach function.
   */
  attachView(pageId: PageIdInput, view: DocumentPageView): () => void {
    const pid = toPageId(pageId);
    let set = this.views.get(pid);
    if (!set) {
      set = new Set();
      this.views.set(pid, set);
    }
    set.add(view);
    const queue = this.pendingPings.get(pid);
    if (queue && view.ping) {
      this.pendingPings.delete(pid);
      for (const p of queue) {
        if (this.pageOf(p.id) === pid) view.ping(p.id, p.options);
      }
    }
    view.invalidate?.();
    return () => {
      const s = this.views.get(pid);
      s?.delete(view);
      if (s && s.size === 0) this.views.delete(pid);
    };
  }

  /** Number of views attached to a page. */
  viewCount(pageId: PageIdInput): number {
    return this.views.get(toPageId(pageId))?.size ?? 0;
  }

  private invalidate(pageIds: readonly PageId[]): void {
    for (const pid of pageIds) {
      const set = this.views.get(pid);
      if (!set) continue;
      for (const v of [...set]) v.invalidate?.();
    }
  }

  /**
   * Ask the host to bring a mark into view: emits `locate { id, pageId, bounds }`,
   * optionally selects it and pings it. A ping for a page with no view yet is queued
   * and played when a view attaches. Returns false for an unknown id.
   */
  locate(
    id: string,
    options: { ping?: boolean | DocumentPingOptions; select?: boolean } = {}
  ): boolean {
    const pid = this.pageOf(id);
    if (pid === undefined) {
      this.warn(`loc:${id}`, `locate(): "${id}" is not in this document`);
      return false;
    }
    if (options.select) this.select([id], { origin: "host" });
    else this.setActivePage(pid);
    const shape = this.getShape(id);
    let bounds: Bounds | null = null;
    if (shape) {
      try {
        bounds = getShapeBounds(shape);
      } catch {
        bounds = null;
      }
    }
    this.emit("locate", { id, pageId: pid, bounds, ping: !!options.ping });
    if (options.ping) {
      this.ping(id, typeof options.ping === "object" ? options.ping : undefined);
    }
    return true;
  }

  /** Ping a mark, now if a view of its page is attached, else when one attaches. */
  ping(id: string, options?: DocumentPingOptions): boolean {
    const pid = this.pageOf(id);
    if (pid === undefined) return false;
    const targets = [...(this.views.get(pid) ?? [])].filter((v) => v.ping);
    if (targets.length > 0) {
      for (const v of targets) v.ping?.(id, options);
      return true;
    }
    const queue = this.pendingPings.get(pid) ?? [];
    const next = queue.filter((p) => p.id !== id);
    next.push({ id, options });
    if (next.length > MAX_PENDING_PINGS_PER_PAGE) next.shift();
    this.pendingPings.set(pid, next);
    return true;
  }

  /** Pings waiting for a view (for tests and diagnostics). */
  pendingPingIds(pageId: PageIdInput): string[] {
    return (this.pendingPings.get(toPageId(pageId)) ?? []).map((p) => p.id);
  }

  // ---------------------------------------------------------------------------
  // Commands
  // ---------------------------------------------------------------------------

  /**
   * Run a command: `"delete"`, `"undo"`, `"redo"`, `"escape"`, `"selectAll"`,
   * `{ nudge: [dx, dy] }`. Returns true when the command did something (so a key
   * binder knows to swallow the key); false leaves it to the host.
   */
  command(command: DocumentCommand): boolean {
    return runDocumentCommand(this, command);
  }

  // ---------------------------------------------------------------------------
  // Convenience for the host
  // ---------------------------------------------------------------------------

  /** Marks of the selection on one page. */
  getSelectedOnPage(pageId: PageIdInput): DocShape[] {
    const pid = toPageId(pageId);
    return this.getPageShapes(pid).filter((s) => this.selection.has(s.id));
  }
}

function capitalise(s: string): string {
  return s.length === 0 ? s : s[0]?.toUpperCase() + s.slice(1);
}

/** Create a document. */
export function createAnnotationDocument(
  options: AnnotationDocumentOptions = {}
): AnnotationDocument {
  return new AnnotationDocument(options);
}
