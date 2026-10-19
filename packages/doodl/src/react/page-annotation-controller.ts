/**
 * PageAnnotationController - Vanilla multi-page document annotation engine
 *
 * Wraps Doodl with page-specific coordinate transformation.
 * Stores shapes in page coordinates (native units) for portability.
 * Transforms to/from canvas coordinates based on scale.
 */

import {
  createDoodl,
  DEFAULT_SHAPE_STYLE,
  type ActivationAnimationType,
  type Doodl,
  type DrawShape,
  type DrawTool,
  type PingOptions,
  type ShapeStyle,
} from "@n-uf/doodl";
import type {
  PageAnnotationControllerOptions,
  PageAnnotationEventName,
  PageAnnotationEvents,
} from "./types";

type EventCallback<T extends PageAnnotationEventName> = PageAnnotationEvents[T];

export class PageAnnotationController {
  // Doodl instance
  private _doodl: Doodl | null = null;
  private _canvas: HTMLCanvasElement | null = null;
  private _textLayer: HTMLElement | null = null;

  // Page dimensions (constant, in native units)
  private _pageWidth: number;
  private _pageHeight: number;

  // Current scale
  private _scale: number;

  // Source of truth: shapes in page coordinates
  private _pageShapes: DrawShape[] = [];

  // Tool and style
  private _tool: DrawTool;
  private _style: ShapeStyle;

  // Options
  private _mergeHighlights: boolean;
  private _readOnly: boolean;
  private _enablePing: boolean;
  private _defaultActivationAnimation: ActivationAnimationType;

  // Flag to prevent feedback loops during transform
  private _isTransforming = false;

  // Event listeners
  private _listeners = new Map<
    PageAnnotationEventName,
    Set<EventCallback<PageAnnotationEventName>>
  >();

  constructor(options: PageAnnotationControllerOptions) {
    this._pageWidth = options.pageWidth;
    this._pageHeight = options.pageHeight;
    this._scale = options.scale ?? 1;
    this._pageShapes = options.initialShapes ?? [];
    this._tool = options.initialTool ?? "select";
    this._style = options.initialStyle ?? { ...DEFAULT_SHAPE_STYLE };
    this._mergeHighlights = options.mergeHighlights ?? true;
    this._readOnly = options.readOnly ?? false;
    this._enablePing = options.enablePing ?? true;
    this._defaultActivationAnimation =
      options.defaultActivationAnimation ?? "ping";
  }

  // ═══════════════════════════════════════════════════════════════
  // LIFECYCLE
  // ═══════════════════════════════════════════════════════════════

  /**
   * Attach to a canvas element
   */
  attach(canvas: HTMLCanvasElement, textLayer?: HTMLElement): void {
    if (this._doodl) {
      this.detach();
    }

    this._canvas = canvas;
    this._textLayer = textLayer ?? null;

    // Set initial canvas dimensions (logical pixels)
    // RenderDriver will handle DPR scaling in its constructor
    const logicalWidth = Math.round(this._pageWidth * this._scale);
    const logicalHeight = Math.round(this._pageHeight * this._scale);
    canvas.width = logicalWidth;
    canvas.height = logicalHeight;

    // Create Doodl instance with current scale
    // RenderDriver will configure canvas for DPR-aware rendering
    this._doodl = createDoodl(canvas, {
      backgroundColor: "transparent",
      textLayer: textLayer,
      initialTool: this._tool,
      initialStyle: this._style,
      scale: this._scale, // CRITICAL: Pass scale for correct coordinate handling
      mergeHighlights: this._mergeHighlights,
      readOnly: this._readOnly,
      enablePing: this._enablePing,
      defaultActivationAnimation: this._defaultActivationAnimation,
    });

    // Load existing shapes (page → canvas coords)
    this._syncShapesToCanvas();

    // Forward events
    this._doodl.on("shapesChange", this._handleShapesChange.bind(this));
    this._doodl.on("toolChange", (tool) => this._emit("toolChange", tool));
    this._doodl.on("styleChange", (style) => this._emit("styleChange", style));
    this._doodl.on("historyChange", (state) =>
      this._emit("historyChange", state)
    );
    this._doodl.on("selectionChange", (ids) =>
      this._emit("selectionChange", ids)
    );
  }

  /**
   * Detach from canvas
   */
  detach(): void {
    this._doodl?.destroy();
    this._doodl = null;
    this._canvas = null;
    this._textLayer = null;
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.detach();
    this._listeners.clear();
  }

