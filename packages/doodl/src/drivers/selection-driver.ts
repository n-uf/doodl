/**
 * SelectionDriver - Handles DOM text selection for text highlight tool
 *
 * Captures text selection from underlying DOM content and converts
 * selection rectangles to canvas coordinates for highlight rendering.
 *
 * Features:
 * - Tracks DOM text selection events
 * - Converts DOMRect to canvas-relative Bounds
 * - Handles multi-line selections (multiple rects)
 * - Validates rects against actual text spans (filters phantom rects)
 * - Clears native selection after capture
 */

import { mergeHighlightRects } from "../shapes/text-highlight/merge";
import type { Bounds, DrawModifiers, Point } from "../types";
import {
  createDragBoundsTracker,
  createSpanRectsCache,
  isLegitimateTextRect,
  isSelectionWithinContainer,
  isVerticallyBetween,
  rectsOverlap,
  type DragBoundsTracker,
  type SpanRectsCache,
} from "./utils";

// =============================================================================
// TYPES
// =============================================================================

export interface SelectionDriverCallbacks {
  /** Called when selection starts */
  onSelectionStart?: (point: Point) => void;
  /** Called as selection changes (for preview) */
  onSelectionChange?: (rects: Bounds[], text: string) => void;
  /** Called when selection is finalized */
  onSelectionEnd: (rects: Bounds[], text: string) => void;
  /** Called if selection cancelled */
  onSelectionCancel?: () => void;
}

export interface SelectionDriverOptions {
  /** Scale factor for coordinate conversion */
  scale?: number;
  /** Minimum selection length to register (chars) */
  minSelectionLength?: number;
  /** Clear native selection after capture */
  clearNativeSelection?: boolean;
  /** Merge overlapping/adjacent highlight rects (default: true) */
  mergeHighlights?: boolean;
}

// =============================================================================
// SELECTION DRIVER
// =============================================================================

export class SelectionDriver {
  private _canvas: HTMLCanvasElement;
  private _textContainer: HTMLElement;
  private _callbacks: SelectionDriverCallbacks;

  // Configuration
  private _scale = 1;
  private _minSelectionLength: number;
  private _clearNativeSelection: boolean;
  private _mergeHighlights: boolean;

  // State
  private _isEnabled = false;
  private _isSelecting = false;
  private _hasPendingFinalization = false; // Guard against double RAF finalization
  private _modifiers: DrawModifiers = { shift: false, ctrl: false, alt: false };

  // Domain utilities
  private _dragTracker: DragBoundsTracker;
  private _spanRectsCache: SpanRectsCache;

  // Bound handlers
  private _boundHandleMouseDown: (e: MouseEvent) => void;
  private _boundHandleMouseUp: (e: MouseEvent) => void;
  private _boundHandleMouseMove: (e: MouseEvent) => void;
  private _boundHandleSelectionChange: () => void;

  constructor(
    canvas: HTMLCanvasElement,
    textContainer: HTMLElement,
    callbacks: SelectionDriverCallbacks,
    options: SelectionDriverOptions = {}
  ) {
    this._canvas = canvas;
    this._textContainer = textContainer;
    this._callbacks = callbacks;

    // Configuration
    this._scale = options.scale ?? 1;
    this._minSelectionLength = options.minSelectionLength ?? 1;
    this._clearNativeSelection = options.clearNativeSelection ?? true;
    this._mergeHighlights = options.mergeHighlights ?? true;

    // Initialize domain utilities
    this._dragTracker = createDragBoundsTracker();
    this._spanRectsCache = createSpanRectsCache(textContainer);

    // Bind handlers
    this._boundHandleMouseDown = this._handleMouseDown.bind(this);
    this._boundHandleMouseUp = this._handleMouseUp.bind(this);
    this._boundHandleMouseMove = this._handleMouseMove.bind(this);
    this._boundHandleSelectionChange = this._handleSelectionChange.bind(this);
  }

  // ===========================================================================
  // LIFECYCLE
  // ===========================================================================

