"use client";

/**
 * usePageAnnotation - React hook for page annotation
 *
 * Manages PageAnnotationController lifecycle and provides state/actions.
 */

import type { DrawShape, DrawTool, ShapeStyle } from "@n-uf/doodl";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  createPageAnnotationController,
  type PageAnnotationController,
} from "./page-annotation-controller";

export interface UsePageAnnotationOptions {
  /** Page width in native units */
  pageWidth: number;
  /** Page height in native units */
  pageHeight: number;
  /** Initial scale */
  scale?: number;
  /** Initial shapes (in page coordinates) */
  initialShapes?: DrawShape[];
  /** Initial tool */
  initialTool?: DrawTool;
  /** Initial style */
  initialStyle?: ShapeStyle;
  /** Callback when shapes change */
  onShapesChange?: (shapes: DrawShape[]) => void;
}

export interface UsePageAnnotationReturn {
  /** Controller instance */
  controller: PageAnnotationController | null;
  /** Current shapes in page coordinates */
  shapes: DrawShape[];
  /** Current tool */
  tool: DrawTool;
  /** Can undo */
  canUndo: boolean;
  /** Can redo */
  canRedo: boolean;
  /** Attach to canvas */
  attach: (canvas: HTMLCanvasElement, textLayer?: HTMLElement) => void;
  /** Detach from canvas */
  detach: () => void;
  /** Set tool */
  setTool: (tool: DrawTool) => void;
  /** Set style */
  setStyle: (style: Partial<ShapeStyle>) => void;
  /** Set scale */
  setScale: (scale: number) => void;
  /** Set text layer */
  setTextLayer: (textLayer: HTMLElement) => void;
  /** Clear text layer */
  clearTextLayer: () => void;
  /** Undo */
  undo: () => void;
  /** Redo */
  redo: () => void;
  /** Clear shapes */
  clear: () => void;
}

export function usePageAnnotation(
  options: UsePageAnnotationOptions
): UsePageAnnotationReturn {
  const {
    pageWidth,
    pageHeight,
    scale = 1,
    initialShapes,
    initialTool = "select",
    initialStyle,
    onShapesChange,
  } = options;

  const controllerRef = useRef<PageAnnotationController | null>(null);
  const [shapes, setShapes] = useState<DrawShape[]>(initialShapes ?? []);
  const [tool, setToolState] = useState<DrawTool>(initialTool);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Create controller on mount
  useEffect(() => {
    const controller = createPageAnnotationController({
      pageWidth,
      pageHeight,
      scale,
      initialShapes,
      initialTool,
      initialStyle,
    });

    // Event listeners
    controller.on("shapesChange", (newShapes) => {
      setShapes(newShapes);
      onShapesChange?.(newShapes);
    });

    controller.on("toolChange", setToolState);

    controller.on("historyChange", ({ canUndo: u, canRedo: r }) => {
      setCanUndo(u);
      setCanRedo(r);
    });

    controllerRef.current = controller;

    return () => {
      controller.destroy();
      controllerRef.current = null;
    };
    // Only recreate on dimension change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageWidth, pageHeight]);

  // Actions
  const attach = useCallback(
    (canvas: HTMLCanvasElement, textLayer?: HTMLElement) => {
      controllerRef.current?.attach(canvas, textLayer);
    },
    []
  );

  const detach = useCallback(() => {
    controllerRef.current?.detach();
  }, []);

  const setTool = useCallback((t: DrawTool) => {
    controllerRef.current?.setTool(t);
  }, []);

  const setStyle = useCallback((s: Partial<ShapeStyle>) => {
    controllerRef.current?.setStyle(s);
  }, []);

  const setScale = useCallback((s: number) => {
    controllerRef.current?.setScale(s);
  }, []);

  const setTextLayer = useCallback((el: HTMLElement) => {
    controllerRef.current?.setTextLayer(el);
  }, []);

  const clearTextLayer = useCallback(() => {
    controllerRef.current?.clearTextLayer();
  }, []);

  const undo = useCallback(() => {
    controllerRef.current?.undo();
  }, []);

  const redo = useCallback(() => {
    controllerRef.current?.redo();
  }, []);

  const clear = useCallback(() => {
    controllerRef.current?.clearShapes();
  }, []);

  return {
    controller: controllerRef.current,
    shapes,
    tool,
    canUndo,
    canRedo,
    attach,
    detach,
    setTool,
    setStyle,
    setScale,
    setTextLayer,
    clearTextLayer,
    undo,
    redo,
    clear,
  };
}