  // ═══════════════════════════════════════════════════════════════
  // SCALE
  // ═══════════════════════════════════════════════════════════════

  /**
   * Get current scale
   */
  getScale(): number {
    return this._scale;
  }

  /**
   * Get the canvas element this controller is attached to
   */
  getCanvas(): HTMLCanvasElement | null {
    return this._canvas;
  }

  /**
   * Set scale factor (triggers coordinate re-transform)
   */
  setScale(scale: number): void {
    if (scale === this._scale) return;
    this._scale = scale;

    // Resize canvas with DPR-aware dimensions
    // Use doodl.setDimensions() to properly handle Retina displays
    const logicalWidth = Math.round(this._pageWidth * scale);
    const logicalHeight = Math.round(this._pageHeight * scale);
    this._doodl?.setDimensions(logicalWidth, logicalHeight);

    // Update Doodl scale for SelectionDriver
    this._doodl?.setScale(scale);

    // Re-transform shapes
    this._syncShapesToCanvas();
  }

  // ═══════════════════════════════════════════════════════════════
  // SHAPES (always page coordinates externally)
  // ═══════════════════════════════════════════════════════════════

  /**
   * Get all shapes in page coordinates
   */
  getShapes(): DrawShape[] {
    return [...this._pageShapes];
  }

  /**
   * Set shapes (expects page coordinates)
   */
  setShapes(shapes: DrawShape[]): void {
    this._pageShapes = [...shapes];
    this._syncShapesToCanvas();
    this._emit("shapesChange", this._pageShapes);
  }

  /**
   * Add a shape (expects page coordinates)
   */
  addShape(shape: DrawShape): void {
    this._pageShapes = [...this._pageShapes, shape];
    this._syncShapesToCanvas();
    this._emit("shapesChange", this._pageShapes);
  }

  /**
   * Clear all shapes
   */
  clearShapes(): void {
    this._pageShapes = [];
    this._syncShapesToCanvas();
    this._emit("shapesChange", this._pageShapes);
  }

  // ═══════════════════════════════════════════════════════════════
  // TOOL & STYLE
  // ═══════════════════════════════════════════════════════════════

  /**
   * Get current tool
   */
  getTool(): DrawTool {
    return this._doodl?.getTool() ?? this._tool;
  }

  /**
   * Set current tool
   */
  setTool(tool: DrawTool): void {
    this._tool = tool;
    this._doodl?.setTool(tool);
  }

  /**
   * Get current style
   */
  getStyle(): ShapeStyle {
    return this._doodl?.getStyle() ?? this._style;
  }

  /**
   * Set current style
   */
  setStyle(style: Partial<ShapeStyle>): void {
    this._style = { ...this._style, ...style };
    this._doodl?.setStyle(style);
  }

  // ═══════════════════════════════════════════════════════════════
  // TEXT LAYER
  // ═══════════════════════════════════════════════════════════════

  /**
   * Set text layer for text-highlight tool
   */
  setTextLayer(textLayer: HTMLElement): void {
    this._textLayer = textLayer;
    this._doodl?.setTextLayer(textLayer);
  }

  /**
   * Clear text layer
   */
  clearTextLayer(): void {
    this._textLayer = null;
    this._doodl?.clearTextLayer();
  }

  // ═══════════════════════════════════════════════════════════════
  // UNDO/REDO
  // ═══════════════════════════════════════════════════════════════

  /**
   * Undo last action
   */
  undo(): boolean {
    const result = this._doodl?.undo() ?? false;
    if (result) {
      // Sync back to page coords
      this._syncShapesFromCanvas();
    }
    return result;
  }

  /**
   * Redo last undone action
   */
  redo(): boolean {
    const result = this._doodl?.redo() ?? false;
    if (result) {
      // Sync back to page coords
      this._syncShapesFromCanvas();
    }
    return result;
  }

  /**
   * Check if undo is available
   */
  canUndo(): boolean {
    return this._doodl?.canUndo() ?? false;
  }

  /**
   * Check if redo is available
   */
  canRedo(): boolean {
    return this._doodl?.canRedo() ?? false;
  }

  // ═══════════════════════════════════════════════════════════════
  // SELECTION
  // ═══════════════════════════════════════════════════════════════

  /**
   * Get selected shape IDs
   */
  getSelectedIds(): string[] {
    return this._doodl?.getSelectedIds() ?? [];
  }

