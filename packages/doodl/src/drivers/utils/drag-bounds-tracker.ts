/**
 * Drag Bounds Tracker
 *
 * Tracks the vertical extent of a user's mouse drag gesture.
 * Used to filter out phantom selection rects that extend beyond
 * where the user actually dragged.
 *
 * The browser's Selection API is "greedy" - when dragging into blank zones,
 * it snaps to distant text. By tracking actual drag bounds, we can reject
 * rects for text the user never dragged over.
 */

// =============================================================================
// TYPES
// =============================================================================

export interface DragBounds {
  /** Starting Y position (clientY at mousedown) */
  startY: number;
  /** Minimum Y reached during drag */
  minY: number;
  /** Maximum Y reached during drag */
  maxY: number;
}

// =============================================================================
// DRAG BOUNDS TRACKER
// =============================================================================

/** Log prefix for easy filtering */
const LOG_PREFIX = "[SelectionDriver]";

/**
 * Tracks vertical drag bounds during a selection gesture.
 *
 * Usage:
 * 1. Call `start(y)` on mousedown
 * 2. Call `update(y)` on mousemove
 * 3. Call `update(y)` on mouseup (final position)
 * 4. Use `isRectWithinBounds(rect)` to filter selection rects
 * 5. Call `reset()` when selection ends
 */
export class DragBoundsTracker {
  private _startY: number | null = null;
  private _minY: number | null = null;
  private _maxY: number | null = null;
  private _enableLogging = true;

  /**
   * Start tracking a new drag gesture
   * @param clientY - The Y position from mousedown event
   */
  start(clientY: number): void {
    this._startY = clientY;
    this._minY = clientY;
    this._maxY = clientY;
    if (this._enableLogging) {
      console.log(
        `${LOG_PREFIX} DRAG_START`,
        JSON.stringify({ startY: Math.round(clientY) })
      );
    }
  }

  /**
   * Update bounds with current mouse position
   * Call on mousemove and mouseup
   * @param clientY - The Y position from mouse event
   */
  update(clientY: number): void {
    if (this._minY === null || clientY < this._minY) {
      this._minY = clientY;
    }
    if (this._maxY === null || clientY > this._maxY) {
      this._maxY = clientY;
    }
    // Suppress per-move logging - final state is logged in DRAG_END
  }

  /**
   * Reset tracking state
   * Call when selection ends or is cancelled
   */
  reset(): void {
    if (this._enableLogging && this._startY !== null) {
      console.log(
        `${LOG_PREFIX} DRAG_END`,
        JSON.stringify({
          startY: Math.round(this._startY),
          minY: this._minY !== null ? Math.round(this._minY) : null,
          maxY: this._maxY !== null ? Math.round(this._maxY) : null,
          range:
            this._minY !== null && this._maxY !== null
              ? Math.round(this._maxY - this._minY)
              : null,
        })
      );
    }
    this._startY = null;
    this._minY = null;
    this._maxY = null;
  }

  /**
   * Check if tracking is active (has valid bounds)
   */
  isActive(): boolean {
    return this._minY !== null && this._maxY !== null;
  }

  /**
   * Get current bounds (returns null if not active)
   */
  getBounds(): DragBounds | null {
    if (this._startY === null || this._minY === null || this._maxY === null) {
      return null;
    }
    return {
      startY: this._startY,
      minY: this._minY,
      maxY: this._maxY,
    };
  }

  /**
   * Check if a DOMRect is within the tracked drag bounds
   *
   * The key rule: a rect's TOP must be within where the user actually dragged.
   * If the rect starts below where the user stopped dragging, it's phantom text.
   *
   * @param rect - The DOMRect to check (in viewport/client coordinates)
   * @param tolerance - Pixels of tolerance for line height variations (default: 15)
   * @returns true if rect is within bounds, false if it's a phantom rect
   */
  isRectWithinBounds(rect: DOMRect, tolerance: number = 15): boolean {
    // If bounds not set, allow all (fallback)
    if (this._minY === null || this._maxY === null) {
      return true;
    }

    const dragTop = this._minY - tolerance;
    const dragBottom = this._maxY + tolerance;

    // Rect's TOP must be within the drag region
    // A rect for text that starts BELOW where the user dragged is phantom
    if (rect.top > dragBottom) {
      return false;
    }

    // Rect's BOTTOM must be at or below where drag started
    // (User couldn't have selected text above where they started)
    if (rect.bottom < dragTop) {
      return false;
    }

    return true;
  }

  /**
   * Enable or disable logging
   */
  setLogging(enabled: boolean): void {
    this._enableLogging = enabled;
  }
}

/**
 * Create a new DragBoundsTracker instance
 */
export function createDragBoundsTracker(): DragBoundsTracker {
  return new DragBoundsTracker();
}

