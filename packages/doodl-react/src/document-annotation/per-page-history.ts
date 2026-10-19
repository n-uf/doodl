/**
 * Per-Page History Manager
 *
 * Manages isolated undo/redo stacks for each page.
 * Each page has independent history that doesn't affect other pages.
 */

import type { DrawShape } from "@n-uf/doodl";
import type { PageHistory, HistoryState } from "./types";

const DEFAULT_MAX_HISTORY = 50;

export class PerPageHistoryManager {
  private _histories: Map<number, PageHistory> = new Map();
  private _maxHistorySize: number;

  constructor(maxHistorySize: number = DEFAULT_MAX_HISTORY) {
    this._maxHistorySize = maxHistorySize;
  }

  // ===========================================================================
  // HISTORY OPERATIONS
  // ===========================================================================

  /**
   * Push current state to undo stack for a page
   */
  pushUndo(pageNumber: number, shapes: DrawShape[]): void {
    const history = this._getOrCreateHistory(pageNumber);

    // Clone shapes for immutability
    history.undoStack.push(shapes.map((s) => ({ ...s })));

    // Clear redo stack on new action
    history.redoStack = [];

    // Trim if exceeds max size
    if (history.undoStack.length > this._maxHistorySize) {
      history.undoStack.shift();
    }
  }

  /**
   * Undo last action on a page
   * @returns Previous shapes, or null if nothing to undo
   */
  undo(pageNumber: number, currentShapes: DrawShape[]): DrawShape[] | null {
    const history = this._histories.get(pageNumber);
    if (!history || history.undoStack.length === 0) {
      return null;
    }

    // Pop from undo stack
    const previousState = history.undoStack.pop()!;

    // Push current to redo stack
    history.redoStack.push(currentShapes.map((s) => ({ ...s })));

    return previousState;
  }

  /**
   * Redo last undone action on a page
   * @returns Next shapes, or null if nothing to redo
   */
  redo(pageNumber: number, currentShapes: DrawShape[]): DrawShape[] | null {
    const history = this._histories.get(pageNumber);
    if (!history || history.redoStack.length === 0) {
      return null;
    }

    // Pop from redo stack
    const nextState = history.redoStack.pop()!;

    // Push current to undo stack
    history.undoStack.push(currentShapes.map((s) => ({ ...s })));

    return nextState;
  }

  // ===========================================================================
  // STATE QUERIES
  // ===========================================================================

  /**
   * Check if undo is available for a page
   */
  canUndo(pageNumber: number): boolean {
    const history = this._histories.get(pageNumber);
    return history ? history.undoStack.length > 0 : false;
  }

  /**
   * Check if redo is available for a page
   */
  canRedo(pageNumber: number): boolean {
    const history = this._histories.get(pageNumber);
    return history ? history.redoStack.length > 0 : false;
  }

  /**
   * Get history state for a page
   */
  getHistoryState(pageNumber: number): HistoryState {
    return {
      canUndo: this.canUndo(pageNumber),
      canRedo: this.canRedo(pageNumber),
    };
  }

  // ===========================================================================
  // MANAGEMENT
  // ===========================================================================

  /**
   * Clear history for a specific page
   */
  clearPage(pageNumber: number): void {
    this._histories.delete(pageNumber);
  }

  /**
   * Clear all history
   */
  clearAll(): void {
    this._histories.clear();
  }

  /**
   * Get history for a page (for debugging/inspection)
   */
  getPageHistory(pageNumber: number): PageHistory | undefined {
    return this._histories.get(pageNumber);
  }

  // ===========================================================================
  // INTERNAL
  // ===========================================================================

  private _getOrCreateHistory(pageNumber: number): PageHistory {
    let history = this._histories.get(pageNumber);
    if (!history) {
      history = { undoStack: [], redoStack: [] };
      this._histories.set(pageNumber, history);
    }
    return history;
  }
}