  /**
   * Select shapes by ID
   */
  select(ids: string[]): void {
    this._doodl?.select(ids);
  }

  /**
   * Delete selected shapes
   */
  deleteSelected(): void {
    this._doodl?.deleteSelected();
  }

  /**
   * Remove a shape by ID
   */
  removeShape(id: string): void {
    this._doodl?.removeShape(id);
    this._syncShapesFromCanvas();
  }

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════

  /**
   * Force re-render
   */
  render(): void {
    this._doodl?.render();
  }

  // ═══════════════════════════════════════════════════════════════
  // VISUAL EFFECTS
  // ═══════════════════════════════════════════════════════════════

  /**
   * Show a brief ping animation over a shape (expanding ring + glow).
   * Activation-frame animation for locate/select flash.
   * No-op when `enablePing` is false.
   */
  ping(shapeId: string, options?: PingOptions): void {
    this._doodl?.ping(shapeId, options);
  }

  /** Selection-only mode (draw/edit/drag/resize disabled; select still works) */
  setReadOnly(readOnly: boolean): void {
    this._readOnly = readOnly;
    this._doodl?.setReadOnly(readOnly);
  }

  isReadOnly(): boolean {
    return this._doodl?.isReadOnly() ?? this._readOnly;
  }

  /** Enable/disable activation-frame `ping()` animation */
  setEnablePing(enablePing: boolean): void {
    this._enablePing = enablePing;
    this._doodl?.setEnablePing(enablePing);
  }

  isPingEnabled(): boolean {
    return this._doodl?.isPingEnabled() ?? this._enablePing;
  }

  setDefaultActivationAnimation(type: ActivationAnimationType): void {
    this._defaultActivationAnimation = type;
    this._doodl?.setDefaultActivationAnimation(type);
  }

  getDefaultActivationAnimation(): ActivationAnimationType {
    return (
      this._doodl?.getDefaultActivationAnimation() ??
      this._defaultActivationAnimation
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // INTERNAL
  // ═══════════════════════════════════════════════════════════════

  /**
   * Sync page shapes to canvas
   *
   * Note: Doodl internally handles scale via MouseDriver/SelectionDriver (divide by scale)
   * and RenderDriver (ctx.scale). So Doodl's "logical" coords are already scale-independent
   * and equivalent to page coordinates. No additional transformation needed.
   */
  private _syncShapesToCanvas(): void {
    if (!this._doodl) return;

    this._isTransforming = true;
    // Doodl coords = page coords (no transformation needed)
    this._doodl.setShapes([...this._pageShapes]);
    this._isTransforming = false;
  }

  /**
   * Sync canvas shapes to page
   */
  private _syncShapesFromCanvas(): void {
    if (!this._doodl) return;

    // Doodl coords = page coords (no transformation needed)
    this._pageShapes = [...this._doodl.getShapes()];
  }

  /**
   * Handle shapes change from Doodl
   */
  private _handleShapesChange(canvasShapes: DrawShape[]): void {
    if (this._isTransforming) return;

    // Doodl coords = page coords (no transformation needed)
    this._pageShapes = [...canvasShapes];
    this._emit("shapesChange", this._pageShapes);
  }

  // ═══════════════════════════════════════════════════════════════
  // EVENTS
  // ═══════════════════════════════════════════════════════════════

  /**
   * Subscribe to an event
   */
  on<T extends PageAnnotationEventName>(
    event: T,
    callback: PageAnnotationEvents[T]
  ): void {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }
    this._listeners
      .get(event)!
      .add(callback as EventCallback<PageAnnotationEventName>);
  }

  /**
   * Unsubscribe from an event
   */
  off<T extends PageAnnotationEventName>(
    event: T,
    callback: PageAnnotationEvents[T]
  ): void {
    this._listeners
      .get(event)
      ?.delete(callback as EventCallback<PageAnnotationEventName>);
  }

  private _emit<T extends PageAnnotationEventName>(
    event: T,
    data: Parameters<PageAnnotationEvents[T]>[0]
  ): void {
    const callbacks = this._listeners.get(event);
    if (callbacks) {
      for (const cb of callbacks) {
        (cb as (arg: Parameters<PageAnnotationEvents[T]>[0]) => void)(data);
      }
    }
  }
}

/**
 * Create a new PageAnnotationController
 */
export function createPageAnnotationController(
  options: PageAnnotationControllerOptions
): PageAnnotationController {
  return new PageAnnotationController(options);
}
