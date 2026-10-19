/**
 * Text Highlight renderer - Marker-like effect
 *
 * Creates an organic, hand-drawn highlighter appearance with:
 * - Slightly wavy/uneven edges
 * - Tapered capsule-like ends
 * - Layered rendering for depth
 * - Subtle opacity variation
 *
 * Performance optimization: Path2D caching to avoid regenerating
 * paths every frame.
 */

import type { Bounds } from "../../types/geometry";
import { mapBlendMode } from "../common/utils/canvas";
import type { TextHighlightShape } from "./types";

// =============================================================================
// PATH CACHE (Performance Optimization)
// =============================================================================

/**
 * Cache for Path2D objects to avoid regenerating paths every frame
 */
const pathCache = new Map<string, Path2D>();
const MAX_PATH_CACHE_SIZE = 500;

/**
 * Generate cache key for a marker path
 * Uses rounded values for stability across frames
 */
function getPathCacheKey(
  x: number,
  y: number,
  width: number,
  height: number,
  seed: number,
  waveIntensity: number
): string {
  // Round to 0.5px for cache key stability
  const rx = Math.round(x * 2) / 2;
  const ry = Math.round(y * 2) / 2;
  const rw = Math.round(width * 2) / 2;
  const rh = Math.round(height * 2) / 2;
  return `${rx},${ry},${rw},${rh},${seed},${waveIntensity.toFixed(1)}`;
}

/**
 * Get a cached Path2D or create a new one
 */
function getCachedPath(
  x: number,
  y: number,
  width: number,
  height: number,
  seed: number,
  waveIntensity: number
): Path2D {
  const key = getPathCacheKey(x, y, width, height, seed, waveIntensity);

  let path = pathCache.get(key);
  if (!path) {
    path = new Path2D();
    buildMarkerPath(path, x, y, width, height, seed, waveIntensity);

    // LRU-style eviction if cache is full
    if (pathCache.size >= MAX_PATH_CACHE_SIZE) {
      // Remove oldest entry (first key)
      const firstKey = pathCache.keys().next().value;
      if (firstKey !== undefined) {
        pathCache.delete(firstKey);
      }
    }
    pathCache.set(key, path);
  }

  return path;
}

/**
 * Clear the path cache
 * Call when settings change or to free memory
 */
export function clearPathCache(): void {
  pathCache.clear();
}

/**
 * Get current path cache size
 */
export function getPathCacheSize(): number {
  return pathCache.size;
}

/** Enable/disable path caching (default: true) */
let usePathCaching = true;

/**
 * Enable or disable path caching
 */
export function setUsePathCaching(enabled: boolean): void {
  usePathCaching = enabled;
  if (!enabled) {
    clearPathCache();
  }
}

// =============================================================================
// CONFIGURABLE SETTINGS
// =============================================================================

/**
 * Marker rendering settings (configurable at runtime)
 */
export interface MarkerSettings {
  /** Number of segments for wavy edges (2-20) */
  edgeSegments: number;
  /** Maximum edge waviness in pixels (0-5) */
  waveAmplitude: number;
  /** Taper ratio at ends (0-1, how much to narrow) */
  endTaper: number;
  /** Capsule end radius ratio relative to height (0-1) */
  capsuleRatio: number;
  /** Glow layer opacity multiplier (0-1) */
  glowOpacity: number;
  /** Main layer opacity multiplier (0-1) */
  mainOpacity: number;
  /** Center layer opacity multiplier (0-1) */
  centerOpacity: number;
  /** Glow layer size expansion in pixels */
  glowExpand: number;
  /** Center layer inset ratio (0-0.5) */
  centerInset: number;
}

/**
 * Default marker settings
 */
export const DEFAULT_MARKER_SETTINGS: MarkerSettings = {
  edgeSegments: 8,
  waveAmplitude: 1.5,
  endTaper: 0.3,
  capsuleRatio: 0.4,
  glowOpacity: 0.3,
  mainOpacity: 0.8,
  centerOpacity: 0.5,
  glowExpand: 1,
  centerInset: 0.15,
};

/**
 * Current marker settings (mutable for runtime tuning)
 */
export const markerSettings: MarkerSettings = { ...DEFAULT_MARKER_SETTINGS };

/**
 * Update marker settings
 */
export function setMarkerSettings(settings: Partial<MarkerSettings>): void {
  Object.assign(markerSettings, settings);
}

/**
 * Reset marker settings to defaults
 */
export function resetMarkerSettings(): void {
  Object.assign(markerSettings, DEFAULT_MARKER_SETTINGS);
}

