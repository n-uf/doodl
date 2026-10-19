/**
 * Annotation Tool Definitions & Utilities
 *
 * Shared logic for annotation tools used across different UI frameworks.
 * Each framework (Kavun, Harbuz) renders these tools with their own styling.
 */

import { useEffect } from "react";
import type { DrawTool } from "@n-uf/doodl";

// =============================================================================
// TYPES
// =============================================================================

/**
 * Annotation tool definition - pure data, no rendering
 */
export interface AnnotationToolDefinition {
  /** Tool identifier (matches DrawTool) */
  id: DrawTool;
  /** Human-readable label */
  label: string;
  /** Keyboard shortcut key */
  shortcut: string;
  /** Optional description for tooltips */
  description?: string;
  /** Tool category for grouping */
  category: "selection" | "highlight" | "shape" | "draw";
}

// =============================================================================
// TOOL DEFINITIONS
// =============================================================================

/**
 * Standard annotation tools available for PDF annotation
 */
export const ANNOTATION_TOOL_DEFINITIONS: AnnotationToolDefinition[] = [
  {
    id: "select",
    label: "Select",
    shortcut: "V",
    description: "Select and move annotations",
    category: "selection",
  },
  {
    id: "text-highlight",
    label: "Highlight",
    shortcut: "M",
    description: "Highlight text with marker",
    category: "highlight",
  },
  {
    id: "text-unhighlight",
    label: "Unhighlight",
    shortcut: "U",
    description: "Remove text highlights",
    category: "highlight",
  },
  {
    id: "rect",
    label: "Rectangle",
    shortcut: "R",
    description: "Draw rectangle shapes",
    category: "shape",
  },
  {
    id: "freehand",
    label: "Pencil",
    shortcut: "P",
    description: "Freehand drawing",
    category: "draw",
  },
];

/**
 * Get tool definition by ID
 */
export function getToolDefinition(
  toolId: DrawTool
): AnnotationToolDefinition | undefined {
  return ANNOTATION_TOOL_DEFINITIONS.find((t) => t.id === toolId);
}

/**
 * Get tools by category
 */
export function getToolsByCategory(
  category: AnnotationToolDefinition["category"]
): AnnotationToolDefinition[] {
  return ANNOTATION_TOOL_DEFINITIONS.filter((t) => t.category === category);
}

// =============================================================================
// KEYBOARD SHORTCUTS HOOK
// =============================================================================

export interface UseAnnotationShortcutsOptions {
  /** Callback when tool changes via shortcut */
  onToolChange: (tool: DrawTool) => void;
  /** Whether shortcuts are enabled (default: true) */
  enabled?: boolean;
  /** Tools to include (default: all) */
  tools?: DrawTool[];
}

/**
 * Hook for annotation tool keyboard shortcuts
 *
 * @example
 * ```tsx
 * useAnnotationShortcuts({
 *   onToolChange: setActiveTool,
 *   enabled: annotationsEnabled,
 * });
 * ```
 */
export function useAnnotationShortcuts({
  onToolChange,
  enabled = true,
  tools,
}: UseAnnotationShortcutsOptions): void {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if typing in input/textarea
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      // Skip if modifier keys are pressed (allow Ctrl+V, etc.)
      if (e.ctrlKey || e.metaKey || e.altKey) {
        return;
      }

      const matchingTool = ANNOTATION_TOOL_DEFINITIONS.find((t) => {
        // Check if tool is in allowed list
        if (tools && !tools.includes(t.id)) return false;
        // Match shortcut (case-insensitive)
        return t.shortcut.toLowerCase() === e.key.toLowerCase();
      });

      if (matchingTool) {
        e.preventDefault();
        onToolChange(matchingTool.id);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onToolChange, enabled, tools]);
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Format shortcut for display (platform-aware)
 */
export function formatShortcut(shortcut: string): string {
  return shortcut.toUpperCase();
}

/**
 * Get tooltip text for a tool
 */
export function getToolTooltip(tool: AnnotationToolDefinition): string {
  return `${tool.label} (${formatShortcut(tool.shortcut)})`;
}

