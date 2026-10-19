/**
 * RenderDriver - Canvas rendering with RAF loop
 *
 * Handles canvas rendering lifecycle:
 * - RAF-based render loop
 * - Dirty rectangle optimization for partial re-rendering
 * - High-DPI (Retina) support with DPR-aware canvas sizing
 * - GPU-optimized canvas context options
 * - Scale and background
 * - Shape/selection/preview rendering
 * - Edit mode rendering (delegated to shape modules)
 *
 * Architecture: Shape-centric - render driver is agnostic to specific shape types.
 * Edit mode and selection rendering is delegated to shape modules via dispatch.
 */

import type { ActivationAnimationType } from "../effects/activation-animation";
import { getActivationAnimationRenderer } from "../effects/activation-animation";
import {
  clearCanvas,
  configureSharpRendering,
  getDevicePixelRatio,
  getOptimizedContext,
  getShapeBounds,
  GPU_OPTIMIZED_CONTEXT_OPTIONS,
  renderShapeEditMode,
  renderShapeSelection,
  renderShapesWithBehavior,
  shapeSupportsEditMode,
  type ShapeEditState,
} from "../shapes";
import { runWithShapeRenderContext } from "../shapes/common/utils/render-context";
import { styleRenderPadding } from "../shapes/common/utils/stroke";
import type { Bounds, DrawShape } from "../types";
import type {
  ImageSmoothingMode,
  RenderingQualityConfig,
} from "../types/performance";
import {
  boundsIntersectsRegions,
  DirtyRectManager,
  type DirtyRegion,
} from "./utils";

// =============================================================================
// TYPES
// =============================================================================

/**
 * Ephemeral visual ping effect rendered over a shape.
 * Managed by Doodl, rendered by RenderDriver.
 */
export interface PingEffect {
  shapeId: string;
  startTime: number;
  duration: number;
  color: [number, number, number];
  /** Animation preset (default behavior is `"ping"`). */
  type: ActivationAnimationType;
}

/**
 * Render state provider - called each frame to get current state
 */
export interface RenderStateProvider {
  /** Get shapes to render */
  getShapes: () => DrawShape[];
  /** Get selected shape IDs */
  getSelectedIds: () => Set<string>;
  /** Get preview shape (during drawing) */
  getPreviewShape: () => DrawShape | null;
  /** Get edit state (generic, shape-agnostic) */
  getEditState?: () => ShapeEditState | null;
  /** Get active ping effects */
  getPingEffects?: () => PingEffect[];
  /** When true, skip resize-handle chrome (selection-only / readOnly) */
  isReadOnly?: () => boolean;
}

/**
 * Render driver options
 */
export interface RenderDriverOptions {
  /** Background color (default: "transparent") */
  backgroundColor?: string;
  /** Scale factor (default: 1) */
  scale?: number;
  /** Enable dirty rectangle optimization (default: true) */
  useDirtyRects?: boolean;
  /** Rendering quality configuration */
  rendering?: RenderingQualityConfig;
}

// =============================================================================
// RENDER DRIVER
// =============================================================================

/**
 * RenderDriver - Manages canvas rendering
 */
export class RenderDriver {
  private _canvas: HTMLCanvasElement;
  private _ctx: CanvasRenderingContext2D;
  private _stateProvider: RenderStateProvider;

  // Options
  private _backgroundColor: string;
  private _scale: number;
  private _useDirtyRects: boolean;

  // Rendering quality
  private _enableHighDPI: boolean;
  private _imageSmoothingMode: ImageSmoothingMode;
  private _enablePixelSnapping: boolean;
  private _dpr: number;

  // Logical dimensions (CSS pixels)
  private _logicalWidth: number;
  private _logicalHeight: number;

  // RAF state
  private _rafId: number | null = null;
  private _needsRender = true;

  // Dirty rectangle tracking
  private _dirtyRectManager: DirtyRectManager;

