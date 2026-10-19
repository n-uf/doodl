# Doodl vs Surface: Rendering Crispness Analysis

**Status:** ✅ IMPLEMENTED (2025-12-23)

## Executive Summary

Surface achieves crisp, Figma-quality rendering through five key techniques. **All five have now been implemented in Doodl:**

1. ✅ **Device Pixel Ratio (DPR) canvas sizing** - Physical pixels vs logical pixels
2. ✅ **GPU-optimized context options** - Browser hints for hardware acceleration
3. ✅ **Pixel snapping utilities** - 0.5px offset for crisp 1px lines
4. ✅ **Image smoothing control** - Toggle between crisp/soft rendering
5. ✅ **Transform reset pattern** - `setTransform()` vs accumulating `scale()`

---

## Detailed Comparison

### 1. Device Pixel Ratio (DPR) Handling

**Surface Implementation:**

```typescript
// Canvas setup (InteractionsCanvas, BackgroundCanvas, LayerCanvas)
const dpr = window.devicePixelRatio ?? 1;

// Physical canvas buffer (device pixels)
canvas.width = canvasSize.width * dpr;
canvas.height = canvasSize.height * dpr;

// CSS display size (logical pixels)
canvas.style.width = `${canvasSize.width}px`;
canvas.style.height = `${canvasSize.height}px`;

// Scale context to account for DPI
ctx.scale(dpr, dpr);
```

**Doodl Current Implementation:**

```typescript
// RenderDriver constructor
const ctx = canvas.getContext("2d");
// ... no DPR handling

// _render() method
ctx.scale(this._scale, this._scale); // Only user scale, no DPR
```

**Impact:**
- Surface renders at 2x resolution on Retina displays (4x pixel density)
- Doodl renders at 1x, causing blurry shapes on high-DPI screens

---

### 2. GPU-Optimized Context Options

**Surface Implementation:**

```typescript
// canvas-config.ts
export const SURFACE_CANVAS_OPTIONS: CanvasContextOptions = {
  alpha: true,           // Required for layer stacking
  desynchronized: true,  // Bypass compositor for lower latency
  willReadFrequently: false,  // Hint for GPU path
};

// Usage
const ctx = canvas.getContext("2d", SURFACE_CANVAS_OPTIONS);
```

**Doodl Current Implementation:**

```typescript
// render-driver.ts
const ctx = canvas.getContext("2d");
// No options - browser uses defaults
```

**Impact:**
- `desynchronized: true` reduces input-to-display latency by ~16ms (1 frame)
- `willReadFrequently: false` allows GPU-accelerated rendering path
- `alpha: false` (when applicable) reduces memory by 25%

---

### 3. Sharp Rendering Configuration

**Surface Implementation:**

```typescript
// frame-drawer-utils.ts
export const configureSharpRendering = (
  ctx: CanvasRenderingContext2D
): void => {
  ctx.imageSmoothingEnabled = false;
  ctx.imageSmoothingQuality = "low";
};

// Also has high-quality variant for images
export function configureHighQualityRendering(
  ctx: CanvasRenderingContext2D
): void {
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
}
```

**Doodl Current Implementation:**

```typescript
// No image smoothing configuration
// Browser default: imageSmoothingEnabled = true (causes blur)
```

**Impact:**
- With smoothing disabled, edges are pixel-perfect
- Important for UI elements like selection handles, toolbars

---

### 4. Pixel Snapping Utilities

**Surface Implementation:**

```typescript
// frame-drawer-utils.ts
export const snapToScreenPixel = (value: number): number => {
  return Math.round(value) + 0.5; // 0.5 offset for crisp 1px lines
};
```

**Doodl Current Implementation:**

```typescript
// No pixel snapping utilities
// Shapes drawn at exact coordinates may straddle pixel boundaries
```

**Impact:**
- Without the 0.5px offset, a 1px line at x=100 renders across pixels 99.5-100.5
- This causes antialiasing blur - the line appears 2px wide and translucent

---

### 5. Transform Reset Pattern

**Surface Implementation:**

```typescript
// frame-drawer.ts, swarm-drawer.ts, etc.
ctx.save();
const dpr = window.devicePixelRatio || 1;
ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // Reset to screen space
configureSharpRendering(ctx);
// ... draw in screen coordinates ...
ctx.restore();
```

**Doodl Current Implementation:**

```typescript
// render-driver.ts
ctx.save();
ctx.scale(this._scale, this._scale);
// ... draw in logical coordinates ...
ctx.restore();
```

**Impact:**
- `setTransform()` completely replaces the transformation matrix
- `scale()` accumulates with existing transform (potential for drift)
- `setTransform(dpr, 0, 0, dpr, 0, 0)` ensures exact pixel alignment

