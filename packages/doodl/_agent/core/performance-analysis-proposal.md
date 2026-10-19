# Doodl + PDF Annotation Performance Analysis & Enhancement Proposal

**Date:** December 20, 2025  
**Scope:** `@n-uf/doodl`, `@n-uf/doodl/react`, `@n-uf/doodl/react-pdf`, `@workspace/pdf`  
**Philosophy:** Maintain vanilla-first design, compact architecture, incremental enhancements

---

## Executive Summary

This analysis identifies performance bottlenecks and proposes targeted enhancements across the doodl annotation ecosystem. Unlike the Surface package's WebGPU infrastructure, these proposals preserve doodl's **vanilla Canvas2D simplicity** while achieving significant performance gains through:

1. **Dirty Rectangle Tracking** (P0) - Selective re-rendering
2. **Shape Spatial Index** (P1) - O(log n) hit testing
3. **Render Batching** (P1) - Reduced context switches
4. **Text Highlight Optimization** (P2) - Cached marker paths
5. **PDF Layer Optimization** (P2) - Canvas pooling improvements

**Estimated Impact:** 40-70% rendering reduction for typical interactions

---

## Current Architecture Analysis

### Package Relationships

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Consumer Applications                             │
│  (PDF viewers, document annotators, drawing tools)                  │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
       ┌───────────────────────┼───────────────────────┐
       │                       │                       │
       ▼                       ▼                       ▼
┌──────────────┐      ┌─────────────────┐      ┌──────────────┐
│@workspace/pdf│      │@workspace/      │      │@workspace/   │
│              │◄────▶│doodl-pdf-react  │◄────▶│doodl-react   │
│ PDF Rendering│      │ PDF + Annotation│      │React Bindings│
└──────┬───────┘      └────────┬────────┘      └──────┬───────┘
       │                       │                       │
       │                       └───────────┬───────────┘
       │                                   │
       │                                   ▼
       │                          ┌─────────────────┐
       │                          │ @n-uf/doodl│
       │                          │ (Vanilla Core)  │
       │                          │                 │
       │                          │ ┌─────────────┐ │
       │                          │ │ Drivers     │ │
       │                          │ │ - Render    │ │
       │                          │ │ - Mouse     │ │
       │                          │ │ - Keyboard  │ │
       │                          │ │ - Selection │ │
       │                          │ │ - History   │ │
       │                          │ └─────────────┘ │
       │                          │                 │
       │                          │ ┌─────────────┐ │
       │                          │ │ Shapes      │ │
       │                          │ │ - rect      │ │
       │                          │ │ - ellipse   │ │
       │                          │ │ - polygon   │ │
       │                          │ │ - freehand  │ │
       │                          │ │ - text-hl   │ │
       │                          │ │ - select    │ │
       │                          │ └─────────────┘ │
       │                          └─────────────────┘
       │
       ▼
┌──────────────────┐
│   PDF.js Core    │
│ (Worker-based)   │
└──────────────────┘
```

### Current Render Flow

```
[Event Trigger] → [Doodl._requestRender()] → [RenderDriver.requestRender()]
                                                       │
                                                       ▼
                                              [RAF schedules]
                                                       │
                                                       ▼
                                              [_needsRender = true]
                                                       │
                                                       ▼ (next frame)
                                              [_render()]
                                                       │
        ┌──────────────────────────────────────────────┼──────────────────┐
        │                                              │                   │
        ▼                                              ▼                   ▼
[clearCanvas()]                            [renderShapesWithBehavior()]  [preview]
(FULL clear)                                          │                   │
                                                      ▼                   │
                                              [sortByZOrder()]            │
                                                      │                   │
                                                      ▼                   │
                                              [for each shape]            │
                                                      │                   │
                                                      ▼                   │
                                              [ctx.save()]                │
                                              [applyStyleMode()]          │
                                              [module.render()]           │
                                              [resetStyle()]              │
                                              [ctx.restore()]             │
                                                      │                   │
                                                      ▼                   │
                                              [selection UI]              │
                                                      │                   │
                                                      └──────┬────────────┘
                                                             ▼
                                                    [Frame Complete]