  constructor(
    canvas: HTMLCanvasElement,
    stateProvider: RenderStateProvider,
    options: RenderDriverOptions = {}
  ) {
    this._canvas = canvas;
    this._stateProvider = stateProvider;

    // Apply options
    this._backgroundColor = options.backgroundColor ?? "transparent";
    this._scale = options.scale ?? 1;
    this._useDirtyRects = options.useDirtyRects ?? true;

    // Rendering quality options
    const rendering = options.rendering ?? {};
    this._enableHighDPI = rendering.enableHighDPI ?? true;
    this._imageSmoothingMode = rendering.imageSmoothingMode ?? "disabled";
    this._enablePixelSnapping = rendering.enablePixelSnapping ?? true;

    // Calculate DPR
    this._dpr = this._enableHighDPI ? getDevicePixelRatio() : 1;

    // Store logical dimensions from current canvas size
    this._logicalWidth = canvas.width;
    this._logicalHeight = canvas.height;

    // Get context with GPU-optimized options
    const useGPUOptimized = rendering.useGPUOptimizedContext ?? true;
    const ctx = useGPUOptimized
      ? getOptimizedContext(canvas, GPU_OPTIMIZED_CONTEXT_OPTIONS)
      : canvas.getContext("2d");

    if (!ctx) {
      throw new Error("Failed to get 2D context from canvas");
    }
    this._ctx = ctx;

    // Configure canvas for high-DPI if enabled
    if (this._enableHighDPI) {
      this._configureHighDPI();
    }

    // Apply sharp rendering configuration
    configureSharpRendering(this._ctx, this._imageSmoothingMode);

    // Initialize dirty rectangle manager
    this._dirtyRectManager = new DirtyRectManager();

    // Start render loop
    this._startLoop();
  }

  /**
   * Configure canvas for high-DPI rendering
   */
  private _configureHighDPI(): void {
    this._dpr = getDevicePixelRatio();

    // Set physical pixel dimensions
    this._canvas.width = Math.round(this._logicalWidth * this._dpr);
    this._canvas.height = Math.round(this._logicalHeight * this._dpr);

    // Set CSS display dimensions
    this._canvas.style.width = `${this._logicalWidth}px`;
    this._canvas.style.height = `${this._logicalHeight}px`;
  }

  // ===========================================================================
  // LIFECYCLE
  // ===========================================================================

  /**
   * Destroy and cleanup
   */
  destroy(): void {
    this._stopLoop();
  }

  private _startLoop(): void {
    const loop = (): void => {
      if (this._needsRender) {
        // Reset BEFORE render so _render() can re-set it for continuous animation
        this._needsRender = false;
        this._render();
      }
      this._rafId = requestAnimationFrame(loop);
    };
    this._rafId = requestAnimationFrame(loop);
  }

  private _stopLoop(): void {
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  }

  // ===========================================================================
  // PUBLIC API
  // ===========================================================================

  /**
   * Request a render on next frame
   */
  requestRender(): void {
    this._needsRender = true;
  }

  /**
   * Force immediate render
   */
  renderNow(): void {
    this._render();
    this._needsRender = false;
  }

  /**
   * Set scale factor
   */
  setScale(scale: number): void {
    this._scale = scale;
    this.forceFullRedraw();
  }

  /**
   * Get current scale
   */
  getScale(): number {
    return this._scale;
  }

  /**
   * Set background color
   */
  setBackgroundColor(color: string): void {
    this._backgroundColor = color;
    this.forceFullRedraw();
  }

  /**
   * Set canvas dimensions (logical CSS pixels)
   *
   * The canvas buffer will be sized at physical pixel resolution
   * when high-DPI mode is enabled.
   */
  setDimensions(width: number, height: number): void {
    this._logicalWidth = width;
    this._logicalHeight = height;

    if (this._enableHighDPI) {
      this._configureHighDPI();
    } else {
      this._canvas.width = width;
      this._canvas.height = height;
    }

    // Re-apply sharp rendering after resize (context may reset)
    configureSharpRendering(this._ctx, this._imageSmoothingMode);
    this.forceFullRedraw();
  }

  /**
   * Get logical dimensions (CSS pixels)
   */
  getDimensions(): { width: number; height: number } {
    return {
      width: this._logicalWidth,
      height: this._logicalHeight,
    };
  }

  /**
   * Get current device pixel ratio
   */
  getDevicePixelRatio(): number {
    return this._dpr;
  }

