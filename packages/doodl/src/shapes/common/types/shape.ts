/**
 * Shape data type definitions
 */

import type { ShapeBehaviorValue } from "../../../types/behavior";
import type { ShapeStyle } from "../../../types/style";

/**
 * Base shape interface - all drawable shapes extend this
 *
 * Each shape instance on the canvas implements this interface.
 * Concrete shapes (RectShape, EllipseShape, etc.) extend with geometry.
 */
export interface DrawShape {
  /** Unique shape identifier */
  id: string;
  /** Shape type discriminator (e.g., "rect", "ellipse") */
  type: string;
  /** Shape styling */
  style: ShapeStyle;
  /** Extracted text content (captured at creation, updated on transform) */
  text?: string;
  /**
   * Shape behavior configuration
   *
   * Determines persistence, interactivity, history tracking, and styling.
   * Can be a preset name ("interactive", "backdrop", etc.) or custom object.
   * Defaults to "interactive" (user-created annotation behavior).
   */
  behavior?: ShapeBehaviorValue;
}
