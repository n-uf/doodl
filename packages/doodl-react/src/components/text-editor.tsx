"use client";

/**
 * TextEditor - Inline text editing component for Figma-like text insertion
 *
 * Features:
 * - Contenteditable div positioned at click point
 * - Matches font/style from current drawing settings
 * - Commits on blur, Enter (without Shift), or explicit commit
 * - Cancels on Escape
 * - Supports multiline with Shift+Enter
 */

import type { Point, ShapeStyle } from "@n-uf/doodl";
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

// =============================================================================
// TYPES
// =============================================================================

export interface TextEditorProps {
  /** Position to place the editor (canvas coordinates) */
  position: Point;
  /** Current shape style (for color) */
  style: ShapeStyle;
  /** Font size in pixels */
  fontSize: number;
  /** Font family */
  fontFamily: string;
  /** Font weight */
  fontWeight?: "normal" | "bold" | number;
  /** Font style */
  fontStyle?: "normal" | "italic";
  /** Initial text (for editing existing text shapes) */
  initialText?: string;
  /** Scale factor (for coordinate transformation) */
  scale?: number;
  /** Callback when text is committed */
  onCommit: (text: string) => void;
  /** Callback when editing is cancelled */
  onCancel: () => void;
  /** Additional className */
  className?: string;
  /** Z-index for the editor */
  zIndex?: number;
}

export interface TextEditorState {
  /** Position where editor should appear */
  position: Point;
  /** ID of shape being edited (undefined for new text) */
  editingShapeId?: string;
  /** Initial text content (for editing existing) */
  initialText?: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function TextEditor({
  position,
  style,
  fontSize,
  fontFamily,
  fontWeight = "normal",
  fontStyle = "normal",
  initialText = "",
  scale = 1,
  onCommit,
  onCancel,
  className = "",
  zIndex = 100,
}: TextEditorProps): React.ReactElement {
  const editorRef = useRef<HTMLDivElement>(null);
  const [isComposing, setIsComposing] = useState(false);
  const committedRef = useRef(false);

  // Focus and select all on mount
  useLayoutEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    // Focus the editor
    editor.focus();

    // If there's initial text, select it all
    if (initialText) {
      const range = document.createRange();
      range.selectNodeContents(editor);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    }
  }, [initialText]);

  // Prevent scroll when editor appears
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    // Scroll into view if needed, but gently
    editor.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, []);

  // Commit handler
  const handleCommit = useCallback(() => {
    if (committedRef.current) return;

    const text = editorRef.current?.innerText?.trim() ?? "";
    if (text.length > 0) {
      committedRef.current = true;
      onCommit(text);
    } else {
      onCancel();
    }
  }, [onCommit, onCancel]);

  // Cancel handler
  const handleCancel = useCallback(() => {
    if (committedRef.current) return;
    committedRef.current = true;
    onCancel();
  }, [onCancel]);

  // Blur handler
  const handleBlur = useCallback(() => {
    // Don't commit if we're in the middle of IME composition
    if (isComposing) return;

    // Small delay to allow click events to fire first
    setTimeout(() => {
      if (!committedRef.current) {
        handleCommit();
      }
    }, 100);
  }, [isComposing, handleCommit]);

  // Keyboard handler
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      // Escape cancels
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        handleCancel();
        return;
      }

      // Enter without Shift commits (Shift+Enter creates new line)
      if (e.key === "Enter" && !e.shiftKey && !isComposing) {
        e.preventDefault();
        e.stopPropagation();
        handleCommit();
        return;
      }

      // Prevent event from bubbling to canvas handlers
      e.stopPropagation();
    },
    [isComposing, handleCommit, handleCancel]
  );

  // IME composition handlers (for CJK input)
  const handleCompositionStart = useCallback(() => {
    setIsComposing(true);
  }, []);

  const handleCompositionEnd = useCallback(() => {
    setIsComposing(false);
  }, []);

  // Calculate scaled position
  const scaledX = position.x * scale;
  const scaledY = position.y * scale;

  // Determine text color from style
  const textColor =
    style.fill && style.fill !== "none" ? style.fill : "#000000";

  // Build font weight string
  const fontWeightValue =
    typeof fontWeight === "number" ? fontWeight : fontWeight;

  return (
    <div
      ref={editorRef}
      contentEditable
      suppressContentEditableWarning
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      onCompositionStart={handleCompositionStart}
      onCompositionEnd={handleCompositionEnd}
      className={`outline-none ${className}`}
      style={{
        position: "absolute",
        left: scaledX,
        top: scaledY,
        minWidth: 20,
        minHeight: fontSize * 1.2,
        padding: "2px 4px",
        margin: "-2px -4px", // Offset padding so text aligns with click point
        fontSize: fontSize * scale,
        fontFamily,
        fontWeight: fontWeightValue,
        fontStyle,
        color: textColor,
        background: "transparent",
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        cursor: "text",
        zIndex,
        // Visual feedback that we're in edit mode
        boxShadow: "0 0 0 1px rgba(59, 130, 246, 0.5)",
        borderRadius: 2,
      }}
      // Prevent default drag behavior
      onDragStart={(e) => e.preventDefault()}
      // Prevent mousedown from bubbling to canvas
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {initialText}
    </div>
  );
}

export default TextEditor;
