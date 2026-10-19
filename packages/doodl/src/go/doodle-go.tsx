"use client";

/**
 * DoodleGo - Main Doodl UI composition
 *
 * A complete drawing studio UI that wraps Doodl functionality
 * with tools, style controls, and panels. Supports both canvas and PDF modes.
 */

import {
  DEFAULT_MARKER_SETTINGS,
  DEFAULT_SHAPE_STYLE,
  DEFAULT_TEXT_HIGHLIGHT_STYLE,
  resolveBehavior,
  setMarkerSettings,
  type DrawShape,
  type DrawTool,
  type MarkerSettings,
  type ShapeStyle,
} from "../../index";
import {
  getAnnotationTextLayersByPage,
  PDF_FIT_CYCLE_BUTTON_CLASS,
  PDF_FIT_CYCLE_LABEL_CLASS,
  PDF_FIT_CYCLE_LED_OFF_CLASS,
  PDF_FIT_CYCLE_LED_ON_CLASS,
  PDF_TEXT_LAYER_SELECTOR,
  PDF_ZOOM_PERCENT_BUTTON_CLASS,
  useCyclingFitMode,
  usePdfFind,
  usePdfViewportScale,
  type PdfFitMode,
} from "../react-pdf";
import { FindBar } from "../react-pdf/components";
import {
  Doodl,
  PageAnnotationController,
  type DoodlRef,
} from "../react";
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { DoodlGoChromeStyles } from "./chrome-styles";
import { useKeyboardShortcuts, useTheme } from "./hooks";
import {
  KEYBOARD_SHORTCUTS,
  PDF_KEYBOARD_SHORTCUTS,
  TOOL_DEFINITIONS,
  type Theme,
} from "./tokens";
import {
  CanvasFrame,
  Header,
  Panel,
  PdfContent,
  SegmentedToggle,
  ShapeExplorer,
  ShortcutsList,
  StatusBar,
  StyleBar,
  Toolbar,
  ToolbarButton,
  ToolbarDivider,
  ToolSidebar,
  ToolSidebarToggle,
  usePdfAnnotations,
  type PageAnnotations,
  type PdfSource,
  type PdfViewMode,
} from "./ui-blocks";

// =============================================================================
// TYPES
// =============================================================================

export type DoodleGoMode = "text" | "pdf";

export interface DoodleGoProps {
  /** Initial theme */
  initialTheme?: Theme;
  /** Initial mode */
  initialMode?: DoodleGoMode;
  /** Initial tool */
  initialTool?: DrawTool;
  /** Initial PDF source (URL or File) - defaults to sample PDF */
  initialPdfSource?: PdfSource;
  /**
   * PDF fit mode for the cycle control (and optional auto-apply).
   * Default: `"width"`. Ignored when {@link DoodleGoProps.initialPdfScale}
   * is set and {@link DoodleGoProps.applyInitialFit} is false.
   */
  initialFitMode?: PdfFitMode;
  /**
   * Apply {@link DoodleGoProps.initialFitMode} once the PDF viewport can
   * measure. Default: `false` (scale stays at
   * {@link DoodleGoProps.initialPdfScale} / 1 until the fit control is used).
   */
  applyInitialFit?: boolean;
  /**
   * Fixed initial zoom factor before any fit is applied. Default: `1`.
   * Prefer {@link DoodleGoProps.initialFitMode} +
   * {@link DoodleGoProps.applyInitialFit} for viewport-relative defaults.
   */
  initialPdfScale?: number;
  /** Callback when shapes change */
  onShapesChange?: (shapes: DrawShape[]) => void;
  /** Callback when mode changes */
  onModeChange?: (mode: DoodleGoMode) => void;
  /** Title */
  title?: string;
  /** Subtitle */
  subtitle?: string;
  /** Custom text layer content (for text mode) */
  textLayerContent?: React.ReactNode;
  /** Custom elements rendered at the start of the toolbar */
  toolbarExtensions?: React.ReactNode;
  /** Hide the mode toggle (if you want external control) */
  hideModeToggle?: boolean;
  /** Merge overlapping text highlight rects (default: true) */
  mergeHighlights?: boolean;
  /** Additional class name */
  className?: string;
}

