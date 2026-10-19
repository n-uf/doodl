/**
 * State type definitions for Doodl
 */

import type { DrawShape } from "../shapes";
import type { DrawTool } from "../tools";
import type { ShapeStyle } from "./style";

// =============================================================================
// DRAWING STATE
// =============================================================================

/**
 * Current version of the state format
 */
export const DRAWING_STATE_VERSION = 1;

/**
 * Metadata for a drawing state
 */
export interface DrawingMetadata {
  /** Creation timestamp (ISO 8601) */
  createdAt: string;
  /** Last modification timestamp (ISO 8601) */
  modifiedAt: string;
  /** Source identifier (consumer-defined) */
  source?: string;
  /** Page or layer index (consumer-defined) */
  pageIndex?: number;
  /** Custom metadata (consumer-defined) */
  custom?: Record<string, unknown>;
}

/**
 * Complete drawing state (serializable)
 */
export interface DrawingState {
  /** State format version */
  version: number;
  /** All shapes in the drawing */
  shapes: DrawShape[];
  /** Optional metadata */
  metadata?: DrawingMetadata;
}

/**
 * Create an empty drawing state
 */
export function createEmptyState(
  source?: DrawingMetadata["source"]
): DrawingState {
  const now = new Date().toISOString();
  return {
    version: DRAWING_STATE_VERSION,
    shapes: [],
    metadata: {
      createdAt: now,
      modifiedAt: now,
      source,
    },
  };
}

// =============================================================================
// RUNTIME STATE
// =============================================================================

/**
 * Selection state
 */
export interface SelectionState {
  /** Set of selected shape IDs */
  selectedIds: Set<string>;
  /** Primary selected shape (for property editing) */
  primaryId: string | null;
}

/**
 * Create empty selection state
 */
export function createEmptySelection(): SelectionState {
  return {
    selectedIds: new Set(),
    primaryId: null,
  };
}

/**
 * Active drawing state (during drawing operation)
 */
export interface ActiveDrawingState {
  /** Whether a drawing operation is in progress */
  isDrawing: boolean;
  /** Starting point of the drawing */
  startPoint: { x: number; y: number } | null;
  /** Current point during drawing */
  currentPoint: { x: number; y: number } | null;
  /** Preview shape (not yet committed) */
  previewShape: DrawShape | null;
  /** Points collected for polygon/freehand */
  collectedPoints: { x: number; y: number }[];
}

/**
 * Create idle active drawing state
 */
export function createIdleDrawingState(): ActiveDrawingState {
  return {
    isDrawing: false,
    startPoint: null,
    currentPoint: null,
    previewShape: null,
    collectedPoints: [],
  };
}

/**
 * Complete runtime state
 */
export interface DoodlRuntimeState {
  /** Persisted drawing state */
  drawing: DrawingState;
  /** Current selection */
  selection: SelectionState;
  /** Active drawing operation */
  activeDrawing: ActiveDrawingState;
  /** Current tool */
  activeTool: DrawTool;
  /** Current style for new shapes */
  currentStyle: ShapeStyle;
  /** History state */
  history: {
    canUndo: boolean;
    canRedo: boolean;
  };
}

// =============================================================================
// STATE UPDATES
// =============================================================================

/**
 * Shape update payload
 */
export interface ShapeUpdate {
  /** Shape ID */
  id: string;
  /** Partial shape properties to update */
  updates: Partial<DrawShape>;
}

/**
 * Batch update for multiple shapes
 */
export interface BatchShapeUpdate {
  /** Updates to apply */
  updates: ShapeUpdate[];
}
