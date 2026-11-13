/**
 * Document history: one ordered stack of transactions for the whole document.
 *
 * A transaction is one user action (a gesture, a command, a nudge burst, a
 * programmatic `transact`), even across pages. History lives in the document,
 * so page views mounting, unmounting, zooming or being pooled cannot lose it.
 */

import type {
  DocumentHistoryOptions,
  DocumentHistoryMode,
  DocumentHistoryState,
  PageId,
  ShapePatch,
  Transaction,
} from "./types";

export const DEFAULT_MAX_HISTORY_ENTRIES = 100;
export const DEFAULT_COALESCE_MS = 800;

/** Structural equality for plain data (shapes). */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) {
    return Number.isNaN(a) && Number.isNaN(b);
  }
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!deepEqual(a[i], b[i])) return false;
    return true;
  }
  if (Array.isArray(b)) return false;
  const ao = a as Record<string, unknown>;
  const bo = b as Record<string, unknown>;
  const ak = Object.keys(ao).filter((k) => ao[k] !== undefined);
  const bk = Object.keys(bo).filter((k) => bo[k] !== undefined);
  if (ak.length !== bk.length) return false;
  for (const k of ak) {
    if (!deepEqual(ao[k], bo[k])) return false;
  }
  return true;
}

const patchKey = (p: Pick<ShapePatch, "pageId" | "id">): string =>
  `${p.pageId}\u0000${p.id}`;

/** Pages touched by patches, in first-seen order. */
export function patchPageIds(patches: readonly ShapePatch[]): PageId[] {
  return [...new Set(patches.map((p) => p.pageId))];
}

/**
 * Merge a later list of patches into an earlier one: per shape, the first
 * `before` and the last `after`. Patches that cancel out are dropped.
 */
export function mergePatches(
  base: readonly ShapePatch[],
  extra: readonly ShapePatch[]
): ShapePatch[] {
  const merged = new Map<string, ShapePatch>();
  for (const p of base) merged.set(patchKey(p), p);
  for (const p of extra) {
    const key = patchKey(p);
    const existing = merged.get(key);
    merged.set(key, existing ? { ...existing, after: p.after } : p);
  }
  return [...merged.values()].filter(
    (p) =>
      !(p.before === null && p.after === null) &&
      !(p.before && p.after && deepEqual(p.before, p.after))
  );
}

export class DocumentHistory {
  readonly mode: DocumentHistoryMode;
  readonly maxEntries: number;
  readonly coalesceMs: number;

  private undoStack: Transaction[] = [];
  private redoStack: Transaction[] = [];
  /** Id of the entry recorded last, while nothing else touched the stacks. */
  private lastRecordedId: number | null = null;

  constructor(options: DocumentHistoryOptions = {}) {
    this.mode = options.mode ?? "document";
    this.maxEntries = Math.max(1, Math.floor(options.maxEntries ?? DEFAULT_MAX_HISTORY_ENTRIES));
    this.coalesceMs = options.coalesceMs ?? DEFAULT_COALESCE_MS;
  }

  get undoCount(): number {
    return this.undoStack.length;
  }

  get redoCount(): number {
    return this.redoStack.length;
  }

  /**
   * Record a new entry. Clears redo. An entry with the same `coalesceKey` as the
   * one just recorded, within the coalesce window, merges into it (the merged
   * entry takes the newer id). Returns the stored entry.
   */
  record(tx: Transaction): Transaction {
    this.redoStack = [];
    const top = this.undoStack[this.undoStack.length - 1];
    if (
      top &&
      tx.coalesceKey !== undefined &&
      top.coalesceKey === tx.coalesceKey &&
      this.lastRecordedId === top.id &&
      tx.time - top.time <= this.coalesceMs
    ) {
      const patches = mergePatches(top.patches, tx.patches);
      this.undoStack.pop();
      if (patches.length === 0) {
        this.lastRecordedId = null;
        return { ...tx, patches };
      }
      const merged: Transaction = {
        ...top,
        id: tx.id,
        patches,
        pageIds: patchPageIds(patches),
        selectionAfter: tx.selectionAfter,
        time: tx.time,
      };
      this.undoStack.push(merged);
      this.lastRecordedId = merged.id;
      return merged;
    }
    this.undoStack.push(tx);
    this.lastRecordedId = tx.id;
    if (this.undoStack.length > this.maxEntries) {
      this.undoStack.splice(0, this.undoStack.length - this.maxEntries);
    }
    return tx;
  }

