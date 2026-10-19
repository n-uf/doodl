"use client";

/**
 * useDoodl - React hook for managing Doodl lifecycle
 *
 * Provides a simple way to integrate Doodl canvas drawing in React components.
 */

import {
  createDoodl,
  DEFAULT_SHAPE_STYLE,
  type Doodl as DoodlInstance,
  type DoodlOptions,
  type DrawShape,
  type DrawTool,
  type ShapeStyle,
} from "../../index";
import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";

export interface UseDoodlOptions
  extends Omit<DoodlOptions, "initialState" | "textLayer"> {
  /** Initial shapes */
  initialShapes?: DrawShape[];
  /** Callback when shapes change */
  onShapesChange?: (shapes: DrawShape[]) => void;
  /** Callback when selection changes */
  onSelectionChange?: (selectedIds: string[]) => void;
  /** Callback when tool changes */
  onToolChange?: (tool: DrawTool) => void;
  /** Callback when style changes */
  onStyleChange?: (style: ShapeStyle) => void;
  /** Callback when history state changes */
  onHistoryChange?: (state: { canUndo: boolean; canRedo: boolean }) => void;
}

export interface UseDoodlReturn {
  /** Doodl instance (null before canvas is attached) */
  doodl: DoodlInstance | null;
  /** Ref to attach to canvas element */
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  /** Ref to attach to text layer element (for text-highlight) */
  textLayerRef: React.RefObject<HTMLElement | null>;
  /** Current shapes */
  shapes: DrawShape[];
  /** Current tool */
  tool: DrawTool;
  /** Current style */
  style: ShapeStyle;
  /** Selected shape IDs */
  selectedIds: string[];
  /** Can undo */
  canUndo: boolean;
  /** Can redo */
  canRedo: boolean;
  /** Set current tool */
  setTool: (tool: DrawTool) => void;
  /** Set current style */
  setStyle: (style: Partial<ShapeStyle>) => void;
  /** Set shapes */
  setShapes: (shapes: DrawShape[]) => void;
  /** Undo last action */
  undo: () => void;
  /** Redo last undone action */
  redo: () => void;
  /** Clear all shapes */
  clear: () => void;
  /** Delete selected shapes */
  deleteSelected: () => void;
  /** Export state as JSON string */
  exportJSON: () => string;
  /** Import state from JSON string */
  importJSON: (json: string) => void;
}

