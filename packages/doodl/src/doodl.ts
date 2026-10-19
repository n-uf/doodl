/**
 * Doodl - Vanilla canvas drawing engine
 *
 * A framework-agnostic drawing engine that manages:
 * - Shape state (add, update, remove, selection)
 * - Drawing tools (rect, ellipse, polygon, freehand)
 * - Mouse/keyboard event handling (via MouseDriver)
 * - Canvas rendering with RAF
 *
 * Can be used with any framework or vanilla JS.
 */

import type { KeyboardCommand, PingEffect, SelectionDriverOptions } from "./drivers";
import {
  HistoryDriver,
  KeyboardDriver,
  MouseDriver,
  RenderDriver,
  SelectionDriver,
  SpatialIndex,
} from "./drivers";
import {
  defaultColorForAnimation,
  defaultDurationForAnimation,
} from "./effects/activation-animation";
import type { ActivationAnimationType } from "./effects/activation-animation";

export type {
  ActivationAnimationFrame,
  ActivationAnimationRenderer,
  ActivationAnimationType,
  BuiltinActivationAnimation,
} from "./effects/activation-animation";
export {
  defaultColorForAnimation,
  defaultDurationForAnimation,
  getActivationAnimationRenderer,
  registerActivationAnimation,
} from "./effects/activation-animation";
import {
  createHighlightController,
  createSelectController,
  createTextController,
  createTextHighlightController,
  EllipseController,
  enforceShapeBounds,
  extractShapeText,
  filterPersistedShapes,
  filterSelectableShapes,
  filterTrackedShapes,
  findTopmostShapeAtPoint,
  FreehandController,
  getShapeBounds,
  isPointInShape,
  PolygonController,
  RectController,
  shapeWantsCapturedText,
} from "./shapes";
import type {
  ControllerAction,
  ControllerContext,
  DrawingController,
} from "./shapes/common/controllers";
import type { TextHighlightShape } from "./shapes/text-highlight";
import {
  createTextHighlightShape,
  DEFAULT_TEXT_HIGHLIGHT_STYLE,
  mergeWithExistingHighlights,
  subtractFromExistingHighlights,
} from "./shapes/text-highlight";
import type {
  Bounds,
  DoodlPerformanceConfig,
  DrawingState,
  DrawModifiers,
  DrawShape,
  DrawTool,
  Point,
  ShapeStyle,
} from "./types";
import {
  createPerformanceConfig,
  DEFAULT_SHAPE_STYLE,
  DRAWING_STATE_VERSION,
  generateShapeId,
  TOOL_CONFIGS,
} from "./types";
import type { BoundsPolicy } from "./types/bounds-policy";

export interface DoodlOptions {
  /** Initial drawing state */
  initialState?: DrawingState;
  /** Initial tool */
  initialTool?: DrawTool;
  /** Initial style */
  initialStyle?: ShapeStyle;
  /** Background color */
  backgroundColor?: string;
  /** Scale factor for rendering */
  scale?: number;
  /**
   * Selection-only mode (default: false).
   * Disables drawing, drag, resize, delete, and history mutations.
   * Pointer selection and programmatic `select()` still work.
   */
  readOnly?: boolean;
  /**
   * Allow activation-frame `ping()` animation (default: true).
   * When false, `ping()` is a no-op (locate/select still work).
   */
  enablePing?: boolean;
  /**
   * Default activation animation when `ping()` omits `type` (default: `"ping"`).
   * Built-ins: `"ping"` | `"locateFlash"` | `"pulse"`. Custom names via
   * `registerActivationAnimation()`.
   */
  defaultActivationAnimation?: ActivationAnimationType;
  /** Text layer element for text-highlight tool (optional) */
  textLayer?: HTMLElement;
  /** Selection driver options */
  selectionOptions?: Omit<SelectionDriverOptions, "scale">;
  /** Merge overlapping text highlight rects (default: true) */
  mergeHighlights?: boolean;
  /** Clamp mouse input to canvas bounds during drawing (default: true) */
  clampInput?: boolean;
  /**
   * Policy for shapes that exceed canvas bounds (default: "constrain")
   * - "constrain": Translate shape to fit within bounds
   * - "reject": Don't add shape, log warning
   * - "allow": Allow shape outside bounds
   */
  boundsPolicy?: BoundsPolicy;
  /**
   * Performance configuration including rendering quality options
   * Controls DPR handling, image smoothing, pixel snapping, and GPU optimization
   */
  performanceConfig?: DoodlPerformanceConfig;
}

export interface DoodlEvents {
  /** Fired when shapes change */
  shapesChange: (shapes: DrawShape[]) => void;
  /** Fired when selection changes */
  selectionChange: (selectedIds: string[]) => void;
  /** Fired when tool changes */
  toolChange: (tool: DrawTool) => void;
  /** Fired when style changes */
  styleChange: (style: ShapeStyle) => void;
  /** Fired on any state change */
  stateChange: (state: DrawingState) => void;
  /** Fired when history changes (undo/redo availability) */
  historyChange: (state: { canUndo: boolean; canRedo: boolean }) => void;
}

export interface PingOptions {
  /**
   * Animation preset (default: doodl `defaultActivationAnimation`, else `"ping"`).
   * - `"ping"`: border-trace comet (historical default)
   * - `"locateFlash"`: expanding box-shadow flash (console pre-doodl locate)
   * - `"pulse"`: soft expanding outline
   * Custom ids work after `registerActivationAnimation(name, renderer)`.
   */
  type?: ActivationAnimationType;
  /** Duration in milliseconds (default depends on `type`) */
  duration?: number;
  /** RGB color tuple (default depends on `type`) */
  color?: [number, number, number];
}

type EventName = keyof DoodlEvents;
type EventCallback<T extends EventName> = DoodlEvents[T];

// =============================================================================
// DOODL
// =============================================================================

