/**
 * CanvasPool - Shared canvas pool for multi-page annotation
 *
 * Reduces memory allocation overhead by:
 * - Reusing canvas elements across pages
 * - Managing a pool of pre-allocated canvases
 * - Pruning stale canvases after timeout
 *
 * DPR-aware: Canvases are sized at physical pixel resolution
 * for crisp Retina rendering. CSS dimensions handle display sizing.
 *
 * GPU-optimized: Uses desynchronized rendering and optimal context options.
 */

// =============================================================================
// TYPES
// =============================================================================

interface PooledCanvas {
  canvas: HTMLCanvasElement;
  inUse: boolean;
  lastUsed: number;
  /** Logical width (CSS pixels) */
  logicalWidth: number;
  /** Logical height (CSS pixels) */
  logicalHeight: number;
  /** Physical width (device pixels) */
  physicalWidth: number;
  /** Physical height (device pixels) */
  physicalHeight: number;
  /** DPR used when canvas was sized */
  dpr: number;
}

/**
 * Configuration options for canvas pool
 */
export interface CanvasPoolOptions {
  /** Maximum number of canvases to keep in pool (default: 10) */
  maxSize?: number;
  /** Time in ms before unused canvas is pruned (default: 30000) */
  staleTimeout?: number;
  /** Interval in ms for pruning check (default: 10000) */
  pruneInterval?: number;
  /** Enable high-DPI support (default: true) */
  enableHighDPI?: boolean;
  /** Use GPU-optimized context options (default: true) */
  useGPUOptimizedContext?: boolean;
}

/**
 * GPU-optimized canvas context options
 */
const GPU_OPTIMIZED_CONTEXT_OPTIONS: CanvasRenderingContext2DSettings = {
  alpha: true, // Required for transparency in annotation overlays
  desynchronized: true, // Lower latency by bypassing compositor
  willReadFrequently: false, // GPU rendering path
};

// =============================================================================
// UTILITIES
// =============================================================================

/**
 * Get device pixel ratio with fallback
 */
function getDevicePixelRatio(): number {
  return typeof window !== "undefined" ? window.devicePixelRatio ?? 1 : 1;
}

/**
 * Configure canvas for DPR-aware rendering
 */
function configureCanvasForDPR(
  canvas: HTMLCanvasElement,
  logicalWidth: number,
  logicalHeight: number,
  enableHighDPI: boolean
): { physicalWidth: number; physicalHeight: number; dpr: number } {
  const dpr = enableHighDPI ? getDevicePixelRatio() : 1;
  const physicalWidth = Math.round(logicalWidth * dpr);
  const physicalHeight = Math.round(logicalHeight * dpr);

  // Set physical buffer dimensions
  canvas.width = physicalWidth;
  canvas.height = physicalHeight;

  // Set CSS display dimensions
  canvas.style.width = `${logicalWidth}px`;
  canvas.style.height = `${logicalHeight}px`;

  return { physicalWidth, physicalHeight, dpr };
}

// =============================================================================
// CANVAS POOL
// =============================================================================

/**
 * Pool of reusable canvas elements with DPR and GPU optimization
 */
export class CanvasPool {
  private _pool: PooledCanvas[] = [];
  private _maxSize: number;
  private _staleTimeout: number;
  private _pruneInterval: number;
  private _enableHighDPI: boolean;
  private _useGPUOptimizedContext: boolean;
  private _pruneTimer: ReturnType<typeof setInterval> | null = null;

  constructor(options: CanvasPoolOptions = {}) {
    this._maxSize = options.maxSize ?? 10;
    this._staleTimeout = options.staleTimeout ?? 30000;
    this._pruneInterval = options.pruneInterval ?? 10000;
    this._enableHighDPI = options.enableHighDPI ?? true;
    this._useGPUOptimizedContext = options.useGPUOptimizedContext ?? true;

    // Start periodic pruning
    this._startPruning();
  }

  // ===========================================================================
  // PUBLIC API
  // ===========================================================================