---

## Recommended Changes to Doodl

### Change 1: Add DPR-Aware Canvas Sizing

**File:** `packages/doodl/src/drivers/render-driver.ts`

```typescript
export interface RenderDriverOptions {
  backgroundColor?: string;
  scale?: number;
  useDirtyRects?: boolean;
  // NEW: Enable high-DPI rendering (default: true)
  enableHighDPI?: boolean;
}

export class RenderDriver {
  private _enableHighDPI: boolean;
  private _dpr: number;

  constructor(canvas, stateProvider, options = {}) {
    this._enableHighDPI = options.enableHighDPI ?? true;
    this._dpr = this._enableHighDPI ? (window.devicePixelRatio ?? 1) : 1;
    
    // Store logical dimensions
    const logicalWidth = canvas.width;
    const logicalHeight = canvas.height;
    
    // Set physical dimensions
    if (this._enableHighDPI) {
      canvas.width = logicalWidth * this._dpr;
      canvas.height = logicalHeight * this._dpr;
      canvas.style.width = `${logicalWidth}px`;
      canvas.style.height = `${logicalHeight}px`;
    }
    
    // Get optimized context
    this._ctx = canvas.getContext("2d", {
      alpha: true,
      desynchronized: true,
      willReadFrequently: false,
    });
    
    // Apply initial DPR scale
    if (this._enableHighDPI) {
      this._ctx.setTransform(this._dpr, 0, 0, this._dpr, 0, 0);
    }
  }
}
```

### Change 2: Add Canvas Configuration Utilities

**File:** `packages/doodl/src/shapes/common/utils/canvas.ts` (add to existing)

```typescript
// =============================================================================
// CANVAS CONTEXT CONFIGURATION
// =============================================================================

/**
 * GPU-optimized context options for annotation canvases
 */
export const DOODL_CANVAS_OPTIONS = {
  alpha: true,           // Required for transparency
  desynchronized: true,  // Lower latency for RAF rendering
  willReadFrequently: false,  // GPU path hint
} as const;

/**
 * Configure context for sharp, pixel-perfect rendering
 * Use for UI elements (selection, handles, outlines)
 */
export function configureSharpRendering(
  ctx: CanvasRenderingContext2D
): void {
  ctx.imageSmoothingEnabled = false;
}

/**
 * Configure context for smooth rendering
 * Use for shape fills, freehand strokes
 */
export function configureSmoothRendering(
  ctx: CanvasRenderingContext2D
): void {
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
}

/**
 * Snap coordinate to screen pixel for crisp 1px lines
 * 
 * @param value - Coordinate in logical pixels
 * @returns Snapped coordinate
 */
export function snapToPixel(value: number): number {
  return Math.round(value) + 0.5;
}

/**
 * Snap bounds to screen pixels for crisp rendering
 */
export function snapBoundsToPixels(
  bounds: { x: number; y: number; width: number; height: number }
): { x: number; y: number; width: number; height: number } {
  return {
    x: Math.round(bounds.x) + 0.5,
    y: Math.round(bounds.y) + 0.5,
    width: Math.round(bounds.width),
    height: Math.round(bounds.height),
  };
}
```

### Change 3: Update RenderDriver._render() for DPR

**File:** `packages/doodl/src/drivers/render-driver.ts`

```typescript
private _render(): void {
  const ctx = this._ctx;
  const dpr = this._dpr;
  
  // Get logical dimensions
  const logicalWidth = this._canvas.width / dpr;
  const logicalHeight = this._canvas.height / dpr;

  // ... dirty rect handling ...

  if (isFullRedraw) {
    // Reset transform and clear at physical size
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
    
    // Apply DPR + user scale
    ctx.setTransform(
      dpr * this._scale, 0,
      0, dpr * this._scale,
      0, 0
    );
    
    // Background at logical size
    if (this._backgroundColor !== "transparent") {
      ctx.fillStyle = this._backgroundColor;
      ctx.fillRect(0, 0, logicalWidth / this._scale, logicalHeight / this._scale);
    }
  }

  // Render shapes with combined DPR + scale transform
  // ... rest of rendering ...
}
```

### Change 4: Apply Pixel Snapping to Selection UI

**File:** `packages/doodl/src/shapes/common/dispatch.ts`

```typescript
import { snapToPixel } from "./utils/canvas";

function renderDefaultSelection<T extends DrawShape>(
  ctx: CanvasRenderingContext2D,
  shape: T
): void {
  const bounds = getShapeBounds(shape);

  ctx.save();
  
  // Snap bounds for crisp 1px selection outline
  const snappedX = snapToPixel(bounds.x);
  const snappedY = snapToPixel(bounds.y);
  const snappedWidth = Math.round(bounds.width);
  const snappedHeight = Math.round(bounds.height);

  // Selection outline
  ctx.strokeStyle = "#3B82F6";
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.strokeRect(snappedX, snappedY, snappedWidth, snappedHeight);

  // ... rest of handles with pixel snapping ...
  
  ctx.restore();
}
```

