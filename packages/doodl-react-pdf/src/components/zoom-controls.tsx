"use client";

/**
 * ZoomControls - Optional default UI for `usePdfViewportScale`
 *
 * A minimal, unopinionated zoom/fit control strip. Consumers who want fully
 * custom chrome (matching their own design tokens) should use
 * `usePdfViewportScale` / `useCyclingFitMode` directly instead — this
 * component exists so simple integrations don't have to hand-roll buttons.
 *
 * Fit is a single cycling control: width → height → page → width. The label
 * shows the last applied mode (text only); each click applies the next.
 * An LED + `aria-pressed` light when the current scale still matches that
 * fit’s computed scale.
 *
 * Container-resize tracking is configured on the `viewport` hook, not here:
 * pass `fitOnResize` (default `true`) to `usePdfViewportScale` so the applied
 * fit stays correct — and this LED stays lit — as the container resizes.
 */

import type { ReactElement } from "react";
import {
  PDF_FIT_CYCLE_ACTIVE_CLASS,
  PDF_FIT_CYCLE_BUTTON_CLASS,
  PDF_FIT_CYCLE_BUTTON_STYLE,
  PDF_FIT_CYCLE_LABEL_CLASS,
  PDF_FIT_CYCLE_LED_OFF_CLASS,
  PDF_FIT_CYCLE_LED_ON_CLASS,
  PDF_ZOOM_PERCENT_BUTTON_CLASS,
  PDF_ZOOM_PERCENT_BUTTON_STYLE,
  PDF_ZOOM_STEP_BUTTON_CLASS,
  PDF_ZOOM_STEP_BUTTON_STYLE,
  fitCycleTitleFromReturn,
  useCyclingFitMode,
  type PdfFitMode,
} from "../hooks/use-cycling-fit-mode";
import type { UsePdfViewportScaleReturn } from "../hooks/use-pdf-viewport-scale";

export interface ZoomControlsProps {
  /** Return value of `usePdfViewportScale` */
  viewport: UsePdfViewportScaleReturn;
  /** Additional className for the root container */
  className?: string;
  /** Additional className applied to every button */
  buttonClassName?: string;
  /** Additional className for the percentage label */
  labelClassName?: string;
  /** Show the cycling fit control (default: true) */
  showFit?: boolean;
  /**
   * Fit mode shown on the control and used as the first cycle / optional
   * auto-apply target. Default: `"width"`.
   */
  initialFitMode?: PdfFitMode;
  /**
   * When true, apply {@link ZoomControlsProps.initialFitMode} once the
   * viewport can measure a fit (page size + container size). Default: false.
   */
  applyInitialFit?: boolean;
}

const DEFAULT_BUTTON_CLASS =
  "inline-flex h-7 items-center justify-center px-2 text-xs border border-current/20 rounded-md hover:bg-current/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors";

export function ZoomControls({
  viewport,
  className = "",
  buttonClassName = "",
  labelClassName = "",
  showFit = true,
  initialFitMode = "width",
  applyInitialFit = false,
}: ZoomControlsProps): ReactElement {
  const { scale, zoomIn, zoomOut, resetZoom, atMinZoom, atMaxZoom } = viewport;
  const fit = useCyclingFitMode(viewport, {
    initialMode: initialFitMode,
    applyInitialFit,
  });
  const { descriptor, canFit, cycleFit, isActive } = fit;
  const fitTitle = fitCycleTitleFromReturn(fit);

  const buttonClass = `${DEFAULT_BUTTON_CLASS} ${buttonClassName}`;

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <button
        type="button"
        onClick={zoomOut}
        disabled={atMinZoom}
        title="Zoom out"
        style={PDF_ZOOM_STEP_BUTTON_STYLE}
        className={`${PDF_ZOOM_STEP_BUTTON_CLASS} ${buttonClass}`}
      >
        −
      </button>
      <button
        type="button"
        onClick={resetZoom}
        title="Reset zoom to 100%"
        style={PDF_ZOOM_PERCENT_BUTTON_STYLE}
        className={`${PDF_ZOOM_PERCENT_BUTTON_CLASS} ${buttonClass} ${labelClassName}`}
      >
        {Math.round(scale * 100)}%
      </button>
      <button
        type="button"
        onClick={zoomIn}
        disabled={atMaxZoom}
        title="Zoom in"
        style={PDF_ZOOM_STEP_BUTTON_STYLE}
        className={`${PDF_ZOOM_STEP_BUTTON_CLASS} ${buttonClass}`}
      >
        +
      </button>
      {showFit ? (
        <button
          type="button"
          onClick={cycleFit}
          disabled={!canFit}
          title={fitTitle}
          aria-label={fitTitle}
          aria-pressed={isActive}
          style={PDF_FIT_CYCLE_BUTTON_STYLE}
          className={`${buttonClass} ${PDF_FIT_CYCLE_BUTTON_CLASS} ${PDF_FIT_CYCLE_ACTIVE_CLASS}`}
        >
          <span className={PDF_FIT_CYCLE_LABEL_CLASS}>
            <span
              aria-hidden
              className={
                isActive
                  ? PDF_FIT_CYCLE_LED_ON_CLASS
                  : PDF_FIT_CYCLE_LED_OFF_CLASS
              }
            />
            {descriptor.label}
          </span>
        </button>
      ) : null}
    </div>
  );
}

export default ZoomControls;