export class Doodl {
  // Canvas
  private _canvas: HTMLCanvasElement;

  // State
  private _shapes: DrawShape[] = [];
  private _selectedIds: Set<string> = new Set();
  private _previewShape: DrawShape | null = null;
  private _hoveredShapeId: string | null = null;

  // Tool state
  private _tool: DrawTool = "select";
  private _style: ShapeStyle = { ...DEFAULT_SHAPE_STYLE };

  // Drawing controllers (runtime instances)
  private _controllers: Record<DrawTool, DrawingController<DrawShape>>;

  // Drivers
  private _mouseDriver: MouseDriver;
  private _keyboardDriver: KeyboardDriver;
  private _renderDriver: RenderDriver;
  private _historyDriver: HistoryDriver<DrawShape[]>;
  private _selectionDriver: SelectionDriver | null = null;
  private _modifiers: DrawModifiers = { shift: false, ctrl: false, alt: false };

  // Performance optimization
  private _spatialIndex: SpatialIndex<DrawShape>;
  private _useSpatialIndex: boolean = true;

  // Text layer reference (for text extraction on shape creation/update)
  private _textLayer: HTMLElement | null = null;

  // Options
  private _readOnly: boolean;
  private _enablePing: boolean;
  private _defaultActivationAnimation: ActivationAnimationType;
  private _scale: number;
  private _selectionOptions: Omit<SelectionDriverOptions, "scale">;
  private _mergeHighlights: boolean;
  private _boundsPolicy: BoundsPolicy;

  // Ephemeral visual effects
  private _pingEffects: Map<string, PingEffect> = new Map();

  // Events
  private _listeners: Map<EventName, Set<EventCallback<EventName>>> = new Map();

  constructor(canvas: HTMLCanvasElement, options: DoodlOptions = {}) {
    this._canvas = canvas;

    // Apply options
    this._shapes = options.initialState?.shapes ?? [];
    this._tool = options.initialTool ?? "select";
    this._style = options.initialStyle ?? { ...DEFAULT_SHAPE_STYLE };
    this._readOnly = options.readOnly ?? false;
    this._enablePing = options.enablePing ?? true;
    this._defaultActivationAnimation =
      options.defaultActivationAnimation ?? "ping";
    this._selectionOptions = options.selectionOptions ?? {};
    this._mergeHighlights = options.mergeHighlights ?? true;
    this._boundsPolicy = options.boundsPolicy ?? "constrain";

    const scale = options.scale ?? 1;
    this._scale = scale;

    // readOnly is selection-only — keep pointer/keyboard attached for select.
    if (this._readOnly && this._tool !== "select") {
      this._tool = "select";
    }

    // Create drawing controllers
    this._controllers = {
      select: createSelectController(),
      rect: new RectController(),
      ellipse: new EllipseController(),
      polygon: new PolygonController(),
      freehand: new FreehandController(),
      highlight: createHighlightController(),
      text: createTextController(),
      "text-highlight": createTextHighlightController(),
      "text-unhighlight": createTextHighlightController(), // Same controller, different handling
    };

    // Resolve performance config with defaults
    const perfConfig = createPerformanceConfig(options.performanceConfig);

    // Create render driver with rendering quality config
    this._renderDriver = new RenderDriver(
      canvas,
      {
        getShapes: () => this._shapes,
        getSelectedIds: () => this._selectedIds,
        getPreviewShape: () => this._previewShape,
        getEditState: () => this._getEditState(),
        getPingEffects: () => this._getActivePingEffects(),
        isReadOnly: () => this._readOnly,
      },
      {
        backgroundColor: options.backgroundColor ?? "transparent",
        scale,
        useDirtyRects: perfConfig.useDirtyRects,
        rendering: perfConfig.rendering,
      }
    );

    // Create mouse driver (always enabled — readOnly gates mutations, not select)
    this._mouseDriver = new MouseDriver(
      canvas,
      {
        onStart: this._handleMouseStart.bind(this),
        onMove: this._handleMouseMove.bind(this),
        onEnd: this._handleMouseEnd.bind(this),
        onDblClick: this._handleDblClick.bind(this),
        onHover: this._handleMouseHover.bind(this),
      },
      { scale, disabled: false, clamp: options.clampInput ?? true }
    );

    // Create keyboard driver (Escape still useful in readOnly; mutations gated)
    this._keyboardDriver = new KeyboardDriver(
      {
        onCommand: this._handleKeyboardCommand.bind(this),
        onModifiersChange: (modifiers) => {
          this._modifiers = modifiers;
        },
      },
      { disabled: false }
    );

    // Create history driver
    this._historyDriver = new HistoryDriver<DrawShape[]>();
    this._historyDriver.setOnChange((state) => {
      this._emit("historyChange", {
        canUndo: state.canUndo,
        canRedo: state.canRedo,
      });
    });

    // Create spatial index for O(log n) hit testing
    this._spatialIndex = new SpatialIndex<DrawShape>(
      (shape) => getShapeBounds(shape),
      { cellSize: 100 }
    );
    // Initialize with any initial shapes
    if (this._shapes.length > 0) {
      this._spatialIndex.rebuild(this._shapes);
    }

    // Store text layer and create selection driver if provided
    if (options.textLayer) {
      this._textLayer = options.textLayer;
      this._createSelectionDriver(options.textLayer);
    }
  }

  // ===========================================================================
  // SELECTION DRIVER (for text-highlight tool)
  // ===========================================================================

