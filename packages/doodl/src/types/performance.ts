/**
 * Performance configuration types for Doodl
 *
 * Feature flags for enabling/disabling performance optimizations.
 * All optimizations are enabled by default but can be disabled
 * if issues arise without reverting code.
 */

// =============================================================================
// RENDERING QUALITY CONFIG
// =============================================================================

/**
 * Image smoothing mode for canvas rendering
 */
export type ImageSmoothingMode = "disabled" | "low" | "medium" | "high";

/**
 * Rendering quality configuration for crisp display
 */
export interface RenderingQualityConfig {
  /**
   * Enable high-DPI (Retina) rendering
   * (default: true)
   *
   * When enabled, canvas is sized at physical pixel resolution
   * and CSS is used for display sizing. This provides crisp
   * rendering on high-DPI displays (2x, 3x).
   */
  enableHighDPI?: boolean;

  /**
   * Image smoothing mode for canvas rendering
   * (default: "disabled")
   *
   * - "disabled": Sharp edges, no anti-aliasing (best for UI/selection)
   * - "low": Minimal smoothing
   * - "medium": Balanced smoothing
   * - "high": Maximum smoothing (best for images)
   */
  imageSmoothingMode?: ImageSmoothingMode;

  /**
   * Enable pixel snapping for crisp lines
   * (default: true)
   *
   * When enabled, coordinates are snapped to pixel boundaries
   * (x + 0.5) for 1px crisp lines. Only affects selection UI.
   */
  enablePixelSnapping?: boolean;

  /**
   * Use GPU-optimized canvas context options
   * (default: true)
   *
   * When enabled, uses desynchronized rendering and optimized
   * alpha/read settings for better performance.
   */
  useGPUOptimizedContext?: boolean;
}

// =============================================================================
// DOODL PERFORMANCE CONFIG
// =============================================================================

/**
 * Performance configuration for Doodl canvas engine
 */
export interface DoodlPerformanceConfig {
  /**
   * Enable dirty rectangle optimization for partial canvas re-rendering
   * (default: true)
   *
   * When enabled, only changed regions of the canvas are cleared and redrawn,
   * significantly reducing rendering overhead for hover/selection changes.
   */
  useDirtyRects?: boolean;

  /**
   * Enable spatial indexing for O(log n) hit testing
   * (default: true)
   *
   * When enabled, shapes are indexed in a grid structure for faster
   * point queries. Beneficial for documents with 50+ shapes.
   */
  useSpatialIndex?: boolean;

  /**
   * Enable render batching to reduce context state changes
   * (default: true)
   *
   * When enabled, shapes are grouped by style before rendering to
   * minimize ctx.save()/restore() and style application calls.
   */
  useBatchedRender?: boolean;

  /**
   * Enable Path2D caching for text highlights
   * (default: true)
   *
   * When enabled, marker highlight paths are cached and reused across
   * frames, avoiding expensive path regeneration.
   */
  usePathCache?: boolean;

  /**
   * Cell size for spatial index grid (default: 100)
   *
   * Smaller values = more cells, faster queries for dense areas
   * Larger values = fewer cells, better for sparse areas
   */
  spatialIndexCellSize?: number;

  /**
   * Proximity threshold for dirty region merging (default: 50)
   *
   * Regions within this distance (in pixels) may be merged to reduce
   * the number of clearRect operations.
   */
  dirtyRectProximity?: number;

  /**
   * Force full redraw interval in frames (default: 60)
   *
   * Periodic full redraw to prevent accumulating visual artifacts
   * from partial updates. Set to 0 to disable.
   */
  fullRedrawInterval?: number;

  /**
   * Rendering quality configuration for crisp display
   */
  rendering?: RenderingQualityConfig;
}

/**
 * Default rendering quality configuration
 */
export const DEFAULT_RENDERING_CONFIG: Required<RenderingQualityConfig> = {
  enableHighDPI: true,
  imageSmoothingMode: "disabled",
  enablePixelSnapping: true,
  useGPUOptimizedContext: true,
};

/**
 * Full performance config with rendering as required
 */
export interface ResolvedDoodlPerformanceConfig {
  useDirtyRects: boolean;
  useSpatialIndex: boolean;
  useBatchedRender: boolean;
  usePathCache: boolean;
  spatialIndexCellSize: number;
  dirtyRectProximity: number;
  fullRedrawInterval: number;
  rendering: Required<RenderingQualityConfig>;
}

/**
 * Default performance configuration
 */
export const DEFAULT_PERFORMANCE_CONFIG: ResolvedDoodlPerformanceConfig = {
  useDirtyRects: true,
  useSpatialIndex: true,
  useBatchedRender: true,
  usePathCache: true,
  spatialIndexCellSize: 100,
  dirtyRectProximity: 50,
  fullRedrawInterval: 60,
  rendering: DEFAULT_RENDERING_CONFIG,
};

/**
 * Create a performance config with defaults
 */
export function createPerformanceConfig(
  overrides?: Partial<DoodlPerformanceConfig>
): ResolvedDoodlPerformanceConfig {
  return {
    ...DEFAULT_PERFORMANCE_CONFIG,
    ...overrides,
    rendering: {
      ...DEFAULT_RENDERING_CONFIG,
      ...overrides?.rendering,
    },
  };
}
