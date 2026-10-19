/**
 * MouseDriver - Handles mouse event management for canvas interactions
 *
 * Responsibilities:
 * - Attaching/detaching mouse event listeners
 * - Coordinate conversion (client → canvas)
 * - Tracking modifier keys (shift, ctrl, alt)
 * - Managing window-level listeners during drag operations
 */

import type { DrawModifiers, Point } from "../types";

// =============================================================================
// TYPES
// =============================================================================

export interface MouseDriverCallbacks {
  onStart: (point: Point, modifiers: DrawModifiers) => void;
  onMove: (point: Point, modifiers: DrawModifiers) => void;
  onEnd: (point: Point, modifiers: DrawModifiers) => void;
  onDblClick: (point: Point, modifiers: DrawModifiers) => void;
  /** Called on mouse move when not dragging (for multi-click tools like polygon) */
  onHover?: (point: Point, modifiers: DrawModifiers) => void;
}

export interface MouseDriverOptions {
  /** Scale factor for coordinate conversion */
  scale?: number;
  /** Whether interactions are disabled */
  disabled?: boolean;
  /** Clamp points to canvas bounds (default: true) */
  clamp?: boolean;
}

// =============================================================================
// MOUSE DRIVER
// =============================================================================

export class MouseDriver {
  private _canvas: HTMLCanvasElement;
  private _callbacks: MouseDriverCallbacks;

  // State
  private _isActive = false;
  private _scale = 1;
  private _disabled = false;
  private _clamp = true;
  private _modifiers: DrawModifiers = { shift: false, ctrl: false, alt: false };

  // Bound handlers (for cleanup)
  private _boundHandleMouseDown: (e: MouseEvent) => void;
  private _boundHandleMouseMove: (e: MouseEvent) => void;
  private _boundHandleMouseUp: (e: MouseEvent) => void;
  private _boundHandleDblClick: (e: MouseEvent) => void;
  private _boundHandleCanvasMouseMove: (e: MouseEvent) => void;

  constructor(
    canvas: HTMLCanvasElement,
    callbacks: MouseDriverCallbacks,
    options: MouseDriverOptions = {}
  ) {
    this._canvas = canvas;
    this._callbacks = callbacks;
    this._scale = options.scale ?? 1;
    this._disabled = options.disabled ?? false;
    this._clamp = options.clamp ?? true;

    // Bind handlers
    this._boundHandleMouseDown = this._handleMouseDown.bind(this);
    this._boundHandleMouseMove = this._handleMouseMove.bind(this);
    this._boundHandleMouseUp = this._handleMouseUp.bind(this);
    this._boundHandleDblClick = this._handleDblClick.bind(this);
    this._boundHandleCanvasMouseMove = this._handleCanvasMouseMove.bind(this);

    // Attach canvas events
    this._attachEvents();
  }

  // ===========================================================================
  // LIFECYCLE
  // ===========================================================================

  /** Cleanup and detach all event listeners */
  destroy(): void {
    this._detachEvents();
    this._detachWindowEvents();
  }

  private _attachEvents(): void {
    this._canvas.addEventListener("mousedown", this._boundHandleMouseDown);
    this._canvas.addEventListener("dblclick", this._boundHandleDblClick);
    this._canvas.addEventListener(
      "mousemove",
      this._boundHandleCanvasMouseMove
    );
  }

  private _detachEvents(): void {
    this._canvas.removeEventListener("mousedown", this._boundHandleMouseDown);
    this._canvas.removeEventListener("dblclick", this._boundHandleDblClick);
    this._canvas.removeEventListener(
      "mousemove",
      this._boundHandleCanvasMouseMove
    );
  }

  private _attachWindowEvents(): void {
    window.addEventListener("mousemove", this._boundHandleMouseMove);
    window.addEventListener("mouseup", this._boundHandleMouseUp);
  }

  private _detachWindowEvents(): void {
    window.removeEventListener("mousemove", this._boundHandleMouseMove);
    window.removeEventListener("mouseup", this._boundHandleMouseUp);
  }

