/**
 * Text Highlight Controller
 *
 * Minimal controller for text-highlight tool.
 * Actual selection handling is done by SelectionDriver.
 * This controller exists to satisfy the DrawingController interface.
 */

import type { Bounds, Point } from "../../types/geometry";
import type { DrawModifiers } from "../../types/input";
import type { ShapeStyle } from "../../types/style";
import {
  NO_ACTION,
  type ControllerAction,
  type ControllerContext,
  type DrawingController,
} from "../common/controllers";
import type { DrawShape } from "../common/registry";
import { generateShapeId } from "../common/registry";
import { DEFAULT_TEXT_HIGHLIGHT_STYLE } from "./factory";
import type { TextHighlightShape } from "./types";

/**
 * Text Highlight controller
 *
 * This is a pass-through controller. The actual text selection
 * is handled by SelectionDriver which calls createHighlightFromSelection.
 */
export class TextHighlightController implements DrawingController<DrawShape> {
  private _style: ShapeStyle = { ...DEFAULT_TEXT_HIGHLIGHT_STYLE };
  private _previewRects: Bounds[] = [];

  /* eslint-disable @typescript-eslint/no-unused-vars */ // Parameters prefixed with _ are intentionally unused
  onStart(
    _point: Point,
    style: ShapeStyle,
    _modifiers: DrawModifiers,
    _context: ControllerContext<DrawShape>
  ): ControllerAction<DrawShape> {
    // Store style for highlight creation
    this._style = { ...DEFAULT_TEXT_HIGHLIGHT_STYLE, ...style };
    return NO_ACTION;
  }
  /* eslint-enable @typescript-eslint/no-unused-vars */

  /* eslint-disable @typescript-eslint/no-unused-vars */ // Parameters prefixed with _ are intentionally unused
  onMove(
    _point: Point,
    _modifiers: DrawModifiers
  ): ControllerAction<DrawShape> {
    // Selection tracking is handled by SelectionDriver
    if (this._previewRects.length > 0) {
      return { preview: this._createPreview() };
    }
    return NO_ACTION;
  }
  /* eslint-enable @typescript-eslint/no-unused-vars */

  onEnd(): ControllerAction<DrawShape> {
    this._previewRects = [];
    return { clearPreview: true };
  }

  onCancel(): void {
    this.reset();
  }

  reset(): void {
    this._previewRects = [];
  }

  /**
   * Set preview rects (called by SelectionDriver via Doodl)
   */
  setPreviewRects(rects: Bounds[]): void {
    this._previewRects = rects;
  }

  /**
   * Create a text highlight shape from selection rects
   * Called by Doodl when SelectionDriver emits onSelectionEnd
   */
  createHighlightFromSelection(
    rects: Bounds[],
    text: string,
    style?: ShapeStyle
  ): TextHighlightShape {
    const finalStyle = style ?? this._style;

    return {
      id: generateShapeId(),
      type: "text-highlight",
      rects: rects.map((r) => ({ ...r })),
      text,
      style: { ...finalStyle },
    };
  }

  /**
   * Create preview shape
   */
  private _createPreview(): DrawShape | null {
    if (this._previewRects.length === 0) return null;

    return {
      id: "preview-text-highlight",
      type: "text-highlight",
      rects: this._previewRects,
      text: "",
      style: {
        ...this._style,
        fillOpacity: (this._style.fillOpacity ?? 0.4) * 0.7,
      },
    } as TextHighlightShape;
  }
}

/**
 * Create a new text highlight controller
 */
export function createTextHighlightController(): TextHighlightController {
  return new TextHighlightController();
}