```

### Identified Performance Bottlenecks

#### 1. Full Canvas Clear on Every Frame

```typescript
// render-driver.ts - Line 195
clearCanvas(ctx, width, height);
```

**Problem:** Every `requestRender()` clears the entire canvas, even for:
- Hover state changes (single shape)
- Selection changes (few shapes)
- Preview updates (single shape)

**Impact:** O(width × height) pixel clearing + O(n) shape rendering

#### 2. No Spatial Indexing for Hit Testing

```typescript
// dispatch.ts - Line 322-333
export function findTopmostShapeAtPoint<T extends DrawShape>(
  point: Point,
  shapes: T[],
  tolerance: number = DEFAULT_STROKE_TOLERANCE
): T | null {
  // Linear scan from end to beginning
  for (let i = shapes.length - 1; i >= 0; i--) {
    if (isPointInShape(point, shapes[i], tolerance)) {
      return shapes[i];
    }
  }
  return null;
}
```

**Problem:** Linear O(n) scan on every mouse move during drag/hover
**Impact:** Noticeable lag with 100+ shapes

#### 3. Per-Shape Context State Changes

```typescript
// dispatch.ts - renderShapeWithBehavior()
ctx.save();           // ← context push
applyStyleMode(...);  // ← style changes
module.render(...);
resetStyle(ctx);      // ← style reset
ctx.restore();        // ← context pop
```

**Problem:** Every shape triggers 4+ context operations
**Impact:** Significant overhead with many small shapes

#### 4. Text Highlight Path Regeneration

```typescript
// text-highlight/render.ts - renderMarkerHighlight()
// Path is regenerated for every rect on every frame
drawMarkerPath(ctx, x - expand, y - expand, ...);
drawMarkerPath(ctx, x, y, ...);
drawMarkerPath(ctx, x + inset, y + inset, ...);
```

**Problem:** Complex wavy marker paths recalculated every frame
**Impact:** O(rects × segments × layers) per frame

#### 5. PDF Multi-Page Annotation Overhead

```typescript
// pdf-annotation-viewer.tsx - Scroll mode
{pageNumbers.map((pageNum) => (
  <ScrollModePage
    key={pageNum}
    // Each page has independent Doodl instance
  />
))}
```

**Problem:** Each visible page maintains separate canvas + Doodl instance
**Impact:** Memory overhead, no shared resources

---

## Enhancement Proposals

### Phase 1: Dirty Rectangle System (P0)

**Goal:** Only re-render regions that changed

#### 1.1 DirtyRectManager for Doodl

```typescript
// New file: src/drivers/utils/dirty-rect-manager.ts

export interface DirtyRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DirtyRectManagerOptions {
  /** Merge regions closer than this (pixels) */
  proximityThreshold?: number;
  /** Maximum waste ratio when merging (1.5 = 50% waste allowed) */
  maxWasteRatio?: number;
  /** Force full redraw after this many partial updates */
  fullRedrawInterval?: number;
}

export class DirtyRectManager {
  private _dirtyRegions: DirtyRegion[] = [];
  private _forceFullRedraw = true;
  private _partialUpdateCount = 0;
  private _options: Required<DirtyRectManagerOptions>;

  constructor(options: DirtyRectManagerOptions = {}) {
    this._options = {
      proximityThreshold: options.proximityThreshold ?? 50,
      maxWasteRatio: options.maxWasteRatio ?? 1.5,
      fullRedrawInterval: options.fullRedrawInterval ?? 60, // Every ~1s at 60fps
    };
  }

  /** Mark a shape's bounds as dirty */
  markShapeDirty(bounds: Bounds): void {
    if (this._forceFullRedraw) return;
    
    this._dirtyRegions.push({
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
    });
  }

  /** Mark entire canvas as dirty */
  forceFullRedraw(): void {
    this._forceFullRedraw = true;
    this._dirtyRegions = [];
  }

