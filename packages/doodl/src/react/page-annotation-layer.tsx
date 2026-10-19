"use client";

/**
 * PageAnnotationLayer - React component for multi-page document annotation overlay
 *
 * Renders a canvas overlay for drawing annotations on a document page.
 * Manages Doodl instance lifecycle and coordinate transformation.
 *
 * Uses CanvasPool for efficient canvas reuse during scroll/virtualization.
 * Canvases are DPR-aware for crisp Retina rendering.
 */

// Import text layer CSS fixes for pdfjs-dist 5.x compatibility
import "./styles/text-layer.css";

import {
  getShapeCreationBehavior,
  getToolTargetShape,
  registerBuiltinShapes,
  type ActivationAnimationType,
  type DrawShape,
  type DrawTool,
  type ShapeStyle,
} from "../../index";

// Annotation viewers always need first-party shape modules (rect, etc.).
registerBuiltinShapes();
import React, { useCallback, useEffect, useRef, useState } from "react";
import { annotationCanvasPool } from "./canvas-pool";
import {
  createPageAnnotationController,
  type PageAnnotationController,
} from "./page-annotation-controller";

/**
 * Compare two shape arrays for equality (id + geometry/style payload).
 * ID-only compare would skip style/behavior updates from controlled props.
 */
function areShapeArraysEqual(a: DrawShape[], b: DrawShape[]): boolean {
  if (a.length !== b.length) return false;
  if (a.length === 0) return true;

  for (let i = 0; i < a.length; i++) {
    const left = a[i];
    const right = b[i];
    if (left === right) continue;
    if (left?.id !== right?.id) return false;
    if (JSON.stringify(left) !== JSON.stringify(right)) return false;
  }
  return true;
}

export interface PageAnnotationLayerProps {
  /** Page width in native units (e.g., PDF points at 72 DPI) */
  pageWidth: number;
  /** Page height in native units */
  pageHeight: number;
  /** Current scale factor */
  scale: number;
  /** Ref to text layer element (for text-highlight tool) */
  textLayerRef?: React.RefObject<HTMLElement | null>;
  /** Direct text layer element (alternative to textLayerRef) */
  textLayerElement?: HTMLElement | null;
  /** Shapes in page coordinates */
  shapes?: DrawShape[];
  /** Current tool */
  tool?: DrawTool;
  /** Current style */
  style?: ShapeStyle;
  /** Whether the layer is enabled (mounts canvas; default: true) */
  enabled?: boolean;
  /**
   * Selection-only mode (default: false).
   * Disables draw/edit/drag/resize; pointer selection still works.
   */
  readOnly?: boolean;
  /**
   * Allow activation-frame `ping()` animation (default: true).
   * When false, `ping()` is a no-op.
   */
  enablePing?: boolean;
  /**
   * Default `ping()` animation when `type` is omitted (default: `"ping"`).
   */
  defaultActivationAnimation?: ActivationAnimationType;
  /** Merge overlapping text highlight rects (default: true) */
  mergeHighlights?: boolean;
  /** Use canvas pool for reuse (default: true) */
  usePool?: boolean;
  /** Callback when shapes change (receives page coordinates) */
  onShapesChange?: (shapes: DrawShape[]) => void;
  /** Callback when history state changes */
  onHistoryChange?: (state: { canUndo: boolean; canRedo: boolean }) => void;
  /** Expose controller ref */
  controllerRef?: React.MutableRefObject<PageAnnotationController | null>;
  /** Additional className */
  className?: string;
  /** Additional styles */
  style_?: React.CSSProperties;
}

