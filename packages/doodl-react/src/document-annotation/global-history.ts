/**
 * Global History Manager
 *
 * Manages a single undo/redo stack across all pages.
 * Each history entry tracks which page was modified.
 * Undo/redo may affect a different page than the currently active one.
 */

import type { DrawShape } from "@n-uf/doodl";
import type { GlobalHistoryEntry, HistoryState, UndoRedoResult } from "./types";

const DEFAULT_MAX_HISTORY = 50;

export class GlobalHistoryManager {
  private _undoStack: GlobalHistoryEntry[] = [];
  private _redoStack: GlobalHistoryEntry[] = [];
  private _maxHistorySize: number;

  constructor(maxHistorySize: number = DEFAULT_MAX_HISTORY) {
    this._maxHistorySize = maxHistorySize;
  }

  // ===========================================================================
  // HISTORY OPERATIONS
  // ===========================================================================

  /**
   * Push current state to undo stack
   * @param pageNumber - Page being modified
   * @param previousShapes - Shapes BEFORE the modification (to restore on undo)
   */
  pushUndo(pageNumber: number, previousShapes: DrawShape[]): void {
    this._undoStack.push({
      pageNumber,
      previousShapes: previousShapes.map((s) => ({ ...s })),
      timestamp: Date.now(),
    });

    // Clear redo stack on new action
    this._redoStack = [];

    // Trim if exceeds max size
    if (this._undoStack.length > this._maxHistorySize) {
      this._undoStack.shift();
    }
  }

  /**
   * Undo last action (may affect any page)
   * @param getCurrentShapes - Function to get current shapes for a page
   * @returns Result with affected page and new shapes
   */
  undo(
    getCurrentShapes: (pageNumber: number) => DrawShape[]
  ): UndoRedoResult {
    if (this._undoStack.length === 0) {
      return { success: false, affectedPage: null, shapes: null };
    }

    // Pop from undo stack
    const entry = this._undoStack.pop()!;

    // Get current shapes for this page (to save for redo)
    const currentShapes = getCurrentShapes(entry.pageNumber);

    // Push current state to redo stack
    this._redoStack.push({
      pageNumber: entry.pageNumber,
      previousShapes: currentShapes.map((s) => ({ ...s })),
      timestamp: Date.now(),
    });

    // Return the previous shapes to restore
    return {
      success: true,
      affectedPage: entry.pageNumber,
      shapes: entry.previousShapes,
    };
  }

  /**
   * Redo last undone action (may affect any page)
   * @param getCurrentShapes - Function to get current shapes for a page
   * @returns Result with affected page and new shapes
   */
  redo(
    getCurrentShapes: (pageNumber: number) => DrawShape[]
  ): UndoRedoResult {
    if (this._redoStack.length === 0) {
      return { success: false, affectedPage: null, shapes: null };
    }

    // Pop from redo stack
    const entry = this._redoStack.pop()!;

    // Get current shapes for this page (to save for undo)
    const currentShapes = getCurrentShapes(entry.pageNumber);

    // Push current state to undo stack
    this._undoStack.push({
      pageNumber: entry.pageNumber,
      previousShapes: currentShapes.map((s) => ({ ...s })),
      timestamp: Date.now(),
    });

    // Return the shapes to restore
    return {
      success: true,
      affectedPage: entry.pageNumber,
      shapes: entry.previousShapes,
    };
  }

  // ===========================================================================
  // STATE QUERIES
  // ===========================================================================

  /**
   * Check if undo is available
   */
  canUndo(): boolean {
    return this._undoStack.length > 0;
  }

  /**
   * Check if redo is available
   */
  canRedo(): boolean {
    return this._redoStack.length > 0;
  }

  /**
   * Get history state
   */
  getHistoryState(): HistoryState {
    return {
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
    };
  }

  /**
   * Peek at what page would be affected by undo (without performing it)
   */
  peekUndoPage(): number | null {
    const entry = this._undoStack.at(-1);
    return entry?.pageNumber ?? null;
  }

  /**
   * Peek at what page would be affected by redo (without performing it)
   */
  peekRedoPage(): number | null {
    const entry = this._redoStack.at(-1);
    return entry?.pageNumber ?? null;
  }

  // ===========================================================================
  // MANAGEMENT
  // ===========================================================================

  /**
   * Clear all history
   */
  clear(): void {
    this._undoStack = [];
    this._redoStack = [];
  }

  /**
   * Get undo stack size (for debugging/display)
   */
  getUndoStackSize(): number {
    return this._undoStack.length;
  }

  /**
   * Get redo stack size (for debugging/display)
   */
  getRedoStackSize(): number {
    return this._redoStack.length;
  }
}

