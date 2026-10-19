/**
 * Document Annotation Manager
 *
 * Central manager for multi-page document annotations.
 * Supports both focus mode (single page) and exploded mode (all pages).
 * Configurable history: per-page or global, with mode-specific settings.
 */

import {
  DEFAULT_SHAPE_STYLE,
  type DrawShape,
  type DrawTool,
  type ShapeStyle,
} from "@n-uf/doodl";
import { GlobalHistoryManager } from "./global-history";
import { PerPageHistoryManager } from "./per-page-history";
import type {
  DocumentAnnotationData,
  DocumentAnnotationEventName,
  DocumentAnnotationEvents,
  DocumentAnnotationManagerOptions,
  HistoryConfig,
  HistoryMode,
  HistoryState,
  PageAnnotationState,
  UndoRedoResult,
  ViewMode,
} from "./types";

const DEFAULT_MAX_HISTORY = 50;

type EventCallback<T extends DocumentAnnotationEventName> =
  DocumentAnnotationEvents[T];

export class DocumentAnnotationManager {
  // Page state
  private _pages: Map<number, PageAnnotationState> = new Map();
  private _totalPages: number;

  // View state
  private _viewMode: ViewMode;
  private _activePageNumber: number = 1;

  // Tool/Style state
  private _tool: DrawTool = "select";
  private _style: ShapeStyle = { ...DEFAULT_SHAPE_STYLE };

  // History managers
  private _perPageHistory: PerPageHistoryManager;
  private _globalHistory: GlobalHistoryManager;
  private _historyConfig: HistoryConfig;

  // Events
  private _listeners = new Map<
    DocumentAnnotationEventName,
    Set<EventCallback<DocumentAnnotationEventName>>
  >();

  constructor(options: DocumentAnnotationManagerOptions) {
    this._totalPages = options.totalPages;
    this._viewMode = options.initialViewMode ?? "focus";
    this._tool = options.initialTool ?? "select";
    this._style = options.initialStyle ?? { ...DEFAULT_SHAPE_STYLE };

    // History config
    this._historyConfig = options.historyConfig ?? {
      explodedMode: "global",
      focusMode: "per-page",
      transitionBehavior: "clear",
    };

    const maxHistory = options.maxHistorySize ?? DEFAULT_MAX_HISTORY;
    this._perPageHistory = new PerPageHistoryManager(maxHistory);
    this._globalHistory = new GlobalHistoryManager(maxHistory);

    // Initialize pages
    for (let i = 1; i <= this._totalPages; i++) {
      const initialShapes = options.initialShapes?.get(i) ?? [];
      this._pages.set(i, {
        pageNumber: i,
        shapes: initialShapes,
        history: { undoStack: [], redoStack: [] },
        isDirty: false,
      });
    }
  }

  // ===========================================================================
  // GETTERS
  // ===========================================================================

  get totalPages(): number {
    return this._totalPages;
  }

  get viewMode(): ViewMode {
    return this._viewMode;
  }

  get activePageNumber(): number {
    return this._activePageNumber;
  }

  get tool(): DrawTool {
    return this._tool;
  }

  get style(): ShapeStyle {
    return { ...this._style };
  }

  get historyConfig(): HistoryConfig {
    return { ...this._historyConfig };
  }

  // ===========================================================================
  // PAGE OPERATIONS
  // ===========================================================================

  /**
   * Get shapes for a page
   */
  getPageShapes(pageNumber: number): DrawShape[] {
    const page = this._pages.get(pageNumber);
    return page ? [...page.shapes] : [];
  }

  /**
   * Set shapes for a page (with history tracking)
   */
  setPageShapes(pageNumber: number, shapes: DrawShape[]): void {
    const page = this._pages.get(pageNumber);
    if (!page) return;

    // Track in history
    this._pushHistory(pageNumber, page.shapes);

    // Update state
    page.shapes = shapes.map((s) => ({ ...s }));
    page.isDirty = true;

    // Emit events
    this._emit("shapesChange", pageNumber, page.shapes);
    this._emitHistoryChange();
  }

  /**
   * Add a shape to a page
   */
  addShape(pageNumber: number, shape: DrawShape): void {
    const currentShapes = this.getPageShapes(pageNumber);
    this.setPageShapes(pageNumber, [...currentShapes, shape]);
  }

  /**
   * Remove a shape from a page
   */
  removeShape(pageNumber: number, shapeId: string): void {
    const currentShapes = this.getPageShapes(pageNumber);
    this.setPageShapes(
      pageNumber,
      currentShapes.filter((s) => s.id !== shapeId)
    );
  }

  /**
   * Update a shape on a page
   */
  updateShape(
    pageNumber: number,
    shapeId: string,
    updates: Partial<DrawShape>
  ): void {
    const currentShapes = this.getPageShapes(pageNumber);
    this.setPageShapes(
      pageNumber,
      currentShapes.map((s) =>
        s.id === shapeId ? ({ ...s, ...updates } as DrawShape) : s
      )
    );
  }

  /**
   * Clear all shapes from a page
   */
  clearPage(pageNumber: number): void {
    this.setPageShapes(pageNumber, []);
  }

