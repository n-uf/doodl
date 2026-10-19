/**
 * Per-frame render context for shape painters.
 *
 * RenderDriver sets this before drawing so shape modules can honor
 * pixel-snapping and screen-space stroke widths without threading options
 * through every render signature.
 */

export interface ShapeRenderContext {
  /** When true, axis-aligned rects snap to device pixels */
  enablePixelSnapping: boolean;
  /** Page → CSS scale factor currently applied via the context transform */
  scale: number;
}

const DEFAULT_SHAPE_RENDER_CONTEXT: ShapeRenderContext = {
  enablePixelSnapping: true,
  scale: 1,
};

let activeContext: ShapeRenderContext = DEFAULT_SHAPE_RENDER_CONTEXT;

/**
 * Read the active shape render context (defaults when unset).
 */
export function getShapeRenderContext(): ShapeRenderContext {
  return activeContext;
}

/**
 * Replace the active shape render context.
 */
export function setShapeRenderContext(context: ShapeRenderContext): void {
  activeContext = context;
}

/**
 * Run `fn` with a temporary shape render context, then restore the previous one.
 */
export function runWithShapeRenderContext<T>(
  context: ShapeRenderContext,
  fn: () => T
): T {
  const previous = activeContext;
  activeContext = context;
  try {
    return fn();
  } finally {
    activeContext = previous;
  }
}