  /** Enable selection tracking */
  enable(): void {
    const LOG = "[SelectionDriver]";

    if (this._isEnabled) {
      console.log(
        `${LOG} ENABLE_SKIP`,
        JSON.stringify({ reason: "already-enabled" })
      );
      return;
    }
    this._isEnabled = true;

    // Make canvas transparent to pointer events
    this._canvas.style.pointerEvents = "none";

    // Enable text selection on text layer
    // Note: CSS patching (user-select manipulation) was removed because:
    // - user-select only prevents selection START, not EXTENSION
    // - Browser ignores user-select during drag extension
    // - No CSS/JS workaround exists for containing selection
    // - The real fix is post-processing filters (drag bounds, container-size, span validation)
    this._textContainer.style.userSelect = "text";
    this._textContainer.style.cursor = "text";

    // Attach listeners
    this._textContainer.addEventListener(
      "mousedown",
      this._boundHandleMouseDown,
      { capture: true }
    );
    document.addEventListener("mouseup", this._boundHandleMouseUp, {
      capture: true,
    });
    document.addEventListener("mousemove", this._boundHandleMouseMove, {
      passive: true,
    });
    document.addEventListener(
      "selectionchange",
      this._boundHandleSelectionChange
    );

    console.log(`${LOG} ENABLED`, JSON.stringify({ scale: this._scale }));
  }

  /** Disable selection tracking */
  disable(): void {
    if (!this._isEnabled) return;
    this._isEnabled = false;

    // Restore canvas pointer events
    this._canvas.style.pointerEvents = "auto";

    // Restore text layer styles
    this._textContainer.style.userSelect = "";
    this._textContainer.style.cursor = "default";

    // Detach listeners
    this._textContainer.removeEventListener(
      "mousedown",
      this._boundHandleMouseDown,
      { capture: true }
    );
    document.removeEventListener("mouseup", this._boundHandleMouseUp, {
      capture: true,
    });
    document.removeEventListener("mousemove", this._boundHandleMouseMove);
    document.removeEventListener(
      "selectionchange",
      this._boundHandleSelectionChange
    );

    // Reset state
    this._isSelecting = false;
    this._spanRectsCache.clear();
    this._dragTracker.reset();
  }

  /** Cleanup resources */
  destroy(): void {
    this.disable();
  }

  // ===========================================================================
  // EVENT HANDLERS
  // ===========================================================================

  private _handleMouseDown(e: MouseEvent): void {
    this._isSelecting = true;
    this._updateModifiers(e);

    // Cancel any pending finalization from previous gesture
    // This handles double-click: click2's mousedown arrives before click1's RAF
    this._hasPendingFinalization = false;

    // Clear span rects cache for fresh calculation
    this._spanRectsCache.clear();

    // Start tracking drag bounds
    this._dragTracker.start(e.clientY);

    // Notify callback
    const point = this._getPoint(e);
    this._callbacks.onSelectionStart?.(point);
  }

  private _handleMouseMove(e: MouseEvent): void {
    if (!this._isSelecting) return;

    // Update drag bounds tracking
    this._dragTracker.update(e.clientY);
  }

  private _handleMouseUp(e: MouseEvent): void {
    if (!this._isSelecting) return;
    this._isSelecting = false;
    this._updateModifiers(e);

    // Final update of drag bounds
    this._dragTracker.update(e.clientY);

    // Mark pending finalization (guards against double RAF on double-click)
    this._hasPendingFinalization = true;

    // IMPORTANT: Use requestAnimationFrame to allow browser's double-click
    // word selection to complete. The Selection object may not reflect the
    // full word selection immediately after mouseup during a double-click.
    requestAnimationFrame(() => {
      this._finalizeSelection();
    });
  }

  /**
   * Finalize the current selection (called after RAF to allow dblclick selection)
   */
  private _finalizeSelection(): void {
    // Guard against double finalization (can happen on fast double-click
    // where both RAFs run after the word selection is set)
    if (!this._hasPendingFinalization) {
      return;
    }
    this._hasPendingFinalization = false;

    // Capture selection
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      this._endSelection(true);
      return;
    }

    // Check if selection is within our container
    if (!isSelectionWithinContainer(selection, this._textContainer)) {
      this._endSelection(true);
      return;
    }

    // Check minimum selection length
    const text = selection.toString();
    if (text.length < this._minSelectionLength) {
      this._endSelection(true);
      return;
    }

    // Get filtered selection rectangles
    let rects = this._getSelectionRects(selection);
    if (rects.length === 0) {
      this._endSelection(true);
      return;
    }

    // Merge overlapping/adjacent rects if enabled
    if (this._mergeHighlights) {
      rects = mergeHighlightRects(rects);
    }

    // Emit selection
    this._callbacks.onSelectionEnd(rects, text);

    // End selection (no cancel callback)
    this._endSelection(false);

