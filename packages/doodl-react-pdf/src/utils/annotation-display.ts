/**
 * Annotation Display Utilities
 *
 * Labels, icons, and display helpers for shape/annotation types.
 * Shared between doodl-go and harbuz annotation explorers.
 */

// =============================================================================
// TYPE LABELS
// =============================================================================

/**
 * Human-readable labels for annotation/shape types
 */
export const ANNOTATION_TYPE_LABELS: Record<string, string> = {
  "text-highlight": "Highlight",
  rect: "Rectangle",
  ellipse: "Ellipse",
  polygon: "Polygon",
  freehand: "Freehand",
  text: "Text",
};

// =============================================================================
// TYPE ICONS
// =============================================================================

/**
 * Unicode symbols for annotation/shape types
 */
export const ANNOTATION_TYPE_ICONS: Record<string, string> = {
  rect: "□",
  ellipse: "○",
  polygon: "⬡",
  freehand: "✎",
  text: "A",
  "text-highlight": "▓",
};

// =============================================================================
// DISPLAY HELPERS
// =============================================================================

export interface AnnotationDisplayInfo {
  /** Human-readable label (e.g., "Rectangle") */
  label: string;
  /** Unicode symbol (e.g., "□") */
  icon: string;
}

/**
 * Get display info (label and icon) for an annotation type
 *
 * @param type - Shape/annotation type string
 * @returns Object with label and icon, with sensible defaults for unknown types
 *
 * @example
 * ```ts
 * const { label, icon } = getAnnotationDisplayInfo("text-highlight");
 * // { label: "Highlight", icon: "▓" }
 *
 * const unknown = getAnnotationDisplayInfo("custom-shape");
 * // { label: "CUSTOM-SHAPE", icon: "?" }
 * ```
 */
export function getAnnotationDisplayInfo(type: string): AnnotationDisplayInfo {
  return {
    label: ANNOTATION_TYPE_LABELS[type] ?? type.toUpperCase(),
    icon: ANNOTATION_TYPE_ICONS[type] ?? "?",
  };
}

// =============================================================================
// SORT ORDER
// =============================================================================

/**
 * Preferred display order for annotation types
 * Types not in this list will be sorted alphabetically after these.
 */
export const ANNOTATION_TYPE_ORDER: readonly string[] = [
  "text-highlight",
  "text",
  "rect",
  "ellipse",
  "polygon",
  "freehand",
] as const;

/**
 * Compare function for sorting annotation types by preferred order
 *
 * @example
 * ```ts
 * const types = ["rect", "text-highlight", "freehand"];
 * types.sort(compareAnnotationTypes);
 * // ["text-highlight", "rect", "freehand"]
 * ```
 */
export function compareAnnotationTypes(a: string, b: string): number {
  const aIndex = ANNOTATION_TYPE_ORDER.indexOf(a);
  const bIndex = ANNOTATION_TYPE_ORDER.indexOf(b);

  if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
  if (aIndex === -1) return 1;
  if (bIndex === -1) return -1;
  return aIndex - bIndex;
}













