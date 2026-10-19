/**
 * Document Annotation Types
 *
 * Types for multi-page document annotation management with configurable history modes.
 */

import type { DrawShape, DrawTool, ShapeStyle } from "@n-uf/doodl";

// =============================================================================
// HISTORY TYPES
// =============================================================================

/**
 * History mode for undo/redo operations
 */
export type HistoryMode = "per-page" | "global";

/**
 * View mode for document display
 */
export type ViewMode = "focus" | "exploded";

/**
 * Behavior when transitioning between modes with different history strategies
 */
export type TransitionBehavior =
  | "clear" // Clear history on transition (simple, predictable)
  | "preserve-current" // Keep old history frozen, don't touch new
  | "merge-best-effort"; // Attempt to merge histories (complex)

/**
 * History configuration
 */
export interface HistoryConfig {
  /** History mode for exploded view */
  explodedMode: HistoryMode;
  /** History mode for focus view */
  focusMode: HistoryMode;
  /** Behavior on mode transition */
  transitionBehavior: TransitionBehavior;
}

/**
 * Default history configuration (recommended)
 */
export const DEFAULT_HISTORY_CONFIG: HistoryConfig = {
  explodedMode: "global",
  focusMode: "per-page",
  transitionBehavior: "clear",
};

// =============================================================================
// HISTORY ENTRY TYPES
// =============================================================================

/**
 * Entry in global history stack (tracks which page was modified)
 */
export interface GlobalHistoryEntry {
  /** Page number that was modified */
  pageNumber: number;
  /** Shapes before the modification */
  previousShapes: DrawShape[];
  /** Timestamp for ordering */
  timestamp: number;
}

/**
 * Per-page history state
 */
export interface PageHistory {
  undoStack: DrawShape[][];
  redoStack: DrawShape[][];
}

// =============================================================================
// PAGE STATE TYPES
// =============================================================================

/**
 * Complete state for a single page's annotations
 */
export interface PageAnnotationState {
  /** Page number (1-indexed) */
  pageNumber: number;
  /** Current shapes on this page */
  shapes: DrawShape[];
  /** Per-page history (used when historyMode is "per-page") */
  history: PageHistory;
  /** Whether this page has unsaved changes */
  isDirty: boolean;
}

// =============================================================================
// MANAGER TYPES
// =============================================================================

/**
 * Options for creating DocumentAnnotationManager
 */
export interface DocumentAnnotationManagerOptions {
  /** Total pages in document */
  totalPages: number;
  /** Initial shapes per page */
  initialShapes?: Map<number, DrawShape[]>;
  /** History configuration */
  historyConfig?: HistoryConfig;
  /** Initial view mode */
  initialViewMode?: ViewMode;
  /** Maximum history size per stack */
  maxHistorySize?: number;
  /** Initial tool */
  initialTool?: DrawTool;
  /** Initial style */
  initialStyle?: ShapeStyle;
}

/**
 * History state for UI display
 */
export interface HistoryState {
  canUndo: boolean;
  canRedo: boolean;
}

/**
 * Result of undo/redo operation
 */
export interface UndoRedoResult {
  /** Whether operation succeeded */
  success: boolean;
  /** Page number affected (for global history, may differ from active page) */
  affectedPage: number | null;
  /** New shapes for the affected page */
  shapes: DrawShape[] | null;
}

// =============================================================================
// EVENT TYPES
// =============================================================================

/**
 * Events emitted by DocumentAnnotationManager
 */
export interface DocumentAnnotationEvents {
  /** Shapes changed on a page */
  shapesChange: (pageNumber: number, shapes: DrawShape[]) => void;
  /** History state changed */
  historyChange: (state: HistoryState) => void;
  /** View mode changed */
  viewModeChange: (mode: ViewMode) => void;
  /** Active page changed (focus mode) */
  activePageChange: (pageNumber: number) => void;
  /** Tool changed */
  toolChange: (tool: DrawTool) => void;
  /** Style changed */
  styleChange: (style: ShapeStyle) => void;
}

export type DocumentAnnotationEventName = keyof DocumentAnnotationEvents;

// =============================================================================
// SERIALIZATION TYPES
// =============================================================================

/**
 * Serialized document annotations (for persistence)
 */
export interface DocumentAnnotationData {
  /** Schema version */
  version: 1;
  /** Total pages */
  totalPages: number;
  /** Shapes per page (keyed by page number) */
  pages: Record<number, DrawShape[]>;
  /** Metadata */
  metadata?: {
    createdAt: string;
    modifiedAt: string;
    source?: string;
  };
}

