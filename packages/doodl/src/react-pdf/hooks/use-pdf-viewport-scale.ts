"use client";

/**
 * usePdfViewportScale - Reusable zoom/fit scale management for PDF viewers
 *
 * Extracted from the go part's DoodleGo composer so any consumer (a themed
 * studio shell, a compact console toolbar, etc.) can drive PDF page `scale`
 * without re-implementing zoom step math or fit-width/fit-height/fit-page
 * viewport measurement.
 *
 * Fit calculations need two things:
 * - `pageSize`: the PDF page's native (scale=1) dimensions, in points.
 * - Available viewport space: either measured from `containerRef` (an
 *   element wrapping the scrollable PDF viewport) or, when no ref is given,
 *   `window.innerWidth` / `window.innerHeight` minus `padding` (matches the
 *   original DoodleGo behavior of approximating chrome around the canvas).
 *
 * ### Fit policy + container-resize tracking
 *
 * Applying a fit (`fitWidth` / `fitHeight` / `fitPage`, or the `fitMode`
 * option) records the **active fit policy** in {@link
 * UsePdfViewportScaleReturn.fitMode}. While a policy is active and
 * `fitOnResize` is on (the default), a {@link ResizeObserver} on
 * `containerRef` — coalesced into a single `requestAnimationFrame` — keeps
 * the viewport scale recomputed against the policy as the container resizes
 * (Hypr/tiling pane drag, window resize, split changes, …). Recomputes are
 * epsilon-guarded so scrollbar-driven width jitter cannot oscillate.
 *
 * Any manual scale change (`setScale` / `zoomIn` / `zoomOut` / `resetZoom`)
 * exits fit tracking (`fitMode` → `null`) — the standard viewer UX where a
 * percentage zoom "sticks" until the user re-selects a fit.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  PDF_FIT_SCALE_EPSILON,
  resolveFitScale,
  resolveMeasuredAvailableSize,
  type FitScaleMode,
  type PdfMeasureBox,
} from "./fit-scale";

// =============================================================================
// TYPES
// =============================================================================

export interface PdfPageSize {
  width: number;
  height: number;
}

export interface UsePdfViewportScaleOptions {
  /** Initial scale (default: 1) */
  initialScale?: number;
  /** Minimum allowed scale (default: 0.5) */
  minScale?: number;
  /** Maximum allowed scale (default: 3) */
  maxScale?: number;
  /** Zoom in/out step (default: 0.25) */
  step?: number;
  /**
   * Native (scale=1) page dimensions, used by `fitWidth` / `fitHeight` /
   * `fitPage`. When null/undefined, fit methods are no-ops.
   */
  pageSize?: PdfPageSize | null;
  /**
   * Ref to the element whose visible size approximates the PDF viewport.
   * When omitted, fit methods fall back to `window.innerWidth`/`innerHeight`.
   */
  containerRef?: React.RefObject<HTMLElement | null>;
  /**
   * Space (in CSS px) to subtract from the measured viewport before fitting,
   * e.g. for surrounding chrome/padding not part of the measured container
   * (a page-card border, a scrollport gutter, …). Applied under either
   * {@link UsePdfViewportScaleOptions.measureBox}.
   */
  padding?: { width?: number; height?: number };
  /**
   * Which CSS box of `containerRef` drives the available fit size:
   *
   * - `"content"` (default): the container's **content box** —
   *   `clientWidth`/`clientHeight` minus its own CSS padding. The container's
   *   padding stays as visible breathing room around the fitted page.
   * - `"client"`: the full **client box** — `clientWidth`/`clientHeight` with
   *   the container's CSS padding *ignored*, for an edge-to-edge fit (e.g. a
   *   page filling right up to a titlebar/pane edge). The host then owns any
   *   remaining inset via {@link UsePdfViewportScaleOptions.padding}.
   *
   * Only affects the `containerRef` path; the `window` fallback has no CSS
   * padding to distinguish, so both boxes measure `innerWidth`/`innerHeight`.
   */
  measureBox?: PdfMeasureBox;
  /**
   * Fit policy to apply and track from the first measurable layout, before
   * any manual zoom or fit click. `null`/omitted starts in manual mode
   * (scale stays at `initialScale` until a fit method is called).
   *
   * Prefer driving the label/LED via `useCyclingFitMode` when you render a
   * cycling fit control; this option is the low-level seed.
   */
  fitMode?: FitScaleMode | null;
  /**
   * Keep the active {@link UsePdfViewportScaleReturn.fitMode} applied as the
   * container resizes, via a `requestAnimationFrame`-coalesced
   * {@link ResizeObserver} on `containerRef` (falling back to `window`
   * `resize` when no ref is given). Default: `true`.
   *
   * Only has an effect while a fit policy is active; manual zoom clears the
   * policy and therefore pauses tracking until the next fit.
   */
  fitOnResize?: boolean;
}

