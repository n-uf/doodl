/**
 * Shape Dispatch - Unified operations on any shape via registry
 */

import {
  getStyleMode,
  getZOrder,
  isDeletable,
  isEditable,
  isPersisted,
  isSelectable,
  isTracked,
  type ShapeStyleMode,
} from "../../types/behavior";
import type {
  BoundsEnforcementResult,
  BoundsPolicy,
  CanvasBounds,
} from "../../types/bounds-policy";
import {
  calculateConstrainDelta,
  calculateOverflow,
} from "../../types/bounds-policy";
import type { Bounds, Point } from "../../types/geometry";
import type { ShapeStyle } from "../../types/style";
import { getShapeModule, getShapeModuleByType, isShapeType } from "./registry";
import type { HitTestResult, ShapeEditState } from "./types/module";
import type { DrawShape } from "./types/shape";
import {
  EMPTY_EXTRACTED_TEXT,
  type ExtractedText,
  type TextExtractionContext,
} from "./types/text-extract";
import { applyStyle, resetStyle } from "./utils/canvas";
import { DEFAULT_STROKE_TOLERANCE } from "./utils/geometry";

// Re-export types
export type { HitTestResult, ShapeEditState } from "./types/module";
export type {
  ExtractedText,
  TextExtractionContext,
} from "./types/text-extract";

// =============================================================================
// VALIDATION
// =============================================================================

/**
 * Validate any shape
 */
export function isValidShape(obj: unknown): obj is DrawShape {
  if (typeof obj !== "object" || obj === null) return false;

  const candidate = obj as { type?: unknown };
  if (typeof candidate.type !== "string" || !isShapeType(candidate.type)) {
    return false;
  }

  // Get module by type string and validate
  const module = getShapeModuleByType(candidate.type);
  return module ? module.isValid(obj) : false;
}

// =============================================================================
// RENDERING
// =============================================================================

/**
 * Render a shape
 */
export function renderShape<T extends DrawShape>(
  ctx: CanvasRenderingContext2D,
  shape: T
): void {
  getShapeModule(shape).render(ctx, shape);
}

/**
 * Render multiple shapes
 */
export function renderShapes<T extends DrawShape>(
  ctx: CanvasRenderingContext2D,
  shapes: T[]
): void {
  for (const shape of shapes) {
    renderShape(ctx, shape);
  }
}

// =============================================================================
// BEHAVIOR-AWARE RENDERING
// =============================================================================

/**
 * Style mode overrides for different rendering modes
 */
const STYLE_MODE_CONFIGS: Record<
  ShapeStyleMode,
  {
    fillOpacity?: number;
    strokeOpacity?: number;
    fillOverride?: string;
    strokeOverride?: string;
    lineDash?: number[];
    globalAlpha?: number;
    compositeOperation?: GlobalCompositeOperation;
  }
> = {
  normal: {},

  muted: {
    globalAlpha: 0.5,
  },

  ghost: {
    globalAlpha: 0.3,
    lineDash: [4, 2],
  },

  glass: {
    fillOverride: "rgba(156, 163, 175, 0.12)",
    strokeOverride: "rgba(107, 114, 128, 0.25)",
    compositeOperation: "multiply",
  },
};

/**
 * Sort shapes by behavior zOrder (ascending - lower zOrder renders first)
 */
export function sortShapesByBehavior<T extends DrawShape>(shapes: T[]): T[] {
  return [...shapes].sort(
    (a, b) => getZOrder(a.behavior) - getZOrder(b.behavior)
  );
}

/**
 * Apply style mode to context before rendering
 */
