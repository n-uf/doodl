/**
 * useDocumentAnnotations Hook
 *
 * React hook for managing multi-page document annotations with configurable history.
 */

import type { DrawShape, DrawTool, ShapeStyle } from "@n-uf/doodl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createDocumentAnnotationManager,
  DocumentAnnotationManager,
} from "./document-annotation-manager";
import type {
  DocumentAnnotationData,
  HistoryConfig,
  HistoryState,
  UndoRedoResult,
  ViewMode,
} from "./types";

// =============================================================================
// TYPES
// =============================================================================

export interface UseDocumentAnnotationsOptions {
  /** Total pages in document */
  totalPages: number;
  /** Initial shapes per page */
  initialShapes?: Map<number, DrawShape[]>;
  /** History configuration */
  historyConfig?: HistoryConfig;
  /** Initial view mode */
  initialViewMode?: ViewMode;
  /** Maximum history size */
  maxHistorySize?: number;
  /** Initial tool */
  initialTool?: DrawTool;
  /** Initial style */
  initialStyle?: ShapeStyle;
  /** Callback when shapes change on any page */
  onShapesChange?: (pageNumber: number, shapes: DrawShape[]) => void;
  /** Callback when history state changes */
  onHistoryChange?: (state: HistoryState) => void;
  /** Callback when view mode changes */
  onViewModeChange?: (mode: ViewMode) => void;
  /** Callback when active page changes */
  onActivePageChange?: (pageNumber: number) => void;
}

export interface UseDocumentAnnotationsReturn {
  /** The underlying manager instance */
  manager: DocumentAnnotationManager;

  // === State ===
  /** Current view mode */
  viewMode: ViewMode;
  /** Active page number (focus mode) */
  activePage: number;
  /** Total pages */
  totalPages: number;
  /** Current tool */
  tool: DrawTool;
  /** Current style */
  style: ShapeStyle;
  /** History state (canUndo/canRedo) */
  historyState: HistoryState;

  // === Page Operations ===
  /** Get shapes for a page */
  getPageShapes: (pageNumber: number) => DrawShape[];
  /** Set shapes for a page */
  setPageShapes: (pageNumber: number, shapes: DrawShape[]) => void;
  /** Add shape to a page */
  addShape: (pageNumber: number, shape: DrawShape) => void;
  /** Remove shape from a page */
  removeShape: (pageNumber: number, shapeId: string) => void;
  /** Clear all shapes from a page */
  clearPage: (pageNumber: number) => void;
  /** Get all shapes as flat array */
  getAllShapesFlat: () => DrawShape[];

  // === History Operations ===
  /** Undo (optionally specify page for per-page mode) */
  undo: (pageNumber?: number) => UndoRedoResult;
  /** Redo (optionally specify page for per-page mode) */
  redo: (pageNumber?: number) => UndoRedoResult;
  /** Check if can undo */
  canUndo: (pageNumber?: number) => boolean;
  /** Check if can redo */
  canRedo: (pageNumber?: number) => boolean;
  /** Peek which page would be affected by undo (global mode) */
  peekUndoPage: () => number | null;
  /** Peek which page would be affected by redo (global mode) */
  peekRedoPage: () => number | null;

  // === Mode Operations ===
  /** Set view mode (focus/exploded) */
  setViewMode: (mode: ViewMode) => void;
  /** Set active page (focus mode) */
  setActivePage: (pageNumber: number) => void;

  // === Tool & Style ===
  /** Set current tool */
  setTool: (tool: DrawTool) => void;
  /** Set current style */
  setStyle: (style: Partial<ShapeStyle>) => void;

  // === Serialization ===
  /** Export all annotations */
  exportAll: () => DocumentAnnotationData;
  /** Import annotations */
  importAll: (data: DocumentAnnotationData) => void;
  /** Export as JSON string */
  exportJSON: () => string;
  /** Import from JSON string */
  importJSON: (json: string) => void;
}

// =============================================================================
// HOOK
// =============================================================================

