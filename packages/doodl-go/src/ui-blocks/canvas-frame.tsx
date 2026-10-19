"use client";

import React from "react";
import type { ThemeTokens } from "../tokens/themes";

export interface CanvasFrameProps {
  children: React.ReactNode;
  tokens: ThemeTokens;
  accent: { border: string };
  widthLabel?: string;
  heightLabel?: string;
  className?: string;
}

export const CanvasFrame: React.FC<CanvasFrameProps> = ({
  children,
  tokens: t,
  accent,
  widthLabel,
  heightLabel,
  className = "",
}) => {
  return (
    <div className={`relative ${t.surface} border ${t.border} ${className}`}>
      {/* Corner markers */}
      <div
        className={`absolute -top-1 -left-1 w-3 h-3 border-t-2 border-l-2 ${accent.border}`}
      />
      <div
        className={`absolute -top-1 -right-1 w-3 h-3 border-t-2 border-r-2 ${accent.border}`}
      />
      <div
        className={`absolute -bottom-1 -left-1 w-3 h-3 border-b-2 border-l-2 ${accent.border}`}
      />
      <div
        className={`absolute -bottom-1 -right-1 w-3 h-3 border-b-2 border-r-2 ${accent.border}`}
      />

      {/* Dimension labels */}
      {widthLabel && (
        <div
          className={`absolute -top-5 left-1/2 -translate-x-1/2 text-[8px] ${t.textDimmer} tracking-wider`}
        >
          {widthLabel}
        </div>
      )}
      {heightLabel && (
        <div
          className={`absolute top-1/2 -left-8 -translate-y-1/2 -rotate-90 text-[8px] ${t.textDimmer} tracking-wider`}
        >
          {heightLabel}
        </div>
      )}

      {children}
    </div>
  );
};