  /**
   * Check if high-DPI mode is enabled
   */
  isHighDPIEnabled(): boolean {
    return this._enableHighDPI;
  }

  /**
   * Check if pixel snapping is enabled
   */
  isPixelSnappingEnabled(): boolean {
    return this._enablePixelSnapping;
  }

  // ===========================================================================
  // DIRTY RECTANGLE API
  // ===========================================================================

  /**
   * Mark a shape's bounds as dirty for partial re-rendering
   */
  markShapeDirty(shape: DrawShape): void {
    if (!this._useDirtyRects) {
      this._needsRender = true;
      return;
    }

    const bounds = getShapeBounds(shape);
    const padding = styleRenderPadding(shape.style, this._scale);
    this._dirtyRectManager.markDirty(bounds, padding);
    this._needsRender = true;
  }

  /**
   * Mark bounds as dirty for partial re-rendering
   */
  markBoundsDirty(bounds: Bounds, padding?: number): void {
    if (!this._useDirtyRects) {
      this._needsRender = true;
      return;
    }

    this._dirtyRectManager.markDirty(bounds, padding);
    this._needsRender = true;
  }

  /**
   * Force a full canvas redraw on next frame
   * Use this when scale/tool changes or major state changes occur
   */
  forceFullRedraw(): void {
    this._dirtyRectManager.forceFullRedraw();
    this._needsRender = true;
  }

  /**
   * Enable or disable dirty rectangle optimization
   */
  setUseDirtyRects(enabled: boolean): void {
    this._useDirtyRects = enabled;
    if (!enabled) {
      this._dirtyRectManager.reset();
    }
  }

  /**
   * Check if dirty rectangles are enabled
   */
  isUsingDirtyRects(): boolean {
    return this._useDirtyRects;
  }

  /**
   * Get background color
   */
  getBackgroundColor(): string {
    return this._backgroundColor;
  }

  /**
   * Get canvas element
   */
  getCanvas(): HTMLCanvasElement {
    return this._canvas;
  }

  /**
   * Get 2D context
   */
  getContext(): CanvasRenderingContext2D {
    return this._ctx;
  }

  // ===========================================================================
  // RENDERING
  // ===========================================================================