export interface DoodleGoRef {
  /** Load a PDF from URL or File */
  loadPdf: (source: PdfSource) => void;
  /** Open file picker to select PDF */
  openPdfPicker: () => void;
  /** Switch mode */
  setMode: (mode: DoodleGoMode) => void;
  /** Get current mode */
  getMode: () => DoodleGoMode;
  /** Canvas undo */
  undo: () => void;
  /** Canvas redo */
  redo: () => void;
  /** Clear all shapes */
  clear: () => void;
  /** Export shapes as JSON */
  exportJSON: () => string | undefined;
  /** Set active tool */
  setTool: (tool: DrawTool) => void;
  /** Set style */
  setStyle: (style: Partial<ShapeStyle>) => void;
  // PDF Navigation
  /** Go to previous PDF page */
  prevPage: () => void;
  /** Go to next PDF page */
  nextPage: () => void;
  /** Go to specific PDF page */
  goToPage: (page: number) => void;
  /** Get current PDF page */
  getCurrentPage: () => number;
  /** Get total PDF pages */
  getTotalPages: () => number;
  /** Get all PDF annotations as Map */
  getAllAnnotations: () => PageAnnotations;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const MODE_OPTIONS: { value: DoodleGoMode; label: string }[] = [
  { value: "pdf", label: "PDF" },
  { value: "text", label: "TEXT" },
];

// Default PDF - same as original showcase
const DEFAULT_PDF_SOURCE =
  "/AtlasFinancialSystems-BlueForgeSoftwareEng-SoftwareDevelopmentAgreement-SAMPLE_XL.pdf";

// =============================================================================
// COMPONENT
// =============================================================================

export const DoodleGo = forwardRef<DoodleGoRef, DoodleGoProps>(
  (
    {
      initialTheme = "dark",
      initialMode = "text",
      initialTool = "select",
      initialPdfSource = DEFAULT_PDF_SOURCE,
      initialFitMode = "width",
      applyInitialFit = false,
      initialPdfScale = 1,
      onShapesChange,
      onModeChange,
      title = "DOODL",
      subtitle = "STUDIO.v1",
      textLayerContent,
      toolbarExtensions,
      hideModeToggle = false,
      mergeHighlights = true,
      className = "",
    },
    ref,
  ) => {
    const {
      tokens: t,
      accent,
      isDark,
      toggle: toggleTheme,
    } = useTheme(initialTheme);

    // Refs
    const doodlRef = useRef<DoodlRef>(null);
    const pdfControllerRef = useRef<PageAnnotationController | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const canvasContainerRef = useRef<HTMLDivElement>(null);

    // Mode state
    const [mode, setModeState] = useState<DoodleGoMode>(initialMode);
    const [pdfSource, setPdfSource] = useState<PdfSource>(initialPdfSource);

    // Common state
    const [activeTool, setActiveTool] = useState<DrawTool>(initialTool);
    const [currentStyle, setCurrentStyle] =
      useState<ShapeStyle>(DEFAULT_SHAPE_STYLE);
    const [shapeCount, setShapeCount] = useState(0);
    const [canUndo, setCanUndo] = useState(false);
    const [canRedo, setCanRedo] = useState(false);
    const [showData, setShowData] = useState(true);
    const [showMarker, setShowMarker] = useState(false);
    const [showExplorer, setShowExplorer] = useState(true);
    const [stateJson, setStateJson] = useState<string>("{}");
    const [markerConfig, setMarkerConfig] = useState<MarkerSettings>({
      ...DEFAULT_MARKER_SETTINGS,
    });

    // Shape explorer state
    const [explorerShapes, setExplorerShapes] = useState<DrawShape[]>([]);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const textLayerRef = useRef<HTMLDivElement>(null);

    // Right panel resize state
    const [rightPanelWidth, setRightPanelWidth] = useState(256); // Default w-64 = 256px
    const [isResizingPanel, setIsResizingPanel] = useState(false);
    const panelResizeStartRef = useRef<{
      startX: number;
      startWidth: number;
    } | null>(null);

    // PDF state (managed in parent for header zoom controls)
    const [pdfDimensions, setPdfDimensions] = useState<{
      width: number;
      height: number;
    } | null>(null);
    const pdfViewport = usePdfViewportScale({
      pageSize: pdfDimensions,
      containerRef: canvasContainerRef,
      initialScale: initialPdfScale,
    });
    const {
      scale: pdfScale,
      zoomIn: handleZoomIn,
      zoomOut: handleZoomOut,
      resetZoom: handleZoomReset,
    } = pdfViewport;
    const fitCycle = useCyclingFitMode(pdfViewport, {
      initialMode: initialFitMode,
      applyInitialFit,
    });
    const {
      descriptor: fitDescriptor,
      nextDescriptor: fitNextDescriptor,
      canFit: canFitPdf,
      isActive: fitIsActive,
      cycleFit: handleCycleFit,
    } = fitCycle;
    const fitCycleTitle =
      fitDescriptor.mode === fitNextDescriptor.mode
        ? `${fitDescriptor.title} — click to apply`
        : `${fitDescriptor.title} — click for ${fitNextDescriptor.label.toLowerCase()}`;
    const [pdfCurrentPage, setPdfCurrentPage] = useState(1);
    const [pdfTotalPages, setPdfTotalPages] = useState(0);
    const [pdfViewMode, setPdfViewMode] = useState<PdfViewMode>("exploded");
    const [showFindBar, setShowFindBar] = useState(false);

    // Find-in-PDF: searches whichever pages are currently mounted — the
    // current page in "single" mode, all pages in "exploded" (scroll) mode
    // (PdfContent renders every page there, no virtualization yet).
    const findPages = useMemo(
      () =>
        pdfViewMode === "single"
          ? [pdfCurrentPage]
          : Array.from({ length: pdfTotalPages }, (_, i) => i + 1),
      [pdfViewMode, pdfCurrentPage, pdfTotalPages],
    );
    const getFindTextLayer = useCallback((page: number): HTMLElement | null => {
      const container = canvasContainerRef.current;
      if (!container) return null;
      const layers = getAnnotationTextLayersByPage(
        PDF_TEXT_LAYER_SELECTOR,
        container,
      );
      return layers.get(page) ?? null;
    }, []);
    const getFindScale = useCallback(() => pdfScale, [pdfScale]);
    const pdfFind = usePdfFind({
      pages: findPages,
      getTextLayer: getFindTextLayer,
      getScale: getFindScale,
    });

    // Locate the active find match: switch to its page in single mode (ping
    // fires once the page swap lands, below), or scroll it into view in
    // exploded mode. v1 limitation: exploded mode scrolls but doesn't ping
    // (no per-page controller map is threaded through PdfContent yet).
    useEffect(() => {
      if (mode !== "pdf" || !pdfFind.activeMatch) return;
      if (
        pdfViewMode === "single" &&
        pdfFind.activeMatch.page !== pdfCurrentPage
      ) {
        setPdfCurrentPage(pdfFind.activeMatch.page);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps -- fires once per locateToken bump
    }, [pdfFind.locateToken]);

    useEffect(() => {
      if (mode !== "pdf" || !pdfFind.activeMatch) return;
      const container = canvasContainerRef.current;
      if (!container) return;

      if (pdfViewMode === "single") {
        if (pdfFind.activeMatch.page !== pdfCurrentPage) return;
        pdfControllerRef.current?.ping(pdfFind.activeMatch.shapeId, {
          type: "locateFlash",
        });
        return;
      }

      const pageEl = container.querySelector<HTMLElement>(
        `[data-page-number="${pdfFind.activeMatch.page}"]`,
      );
      pageEl?.scrollIntoView({ behavior: "smooth", block: "center" });
      // eslint-disable-next-line react-hooks/exhaustive-deps -- fires once per locateToken bump (+ page landing in single mode)
    }, [pdfFind.locateToken, pdfCurrentPage, mode, pdfViewMode]);

    // Canvas dimensions - responsive to container, snapped to grid
    const GRID_SIZE = 40;
    const [canvasSize, setCanvasSize] = useState({ width: 800, height: 560 });

    // Text frame dimensions (resizable, constrained to canvas)
    const [textFrameSize, setTextFrameSize] = useState({
      width: 800,
      height: 560,
    });
    const [isResizing, setIsResizing] = useState(false);
    const resizeStartRef = useRef<{
      corner: string;
      startX: number;
      startY: number;
      startWidth: number;
      startHeight: number;
    } | null>(null);

    // Constrain text frame to canvas bounds when canvas resizes
    // Compute constrained size as derived value and update state asynchronously
    const constrainedTextFrameSize = React.useMemo(() => {
      const maxWidth = canvasSize.width - GRID_SIZE * 2; // Leave margin
      const maxHeight = canvasSize.height - GRID_SIZE * 2;
      return {
        width: Math.min(textFrameSize.width, maxWidth),
        height: Math.min(textFrameSize.height, maxHeight),
      };
    }, [
      canvasSize.width,
      canvasSize.height,
      textFrameSize.width,
      textFrameSize.height,
    ]);

    // Update state asynchronously when constraint changes to avoid cascading renders
    const prevCanvasSizeRef = useRef(canvasSize);
    useEffect(() => {
      const prevCanvasSize = prevCanvasSizeRef.current;
      const canvasShrunk =
        canvasSize.width < prevCanvasSize.width ||
        canvasSize.height < prevCanvasSize.height;

      if (canvasShrunk) {
        // Defer state update to avoid synchronous setState in effect
        queueMicrotask(() => {
          setTextFrameSize((prev) => {
            const maxWidth = canvasSize.width - GRID_SIZE * 2;
            const maxHeight = canvasSize.height - GRID_SIZE * 2;
            return {
              width: Math.min(prev.width, maxWidth),
              height: Math.min(prev.height, maxHeight),
            };
          });
        });
      }

      prevCanvasSizeRef.current = canvasSize;
    }, [canvasSize]);

    // Measure canvas container and update dimensions (snap to grid)
    useLayoutEffect(() => {
      const container = canvasContainerRef.current;
      if (!container || mode !== "text") return;

      const updateSize = (): void => {
        const rect = container.getBoundingClientRect();
        // Snap to grid (round down to nearest grid cell)
        const width = Math.floor(rect.width / GRID_SIZE) * GRID_SIZE;
        const height = Math.floor(rect.height / GRID_SIZE) * GRID_SIZE;
        // Minimum size
        const finalWidth = Math.max(width, GRID_SIZE * 10); // min 400px
        const finalHeight = Math.max(height, GRID_SIZE * 8); // min 320px
        setCanvasSize({ width: finalWidth, height: finalHeight });
      };

      updateSize();

      const resizeObserver = new ResizeObserver(updateSize);
      resizeObserver.observe(container);

      return () => resizeObserver.disconnect();
    }, [mode]);

    // Text frame resize handlers - using document-level events for smooth dragging
    const handleResizeStart = useCallback(
      (corner: string, e: React.PointerEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsResizing(true);
        resizeStartRef.current = {
          corner,
          startX: e.clientX,
          startY: e.clientY,
          startWidth: textFrameSize.width,
          startHeight: textFrameSize.height,
        };
      },
      [textFrameSize],
    );

    // Document-level mouse move/up for resize
    useEffect(() => {
      if (!isResizing) return;

      const handleMouseMove = (e: MouseEvent): void => {
        if (!resizeStartRef.current) return;

        const { corner, startX, startY, startWidth, startHeight } =
          resizeStartRef.current;
        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;

        let newWidth = startWidth;
        let newHeight = startHeight;

        // Calculate new dimensions based on which corner is dragged
        if (corner.includes("right")) {
          newWidth = startWidth + deltaX;
        } else if (corner.includes("left")) {
          newWidth = startWidth - deltaX;
        }

        if (corner.includes("bottom")) {
          newHeight = startHeight + deltaY;
        } else if (corner.includes("top")) {
          newHeight = startHeight - deltaY;
        }

        // Snap to grid
        newWidth = Math.round(newWidth / GRID_SIZE) * GRID_SIZE;
        newHeight = Math.round(newHeight / GRID_SIZE) * GRID_SIZE;

        // Enforce min/max bounds (constrained to canvas with margin)
        const minWidth = GRID_SIZE * 8;
        const minHeight = GRID_SIZE * 6;
        const maxWidth = canvasSize.width - GRID_SIZE * 2;
        const maxHeight = canvasSize.height - GRID_SIZE * 2;

        newWidth = Math.max(minWidth, Math.min(newWidth, maxWidth));
        newHeight = Math.max(minHeight, Math.min(newHeight, maxHeight));

        setTextFrameSize({ width: newWidth, height: newHeight });
      };

      const handleMouseUp = (): void => {
        setIsResizing(false);
        resizeStartRef.current = null;
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);

      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }, [isResizing, canvasSize.width, canvasSize.height]);

    // Right panel resize handler
    const handlePanelResizeStart = useCallback(
      (e: React.MouseEvent) => {
        e.preventDefault();
        setIsResizingPanel(true);
        panelResizeStartRef.current = {
          startX: e.clientX,
          startWidth: rightPanelWidth,
        };
      },
      [rightPanelWidth],
    );

    // Document-level mouse move/up for panel resize
    useEffect(() => {
      if (!isResizingPanel) return;

      const handleMouseMove = (e: MouseEvent): void => {
        if (!panelResizeStartRef.current) return;

        const { startX, startWidth } = panelResizeStartRef.current;
        const deltaX = startX - e.clientX; // Negative because dragging left increases width

        let newWidth = startWidth + deltaX;

        // Enforce min/max bounds
        const minWidth = 200;
        const maxWidth = 500;
        newWidth = Math.max(minWidth, Math.min(newWidth, maxWidth));

        setRightPanelWidth(newWidth);
      };

      const handleMouseUp = (): void => {
        setIsResizingPanel(false);
        panelResizeStartRef.current = null;
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);

      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }, [isResizingPanel]);

    // PDF annotations (per-page storage)
    const {
      annotations: pdfAnnotations,
      setPageAnnotations: setPdfPageAnnotations,
      getAllShapesFlat: getAllPdfShapesFlat,
    } = usePdfAnnotations();

    // Mode change handler
    const handleModeChange = useCallback(
      (newMode: DoodleGoMode) => {
        setModeState(newMode);
        onModeChange?.(newMode);
      },
      [onModeChange],
    );

    // Tool change handler
    const handleToolChange = useCallback(
      (tool: DrawTool) => {
        if (mode === "text") {
          doodlRef.current?.setTool(tool);
        } else {
          pdfControllerRef.current?.setTool(tool);
        }
        setActiveTool(tool);

        if (tool === "text-highlight") {
          setCurrentStyle(DEFAULT_TEXT_HIGHLIGHT_STYLE);
          setShowMarker(true);
        } else {
          setCurrentStyle(DEFAULT_SHAPE_STYLE);
        }
      },
      [mode],
    );

    // Style change handler
    const handleStyleChange = useCallback(
      (updates: Partial<ShapeStyle>) => {
        setCurrentStyle((prev) => {
          const newStyle = { ...prev, ...updates };
          if (mode === "text") {
            doodlRef.current?.setStyle(newStyle);
          } else {
            pdfControllerRef.current?.setStyle(newStyle);
          }
          return newStyle;
        });
      },
      [mode],
    );

    // Shapes change handler (text mode)
    const handleTextShapesChange = useCallback(
      (shapes: DrawShape[]) => {
        setShapeCount(shapes.length);
        setExplorerShapes(shapes);
        setStateJson(JSON.stringify({ shapes }, null, 2));
        onShapesChange?.(shapes);
      },
      [onShapesChange],
    );

    // Shapes change handler (PDF) - receives shapes for current page
    // Strips ephemeral overlays (e.g. find-match highlights, behavior.persisted
    // === false) before they touch shape counts, the explorer, or state JSON —
    // those are render-only decorations, never real annotations.
    const handlePdfShapesChange = useCallback(
      (rawShapes: DrawShape[]) => {
        const shapes = rawShapes.filter(
          (shape) => resolveBehavior(shape.behavior).persisted,
        );
        // Get total count across all pages
        const allShapes = getAllPdfShapesFlat();
        // Update current page shapes in the count
        const otherPagesCount =
          allShapes.length - (pdfAnnotations.get(pdfCurrentPage)?.length ?? 0);
        const totalCount = otherPagesCount + shapes.length;

        setShapeCount(totalCount);
        setExplorerShapes(shapes); // Current page shapes for explorer

        // Build annotations object - always include current page shapes
        // (fixes bug where empty map would miss the first shape)
        const annotationsObj: Record<number, DrawShape[]> = {
          [pdfCurrentPage]: shapes,
        };
        // Add shapes from other pages
        for (const [page, pageShapes] of pdfAnnotations.entries()) {
          if (page !== pdfCurrentPage) {
            annotationsObj[page] = pageShapes;
          }
        }

        setStateJson(
          JSON.stringify(
            {
              currentPage: pdfCurrentPage,
              totalPages: pdfTotalPages,
              annotations: annotationsObj,
            },
            null,
            2,
          ),
        );
        onShapesChange?.(shapes);
      },
      [
        onShapesChange,
        pdfCurrentPage,
        pdfTotalPages,
        pdfAnnotations,
        getAllPdfShapesFlat,
      ],
    );

    // History change handler
    const handleHistoryChange = useCallback(
      (state: { canUndo: boolean; canRedo: boolean }) => {
        setCanUndo(state.canUndo);
        setCanRedo(state.canRedo);
      },
      [],
    );

    // Undo handler
    const handleUndo = useCallback(() => {
      if (mode === "text") {
        doodlRef.current?.undo();
      } else {
        pdfControllerRef.current?.undo();
      }
    }, [mode]);

    // Redo handler
    const handleRedo = useCallback(() => {
      if (mode === "text") {
        doodlRef.current?.redo();
      } else {
        pdfControllerRef.current?.redo();
      }
    }, [mode]);

    // Clear handler
    const handleClear = useCallback(() => {
      if (mode === "text") {
        doodlRef.current?.clear();
      } else {
        pdfControllerRef.current?.clearShapes();
        // Also clear from annotations map for current page
        setPdfPageAnnotations(pdfCurrentPage, []);
      }
    }, [mode, pdfCurrentPage, setPdfPageAnnotations]);

    // PDF page navigation handlers
    const handlePrevPage = useCallback(() => {
      if (pdfCurrentPage > 1) {
        setPdfCurrentPage(pdfCurrentPage - 1);
      }
    }, [pdfCurrentPage]);

    const handleNextPage = useCallback(() => {
      if (pdfCurrentPage < pdfTotalPages) {
        setPdfCurrentPage(pdfCurrentPage + 1);
      }
    }, [pdfCurrentPage, pdfTotalPages]);

    const handleGoToPage = useCallback(
      (page: number) => {
        const clampedPage = Math.max(1, Math.min(page, pdfTotalPages));
        setPdfCurrentPage(clampedPage);
      },
      [pdfTotalPages],
    );

    const handlePdfLoad = useCallback((numPages: number) => {
      setPdfTotalPages(numPages);
      setPdfCurrentPage(1);
    }, []);

    // Handle annotations change for a specific page.
    // Strips ephemeral overlays (find-match highlights, etc.) so they never
    // get persisted into real page annotations — see handlePdfShapesChange.
    const handlePdfAnnotationsChange = useCallback(
      (page: number, rawShapes: DrawShape[]) => {
        const shapes = rawShapes.filter(
          (shape) => resolveBehavior(shape.behavior).persisted,
        );
        setPdfPageAnnotations(page, shapes);
      },
      [setPdfPageAnnotations],
    );

    // Export handler
    const handleExport = useCallback(() => {
      let json: string | undefined;
      if (mode === "text") {
        json = doodlRef.current?.exportJSON();
      } else {
        // Export all PDF annotations
        const exportData = {
          totalPages: pdfTotalPages,
          annotations: Object.fromEntries(pdfAnnotations),
        };
        json = JSON.stringify(exportData, null, 2);
      }
      if (json) {
        navigator.clipboard.writeText(json);
      }
    }, [mode, pdfTotalPages, pdfAnnotations]);

    // Marker setting update
    const updateMarkerSetting = useCallback(
      (key: keyof MarkerSettings, value: number) => {
        setMarkerConfig((prev) => {
          const newConfig = { ...prev, [key]: value };
          setMarkerSettings(newConfig);
          doodlRef.current?.doodl?.render();
          return newConfig;
        });
      },
      [],
    );

    // Reset marker settings
    const resetMarkerSettings = useCallback(() => {
      setMarkerConfig({ ...DEFAULT_MARKER_SETTINGS });
      setMarkerSettings(DEFAULT_MARKER_SETTINGS);
      doodlRef.current?.doodl?.render();
    }, []);

    // Import JSON
    const handleImport = useCallback(() => {
      try {
        if (mode === "text") {
          doodlRef.current?.importJSON(stateJson);
        }
        // TODO: PDF import
      } catch {
        alert("Invalid JSON");
      }
    }, [stateJson, mode]);

    // File picker handler
    const handleFileSelect = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && file.type === "application/pdf") {
          setPdfSource(file);
          handleModeChange("pdf");
        }
        // Reset input
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      },
      [handleModeChange],
    );