  // ===========================================================================
  // COORDINATE CONVERSION
  // ===========================================================================

  private _getCanvasPoint(clientX: number, clientY: number): Point {
    const rect = this._canvas.getBoundingClientRect();
    let x = (clientX - rect.left) / this._scale;
    let y = (clientY - rect.top) / this._scale;

    if (this._clamp) {
      // Clamp to LOGICAL bounds (canvas pixel size / scale)
      const logicalWidth = this._canvas.width / this._scale;
      const logicalHeight = this._canvas.height / this._scale;
      x = Math.max(0, Math.min(logicalWidth, x));
      y = Math.max(0, Math.min(logicalHeight, y));
    }

    return { x, y };
  }

  private _updateModifiers(e: MouseEvent): void {
    this._modifiers = {
      shift: e.shiftKey,
      ctrl: e.ctrlKey || e.metaKey,
      alt: e.altKey,
    };
  }

  // ===========================================================================
  // EVENT HANDLERS
  // ===========================================================================

  private _handleMouseDown(e: MouseEvent): void {
    if (this._disabled) return;

    this._updateModifiers(e);
    const point = this._getCanvasPoint(e.clientX, e.clientY);

    this._isActive = true;
    this._attachWindowEvents();

    this._callbacks.onStart(point, this._modifiers);
  }

  private _handleMouseMove(e: MouseEvent): void {
    if (!this._isActive || this._disabled) return;

    this._updateModifiers(e);
    const point = this._getCanvasPoint(e.clientX, e.clientY);

    this._callbacks.onMove(point, this._modifiers);
  }

  private _handleMouseUp(e: MouseEvent): void {
    if (!this._isActive) return;

    this._updateModifiers(e);
    const point = this._getCanvasPoint(e.clientX, e.clientY);

    this._isActive = false;
    this._detachWindowEvents();

    this._callbacks.onEnd(point, this._modifiers);
  }

  private _handleDblClick(e: MouseEvent): void {
    if (this._disabled) return;

    this._updateModifiers(e);
    const point = this._getCanvasPoint(e.clientX, e.clientY);

    this._callbacks.onDblClick(point, this._modifiers);
  }

  /**
   * Handle canvas mousemove (fires onHover when not dragging)
   * Used for multi-click tools like polygon that need cursor tracking between clicks
   */
  private _handleCanvasMouseMove(e: MouseEvent): void {
    if (this._disabled) return;
    // Only fire hover when NOT actively dragging (dragging uses window mousemove)
    if (this._isActive) return;

    this._updateModifiers(e);
    const point = this._getCanvasPoint(e.clientX, e.clientY);

    this._callbacks.onHover?.(point, this._modifiers);
  }

  // ===========================================================================
  // PUBLIC API
  // ===========================================================================

  /** Check if a drag operation is in progress */
  isActive(): boolean {
    return this._isActive;
  }

  /** Get current modifier state */
  getModifiers(): DrawModifiers {
    return { ...this._modifiers };
  }

  /** Set scale factor for coordinate conversion */
  setScale(scale: number): void {
    this._scale = scale;
  }

  /** Enable/disable mouse interactions */
  setDisabled(disabled: boolean): void {
    this._disabled = disabled;
    if (disabled && this._isActive) {
      this._isActive = false;
      this._detachWindowEvents();
    }
  }

  /** Enable/disable clamping to canvas bounds */
  setClamp(clamp: boolean): void {
    this._clamp = clamp;
  }

  /** Cancel current drag operation */
  cancel(): void {
    if (this._isActive) {
      this._isActive = false;
      this._detachWindowEvents();
    }
  }
}

/**
 * Create a new MouseDriver instance
 */
export function createMouseDriver(
  canvas: HTMLCanvasElement,
  callbacks: MouseDriverCallbacks,
  options?: MouseDriverOptions
): MouseDriver {
  return new MouseDriver(canvas, callbacks, options);
}
