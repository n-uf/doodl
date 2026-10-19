/**
 * StateDriver - Drawing state management
 *
 * Logical container for all DrawingState operations:
 * - Validation (isValid, isValidMetadata)
 * - Serialization (serialize, deserialize)
 * - Utilities (clone, merge, extract, repair, create)
 *
 * Similar to React hooks - bundles related functionality into a cohesive unit.
 */

import { isValidShape } from "../shapes";
import type { DrawingMetadata, DrawingState, DrawShape } from "../types";
import { createEmptyState, DRAWING_STATE_VERSION } from "../types";

// =============================================================================
// ERROR
// =============================================================================

/**
 * State operation error
 */
export class StateError extends Error {
  constructor(
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = "StateError";
  }
}

// =============================================================================
// VALIDATION
// =============================================================================

/**
 * Validate drawing metadata
 */
export function isValidMetadata(obj: unknown): obj is DrawingMetadata {
  if (typeof obj !== "object" || obj === null) return false;

  const meta = obj as DrawingMetadata;
  if (meta.createdAt !== undefined && typeof meta.createdAt !== "string")
    return false;
  if (meta.modifiedAt !== undefined && typeof meta.modifiedAt !== "string")
    return false;
  if (meta.source !== undefined && typeof meta.source !== "string")
    return false;
  if (meta.pageIndex !== undefined && typeof meta.pageIndex !== "number")
    return false;

  return true;
}

/**
 * Validate drawing state structure
 */
export function isValidState(obj: unknown): obj is DrawingState {
  if (typeof obj !== "object" || obj === null) return false;
  const state = obj as DrawingState;

  // Check version
  if (typeof state.version !== "number") return false;

  // Check shapes array
  if (!Array.isArray(state.shapes)) return false;

  // Validate each shape (delegated to shape-centric validators)
  for (const shape of state.shapes) {
    if (!isValidShape(shape)) return false;
  }

  // Metadata is optional but must be valid if present
  if (state.metadata !== undefined) {
    if (!isValidMetadata(state.metadata)) return false;
  }

  return true;
}

// =============================================================================
// SERIALIZATION
// =============================================================================

/**
 * Serialize drawing state to JSON string
 */
export function serializeState(state: DrawingState): string {
  const serializable: DrawingState = {
    ...state,
    metadata: {
      ...state.metadata,
      modifiedAt: new Date().toISOString(),
      createdAt: state.metadata?.createdAt ?? new Date().toISOString(),
    },
  };

  return JSON.stringify(serializable, null, 2);
}

/**
 * Serialize drawing state to plain object (for embedding)
 */
export function serializeToObject(state: DrawingState): DrawingState {
  return JSON.parse(serializeState(state)) as DrawingState;
}

/**
 * Deserialize drawing state from JSON string
 */
export function deserializeState(json: string): DrawingState {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (error) {
    throw new StateError("Invalid JSON", error);
  }

  return deserializeFromObject(parsed);
}

/**
 * Deserialize drawing state from plain object
 */
export function deserializeFromObject(obj: unknown): DrawingState {
  if (!isValidState(obj)) {
    throw new StateError("Invalid drawing state structure", obj);
  }

  // Version mismatch - future migrations would be applied here
  // For now, we accept older versions but the caller can check obj.version if needed

  return obj;
}

// =============================================================================
// UTILITIES
// =============================================================================

/**
 * Create a deep clone of drawing state
 */
export function cloneState(state: DrawingState): DrawingState {
  return JSON.parse(JSON.stringify(state)) as DrawingState;
}

/**
 * Merge two drawing states (overlay shapes take precedence)
 */
export function mergeStates(
  base: DrawingState,
  overlay: DrawingState
): DrawingState {
  const overlayIds = new Set(overlay.shapes.map((s) => s.id));
  const baseShapes = base.shapes.filter((s) => !overlayIds.has(s.id));

  return {
    version: DRAWING_STATE_VERSION,
    shapes: [...baseShapes, ...overlay.shapes],
    metadata: {
      createdAt:
        base.metadata?.createdAt ??
        overlay.metadata?.createdAt ??
        new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
      source: overlay.metadata?.source ?? base.metadata?.source,
      pageIndex: overlay.metadata?.pageIndex ?? base.metadata?.pageIndex,
    },
  };
}

/**
 * Extract shapes from state (shallow copy)
 */
export function extractShapes(state: DrawingState): DrawShape[] {
  return state.shapes.map((shape) => ({ ...shape }));
}

/**
 * Create state from shapes array
 */
export function createFromShapes(
  shapes: DrawShape[],
  source?: string
): DrawingState {
  const state = createEmptyState(source);
  state.shapes = shapes.map((shape) => ({ ...shape }));
  return state;
}

/**
 * Repair malformed state (returns valid state, filtering invalid shapes)
 */
export function repairState(state: unknown): DrawingState {
  if (typeof state !== "object" || state === null) {
    return createEmptyState();
  }

  const raw = state as Partial<DrawingState>;

  const repaired: DrawingState = {
    version:
      typeof raw.version === "number" ? raw.version : DRAWING_STATE_VERSION,
    shapes: [],
    metadata: {
      createdAt: raw.metadata?.createdAt ?? new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
    },
  };

  // Filter valid shapes only
  if (Array.isArray(raw.shapes)) {
    for (const shape of raw.shapes) {
      if (isValidShape(shape)) {
        repaired.shapes.push(shape);
      }
    }
  }

  return repaired;
}