  private _createSelectionDriver(textLayer: HTMLElement): void {
    this._selectionDriver = new SelectionDriver(
      this._canvas,
      textLayer,
      {
        onSelectionStart: () => {
          // Could emit event or update preview
        },
        // eslint-disable-next-line @typescript-eslint/no-unused-vars -- Parameter prefixed with _ is intentionally unused
        onSelectionChange: (rects, _text) => {
          // Update preview during selection
          if (rects.length > 0) {
            const isEraser = this._tool === "text-unhighlight";
            this._previewShape = {
              id: "preview-text-highlight",
              type: "text-highlight",
              rects,
              text: "",
              style: {
                ...DEFAULT_TEXT_HIGHLIGHT_STYLE,
                fill: isEraser
                  ? "#ff6b6b"
                  : (DEFAULT_TEXT_HIGHLIGHT_STYLE.fill ?? "#FFEB3B"),
                fillOpacity:
                  (DEFAULT_TEXT_HIGHLIGHT_STYLE.fillOpacity ?? 0.4) * 0.7,
              },
            } as DrawShape;
            this._requestRender();
          }
        },
        onSelectionEnd: (rects, text) => {
          if (rects.length === 0) {
            this._previewShape = null;
            this._requestRender();
            return;
          }

          if (this._tool === "text-unhighlight") {
            // Eraser mode: subtract from existing highlights
            this._applyTextUnhighlight(rects);
          } else {
            // Highlight mode: add new highlight
            const shape = createTextHighlightShape(
              rects,
              text,
              DEFAULT_TEXT_HIGHLIGHT_STYLE
            );
            this._addShape(shape);
          }

          this._previewShape = null;
          this._requestRender();
        },
        onSelectionCancel: () => {
          this._previewShape = null;
          this._requestRender();
        },
      },
      {
        scale: this._scale,
        mergeHighlights: this._mergeHighlights,
        ...this._selectionOptions,
      }
    );
  }

  /**
   * Apply text unhighlight (eraser) operation
   */
  private _applyTextUnhighlight(eraserRects: Bounds[]): void {
    const existingHighlights = this._shapes.filter(
      (s): s is TextHighlightShape => s.type === "text-highlight"
    );

    if (existingHighlights.length === 0) {
      return; // Nothing to erase
    }

    const result = subtractFromExistingHighlights(
      eraserRects,
      existingHighlights
    );

    // Check if any changes were made
    if (
      result.removedIds.length === 0 &&
      result.modifiedShapes.length === 0 &&
      result.splitShapes.length === 0
    ) {
      return; // No changes
    }

    // Push undo state
    this._pushUndo();

    // Remove fully erased shapes
    if (result.removedIds.length > 0) {
      this._shapes = this._shapes.filter(
        (s) => !result.removedIds.includes(s.id)
      );
    }

    // Update modified shapes
    if (result.modifiedShapes.length > 0) {
      const modifiedMap = new Map(result.modifiedShapes.map((s) => [s.id, s]));
      this._shapes = this._shapes.map(
        (s) => (modifiedMap.get(s.id) as DrawShape) ?? s
      );
    }

    // Add split shapes
    if (result.splitShapes.length > 0) {
      this._shapes = [...this._shapes, ...result.splitShapes];
    }

    this._emit("shapesChange", this._shapes);
    this._emitStateChange();
  }

  // ===========================================================================
  // LIFECYCLE
  // ===========================================================================

  /**
   * Destroy and cleanup resources
   */
  destroy(): void {
    this._mouseDriver.destroy();
    this._keyboardDriver.destroy();
    this._renderDriver.destroy();
    this._selectionDriver?.destroy();
    this._selectionDriver = null;
    this._listeners.clear();
  }

  // ===========================================================================
  // RENDERING
  // ===========================================================================

  private _requestRender(): void {
    this._renderDriver.requestRender();
  }

  /**
   * Mark a shape as dirty for partial re-rendering
   */
  private _markShapeDirty(shapeOrId: DrawShape | string): void {
    const shape =
      typeof shapeOrId === "string"
        ? this._shapes.find((s) => s.id === shapeOrId)
        : shapeOrId;

    if (shape) {
      this._renderDriver.markShapeDirty(shape);
    }
  }

  /**
   * Mark multiple shapes as dirty for partial re-rendering
   */
  private _markShapesDirty(shapes: DrawShape[]): void {
    for (const shape of shapes) {
      this._renderDriver.markShapeDirty(shape);
    }
  }

  /**
   * Force full canvas redraw
   */
  private _forceFullRedraw(): void {
    this._renderDriver.forceFullRedraw();
  }

  // ===========================================================================
  // MOUSE HANDLERS (called by MouseDriver) - Unified dispatch
  // ===========================================================================

  private _getControllerContext(): ControllerContext<DrawShape> {
    // Filter to selectable shapes for hit testing
    const selectableShapes = filterSelectableShapes(this._shapes);

    return {
      shapes: this._shapes,
      selectedIds: Array.from(this._selectedIds),
      getShape: (id) => this._shapes.find((s) => s.id === id),
      // Use spatial index for faster hit testing when enabled
      findShapeAtPoint: (p) => this._findShapeAtPointOptimized(p, selectableShapes),
    };
  }

  /**
   * Find shape at point using spatial index for O(log n) performance
   */
  private _findShapeAtPointOptimized(
    point: Point,
    selectableShapes: DrawShape[]
  ): DrawShape | null {
    if (!this._useSpatialIndex || this._spatialIndex.size === 0) {
      // Fallback to linear scan
      return findTopmostShapeAtPoint(point, selectableShapes);
    }

    // Get candidates from spatial index
    const candidates = this._spatialIndex.queryPoint(point);
    if (candidates.length === 0) {
      return null;
    }

    // Filter candidates to only selectable ones
    const selectableIds = new Set(selectableShapes.map((s) => s.id));
    const selectableCandidates = candidates.filter((c) =>
      selectableIds.has(c.id)
    );

    if (selectableCandidates.length === 0) {
      return null;
    }

    // Do precise hit testing on candidates (topmost first)
    // Sort by shape order to get topmost (candidates might not preserve order)
    const candidateIds = new Set(selectableCandidates.map((c) => c.id));
    const orderedCandidates = selectableShapes.filter((s) =>
      candidateIds.has(s.id)
    );

    // Find topmost shape at point (iterate from end)
    for (let i = orderedCandidates.length - 1; i >= 0; i--) {
      const shape = orderedCandidates[i]!;
      if (isPointInShape(point, shape)) {
        return shape;
      }
    }

    return null;
  }

