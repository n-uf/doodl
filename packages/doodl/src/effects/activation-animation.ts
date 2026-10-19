/**
 * Activation-frame animations for `Doodl.ping()`.
 *
 * Built-in presets render on the canvas over a shape's bounds.
 * Custom strategies can be registered by name via
 * `registerActivationAnimation()`.
 */

export type BuiltinActivationAnimation = "ping" | "locateFlash" | "pulse";

/** Preset name or a custom registered strategy id. */
export type ActivationAnimationType = BuiltinActivationAnimation | (string & {});

export interface ActivationAnimationFrame {
  /** Progress 0..1 within the effect duration. */
  t: number;
  /** Shape bounds in logical (unscaled) canvas units. */
  x: number;
  y: number;
  width: number;
  height: number;
  color: [number, number, number];
  /** Current render scale (CSS px per logical unit). */
  scale: number;
}

export type ActivationAnimationRenderer = (
  ctx: CanvasRenderingContext2D,
  frame: ActivationAnimationFrame,
) => void;

const DEFAULT_RENDERERS = new Map<string, ActivationAnimationRenderer>();

/** Register or replace an activation animation strategy by name. */
export function registerActivationAnimation(
  type: string,
  renderer: ActivationAnimationRenderer,
): void {
  DEFAULT_RENDERERS.set(type, renderer);
}

/** Resolve a renderer for a type; falls back to `"ping"` when unknown. */
export function getActivationAnimationRenderer(
  type: ActivationAnimationType,
): ActivationAnimationRenderer {
  return DEFAULT_RENDERERS.get(type) ?? DEFAULT_RENDERERS.get("ping")!;
}

/** Default duration (ms) when `PingOptions.duration` is omitted. */
export function defaultDurationForAnimation(
  type: ActivationAnimationType,
): number {
  if (type === "locateFlash") return 1100;
  if (type === "pulse") return 900;
  return 1200;
}

/** Default RGB when `PingOptions.color` is omitted. */
export function defaultColorForAnimation(
  type: ActivationAnimationType,
): [number, number, number] {
  // Pre-doodl console locate flash used rgba(122,165,248,…).
  if (type === "locateFlash") return [122, 165, 248];
  return [59, 130, 246];
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Border-trace comet (historical default `ping()` look).
 * Implemented in RenderDriver for the multi-pass trail; this stub is unused
 * when type === "ping" (driver keeps the specialized path).
 */
const renderPingStub: ActivationAnimationRenderer = () => {
  /* specialized in RenderDriver._renderBorderTrace */
};

/**
 * Pre-doodl console locate flash: CSS `element.animate` boxShadow
 *   0 0 0 7px rgba(122,165,248,0.55) → 0 0 0 2px rgba(122,165,248,0)
 * over 1100ms ease-out. Replicated as an outward stroke that shrinks + fades.
 */
const renderLocateFlash: ActivationAnimationRenderer = (ctx, frame) => {
  const { t, x, y, width, height, color, scale } = frame;
  const eased = easeOutCubic(t);
  const spreadPx = 7 - eased * 5; // 7 → 2
  const alpha = 0.55 * (1 - eased);
  if (alpha < 0.01) return;

  const [r, g, b] = color;
  const spread = spreadPx / scale;
  const half = spread / 2;

  ctx.save();
  ctx.strokeStyle = `rgba(${r},${g},${b},${alpha})`;
  ctx.lineWidth = spread;
  ctx.lineJoin = "round";
  ctx.strokeRect(x - half, y - half, width + spread, height + spread);
  ctx.restore();
};

/**
 * Soft expanding outline pulse — lighter alternative to the border-trace ping.
 */
const renderPulse: ActivationAnimationRenderer = (ctx, frame) => {
  const { t, x, y, width, height, color, scale } = frame;
  const eased = easeOutCubic(t);
  const pad = (3 + eased * 10) / scale;
  const alpha = 0.45 * (1 - eased);
  if (alpha < 0.01) return;

  const [r, g, b] = color;
  ctx.save();
  ctx.strokeStyle = `rgba(${r},${g},${b},${alpha})`;
  ctx.lineWidth = 2 / scale;
  ctx.shadowColor = `rgba(${r},${g},${b},${alpha * 0.5})`;
  ctx.shadowBlur = 8 / scale;
  ctx.strokeRect(x - pad, y - pad, width + pad * 2, height + pad * 2);
  ctx.restore();
};

registerActivationAnimation("ping", renderPingStub);
registerActivationAnimation("locateFlash", renderLocateFlash);
registerActivationAnimation("pulse", renderPulse);