  /**
   * Get all pages state (for rendering)
   */
  getAllPages(): PageAnnotationState[] {
    return Array.from(this._pages.values());
  }

  /**
   * Get all shapes as flat array
   */
  getAllShapesFlat(): DrawShape[] {
    const all: DrawShape[] = [];
    for (const page of this._pages.values()) {
      all.push(...page.shapes);
    }
    return all;
  }

  // ===========================================================================
  // HISTORY OPERATIONS
  // ===========================================================================

  /**
   * Undo last action
   * @param pageNumber - Page to undo on (for per-page mode)
   */
  undo(pageNumber?: number): UndoRedoResult {
    const mode = this._getCurrentHistoryMode();
    const targetPage = pageNumber ?? this._activePageNumber;

    if (mode === "per-page") {
      const currentShapes = this.getPageShapes(targetPage);
      const previousShapes = this._perPageHistory.undo(targetPage, currentShapes);

      if (previousShapes) {
        const page = this._pages.get(targetPage);
        if (page) {
          page.shapes = previousShapes;
          page.isDirty = true;
          this._emit("shapesChange", targetPage, previousShapes);
          this._emitHistoryChange();
        }
        return { success: true, affectedPage: targetPage, shapes: previousShapes };
      }
      return { success: false, affectedPage: null, shapes: null };
    } else {
      // Global history
      const result = this._globalHistory.undo((pn) => this.getPageShapes(pn));

      if (result.success && result.affectedPage !== null && result.shapes) {
        const page = this._pages.get(result.affectedPage);
        if (page) {
          page.shapes = result.shapes;
          page.isDirty = true;
          this._emit("shapesChange", result.affectedPage, result.shapes);
          this._emitHistoryChange();
        }
      }
      return result;
    }
  }

  /**
   * Redo last undone action
   * @param pageNumber - Page to redo on (for per-page mode)
   */
  redo(pageNumber?: number): UndoRedoResult {
    const mode = this._getCurrentHistoryMode();
    const targetPage = pageNumber ?? this._activePageNumber;

    if (mode === "per-page") {
      const currentShapes = this.getPageShapes(targetPage);
      const nextShapes = this._perPageHistory.redo(targetPage, currentShapes);

      if (nextShapes) {
        const page = this._pages.get(targetPage);
        if (page) {
          page.shapes = nextShapes;
          page.isDirty = true;
          this._emit("shapesChange", targetPage, nextShapes);
          this._emitHistoryChange();
        }
        return { success: true, affectedPage: targetPage, shapes: nextShapes };
      }
      return { success: false, affectedPage: null, shapes: null };
    } else {
      // Global history
      const result = this._globalHistory.redo((pn) => this.getPageShapes(pn));

      if (result.success && result.affectedPage !== null && result.shapes) {
        const page = this._pages.get(result.affectedPage);
        if (page) {
          page.shapes = result.shapes;
          page.isDirty = true;
          this._emit("shapesChange", result.affectedPage, result.shapes);
          this._emitHistoryChange();
        }
      }
      return result;
    }
  }

  /**
   * Check if undo is available
   */
  canUndo(pageNumber?: number): boolean {
    const mode = this._getCurrentHistoryMode();
    const targetPage = pageNumber ?? this._activePageNumber;

    if (mode === "per-page") {
      return this._perPageHistory.canUndo(targetPage);
    }
    return this._globalHistory.canUndo();
  }

  /**
   * Check if redo is available
   */
  canRedo(pageNumber?: number): boolean {
    const mode = this._getCurrentHistoryMode();
    const targetPage = pageNumber ?? this._activePageNumber;

    if (mode === "per-page") {
      return this._perPageHistory.canRedo(targetPage);
    }
    return this._globalHistory.canRedo();
  }

  /**
   * Get current history state
   */
  getHistoryState(pageNumber?: number): HistoryState {
    return {
      canUndo: this.canUndo(pageNumber),
      canRedo: this.canRedo(pageNumber),
    };
  }

  /**
   * Peek at which page would be affected by undo (global mode only)
   */
  peekUndoPage(): number | null {
    if (this._getCurrentHistoryMode() === "global") {
      return this._globalHistory.peekUndoPage();
    }
    return this._activePageNumber;
  }

  /**
   * Peek at which page would be affected by redo (global mode only)
   */
  peekRedoPage(): number | null {
    if (this._getCurrentHistoryMode() === "global") {
      return this._globalHistory.peekRedoPage();
    }
    return this._activePageNumber;
  }

  // ===========================================================================
  // MODE OPERATIONS
  // ===========================================================================

  /**
   * Set view mode (focus or exploded)
   */
  setViewMode(mode: ViewMode): void {
    if (mode === this._viewMode) return;

    const oldMode = this._viewMode;
    const oldHistoryMode = this._getHistoryModeFor(oldMode);
    const newHistoryMode = this._getHistoryModeFor(mode);

    // Handle history transition if modes differ
    if (oldHistoryMode !== newHistoryMode) {
      this._handleHistoryTransition(oldHistoryMode, newHistoryMode);
    }

    this._viewMode = mode;
    this._emit("viewModeChange", mode);
    this._emitHistoryChange();
  }

