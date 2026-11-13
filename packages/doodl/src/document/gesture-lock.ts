/**
 * Gesture lock: at most one gesture runs per document, wherever it started.
 */

import type { GestureInfo, GestureOptions, PageId } from "./types";

export class GestureLock {
  private _current: GestureInfo | null = null;
  private counter = 0;

  /** The gesture holding the lock, if any. */
  get current(): GestureInfo | null {
    return this._current;
  }

  get locked(): boolean {
    return this._current !== null;
  }

  /** Take the lock. Returns null when a gesture is already running. */
  tryBegin(pageId: PageId, options: GestureOptions = {}): GestureInfo | null {
    if (this._current) return null;
    const kind = options.kind ?? "draw";
    this._current = {
      id: ++this.counter,
      pageId,
      pointerId: options.pointerId ?? null,
      kind,
      multiClick: options.multiClick ?? kind === "polygon",
    };
    return this._current;
  }

  /** Give the lock back. Only the holder can release it. */
  release(id: number): boolean {
    if (!this._current || this._current.id !== id) return false;
    this._current = null;
    return true;
  }

  isHeldBy(id: number): boolean {
    return this._current?.id === id;
  }
}
