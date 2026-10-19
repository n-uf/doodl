"use client";

/**
 * ShapeExplorer - Tree view of shapes with extracted text
 *
 * Displays all shapes grouped by type with their associated text content.
 * Text is extracted from shape properties or DOM intersection.
 */

import {
  extractShapeText,
  type DrawShape,
  type ExtractedText,
  type TextExtractionContext,
} from "../../../index";
import {
  getAnnotationTextLayer,
  getAnnotationTextLayersByPage,
  getAnnotationDisplayInfo,
  compareAnnotationTypes,
} from "../../react-pdf";
import React, { useMemo, useState } from "react";
import type { ThemeTokens } from "../tokens/themes";

// =============================================================================
// TYPES
// =============================================================================

/** Per-page annotations map (page number → shapes) */
export type PageAnnotationsMap = Map<number, DrawShape[]>;

export interface ShapeExplorerProps {
  /** All shapes to display (flat array - single page or legacy mode) */
  shapes?: DrawShape[];
  /** Shapes organized by page (preferred for multipage documents) */
  shapesByPage?: PageAnnotationsMap;
  /** CSS selector to find text layer element in DOM */
  textLayerSelector?: string;
  /** Currently selected shape IDs */
  selectedIds: string[];
  /** Canvas scale factor */
  scale: number;
  /** Theme tokens */
  tokens: ThemeTokens;
  /** Whether dark mode is active */
  isDark?: boolean;
  /** Callback when shape is clicked */
  onShapeSelect?: (id: string) => void;
  /** Callback when shape should be removed */
  onShapeRemove?: (id: string) => void;
  /** Additional class name */
  className?: string;
}

interface ShapeWithPage {
  shape: DrawShape;
  text: ExtractedText;
  pageNumber?: number;
}

interface ShapeGroup {
  type: string;
  label: string;
  shapes: ShapeWithPage[];
}

// =============================================================================
// SHAPE TYPE LABELS & ICONS
// =============================================================================

// Use shared utilities from doodl-pdf-react, but keep uppercase labels for UI consistency
function getShapeLabel(type: string): { label: string; icon: string } {
  const info = getAnnotationDisplayInfo(type);
  return {
    label: info.label.toUpperCase(),
    icon: info.icon,
  };
}

// =============================================================================
// SHAPE NODE COMPONENT
// =============================================================================

interface ShapeNodeProps {
  shape: DrawShape;
  text: ExtractedText;
  pageNumber?: number;
  isSelected: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  onSelect: () => void;
  onRemove?: () => void;
  tokens: ThemeTokens;
  isDark: boolean;
}

const ShapeNode: React.FC<ShapeNodeProps> = ({
  shape,
  text,
  pageNumber,
  isSelected,
  isExpanded,
  onToggle,
  onSelect,
  onRemove,
  tokens: t,
  isDark,
}) => {
  const hasText = text.content.length > 0;
  const truncatedId = shape.id.slice(-8);
  const truncatedText =
    text.content.length > 50 ? text.content.slice(0, 50) + "..." : text.content;

  return (
    <div className="flex flex-col">
      {/* Shape row */}
      <div
        className={`group flex items-center gap-1 py-0.5 px-2 cursor-pointer select-none transition-colors duration-100
          ${isSelected ? (isDark ? "bg-zinc-800" : "bg-stone-200") : ""}
          ${!isSelected ? t.surfaceHover : ""}`}
        onClick={onSelect}
      >
        {/* Expand toggle (if has text) */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (hasText) onToggle();
          }}
          className={`w-4 text-[10px] ${t.textDimmer} ${hasText ? "cursor-pointer" : "cursor-default opacity-30"}`}
        >
          {hasText ? (isExpanded ? "▼" : "▶") : "·"}
        </button>

        {/* Page indicator (multipage mode) */}
        {pageNumber !== undefined && (
          <span
            className={`text-[9px] px-1 rounded ${isDark ? "bg-blue-500/20 text-blue-400" : "bg-blue-500/20 text-blue-600"}`}
            title={`Page ${pageNumber}`}
          >
            P{pageNumber}
          </span>
        )}

        {/* Shape ID */}
        <span className={`flex-1 text-[11px] font-mono ${t.textDim} truncate`}>
          {truncatedId}
        </span>

        {/* Text preview badge */}
        {hasText && !isExpanded && (
          <span
            className={`text-[10px] px-1.5 rounded ${isDark ? "bg-zinc-800 text-zinc-500" : "bg-stone-200 text-stone-500"} max-w-[100px] truncate`}
          >
            {truncatedText}
          </span>
        )}

        {/* Source indicator */}
        <span
          className={`text-[9px] ${t.textDimmer} hidden group-hover:inline`}
          title={
            text.source === "shape-property"
              ? "From shape"
              : text.source === "dom-intersection"
                ? "From DOM"
                : "No text"
          }
        >
          {text.source === "shape-property"
            ? "●"
            : text.source === "dom-intersection"
              ? "◐"
              : "○"}
        </span>

        {/* Remove button */}
        {onRemove && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className={`hidden group-hover:flex w-4 h-4 items-center justify-center text-[11px] ${isDark ? "text-red-400 hover:bg-red-400/20" : "text-red-600 hover:bg-red-600/20"} rounded transition-colors`}
            title="Remove shape"
          >
            ×
          </button>
        )}
      </div>

      {/* Expanded text content */}
      {hasText && isExpanded && (
        <div
          className={`ml-6 mr-2 mb-1.5 p-2 rounded text-[11px] ${t.textDim} ${isDark ? "bg-zinc-900" : "bg-stone-100"} border ${t.border} leading-relaxed`}
        >
          {text.content}
        </div>
      )}
    </div>
  );
};

