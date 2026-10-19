/**
 * Text Controller
 *
 * Handles text placement - click to place text at position.
 * Opens an inline editor or uses a prompt for text input.
 */

import type { Point } from "../../types/geometry";
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
import {
  DEFAULT_FONT_FAMILY,
  DEFAULT_FONT_SIZE,
  DEFAULT_TEXT_STYLE,
  type TextShape,
} from "./types";

/**
 * Text controller configuration
 */
export interface TextControllerOptions {
  /** Default font size */
  fontSize?: number;
  /** Default font family */
  fontFamily?: string;
  /** Callback to get text content (e.g., prompt or modal) */
  getText?: (position: Point) => string | null;
}

/**
 * Text controller state
 */
interface TextState {
  clickPoint: Point | null;
  style: ShapeStyle | null;
}

/**
 * Text controller - handles text placement
 */
export class TextController implements DrawingController<DrawShape> {
  private _state: TextState = {
    clickPoint: null,
    style: null,
  };

  private _options: Required<TextControllerOptions>;

  constructor(options: TextControllerOptions = {}) {
    this._options = {
      fontSize: options.fontSize ?? DEFAULT_FONT_SIZE,
      fontFamily: options.fontFamily ?? DEFAULT_FONT_FAMILY,
      getText: options.getText ?? this._defaultGetText.bind(this),
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- Parameter prefixed with _ is intentionally unused
  private _defaultGetText(_position: Point): string | null {
    // Default: use browser prompt
    const text = prompt("Enter text:");
    return text?.trim() || null;
  }

  /* eslint-disable @typescript-eslint/no-unused-vars */ // Parameters prefixed with _ are intentionally unused
  onStart(
    point: Point,
    style: ShapeStyle,
    _modifiers: DrawModifiers,
    _context: ControllerContext<DrawShape>
  ): ControllerAction<DrawShape> {
    this._state.clickPoint = { ...point };
    this._state.style = { ...DEFAULT_TEXT_STYLE, ...style };

    // Get text content (sync only for simplicity)
    const result = this._options.getText(point);

    // Handle sync text input
    if (typeof result === "string" && result.length > 0) {
      return this._createTextShape(result);
    }

    this.reset();
    return NO_ACTION;
  }
  /* eslint-enable @typescript-eslint/no-unused-vars */

  /* eslint-disable @typescript-eslint/no-unused-vars */ // Parameters prefixed with _ are intentionally unused
  onMove(
    _point: Point,
    _modifiers: DrawModifiers
  ): ControllerAction<DrawShape> {
    // Text doesn't use drag
    return NO_ACTION;
  }
  /* eslint-enable @typescript-eslint/no-unused-vars */

  onEnd(): ControllerAction<DrawShape> {
    this.reset();
    return NO_ACTION;
  }

  onCancel(): void {
    this.reset();
  }

  reset(): void {
    this._state = {
      clickPoint: null,
      style: null,
    };
  }

  private _createTextShape(text: string): ControllerAction<DrawShape> {
    if (!this._state.clickPoint || !this._state.style) {
      this.reset();
      return NO_ACTION;
    }

    const shape: TextShape = {
      id: generateShapeId(),
      type: "text",
      text,
      x: this._state.clickPoint.x,
      y: this._state.clickPoint.y,
      fontSize: this._options.fontSize,
      fontFamily: this._options.fontFamily,
      textAlign: "left",
      textBaseline: "top",
      style: { ...this._state.style },
    };

    this.reset();

    return {
      addShape: shape,
      setSelection: [shape.id],
    };
  }

  /**
   * Set font size
   */
  setFontSize(size: number): void {
    this._options.fontSize = size;
  }

  /**
   * Set font family
   */
  setFontFamily(family: string): void {
    this._options.fontFamily = family;
  }

  /**
   * Get current font size
   */
  getFontSize(): number {
    return this._options.fontSize;
  }

  /**
   * Get current font family
   */
  getFontFamily(): string {
    return this._options.fontFamily;
  }
}

/**
 * Create a new text controller
 */
export function createTextController(
  options?: TextControllerOptions
): TextController {
  return new TextController(options);
}