  /**
   * Get edit state from select controller (if in edit mode)
   * Converts controller-specific state to generic ShapeEditState
   */
  private _getEditState(): import("./shapes").ShapeEditState | null {
    const selectController = this._controllers["select"];
    if (
      selectController &&
      "getVertexEditState" in selectController &&
      typeof selectController.getVertexEditState === "function"
    ) {
      const vertexState = selectController.getVertexEditState();
      if (vertexState) {
        // Convert to generic ShapeEditState
        return {
          shapeId: vertexState.shapeId,
          mode: "vertex",
          data: vertexState,
        };
      }
    }
    return null;
  }

  private _applyAction(action: ControllerAction<DrawShape>): void {
    // Selection-only: allow selection changes, ignore draw/transform mutations
    if (this._readOnly) {
      if (action.setSelection) {
        this._setSelection(action.setSelection);
      }
      return;
    }

    // Use LOGICAL bounds (not pixel bounds) for shape enforcement
    // Shapes are stored in logical coordinates, so bounds must match
    const canvasBounds = {
      width: this._canvas.width / this._scale,
      height: this._canvas.height / this._scale,
    };

    if (action.addShape) {
      const result = enforceShapeBounds(
        action.addShape,
        canvasBounds,
        this._boundsPolicy
      );
      if (result.status === "rejected") {
        console.warn("[Doodl] Shape rejected:", result.reason);
      } else {
        this._addShape(result.shape);
      }
    }
    if (action.setSelection) {
      this._setSelection(action.setSelection);
    }
    if (action.updateShapes) {
      const enforcedShapes = action.updateShapes
        .map((shape) => {
          const result = enforceShapeBounds(
            shape,
            canvasBounds,
            this._boundsPolicy
          );
          if (result.status === "rejected") {
            console.warn("[Doodl] Shape update rejected:", result.reason);
            return null;
          }
          return result.shape;
        })
        .filter((s): s is DrawShape => s !== null);

      if (enforcedShapes.length > 0) {
        this._updateShapes(enforcedShapes);
      }
    }
    if (action.preview !== undefined) {
      this._previewShape = action.preview;
    }
    if (action.clearPreview) {
      this._previewShape = null;
    }
  }

  private _updateShapes(shapes: DrawShape[]): void {
    // Mark old bounds as dirty before update
    for (const shape of shapes) {
      const oldShape = this._shapes.find((s) => s.id === shape.id);
      if (oldShape) {
        this._markShapeDirty(oldShape);
      }
    }

    // Re-extract text for updated geometric shapes (position may have changed)
    const processedShapes = shapes.map((shape) => {
      if (this._textLayer && this._shouldExtractText(shape)) {
        return this._extractAndStoreText(shape);
      }
      return shape;
    });

    const updateMap = new Map(processedShapes.map((s) => [s.id, s]));
    this._shapes = this._shapes.map((s) => updateMap.get(s.id) ?? s);

    // Update spatial index for modified shapes
    for (const shape of processedShapes) {
      this._spatialIndex.upsert(shape);
    }

    // Mark new bounds as dirty after update
    this._markShapesDirty(processedShapes);

    this._emit("shapesChange", this._shapes);
  }

  private _handleMouseStart(point: Point, modifiers: DrawModifiers): void {
    this._modifiers = modifiers;
    // readOnly: only the select tool may handle pointer input
    const tool = this._readOnly ? "select" : this._tool;
    const config = TOOL_CONFIGS[tool];
    const controller = this._controllers[tool];
    if (!controller) return; // Tool not supported
    const style = config?.styleOverride ?? this._style;
    const context = this._getControllerContext();

    const action = controller.onStart(point, style, modifiers, context);
    this._applyAction(action);
    this._requestRender();
  }

  private _handleMouseMove(point: Point, modifiers: DrawModifiers): void {
    this._modifiers = modifiers;
    const controller = this._controllers[this._tool];
    if (!controller) return;

    const action = controller.onMove(point, modifiers);
    this._applyAction(action);
    this._requestRender();
  }

  private _handleMouseEnd(_point: Point, modifiers: DrawModifiers): void {
    this._modifiers = modifiers;
    const controller = this._controllers[this._tool];
    if (!controller) return;

    const action = controller.onEnd();
    this._applyAction(action);
    this._requestRender();
  }

  private _handleDblClick(point: Point, modifiers: DrawModifiers): void {
    this._modifiers = modifiers;
    const controller = this._controllers[this._tool];
    if (!controller) return;

    // Check for onDblClick handler
    if (controller.onDblClick) {
      // Pass point and context for advanced controllers (e.g., vertex editing)
      const context = this._getControllerContext();
      const action = controller.onDblClick(point, modifiers, context);
      this._applyAction(action);
      this._requestRender();
    }
  }

  /**
   * Handle mouse hover (movement when not dragging)
   * Used for multi-click tools like polygon that need cursor tracking between clicks
   */
  private _handleMouseHover(point: Point, modifiers: DrawModifiers): void {
    this._modifiers = modifiers;
    const controller = this._controllers[this._tool];

    // Track hover state for dirty rect optimization (if select tool)
    if (this._tool === "select") {
      const selectableShapes = filterSelectableShapes(this._shapes);
      const hoveredShape = findTopmostShapeAtPoint(point, selectableShapes);

      // Mark old and new hover shapes as dirty
      if (this._hoveredShapeId && this._hoveredShapeId !== hoveredShape?.id) {
        this._markShapeDirty(this._hoveredShapeId);
      }
      if (hoveredShape && hoveredShape.id !== this._hoveredShapeId) {
        this._markShapeDirty(hoveredShape);
      }

      this._hoveredShapeId = hoveredShape?.id ?? null;
    }

    // Forward hover to controller's onMove for preview updates
    // This enables rubber-band preview for multi-click tools like polygon
    const action = controller.onMove(point, modifiers);
    this._applyAction(action);
    this._requestRender();
  }

