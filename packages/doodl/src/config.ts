/**
 * Doodl Configuration
 *
 * Centralized configuration for thresholds and defaults.
 * Values can be overridden via DoodlOptions.
 */

// =============================================================================
// DRAWING THRESHOLDS
// =============================================================================

/**
 * Minimum size for a valid shape (in pixels)
 */
export const MIN_SHAPE_SIZE = 2;

/**
 * Distance threshold to close polygon by clicking near start (in pixels)
 */
export const POLYGON_CLOSE_THRESHOLD = 15;

/**
 * Minimum vertices required for a valid polygon
 */
export const MIN_POLYGON_VERTICES = 3;

/**
 * Default tolerance for stroke hit testing (in pixels)
 */
export const DEFAULT_HIT_TOLERANCE = 5;

// =============================================================================
// SELECTION THRESHOLDS
// =============================================================================

/**
 * Handle hit test tolerance (extra pixels around handle)
 */
export const HANDLE_HIT_TOLERANCE = 4;

// =============================================================================
// PATH SIMPLIFICATION
// =============================================================================

/**
 * Default epsilon for Ramer-Douglas-Peucker simplification
 */
export const DEFAULT_SIMPLIFICATION_EPSILON = 2;

/**
 * Minimum points to keep after simplification
 */
export const MIN_SIMPLIFIED_POINTS = 3;

// =============================================================================
// HISTORY
// =============================================================================

/**
 * Default maximum history size for undo/redo
 */
export const DEFAULT_HISTORY_SIZE = 50;

// =============================================================================
// FONTS
// =============================================================================

/**
 * Default font size for text shapes
 */
export const DEFAULT_FONT_SIZE = 16;

/**
 * Default font family for text shapes
 */
export const DEFAULT_FONT_FAMILY = "sans-serif";
