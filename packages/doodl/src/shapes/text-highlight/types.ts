/**
 * Text Highlight shape type definitions
 */

import type { Bounds } from "../../types/geometry";
import type { DrawShape } from "../common/registry";

/**
 * Text Highlight shape
 * Represents highlighted text regions from DOM selection
 */
export interface TextHighlightShape extends DrawShape {
  type: "text-highlight";
  /** Multiple rects for multi-line selections */
  rects: Bounds[];
  /** Original text content (for search/export) */
  text: string;
  /** Optional anchor info for re-anchoring */
  anchor?: TextHighlightAnchor;
}

/**
 * Anchor information for re-associating highlight with DOM text
 */
export interface TextHighlightAnchor {
  /** Container element selector or id */
  containerId?: string;
  /** Start character offset in text content */
  startOffset: number;
  /** End character offset in text content */
  endOffset: number;
}