  // ===========================================================================
  // KEYBOARD HANDLER (called by KeyboardDriver)
  // ===========================================================================

  private _handleKeyboardCommand(command: KeyboardCommand): void {
    switch (command) {
      case "undo":
        if (!this._readOnly) {
          this.undo();
        }
        break;
      case "redo":
        if (!this._readOnly) {
          this.redo();
        }
        break;
      case "delete":
        if (this._readOnly) return;
        // First try controller's onKeyDown (e.g., vertex deletion)
        if (this._delegateKeyToController("Delete")) {
          return;
        }
        // Fallback: delete selected shapes
        if (this._selectedIds.size > 0) {
          this.deleteSelected();
        }
        break;
      case "escape":
        // First try controller's onKeyDown
        if (this._delegateKeyToController("Escape")) {
          return;
        }
        // Fallback: cancel current operation
        this._cancelCurrentOperation();
        break;
    }
  }

  /**
   * Delegate key press to current controller
   * Returns true if controller handled the key
   */
  private _delegateKeyToController(key: string): boolean {
    const controller = this._controllers[this._tool];
    if (!controller?.onKeyDown) {
      return false;
    }

    const context = this._getControllerContext();
    const action = controller.onKeyDown(key, this._modifiers, context);

    // Check if action has any meaningful response
    const hasAction =
      action.addShape !== undefined ||
      action.setSelection !== undefined ||
      action.updateShapes !== undefined ||
      action.preview !== undefined ||
      action.clearPreview !== undefined;

    if (hasAction) {
      this._applyAction(action);
      this._requestRender();
      return true;
    }

    return false;
  }

  private _cancelCurrentOperation(): void {
    // Cancel all controllers
    for (const tool of Object.keys(this._controllers) as DrawTool[]) {
      this._controllers[tool]?.onCancel();
    }
    this._previewShape = null;
    this._mouseDriver.cancel();
    this._requestRender();
  }

  // ===========================================================================
  // HISTORY OPERATIONS
  // ===========================================================================

  private _pushUndo(): void {
    // Only track shapes with tracked: true behavior
    const trackedShapes = filterTrackedShapes(this._shapes);
    const snapshot = trackedShapes.map((s) => ({ ...s }));
    this._historyDriver.push(snapshot);
  }

  private _createSnapshot(): DrawShape[] {
    // Only include tracked shapes in snapshot
    const trackedShapes = filterTrackedShapes(this._shapes);
    return trackedShapes.map((s) => ({ ...s }));
  }

  // ===========================================================================
  // SHAPE OPERATIONS
  // ===========================================================================

  private _addShape(shape: DrawShape, pushHistory = true): void {
    let finalShape = shape;
    let shapesToRemove: string[] = [];

    // Extract and store text for geometric shapes (like text-highlight does)
    // This provides fallback text when DOM extraction fails (e.g., during zoom)
    if (this._textLayer && this._shouldExtractText(shape)) {
      finalShape = this._extractAndStoreText(finalShape);
    }

    // Inter-shape merge for text-highlight when enabled
    if (this._mergeHighlights && finalShape.type === "text-highlight") {
      const existingHighlights = this._shapes.filter(
        (s): s is TextHighlightShape => s.type === "text-highlight"
      );

      if (existingHighlights.length > 0) {
        const result = mergeWithExistingHighlights(
          finalShape as TextHighlightShape,
          existingHighlights
        );
        finalShape = result.shape;
        shapesToRemove = result.mergedIds;
      }
    }

    if (pushHistory) this._pushUndo();

    // Mark merged shapes as dirty before removal (they need to be redrawn as empty)
    if (shapesToRemove.length > 0) {
      for (const id of shapesToRemove) {
        this._markShapeDirty(id);
        this._spatialIndex.remove(id);
      }
      this._shapes = this._shapes.filter((s) => !shapesToRemove.includes(s.id));
    }

    this._shapes = [...this._shapes, finalShape];

    // Update spatial index
    this._spatialIndex.upsert(finalShape);

    // Mark new shape as dirty
    this._markShapeDirty(finalShape);

    this._emit("shapesChange", this._shapes);
    this._emitStateChange();
  }

  /**
   * Check if shape wants text captured on creation/transform
   *
   * Delegates to shape module's capturesTextOnTransform flag.
   * This is shape-centric - each module declares its own capability.
   */
  private _shouldExtractText(shape: DrawShape): boolean {
    return shapeWantsCapturedText(shape);
  }

  /**
   * Extract text from shape bounds and store in shape.text property
   *
   * Always updates text when DOM extraction is attempted, even if result is empty.
   * Empty text is a valid signal (shape is over a blank zone).
   */
  private _extractAndStoreText(shape: DrawShape): DrawShape {
    if (!this._textLayer) return shape;

    const extracted = extractShapeText(shape, {
      textLayer: this._textLayer,
      scale: this._scale,
    });

    // Always update text when extraction was attempted via DOM
    // Empty string is valid (shape over blank zone)
    if (extracted.source === "dom-intersection") {
      return { ...shape, text: extracted.content };
    }

    return shape;
  }

  private _setSelection(ids: string[]): void {
    // Mark old selection as dirty
    for (const id of this._selectedIds) {
      this._markShapeDirty(id);
    }

    // Update selection
    this._selectedIds = new Set(ids);

    // Mark new selection as dirty
    for (const id of ids) {
      this._markShapeDirty(id);
    }

    this._emit("selectionChange", ids);
    this._requestRender();
  }