  /**
   * Acquire a canvas from the pool
   *
   * @param logicalWidth - Desired canvas width in CSS pixels
   * @param logicalHeight - Desired canvas height in CSS pixels
   * @returns Canvas element configured for DPR-aware rendering
   */
  acquire(logicalWidth: number, logicalHeight: number): HTMLCanvasElement {
    const currentDPR = this._enableHighDPI ? getDevicePixelRatio() : 1;

    // Try to find a canvas with matching logical dimensions and DPR
    for (const pooled of this._pool) {
      if (
        !pooled.inUse &&
        pooled.logicalWidth === logicalWidth &&
        pooled.logicalHeight === logicalHeight &&
        pooled.dpr === currentDPR
      ) {
        pooled.inUse = true;
        pooled.lastUsed = Date.now();
        return pooled.canvas;
      }
    }

    // Try to find any unused canvas and reconfigure it
    for (const pooled of this._pool) {
      if (!pooled.inUse) {
        const { physicalWidth, physicalHeight, dpr } = configureCanvasForDPR(
          pooled.canvas,
          logicalWidth,
          logicalHeight,
          this._enableHighDPI
        );

        pooled.logicalWidth = logicalWidth;
        pooled.logicalHeight = logicalHeight;
        pooled.physicalWidth = physicalWidth;
        pooled.physicalHeight = physicalHeight;
        pooled.dpr = dpr;
        pooled.inUse = true;
        pooled.lastUsed = Date.now();

        return pooled.canvas;
      }
    }

    // Create new canvas if pool not full
    if (this._pool.length < this._maxSize) {
      const canvas = document.createElement("canvas");
      const { physicalWidth, physicalHeight, dpr } = configureCanvasForDPR(
        canvas,
        logicalWidth,
        logicalHeight,
        this._enableHighDPI
      );

      // Pre-initialize context with GPU options
      if (this._useGPUOptimizedContext) {
        canvas.getContext("2d", GPU_OPTIMIZED_CONTEXT_OPTIONS);
      }

      this._pool.push({
        canvas,
        inUse: true,
        lastUsed: Date.now(),
        logicalWidth,
        logicalHeight,
        physicalWidth,
        physicalHeight,
        dpr,
      });

      return canvas;
    }

    // Pool full - create temporary canvas (not pooled)
    const canvas = document.createElement("canvas");
    configureCanvasForDPR(
      canvas,
      logicalWidth,
      logicalHeight,
      this._enableHighDPI
    );

    if (this._useGPUOptimizedContext) {
      canvas.getContext("2d", GPU_OPTIMIZED_CONTEXT_OPTIONS);
    }

    return canvas;
  }

  /**
   * Release a canvas back to the pool
   *
   * @param canvas - Canvas to release
   */
  release(canvas: HTMLCanvasElement): void {
    const pooled = this._pool.find((p) => p.canvas === canvas);
    if (pooled) {
      pooled.inUse = false;
      pooled.lastUsed = Date.now();

      // Clear canvas content for reuse
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
    // If not found in pool, it was a temporary canvas - let it be GC'd
  }

  /**
   * Prune stale canvases from the pool
   */
  prune(): void {
    const now = Date.now();

    this._pool = this._pool.filter((pooled) => {
      // Keep in-use canvases
      if (pooled.inUse) return true;

      // Remove stale canvases
      if (now - pooled.lastUsed > this._staleTimeout) {
        // Clear canvas buffer to free GPU memory
        pooled.canvas.width = 0;
        pooled.canvas.height = 0;
        return false;
      }

      return true;
    });
  }

  /**
   * Get current pool statistics
   */
  getStats(): {
    total: number;
    inUse: number;
    available: number;
    totalPhysicalPixels: number;
  } {
    const inUse = this._pool.filter((p) => p.inUse).length;
    const totalPhysicalPixels = this._pool.reduce(
      (sum, p) => sum + p.physicalWidth * p.physicalHeight,
      0
    );
    return {
      total: this._pool.length,
      inUse,
      available: this._pool.length - inUse,
      totalPhysicalPixels,
    };
  }

  /**
   * Get maximum pool size
   */
  getMaxSize(): number {
    return this._maxSize;
  }

  /**
   * Set maximum pool size
   */
  setMaxSize(size: number): void {
    this._maxSize = size;
    // Prune if over new limit
    while (this._pool.length > this._maxSize) {
      const unused = this._pool.find((p) => !p.inUse);
      if (unused) {
        const index = this._pool.indexOf(unused);
        unused.canvas.width = 0;
        unused.canvas.height = 0;
        this._pool.splice(index, 1);
      } else {
        break; // All canvases in use
      }
    }
  }

  /**
   * Check if high-DPI mode is enabled
   */
  isHighDPIEnabled(): boolean {
    return this._enableHighDPI;
  }

  /**
   * Clear all canvases from pool
   */
  clear(): void {
    for (const pooled of this._pool) {
      pooled.canvas.width = 0;
      pooled.canvas.height = 0;
    }
    this._pool = [];
  }

  /**
   * Destroy pool and stop pruning
   */
  destroy(): void {
    this._stopPruning();
    this.clear();
  }

  // ===========================================================================
  // PRIVATE
  // ===========================================================================

  private _startPruning(): void {
    if (this._pruneTimer) return;

    this._pruneTimer = setInterval(() => {
      this.prune();
    }, this._pruneInterval);
  }

  private _stopPruning(): void {
    if (this._pruneTimer) {
      clearInterval(this._pruneTimer);
      this._pruneTimer = null;
    }
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

/**
 * Shared global canvas pool for annotation layers
 *
 * Pre-configured with:
 * - DPR-aware sizing for Retina displays
 * - GPU-optimized context options
 * - Auto-pruning of stale canvases
 */
export const annotationCanvasPool = new CanvasPool();

/**
 * Create a new canvas pool instance
 */
export function createCanvasPool(options?: CanvasPoolOptions): CanvasPool {
  return new CanvasPool(options);
}