function applyStyleMode(ctx: CanvasRenderingContext2D, shape: DrawShape): void {
  const styleMode = getStyleMode(shape.behavior);
  const config = STYLE_MODE_CONFIGS[styleMode];

  if (!config || styleMode === "normal") {
    // Normal mode - apply shape's style directly
    applyStyle(ctx, shape.style);
    return;
  }

  // Build modified style
  const modifiedStyle: ShapeStyle = { ...shape.style };

  if (config.fillOverride) {
    modifiedStyle.fill = config.fillOverride;
  }
  if (config.strokeOverride) {
    modifiedStyle.stroke = config.strokeOverride;
  }

  // Apply base style
  applyStyle(ctx, modifiedStyle);

  // Apply additional context modifications
  if (config.globalAlpha !== undefined) {
    ctx.globalAlpha = config.globalAlpha;
  }
  if (config.lineDash) {
    ctx.setLineDash(config.lineDash);
  }
  if (config.compositeOperation) {
    ctx.globalCompositeOperation = config.compositeOperation;
  }
}

/**
 * Render a shape with behavior-aware styling
 */
export function renderShapeWithBehavior<T extends DrawShape>(
  ctx: CanvasRenderingContext2D,
  shape: T
): void {
  ctx.save();
  applyStyleMode(ctx, shape);
  getShapeModule(shape).render(ctx, shape);
  resetStyle(ctx);
  ctx.restore();
}

/**
 * Render multiple shapes with behavior-aware sorting and styling
 *
 * Shapes are sorted by zOrder and rendered with their style mode applied.
 * This is the recommended function for behavior-aware rendering.
 */
export function renderShapesWithBehavior<T extends DrawShape>(
  ctx: CanvasRenderingContext2D,
  shapes: T[]
): void {
  // Sort by zOrder (lower renders first, higher renders on top)
  const sorted = sortShapesByBehavior(shapes);

  for (const shape of sorted) {
    renderShapeWithBehavior(ctx, shape);
  }
}

// =============================================================================
// BEHAVIOR FILTERING
// =============================================================================

/**
 * Filter shapes by persisted behavior (for save/export)
 */
export function filterPersistedShapes<T extends DrawShape>(shapes: T[]): T[] {
  return shapes.filter((shape) => isPersisted(shape.behavior));
}

/**
 * Filter shapes by selectable behavior
 */
export function filterSelectableShapes<T extends DrawShape>(shapes: T[]): T[] {
  return shapes.filter((shape) => isSelectable(shape.behavior));
}

/**
 * Filter shapes by editable behavior
 */
export function filterEditableShapes<T extends DrawShape>(shapes: T[]): T[] {
  return shapes.filter((shape) => isEditable(shape.behavior));
}

/**
 * Filter shapes by tracked behavior (for undo/redo)
 */
export function filterTrackedShapes<T extends DrawShape>(shapes: T[]): T[] {
  return shapes.filter((shape) => isTracked(shape.behavior));
}

/**
 * Filter shapes by deletable behavior
 */
export function filterDeletableShapes<T extends DrawShape>(shapes: T[]): T[] {
  return shapes.filter((shape) => isDeletable(shape.behavior));
}

/**
 * Check if a specific shape is selectable based on its behavior
 */
export function isShapeSelectable<T extends DrawShape>(shape: T): boolean {
  return isSelectable(shape.behavior);
}

/**
 * Check if a specific shape is editable based on its behavior
 */
export function isShapeEditable<T extends DrawShape>(shape: T): boolean {
  return isEditable(shape.behavior);
}

/**
 * Check if a specific shape is deletable based on its behavior
 */
export function isShapeDeletable<T extends DrawShape>(shape: T): boolean {
  return isDeletable(shape.behavior);
}

// =============================================================================
// HIT TESTING
// =============================================================================

/**
 * Hit test a shape
 */
export function hitTestShape<T extends DrawShape>(
  point: Point,
  shape: T,
  tolerance: number = DEFAULT_STROKE_TOLERANCE
): HitTestResult {
  const module = getShapeModule(shape);
  const hasFill = shape.style.fill !== "none" && shape.style.fill !== undefined;
  const hasStroke =
    shape.style.stroke !== "none" && shape.style.stroke !== undefined;

  let onFill = false;
  let onStroke = false;

  if (hasFill && module.hitTestFill) {
    onFill = module.hitTestFill(point, shape);
  }

  if (hasStroke && !onFill && module.hitTestStroke) {
    onStroke = module.hitTestStroke(point, shape, tolerance);
  }

  return { hit: onFill || onStroke, onFill, onStroke };
}

