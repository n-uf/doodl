"use client";

/**
 * Doodl - React component for canvas drawing
 *
 * A simple, self-contained drawing canvas component.
 * Supports Figma-like inline text editing.
 */

import {
  createTextShape,
  DEFAULT_FONT_FAMILY,
  DEFAULT_FONT_SIZE,
  getShapeCreationBehavior,
  getToolTargetShape,
  type Doodl as DoodlInstance,
  type DrawShape,
  type DrawTool,
  type Point,
  type ShapeStyle,
  type TextShape,
} from "@n-uf/doodl";
import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useState,
} from "react";
import { TextEditor, type TextEditorState } from "./components";
import { useDoodl, type UseDoodlOptions } from "./use-doodl";

export interface DoodlProps extends UseDoodlOptions {
  /** Canvas width */
  width: number;
  /** Canvas height */
  height: number;
  /** Additional className for canvas */
  className?: string;
  /** Additional styles for canvas */
  style?: React.CSSProperties;
  /** Whether to include a text layer for text-highlight tool */
  withTextLayer?: boolean;
  /** Content to render in text layer (for text-highlight tool) */
  textLayerContent?: React.ReactNode;
  /** Additional className for text layer */
  textLayerClassName?: string;
  /** Additional styles for text layer */
  textLayerStyle?: React.CSSProperties;
}

export interface DoodlRef {
  /** Doodl instance */
  doodl: DoodlInstance | null;
  /** Canvas element */
  canvas: HTMLCanvasElement | null;
  /** Text layer element */
  textLayer: HTMLElement | null;
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

/**
 * Doodl React Component
 *
 * A self-contained canvas drawing component with optional text layer support.
 *
 * @example
 * ```tsx
 * // Basic usage
 * <Doodl width={800} height={600} />
 *
 * // With ref for imperative control
 * const doodlRef = useRef<DoodlRef>(null);
 * <Doodl ref={doodlRef} width={800} height={600} />
 * doodlRef.current?.setTool("rect");
 *
 * // With text layer for highlighting
 * <Doodl
 *   width={800}
 *   height={600}
 *   withTextLayer
 *   textLayerContent={<p>Selectable text...</p>}
 * />
 * ```
 */
export const Doodl = forwardRef<DoodlRef, DoodlProps>(function Doodl(
  {
    width,
    height,
    className = "",
    style: styleProp,
    withTextLayer = false,
    textLayerContent,
    textLayerClassName = "",
    textLayerStyle,
    // UseDoodlOptions
    initialShapes,
    initialTool,
    initialStyle,
    backgroundColor,
    scale = 1,
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
  },
  ref
) {
  const {
    doodl,
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
  } = useDoodl({
    initialShapes,
    initialTool,
    initialStyle,
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
  });

  // =========================================================================
  // TEXT EDITING STATE (Figma-like inline text)
  // =========================================================================

  const [textEditState, setTextEditState] = useState<TextEditorState | null>(
    null
  );

  // Check if text tool is active
  const isTextTool = tool === "text";

  // Determine if current tool requires text selection (shape-centric)
  const isTextSelectionMode = useMemo(() => {
    const targetShape = getToolTargetShape(tool);
    if (!targetShape) return false;
    const behavior = getShapeCreationBehavior(targetShape);
    return behavior.mode === "text-selection";
  }, [tool]);

  // Get canvas point from pointer event
  const getCanvasPoint = useCallback(
    (e: React.PointerEvent | React.MouseEvent): Point => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };

      const rect = canvas.getBoundingClientRect();
      return {
        x: (e.clientX - rect.left) / scale,
        y: (e.clientY - rect.top) / scale,
      };
    },
    [canvasRef, scale]
  );

  // Handle pointer down - intercept BEFORE core doodl handles it for text tool
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      // Only intercept for text tool when not currently editing
      if (!isTextTool || textEditState) return;

      // Prevent the core doodl PointerDriver from handling this
      e.stopPropagation();
      e.preventDefault();

