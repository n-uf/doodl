/**
 * Pure fit-scale math for PDF viewport zoom.
 *
 * All three modes return a **uniform** scale (same factor for x and y).
 * Never mix axes: fitWidth uses widths only; fitHeight uses heights only.
 */

export type FitScaleMode = "width" | "height" | "page";

/**
 * Absolute scale epsilon for “still at this fit” detection.
 * Large enough for float/clamp noise; far smaller than a zoom step (0.25).
 */
export const PDF_FIT_SCALE_EPSILON = 0.001;

export function computeFitWidthScale(
  availableWidth: number,
  pageWidth: number,
): number {
  return availableWidth / pageWidth;
}

export function computeFitHeightScale(
  availableHeight: number,
  pageHeight: number,
): number {
  return availableHeight / pageHeight;
}

export function computeFitPageScale(
  availableWidth: number,
  availableHeight: number,
  pageWidth: number,
  pageHeight: number,
): number {
  const scaleX = computeFitWidthScale(availableWidth, pageWidth);
  const scaleY = computeFitHeightScale(availableHeight, pageHeight);
  return Math.min(scaleX, scaleY);
}

/** Uniform scale for a named fit mode (no clamp). */
export function computeFitModeScale(
  mode: FitScaleMode,
  availableWidth: number,
  availableHeight: number,
  pageWidth: number,
  pageHeight: number,
): number {
  switch (mode) {
    case "width":
      return computeFitWidthScale(availableWidth, pageWidth);
    case "height":
      return computeFitHeightScale(availableHeight, pageHeight);
    case "page":
      return computeFitPageScale(
        availableWidth,
        availableHeight,
        pageWidth,
        pageHeight,
      );
  }
}

/** Inclusive `[min, max]` scale clamp for {@link resolveFitScale}. */
export interface FitScaleClampRange {
  min: number;
  max: number;
}

/** Measured available viewport size, in CSS px. */
export interface FitAvailableSize {
  width: number;
  height: number;
}

/**
 * Which CSS box of the measured container drives the available fit size.
 *
 * - `"content"`: the container's **content box** — `clientWidth`/`clientHeight`
 *   minus its own CSS padding. The default; leaves the container's padding as
 *   visible breathing room around the fitted page.
 * - `"client"`: the full **client box** — `clientWidth`/`clientHeight` with the
 *   container's CSS padding *ignored*. Use for an edge-to-edge fit (e.g. a page
 *   that should fill right up to a surrounding titlebar/pane edge); the host is
 *   then responsible for any inset it still wants via {@link MeasureBoxInsets}.
 *
 * Both boxes exclude the border and any scrollbar, since `clientWidth`/
 * `clientHeight` already do.
 */
export type PdfMeasureBox = "content" | "client";

/**
 * Geometry read from a measured container, in CSS px. `clientWidth`/
 * `clientHeight` are the DOM client-box dimensions (border + scrollbar already
 * excluded); `paddingX`/`paddingY` are the summed left+right / top+bottom CSS
 * padding used to derive the content box.
 */
export interface ContainerBoxMetrics {
  clientWidth: number;
  clientHeight: number;
  paddingX: number;
  paddingY: number;
}

/**
 * Extra chrome (in CSS px) to subtract from the chosen measure box on each
 * axis — e.g. a page-card border the container's own padding does not cover.
 */
export interface MeasureBoxInsets {
  width?: number;
  height?: number;
}

/**
 * Available fit size from a measured container, per {@link PdfMeasureBox}.
 *
 * Pure and side-effect free (takes already-read geometry, touches no DOM) so
 * the measure-box branching can be unit-tested and stays identical between a
 * one-shot fit and resize-tracked recomputes. The caller reads
 * `clientWidth`/`clientHeight` + computed padding once and passes them in.
 */
export function resolveMeasuredAvailableSize(
  metrics: ContainerBoxMetrics,
  measureBox: PdfMeasureBox,
  insets?: MeasureBoxInsets,
): FitAvailableSize {
  const insetWidth = insets?.width ?? 0;
  const insetHeight = insets?.height ?? 0;
  const padX = measureBox === "content" ? metrics.paddingX : 0;
  const padY = measureBox === "content" ? metrics.paddingY : 0;
  return {
    width: metrics.clientWidth - padX - insetWidth,
    height: metrics.clientHeight - padY - insetHeight,
  };
}

/**
 * Clamped viewport scale for a fit policy given a measured container, or
 * `null` when the axis this policy needs is unmeasurable (≤ 0 — e.g. a
 * container that has not laid out yet, or a collapsed pane).
 *
 * Pure and side-effect free: the shared core of both `usePdfViewportScale`'s
 * one-shot fit methods AND its container-resize tracking, so a manual fit
 * click and an automatic recompute on {@link ResizeObserver} always land on
 * the exact same scale.
 */
export function resolveFitScale(
  mode: FitScaleMode,
  available: FitAvailableSize,
  page: FitAvailableSize,
  clampRange: FitScaleClampRange,
): number | null {
  if (mode === "width" && available.width <= 0) return null;
  if (mode === "height" && available.height <= 0) return null;
  if (mode === "page" && (available.width <= 0 || available.height <= 0)) {
    return null;
  }
  const raw = computeFitModeScale(
    mode,
    available.width,
    available.height,
    page.width,
    page.height,
  );
  return Math.max(clampRange.min, Math.min(raw, clampRange.max));
}

/** True when current zoom still matches a fit’s computed (clamped) scale. */
export function isFitScaleActive(
  currentScale: number,
  targetScale: number,
  epsilon: number = PDF_FIT_SCALE_EPSILON,
): boolean {
  return Math.abs(currentScale - targetScale) <= epsilon;
}