export interface UsePdfViewportScaleReturn {
  /** Current scale factor */
  scale: number;
  /** Set scale directly (clamped to [minScale, maxScale]) */
  setScale: (scale: number) => void;
  /** Increase scale by `step` (clamped) */
  zoomIn: () => void;
  /** Decrease scale by `step` (clamped) */
  zoomOut: () => void;
  /** Reset scale to 1 (clamped) */
  resetZoom: () => void;
  /** Fit page width to the available viewport width */
  fitWidth: () => void;
  /** Fit page height to the available viewport height */
  fitHeight: () => void;
  /** Fit the entire page (width AND height) inside the available viewport */
  fitPage: () => void;
  /**
   * Scale that `fitWidth` / `fitHeight` / `fitPage` would apply right now
   * (clamped), without mutating. `null` when fit cannot be computed.
   */
  getFitScale: (mode: FitScaleMode) => number | null;
  /**
   * The fit policy currently applied and tracked on container resize, or
   * `null` in manual mode. Set by `fitWidth` / `fitHeight` / `fitPage` (and
   * the `fitMode` option); cleared by any manual scale change.
   */
  fitMode: FitScaleMode | null;
  /**
   * Stop tracking the active fit policy on resize WITHOUT changing the
   * current scale (`fitMode` → `null`). Rarely needed directly — manual
   * zoom already does this — but handy for a bespoke "lock scale" control.
   */
  clearFitMode: () => void;
  /** Whether `pageSize` is known (fit methods are no-ops otherwise) */
  canFit: boolean;
  /** `scale >= maxScale` */
  atMaxZoom: boolean;
  /** `scale <= minScale` */
  atMinZoom: boolean;
}

// =============================================================================
// DEFAULTS
// =============================================================================

const DEFAULT_MIN_SCALE = 0.5;
const DEFAULT_MAX_SCALE = 3;
const DEFAULT_STEP = 0.25;

// =============================================================================
// HOOK
// =============================================================================

