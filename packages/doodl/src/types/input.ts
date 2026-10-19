/**
 * Input type definitions for Doodl
 */

// =============================================================================
// MODIFIER KEYS
// =============================================================================

/**
 * Keyboard modifiers during drawing
 */
export interface DrawModifiers {
  /** Shift key - constrain aspect ratio (square/circle) */
  shift: boolean;
  /** Ctrl/Cmd key - reserved for future use */
  ctrl: boolean;
  /** Alt key - draw from center */
  alt: boolean;
}

/**
 * Default modifiers (all false)
 */
export const DEFAULT_MODIFIERS: DrawModifiers = {
  shift: false,
  ctrl: false,
  alt: false,
};