### Change 5: Add Render Mode Configuration

**File:** `packages/doodl/src/types/performance.ts` (extend existing)

```typescript
export interface DoodlPerformanceConfig {
  // ... existing fields ...
  
  /**
   * Enable high-DPI (Retina) rendering
   * (default: true)
   */
  enableHighDPI?: boolean;
  
  /**
   * Snap UI elements to pixel boundaries for crispness
   * (default: true)
   */
  snapToPixels?: boolean;
  
  /**
   * Image smoothing mode for shape rendering
   * - "sharp": Disabled (best for UI, selections)
   * - "smooth": Enabled with high quality (best for images, gradients)
   * - "auto": Sharp for strokes, smooth for fills
   * (default: "auto")
   */
  imageSmoothingMode?: "sharp" | "smooth" | "auto";
}
```

---

## Implementation Priority

| Priority | Change | Impact | Effort | Status |
|----------|--------|--------|--------|--------|
| **P0** | DPR-aware canvas sizing | Fixes blur on Retina | Medium | ✅ Done |
| **P0** | GPU context options | Better perf | Low | ✅ Done |
| **P1** | Pixel snapping for selection | Crisp UI | Low | ✅ Done |
| **P1** | `setTransform()` pattern | Precise alignment | Medium | ✅ Done |
| **P2** | Image smoothing control | Flexible quality | Low | ✅ Done |
| **P2** | Configuration API | User control | Low | ✅ Done |

---

## Visual Comparison

```
Surface (Crisp)                    Doodl (Current)
─────────────────                  ─────────────────
┌───────────────┐                  ┌───────────────┐
│  Sharp edges  │                  │  Blurry edges │
│  ▮▮▮▮▮▮▮▮▮▮▮  │                  │  ░░░░░░░░░░░  │
│  Perfect 1px  │                  │  Fuzzy 2px    │
│  lines        │                  │  antialiased  │
└───────────────┘                  └───────────────┘

At 2x DPR:                         At 2x DPR:
- Canvas: 800x600 physical         - Canvas: 400x300 physical
- Display: 400x300 CSS             - Display: 400x300 CSS
- Resolution: 4 device pixels      - Resolution: 1 device pixel
  per logical pixel                  per logical pixel
```

---

## Summary

Doodl needs 5 key enhancements to match Surface's rendering quality:

1. **DPR canvas sizing** - `canvas.width = logical * dpr`
2. **GPU context hints** - `{ desynchronized: true, willReadFrequently: false }`
3. **Pixel snapping** - `Math.round(x) + 0.5` for 1px lines
4. **Image smoothing** - `ctx.imageSmoothingEnabled = false` for UI
5. **Transform reset** - `ctx.setTransform()` instead of accumulating `ctx.scale()`

These changes will make Doodl render with the same crispness as Surface on all displays.

---

## Implementation Notes (2025-12-23)

All proposed enhancements have been implemented:

### Files Modified

| File | Changes |
|------|---------|
| `types/performance.ts` | Added `RenderingQualityConfig` interface with `enableHighDPI`, `imageSmoothingMode`, `enablePixelSnapping`, `useGPUOptimizedContext` |
| `shapes/common/utils/canvas.ts` | Added `getDevicePixelRatio()`, `getOptimizedContext()`, `configureCanvasForHighDPI()`, `configureSharpRendering()`, `snapToPixel()`, `snapToPixelFloor()`, `snapRectToPixel()` |
| `drivers/render-driver.ts` | DPR-aware canvas sizing, GPU context options, `setTransform()` pattern, dimension management |
| `shapes/select/selection-ui.ts` | Pixel snapping for selection bounds and handles |
| `doodl.ts` | Passes rendering config from `DoodlOptions.performanceConfig` to RenderDriver |

### Usage

```typescript
import { Doodl } from "@n-uf/doodl";

const doodl = new Doodl(canvas, {
  // Enable crisp rendering (all enabled by default)
  performanceConfig: {
    rendering: {
      enableHighDPI: true,        // Retina support
      imageSmoothingMode: "disabled", // Sharp UI
      enablePixelSnapping: true,   // Crisp 1px lines
      useGPUOptimizedContext: true // GPU path
    }
  }
});
```

### Defaults

All rendering quality features are **enabled by default**. To disable high-DPI rendering for performance-constrained scenarios:

```typescript
performanceConfig: {
  rendering: {
    enableHighDPI: false
  }
}
```

