/**
 * DirtyRectManager - Tracks changed regions for partial canvas re-rendering
 *
 * Optimizes canvas rendering by:
 * - Tracking dirty regions that need redrawing
 * - Merging overlapping/proximate regions to reduce draw calls
 * - Forcing periodic full redraws to prevent visual artifacts
 */

import type { Bounds } from "../../types";

// =============================================================================
// TYPES
// =============================================================================

/**
 * A region that needs to be redrawn
 */
export interface DirtyRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Configuration options for dirty rectangle management
 */
export interface DirtyRectManagerOptions {
  /** Merge regions closer than this distance in pixels (default: 50) */
  proximityThreshold?: number;
  /** Maximum waste ratio when merging regions (default: 1.5 = 50% waste allowed) */
  maxWasteRatio?: number;
  /** Force full redraw after this many partial updates (default: 60) */
  fullRedrawInterval?: number;
  /** Padding added around dirty regions for stroke width (default: 4) */
  regionPadding?: number;
}

// =============================================================================
// DIRTY RECT MANAGER
// =============================================================================

/**
 * Manages dirty rectangle tracking and merging for partial canvas rendering
 */
export class DirtyRectManager {
  private _dirtyRegions: DirtyRegion[] = [];
  private _forceFullRedraw = true;
  private _partialUpdateCount = 0;
  private _options: Required<DirtyRectManagerOptions>;

  constructor(options: DirtyRectManagerOptions = {}) {
    this._options = {
      proximityThreshold: options.proximityThreshold ?? 50,
      maxWasteRatio: options.maxWasteRatio ?? 1.5,
      fullRedrawInterval: options.fullRedrawInterval ?? 60,
      regionPadding: options.regionPadding ?? 4,
    };
  }

  // ===========================================================================
  // PUBLIC API
  // ===========================================================================

  /**
   * Mark a shape's bounds as dirty
   *
   * @param bounds - Shape bounds to mark dirty
   * @param padding - Extra padding around bounds (for stroke width, shadows, etc.)
   */
  markDirty(bounds: Bounds, padding?: number): void {
    if (this._forceFullRedraw) return;

    const p = padding ?? this._options.regionPadding;
    this._dirtyRegions.push({
      x: bounds.x - p,
      y: bounds.y - p,
      width: bounds.width + p * 2,
      height: bounds.height + p * 2,
    });
  }

  /**
   * Mark a region by coordinates as dirty
   */
  markRegionDirty(
    x: number,
    y: number,
    width: number,
    height: number,
    padding?: number
  ): void {
    if (this._forceFullRedraw) return;

    const p = padding ?? this._options.regionPadding;
    this._dirtyRegions.push({
      x: x - p,
      y: y - p,
      width: width + p * 2,
      height: height + p * 2,
    });
  }

  /**
   * Force a full canvas redraw on next frame
   */
  forceFullRedraw(): void {
    this._forceFullRedraw = true;
    this._dirtyRegions = [];
  }

  /**
   * Get merged dirty regions and reset for next frame
   *
   * @returns Array of dirty regions to redraw. Empty array means full redraw needed.
   */
  getDirtyRegions(): DirtyRegion[] {
    // If full redraw was forced, clear state and return empty (signals full redraw)
    if (this._forceFullRedraw) {
      this._forceFullRedraw = false;
      this._partialUpdateCount = 0;
      return [];
    }

    // Periodic full redraw to prevent accumulating visual artifacts
    this._partialUpdateCount++;
    if (this._partialUpdateCount >= this._options.fullRedrawInterval) {
      this.forceFullRedraw();
      return [];
    }

    // Return merged regions and reset
    const merged = this._mergeRegions([...this._dirtyRegions]);
    this._dirtyRegions = [];
    return merged;
  }

  /**
   * Check if any dirty regions exist
   */
  hasDirtyRegions(): boolean {
    return this._forceFullRedraw || this._dirtyRegions.length > 0;
  }

  /**
   * Check if a full redraw is pending
   */
  isFullRedrawPending(): boolean {
    return this._forceFullRedraw;
  }

  /**
   * Get current dirty region count (before merge)
   */
  getDirtyRegionCount(): number {
    return this._dirtyRegions.length;
  }

  /**
   * Clear all dirty regions without triggering full redraw
   */
  clearDirtyRegions(): void {
    this._dirtyRegions = [];
  }

  /**
   * Reset manager state
   */
  reset(): void {
    this._dirtyRegions = [];
    this._forceFullRedraw = true;
    this._partialUpdateCount = 0;
  }

  // ===========================================================================
  // REGION MERGING
  // ===========================================================================