export const PageAnnotationLayer: React.FC<PageAnnotationLayerProps> = ({
  pageWidth,
  pageHeight,
  scale,
  textLayerRef,
  textLayerElement,
  shapes,
  tool = "select",
  style,
  enabled = true,
  readOnly = false,
  enablePing = true,
  defaultActivationAnimation = "ping",
  mergeHighlights = true,
  usePool = true,
  onShapesChange,
  onHistoryChange,
  controllerRef: externalControllerRef,
  className = "",
  style_,
}) => {
  // Resolve text layer: prefer direct element, fallback to ref
  const resolvedTextLayer = textLayerElement ?? textLayerRef?.current ?? null;
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const controllerRef = useRef<PageAnnotationController | null>(null);
  const initialShapesRef = useRef(shapes);

  // Refs to store latest callbacks (avoids stale closure issues)
  const onShapesChangeRef = useRef(onShapesChange);
  const onHistoryChangeRef = useRef(onHistoryChange);

  // Flag to prevent feedback loop when syncing shapes from props
  const isSyncingFromPropsRef = useRef(false);

  // Keep refs updated
  useEffect(() => {
    onShapesChangeRef.current = onShapesChange;
  }, [onShapesChange]);

  useEffect(() => {
    onHistoryChangeRef.current = onHistoryChange;
  }, [onHistoryChange]);

  // Track text layer offset for canvas positioning
  const [textLayerOffset, setTextLayerOffset] = useState<{
    left: number;
    top: number;
  }>({ left: 0, top: 0 });

  // Computed dimensions (logical CSS pixels)
  const canvasWidth = Math.round(pageWidth * scale);
  const canvasHeight = Math.round(pageHeight * scale);

  // Stable callback wrappers that always call latest version
  const handleShapesChange = useCallback((newShapes: DrawShape[]) => {
    // Don't forward events caused by syncing from props
    if (isSyncingFromPropsRef.current) return;
    onShapesChangeRef.current?.(newShapes);
  }, []);

  const handleHistoryChange = useCallback(
    (state: { canUndo: boolean; canRedo: boolean }) => {
      onHistoryChangeRef.current?.(state);
    },
    []
  );

  // Compute text layer offset when it changes or when scale changes
  useEffect(() => {
    if (!resolvedTextLayer) {
      setTextLayerOffset({ left: 0, top: 0 });
      return;
    }

    // Get the text layer's offset from its positioned ancestor
    // This ensures our canvas aligns with where the text actually is
    const updateOffset = (): void => {
      const textLayerRect = resolvedTextLayer.getBoundingClientRect();
      const parentRect =
        resolvedTextLayer.offsetParent?.getBoundingClientRect();

      if (parentRect) {
        setTextLayerOffset({
          left: textLayerRect.left - parentRect.left,
          top: textLayerRect.top - parentRect.top,
        });
      }
    };

    // Update initially and on resize
    updateOffset();
    const observer = new ResizeObserver(updateOffset);
    observer.observe(resolvedTextLayer);

    return () => observer.disconnect();
  }, [resolvedTextLayer, scale]);

  // Create controller
  useEffect(() => {
    if (!enabled) return;

    const controller = createPageAnnotationController({
      pageWidth,
      pageHeight,
      scale,
      initialShapes: initialShapesRef.current,
      initialTool: tool,
      initialStyle: style,
      mergeHighlights,
      readOnly,
      enablePing,
      defaultActivationAnimation,
    });

    // Event listeners - use stable wrappers that call through refs
    controller.on("shapesChange", handleShapesChange);
    controller.on("historyChange", handleHistoryChange);

    controllerRef.current = controller;
    if (externalControllerRef) {
      externalControllerRef.current = controller;
    }

    return () => {
      controller.destroy();
      controllerRef.current = null;
      if (externalControllerRef) {
        externalControllerRef.current = null;
      }
    };
    // Only recreate on dimension or enabled change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageWidth, pageHeight, enabled, handleShapesChange, handleHistoryChange]);

  // Acquire canvas from pool and attach to container
  useEffect(() => {
    const container = containerRef.current;
    const controller = controllerRef.current;
    if (!container || !controller || !enabled) return;

    // Acquire canvas from pool (DPR-aware, GPU-optimized)
    const canvas = usePool
      ? annotationCanvasPool.acquire(canvasWidth, canvasHeight)
      : document.createElement("canvas");

    // Configure non-pooled canvas for DPR
    if (!usePool) {
      const dpr = window.devicePixelRatio ?? 1;
      canvas.width = Math.round(canvasWidth * dpr);
      canvas.height = Math.round(canvasHeight * dpr);
      canvas.style.width = `${canvasWidth}px`;
      canvas.style.height = `${canvasHeight}px`;
    }

    // Add canvas to DOM
    container.appendChild(canvas);
    canvasRef.current = canvas;

    // Attach controller to canvas
    controller.attach(canvas, resolvedTextLayer ?? undefined);

    return () => {
      // Detach controller
      controller.detach();

      // Remove canvas from DOM
      if (container.contains(canvas)) {
        container.removeChild(canvas);
      }

      // Release canvas back to pool
      if (usePool) {
        annotationCanvasPool.release(canvas);
      }

      canvasRef.current = null;
    };
  }, [canvasWidth, canvasHeight, enabled, resolvedTextLayer, usePool]);

  // Sync scale
  useEffect(() => {
    controllerRef.current?.setScale(scale);
  }, [scale]);

  // Sync tool
  useEffect(() => {
    controllerRef.current?.setTool(tool);
  }, [tool]);

  // Sync readOnly (selection-only)
  useEffect(() => {
    controllerRef.current?.setReadOnly(readOnly);
  }, [readOnly]);

  // Sync enablePing (activation-frame animation)
  useEffect(() => {
    controllerRef.current?.setEnablePing(enablePing);
  }, [enablePing]);

  // Sync default activation animation preset
  useEffect(() => {
    controllerRef.current?.setDefaultActivationAnimation(
      defaultActivationAnimation,
    );
  }, [defaultActivationAnimation]);

  // Sync style
  useEffect(() => {
    if (style) {
      controllerRef.current?.setStyle(style);
    }
  }, [style]);

  // Sync text layer
  useEffect(() => {
    const controller = controllerRef.current;
    if (!controller) return;

    if (resolvedTextLayer) {
      controller.setTextLayer(resolvedTextLayer);
    } else {
      controller.clearTextLayer();
    }
  }, [resolvedTextLayer]);

  // Sync shapes prop to controller when it changes
  // This is critical for multi-page support where shapes array changes per page
  useEffect(() => {
    const controller = controllerRef.current;
    if (!controller) return;

    // Compare with current controller shapes to avoid unnecessary updates
    const currentShapes = controller.getShapes();
    const newShapes = shapes ?? [];

    // Only sync if shapes actually differ (by IDs)
    if (!areShapeArraysEqual(currentShapes, newShapes)) {
      // Set flag to prevent feedback loop - setShapes emits shapesChange
      isSyncingFromPropsRef.current = true;
      controller.setShapes(newShapes);
      isSyncingFromPropsRef.current = false;
    }
  }, [shapes]);

  // Update canvas pointer events when tool changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const targetShape = getToolTargetShape(tool);
    const creationBehavior = targetShape
      ? getShapeCreationBehavior(targetShape)
      : null;
    const pointerEvents = creationBehavior?.canvasPointerEvents ?? "auto";

    canvas.style.pointerEvents = pointerEvents;
  }, [tool]);

  if (!enabled) return null;

  return (
    <div
      ref={containerRef}
      className={`absolute ${className}`}
      style={{
        // Position container to align with text layer
        top: textLayerOffset.top,
        left: textLayerOffset.left,
        // Container dimensions match canvas
        width: canvasWidth,
        height: canvasHeight,
        zIndex: 20,
        // Container itself doesn't intercept events
        pointerEvents: "none",
        ...style_,
      }}
    />
  );
};

export default PageAnnotationLayer;
