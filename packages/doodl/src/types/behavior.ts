/**
 * Shape Behavior System
 *
 * Defines behavioral properties that determine how shapes participate
 * in the system: persistence, interactivity, history tracking, and styling.
 *
 * Two-layer design:
 * 1. Primitive layer: ShapeBehavior interface with boolean flags
 * 2. Preset layer: SHAPE_BEHAVIORS with named configurations
 */

// =============================================================================
// PRIMITIVE LAYER
// =============================================================================

/**
 * Style mode for shape rendering
 *
 * Determines visual appearance based on shape's role in the system.
 */
export type ShapeStyleMode = "normal" | "muted" | "ghost" | "glass";

/**
 * Shape behavior properties - primitive layer
 *
 * Determines how the shape participates in the system.
 * Each property is a boolean flag that controls a specific aspect.
 */
export interface ShapeBehavior {
  /** Include in getShapes() / export / save */
  persisted: boolean;

  /** Can be selected via pointer/selection tool */
  selectable: boolean;

  /** Can be modified (resize, move, edit vertices) */
  editable: boolean;

  /** Include in undo/redo history stack */
  tracked: boolean;

  /** Can be deleted by user */
  deletable: boolean;

  /** Render order priority (lower = behind, higher = on top) */
  zOrder: number;

  /** Style mode for rendering */
  styleMode: ShapeStyleMode;
}

// =============================================================================
// PRESET LAYER
// =============================================================================

/**
 * Generic behavior presets
 *
 * Named configurations for common behavioral patterns.
 * Domain-specific presets should be defined in their respective packages.
 */
export const SHAPE_BEHAVIORS = {
  /**
   * interactive - Full engagement, fully committed
   * Use: User-created annotations, imported content
   */
  interactive: {
    persisted: true,
    selectable: true,
    editable: true,
    tracked: true,
    deletable: true,
    zOrder: 100,
    styleMode: "normal",
  },

  /**
   * backdrop - Background layer, ephemeral, no interaction
   * Use: Search highlights, computed overlays, visual guides
   */
  backdrop: {
    persisted: false,
    selectable: false,
    editable: false,
    tracked: false,
    deletable: false,
    zOrder: 10,
    styleMode: "glass",
  },

  /**
   * staged - Pending commitment, limited interaction
   * Use: AI suggestions, pending approvals, drafts
   */
  staged: {
    persisted: false,
    selectable: true,
    editable: false,
    tracked: false,
    deletable: true,
    zOrder: 50,
    styleMode: "ghost",
  },

  /**
   * anchored - Fixed in place, visible but immutable
   * Use: Reference annotations, locked content, external imports
   */
  anchored: {
    persisted: true,
    selectable: true,
    editable: false,
    tracked: false,
    deletable: true,
    zOrder: 80,
    styleMode: "muted",
  },

  /**
   * pinned - Permanently fixed, cannot be removed
   * Use: System annotations, required markers, templates
   */
  pinned: {
    persisted: true,
    selectable: true,
    editable: false,
    tracked: false,
    deletable: false,
    zOrder: 90,
    styleMode: "muted",
  },

  /**
   * transient - Temporary helper, selectable but not saved
   * Use: Selection preview, drag guides, temporary markers
   */
  transient: {
    persisted: false,
    selectable: true,
    editable: true,
    tracked: false,
    deletable: true,
    zOrder: 200,
    styleMode: "normal",
  },
} as const satisfies Record<string, ShapeBehavior>;

/**
 * Available preset names
 */
export type ShapeBehaviorPreset = keyof typeof SHAPE_BEHAVIORS;

/**
 * Shape behavior value - can be preset name or custom object
 */
export type ShapeBehaviorValue = ShapeBehaviorPreset | ShapeBehavior;

// =============================================================================
// DEFAULT
// =============================================================================

/**
 * Default behavior preset (interactive - user-created)
 */
export const DEFAULT_BEHAVIOR_PRESET: ShapeBehaviorPreset = "interactive";

/**
 * Default behavior object
 */
export const DEFAULT_BEHAVIOR: ShapeBehavior = SHAPE_BEHAVIORS.interactive;

// =============================================================================
// UTILITIES
// =============================================================================

/**
 * Check if value is a preset name
 */
export function isBehaviorPreset(
  value: ShapeBehaviorValue | undefined
): value is ShapeBehaviorPreset {
  return typeof value === "string" && value in SHAPE_BEHAVIORS;
}

/**
 * Resolve behavior from preset name or custom object
 *
 * @param behavior - Preset name, custom object, or undefined
 * @returns Resolved ShapeBehavior object
 */
export function resolveBehavior(
  behavior: ShapeBehaviorValue | undefined
): ShapeBehavior {
  if (!behavior) {
    return DEFAULT_BEHAVIOR;
  }

  if (typeof behavior === "string") {
    return SHAPE_BEHAVIORS[behavior] ?? DEFAULT_BEHAVIOR;
  }

  return behavior;
}

/**
 * Create custom behavior by extending a preset
 *
 * @param base - Base preset name to extend
 * @param overrides - Properties to override
 * @returns New ShapeBehavior object
 */
export function extendBehavior(
  base: ShapeBehaviorPreset,
  overrides: Partial<ShapeBehavior>
): ShapeBehavior {
  return {
    ...SHAPE_BEHAVIORS[base],
    ...overrides,
  };
}

// =============================================================================
// BEHAVIOR CHECKS
// =============================================================================

/**
 * Check if shape should be persisted (saved to state)
 */
export function isPersisted(behavior: ShapeBehaviorValue | undefined): boolean {
  return resolveBehavior(behavior).persisted;
}

/**
 * Check if shape should be selectable
 */
export function isSelectable(
  behavior: ShapeBehaviorValue | undefined
): boolean {
  return resolveBehavior(behavior).selectable;
}

/**
 * Check if shape should be editable
 */
export function isEditable(behavior: ShapeBehaviorValue | undefined): boolean {
  return resolveBehavior(behavior).editable;
}

/**
 * Check if shape should be tracked in history
 */
export function isTracked(behavior: ShapeBehaviorValue | undefined): boolean {
  return resolveBehavior(behavior).tracked;
}

/**
 * Check if shape can be deleted
 */
export function isDeletable(behavior: ShapeBehaviorValue | undefined): boolean {
  return resolveBehavior(behavior).deletable;
}

/**
 * Get zOrder for sorting
 */
export function getZOrder(behavior: ShapeBehaviorValue | undefined): number {
  return resolveBehavior(behavior).zOrder;
}

/**
 * Get style mode for rendering
 */
export function getStyleMode(
  behavior: ShapeBehaviorValue | undefined
): ShapeStyleMode {
  return resolveBehavior(behavior).styleMode;
}