  // ===========================================================================
  // PUBLIC API - SHAPES
  // ===========================================================================

  /**
   * Get persisted shapes (default behavior for save/export)
   *
   * Returns only shapes with persisted: true behavior.
   * Use getAllShapes() to get all shapes including ephemeral ones.
   */
  getShapes(): DrawShape[] {
    return filterPersistedShapes(this._shapes);
  }

  /**
   * Get all shapes including ephemeral (backdrop, transient, etc.)
   *
   * Use this for full state access. For save/export, use getShapes().
   */
  getAllShapes(): DrawShape[] {
    return [...this._shapes];
  }

  /** Set all shapes */
  setShapes(shapes: DrawShape[]): void {
    // Use LOGICAL bounds for shape enforcement
    const canvasBounds = {
      width: this._canvas.width / this._scale,
      height: this._canvas.height / this._scale,
    };
    const enforcedShapes = shapes
      .map((shape) => {
        const result = enforceShapeBounds(
          shape,
          canvasBounds,
          this._boundsPolicy
        );
        if (result.status === "rejected") {
          console.warn("[Doodl] setShapes - shape rejected:", result.reason);
          return null;
        }
        return result.shape;
      })
      .filter((s): s is DrawShape => s !== null);

    this._shapes = enforcedShapes;
    this._selectedIds.clear();

    // Rebuild spatial index
    this._spatialIndex.rebuild(this._shapes);

    this._forceFullRedraw(); // Bulk change - force full redraw
    this._emit("shapesChange", this._shapes);
    this._emit("selectionChange", []);
    this._emitStateChange();
    this._requestRender();
  }

  /**
   * Set shapes with a specific behavior preset, replacing existing shapes of that behavior
   *
   * Useful for setting ephemeral shapes like search highlights without affecting user shapes.
   *
   * @param behaviorPreset - The behavior preset to match (e.g., "backdrop")
   * @param shapes - Shapes to set (will have behavior applied if not already set)
   */
  setShapesByBehavior(
    behaviorPreset: import("./types").ShapeBehaviorPreset,
    shapes: DrawShape[]
  ): void {
    // Remove existing shapes with this behavior
    const otherShapes = this._shapes.filter((s) => {
      const shapeBehavior = s.behavior;
      // Keep if behavior doesn't match
      if (typeof shapeBehavior === "string") {
        return shapeBehavior !== behaviorPreset;
      }
      // Keep if no behavior (defaults to interactive)
      if (!shapeBehavior) {
        return behaviorPreset !== "interactive";
      }
      // Keep if custom object (can't match preset name)
      return true;
    });

    // Add new shapes with behavior preset
    const newShapes = shapes.map((s) => ({
      ...s,
      behavior: s.behavior ?? behaviorPreset,
    }));

    this._shapes = [...otherShapes, ...newShapes];
    this._forceFullRedraw(); // Bulk change - force full redraw
    this._emit("shapesChange", this._shapes);
    this._emitStateChange();
    this._requestRender();
  }

  /**
   * Clear all shapes with a specific behavior preset
   *
   * @param behaviorPreset - The behavior preset to clear (e.g., "backdrop")
   */
  clearShapesByBehavior(
    behaviorPreset: import("./types").ShapeBehaviorPreset
  ): void {
    this.setShapesByBehavior(behaviorPreset, []);
  }

  /** Add a shape */
  addShape(shape: DrawShape): void {
    const newShape = { ...shape, id: shape.id || generateShapeId() };
    // Use LOGICAL bounds for shape enforcement
    const canvasBounds = {
      width: this._canvas.width / this._scale,
      height: this._canvas.height / this._scale,
    };
    const result = enforceShapeBounds(
      newShape,
      canvasBounds,
      this._boundsPolicy
    );

    if (result.status === "rejected") {
      console.warn("[Doodl] addShape rejected:", result.reason);
      return;
    }

    this._addShape(result.shape);
    this._requestRender();
  }

  /** Update a shape */
  updateShape(id: string, updates: Partial<DrawShape>): void {
    this._pushUndo();
    this._shapes = this._shapes.map((s) => {
      if (s.id !== id) return s;

      let updated = { ...s, ...updates } as DrawShape;

      // Re-extract text if shape supports it (position may have changed)
      if (this._textLayer && this._shouldExtractText(updated)) {
        updated = this._extractAndStoreText(updated);
      }

      return updated;
    });
    this._emit("shapesChange", this._shapes);
    this._emitStateChange();
    this._requestRender();
  }

  /** Remove a shape */
  removeShape(id: string): void {
    const shapeToRemove = this._shapes.find((s) => s.id === id);
    if (shapeToRemove) {
      this._markShapeDirty(shapeToRemove);
      this._spatialIndex.remove(id);
    }

    this._pushUndo();
    this._shapes = this._shapes.filter((s) => s.id !== id);
    this._selectedIds.delete(id);
    this._emit("shapesChange", this._shapes);
    this._emit("selectionChange", Array.from(this._selectedIds));
    this._emitStateChange();
    this._requestRender();
  }

  /** Clear all shapes */
  clearAll(): void {
    if (this._shapes.length > 0) {
      this._pushUndo();
    }
    this._shapes = [];
    this._selectedIds.clear();
    this._spatialIndex.clear();
    this._forceFullRedraw(); // Clear requires full redraw
    this._emit("shapesChange", []);
    this._emit("selectionChange", []);
    this._emitStateChange();
    this._requestRender();
  }