// =============================================================================
// GROUP COMPONENT
// =============================================================================

interface GroupNodeProps {
  group: ShapeGroup;
  isExpanded: boolean;
  expandedShapeIds: Set<string>;
  selectedIds: string[];
  onToggleGroup: () => void;
  onToggleShape: (id: string) => void;
  onSelectShape: (id: string) => void;
  onRemoveShape?: (id: string) => void;
  tokens: ThemeTokens;
  isDark: boolean;
}

const GroupNode: React.FC<GroupNodeProps> = ({
  group,
  isExpanded,
  expandedShapeIds,
  selectedIds,
  onToggleGroup,
  onToggleShape,
  onSelectShape,
  onRemoveShape,
  tokens: t,
  isDark,
}) => {
  const { label, icon } = getShapeLabel(group.type);

  return (
    <div className="flex flex-col">
      {/* Group header */}
      <div
        className={`flex items-center gap-2 py-1.5 px-2 cursor-pointer select-none transition-colors duration-100 ${t.surfaceHover}`}
        onClick={onToggleGroup}
      >
        {/* Expand toggle */}
        <span className={`text-[10px] ${t.textDimmer} w-3`}>
          {isExpanded ? "▼" : "▶"}
        </span>

        {/* Icon */}
        <span
          className={`text-[12px] ${isDark ? "text-amber-400" : "text-orange-500"}`}
        >
          {icon}
        </span>

        {/* Label */}
        <span
          className={`flex-1 text-[11px] font-mono font-medium ${t.textMuted}`}
        >
          {label}
        </span>

        {/* Count badge */}
        <span
          className={`text-[11px] px-1.5 rounded font-mono ${
            isDark
              ? "bg-amber-400/20 text-amber-400"
              : "bg-orange-500/20 text-orange-600"
          }`}
        >
          {group.shapes.length}
        </span>
      </div>

      {/* Children */}
      {isExpanded && (
        <div className={`border-l ${t.border} ml-3`}>
          {group.shapes.map(({ shape, text, pageNumber }) => (
            <ShapeNode
              key={shape.id}
              shape={shape}
              text={text}
              pageNumber={pageNumber}
              isSelected={selectedIds.includes(shape.id)}
              isExpanded={expandedShapeIds.has(shape.id)}
              onToggle={() => onToggleShape(shape.id)}
              onSelect={() => onSelectShape(shape.id)}
              onRemove={
                onRemoveShape ? () => onRemoveShape(shape.id) : undefined
              }
              tokens={t}
              isDark={isDark}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export const ShapeExplorer: React.FC<ShapeExplorerProps> = ({
  shapes,
  shapesByPage,
  textLayerSelector = "[data-text-layer]",
  selectedIds,
  scale,
  tokens: t,
  isDark = true,
  onShapeSelect,
  onShapeRemove,
  className = "",
}) => {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [expandedShapes, setExpandedShapes] = useState<Set<string>>(new Set());

  // Determine if we're in multipage mode
  const isMultipage = shapesByPage !== undefined && shapesByPage.size > 0;

  // Get all shapes as flat array (for counting and expand/collapse all)
  const allShapes = useMemo(() => {
    if (shapesByPage) {
      const all: DrawShape[] = [];
      for (const pageShapes of shapesByPage.values()) {
        all.push(...pageShapes);
      }
      return all;
    }
    return shapes ?? [];
  }, [shapes, shapesByPage]);

  // Group shapes by type and extract text (with page info when available)
  const groups: ShapeGroup[] = useMemo(() => {
    const groupMap = new Map<string, ShapeGroup>();

    // Process shapes with page information if available (multipage mode)
    if (shapesByPage && shapesByPage.size > 0) {
      // Build text layer map for all pages using shared utility
      const textLayersByPage = getAnnotationTextLayersByPage(textLayerSelector);

      // Get sorted page numbers for consistent ordering
      const sortedPages = Array.from(shapesByPage.keys()).sort((a, b) => a - b);

      for (const pageNumber of sortedPages) {
        const pageShapes = shapesByPage.get(pageNumber) ?? [];

        // Get the correct text layer for this page
        const textLayer = textLayersByPage.get(pageNumber) ?? null;
        const extractionContext: TextExtractionContext = {
          textLayer,
          scale,
        };

        for (const shape of pageShapes) {
          const text = extractShapeText(shape, extractionContext);

          if (!groupMap.has(shape.type)) {
            const { label } = getShapeLabel(shape.type);
            groupMap.set(shape.type, {
              type: shape.type,
              label,
              shapes: [],
            });
          }

          groupMap.get(shape.type)!.shapes.push({ shape, text, pageNumber });
        }
      }
    } else if (shapes) {
      // Flat array mode (no page info) - use single text layer
      const extractionContext: TextExtractionContext = {
        textLayer: getAnnotationTextLayer(textLayerSelector),
        scale,
      };

      for (const shape of shapes) {
        const text = extractShapeText(shape, extractionContext);

        if (!groupMap.has(shape.type)) {
          const { label } = getShapeLabel(shape.type);
          groupMap.set(shape.type, {
            type: shape.type,
            label,
            shapes: [],
          });
        }

        groupMap
          .get(shape.type)!
          .shapes.push({ shape, text, pageNumber: undefined });
      }
    }

    // Sort groups by predefined order (using shared utility)
    return Array.from(groupMap.values()).sort((a, b) =>
      compareAnnotationTypes(a.type, b.type)
    );
  }, [shapes, shapesByPage, scale, textLayerSelector]);

  // Toggle handlers
  const toggleGroup = (type: string): void => {
    const next = new Set(expandedGroups);
    if (next.has(type)) next.delete(type);
    else next.add(type);
    setExpandedGroups(next);
  };

  const toggleShape = (id: string): void => {
    const next = new Set(expandedShapes);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedShapes(next);
  };

  // Expand/Collapse all
  const expandAll = (): void => {
    const allGroupTypes = new Set(groups.map((g) => g.type));
    const allShapeIds = new Set(allShapes.map((s) => s.id));
    setExpandedGroups(allGroupTypes);
    setExpandedShapes(allShapeIds);
  };

  const collapseAll = (): void => {
    setExpandedGroups(new Set());
    setExpandedShapes(new Set());
  };

  return (
    <div className={`border-b ${t.border} ${className}`}>
      {/* Header */}
      <div
        className={`flex items-center justify-between p-3 border-b ${t.border}/50`}
      >
        <span className={`text-[12px] ${t.textMuted} tracking-wider`}>
          SHAPES
          {isMultipage && shapesByPage && (
            <span className={`ml-1 text-[10px] ${t.textDimmer}`}>
              ({shapesByPage.size} pages)
            </span>
          )}
        </span>
        <span
          className={`text-[11px] px-1.5 rounded font-mono ${
            isDark
              ? "bg-amber-400/20 text-amber-400"
              : "bg-orange-500/20 text-orange-600"
          }`}
        >
          {allShapes.length}
        </span>
      </div>

      {/* Content */}
      <div className="max-h-72 overflow-auto">
        {groups.length === 0 ? (
          <div className={`p-3 text-[11px] ${t.textDimmer} text-center`}>
            No shapes yet
          </div>
        ) : (
          groups.map((group) => (
            <GroupNode
              key={group.type}
              group={group}
              isExpanded={expandedGroups.has(group.type)}
              expandedShapeIds={expandedShapes}
              selectedIds={selectedIds}
              onToggleGroup={() => toggleGroup(group.type)}
              onToggleShape={toggleShape}
              onSelectShape={(id) => onShapeSelect?.(id)}
              onRemoveShape={onShapeRemove}
              tokens={t}
              isDark={isDark}
            />
          ))
        )}
      </div>

      {/* Footer */}
      {groups.length > 0 && (
        <div
          className={`flex items-center justify-between px-3 py-2 border-t ${t.border}/50`}
        >
          <button
            type="button"
            onClick={expandAll}
            className={`text-[10px] font-mono px-2 py-1 rounded ${t.textDimmer} ${t.surfaceHover} transition-colors`}
          >
            ↓ Expand
          </button>
          <button
            type="button"
            onClick={collapseAll}
            className={`text-[10px] font-mono px-2 py-1 rounded ${t.textDimmer} ${t.surfaceHover} transition-colors`}
          >
            ↑ Collapse
          </button>
        </div>
      )}
    </div>
  );
};

ShapeExplorer.displayName = "ShapeExplorer";