// =============================================================================
// MAIN RENDERER
// =============================================================================

/**
 * Render a text highlight shape with marker-like effect
 */
export function renderTextHighlight(
  ctx: CanvasRenderingContext2D,
  shape: TextHighlightShape
): void {
  if (shape.rects.length === 0) return;

  const fillColor = shape.style.fill;
  if (!fillColor || fillColor === "none") return;

  ctx.save();

  // Apply blend mode
  if (shape.style.blendMode) {
    ctx.globalCompositeOperation = mapBlendMode(shape.style.blendMode);
  }

  const baseOpacity = shape.style.fillOpacity ?? 0.4;

  // Draw each highlight rect with marker effect
  for (let i = 0; i < shape.rects.length; i++) {
    const rect = shape.rects[i]!;
    // Use deterministic seed based on position for consistent randomization
    const seed = rect.x * 1000 + rect.y * 100 + rect.width + i;

    renderMarkerHighlight(ctx, rect, fillColor, baseOpacity, seed);
  }

  ctx.restore();
}

// =============================================================================
// MARKER RENDERING
// =============================================================================

/**
 * Render a single marker-like highlight
 */
function renderMarkerHighlight(
  ctx: CanvasRenderingContext2D,
  rect: Bounds,
  color: string,
  opacity: number,
  seed: number
): void {
  const { x, y, width, height } = rect;
  const s = markerSettings;

  // Skip tiny rects
  if (width < 2 || height < 2) return;

  const expand = s.glowExpand;
  const inset = Math.min(2, height * s.centerInset);

  if (usePathCaching) {
    // Performance optimized path: Use cached Path2D objects
    // Layer 1: Soft outer glow
    ctx.globalAlpha = opacity * s.glowOpacity;
    ctx.fillStyle = color;
    const glowPath = getCachedPath(
      x - expand,
      y - expand,
      width + expand * 2,
      height + expand * 2,
      seed,
      0.5
    );
    ctx.fill(glowPath);

    // Layer 2: Main marker body
    ctx.globalAlpha = opacity * s.mainOpacity;
    const mainPath = getCachedPath(x, y, width, height, seed, 1.0);
    ctx.fill(mainPath);

    // Layer 3: Center intensity
    ctx.globalAlpha = opacity * s.centerOpacity;
    const centerPath = getCachedPath(
      x + inset * 0.5,
      y + inset,
      width - inset,
      height - inset * 2,
      seed,
      0.3
    );
    ctx.fill(centerPath);
  } else {
    // Original path: Draw directly to context (no caching)
    // Layer 1: Soft outer glow (wider, lower opacity)
    ctx.globalAlpha = opacity * s.glowOpacity;
    ctx.fillStyle = color;
    drawMarkerPath(
      ctx,
      x - expand,
      y - expand,
      width + expand * 2,
      height + expand * 2,
      seed,
      0.5
    );
    ctx.fill();

    // Layer 2: Main marker body
    ctx.globalAlpha = opacity * s.mainOpacity;
    ctx.fillStyle = color;
    drawMarkerPath(ctx, x, y, width, height, seed, 1.0);
    ctx.fill();

    // Layer 3: Center intensity (narrower, slightly higher opacity)
    ctx.globalAlpha = opacity * s.centerOpacity;
    ctx.fillStyle = color;
    drawMarkerPath(
      ctx,
      x + inset * 0.5,
      y + inset,
      width - inset,
      height - inset * 2,
      seed,
      0.3
    );
    ctx.fill();
  }
}

/**
 * Build an organic marker-like path into a Path2D object (for caching)
 */