/**
 * Test if point is in shape (simple boolean)
 */
export function isPointInShape<T extends DrawShape>(
  point: Point,
  shape: T,
  tolerance: number = DEFAULT_STROKE_TOLERANCE
): boolean {
  return hitTestShape(point, shape, tolerance).hit;
}

/**
 * Find all shapes at a point
 */
export function findShapesAtPoint<T extends DrawShape>(
  point: Point,
  shapes: T[],
  tolerance: number = DEFAULT_STROKE_TOLERANCE
): T[] {
  return shapes.filter((shape) => isPointInShape(point, shape, tolerance));
}

/**
 * Find topmost shape at a point
 */
export function findTopmostShapeAtPoint<T extends DrawShape>(
  point: Point,
  shapes: T[],
  tolerance: number = DEFAULT_STROKE_TOLERANCE
): T | null {
  for (let i = shapes.length - 1; i >= 0; i--) {
    const shape = shapes[i]!;
    if (isPointInShape(point, shape, tolerance)) {
      return shape;
    }
  }
  return null;
}

// =============================================================================
// GEOMETRY
// =============================================================================

/**
 * Get bounding box for shape
 */
export function getShapeBounds<T extends DrawShape>(shape: T): Bounds {
  return getShapeModule(shape).getBounds(shape);
}

/**
 * Get position for shape
 */
export function getShapePosition<T extends DrawShape>(shape: T): Point {
  return getShapeModule(shape).getPosition(shape);
}

/**
 * Transform shape by delta
 */
export function transformShape<T extends DrawShape>(shape: T, delta: Point): T {
  return getShapeModule(shape).transform(shape, delta);
}

// =============================================================================
// BOUNDS ENFORCEMENT
// =============================================================================

/**
 * Enforce shape bounds according to policy
 *
 * @param shape - Shape to enforce bounds on
 * @param canvasBounds - Canvas dimensions
 * @param policy - How to handle out-of-bounds shapes
 * @returns Enforcement result with status and potentially modified shape
 */
export function enforceShapeBounds<T extends DrawShape>(
  shape: T,
  canvasBounds: CanvasBounds,
  policy: BoundsPolicy = "constrain"
): BoundsEnforcementResult<T> {
  // Policy: allow - no enforcement
  if (policy === "allow") {
    return { status: "allowed", shape };
  }

  const shapeBounds = getShapeBounds(shape);
  const overflow = calculateOverflow(shapeBounds, canvasBounds);

  // Shape fits within canvas
  if (!overflow.exceeds) {
    return { status: "unchanged", shape };
  }

  // Policy: reject - don't allow out-of-bounds shapes
  if (policy === "reject") {
    return {
      status: "rejected",
      reason: `Shape exceeds canvas bounds (left: ${overflow.left}, top: ${overflow.top}, right: ${overflow.right}, bottom: ${overflow.bottom})`,
    };
  }

  // Policy: constrain - translate shape to fit
  const delta = calculateConstrainDelta(shapeBounds, canvasBounds);

  // Apply translation if needed
  if (delta.x !== 0 || delta.y !== 0) {
    const constrained = transformShape(shape, delta);
    return { status: "constrained", shape: constrained as T, delta };
  }

  // Shape is too large to fit even after translation
  // Return as-is (future: could implement cropping)
  return { status: "unchanged", shape };
}

// =============================================================================
// SELECTION & EDIT MODE RENDERING
// =============================================================================

/**
 * Check if a shape supports edit mode
 */
export function shapeSupportsEditMode<T extends DrawShape>(shape: T): boolean {
  const module = getShapeModule(shape);
  return module.supportsEditMode ?? false;
}

