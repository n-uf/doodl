/**
 * Document selection: one set of ids for the whole document, and the pure
 * click rules (selection rules 2 to 4 of the design).
 */

import type {
  ClickOptions,
  ClickTarget,
  DocumentSelection,
  PageId,
  SelectMode,
} from "./types";

/** An ordered set of selected ids. Mutators return true when the set changed. */
export class SelectionModel {
  private set: Set<string>;

  constructor(ids: Iterable<string> = []) {
    this.set = new Set(ids);
  }

  get size(): number {
    return this.set.size;
  }

  has(id: string): boolean {
    return this.set.has(id);
  }

  ids(): string[] {
    return [...this.set];
  }

  clone(): SelectionModel {
    return new SelectionModel(this.set);
  }

  /** Make the selection exactly `ids`. */
  replace(ids: Iterable<string>): boolean {
    const next = new Set(ids);
    if (sameSet(this.set, next)) return false;
    this.set = next;
    return true;
  }

  add(ids: Iterable<string>): boolean {
    let changed = false;
    for (const id of ids) {
      if (!this.set.has(id)) {
        this.set.add(id);
        changed = true;
      }
    }
    return changed;
  }

  remove(ids: Iterable<string>): boolean {
    let changed = false;
    for (const id of ids) {
      if (this.set.delete(id)) changed = true;
    }
    return changed;
  }

  toggle(ids: Iterable<string>): boolean {
    let changed = false;
    for (const id of ids) {
      if (this.set.has(id)) this.set.delete(id);
      else this.set.add(id);
      changed = true;
    }
    return changed;
  }

  clear(): boolean {
    if (this.set.size === 0) return false;
    this.set.clear();
    return true;
  }

  /** Apply ids in a mode. */
  apply(ids: readonly string[], mode: SelectMode = "replace"): boolean {
    if (mode === "add") return this.add(ids);
    if (mode === "toggle") return this.toggle(ids);
    return this.replace(ids);
  }
}

function sameSet(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  if (a.size !== b.size) return false;
  for (const id of a) if (!b.has(id)) return false;
  return true;
}

/** Group ids by the page `pageOf` puts them on. Ids with no page are skipped. */
export function groupByPage(
  ids: readonly string[],
  pageOf: (id: string) => PageId | undefined
): Map<PageId, string[]> {
  const byPage = new Map<PageId, string[]>();
  for (const id of ids) {
    const pageId = pageOf(id);
    if (pageId === undefined) continue;
    const list = byPage.get(pageId);
    if (list) list.push(id);
    else byPage.set(pageId, [id]);
  }
  return byPage;
}

export function makeSelection(
  ids: readonly string[],
  pageOf: (id: string) => PageId | undefined
): DocumentSelection {
  return { ids: [...ids], byPage: groupByPage(ids, pageOf) };
}

/** Same ids in the same order, grouped the same way. */
export function sameSelection(a: DocumentSelection, b: DocumentSelection): boolean {
  if (a.ids.length !== b.ids.length || a.byPage.size !== b.byPage.size) return false;
  if (a.ids.some((id, i) => id !== b.ids[i])) return false;
  for (const [pageId, list] of a.byPage) {
    const other = b.byPage.get(pageId);
    if (!other || other.length !== list.length || list.some((id, i) => id !== other[i])) {
      return false;
    }
  }
  return true;
}

/**
 * Apply a click to the selection.
 *
 * - mark, no Shift: the selection becomes that mark (unless `preserveGroup` and
 *   it is already selected);
 * - mark, Shift: toggle it, keep the rest, across pages;
 * - empty paper or the gap: clear; with Shift the selection is kept (a slipped
 *   Shift-click must not lose a multi-selection);
 * - outside the root: keep.
 */
export function applyClick(
  model: SelectionModel,
  target: ClickTarget,
  options: ClickOptions = {}
): boolean {
  switch (target.kind) {
    case "shape":
      if (options.shift) return model.toggle([target.id]);
      if (options.preserveGroup && model.has(target.id)) return false;
      return model.replace([target.id]);
    case "paper":
    case "gap":
      return options.shift ? false : model.clear();
    case "outside":
      return false;
  }
}
