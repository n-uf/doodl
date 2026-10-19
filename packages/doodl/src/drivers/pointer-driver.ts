/**
 * PointerDriver - Unified input handling for mouse, touch, and pen
 *
 * Replaces MouseDriver with PointerEvent-based handling that works across:
 * - Mouse (desktop)
 * - Touch (mobile/tablet)
 * - Pen/Stylus (drawing tablets)
 *
 * Features:
 * - Coordinate conversion (client → canvas)
 * - Modifier key tracking
 * - Multi-touch prevention (only tracks primary pointer)
 * - Pressure sensitivity (for pen input)
 */

import type { DrawModifiers, Point } from "../types";

// =============================================================================
// TYPES
// =============================================================================

/**
 * Extended point with pressure info (for pen/stylus)
 */
export interface PointerPoint extends Point {
  /** Pressure value 0-1 (1 for mouse, variable for pen/touch) */
  pressure: number;
  /** Pointer type: mouse, touch, or pen */
  pointerType: "mouse" | "touch" | "pen";
}

export interface PointerDriverCallbacks {
  onStart: (point: PointerPoint, modifiers: DrawModifiers) => void;
  onMove: (point: PointerPoint, modifiers: DrawModifiers) => void;
  onEnd: (point: PointerPoint, modifiers: DrawModifiers) => void;
  onDblClick: (point: PointerPoint, modifiers: DrawModifiers) => void;
  /** Called on pointer move when not dragging (for multi-click tools like polygon) */
  onHover?: (point: PointerPoint, modifiers: DrawModifiers) => void;
}

export interface PointerDriverOptions {
  /** Scale factor for coordinate conversion */
  scale?: number;
  /** Whether interactions are disabled */
  disabled?: boolean;
  /** Prevent default touch behavior (scrolling) */
  preventTouchDefault?: boolean;
}

// =============================================================================
// POINTER DRIVER
// =============================================================================

export class PointerDriver {
  private _canvas: HTMLCanvasElement;
  private _callbacks: PointerDriverCallbacks;

  // State
  private _activePointerId: number | null = null;
  private _scale = 1;
  private _disabled = false;
  private _preventTouchDefault: boolean;
  private _modifiers: DrawModifiers = { shift: false, ctrl: false, alt: false };

  // Bound handlers (for cleanup)
  private _boundHandlePointerDown: (e: PointerEvent) => void;
  private _boundHandlePointerMove: (e: PointerEvent) => void;
  private _boundHandlePointerUp: (e: PointerEvent) => void;
  private _boundHandlePointerCancel: (e: PointerEvent) => void;
  private _boundHandleDblClick: (e: MouseEvent) => void;
  private _boundPreventTouchScroll: (e: TouchEvent) => void;
  private _boundHandleCanvasPointerMove: (e: PointerEvent) => void;

  constructor(
    canvas: HTMLCanvasElement,
    callbacks: PointerDriverCallbacks,
    options: PointerDriverOptions = {}
  ) {
    this._canvas = canvas;
    this._callbacks = callbacks;
    this._scale = options.scale ?? 1;
    this._disabled = options.disabled ?? false;
    this._preventTouchDefault = options.preventTouchDefault ?? true;

    // Bind handlers
    this._boundHandlePointerDown = this._handlePointerDown.bind(this);
    this._boundHandlePointerMove = this._handlePointerMove.bind(this);
    this._boundHandlePointerUp = this._handlePointerUp.bind(this);
    this._boundHandlePointerCancel = this._handlePointerCancel.bind(this);
    this._boundHandleDblClick = this._handleDblClick.bind(this);
    this._boundPreventTouchScroll = this._preventTouchScroll.bind(this);
    this._boundHandleCanvasPointerMove =
      this._handleCanvasPointerMove.bind(this);

    // Attach events
    this._attachEvents();
  }

  // ===========================================================================
  // LIFECYCLE
  // ===========================================================================

  destroy(): void {
    this._detachEvents();
    this._detachWindowEvents();
  }

  private _attachEvents(): void {
    this._canvas.addEventListener("pointerdown", this._boundHandlePointerDown);
    this._canvas.addEventListener("dblclick", this._boundHandleDblClick);
    this._canvas.addEventListener(
      "pointermove",
      this._boundHandleCanvasPointerMove
    );

    // Prevent touch scrolling on canvas
    if (this._preventTouchDefault) {
      this._canvas.addEventListener(
        "touchstart",
        this._boundPreventTouchScroll,
        {
          passive: false,
        }
      );
      this._canvas.addEventListener(
        "touchmove",
        this._boundPreventTouchScroll,
        {
          passive: false,
        }
      );
    }

    // Set touch-action CSS for proper pointer event handling
    this._canvas.style.touchAction = "none";
  }

  private _detachEvents(): void {
    this._canvas.removeEventListener(
      "pointerdown",
      this._boundHandlePointerDown
    );
    this._canvas.removeEventListener("dblclick", this._boundHandleDblClick);
    this._canvas.removeEventListener(
      "pointermove",
      this._boundHandleCanvasPointerMove
    );
    this._canvas.removeEventListener(
      "touchstart",
      this._boundPreventTouchScroll
    );
    this._canvas.removeEventListener(
      "touchmove",
      this._boundPreventTouchScroll
    );
  }