  /**
   * Set active page (focus mode)
   */
  setActivePage(pageNumber: number): void {
    if (pageNumber < 1 || pageNumber > this._totalPages) return;
    if (pageNumber === this._activePageNumber) return;

    this._activePageNumber = pageNumber;
    this._emit("activePageChange", pageNumber);
    this._emitHistoryChange();
  }

  // ===========================================================================
  // TOOL & STYLE
  // ===========================================================================

  /**
   * Set current tool
   */
  setTool(tool: DrawTool): void {
    if (tool === this._tool) return;
    this._tool = tool;
    this._emit("toolChange", tool);
  }

  /**
   * Set current style
   */
  setStyle(style: Partial<ShapeStyle>): void {
    this._style = { ...this._style, ...style };
    this._emit("styleChange", this._style);
  }

  // ===========================================================================
  // SERIALIZATION
  // ===========================================================================

  /**
   * Export all annotations
   */
  exportAll(): DocumentAnnotationData {
    const pages: Record<number, DrawShape[]> = {};
    for (const [pageNumber, page] of this._pages) {
      if (page.shapes.length > 0) {
        pages[pageNumber] = page.shapes;
      }
    }

    return {
      version: 1,
      totalPages: this._totalPages,
      pages,
      metadata: {
        createdAt: new Date().toISOString(),
        modifiedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * Import annotations (replaces current state)
   */
  importAll(data: DocumentAnnotationData): void {
    // Clear history
    this._perPageHistory.clearAll();
    this._globalHistory.clear();

    // Update pages
    for (let i = 1; i <= this._totalPages; i++) {
      const shapes = data.pages[i] ?? [];
      const page = this._pages.get(i);
      if (page) {
        page.shapes = shapes;
        page.isDirty = false;
        this._emit("shapesChange", i, shapes);
      }
    }

    this._emitHistoryChange();
  }

  /**
   * Export as JSON string
   */
  exportJSON(): string {
    return JSON.stringify(this.exportAll(), null, 2);
  }

  /**
   * Import from JSON string
   */
  importJSON(json: string): void {
    const data = JSON.parse(json) as DocumentAnnotationData;
    this.importAll(data);
  }

  // ===========================================================================
  // EVENTS
  // ===========================================================================

  /**
   * Subscribe to event
   */
  on<T extends DocumentAnnotationEventName>(
    event: T,
    callback: DocumentAnnotationEvents[T]
  ): void {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }
    this._listeners
      .get(event)!
      .add(callback as EventCallback<DocumentAnnotationEventName>);
  }

  /**
   * Unsubscribe from event
   */
  off<T extends DocumentAnnotationEventName>(
    event: T,
    callback: DocumentAnnotationEvents[T]
  ): void {
    this._listeners
      .get(event)
      ?.delete(callback as EventCallback<DocumentAnnotationEventName>);
  }

  // ===========================================================================
  // INTERNAL
  // ===========================================================================

  private _getCurrentHistoryMode(): HistoryMode {
    return this._getHistoryModeFor(this._viewMode);
  }

  private _getHistoryModeFor(viewMode: ViewMode): HistoryMode {
    return viewMode === "exploded"
      ? this._historyConfig.explodedMode
      : this._historyConfig.focusMode;
  }

  private _pushHistory(pageNumber: number, previousShapes: DrawShape[]): void {
    const mode = this._getCurrentHistoryMode();

    if (mode === "per-page") {
      this._perPageHistory.pushUndo(pageNumber, previousShapes);
    } else {
      this._globalHistory.pushUndo(pageNumber, previousShapes);
    }
  }

  private _handleHistoryTransition(
    oldMode: HistoryMode,
    newMode: HistoryMode
  ): void {
    switch (this._historyConfig.transitionBehavior) {
      case "clear":
        // Clear the new mode's history
        if (newMode === "global") {
          this._globalHistory.clear();
        } else {
          this._perPageHistory.clearAll();
        }
        break;

      case "preserve-current":
        // Keep old history frozen, don't touch new
        // (effectively starts fresh in new mode)
        break;

      case "merge-best-effort":
        // Complex merge logic - for now, just clear
        // TODO: Implement merge if needed
        if (newMode === "global") {
          this._globalHistory.clear();
        } else {
          this._perPageHistory.clearAll();
        }
        break;
    }
  }

  private _emit<T extends DocumentAnnotationEventName>(
    event: T,
    ...args: Parameters<DocumentAnnotationEvents[T]>
  ): void {
    const callbacks = this._listeners.get(event);
    if (callbacks) {
      for (const cb of callbacks) {
        (cb as (...a: Parameters<DocumentAnnotationEvents[T]>) => void)(...args);
      }
    }
  }

  private _emitHistoryChange(): void {
    this._emit("historyChange", this.getHistoryState());
  }
}

/**
 * Create a new DocumentAnnotationManager
 */
export function createDocumentAnnotationManager(
  options: DocumentAnnotationManagerOptions
): DocumentAnnotationManager {
  return new DocumentAnnotationManager(options);
}