    // Open PDF picker
    const openPdfPicker = useCallback(() => {
      fileInputRef.current?.click();
    }, []);

    // Keyboard shortcuts
    useKeyboardShortcuts({ onToolChange: handleToolChange });

    // Imperative handle
    useImperativeHandle(
      ref,
      () => ({
        loadPdf: (source: PdfSource) => {
          setPdfSource(source);
          if (source) {
            handleModeChange("pdf");
          }
        },
        openPdfPicker,
        setMode: handleModeChange,
        getMode: () => mode,
        undo: handleUndo,
        redo: handleRedo,
        clear: handleClear,
        exportJSON: () => {
          if (mode === "text") {
            return doodlRef.current?.exportJSON();
          }
          // Export all PDF annotations
          const exportData = {
            totalPages: pdfTotalPages,
            annotations: Object.fromEntries(pdfAnnotations),
          };
          return JSON.stringify(exportData, null, 2);
        },
        setTool: handleToolChange,
        setStyle: handleStyleChange,
        // PDF Navigation
        prevPage: handlePrevPage,
        nextPage: handleNextPage,
        goToPage: handleGoToPage,
        getCurrentPage: () => pdfCurrentPage,
        getTotalPages: () => pdfTotalPages,
        getAllAnnotations: () => pdfAnnotations,
      }),
      [
        mode,
        pdfTotalPages,
        pdfAnnotations,
        pdfCurrentPage,
        handleModeChange,
        handleUndo,
        handleRedo,
        handleClear,
        handleToolChange,
        handleStyleChange,
        handlePrevPage,
        handleNextPage,
        handleGoToPage,
        openPdfPicker,
      ],
    );