  private _mergeRegions(regions: DirtyRegion[]): DirtyRegion[] {
    if (regions.length <= 1) return regions;

    // Use sweep-line merge for many regions, pairwise for few
    if (regions.length > 10) {
      return this._sweepLineMerge(regions);
    }

    return this._pairwiseMerge(regions);
  }

  /**
   * Simple pairwise merge algorithm for small number of regions
   * O(n²) but fast for small n
   */
  private _pairwiseMerge(regions: DirtyRegion[]): DirtyRegion[] {
    const merged = [...regions];
    let changed = true;

    while (changed) {
      changed = false;

      for (let i = 0; i < merged.length; i++) {
        for (let j = i + 1; j < merged.length; j++) {
          const a = merged[i]!;
          const b = merged[j]!;

          if (this._shouldMerge(a, b)) {
            merged[i] = this._mergeTwo(a, b);
            merged.splice(j, 1);
            changed = true;
            break;
          }
        }
        if (changed) break;
      }
    }

    return merged;
  }

  /**
   * Sweep-line merge algorithm for many regions
   * O(n log n) complexity, more efficient for large region counts
   */
  private _sweepLineMerge(regions: DirtyRegion[]): DirtyRegion[] {
    // Sort by x coordinate for sweep line
    const sorted = [...regions].sort((a, b) => a.x - b.x);

    const result: DirtyRegion[] = [];
    const active: DirtyRegion[] = [];

    for (const region of sorted) {
      // Remove regions that can no longer overlap (sweep line passed them)
      const threshold = this._options.proximityThreshold;
      const cutoff = region.x - threshold;

      for (let i = active.length - 1; i >= 0; i--) {
        const activeRegion = active[i]!;
        if (activeRegion.x + activeRegion.width < cutoff) {
          result.push(activeRegion);
          active.splice(i, 1);
        }
      }

      // Try to merge with active regions
      let merged = false;
      for (let i = 0; i < active.length; i++) {
        const activeRegion = active[i]!;
        if (this._shouldMerge(activeRegion, region)) {
          active[i] = this._mergeTwo(activeRegion, region);
          merged = true;
          break;
        }
      }

      if (!merged) {
        active.push(region);
      }
    }

    // Add remaining active regions
    result.push(...active);

    return result;
  }

  /**
   * Determine if two regions should be merged
   */
  private _shouldMerge(a: DirtyRegion, b: DirtyRegion): boolean {
    // Always merge overlapping regions
    if (this._overlaps(a, b)) {
      return true;
    }

    // Check proximity
    const gap = this._gapDistance(a, b);
    if (gap > this._options.proximityThreshold) {
      return false;
    }

    // Check waste ratio - don't merge if it creates too much wasted area
    const merged = this._mergeTwo(a, b);
    const mergedArea = merged.width * merged.height;
    const sumArea = a.width * a.height + b.width * b.height;
    const wasteRatio = mergedArea / sumArea;

    return wasteRatio <= this._options.maxWasteRatio;
  }

  /**
   * Check if two regions overlap
   */
  private _overlaps(a: DirtyRegion, b: DirtyRegion): boolean {
    return !(
      a.x + a.width < b.x ||
      b.x + b.width < a.x ||
      a.y + a.height < b.y ||
      b.y + b.height < a.y
    );
  }

  /**
   * Calculate gap distance between two regions
   */
  private _gapDistance(a: DirtyRegion, b: DirtyRegion): number {
    const gapX = Math.max(
      0,
      Math.max(a.x, b.x) - Math.min(a.x + a.width, b.x + b.width)
    );
    const gapY = Math.max(
      0,
      Math.max(a.y, b.y) - Math.min(a.y + a.height, b.y + b.height)
    );

    return Math.sqrt(gapX * gapX + gapY * gapY);
  }

  /**
   * Merge two regions into their bounding box
   */
  private _mergeTwo(a: DirtyRegion, b: DirtyRegion): DirtyRegion {
    const x = Math.min(a.x, b.x);
    const y = Math.min(a.y, b.y);

    return {
      x,
      y,
      width: Math.max(a.x + a.width, b.x + b.width) - x,
      height: Math.max(a.y + a.height, b.y + b.height) - y,
    };
  }
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Check if a bounds intersects with any dirty regions
 */
export function boundsIntersectsRegions(
  bounds: Bounds,
  regions: DirtyRegion[]
): boolean {
  for (const region of regions) {
    if (
      !(
        bounds.x + bounds.width < region.x ||
        region.x + region.width < bounds.x ||
        bounds.y + bounds.height < region.y ||
        region.y + region.height < bounds.y
      )
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Create a new DirtyRectManager instance
 */
export function createDirtyRectManager(
  options?: DirtyRectManagerOptions
): DirtyRectManager {
  return new DirtyRectManager(options);
}