  /** The latest undo entry. */
  topUndo(): Transaction | null {
    return this.undoStack[this.undoStack.length - 1] ?? null;
  }

  /**
   * Add patches to the latest entry, if it is `id`. Refused (false) for any other
   * id, including an entry already undone.
   */
  amendLatest(
    id: number,
    patches: readonly ShapePatch[],
    selectionAfter?: string[]
  ): boolean {
    const top = this.topUndo();
    if (!top || top.id !== id) return false;
    const merged = mergePatches(top.patches, patches);
    this.undoStack[this.undoStack.length - 1] = {
      ...top,
      patches: merged,
      pageIds: patchPageIds(merged),
      selectionAfter: selectionAfter ?? top.selectionAfter,
    };
    return true;
  }

  peekUndo(pageId?: PageId): Transaction | null {
    const i = this.indexFor(this.undoStack, pageId);
    return i < 0 ? null : (this.undoStack[i] ?? null);
  }

  peekRedo(pageId?: PageId): Transaction | null {
    const i = this.indexFor(this.redoStack, pageId);
    return i < 0 ? null : (this.redoStack[i] ?? null);
  }

  /** Remove and return the entry to undo (latest; in per-page mode the latest touching `pageId`). */
  takeUndo(pageId?: PageId): Transaction | null {
    const i = this.indexFor(this.undoStack, pageId);
    if (i < 0) return null;
    this.lastRecordedId = null;
    return this.undoStack.splice(i, 1)[0] ?? null;
  }

  takeRedo(pageId?: PageId): Transaction | null {
    const i = this.indexFor(this.redoStack, pageId);
    if (i < 0) return null;
    this.lastRecordedId = null;
    return this.redoStack.splice(i, 1)[0] ?? null;
  }

  /** Put an undone entry on the redo stack. */
  pushRedo(tx: Transaction): void {
    this.redoStack.push(tx);
  }

  /** Put a redone entry back on the undo stack (does not clear redo). */
  pushUndo(tx: Transaction): void {
    this.undoStack.push(tx);
    if (this.undoStack.length > this.maxEntries) {
      this.undoStack.splice(0, this.undoStack.length - this.maxEntries);
    }
  }

  canUndo(pageId?: PageId): boolean {
    return this.indexFor(this.undoStack, pageId) >= 0;
  }

  canRedo(pageId?: PageId): boolean {
    return this.indexFor(this.redoStack, pageId) >= 0;
  }

  clear(): boolean {
    const had = this.undoStack.length > 0 || this.redoStack.length > 0;
    this.undoStack = [];
    this.redoStack = [];
    this.lastRecordedId = null;
    return had;
  }

  /** Labels and pages of the next undo and redo. */
  state(pageId?: PageId): DocumentHistoryState {
    const u = this.peekUndo(pageId);
    const r = this.peekRedo(pageId);
    return {
      canUndo: u !== null,
      canRedo: r !== null,
      undoLabel: u?.label ?? null,
      redoLabel: r?.label ?? null,
      undoPageIds: u ? [...u.pageIds] : [],
      redoPageIds: r ? [...r.pageIds] : [],
    };
  }

  private indexFor(stack: readonly Transaction[], pageId?: PageId): number {
    if (stack.length === 0) return -1;
    if (this.mode !== "per-page" || pageId === undefined) return stack.length - 1;
    for (let i = stack.length - 1; i >= 0; i--) {
      if (stack[i]?.pageIds.includes(pageId)) return i;
    }
    return -1;
  }
}
