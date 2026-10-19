/**
 * Text extraction for text shapes
 *
 * Text shapes store user-entered text directly in the shape.
 * No DOM lookup required - just return the stored text.
 */

import type { ExtractedText, TextExtractor } from "../common/types/text-extract";
import type { TextShape } from "./types";

/**
 * Extract text from a text shape
 *
 * Returns the text property directly (user-entered text).
 */
export const extractText: TextExtractor<TextShape> = (shape): ExtractedText => ({
  content: shape.text,
  source: "shape-property",
});