    // Status bar items
    const statusItems = [
      { label: "MODE", value: mode.toUpperCase() },
      { label: "TOOL", value: activeTool.toUpperCase() },
      { label: "OBJECTS", value: shapeCount },
      ...(mode === "pdf" && pdfTotalPages > 0 && pdfViewMode === "single"
        ? [{ label: "PAGE", value: `${pdfCurrentPage}/${pdfTotalPages}` }]
        : []),
      ...(mode === "pdf" && pdfViewMode === "exploded"
        ? [{ label: "VIEW", value: "SCROLL" }]
        : []),
      ...(mode === "pdf" && pdfScale !== 1
        ? [{ label: "SCALE", value: `${Math.round(pdfScale * 100)}%` }]
        : []),
    ];

    // Default text layer content
    const defaultTextContent = (
      <div className="max-w-[700px]">
        <h2
          className={`text-sm font-bold mb-4 ${isDark ? "text-zinc-300" : "text-stone-700"} tracking-wide`}
        >
          {"// SAMPLE DOCUMENT"}
        </h2>
        <p className="mb-4 text-xs">
          This is a sample text layer demonstrating the text highlight feature.
          Select the <span className={accent.text}>MARK [M]</span> tool and drag
          to select any text. The selected text will be highlighted with a
          marker effect on the canvas overlay.
        </p>
        <p className="mb-4 text-xs">
          Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do
          eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad
          minim veniam, quis nostrud exercitation ullamco laboris.
        </p>
        <p className="mb-4 text-xs">
          Duis aute irure dolor in reprehenderit in voluptate velit esse cillum
          dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non
          proident.
        </p>
        <div className={`mt-6 pt-4 border-t ${t.border}`}>
          <div className={`text-[10px] ${t.textDimmer} tracking-wider mb-2`}>
            FEATURES:
          </div>
          <ul className={`text-xs ${t.textDim} space-y-1`}>
            <li>→ Highlight important passages</li>
            <li>→ Add annotations and notes</li>
            <li>→ Draw shapes to emphasize</li>
            <li>→ Export as JSON data</li>
          </ul>
        </div>
      </div>
    );