  private _render(): void {
    const { width, height } = this._canvas;
    const ctx = this._ctx;

    // Combined scale factor: DPR * user scale
    const combinedScale = this._dpr * this._scale;

    // Get dirty regions BEFORE clearing
    const dirtyRegions = this._useDirtyRects
      ? this._dirtyRectManager.getDirtyRegions()
      : [];

    const isFullRedraw = dirtyRegions.length === 0;

    if (isFullRedraw) {
      // Full clear
      clearCanvas(ctx, width, height);

      // Background
      if (this._backgroundColor !== "transparent") {
        ctx.save();
        ctx.fillStyle = this._backgroundColor;
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
      }
    } else {
      // Partial clear - only dirty regions (scaled to canvas coordinates)
      ctx.save();
      for (const region of dirtyRegions) {
        // Scale region to canvas coordinates (including DPR)
        const scaledX = region.x * combinedScale;
        const scaledY = region.y * combinedScale;
        const scaledWidth = region.width * combinedScale;
        const scaledHeight = region.height * combinedScale;

        if (this._backgroundColor !== "transparent") {
          ctx.fillStyle = this._backgroundColor;
          ctx.fillRect(scaledX, scaledY, scaledWidth, scaledHeight);
        } else {
          ctx.clearRect(scaledX, scaledY, scaledWidth, scaledHeight);
        }
      }
      ctx.restore();
    }

    // Apply combined transform using setTransform for clean state
    // This is more reliable than accumulating scale() calls
    ctx.save();
    ctx.setTransform(combinedScale, 0, 0, combinedScale, 0, 0);

    // CRITICAL: Clip rendering to dirty regions for partial updates
    // Without clipping, overlapping semi-transparent shapes accumulate alpha
    // in the intersection area, causing darker colors during transforms.
    if (!isFullRedraw && dirtyRegions.length > 0) {
      ctx.beginPath();
      for (const region of dirtyRegions) {
        ctx.rect(region.x, region.y, region.width, region.height);
      }
      ctx.clip();
    }

    // Get current state
    const shapes = this._stateProvider.getShapes();
    const selectedIds = this._stateProvider.getSelectedIds();
    const previewShape = this._stateProvider.getPreviewShape();
    const editState = this._stateProvider.getEditState?.() ?? null;

    // Filter shapes to only those intersecting dirty regions (for partial render)
    const shapesToRender = isFullRedraw
      ? shapes
      : this._filterShapesToDirtyRegions(shapes, dirtyRegions);

    runWithShapeRenderContext(
      {
        enablePixelSnapping: this._enablePixelSnapping,
        scale: this._scale,
      },
      () => {
        // Render shapes with behavior-aware sorting and styling
        renderShapesWithBehavior(ctx, shapesToRender);

        // Render preview (always uses normal style)
        if (previewShape) {
          const shouldRenderPreview =
            isFullRedraw ||
            this._shapeIntersectsDirty(previewShape, dirtyRegions);
          if (shouldRenderPreview) {
            renderShapesWithBehavior(ctx, [previewShape]);
          }
        }

        // Check if in edit mode (delegated to shape module)
        if (editState) {
          const editingShape = shapes.find((s) => s.id === editState.shapeId);
          if (editingShape && shapeSupportsEditMode(editingShape)) {
            const shouldRenderEdit =
              isFullRedraw ||
              this._shapeIntersectsDirty(editingShape, dirtyRegions);
            if (shouldRenderEdit) {
              // Delegated to shape module - render driver is shape-agnostic
              renderShapeEditMode(ctx, editingShape, editState);
            }
          }
        } else if (!this._stateProvider.isReadOnly?.()) {
          // Render selection UI (delegated to shape modules).
          // Skipped in readOnly — consumers style selection via shape props.
          const selectedShapes = shapes.filter((s) => selectedIds.has(s.id));
          for (const shape of selectedShapes) {
            const shouldRenderSelection =
              isFullRedraw || this._shapeIntersectsDirty(shape, dirtyRegions);
            if (shouldRenderSelection) {
              renderShapeSelection(ctx, shape);
            }
          }
        }

        // Render ephemeral ping effects (post-pass, on top of everything)
        if (this._renderPingEffects(ctx, shapes)) {
          this._needsRender = true;
        }
      }
    );

    ctx.restore();
  }

  /**
   * Render active activation-frame effects (`ping` / `locateFlash` / …).
   * Returns true if any effects are still animating.
   */
  private _renderPingEffects(
    ctx: CanvasRenderingContext2D,
    shapes: DrawShape[]
  ): boolean {
    const effects = this._stateProvider.getPingEffects?.();
    if (!effects || effects.length === 0) return false;

    const now = performance.now();
    const sc = this._scale;
    let hasActive = false;

    for (const effect of effects) {
      const t = (now - effect.startTime) / effect.duration;
      if (t >= 1) continue;
      hasActive = true;

      const shape = shapes.find((s) => s.id === effect.shapeId);
      if (!shape) continue;

      const b = getShapeBounds(shape);
      const [r, g, bb] = effect.color;
      const type = effect.type;

      // Specialized multi-pass path for the default border-trace comet.
      if (type === "ping") {
        const pad = 3 / sc;
        const bx = b.x - pad;
        const by = b.y - pad;
        const bw = b.width + pad * 2;
        const bh = b.height + pad * 2;
        const per = 2 * (bw + bh);
        this._renderBorderTrace(ctx, t, bx, by, bw, bh, per, r, g, bb, sc);
        continue;
      }

      const renderer = getActivationAnimationRenderer(type);
      renderer(ctx, {
        t,
        x: b.x,
        y: b.y,
        width: b.width,
        height: b.height,
        color: effect.color,
        scale: sc,
      });
    }

    return hasActive;
  }