function buildMarkerPath(
  path: Path2D,
  x: number,
  y: number,
  width: number,
  height: number,
  seed: number,
  waveIntensity: number
): void {
  const s = markerSettings;
  const capsuleRadius = Math.min(height * s.capsuleRatio, width * 0.2, 6);
  const taper = height * s.endTaper * waveIntensity;

  // Start at top-left, after the left capsule
  const startX = x + capsuleRadius;
  const startY = y + taper * seededRandom(seed, 0);

  path.moveTo(startX, startY);

  // Top edge: wavy line going right
  const topPoints = generateWavyEdge(
    startX,
    y,
    x + width - capsuleRadius,
    y,
    s.edgeSegments,
    s.waveAmplitude * waveIntensity,
    seed + 1,
    taper
  );

  for (const pt of topPoints) {
    path.lineTo(pt.x, pt.y);
  }

  // Right capsule end (tapered)
  const rightCenterY = y + height / 2;
  const rightTaper = taper * seededRandom(seed, 2);
  path.quadraticCurveTo(
    x + width + capsuleRadius * 0.3,
    y + rightTaper,
    x + width,
    rightCenterY
  );
  path.quadraticCurveTo(
    x + width + capsuleRadius * 0.3,
    y + height - rightTaper,
    x + width - capsuleRadius,
    y + height - taper * seededRandom(seed, 3)
  );

  // Bottom edge: wavy line going left
  const bottomPoints = generateWavyEdge(
    x + width - capsuleRadius,
    y + height,
    startX,
    y + height,
    s.edgeSegments,
    s.waveAmplitude * waveIntensity,
    seed + 4,
    taper
  );

  for (const pt of bottomPoints) {
    path.lineTo(pt.x, pt.y);
  }

  // Left capsule end (tapered)
  const leftCenterY = y + height / 2;
  const leftTaper = taper * seededRandom(seed, 5);
  path.quadraticCurveTo(
    x - capsuleRadius * 0.3,
    y + height - leftTaper,
    x,
    leftCenterY
  );
  path.quadraticCurveTo(x - capsuleRadius * 0.3, y + leftTaper, startX, startY);

  path.closePath();
}

/**
 * Draw an organic marker-like path with wavy edges and tapered ends
 * (Direct context drawing - used when path caching is disabled)
 */
function drawMarkerPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  seed: number,
  waveIntensity: number
): void {
  const s = markerSettings;
  const capsuleRadius = Math.min(height * s.capsuleRatio, width * 0.2, 6);
  const taper = height * s.endTaper * waveIntensity;

  ctx.beginPath();

  // Start at top-left, after the left capsule
  const startX = x + capsuleRadius;
  const startY = y + taper * seededRandom(seed, 0);

  ctx.moveTo(startX, startY);

  // Top edge: wavy line going right
  const topPoints = generateWavyEdge(
    startX,
    y,
    x + width - capsuleRadius,
    y,
    s.edgeSegments,
    s.waveAmplitude * waveIntensity,
    seed + 1,
    taper
  );

  for (const pt of topPoints) {
    ctx.lineTo(pt.x, pt.y);
  }

  // Right capsule end (tapered)
  const rightCenterY = y + height / 2;
  const rightTaper = taper * seededRandom(seed, 2);
  ctx.quadraticCurveTo(
    x + width + capsuleRadius * 0.3,
    y + rightTaper,
    x + width,
    rightCenterY
  );
  ctx.quadraticCurveTo(
    x + width + capsuleRadius * 0.3,
    y + height - rightTaper,
    x + width - capsuleRadius,
    y + height - taper * seededRandom(seed, 3)
  );

  // Bottom edge: wavy line going left
  const bottomPoints = generateWavyEdge(
    x + width - capsuleRadius,
    y + height,
    startX,
    y + height,
    s.edgeSegments,
    s.waveAmplitude * waveIntensity,
    seed + 4,
    taper
  );

  for (const pt of bottomPoints) {
    ctx.lineTo(pt.x, pt.y);
  }

  // Left capsule end (tapered)
  const leftCenterY = y + height / 2;
  const leftTaper = taper * seededRandom(seed, 5);
  ctx.quadraticCurveTo(
    x - capsuleRadius * 0.3,
    y + height - leftTaper,
    x,
    leftCenterY
  );
  ctx.quadraticCurveTo(x - capsuleRadius * 0.3, y + leftTaper, startX, startY);

  ctx.closePath();
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Generate points for a wavy edge
 */
function generateWavyEdge(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  segments: number,
  amplitude: number,
  seed: number,
  taper: number
): Array<{ x: number; y: number }> {
  const points: Array<{ x: number; y: number }> = [];
  const dx = (x2 - x1) / segments;
  const dy = (y2 - y1) / segments;

  for (let i = 1; i <= segments; i++) {
    const t = i / segments;
    const baseX = x1 + dx * i;
    const baseY = y1 + dy * i;

    // Taper the waviness at the ends
    const edgeFade = Math.sin(t * Math.PI); // 0 at ends, 1 in middle
    const wave = amplitude * edgeFade * (seededRandom(seed, i) * 2 - 1);

    // Also apply slight vertical taper variation
    const taperVariation = taper * 0.3 * (seededRandom(seed, i + 100) - 0.5);

    points.push({
      x: baseX,
      y: baseY + wave + taperVariation,
    });
  }

  return points;
}

/**
 * Deterministic pseudo-random number generator
 * Returns value between 0 and 1
 */
function seededRandom(seed: number, offset: number): number {
  const x = Math.sin(seed + offset * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}