  /** Get merged dirty regions, reset for next frame */
  getDirtyRegions(): DirtyRegion[] {
    if (this._forceFullRedraw) {
      this._forceFullRedraw = false;
      this._partialUpdateCount = 0;
      return []; // Empty = full redraw
    }

    // Periodic full redraw to prevent accumulating artifacts
    this._partialUpdateCount++;
    if (this._partialUpdateCount >= this._options.fullRedrawInterval) {
      this.forceFullRedraw();
      return [];
    }

    const merged = this._mergeRegions([...this._dirtyRegions]);
    this._dirtyRegions = [];
    return merged;
  }

  /** Check if any dirty regions exist */
  hasDirtyRegions(): boolean {
    return this._forceFullRedraw || this._dirtyRegions.length > 0;
  }

  private _mergeRegions(regions: DirtyRegion[]): DirtyRegion[] {
    if (regions.length <= 1) return regions;

    // Sort by x for sweep-line merge (efficient for many regions)
    if (regions.length > 10) {
      return this._sweepLineMerge(regions);
    }

    // Simple pairwise merge for small counts
    return this._pairwiseMerge(regions);
  }

  private _pairwiseMerge(regions: DirtyRegion[]): DirtyRegion[] {
    let merged = [...regions];
    let changed = true;

    while (changed) {
      changed = false;
      for (let i = 0; i < merged.length; i++) {
        for (let j = i + 1; j < merged.length; j++) {
          if (this._shouldMerge(merged[i]!, merged[j]!)) {
            merged[i] = this._mergeTwo(merged[i]!, merged[j]!);
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

  private _shouldMerge(a: DirtyRegion, b: DirtyRegion): boolean {
    // Check overlap
    if (this._overlaps(a, b)) return true;

    // Check proximity
    const gap = this._gapDistance(a, b);
    if (gap > this._options.proximityThreshold) return false;

    // Check waste ratio
    const merged = this._mergeTwo(a, b);
    const mergedArea = merged.width * merged.height;
    const sumArea = a.width * a.height + b.width * b.height;
    const wasteRatio = mergedArea / sumArea;

    return wasteRatio <= this._options.maxWasteRatio;
  }

  private _overlaps(a: DirtyRegion, b: DirtyRegion): boolean {
    return !(
      a.x + a.width < b.x ||
      b.x + b.width < a.x ||
      a.y + a.height < b.y ||
      b.y + b.height < a.y
    );
  }

  private _gapDistance(a: DirtyRegion, b: DirtyRegion): number {
    const gapX = Math.max(0, Math.max(a.x, b.x) - Math.min(a.x + a.width, b.x + b.width));
    const gapY = Math.max(0, Math.max(a.y, b.y) - Math.min(a.y + a.height, b.y + b.height));
    return Math.sqrt(gapX * gapX + gapY * gapY);
  }

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

  private _sweepLineMerge(regions: DirtyRegion[]): DirtyRegion[] {
    // O(n log n) sweep-line algorithm for many regions
    // Implementation similar to surface package
    // ... (abbreviated for proposal)
    return this._pairwiseMerge(regions);
  }
}
```

#### 1.2 Integrate with RenderDriver

```typescript
// render-driver.ts modifications

export interface RenderDriverOptions {
  backgroundColor?: string;
  scale?: number;
  /** Enable dirty rectangle optimization (default: true) */
  useDirtyRects?: boolean;
}

export class RenderDriver {
  private _dirtyRectManager: DirtyRectManager;
  private _useDirtyRects: boolean;

  constructor(canvas, stateProvider, options) {
    // ...existing code...
    this._useDirtyRects = options.useDirtyRects ?? true;
    this._dirtyRectManager = new DirtyRectManager();
  }

  /** Mark a shape's region as dirty */
  markShapeDirty(shapeId: string): void {
    const shape = this._stateProvider.getShapes().find(s => s.id === shapeId);
    if (shape) {
      const bounds = getShapeBounds(shape);
      // Expand bounds slightly for stroke width
      const padding = (shape.style.strokeWidth ?? 2) + 2;
      this._dirtyRectManager.markShapeDirty({
        x: bounds.x - padding,
        y: bounds.y - padding,
        width: bounds.width + padding * 2,
        height: bounds.height + padding * 2,
      });
    }
    this._needsRender = true;
  }

  /** Force full redraw (e.g., tool change, zoom) */
  forceFullRedraw(): void {
    this._dirtyRectManager.forceFullRedraw();
    this._needsRender = true;
  }

  private _render(): void {
    const { width, height } = this._canvas;
    const ctx = this._ctx;

    // Get dirty regions BEFORE clearing
    const dirtyRegions = this._useDirtyRects
      ? this._dirtyRectManager.getDirtyRegions()
      : [];

    const isFullRedraw = dirtyRegions.length === 0;

    if (isFullRedraw) {
      // Full clear
      clearCanvas(ctx, width, height);
      if (this._backgroundColor !== "transparent") {
        ctx.save();
        ctx.fillStyle = this._backgroundColor;
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
      }
    } else {
      // Partial clear - only dirty regions
      ctx.save();
      ctx.scale(this._scale, this._scale);
      for (const region of dirtyRegions) {
        if (this._backgroundColor !== "transparent") {
          ctx.fillStyle = this._backgroundColor;
          ctx.fillRect(region.x, region.y, region.width, region.height);
        } else {
          ctx.clearRect(region.x, region.y, region.width, region.height);
        }
      }
      ctx.restore();
    }

    ctx.save();
    ctx.scale(this._scale, this._scale);

    // Get current state
    const shapes = this._stateProvider.getShapes();
    const selectedIds = this._stateProvider.getSelectedIds();
    const previewShape = this._stateProvider.getPreviewShape();

    // Filter shapes to only those intersecting dirty regions
    const shapesToRender = isFullRedraw
      ? shapes
      : shapes.filter(shape => this._shapeIntersectsDirty(shape, dirtyRegions));

    // Render with behavior-aware sorting
    renderShapesWithBehavior(ctx, shapesToRender);

    // ... rest of rendering ...

    ctx.restore();
  }

  private _shapeIntersectsDirty(shape: DrawShape, regions: DirtyRegion[]): boolean {
    const bounds = getShapeBounds(shape);
    return regions.some(region => 
      !(bounds.x + bounds.width < region.x ||
        region.x + region.width < bounds.x ||
        bounds.y + bounds.height < region.y ||
        region.y + region.height < bounds.y)
    );
  }
}
```

#### 1.3 Wire Dirty Marking to Events

```typescript
// In Doodl class - key integration points

private _handleMouseHover(point: Point, modifiers: DrawModifiers): void {
  const previousHover = this._hoveredShapeId;
  const controller = this._controllers[this._tool];
  const action = controller.onMove(point, modifiers);
  
  // Mark old and new hover shapes as dirty
  if (previousHover && previousHover !== this._hoveredShapeId) {
    this._renderDriver.markShapeDirty(previousHover);
  }
  if (this._hoveredShapeId) {
    this._renderDriver.markShapeDirty(this._hoveredShapeId);
  }
  
  this._applyAction(action);
  this._requestRender();
}

private _setSelection(ids: string[]): void {
  // Mark old selection as dirty
  for (const id of this._selectedIds) {
    this._renderDriver.markShapeDirty(id);
  }
  // Mark new selection as dirty
  for (const id of ids) {
    this._renderDriver.markShapeDirty(id);
  }
  
  this._selectedIds = new Set(ids);
  this._emit("selectionChange", ids);
  this._requestRender();
}

// Force full redraw on structural changes
setTool(tool: DrawTool): void {
  if (tool === this._tool) return;
  this._cancelCurrentOperation();
  this._tool = tool;
  this._renderDriver.forceFullRedraw();
  // ...
}

setScale(scale: number): void {
  this._scale = scale;
  this._renderDriver.setScale(scale);
  this._renderDriver.forceFullRedraw();
  // ...
}
```

#### 1.4 Expected Impact

| Operation | Before | After | Reduction |
|-----------|--------|-------|-----------|
| Hover (single shape) | 100% canvas | 5-10% | 90-95% |
| Selection change | 100% canvas | 10-20% | 80-90% |
| Preview update | 100% canvas | 5-15% | 85-95% |
| Drag shape | 100% canvas | 15-30% | 70-85% |
| Zoom/pan | 100% canvas | 100% | 0% (forced) |

---

### Phase 2: Spatial Indexing (P1)

**Goal:** O(log n) hit testing instead of O(n)

#### 2.1 Simple Grid-Based Index

```typescript
// New file: src/drivers/utils/spatial-index.ts

export interface SpatialIndexOptions {
  /** Cell size in pixels (default: 100) */
  cellSize?: number;
  /** Rebuild threshold - rebuild index after this many updates */
  rebuildThreshold?: number;
}

export class SpatialIndex<T extends { id: string }> {
  private _cells = new Map<string, Set<string>>();
  private _items = new Map<string, T>();
  private _itemCells = new Map<string, string[]>();
  private _cellSize: number;
  private _getBounds: (item: T) => Bounds;
  private _updateCount = 0;
  private _rebuildThreshold: number;

  constructor(
    getBounds: (item: T) => Bounds,
    options: SpatialIndexOptions = {}
  ) {
    this._getBounds = getBounds;
    this._cellSize = options.cellSize ?? 100;
    this._rebuildThreshold = options.rebuildThreshold ?? 50;
  }

  /** Add or update an item */
  upsert(item: T): void {
    // Remove from old cells
    this.remove(item.id);

    // Add to new cells
    const bounds = this._getBounds(item);
    const cellKeys = this._getCellsForBounds(bounds);

    this._items.set(item.id, item);
    this._itemCells.set(item.id, cellKeys);

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

  /** Remove an item */
  remove(id: string): void {
    const cellKeys = this._itemCells.get(id);
    if (!cellKeys) return;

    for (const key of cellKeys) {
      this._cells.get(key)?.delete(id);
    }

    this._items.delete(id);
    this._itemCells.delete(id);
  }

  /** Query items at a point */
  queryPoint(point: Point): T[] {
    const cellKey = this._getCellKey(point.x, point.y);
    const cell = this._cells.get(cellKey);
    if (!cell) return [];

    const results: T[] = [];
    for (const id of cell) {
      const item = this._items.get(id);
      if (item) results.push(item);
    }
    return results;
  }

  /** Query items intersecting a rectangle */
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
        if (item) results.push(item);
      }
    }

    return results;
  }

  /** Rebuild entire index from items */
  rebuild(items: T[]): void {
    this._cells.clear();
    this._items.clear();
    this._itemCells.clear();
    this._updateCount = 0;

    for (const item of items) {
      this.upsert(item);
    }
  }

  /** Check if rebuild is recommended */
  shouldRebuild(): boolean {
    return this._updateCount >= this._rebuildThreshold;
  }

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
```

#### 2.2 Integration with Doodl

```typescript
// In Doodl class

private _spatialIndex: SpatialIndex<DrawShape>;

constructor(canvas, options) {
  // ...existing code...
  this._spatialIndex = new SpatialIndex(
    (shape) => getShapeBounds(shape),
    { cellSize: 100 }
  );
}

// Update index when shapes change
private _addShape(shape: DrawShape, pushHistory = true): void {
  // ...existing code...
  this._spatialIndex.upsert(shape);
}

private _updateShapes(shapes: DrawShape[]): void {
  // ...existing code...
  for (const shape of shapes) {
    this._spatialIndex.upsert(shape);
  }
}

removeShape(id: string): void {
  // ...existing code...
  this._spatialIndex.remove(id);
}

setShapes(shapes: DrawShape[]): void {
  // ...existing code...
  this._spatialIndex.rebuild(shapes);
}

// Use index for hit testing
private _getControllerContext(): ControllerContext<DrawShape> {
  const selectableShapes = filterSelectableShapes(this._shapes);

  return {
    shapes: this._shapes,
    selectedIds: Array.from(this._selectedIds),
    getShape: (id) => this._shapes.find((s) => s.id === id),
    // Optimized hit testing using spatial index
    findShapeAtPoint: (p) => {
      // Get candidates from spatial index
      const candidates = this._spatialIndex.queryPoint(p);
      // Filter to selectable and do precise hit test
      const selectable = candidates.filter(s => isSelectable(s.behavior));
      return findTopmostShapeAtPoint(p, selectable);
    },
  };
}
```

#### 2.3 Performance Characteristics

| Shapes | Before (O(n)) | After (O(k)) | Speedup |
|--------|---------------|--------------|---------|
| 10 | ~10 checks | ~2-3 checks | 3-5x |
| 100 | ~100 checks | ~2-5 checks | 20-50x |
| 1000 | ~1000 checks | ~3-10 checks | 100-300x |

Where `k` = shapes in queried cell(s), typically 1-10

---

### Phase 3: Render Batching (P1)

**Goal:** Reduce Canvas2D context state changes

#### 3.1 Batch by Style

```typescript
// New file: src/drivers/utils/render-batch.ts

interface RenderBatch {
  fillColor: string | null;
  strokeColor: string | null;
  strokeWidth: number;
  opacity: number;
  blendMode: GlobalCompositeOperation;
  shapes: DrawShape[];
}

export function batchShapesByStyle(shapes: DrawShape[]): RenderBatch[] {
  const batches = new Map<string, RenderBatch>();

  for (const shape of shapes) {
    const key = getBatchKey(shape.style);
    
    let batch = batches.get(key);
    if (!batch) {
      batch = {
        fillColor: shape.style.fill ?? null,
        strokeColor: shape.style.stroke ?? null,
        strokeWidth: shape.style.strokeWidth ?? 2,
        opacity: shape.style.fillOpacity ?? 1,
        blendMode: mapBlendMode(shape.style.blendMode),
        shapes: [],
      };
      batches.set(key, batch);
    }
    batch.shapes.push(shape);
  }

  return Array.from(batches.values());
}

function getBatchKey(style: ShapeStyle): string {
  return [
    style.fill ?? 'none',
    style.stroke ?? 'none',
    style.strokeWidth ?? 2,
    style.fillOpacity ?? 1,
    style.strokeOpacity ?? 1,
    style.blendMode ?? 'normal',
  ].join('|');
}

export function renderBatched(
  ctx: CanvasRenderingContext2D,
  shapes: DrawShape[]
): void {
  const batches = batchShapesByStyle(shapes);

  for (const batch of batches) {
    ctx.save();

    // Apply style once for entire batch
    if (batch.fillColor) {
      ctx.fillStyle = batch.fillColor;
    }
    if (batch.strokeColor) {
      ctx.strokeStyle = batch.strokeColor;
      ctx.lineWidth = batch.strokeWidth;
    }
    ctx.globalAlpha = batch.opacity;
    ctx.globalCompositeOperation = batch.blendMode;

    // Render all shapes in batch
    for (const shape of batch.shapes) {
      const module = getShapeModule(shape);
      module.render(ctx, shape);
    }

    ctx.restore();
  }
}
```

#### 3.2 Estimated Impact

- **Context switches:** Reduced from O(n) to O(unique styles)
- **Typical improvement:** 20-40% for documents with consistent styling
- **Best case:** 50%+ for annotation documents (similar highlight colors)

---

### Phase 4: Text Highlight Optimization (P2)

**Goal:** Cache marker paths instead of regenerating every frame

#### 4.1 Path Caching

```typescript
// text-highlight/render.ts modifications

// Cache key: based on rect dimensions and seed
const pathCache = new Map<string, Path2D>();
const MAX_CACHE_SIZE = 500;

function getCachedPath(
  x: number, y: number, 
  width: number, height: number, 
  seed: number,
  waveIntensity: number
): Path2D {
  // Round to pixel for cache key stability
  const key = `${Math.round(x)},${Math.round(y)},${Math.round(width)},${Math.round(height)},${seed},${waveIntensity}`;
  
  let path = pathCache.get(key);
  if (!path) {
    path = new Path2D();
    buildMarkerPath(path, x, y, width, height, seed, waveIntensity);
    
    // LRU-style eviction
    if (pathCache.size >= MAX_CACHE_SIZE) {
      const firstKey = pathCache.keys().next().value;
      pathCache.delete(firstKey);
    }
    pathCache.set(key, path);
  }
  return path;
}

function buildMarkerPath(
  path: Path2D,
  x: number, y: number,
  width: number, height: number,
  seed: number, waveIntensity: number
): void {
  const s = markerSettings;
  const capsuleRadius = Math.min(height * s.capsuleRatio, width * 0.2, 6);
  const taper = height * s.endTaper * waveIntensity;

  const startX = x + capsuleRadius;
  const startY = y + taper * seededRandom(seed, 0);

  path.moveTo(startX, startY);
  
  // ... rest of path building (same logic as drawMarkerPath)
}

// Updated render function using cache
function renderMarkerHighlight(
  ctx: CanvasRenderingContext2D,
  rect: Bounds,
  color: string,
  opacity: number,
  seed: number
): void {
  const { x, y, width, height } = rect;
  const s = markerSettings;

  if (width < 2 || height < 2) return;

  // Layer 1: Glow (use cached path)
  ctx.globalAlpha = opacity * s.glowOpacity;
  ctx.fillStyle = color;
  const expand = s.glowExpand;
  const glowPath = getCachedPath(x - expand, y - expand, width + expand * 2, height + expand * 2, seed, 0.5);
  ctx.fill(glowPath);

  // Layer 2: Main body
  ctx.globalAlpha = opacity * s.mainOpacity;
  const mainPath = getCachedPath(x, y, width, height, seed, 1.0);
  ctx.fill(mainPath);

  // Layer 3: Center
  const inset = Math.min(2, height * s.centerInset);
  ctx.globalAlpha = opacity * s.centerOpacity;
  const centerPath = getCachedPath(x + inset * 0.5, y + inset, width - inset, height - inset * 2, seed, 0.3);
  ctx.fill(centerPath);
}
```

#### 4.2 Expected Impact

| Highlights | Before | After | Speedup |
|------------|--------|-------|---------|
| 10 rects | ~30 path builds | ~3 (first frame) | 10x |
| 50 rects | ~150 path builds | ~3-50 (cache) | 3-50x |
| 100 rects | ~300 path builds | ~3-100 (cache) | 3-100x |

---

### Phase 5: PDF Layer Optimization (P2)

**Goal:** Improve multi-page annotation performance

#### 5.1 Shared Canvas Pool

```typescript
// New file: packages/doodl/src/react/src/canvas-pool.ts

interface PooledCanvas {
  canvas: HTMLCanvasElement;
  inUse: boolean;
  lastUsed: number;
}

class CanvasPool {
  private _pool: PooledCanvas[] = [];
  private _maxSize = 10;

  acquire(width: number, height: number): HTMLCanvasElement {
    // Find existing canvas with matching dimensions
    for (const pooled of this._pool) {
      if (!pooled.inUse && 
          pooled.canvas.width === width && 
          pooled.canvas.height === height) {
        pooled.inUse = true;
        pooled.lastUsed = Date.now();
        return pooled.canvas;
      }
    }

    // Find any unused canvas and resize
    for (const pooled of this._pool) {
      if (!pooled.inUse) {
        pooled.canvas.width = width;
        pooled.canvas.height = height;
        pooled.inUse = true;
        pooled.lastUsed = Date.now();
        return pooled.canvas;
      }
    }

    // Create new canvas if pool not full
    if (this._pool.length < this._maxSize) {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      this._pool.push({ canvas, inUse: true, lastUsed: Date.now() });
      return canvas;
    }

    // Pool full, create temporary canvas
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }

  release(canvas: HTMLCanvasElement): void {
    const pooled = this._pool.find(p => p.canvas === canvas);
    if (pooled) {
      pooled.inUse = false;
      // Clear canvas for reuse
      const ctx = canvas.getContext('2d');
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  prune(): void {
    const now = Date.now();
    const staleThreshold = 30000; // 30 seconds

    this._pool = this._pool.filter(pooled => {
      if (!pooled.inUse && now - pooled.lastUsed > staleThreshold) {
        return false;
      }
      return true;
    });
  }
}

export const annotationCanvasPool = new CanvasPool();
```

#### 5.2 Lazy Doodl Initialization

```typescript
// page-annotation-layer.tsx modifications

export const PageAnnotationLayer: React.FC<PageAnnotationLayerProps> = (props) => {
  const { shapes, enabled = true } = props;
  
  // Don't create Doodl instance until there are shapes or user interacts
  const [isInitialized, setIsInitialized] = useState(false);
  
  const shouldInitialize = enabled && (
    (shapes && shapes.length > 0) || 
    isInitialized
  );

  const handleInteraction = useCallback(() => {
    if (!isInitialized) {
      setIsInitialized(true);
    }
  }, [isInitialized]);

  if (!shouldInitialize) {
    // Return lightweight placeholder
    return (
      <div 
        className="absolute inset-0"
        onMouseDown={handleInteraction}
        onTouchStart={handleInteraction}
      />
    );
  }

  // Full annotation layer with Doodl instance
  return <FullAnnotationLayer {...props} />;
};
```

---

## Implementation Priority Matrix

| Phase | Priority | Effort | Impact | Dependencies |
|-------|----------|--------|--------|--------------|
| 1. Dirty Rectangles | P0 | Medium | High (40-70%) | None |
| 2. Spatial Index | P1 | Medium | Medium (20-50%) | None |
| 3. Render Batching | P1 | Low | Low-Medium (15-30%) | None |
| 4. Text Highlight Cache | P2 | Low | Medium (20-40%) | None |
| 5. PDF Layer Pool | P2 | Low | Low (10-20%) | doodl-react |

---

## Estimated Performance Gains

### Before Optimization (Baseline)

| Scenario | Shapes | Frame Time | FPS |
|----------|--------|------------|-----|
| Idle | 50 | ~2ms | 60 |
| Hover | 50 | ~3ms | 60 |
| Selection change | 50 | ~3ms | 60 |
| Drag shape | 50 | ~4ms | 60 |
| Many shapes | 500 | ~15ms | ~55 |
| Complex highlights | 100 rects | ~8ms | 60 |

### After Optimization (Projected)

| Scenario | Before | After | Improvement |
|----------|--------|-------|-------------|
| Hover | ~3ms | ~0.8ms | 73% |
| Selection change | ~3ms | ~0.6ms | 80% |
| Drag shape | ~4ms | ~1.2ms | 70% |
| Many shapes hit test | ~15ms | ~2ms | 87% |
| Complex highlights | ~8ms | ~2ms | 75% |

---

## Rollback Strategy

Each enhancement includes a disable flag:

```typescript
// Config-based feature flags
interface DoodlPerformanceConfig {
  useDirtyRects?: boolean;     // Default: true
  useSpatialIndex?: boolean;   // Default: true
  useBatchedRender?: boolean;  // Default: true
  usePathCache?: boolean;      // Default: true
}

const doodl = createDoodl(canvas, {
  performance: {
    useDirtyRects: false,  // Disable if issues
  }
});
```

---

## What We're NOT Doing

To maintain doodl's **vanilla-first, compact architecture**:

1. **No WebGPU** - Complexity not justified for annotation use case
2. **No OffscreenCanvas workers** - Would break vanilla compatibility
3. **No virtual DOM for shapes** - Canvas2D is sufficient
4. **No complex retained mode** - Keep immediate mode simplicity
5. **No shader-based rendering** - Stay with Canvas2D primitives

---

## Testing Plan

### Unit Tests

```typescript
describe('DirtyRectManager', () => {
  it('should merge overlapping regions');
  it('should respect proximity threshold');
  it('should force full redraw periodically');
});

describe('SpatialIndex', () => {
  it('should return shapes at point');
  it('should handle shape updates');
  it('should rebuild efficiently');
});
```

### Performance Benchmarks

```typescript
// benchmark.ts
const scenarios = [
  { name: 'hover-50-shapes', shapes: 50, action: 'hover' },
  { name: 'drag-100-shapes', shapes: 100, action: 'drag' },
  { name: 'highlight-50-rects', highlightRects: 50, action: 'render' },
];

// Measure frame times before/after optimization
```

---

## Next Steps

1. **Immediate:** Implement Phase 1 (Dirty Rectangles) - highest impact
2. **Week 2:** Implement Phase 2 (Spatial Index) for large documents
3. **Week 3:** Implement Phases 3-5 as time permits
4. **Ongoing:** Profile real-world usage, tune thresholds

---

## Document History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-12-20 | Initial analysis and proposal |

---

**Document Version:** 1.0  
**Authors:** Architecture Team  
**Status:** Proposal

