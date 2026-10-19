/**
 * Shape Registry - Self-registration pattern with type-safe interfaces
 *
 * Modules register themselves at import time.
 * Type safety enforced by ShapeModule interface.
 */

import {
  DEFAULT_CREATION_BEHAVIOR,
  type ShapeCreationBehavior,
  type ShapeModule,
} from "./types/module";
import type { DrawShape } from "./types/shape";

// Re-export types
export type {
  ShapeCreationBehavior,
  ShapeCreationMode,
  ShapeModule,
} from "./types/module";
export { DEFAULT_CREATION_BEHAVIOR } from "./types/module";
export type { DrawShape } from "./types/shape";

// =============================================================================
// SHAPE ID
// =============================================================================

/**
 * Generate a unique shape ID
 */
export function generateShapeId(): string {
  return `shape-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// =============================================================================
// REGISTRY
// =============================================================================

/**
 * Shape registry - populated via registerShape()
 */
const SHAPE_REGISTRY = new Map<string, ShapeModule<DrawShape>>();

/**
 * Register a shape module
 *
 * Called by each shape module at import time.
 * Type safety enforced by ShapeModule<T> interface.
 *
 * Note: Uses `unknown` cast to handle contravariance of extractText function.
 * The type safety is maintained at call sites via getShapeModule<T>.
 */
export function registerShape<T extends DrawShape>(
  type: T["type"],
  module: ShapeModule<T>
): void {
  if (SHAPE_REGISTRY.has(type)) {
    console.warn(`Shape type "${type}" already registered, overwriting.`);
  }
  // Cast via unknown to handle function parameter contravariance
  SHAPE_REGISTRY.set(type, module as unknown as ShapeModule<DrawShape>);
}

/**
 * Get registered shape types
 */
export function getShapeTypes(): string[] {
  return Array.from(SHAPE_REGISTRY.keys());
}

/**
 * Check if a type string is a registered shape type
 */
export function isShapeType(type: string): boolean {
  return SHAPE_REGISTRY.has(type);
}

/**
 * Get shape module for a shape
 *
 * @throws Error if shape type is not registered
 */
export function getShapeModule<T extends DrawShape>(shape: T): ShapeModule<T> {
  const module = SHAPE_REGISTRY.get(shape.type);
  if (!module) {
    throw new Error(`Shape type "${shape.type}" is not registered`);
  }
  // Cast via unknown to restore specific type from registry
  return module as unknown as ShapeModule<T>;
}

/**
 * Get shape module by type string (for validation use)
 *
 * @returns undefined if not registered
 */
export function getShapeModuleByType(
  type: string
): ShapeModule<DrawShape> | undefined {
  return SHAPE_REGISTRY.get(type);
}

/**
 * Get creation behavior for a shape type
 *
 * Returns the shape's creation configuration (how it's created via user interaction).
 * Falls back to DEFAULT_CREATION_BEHAVIOR if shape not registered or no creation config.
 *
 * @param shapeType - The shape type string (e.g., "text-highlight", "rect")
 * @returns Creation behavior configuration
 */
export function getShapeCreationBehavior(
  shapeType: string
): ShapeCreationBehavior {
  const module = SHAPE_REGISTRY.get(shapeType);
  return module?.creation ?? DEFAULT_CREATION_BEHAVIOR;
}
