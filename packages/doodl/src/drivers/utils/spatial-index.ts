/**
 * SpatialIndex - Grid-based spatial index for efficient hit testing
 *
 * Provides O(log n) hit testing instead of O(n) linear scan by:
 * - Dividing space into grid cells
 * - Storing items in cells they overlap
 * - Only checking items in queried cell(s)
 */

import type { Bounds, Point } from "../../types";

// =============================================================================
// TYPES
// =============================================================================

/**
 * Item that can be indexed in the spatial index
 */
export interface SpatialItem {
  id: string;
}

/**
 * Function to get bounds of an item
 */
export type GetBoundsFunc<T extends SpatialItem> = (item: T) => Bounds;

/**
 * Configuration options for spatial indexing
 */
export interface SpatialIndexOptions {
  /** Cell size in pixels (default: 100) */
  cellSize?: number;
  /** Rebuild index after this many incremental updates (default: 50) */
  rebuildThreshold?: number;
}

// =============================================================================
// SPATIAL INDEX
// =============================================================================

/**
 * Grid-based spatial index for efficient geometric queries
 */
export class SpatialIndex<T extends SpatialItem> {
  private _cells = new Map<string, Set<string>>();
  private _items = new Map<string, T>();
  private _itemCells = new Map<string, string[]>();
  private _cellSize: number;
  private _getBounds: GetBoundsFunc<T>;
  private _updateCount = 0;
  private _rebuildThreshold: number;

  constructor(getBounds: GetBoundsFunc<T>, options: SpatialIndexOptions = {}) {
    this._getBounds = getBounds;
    this._cellSize = options.cellSize ?? 100;
    this._rebuildThreshold = options.rebuildThreshold ?? 50;
  }

  // ===========================================================================
  // PUBLIC API - MODIFICATION
  // ===========================================================================

  /**
   * Add or update an item in the index
   */
  upsert(item: T): void {
    // Remove from old cells first
    this.remove(item.id);

    // Get bounds and calculate cells
    const bounds = this._getBounds(item);
    const cellKeys = this._getCellsForBounds(bounds);

    // Store item reference
    this._items.set(item.id, item);
    this._itemCells.set(item.id, cellKeys);

    // Add to cells
    for (const key of cellKeys) {
      let cell = this._cells.get(key);
      if (!cell) {
        cell = new Set();
        this._cells.set(key, cell);
      }
      cell.add(item.id);
    }

    this._updateCount++;
  }

  /**
   * Remove an item from the index
   */
  remove(id: string): void {
    const cellKeys = this._itemCells.get(id);
    if (!cellKeys) return;

    // Remove from all cells
    for (const key of cellKeys) {
      const cell = this._cells.get(key);
      if (cell) {
        cell.delete(id);
        // Clean up empty cells
        if (cell.size === 0) {
          this._cells.delete(key);
        }
      }
    }

    // Remove item references
    this._items.delete(id);
    this._itemCells.delete(id);
  }

  /**
   * Rebuild entire index from items array
   */
  rebuild(items: T[]): void {
    this._cells.clear();
    this._items.clear();
    this._itemCells.clear();
    this._updateCount = 0;

    for (const item of items) {
      this.upsert(item);
    }
    // Reset update count since we just rebuilt
    this._updateCount = 0;
  }

  /**
   * Clear all items from the index
   */
  clear(): void {
    this._cells.clear();
    this._items.clear();
    this._itemCells.clear();
    this._updateCount = 0;
  }

  // ===========================================================================
  // PUBLIC API - QUERYING
  // ===========================================================================

  /**
   * Query items that might contain a point
   * Returns candidate items - caller should do precise hit testing
   */
  queryPoint(point: Point): T[] {
    const cellKey = this._getCellKey(point.x, point.y);
    const cell = this._cells.get(cellKey);
    if (!cell) return [];

    const results: T[] = [];
    for (const id of cell) {
      const item = this._items.get(id);
      if (item) {
        results.push(item);
      }
    }
    return results;
  }

  /**
   * Query items that might intersect a rectangle
   * Returns candidate items - caller should do precise intersection testing
   */
  queryRect(rect: Bounds): T[] {
    const cellKeys = this._getCellsForBounds(rect);
    const seen = new Set<string>();
    const results: T[] = [];

    for (const key of cellKeys) {
      const cell = this._cells.get(key);
      if (!cell) continue;

      for (const id of cell) {
        if (seen.has(id)) continue;
        seen.add(id);

        const item = this._items.get(id);
        if (item) {
          results.push(item);
        }
      }
    }

    return results;
  }

  /**
   * Get an item by ID
   */
  get(id: string): T | undefined {
    return this._items.get(id);
  }

  /**
   * Check if an item exists in the index
   */
  has(id: string): boolean {
    return this._items.has(id);
  }

  /**
   * Get all items in the index
   */
  getAll(): T[] {
    return Array.from(this._items.values());
  }

  /**
   * Get count of items in the index
   */
  get size(): number {
    return this._items.size;
  }

  // ===========================================================================
  // PUBLIC API - MAINTENANCE
  // ===========================================================================

  /**
   * Check if rebuild is recommended based on update count
   */
  shouldRebuild(): boolean {
    return this._updateCount >= this._rebuildThreshold;
  }

  /**
   * Get current update count since last rebuild
   */
  getUpdateCount(): number {
    return this._updateCount;
  }

  /**
   * Get number of cells currently in use
   */
  getCellCount(): number {
    return this._cells.size;
  }

  /**
   * Set cell size (triggers rebuild if items exist)
   */
  setCellSize(size: number): void {
    if (size === this._cellSize) return;
    this._cellSize = size;

    if (this._items.size > 0) {
      const items = this.getAll();
      this.rebuild(items);
    }
  }

  // ===========================================================================
  // PRIVATE - CELL CALCULATIONS
  // ===========================================================================

  private _getCellKey(x: number, y: number): string {
    const cellX = Math.floor(x / this._cellSize);
    const cellY = Math.floor(y / this._cellSize);
    return `${cellX},${cellY}`;
  }

  private _getCellsForBounds(bounds: Bounds): string[] {
    const minCellX = Math.floor(bounds.x / this._cellSize);
    const maxCellX = Math.floor((bounds.x + bounds.width) / this._cellSize);
    const minCellY = Math.floor(bounds.y / this._cellSize);
    const maxCellY = Math.floor((bounds.y + bounds.height) / this._cellSize);

    const keys: string[] = [];
    for (let cx = minCellX; cx <= maxCellX; cx++) {
      for (let cy = minCellY; cy <= maxCellY; cy++) {
        keys.push(`${cx},${cy}`);
      }
    }
    return keys;
  }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

/**
 * Create a new SpatialIndex instance
 */
export function createSpatialIndex<T extends SpatialItem>(
  getBounds: GetBoundsFunc<T>,
  options?: SpatialIndexOptions
): SpatialIndex<T> {
  return new SpatialIndex(getBounds, options);
}