export function usePdfViewportScale(
  options: UsePdfViewportScaleOptions = {}
): UsePdfViewportScaleReturn {
  const {
    initialScale = 1,
    minScale = DEFAULT_MIN_SCALE,
    maxScale = DEFAULT_MAX_SCALE,
    step = DEFAULT_STEP,
    pageSize = null,
    containerRef,
    padding,
    measureBox = "content",
    fitMode: initialFitMode = null,
    fitOnResize = true,
  } = options;

  const clamp = useCallback(
    (value: number) => Math.max(minScale, Math.min(value, maxScale)),
    [minScale, maxScale]
  );

  const [scale, setScaleState] = useState(() => clamp(initialScale));

  /**
   * The active fit policy. Setting a fit applies it and starts resize
   * tracking; a manual scale change clears it. A ref mirrors the state so the
   * long-lived ResizeObserver callback always reads the latest policy without
   * re-subscribing on every fit/zoom.
   */
  const [fitMode, setFitMode] = useState<FitScaleMode | null>(initialFitMode);
  const fitModeRef = useRef<FitScaleMode | null>(fitMode);
  fitModeRef.current = fitMode;

  const setScale = useCallback(
    (value: number) => {
      setFitMode(null);
      setScaleState(clamp(value));
    },
    [clamp]
  );

  const zoomIn = useCallback(() => {
    setFitMode(null);
    setScaleState((prev) => clamp(prev + step));
  }, [clamp, step]);

  const zoomOut = useCallback(() => {
    setFitMode(null);
    setScaleState((prev) => clamp(prev - step));
  }, [clamp, step]);

  const resetZoom = useCallback(() => {
    setFitMode(null);
    setScaleState(clamp(1));
  }, [clamp]);

  const clearFitMode = useCallback(() => {
    setFitMode(null);
  }, []);

  /**
   * Available viewport size for the active `measureBox`: the content box
   * (`clientWidth`/`clientHeight` minus CSS padding) or the full client box of
   * `containerRef`, else the window, minus the optional extra `padding` inset.
   * DOM geometry is read here; the box math lives in the pure
   * {@link resolveMeasuredAvailableSize}. Width and height are never swapped.
   */
  const measureAvailableSize = useCallback((): PdfPageSize | null => {
    const insets = {
      width: padding?.width ?? 0,
      height: padding?.height ?? 0,
    };

    const container = containerRef?.current;
    if (container) {
      const style = getComputedStyle(container);
      const paddingX =
        (Number.parseFloat(style.paddingLeft) || 0) +
        (Number.parseFloat(style.paddingRight) || 0);
      const paddingY =
        (Number.parseFloat(style.paddingTop) || 0) +
        (Number.parseFloat(style.paddingBottom) || 0);
      return resolveMeasuredAvailableSize(
        {
          clientWidth: container.clientWidth,
          clientHeight: container.clientHeight,
          paddingX,
          paddingY,
        },
        measureBox,
        insets,
      );
    }

    if (typeof window === "undefined") return null;
    return {
      width: window.innerWidth - insets.width,
      height: window.innerHeight - insets.height,
    };
  }, [containerRef, padding?.width, padding?.height, measureBox]);

  /**
   * Read-only clamped scale a fit policy would apply against the current
   * layout. `null` when `pageSize` is unknown or the container cannot yet be
   * measured on the axis the policy needs.
   */
  const getFitScale = useCallback(
    (mode: FitScaleMode): number | null => {
      if (!pageSize) return null;
      const available = measureAvailableSize();
      if (!available) return null;
      return resolveFitScale(mode, available, pageSize, {
        min: minScale,
        max: maxScale,
      });
    },
    [pageSize, measureAvailableSize, minScale, maxScale],
  );

  /**
   * Apply a fit policy: record it as the active `fitMode` (so resize tracking
   * takes over) and set the scale when the container is measurable. The mode
   * is recorded even if the scale can't be computed yet — a still-collapsed
   * container — so the ResizeObserver applies it on the first real layout.
   */
  const applyFit = useCallback(
    (mode: FitScaleMode) => {
      if (!pageSize) return;
      setFitMode(mode);
      const target = getFitScale(mode);
      if (target !== null) setScaleState(target);
    },
    [pageSize, getFitScale],
  );

  const fitWidth = useCallback(() => applyFit("width"), [applyFit]);
  const fitHeight = useCallback(() => applyFit("height"), [applyFit]);
  const fitPage = useCallback(() => applyFit("page"), [applyFit]);

  /**
   * Recompute + apply the active fit policy against the latest layout.
   * Reads the policy from `fitModeRef` so the ResizeObserver callback stays
   * stable, and no-ops unless the scale actually moves (epsilon guard) so a
   * scrollbar appearing/disappearing on re-layout cannot start an oscillation.
   */
  const reapplyActiveFit = useCallback(() => {
    const mode = fitModeRef.current;
    if (mode === null) return;
    const target = getFitScale(mode);
    if (target === null) return;
    setScaleState((prev) =>
      Math.abs(prev - target) <= PDF_FIT_SCALE_EPSILON ? prev : target,
    );
  }, [getFitScale]);

  // Container-resize tracking: keep the active fit policy applied as the
  // container (or window) changes size. rAF-coalesced so a burst of resize
  // callbacks collapses into one recompute per frame.
  useEffect(() => {
    if (!fitOnResize) return;

    let rafId = 0;
    const schedule = (): void => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(reapplyActiveFit);
    };

    const element = containerRef?.current ?? null;
    if (element) {
      const observer = new ResizeObserver(schedule);
      observer.observe(element);
      return () => {
        observer.disconnect();
        cancelAnimationFrame(rafId);
      };
    }

    if (typeof window === "undefined") return;
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("resize", schedule);
      cancelAnimationFrame(rafId);
    };
    // `reapplyActiveFit` identity changes with `pageSize` (via getFitScale),
    // which is when a just-mounted container also becomes measurable — so the
    // observer re-attaches to the real element rather than the window fallback.
  }, [fitOnResize, containerRef, reapplyActiveFit]);

  // Seed the active fit once it first becomes computable — covers the
  // `fitMode` option with the window fallback (no initial `resize` event),
  // and re-fits when `pageSize` first arrives. Idempotent: the epsilon guard
  // in `reapplyActiveFit` makes a no-op when the scale already matches.
  useEffect(() => {
    if (fitMode === null) return;
    reapplyActiveFit();
  }, [fitMode, reapplyActiveFit]);

  return {
    scale,
    setScale,
    zoomIn,
    zoomOut,
    resetZoom,
    fitWidth,
    fitHeight,
    fitPage,
    getFitScale,
    fitMode,
    clearFitMode,
    canFit: pageSize !== null,
    atMaxZoom: scale >= maxScale,
    atMinZoom: scale <= minScale,
  };
}
