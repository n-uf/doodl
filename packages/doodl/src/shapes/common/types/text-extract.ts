/**
 * Text extraction type definitions
 *
 * Defines the interface for extracting text content from shapes.
 * Each shape module can implement its own extraction strategy.
 */

import type { DrawShape } from "./shape";

// =============================================================================
// TEXT EXTRACTION CONTEXT
// =============================================================================

/**
 * Context provided to text extractors
 *
 * Contains references needed for DOM-based text extraction.
 */
export interface TextExtractionContext {
  /** Text layer DOM element (for DOM-based text lookup) */
  textLayer: HTMLElement | null;
  /** Canvas scale factor */
  scale: number;
  /** Canvas offset relative to text layer */
  offset?: { x: number; y: number };
}

// =============================================================================
// EXTRACTED TEXT RESULT
// =============================================================================

/**
 * Source of extracted text
 */
export type TextSource =
  | "shape-property" // Text stored directly in shape (text, text-highlight)
  | "dom-intersection" // Text computed from DOM intersection (geometric shapes)
  | "none"; // No text available

/**
 * Result of text extraction
 */
export interface ExtractedText {
  /** The extracted text content */
  content: string;
  /** Source of the text */
  source: TextSource;
  /** Whether extraction may be incomplete (e.g., partial intersection) */
  partial?: boolean;
}

// =============================================================================
// TEXT EXTRACTOR FUNCTION TYPE
// =============================================================================

/**
 * Text extractor function signature
 *
 * Each shape module implements this to extract text relevant to the shape.
 *
 * @typeParam T - Concrete shape type extending DrawShape
 */
export type TextExtractor<T extends DrawShape> = (
  shape: T,
  context: TextExtractionContext
) => ExtractedText;

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Empty extraction result (for shapes with no text)
 */
export const EMPTY_EXTRACTED_TEXT: ExtractedText = {
  content: "",
  source: "none",
};