    // Clear native selection
    if (this._clearNativeSelection) {
      requestAnimationFrame(() => {
        selection.removeAllRanges();
      });
    }
  }

  private _handleSelectionChange(): void {
    if (!this._isSelecting) return;

    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    if (!isSelectionWithinContainer(selection, this._textContainer)) return;

    const text = selection.toString();
    let rects = this._getSelectionRects(selection);

    if (rects.length > 0) {
      // Merge for preview as well
      if (this._mergeHighlights) {
        rects = mergeHighlightRects(rects);
      }
      this._callbacks.onSelectionChange?.(rects, text);
    }
  }

  // ===========================================================================
  // SELECTION PROCESSING
  // ===========================================================================

  /**
   * End the current selection gesture
   */
  private _endSelection(cancelled: boolean): void {
    this._dragTracker.reset();
    if (cancelled) {
      this._callbacks.onSelectionCancel?.();
    }
  }

  /**
   * Get filtered selection rectangles
   * Applies drag bounds and span validation filters
   */
  private _getSelectionRects(selection: Selection): Bounds[] {
    const LOG = "[SelectionDriver]";

    if (selection.rangeCount === 0) return [];

    const range = selection.getRangeAt(0);
    const clientRects = range.getClientRects();

    // Reference element for coordinate conversion
    const refRect = this._textContainer.getBoundingClientRect();
    const containerWidth = refRect.width;
    const containerHeight = refRect.height;

    // Get span rects for validation
    const spanRects = this._spanRectsCache.getRects();
    const hasSpans = spanRects.length > 0;
    const dragBounds = this._dragTracker.getBounds();

    // Log context as JSON
    console.log(
      `${LOG} PROCESS_RECTS`,
      JSON.stringify({
        clientRectsCount: clientRects.length,
        spanRectsCount: spanRects.length,
        container: {
          top: Math.round(refRect.top),
          bottom: Math.round(refRect.bottom),
          height: Math.round(containerHeight),
          width: Math.round(containerWidth),
        },
        dragBounds: dragBounds
          ? {
              startY: Math.round(dragBounds.startY),
              minY: Math.round(dragBounds.minY),
              maxY: Math.round(dragBounds.maxY),
            }
          : null,
        spanRectsSample: spanRects.slice(0, 3).map((r) => ({
          top: Math.round(r.top),
          bottom: Math.round(r.bottom),
          height: Math.round(r.height),
        })),
      })
    );

    const bounds: Bounds[] = [];
    const decisions: Array<{
      idx: number;
      rect: { top: number; bottom: number; height: number; width: number };
      decision: string;
      reason?: string;
      details?: Record<string, unknown>;
    }> = [];

    for (let i = 0; i < clientRects.length; i++) {
      const rect = clientRects[i]!;
      const rectData = {
        top: Math.round(rect.top),
        bottom: Math.round(rect.bottom),
        height: Math.round(rect.height),
        width: Math.round(rect.width),
      };

      // Filter: Zero-size rects (br elements, line breaks)
      if (rect.width < 1 || rect.height < 1) {
        decisions.push({
          idx: i,
          rect: rectData,
          decision: "REJECT",
          reason: "zero-size",
        });
        continue;
      }

      // Filter: Rects outside container bounds
      if (
        rect.right < refRect.left ||
        rect.left > refRect.right ||
        rect.bottom < refRect.top ||
        rect.top > refRect.bottom
      ) {
        decisions.push({
          idx: i,
          rect: rectData,
          decision: "REJECT",
          reason: "outside-container",
        });
        continue;
      }

      // Filter: Rects outside drag bounds (phantom rects from greedy selection)
      if (!this._dragTracker.isRectWithinBounds(rect)) {
        decisions.push({
          idx: i,
          rect: rectData,
          decision: "REJECT",
          reason: "outside-drag-bounds",
          details: {
            dragMinY: dragBounds?.minY,
            dragMaxY: dragBounds?.maxY,
            rectTop: Math.round(rect.top),
            rectBottom: Math.round(rect.bottom),
          },
        });
        continue;
      }

      // Filter: Container-sized rects (phantom selection covering entire page)
      const containerHeightRatio = rect.height / containerHeight;
      if (containerHeightRatio > 0.5) {
        decisions.push({
          idx: i,
          rect: rectData,
          decision: "REJECT",
          reason: "container-sized",
          details: {
            ratio: containerHeightRatio.toFixed(2),
            threshold: 0.5,
          },
        });
        continue;
      }

      // Filter: Span validation (for PDF text layers)
      if (hasSpans) {
        // Find which spans this rect overlaps
        const overlappingSpans = spanRects.filter((spanRect) =>
          rectsOverlap(rect, spanRect)
        );
        const legitimateSpans = overlappingSpans.filter((spanRect) =>
          isLegitimateTextRect(rect, spanRect)
        );
        const overlapsSpan = legitimateSpans.length > 0;

        if (!overlapsSpan) {
          // Check if it's a valid connector between lines
          const isConnector = isVerticallyBetween(rect, spanRects);
          if (!isConnector) {
            decisions.push({
              idx: i,
              rect: rectData,
              decision: "REJECT",
              reason: "no-span-overlap",
              details: {
                overlappingSpansCount: overlappingSpans.length,
                legitimateSpansCount: legitimateSpans.length,
                isConnector,
                overlappingSpans: overlappingSpans.slice(0, 2).map((s) => ({
                  top: Math.round(s.top),
                  bottom: Math.round(s.bottom),
                  height: Math.round(s.height),
                })),
              },
            });
            continue;
          } else {
            // Accepted as connector
            decisions.push({
              idx: i,
              rect: rectData,
              decision: "ACCEPT",
              reason: "connector",
            });
          }
        } else {
          // Accepted as legitimate text rect
          decisions.push({
            idx: i,
            rect: rectData,
            decision: "ACCEPT",
            reason: "span-overlap",
            details: {
              legitimateSpansCount: legitimateSpans.length,
            },
          });
        }
      } else {
        // Fallback for non-PDF text layers
        const maxLineHeight = 100 * this._scale;
        if (rect.height > maxLineHeight) {
          decisions.push({
            idx: i,
            rect: rectData,
            decision: "REJECT",
            reason: "too-tall",
            details: { maxLineHeight },
          });
          continue;
        }
        const rectArea = rect.width * rect.height;
        const containerArea = containerWidth * containerHeight;
        if (rectArea > containerArea * 0.5) {
          decisions.push({
            idx: i,
            rect: rectData,
            decision: "REJECT",
            reason: "too-large",
            details: { areaRatio: (rectArea / containerArea).toFixed(2) },
          });
          continue;
        }
        decisions.push({
          idx: i,
          rect: rectData,
          decision: "ACCEPT",
          reason: "fallback-valid",
        });
      }

      // Convert to logical coordinates
      bounds.push({
        x: (rect.left - refRect.left) / this._scale,
        y: (rect.top - refRect.top) / this._scale,
        width: rect.width / this._scale,
        height: rect.height / this._scale,
      });
    }

    // Summary log
    const accepted = decisions.filter((d) => d.decision === "ACCEPT");
    const rejected = decisions.filter((d) => d.decision === "REJECT");
    const rejectionReasons = rejected.reduce(
      (acc, d) => {
        acc[d.reason ?? "unknown"] = (acc[d.reason ?? "unknown"] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    console.log(
      `${LOG} RECTS_RESULT`,
      JSON.stringify({
        accepted: accepted.length,
        rejected: rejected.length,
        rejectionReasons,
        decisions: decisions.map((d) => ({
          idx: d.idx,
          yRange: `${d.rect.top}-${d.rect.bottom}`,
          decision: d.decision,
          reason: d.reason,
          ...(d.details ? { details: d.details } : {}),
        })),
        acceptedBounds: bounds.map((b) => ({
          y: Math.round(b.y),
          height: Math.round(b.height),
        })),
      })
    );

    return bounds;
  }

  // ===========================================================================
  // HELPERS
  // ===========================================================================

  private _updateModifiers(e: MouseEvent): void {
    this._modifiers = {
      shift: e.shiftKey,
      ctrl: e.ctrlKey || e.metaKey,
      alt: e.altKey,
    };
  }

  private _getPoint(e: MouseEvent): Point {
    const canvasRect = this._canvas.getBoundingClientRect();
    return {
      x: (e.clientX - canvasRect.left) / this._scale,
      y: (e.clientY - canvasRect.top) / this._scale,
    };
  }

  // ===========================================================================
  // PUBLIC API
  // ===========================================================================

  /** Check if selection mode is enabled */
  isEnabled(): boolean {
    return this._isEnabled;
  }

  /** Check if currently selecting */
  isSelecting(): boolean {
    return this._isSelecting;
  }

  /** Set scale factor */
  setScale(scale: number): void {
    this._scale = scale;
  }

  /** Get current modifiers */
  getModifiers(): DrawModifiers {
    return { ...this._modifiers };
  }
}

// =============================================================================
// FACTORY
// =============================================================================

/**
 * Create a new SelectionDriver instance
 */
export function createSelectionDriver(
  canvas: HTMLCanvasElement,
  textContainer: HTMLElement,
  callbacks: SelectionDriverCallbacks,
  options?: SelectionDriverOptions
): SelectionDriver {
  return new SelectionDriver(canvas, textContainer, callbacks, options);
}
