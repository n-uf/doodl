"use client";

import type { DrawTool } from "@n-uf/doodl";
import { useEffect } from "react";
import { TOOL_KEYMAP } from "../tokens/tools";

export interface UseKeyboardShortcutsOptions {
  onToolChange?: (tool: DrawTool) => void;
  enabled?: boolean;
}

export function useKeyboardShortcuts(
  options: UseKeyboardShortcutsOptions
): void {
  const { onToolChange, enabled = true } = options;

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent): void => {
      // Ignore if typing in input/textarea
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      const key = e.key.toLowerCase();
      const tool = TOOL_KEYMAP[key];
      if (tool && onToolChange) {
        onToolChange(tool);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onToolChange, enabled]);
}