  /** Delete selected shapes */
  deleteSelected(): void {
    if (this._readOnly) return;
    if (this._selectedIds.size === 0) return;

    // Mark selected shapes as dirty before removal and remove from spatial index
    for (const id of this._selectedIds) {
      this._markShapeDirty(id);
      this._spatialIndex.remove(id);
    }

    this._pushUndo();
    this._shapes = this._shapes.filter((s) => !this._selectedIds.has(s.id));
    this._selectedIds.clear();
    this._emit("shapesChange", this._shapes);
    this._emit("selectionChange", []);
    this._emitStateChange();
    this._requestRender();
  }

  // ===========================================================================
  // PUBLIC API - UNDO/REDO
  // ===========================================================================

  /** Check if undo is available */
  canUndo(): boolean {
    return this._historyDriver.canUndo();
  }

  /** Check if redo is available */
  canRedo(): boolean {
    return this._historyDriver.canRedo();
  }

  /** Undo last action */
  undo(): boolean {
    if (this._readOnly) return false;
    const previous = this._historyDriver.undo(this._createSnapshot());
    if (!previous) return false;

    // Preserve non-tracked shapes (e.g., backdrop shapes like search highlights)
    const nonTrackedShapes = this._shapes.filter(
      (s) => !filterTrackedShapes([s]).length
    );
    this._shapes = [...nonTrackedShapes, ...previous];
    this._selectedIds.clear();

    // Rebuild spatial index
    this._spatialIndex.rebuild(this._shapes);

    this._forceFullRedraw(); // History change - force full redraw

    this._emit("shapesChange", this._shapes);
    this._emit("selectionChange", []);
    this._emitStateChange();
    this._requestRender();

    return true;
  }

  /** Redo last undone action */
  redo(): boolean {
    if (this._readOnly) return false;
    const next = this._historyDriver.redo(this._createSnapshot());
    if (!next) return false;

    // Preserve non-tracked shapes (e.g., backdrop shapes like search highlights)
    const nonTrackedShapes = this._shapes.filter(
      (s) => !filterTrackedShapes([s]).length
    );
    this._shapes = [...nonTrackedShapes, ...next];
    this._selectedIds.clear();

    // Rebuild spatial index
    this._spatialIndex.rebuild(this._shapes);

    this._forceFullRedraw(); // History change - force full redraw

    this._emit("shapesChange", this._shapes);
    this._emit("selectionChange", []);
    this._emitStateChange();
    this._requestRender();

    return true;
  }

  /** Clear history */
  clearHistory(): void {
    this._historyDriver.clear();
  }

  // ===========================================================================
  // PUBLIC API - SELECTION
  // ===========================================================================

  /** Get selected shape IDs */
  getSelectedIds(): string[] {
    return Array.from(this._selectedIds);
  }

  /** Select shapes by ID */
  select(ids: string[]): void {
    this._setSelection(ids);
  }

  /** Select all shapes */
  selectAll(): void {
    this._setSelection(this._shapes.map((s) => s.id));
  }

  /** Deselect all shapes */
  deselectAll(): void {
    this._setSelection([]);
  }

  // ===========================================================================
  // PUBLIC API - PING (ephemeral visual effects)
  // ===========================================================================

  /**
   * Show a brief activation-frame animation over a shape.
   * Default type is border-trace `"ping"`; pass `type: "locateFlash"` (etc.)
   * or set `defaultActivationAnimation` for other presets.
   * Multiple effects on different shapes can coexist.
   * Re-pinging the same shape restarts its animation.
   * No-op when `enablePing` is false.
   */
  ping(shapeId: string, options?: PingOptions): void {
    if (!this._enablePing) return;

    const shape = this._shapes.find((s) => s.id === shapeId);
    if (!shape) return;

    const type =
      options?.type ?? this._defaultActivationAnimation;
    this._pingEffects.set(shapeId, {
      shapeId,
      startTime: performance.now(),
      duration: options?.duration ?? defaultDurationForAnimation(type),
      color: options?.color ?? defaultColorForAnimation(type),
      type,
    });

    this._forceFullRedraw();
    this._requestRender();
  }

  /** Whether activation-frame `ping()` animation is enabled */
  isPingEnabled(): boolean {
    return this._enablePing;
  }

  /** Enable/disable activation-frame `ping()` animation */
  setEnablePing(enablePing: boolean): void {
    this._enablePing = enablePing;
    if (!enablePing) {
      this._pingEffects.clear();
      this._forceFullRedraw();
      this._requestRender();
    }
  }

  /** Default animation type used when `ping()` omits `type` */
  getDefaultActivationAnimation(): ActivationAnimationType {
    return this._defaultActivationAnimation;
  }

  setDefaultActivationAnimation(type: ActivationAnimationType): void {
    this._defaultActivationAnimation = type;
  }

  /**
   * Return active (non-expired) effects and prune expired ones.
   */
  private _getActivePingEffects(): PingEffect[] {
    if (this._pingEffects.size === 0) return [];

    const now = performance.now();
    const active: PingEffect[] = [];

    for (const [id, effect] of this._pingEffects) {
      if (now - effect.startTime >= effect.duration) {
        this._pingEffects.delete(id);
      } else {
        active.push(effect);
      }
    }

    return active;
  }

  // ===========================================================================
  // PUBLIC API - TOOL & STYLE
  // ===========================================================================

  /** Get current tool */
  getTool(): DrawTool {
    return this._tool;
  }

  /** Set current tool */
  setTool(tool: DrawTool): void {
    // readOnly locks the tool to select (selection-only)
    const nextTool = this._readOnly ? "select" : tool;
    if (nextTool === this._tool) return;
    this._cancelCurrentOperation();
    this._tool = nextTool;
    this._hoveredShapeId = null;
    this._forceFullRedraw();
    this._emit("toolChange", nextTool);
    this._updateCursor();
    this._updateSelectionDriver();
  }