      const point = getCanvasPoint(e);
      setTextEditState({ position: point });
    },
    [isTextTool, textEditState, getCanvasPoint]
  );

  // Handle double-click to edit existing text shape
  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      if (textEditState) return;

      const point = getCanvasPoint(e);

      // Find text shape at this point
      const textShape = shapes.find((s): s is TextShape => {
        if (s.type !== "text") return false;
        const ts = s as TextShape;
        // Simple hit test based on bounds
        const textWidth = ts.text.length * ts.fontSize * 0.6;
        const textHeight = ts.fontSize * 1.2;
        return (
          point.x >= ts.x &&
          point.x <= ts.x + textWidth &&
          point.y >= ts.y &&
          point.y <= ts.y + textHeight
        );
      });

      if (textShape) {
        // Enter edit mode for this shape
        e.stopPropagation();
        e.preventDefault();
        setTextEditState({
          position: { x: textShape.x, y: textShape.y },
          editingShapeId: textShape.id,
          initialText: textShape.text,
        });
        // Remove the shape while editing (will re-add on commit)
        doodl?.removeShape(textShape.id);
      }
    },
    [textEditState, getCanvasPoint, shapes, doodl]
  );

  // Handle text commit
  const handleTextCommit = useCallback(
    (text: string) => {
      if (!textEditState) return;

      // Create new text shape
      const newShape = createTextShape(
        text,
        textEditState.position.x,
        textEditState.position.y,
        {
          fontSize: DEFAULT_FONT_SIZE,
          fontFamily: DEFAULT_FONT_FAMILY,
          style: { ...style },
        }
      );

      doodl?.addShape(newShape);
      setTextEditState(null);
    },
    [textEditState, style, doodl]
  );

  // Handle text cancel
  const handleTextCancel = useCallback(() => {
    // If we were editing an existing shape, restore it
    if (textEditState?.editingShapeId && textEditState.initialText) {
      const restoredShape = createTextShape(
        textEditState.initialText,
        textEditState.position.x,
        textEditState.position.y,
        {
          fontSize: DEFAULT_FONT_SIZE,
          fontFamily: DEFAULT_FONT_FAMILY,
          style: { ...style },
        }
      );
      doodl?.addShape(restoredShape);
    }
    setTextEditState(null);
  }, [textEditState, style, doodl]);

  // =========================================================================
  // IMPERATIVE HANDLE
  // =========================================================================

  // Expose imperative handle
  useImperativeHandle(
    ref,
    () => ({
      doodl,
      canvas: canvasRef.current,
      textLayer: textLayerRef.current,
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
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- canvasRef and textLayerRef are stable refs, don't need to be in deps
    [
      doodl,
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
    ]
  );

  // =========================================================================
  // RENDER
  // =========================================================================

  return (
    <div className="relative" style={{ width, height }}>
      {/* Text layer (optional, for text selection tools) */}
      {withTextLayer && (
        <div
          ref={textLayerRef as React.RefObject<HTMLDivElement>}
          className={`absolute inset-0 overflow-auto ${textLayerClassName}`}
          style={{
            zIndex: 1,
            userSelect: isTextSelectionMode ? "text" : "none",
            cursor: isTextSelectionMode ? "text" : "default",
            ...textLayerStyle,
          }}
        >
          {textLayerContent}
        </div>
      )}

      {/* Canvas */}
      {/* NOTE: Do NOT set width/height attributes here!
          RenderDriver handles canvas buffer sizing with DPR for crisp Retina rendering.
          Setting dimensions here would override DPR-aware sizing and cause blurry rendering. */}
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 ${className}`}
        style={{
          // CSS dimensions for layout (RenderDriver also sets these for DPR)
          width,
          height,
          zIndex: 10,
          pointerEvents: isTextSelectionMode || isTextTool ? "none" : "auto",
          ...styleProp,
        }}
        onDoubleClick={handleDoubleClick}
      />

      {/* Text tool overlay - intercepts clicks before core doodl */}
      {isTextTool && !textEditState && (
        <div
          className="absolute inset-0"
          style={{
            zIndex: 15,
            cursor: "text",
            background: "transparent",
          }}
          onPointerDown={handlePointerDown}
        />
      )}

      {/* Inline Text Editor (Figma-like) */}
      {textEditState && (
        <TextEditor
          position={textEditState.position}
          style={style}
          fontSize={DEFAULT_FONT_SIZE}
          fontFamily={DEFAULT_FONT_FAMILY}
          initialText={textEditState.initialText}
          scale={scale}
          onCommit={handleTextCommit}
          onCancel={handleTextCancel}
          zIndex={20}
        />
      )}
    </div>
  );
});

export default Doodl;