    // Dimension labels for canvas frame
    const widthLabel =
      mode === "text"
        ? `${canvasSize.width}px`
        : pdfDimensions
          ? `${Math.round(pdfDimensions.width * pdfScale)}px`
          : "...";
    const heightLabel =
      mode === "text"
        ? `${canvasSize.height}px`
        : pdfDimensions
          ? `${Math.round(pdfDimensions.height * pdfScale)}px`
          : "...";

    return (
      <div
        className={`doodl-go h-screen flex flex-col ${t.bg} ${t.text} font-mono ${t.selection} transition-colors duration-300 overflow-hidden ${className}`}
      >
        <DoodlGoChromeStyles />
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* Grid background - fixed overlay */}
        <div
          className="fixed inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage: `
              linear-gradient(to right, ${t.gridColor} 1px, transparent 1px),
              linear-gradient(to bottom, ${t.gridColor} 1px, transparent 1px)
            `,
            backgroundSize: "40px 40px",
          }}
        />

        {/* Header */}
        <Header
          title={title}
          subtitle={subtitle}
          tokens={t}
          statusLabel={`${shapeCount.toString().padStart(3, "0")} OBJECTS`}
        >
          <Toolbar>
            {/* Custom toolbar extensions */}
            {toolbarExtensions}
            {toolbarExtensions && <ToolbarDivider tokens={t} />}

            {/* PDF MODE: Page navigation + Zoom controls */}
            {mode === "pdf" && (
              <>
                {/* Page navigation (only in single mode) */}
                {pdfViewMode === "single" && pdfTotalPages > 1 && (
                  <>
                    <ToolbarButton
                      onClick={handlePrevPage}
                      disabled={pdfCurrentPage <= 1}
                      tokens={t}
                      isDark={isDark}
                      title="Previous page (←)"
                    >
                      ◀
                    </ToolbarButton>
                    <button
                      className={`px-2 py-1.5 text-[10px] tracking-wider border-y ${t.border} transition-colors min-w-[60px]`}
                      title="Current page"
                    >
                      {pdfCurrentPage} / {pdfTotalPages}
                    </button>
                    <ToolbarButton
                      onClick={handleNextPage}
                      disabled={pdfCurrentPage >= pdfTotalPages}
                      tokens={t}
                      isDark={isDark}
                      className="mr-2"
                      title="Next page (→)"
                    >
                      ▶
                    </ToolbarButton>
                  </>
                )}

                {/* Zoom controls */}
                <ToolbarButton
                  onClick={handleZoomOut}
                  tokens={t}
                  isDark={isDark}
                  title="Zoom out"
                >
                  −
                </ToolbarButton>
                <button
                  onClick={handleZoomReset}
                  className={`px-2 py-1.5 text-[10px] tracking-wider border-y ${t.border} transition-colors ${PDF_ZOOM_PERCENT_BUTTON_CLASS}`}
                  title="Reset zoom to 100%"
                >
                  {Math.round(pdfScale * 100)}%
                </button>
                <ToolbarButton
                  onClick={handleZoomIn}
                  tokens={t}
                  isDark={isDark}
                  title="Zoom in"
                >
                  +
                </ToolbarButton>
                <ToolbarButton
                  onClick={handleCycleFit}
                  tokens={t}
                  isDark={isDark}
                  active={fitIsActive}
                  className={`mr-2 ${PDF_FIT_CYCLE_BUTTON_CLASS}`}
                  title={fitCycleTitle}
                  disabled={!canFitPdf}
                >
                  <span className={PDF_FIT_CYCLE_LABEL_CLASS}>
                    <span
                      aria-hidden
                      className={
                        fitIsActive
                          ? PDF_FIT_CYCLE_LED_ON_CLASS
                          : PDF_FIT_CYCLE_LED_OFF_CLASS
                      }
                    />
                    {fitDescriptor.label}
                  </span>
                </ToolbarButton>

                {/* View mode toggle */}
                <ToolbarButton
                  onClick={() =>
                    setPdfViewMode(
                      pdfViewMode === "single" ? "exploded" : "single",
                    )
                  }
                  tokens={t}
                  isDark={isDark}
                  title={
                    pdfViewMode === "single"
                      ? "Scroll all pages"
                      : "Single page view"
                  }
                >
                  {pdfViewMode === "single" ? "≡" : "□"}
                </ToolbarButton>

                {/* Find toggle */}
                <ToolbarButton
                  onClick={() => {
                    setShowFindBar((prev) => {
                      if (prev) pdfFind.clear();
                      return !prev;
                    });
                  }}
                  tokens={t}
                  isDark={isDark}
                  className="mr-2"
                  title="Find in document"
                >
                  ⌕ FIND
                </ToolbarButton>

                {/* Open PDF button */}
                <ToolbarButton
                  onClick={openPdfPicker}
                  tokens={t}
                  isDark={isDark}
                  className="mr-2"
                  title="Open PDF file"
                >
                  ◈ OPEN
                </ToolbarButton>
              </>
            )}

            {/* Mode toggle */}
            {!hideModeToggle && (
              <>
                <SegmentedToggle
                  options={MODE_OPTIONS}
                  value={mode}
                  onChange={handleModeChange}
                  tokens={t}
                  isDark={isDark}
                />
                <ToolbarDivider tokens={t} />
              </>
            )}

            {/* Theme toggle */}
            <ToolbarButton
              onClick={toggleTheme}
              tokens={t}
              isDark={isDark}
              className="mr-2"
              title={`Switch to ${isDark ? "light" : "dark"} mode`}
            >
              {isDark ? "◐ LIGHT" : "◑ DARK"}
            </ToolbarButton>

            <ToolbarButton
              onClick={handleUndo}
              disabled={!canUndo}
              tokens={t}
              isDark={isDark}
            >
              ← UNDO
            </ToolbarButton>
            <ToolbarButton
              onClick={handleRedo}
              disabled={!canRedo}
              tokens={t}
              isDark={isDark}
            >
              REDO →
            </ToolbarButton>

            <ToolbarDivider tokens={t} />

            <ToolbarButton
              onClick={handleClear}
              variant="danger"
              tokens={t}
              isDark={isDark}
            >
              CLEAR
            </ToolbarButton>
            <ToolbarButton
              onClick={handleExport}
              variant="success"
              tokens={t}
              isDark={isDark}
            >
              EXPORT
            </ToolbarButton>
          </Toolbar>
        </Header>

        <div className="relative flex flex-1 min-h-0 pb-8">
          {/* Find bar - floats over the PDF canvas area */}
          {mode === "pdf" && showFindBar && (
            <div
              className={`absolute top-2 right-2 z-40 px-2 py-1.5 ${t.surface} border ${t.border} shadow-lg ${t.textDim}`}
            >
              <FindBar
                find={pdfFind}
                placeholder="Find in PDF…"
                inputClassName={t.input}
              />
            </div>
          )}

          {/* Tool sidebar */}
          <ToolSidebar
            tools={TOOL_DEFINITIONS}
            activeTool={activeTool}
            onToolChange={handleToolChange}
            tokens={t}
            accent={accent}
          >
            <ToolSidebarToggle
              label="EXPL"
              active={showExplorer}
              onClick={() => setShowExplorer(!showExplorer)}
              tokens={t}
            />
            <ToolSidebarToggle
              label="DATA"
              active={showData}
              onClick={() => setShowData(!showData)}
              tokens={t}
            />
          </ToolSidebar>

          {/* Main area */}
          <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {/* Canvas container - fills available space */}
            <div ref={canvasContainerRef} className="flex-1 relative">
              {/* TEXT MODE */}
              {mode === "text" &&
                (() => {
                  // Calculate centered position for text frame using constrained size
                  const frameLeft =
                    (canvasSize.width - constrainedTextFrameSize.width) / 2;
                  const frameTop =
                    (canvasSize.height - constrainedTextFrameSize.height) / 2;

                  return (
                    <>
                      {/* Doodl canvas with text layer - fills entire area */}
                      <Doodl
                        ref={doodlRef}
                        width={canvasSize.width}
                        height={canvasSize.height}
                        initialTool={initialTool}
                        initialStyle={currentStyle}
                        backgroundColor="transparent"
                        withTextLayer
                        textLayerContent={
                          // Text content positioned absolutely
                          <div
                            ref={textLayerRef}
                            data-text-layer="text-mode"
                            className={`absolute p-8 ${t.textMuted} leading-relaxed ${t.surface} border ${t.border} overflow-auto`}
                            style={{
                              left: frameLeft,
                              top: frameTop,
                              width: constrainedTextFrameSize.width,
                              height: constrainedTextFrameSize.height,
                            }}
                          >
                            {textLayerContent ?? defaultTextContent}
                          </div>
                        }
                        onShapesChange={handleTextShapesChange}
                        onSelectionChange={setSelectedIds}
                        onToolChange={setActiveTool}
                        onStyleChange={setCurrentStyle}
                        onHistoryChange={handleHistoryChange}
                      />

                      {/* Corner resize handles - positioned absolutely in canvas container */}
                      {/* Top-left */}
                      <div
                        className={`absolute w-4 h-4 border-t-2 border-l-2 ${accent.border} cursor-nwse-resize hover:border-amber-400 transition-colors`}
                        style={{
                          left: frameLeft - 8,
                          top: frameTop - 8,
                          zIndex: 50,
                        }}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleResizeStart(
                            "top-left",
                            e as unknown as React.PointerEvent,
                          );
                        }}
                      />
                      {/* Top-right */}
                      <div
                        className={`absolute w-4 h-4 border-t-2 border-r-2 ${accent.border} cursor-nesw-resize hover:border-amber-400 transition-colors`}
                        style={{
                          left: frameLeft + constrainedTextFrameSize.width - 8,
                          top: frameTop - 8,
                          zIndex: 50,
                        }}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleResizeStart(
                            "top-right",
                            e as unknown as React.PointerEvent,
                          );
                        }}
                      />
                      {/* Bottom-left */}
                      <div
                        className={`absolute w-4 h-4 border-b-2 border-l-2 ${accent.border} cursor-nesw-resize hover:border-amber-400 transition-colors`}
                        style={{
                          left: frameLeft - 8,
                          top: frameTop + constrainedTextFrameSize.height - 8,
                          zIndex: 50,
                        }}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleResizeStart(
                            "bottom-left",
                            e as unknown as React.PointerEvent,
                          );
                        }}
                      />
                      {/* Bottom-right */}
                      <div
                        className={`absolute w-4 h-4 border-b-2 border-r-2 ${accent.border} cursor-nwse-resize hover:border-amber-400 transition-colors`}
                        style={{
                          left: frameLeft + constrainedTextFrameSize.width - 8,
                          top: frameTop + constrainedTextFrameSize.height - 8,
                          zIndex: 50,
                        }}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleResizeStart(
                            "bottom-right",
                            e as unknown as React.PointerEvent,
                          );
                        }}
                      />
                      {/* Dimension labels */}
                      <div
                        className={`absolute text-[8px] ${t.textDimmer} tracking-wider pointer-events-none`}
                        style={{
                          left: frameLeft + constrainedTextFrameSize.width / 2,
                          top: frameTop - 20,
                          transform: "translateX(-50%)",
                        }}
                      >
                        {constrainedTextFrameSize.width}px
                      </div>
                      <div
                        className={`absolute text-[8px] ${t.textDimmer} tracking-wider pointer-events-none`}
                        style={{
                          left: frameLeft - 32,
                          top: frameTop + constrainedTextFrameSize.height / 2,
                          transform: "translateY(-50%) rotate(-90deg)",
                        }}
                      >
                        {constrainedTextFrameSize.height}px
                      </div>
                    </>
                  );
                })()}

              {/* PDF MODE */}
              {mode === "pdf" && (
                <div className="absolute inset-0 flex items-start justify-center overflow-auto pt-4">
                  <CanvasFrame
                    tokens={t}
                    accent={accent}
                    widthLabel={widthLabel}
                    heightLabel={heightLabel}
                  >
                    <PdfContent
                      pdfSource={pdfSource}
                      tool={activeTool}
                      style={currentStyle}
                      scale={pdfScale}
                      tokens={t}
                      isDark={isDark}
                      viewMode={pdfViewMode}
                      currentPage={pdfCurrentPage}
                      onPageChange={setPdfCurrentPage}
                      annotations={pdfAnnotations}
                      onAnnotationsChange={handlePdfAnnotationsChange}
                      onShapesChange={handlePdfShapesChange}
                      onHistoryChange={handleHistoryChange}
                      controllerRef={pdfControllerRef}
                      onDimensionsChange={setPdfDimensions}
                      onPdfLoad={handlePdfLoad}
                      mergeHighlights={mergeHighlights}
                      getOverlayShapesForPage={pdfFind.getShapesForPage}
                    />
                  </CanvasFrame>
                </div>
              )}
            </div>

            {/* Style bar */}
            <StyleBar
              style={currentStyle}
              onStyleChange={handleStyleChange}
              tokens={t}
              isDark={isDark}
              className="mt-4"
            />
          </main>

          {/* Right panels */}
          <aside
            className={`relative border-l ${t.border} ${t.surfaceAlt} shrink-0`}
            style={{ width: rightPanelWidth }}
          >
            {/* Resize handle */}
            <div
              className={`absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-amber-400/30 transition-colors z-10 ${isResizingPanel ? (isDark ? "bg-amber-400/50" : "bg-orange-500/50") : ""}`}
              onMouseDown={handlePanelResizeStart}
            />

            {/* Shape Explorer panel */}
            {showExplorer && (
              <ShapeExplorer
                shapes={mode === "text" ? explorerShapes : undefined}
                shapesByPage={mode === "pdf" ? pdfAnnotations : undefined}
                textLayerSelector={
                  mode === "pdf"
                    ? ".react-pdf__Page__textContent"
                    : "[data-text-layer]"
                }
                selectedIds={selectedIds}
                scale={mode === "pdf" ? pdfScale : 1}
                tokens={t}
                isDark={isDark}
                onShapeSelect={(id) => {
                  if (mode === "text") {
                    doodlRef.current?.doodl?.select([id]);
                  } else {
                    pdfControllerRef.current?.select([id]);
                  }
                  setSelectedIds([id]);
                }}
                onShapeRemove={(id) => {
                  if (mode === "text") {
                    doodlRef.current?.doodl?.removeShape(id);
                  } else {
                    pdfControllerRef.current?.removeShape(id);
                  }
                }}
              />
            )}

            {/* Marker FX panel */}
            {showMarker && (
              <Panel
                title="MARKER FX"
                tokens={t}
                action={{ label: "RESET", onClick: resetMarkerSettings }}
              >
                <div className="space-y-3">
                  {[
                    {
                      key: "waveAmplitude",
                      label: "WAVE",
                      min: 0,
                      max: 5,
                      step: 0.5,
                    },
                    {
                      key: "edgeSegments",
                      label: "EDGE",
                      min: 2,
                      max: 20,
                      step: 1,
                    },
                    {
                      key: "endTaper",
                      label: "TAPER",
                      min: 0,
                      max: 1,
                      step: 0.1,
                    },
                    {
                      key: "capsuleRatio",
                      label: "CAPS",
                      min: 0,
                      max: 1,
                      step: 0.1,
                    },
                    {
                      key: "glowOpacity",
                      label: "GLOW",
                      min: 0,
                      max: 1,
                      step: 0.1,
                    },
                    {
                      key: "mainOpacity",
                      label: "MAIN",
                      min: 0,
                      max: 1,
                      step: 0.1,
                    },
                  ].map(({ key, label, min, max, step }) => (
                    <div key={key} className="flex items-center gap-2">
                      <span className={`text-[9px] ${t.textDimmer} w-10`}>
                        {label}
                      </span>
                      <input
                        type="range"
                        min={min}
                        max={max}
                        step={step}
                        value={markerConfig[key as keyof MarkerSettings]}
                        onChange={(e) =>
                          updateMarkerSetting(
                            key as keyof MarkerSettings,
                            parseFloat(e.target.value),
                          )
                        }
                        className={`flex-1 h-0.5 ${isDark ? "bg-zinc-800" : "bg-stone-300"} appearance-none cursor-pointer
                        [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-1.5 [&::-webkit-slider-thumb]:h-3
                        ${isDark ? "[&::-webkit-slider-thumb]:bg-amber-400" : "[&::-webkit-slider-thumb]:bg-orange-500"} [&::-webkit-slider-thumb]:cursor-pointer`}
                      />
                      <span
                        className={`text-[9px] ${t.textDimmer} tabular-nums w-7 text-right`}
                      >
                        {markerConfig[key as keyof MarkerSettings].toFixed(
                          step < 1 ? 1 : 0,
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </Panel>
            )}

            {/* Data panel */}
            {showData && (
              <Panel
                title="STATE DATA"
                tokens={t}
                action={{ label: "IMPORT", onClick: handleImport }}
              >
                <textarea
                  value={stateJson}
                  onChange={(e) => setStateJson(e.target.value)}
                  className={`w-full h-48 ${t.input} border ${t.border} p-2 text-[9px] ${t.textDim} resize-none focus:outline-none`}
                  spellCheck={false}
                />
              </Panel>
            )}

            {/* Shortcuts */}
            <ShortcutsList
              shortcuts={
                mode === "pdf"
                  ? [...KEYBOARD_SHORTCUTS, ...PDF_KEYBOARD_SHORTCUTS]
                  : KEYBOARD_SHORTCUTS
              }
              tokens={t}
            />
          </aside>
        </div>

        {/* Status bar */}
        <StatusBar items={statusItems} tokens={t} isDark={isDark} />
      </div>
    );
  },
);

DoodleGo.displayName = "DoodleGo";

export default DoodleGo;