export function useDoodl(options: UseDoodlOptions = {}): UseDoodlReturn {
  const {
    initialShapes,
    initialTool = "select",
    initialStyle = DEFAULT_SHAPE_STYLE,
    backgroundColor,
    scale,
    readOnly,
    enablePing,
    defaultActivationAnimation,
    selectionOptions,
    clampInput,
    boundsPolicy,
    onShapesChange,
    onSelectionChange,
    onToolChange,
    onStyleChange,
    onHistoryChange,
  } = options;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const textLayerRef = useRef<HTMLElement | null>(null);
  const doodlRef = useRef<DoodlInstance | null>(null);
  const initialShapesRef = useRef(initialShapes);

  // Refs to hold latest callbacks (avoids stale closure issues)
  const onShapesChangeRef = useRef(onShapesChange);
  const onSelectionChangeRef = useRef(onSelectionChange);
  const onToolChangeRef = useRef(onToolChange);
  const onStyleChangeRef = useRef(onStyleChange);
  const onHistoryChangeRef = useRef(onHistoryChange);

  // Keep callback refs updated
  useEffect(() => {
    onShapesChangeRef.current = onShapesChange;
  }, [onShapesChange]);

  useEffect(() => {
    onSelectionChangeRef.current = onSelectionChange;
  }, [onSelectionChange]);

  useEffect(() => {
    onToolChangeRef.current = onToolChange;
  }, [onToolChange]);

  useEffect(() => {
    onStyleChangeRef.current = onStyleChange;
  }, [onStyleChange]);

  useEffect(() => {
    onHistoryChangeRef.current = onHistoryChange;
  }, [onHistoryChange]);

  // State
  const [shapes, setShapesState] = useState<DrawShape[]>(initialShapes ?? []);
  const [tool, setToolState] = useState<DrawTool>(initialTool);
  const [style, setStyleState] = useState<ShapeStyle>(initialStyle);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Create Doodl instance when canvas is available
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const doodl = createDoodl(canvas, {
      initialTool,
      initialStyle,
      backgroundColor,
      scale,
      readOnly,
      enablePing,
      defaultActivationAnimation,
      textLayer: textLayerRef.current ?? undefined,
      selectionOptions,
      clampInput,
      boundsPolicy,
    });

    // Load initial shapes
    if (initialShapesRef.current?.length) {
      doodl.setShapes(initialShapesRef.current);
    }

    // Event listeners (use refs to avoid stale closures)
    // Use flushSync for shapesChange to ensure immediate DOM updates
    // This fixes the "ghosting" issue where first shape wasn't visible
    doodl.on("shapesChange", (newShapes) => {
      flushSync(() => {
      setShapesState(newShapes);
      });
      onShapesChangeRef.current?.(newShapes);
    });

    doodl.on("selectionChange", (ids) => {
      setSelectedIds(ids);
      onSelectionChangeRef.current?.(ids);
    });

    doodl.on("toolChange", (newTool) => {
      setToolState(newTool);
      onToolChangeRef.current?.(newTool);
    });

    doodl.on("styleChange", (newStyle) => {
      setStyleState(newStyle);
      onStyleChangeRef.current?.(newStyle);
    });

    doodl.on("historyChange", (state) => {
      setCanUndo(state.canUndo);
      setCanRedo(state.canRedo);
      onHistoryChangeRef.current?.(state);
    });

    doodlRef.current = doodl;

    return () => {
      doodl.destroy();
      doodlRef.current = null;
    };
    // Only recreate on canvas change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync scale
  useEffect(() => {
    if (scale !== undefined) {
      doodlRef.current?.setScale(scale);
    }
  }, [scale]);

  // Sync readOnly
  useEffect(() => {
    if (readOnly !== undefined) {
      doodlRef.current?.setReadOnly(readOnly);
    }
  }, [readOnly]);

  // Sync enablePing
  useEffect(() => {
    if (enablePing !== undefined) {
      doodlRef.current?.setEnablePing(enablePing);
    }
  }, [enablePing]);

  // Sync defaultActivationAnimation
  useEffect(() => {
    if (defaultActivationAnimation !== undefined) {
      doodlRef.current?.setDefaultActivationAnimation(
        defaultActivationAnimation,
      );
    }
  }, [defaultActivationAnimation]);

  // Sync text layer
  useEffect(() => {
    const textLayer = textLayerRef.current;
    if (textLayer) {
      doodlRef.current?.setTextLayer(textLayer);
    }
  }, []);

  // Actions
  const setTool = useCallback((t: DrawTool) => {
    doodlRef.current?.setTool(t);
  }, []);

  const setStyle = useCallback((s: Partial<ShapeStyle>) => {
    doodlRef.current?.setStyle(s);
  }, []);

  const setShapes = useCallback((s: DrawShape[]) => {
    doodlRef.current?.setShapes(s);
  }, []);

  const undo = useCallback(() => {
    doodlRef.current?.undo();
  }, []);

  const redo = useCallback(() => {
    doodlRef.current?.redo();
  }, []);

  const clear = useCallback(() => {
    doodlRef.current?.setShapes([]);
  }, []);

  const deleteSelected = useCallback(() => {
    doodlRef.current?.deleteSelected();
  }, []);

  const exportJSON = useCallback(() => {
    return doodlRef.current?.exportJSON() ?? "{}";
  }, []);

  const importJSON = useCallback((json: string) => {
    doodlRef.current?.importJSON(json);
  }, []);

  return {
    doodl: doodlRef.current,
    canvasRef,
    textLayerRef,
    shapes,
    tool,
    style,
    selectedIds,
    canUndo,
    canRedo,
    setTool,
    setStyle,
    setShapes,
    undo,
    redo,
    clear,
    deleteSelected,
    exportJSON,
    importJSON,
  };
}
