"use client";

import { type DrawTool, isEditableKeyboardTarget } from "@n-uf/doodl";
import { useEffect } from "react";
import { TOOL_KEYMAP } from "../tokens/tools";

export interface UseKeyboardShortcutsOptions {
  onToolChange?: (tool: DrawTool) => void;
  enabled?: boolean;
}

/** The parts of a `KeyboardEvent` the tool shortcut check reads. */
export type ToolShortcutKeyEvent = Pick<
  KeyboardEvent,
  | "key"
  | "ctrlKey"
  | "metaKey"
  | "altKey"
  | "repeat"
  | "isComposing"
  | "defaultPrevented"
  | "target"
> & { composedPath?: () => EventTarget[] };

/**
 * Resolve the tool a key press selects, or `null` when the press is not a
 * tool shortcut. Ignored: Ctrl/Cmd/Alt combos (browser and OS shortcuts such
 * as Cmd+R, Cmd+P, Cmd+T), auto-repeat, IME composition, events another
 * handler already claimed, and typing in input, textarea, select or
 * contentEditable elements (also inside shadow roots).
 */
export function resolveToolShortcut(
  e: ToolShortcutKeyEvent,
  keymap: Readonly<Record<string, DrawTool>> = TOOL_KEYMAP
): DrawTool | null {
  if (e.defaultPrevented || e.repeat || e.isComposing) return null;
  if (e.ctrlKey || e.metaKey || e.altKey) return null;

  const target = e.composedPath?.()[0] ?? e.target;
  if (isEditableKeyboardTarget(target)) return null;

  const key = typeof e.key === "string" ? e.key.toLowerCase() : "";
  if (!Object.prototype.hasOwnProperty.call(keymap, key)) return null;
  return keymap[key] ?? null;
}

export function useKeyboardShortcuts(
  options: UseKeyboardShortcutsOptions
): void {
  const { onToolChange, enabled = true } = options;

  useEffect(() => {
    if (!enabled || !onToolChange) return;

    const handleKeyDown = (e: KeyboardEvent): void => {
      const tool = resolveToolShortcut(e);
      if (!tool) return;
      e.preventDefault();
      onToolChange(tool);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onToolChange, enabled]);
}