  private _attachWindowEvents(): void {
    window.addEventListener("pointermove", this._boundHandlePointerMove);
    window.addEventListener("pointerup", this._boundHandlePointerUp);
    window.addEventListener("pointercancel", this._boundHandlePointerCancel);
  }

  private _detachWindowEvents(): void {
    window.removeEventListener("pointermove", this._boundHandlePointerMove);
    window.removeEventListener("pointerup", this._boundHandlePointerUp);
    window.removeEventListener("pointercancel", this._boundHandlePointerCancel);
  }

  private _preventTouchScroll(e: TouchEvent): void {
    if (!this._disabled) {
      e.preventDefault();
    }
  }

  // ===========================================================================
  // COORDINATE CONVERSION
  // ===========================================================================

  private _getCanvasPoint(e: PointerEvent): PointerPoint {
    const rect = this._canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / this._scale,
      y: (e.clientY - rect.top) / this._scale,
      pressure: e.pressure > 0 ? e.pressure : 1,
      pointerType: e.pointerType as "mouse" | "touch" | "pen",
    };
  }

  private _updateModifiers(e: PointerEvent | MouseEvent): void {
    this._modifiers = {
      shift: e.shiftKey,
      ctrl: e.ctrlKey || e.metaKey,
      alt: e.altKey,
    };
  }

  // ===========================================================================
  // EVENT HANDLERS
  // ===========================================================================

  private _handlePointerDown(e: PointerEvent): void {
    if (this._disabled) return;

    // Only track primary pointer (ignore multi-touch)
    if (this._activePointerId !== null) return;

    this._activePointerId = e.pointerId;
    this._updateModifiers(e);
    const point = this._getCanvasPoint(e);

    // Capture pointer for reliable tracking
    this._canvas.setPointerCapture(e.pointerId);
    this._attachWindowEvents();

    this._callbacks.onStart(point, this._modifiers);
  }

  private _handlePointerMove(e: PointerEvent): void {
    if (this._disabled) return;
    if (this._activePointerId !== e.pointerId) return;

    this._updateModifiers(e);
    const point = this._getCanvasPoint(e);

    this._callbacks.onMove(point, this._modifiers);
  }

  private _handlePointerUp(e: PointerEvent): void {
    if (this._activePointerId !== e.pointerId) return;

    this._updateModifiers(e);
    const point = this._getCanvasPoint(e);

    this._canvas.releasePointerCapture(e.pointerId);
    this._activePointerId = null;
    this._detachWindowEvents();

    this._callbacks.onEnd(point, this._modifiers);
  }

  private _handlePointerCancel(e: PointerEvent): void {
    if (this._activePointerId !== e.pointerId) return;

    this._canvas.releasePointerCapture(e.pointerId);
    this._activePointerId = null;
    this._detachWindowEvents();

    // Treat cancel as end at current position
    const point = this._getCanvasPoint(e);
    this._callbacks.onEnd(point, this._modifiers);
  }

  private _handleDblClick(e: MouseEvent): void {
    if (this._disabled) return;

    this._updateModifiers(e);
    const rect = this._canvas.getBoundingClientRect();
    const point: PointerPoint = {
      x: (e.clientX - rect.left) / this._scale,
      y: (e.clientY - rect.top) / this._scale,
      pressure: 1,
      pointerType: "mouse",
    };

    this._callbacks.onDblClick(point, this._modifiers);
  }

  /**
   * Handle canvas pointermove (fires onHover when not dragging)
   * Used for multi-click tools like polygon that need cursor tracking between clicks
   */
  private _handleCanvasPointerMove(e: PointerEvent): void {
    if (this._disabled) return;
    // Only fire hover when NOT actively dragging
    if (this._activePointerId !== null) return;

    this._updateModifiers(e);
    const point = this._getCanvasPoint(e);

    this._callbacks.onHover?.(point, this._modifiers);
  }

  // ===========================================================================
  // PUBLIC API
  // ===========================================================================

  /** Check if a pointer operation is in progress */
  isActive(): boolean {
    return this._activePointerId !== null;
  }

  /** Get current modifier state */
  getModifiers(): DrawModifiers {
    return { ...this._modifiers };
  }

  /** Set scale factor for coordinate conversion */
  setScale(scale: number): void {
    this._scale = scale;
  }

  /** Enable/disable pointer interactions */
  setDisabled(disabled: boolean): void {
    this._disabled = disabled;
    if (disabled && this._activePointerId !== null) {
      this._activePointerId = null;
      this._detachWindowEvents();
    }
  }

  /** Cancel current pointer operation */
  cancel(): void {
    if (this._activePointerId !== null) {
      this._canvas.releasePointerCapture(this._activePointerId);
      this._activePointerId = null;
      this._detachWindowEvents();
    }
  }
}

/**
 * Create a new PointerDriver instance
 */
export function createPointerDriver(
  canvas: HTMLCanvasElement,
  callbacks: PointerDriverCallbacks,
  options?: PointerDriverOptions
): PointerDriver {
  return new PointerDriver(canvas, callbacks, options);
}
