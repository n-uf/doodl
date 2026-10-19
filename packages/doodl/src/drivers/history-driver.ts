/**
 * HistoryDriver - Generic snapshot-based undo/redo management
 *
 * Responsibilities:
 * - Managing undo/redo stacks
 * - Snapshot capture and restoration
 * - History size limits
 * - Change notifications
 */

// =============================================================================
// TYPES
// =============================================================================

export interface HistoryState {
  canUndo: boolean;
  canRedo: boolean;
  undoCount: number;
  redoCount: number;
}

export interface HistoryDriverOptions {
  /** Maximum history size (default: 50) */
  maxSize?: number;
}

export type HistoryChangeCallback = (state: HistoryState) => void;

// =============================================================================
// HISTORY DRIVER
// =============================================================================

/**
 * Generic snapshot-based history driver for undo/redo
 *
 * @template T - The type of snapshots being stored
 */
export class HistoryDriver<T> {
  private _undoStack: T[] = [];
  private _redoStack: T[] = [];
  private _maxSize: number;
  private _onChange: HistoryChangeCallback | null = null;

  constructor(options: HistoryDriverOptions = {}) {
    this._maxSize = options.maxSize ?? 50;
  }

  // ===========================================================================
  // SNAPSHOT OPERATIONS
  // ===========================================================================

  /**
   * Push current state to undo stack before making changes
   * Clears redo stack (new action invalidates redo history)
   */
  push(snapshot: T): void {
    this._undoStack.push(snapshot);

    // Trim if over limit
    while (this._undoStack.length > this._maxSize) {
      this._undoStack.shift();
    }

    // Clear redo stack on new action
    this._redoStack = [];

    this._notifyChange();
  }

  /**
   * Undo: Move current state to redo, restore previous from undo
   * @param currentSnapshot - The current state before undoing
   * @returns The previous state to restore, or null if nothing to undo
   */
  undo(currentSnapshot: T): T | null {
    if (this._undoStack.length === 0) return null;

    // Save current to redo stack
    this._redoStack.push(currentSnapshot);

    // Pop and return previous state
    const previous = this._undoStack.pop()!;
    this._notifyChange();

    return previous;
  }

  /**
   * Redo: Move current state to undo, restore next from redo
   * @param currentSnapshot - The current state before redoing
   * @returns The next state to restore, or null if nothing to redo
   */
  redo(currentSnapshot: T): T | null {
    if (this._redoStack.length === 0) return null;

    // Save current to undo stack
    this._undoStack.push(currentSnapshot);

    // Pop and return next state
    const next = this._redoStack.pop()!;
    this._notifyChange();

    return next;
  }

  // ===========================================================================
  // QUERIES
  // ===========================================================================

  /** Check if undo is available */
  canUndo(): boolean {
    return this._undoStack.length > 0;
  }

  /** Check if redo is available */
  canRedo(): boolean {
    return this._redoStack.length > 0;
  }

  /** Get undo stack size */
  getUndoCount(): number {
    return this._undoStack.length;
  }

  /** Get redo stack size */
  getRedoCount(): number {
    return this._redoStack.length;
  }

  /** Get current history state */
  getState(): HistoryState {
    return {
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
      undoCount: this._undoStack.length,
      redoCount: this._redoStack.length,
    };
  }

  // ===========================================================================
  // CONFIGURATION
  // ===========================================================================

  /** Set maximum history size */
  setMaxSize(size: number): void {
    this._maxSize = Math.max(1, size);

    // Trim if needed
    while (this._undoStack.length > this._maxSize) {
      this._undoStack.shift();
    }
  }

  /** Get maximum history size */
  getMaxSize(): number {
    return this._maxSize;
  }

  // ===========================================================================
  // LIFECYCLE
  // ===========================================================================

  /** Clear all history */
  clear(): void {
    this._undoStack = [];
    this._redoStack = [];
    this._notifyChange();
  }

  /** Set change callback */
  setOnChange(callback: HistoryChangeCallback | null): void {
    this._onChange = callback;
  }

  // ===========================================================================
  // PRIVATE
  // ===========================================================================

  private _notifyChange(): void {
    this._onChange?.(this.getState());
  }
}

/**
 * Create a new HistoryDriver instance
 */
export function createHistoryDriver<T>(
  options?: HistoryDriverOptions
): HistoryDriver<T> {
  return new HistoryDriver<T>(options);
}