/**
 * Render selection UI for a shape
 *
 * Delegates to shape module's renderSelection if available,
 * otherwise falls back to default selection rendering.
 */
export function renderShapeSelection<T extends DrawShape>(
  ctx: CanvasRenderingContext2D,
  shape: T
): void {
  const module = getShapeModule(shape);
  if (module.renderSelection) {
    module.renderSelection(ctx, shape);
  } else {
    // Default: render bounding box selection (imported lazily to avoid cycles)
    renderDefaultSelection(ctx, shape);
  }
}

/**
 * Render edit mode UI for a shape
 *
 * Delegates to shape module's renderEditMode if available.
 * Does nothing if shape doesn't support edit mode.
 */
export function renderShapeEditMode<T extends DrawShape>(
  ctx: CanvasRenderingContext2D,
  shape: T,
  editState: ShapeEditState
): void {
  const module = getShapeModule(shape);
  if (module.renderEditMode) {
    module.renderEditMode(ctx, shape, editState);
  }
}

/**
 * Default selection rendering (bounding box + handles)
 * Used when shape module doesn't provide custom renderSelection
 */
function renderDefaultSelection<T extends DrawShape>(
  ctx: CanvasRenderingContext2D,
  shape: T
): void {
  // Import lazily to avoid circular dependencies
  // These are from select/selection-ui.ts
  const bounds = getShapeBounds(shape);

  ctx.save();

  // Selection outline
  ctx.strokeStyle = "#3B82F6";
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);

  // Resize handles only when editable
  if (!isEditable(shape.behavior)) {
    ctx.restore();
    return;
  }

  ctx.setLineDash([]);
  const handleSize = 8;
  const halfHandle = handleSize / 2;

  const handlePositions = [
    { x: bounds.x - halfHandle, y: bounds.y - halfHandle },
    { x: bounds.x + bounds.width / 2 - halfHandle, y: bounds.y - halfHandle },
    { x: bounds.x + bounds.width - halfHandle, y: bounds.y - halfHandle },
    {
      x: bounds.x + bounds.width - halfHandle,
      y: bounds.y + bounds.height / 2 - halfHandle,
    },
    {
      x: bounds.x + bounds.width - halfHandle,
      y: bounds.y + bounds.height - halfHandle,
    },
    {
      x: bounds.x + bounds.width / 2 - halfHandle,
      y: bounds.y + bounds.height - halfHandle,
    },
    { x: bounds.x - halfHandle, y: bounds.y + bounds.height - halfHandle },
    { x: bounds.x - halfHandle, y: bounds.y + bounds.height / 2 - halfHandle },
  ];

  for (const pos of handlePositions) {
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(pos.x, pos.y, handleSize, handleSize);
    ctx.strokeStyle = "#3B82F6";
    ctx.lineWidth = 1;
    ctx.strokeRect(pos.x, pos.y, handleSize, handleSize);
  }

  ctx.restore();
}

// =============================================================================
// TEXT EXTRACTION
// =============================================================================

/**
 * Extract text content associated with a shape
 *
 * Delegates to the shape module's extractText implementation.
 * Returns empty result if shape doesn't support text extraction.
 *
 * @param shape - Shape to extract text from
 * @param context - Text extraction context (text layer, scale, etc.)
 * @returns Extracted text result
 */
export function extractShapeText<T extends DrawShape>(
  shape: T,
  context: TextExtractionContext
): ExtractedText {
  const module = getShapeModule(shape);

  if (!module.extractText) {
    return EMPTY_EXTRACTED_TEXT;
  }

  return module.extractText(shape, context);
}

/**
 * Check if a shape captures text on creation/transform
 *
 * When true, the shape module wants text extracted from DOM and stored
 * in shape.text on creation and transform operations.
 *
 * @param shape - Shape to check
 * @returns true if shape captures text on transform
 */
export function shapeWantsCapturedText<T extends DrawShape>(shape: T): boolean {
  const module = getShapeModule(shape);
  return module.capturesTextOnTransform === true;
}