  private _updateSelectionDriver(): void {
    if (!this._selectionDriver) return;

    // Enable for both highlight and unhighlight tools
    const isTextSelectionTool =
      this._tool === "text-highlight" || this._tool === "text-unhighlight";

    if (isTextSelectionTool && !this._readOnly) {
      this._selectionDriver.enable();
    } else {
      this._selectionDriver.disable();
    }
  }

  /** Get current style */
  getStyle(): ShapeStyle {
    return { ...this._style };
  }

  /** Set current style */
  setStyle(style: Partial<ShapeStyle>): void {
    this._style = { ...this._style, ...style };
    this._emit("styleChange", this._style);
  }

  private _updateCursor(): void {
    const config = TOOL_CONFIGS[this._tool];
    this._canvas.style.cursor = config?.cursor ?? "default";
  }

  // ===========================================================================
  // PUBLIC API - STATE
  // ===========================================================================

  /** Get full drawing state */
  getState(): DrawingState {
    return {
      version: DRAWING_STATE_VERSION,
      shapes: [...this._shapes],
      metadata: {
        createdAt: new Date().toISOString(),
        modifiedAt: new Date().toISOString(),
      },
    };
  }

  /** Set full drawing state */
  setState(state: DrawingState): void {
    this.setShapes(state.shapes);
  }

  /** Export state as JSON string */
  exportJSON(): string {
    return JSON.stringify(this.getState(), null, 2);
  }

  /** Import state from JSON string */
  importJSON(json: string): void {
    const state = JSON.parse(json) as DrawingState;
    this.setState(state);
  }

  // ===========================================================================
  // PUBLIC API - OPTIONS
  // ===========================================================================

  /** Set scale factor */
  setScale(scale: number): void {
    this._scale = scale;
    this._renderDriver.setScale(scale); // This also forces full redraw
    this._mouseDriver.setScale(scale);
    this._selectionDriver?.setScale(scale);
  }

  /**
   * Set canvas dimensions (logical CSS pixels)
   *
   * This properly handles DPR for crisp Retina rendering.
   * The canvas buffer will be sized at physical pixel resolution
   * when high-DPI mode is enabled.
   *
   * @param width - Logical width in CSS pixels
   * @param height - Logical height in CSS pixels
   */
  setDimensions(width: number, height: number): void {
    this._renderDriver.setDimensions(width, height);
  }

  /**
   * Get canvas dimensions (logical CSS pixels)
   */
  getDimensions(): { width: number; height: number } {
    return this._renderDriver.getDimensions();
  }

  /** Set background color */
  setBackgroundColor(color: string): void {
    this._renderDriver.setBackgroundColor(color);
  }

  /**
   * Selection-only mode: keep pointer selection, block draw/edit/drag/resize.
   */
  setReadOnly(readOnly: boolean): void {
    if (this._readOnly === readOnly) return;
    this._readOnly = readOnly;
    // Keep drivers enabled so click-to-select still works
    this._mouseDriver.setDisabled(false);
    this._keyboardDriver.setDisabled(false);
    this._cancelCurrentOperation();
    if (readOnly && this._tool !== "select") {
      this.setTool("select");
    }
    this._updateSelectionDriver();
    this._forceFullRedraw();
    this._requestRender();
  }

  /** Whether selection-only (readOnly) mode is active */
  isReadOnly(): boolean {
    return this._readOnly;
  }

  /** Force re-render */
  render(): void {
    this._requestRender();
  }

  /** Enable/disable mouse input clamping to canvas bounds */
  setClampInput(clamp: boolean): void {
    this._mouseDriver.setClamp(clamp);
  }

  /** Set bounds policy for shapes */
  setBoundsPolicy(policy: BoundsPolicy): void {
    this._boundsPolicy = policy;
  }

  /** Get current bounds policy */
  getBoundsPolicy(): BoundsPolicy {
    return this._boundsPolicy;
  }

  // ===========================================================================
  // PUBLIC API - TEXT LAYER (for text-highlight tool)
  // ===========================================================================

  /** Set text layer element for text-highlight tool and text extraction */
  setTextLayer(textLayer: HTMLElement): void {
    // Store reference for text extraction
    this._textLayer = textLayer;

    // Destroy existing driver
    this._selectionDriver?.destroy();
    this._selectionDriver = null;

    // Create new driver
    this._createSelectionDriver(textLayer);
    this._updateSelectionDriver();
  }

  /** Clear text layer (disables text-highlight functionality and text extraction) */
  clearTextLayer(): void {
    this._textLayer = null;
    this._selectionDriver?.destroy();
    this._selectionDriver = null;
  }

  /** Check if text layer is set */
  hasTextLayer(): boolean {
    return this._textLayer !== null;
  }

  /** Get current text layer element */
  getTextLayer(): HTMLElement | null {
    return this._textLayer;
  }

  // ===========================================================================
  // EVENTS
  // ===========================================================================

  /** Subscribe to an event */
  on<T extends EventName>(event: T, callback: DoodlEvents[T]): void {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }
    this._listeners.get(event)!.add(callback as EventCallback<EventName>);
  }

  /** Unsubscribe from an event */
  off<T extends EventName>(event: T, callback: DoodlEvents[T]): void {
    this._listeners.get(event)?.delete(callback as EventCallback<EventName>);
  }

  private _emit<T extends EventName>(
    event: T,
    data: Parameters<DoodlEvents[T]>[0]
  ): void {
    const callbacks = this._listeners.get(event);
    if (callbacks) {
      for (const cb of callbacks) {
        (cb as (arg: Parameters<DoodlEvents[T]>[0]) => void)(data);
      }
    }
  }

  private _emitStateChange(): void {
    this._emit("stateChange", this.getState());
  }
}

/**
 * Create a new Doodl instance
 */
export function createDoodl(
  canvas: HTMLCanvasElement,
  options?: DoodlOptions
): Doodl {
  return new Doodl(canvas, options);
}