export function useDocumentAnnotations(
  options: UseDocumentAnnotationsOptions
): UseDocumentAnnotationsReturn {
  const {
    totalPages,
    initialShapes,
    historyConfig,
    initialViewMode,
    maxHistorySize,
    initialTool,
    initialStyle,
    onShapesChange,
    onHistoryChange,
    onViewModeChange,
    onActivePageChange,
  } = options;

  // Create manager once
  const managerRef = useRef<DocumentAnnotationManager | null>(null);
  /* eslint-disable react-hooks/refs */ // Intentional: ref initialization and manager access pattern
  if (!managerRef.current) {
    managerRef.current = createDocumentAnnotationManager({
      totalPages,
      initialShapes,
      historyConfig,
      initialViewMode,
      maxHistorySize,
      initialTool,
      initialStyle,
    });
  }
  const manager = managerRef.current;

  // Reactive state
  const [viewMode, setViewModeState] = useState<ViewMode>(manager.viewMode);
  const [activePage, setActivePageState] = useState(manager.activePageNumber);
  const [tool, setToolState] = useState<DrawTool>(manager.tool);
  const [style, setStyleState] = useState<ShapeStyle>(manager.style);
  const [historyState, setHistoryState] = useState<HistoryState>(
    manager.getHistoryState()
  );
  /* eslint-enable react-hooks/refs */

  // Version counter to trigger re-renders on shape changes
  const [, setVersion] = useState(0);

  // Subscribe to manager events
  useEffect(() => {
    const handleShapesChange = (
      pageNumber: number,
      shapes: DrawShape[]
    ): void => {
      setVersion((v) => v + 1);
      onShapesChange?.(pageNumber, shapes);
    };

    const handleHistoryChange = (state: HistoryState): void => {
      setHistoryState(state);
      onHistoryChange?.(state);
    };

    const handleViewModeChange = (mode: ViewMode): void => {
      setViewModeState(mode);
      onViewModeChange?.(mode);
    };

    const handleActivePageChange = (page: number): void => {
      setActivePageState(page);
      onActivePageChange?.(page);
    };

    const handleToolChange = (t: DrawTool): void => {
      setToolState(t);
    };

    const handleStyleChange = (s: ShapeStyle): void => {
      setStyleState(s);
    };

    manager.on("shapesChange", handleShapesChange);
    manager.on("historyChange", handleHistoryChange);
    manager.on("viewModeChange", handleViewModeChange);
    manager.on("activePageChange", handleActivePageChange);
    manager.on("toolChange", handleToolChange);
    manager.on("styleChange", handleStyleChange);

    return () => {
      manager.off("shapesChange", handleShapesChange);
      manager.off("historyChange", handleHistoryChange);
      manager.off("viewModeChange", handleViewModeChange);
      manager.off("activePageChange", handleActivePageChange);
      manager.off("toolChange", handleToolChange);
      manager.off("styleChange", handleStyleChange);
    };
    /* eslint-disable react-hooks/refs */ // Intentional: manager is a stable ref-derived value
  }, [
    manager,
    onShapesChange,
    onHistoryChange,
    onViewModeChange,
    onActivePageChange,
  ]);
  /* eslint-enable react-hooks/refs */

  // === Callbacks ===

  const getPageShapes = useCallback(
    (pageNumber: number) => manager.getPageShapes(pageNumber),
    [manager]
  );

  const setPageShapes = useCallback(
    (pageNumber: number, shapes: DrawShape[]) => {
      manager.setPageShapes(pageNumber, shapes);
    },
    [manager]
  );

  const addShape = useCallback(
    (pageNumber: number, shape: DrawShape) => {
      manager.addShape(pageNumber, shape);
    },
    [manager]
  );

  const removeShape = useCallback(
    (pageNumber: number, shapeId: string) => {
      manager.removeShape(pageNumber, shapeId);
    },
    [manager]
  );

  const clearPage = useCallback(
    (pageNumber: number) => {
      manager.clearPage(pageNumber);
    },
    [manager]
  );

  const getAllShapesFlat = useCallback(
    () => manager.getAllShapesFlat(),
    [manager]
  );

  const undo = useCallback(
    (pageNumber?: number) => manager.undo(pageNumber),
    [manager]
  );

  const redo = useCallback(
    (pageNumber?: number) => manager.redo(pageNumber),
    [manager]
  );

  const canUndo = useCallback(
    (pageNumber?: number) => manager.canUndo(pageNumber),
    [manager]
  );

  const canRedo = useCallback(
    (pageNumber?: number) => manager.canRedo(pageNumber),
    [manager]
  );

  const peekUndoPage = useCallback(() => manager.peekUndoPage(), [manager]);

  const peekRedoPage = useCallback(() => manager.peekRedoPage(), [manager]);

  const setViewMode = useCallback(
    (mode: ViewMode) => {
      manager.setViewMode(mode);
    },
    [manager]
  );

  const setActivePage = useCallback(
    (pageNumber: number) => {
      manager.setActivePage(pageNumber);
    },
    [manager]
  );

  const setTool = useCallback(
    (t: DrawTool) => {
      manager.setTool(t);
    },
    [manager]
  );

  const setStyle = useCallback(
    (s: Partial<ShapeStyle>) => {
      manager.setStyle(s);
    },
    [manager]
  );

  const exportAll = useCallback(() => manager.exportAll(), [manager]);

  const importAll = useCallback(
    (data: DocumentAnnotationData) => {
      manager.importAll(data);
    },
    [manager]
  );

  const exportJSON = useCallback(() => manager.exportJSON(), [manager]);

  const importJSON = useCallback(
    (json: string) => {
      manager.importJSON(json);
    },
    [manager]
  );

  /* eslint-disable react-hooks/refs */ // Intentional: manager is a stable ref-derived value
  return useMemo(
    () => ({
      manager,
      viewMode,
      activePage,
      totalPages,
      tool,
      style,
      historyState,
      getPageShapes,
      setPageShapes,
      addShape,
      removeShape,
      clearPage,
      getAllShapesFlat,
      undo,
      redo,
      canUndo,
      canRedo,
      peekUndoPage,
      peekRedoPage,
      setViewMode,
      setActivePage,
      setTool,
      setStyle,
      exportAll,
      importAll,
      exportJSON,
      importJSON,
    }),
    [
      manager,
      viewMode,
      activePage,
      totalPages,
      tool,
      style,
      historyState,
      getPageShapes,
      setPageShapes,
      addShape,
      removeShape,
      clearPage,
      getAllShapesFlat,
      undo,
      redo,
      canUndo,
      canRedo,
      peekUndoPage,
      peekRedoPage,
      setViewMode,
      setActivePage,
      setTool,
      setStyle,
      exportAll,
      importAll,
      exportJSON,
      importJSON,
    ]
  );
  /* eslint-enable react-hooks/refs */
}