  /**
   * Draw a single border-trace comet for one shape.
   * 1.5 laps, gradient comet trail, bright head dot, smooth collapse to vanishing point.
   */
  private _renderBorderTrace(
    ctx: CanvasRenderingContext2D,
    t: number,
    bx: number,
    by: number,
    bw: number,
    bh: number,
    per: number,
    r: number,
    g: number,
    b: number,
    sc: number,
  ): void {
    const laps = 1.5;
    const totalDist = per * laps;
    const segments = 120;

    // Ease head speed: ease-in-out quadratic
    const headEase =
      t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    const head = headEase * totalDist;

    // Tail collapses cubically toward head
    const maxGap = per * 0.4;
    const gap = maxGap * (1 - t * t * t);
    const tail = Math.max(0, head - gap);

    // Fade in/out envelope
    const fadeIn = Math.min(1, t / 0.06);
    const fadeOut = Math.min(1, gap / (maxGap * 0.08));
    const envelope = fadeIn * fadeOut;
    if (envelope < 0.005) return;

    // Perimeter → point lookup
    const pt = (d: number): [number, number] => {
      d = ((d % per) + per) % per;
      if (d < bw) return [bx + d, by];
      d -= bw;
      if (d < bh) return [bx + bw, by + d];
      d -= bh;
      if (d < bw) return [bx + bw - d, by + bh];
      d -= bw;
      return [bx, by + bh - d];
    };

    // Pre-compute path points
    const pts: Array<[number, number]> = [];
    for (let i = 0; i <= segments; i++) {
      pts.push(pt(tail + (head - tail) * (i / segments)));
    }

    // --- Outer glow pass ---
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 5 / sc;
    ctx.shadowColor = `rgba(${r},${g},${b},${envelope * 0.3})`;
    ctx.shadowBlur = 12 / sc;
    ctx.strokeStyle = `rgba(${r},${g},${b},${envelope * 0.15})`;
    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) {
      if (i === 0) {
        ctx.moveTo(pts[i]![0], pts[i]![1]);
      } else {
        ctx.lineTo(pts[i]![0], pts[i]![1]);
      }
    }
    ctx.stroke();
    ctx.restore();

    // --- Main trail: gradient comet segments ---
    const chunkSize = 4;
    for (let i = 0; i < pts.length - 1; i += chunkSize) {
      const end = Math.min(i + chunkSize + 1, pts.length);
      const segT = i / (pts.length - 1);
      const intensity = segT * segT * segT; // cubic: bright at head
      const segAlpha = envelope * (0.12 + intensity * 0.88);

      ctx.save();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = `rgba(${r},${g},${b},${segAlpha})`;
      ctx.lineWidth = (1.2 + intensity * 1.3) / sc;
      ctx.shadowColor = `rgba(${r},${g},${b},${segAlpha * 0.6})`;
      ctx.shadowBlur = (2 + intensity * 6) / sc;
      ctx.beginPath();
      for (let j = i; j < end; j++) {
        if (j === i) {
          ctx.moveTo(pts[j]![0], pts[j]![1]);
        } else {
          ctx.lineTo(pts[j]![0], pts[j]![1]);
        }
      }
      ctx.stroke();
      ctx.restore();
    }

    // --- Bright head dot ---
    const last = pts[pts.length - 1];
    if (last) {
      ctx.save();
      ctx.fillStyle = `rgba(${Math.min(255, r + 80)},${Math.min(255, g + 60)},${Math.min(255, b + 40)},${envelope})`;
      ctx.shadowColor = `rgba(${r},${g},${b},${envelope * 0.8})`;
      ctx.shadowBlur = 8 / sc;
      ctx.beginPath();
      ctx.arc(last[0], last[1], 2.2 / sc, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  /**
   * Filter shapes to only those intersecting dirty regions
   */
  private _filterShapesToDirtyRegions(
    shapes: DrawShape[],
    dirtyRegions: DirtyRegion[]
  ): DrawShape[] {
    return shapes.filter((shape) =>
      this._shapeIntersectsDirty(shape, dirtyRegions)
    );
  }

  /**
   * Check if a shape intersects any dirty region
   */
  private _shapeIntersectsDirty(
    shape: DrawShape,
    dirtyRegions: DirtyRegion[]
  ): boolean {
    const bounds = getShapeBounds(shape);
    return boundsIntersectsRegions(bounds, dirtyRegions);
  }
}

/**
 * Create a new RenderDriver instance
 */
export function createRenderDriver(
  canvas: HTMLCanvasElement,
  stateProvider: RenderStateProvider,
  options?: RenderDriverOptions
): RenderDriver {
  return new RenderDriver(canvas, stateProvider, options);
}
