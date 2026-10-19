"use client";

import React from "react";
import type { ThemeTokens } from "../tokens/themes";

// =============================================================================
// TYPES
// =============================================================================

export interface SegmentedToggleOption<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedToggleProps<T extends string> {
  /** Options to display */
  options: SegmentedToggleOption<T>[];
  /** Current selected value */
  value: T;
  /** Change handler */
  onChange: (value: T) => void;
  /** Theme tokens */
  tokens: ThemeTokens;
  /** Dark mode flag */
  isDark: boolean;
  /** Additional class name */
  className?: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function SegmentedToggle<T extends string>({
  options,
  value,
  onChange,
  tokens,
  isDark,
  className = "",
}: SegmentedToggleProps<T>): React.ReactElement {
  const accentBg = isDark ? "bg-amber-400" : "bg-orange-500";

  return (
    <div className={`flex border ${tokens.border} ${className}`}>
      {options.map((option) => {
        const isActive = option.value === value;
        return (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            className={`px-3 py-1.5 text-[10px] tracking-wider outline-none transition-colors ${
              isActive ? `${accentBg} text-black` : tokens.surfaceHover
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

