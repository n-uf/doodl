/**
 * Shape module interface definitions
 */

import type { Bounds, Point } from "../../../types/geometry";
import type { DrawShape } from "./shape";
import type { TextExtractor } from "./text-extract";

// =============================================================================
// CREATION BEHAVIOR
// =============================================================================

/**
 * How the shape is created via user interaction
 */
export type ShapeCreationMode =
  | "canvas-draw" // Draw on canvas (rect, ellipse, freehand)
  | "text-selection" // Select DOM text (text-highlight)
  | "click-place"; // Click to place (text, stamp)

/**
 * Shape creation behavior configuration
 *
 * Defines how the shape is created and what it requires.
 * Used by UI layers to configure interaction mode.
 */
export interface ShapeCreationBehavior {
  /** How the shape is created */
  mode: ShapeCreationMode;
  /** Requires access to DOM text layer */
  requiresTextLayer?: boolean;
  /** Canvas pointer-events during creation ("none" = passthrough to text layer) */
  canvasPointerEvents?: "auto" | "none";
}

/**
 * Default creation behavior (canvas drawing)
 */
export const DEFAULT_CREATION_BEHAVIOR: ShapeCreationBehavior = {
  mode: "canvas-draw",
  canvasPointerEvents: "auto",
};

// =============================================================================
// EDIT STATE (generic, shape-agnostic)
// =============================================================================

/**
 * Edit mode types
 */
export type ShapeEditMode = "vertex" | "text" | "path" | "transform";

/**
 * Generic shape edit state
 *
 * Shape-agnostic structure that each shape module can interpret.
 * The `data` field contains shape-specific edit information.
 */
export interface ShapeEditState {
  /** ID of shape being edited */
  shapeId: string;
  /** Edit mode type */
  mode: ShapeEditMode;
  /** Shape-specific edit data (interpreted by shape module) */
  data: unknown;
}

// =============================================================================
// SHAPE MODULE
// =============================================================================

/**
 * Shape module interface - each shape type implements this
 *
 * Uses method syntax (bivariant) instead of property syntax (contravariant)
 * to allow storing in heterogeneous registry without casts.
 *
 * @typeParam T - Concrete shape type extending DrawShape
 */
export interface ShapeModule<T extends DrawShape> {
  // -------------------------------------------------------------------------
  // Core Rendering
  // -------------------------------------------------------------------------

  /** Render the shape */
  render(ctx: CanvasRenderingContext2D, shape: T): void;

  // -------------------------------------------------------------------------
  // Selection & Edit Mode Rendering (optional - has defaults)
  // -------------------------------------------------------------------------

  /**
   * Render selection UI for this shape (optional)
   * Default: renders bounding box with resize handles
   */
  renderSelection?(ctx: CanvasRenderingContext2D, shape: T): void;

  /**
   * Render edit mode UI for this shape (optional)
   * Called when shape is in edit mode (e.g., vertex editing for polygon)
   */
  renderEditMode?(
    ctx: CanvasRenderingContext2D,
    shape: T,
    editState: ShapeEditState
  ): void;

  /**
   * Whether this shape supports edit mode (e.g., vertex editing)
   * Default: false
   */
  supportsEditMode?: boolean;

  // -------------------------------------------------------------------------
  // Hit Testing
  // -------------------------------------------------------------------------

  hitTestFill?(point: Point, shape: T): boolean;
  hitTestStroke?(point: Point, shape: T, tolerance: number): boolean;

  // -------------------------------------------------------------------------
  // Geometry
  // -------------------------------------------------------------------------

  getBounds(shape: T): Bounds;
  getPosition(shape: T): Point;
  transform(shape: T, delta: Point): T;

  // -------------------------------------------------------------------------
  // Validation
  // -------------------------------------------------------------------------

  isValid(obj: unknown): obj is T;

  // -------------------------------------------------------------------------
  // Creation behavior (optional - defaults to canvas-draw)
  // -------------------------------------------------------------------------

  creation?: ShapeCreationBehavior;

  // -------------------------------------------------------------------------
  // Text extraction (optional)
  // -------------------------------------------------------------------------

  /**
   * Extract text content associated with this shape
   *
   * For property-based shapes (text, text-highlight): returns stored text.
   * For geometric shapes: finds intersecting text from DOM text layer.
   */
  extractText?: TextExtractor<T>;

  /**
   * Whether text should be captured and stored on shape creation/transform
   *
   * When true, Doodl will extract text from the DOM text layer and store
   * it in shape.text when the shape is created or transformed.
   *
   * This provides fallback text when DOM is unavailable (e.g., during zoom).
   *
   * Default: false (text-highlight captures text via selection, not via this)
   */
  capturesTextOnTransform?: boolean;
}

/**
 * Hit test result
 */
export interface HitTestResult {
  hit: boolean;
  onFill: boolean;
  onStroke: boolean;
}
