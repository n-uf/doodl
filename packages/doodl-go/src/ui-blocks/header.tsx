"use client";

import React from "react";
import { PDF_ZOOM_PERCENT_BUTTON_CLASS } from "@n-uf/doodl-react-pdf";
import type { ThemeTokens } from "../tokens/themes";

export interface HeaderProps {
  title: string;
  subtitle?: string;
  tokens: ThemeTokens;
  children?: React.ReactNode;
  statusLabel?: string;
  className?: string;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  tokens: t,
  children,
  statusLabel,
  className = "",
}) => {
  return (
    <header
      className={`relative border-b ${t.border} ${t.bg}/90 backdrop-blur-sm ${className}`}
    >
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-6">
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold tracking-tighter">{title}</span>
            {subtitle && (
              <span className={`text-[10px] ${t.textDimmer} tracking-widest`}>
                {subtitle}
              </span>
            )}
          </div>
          {statusLabel && (
            <>
              <div className={`h-4 w-px ${t.border.replace("border", "bg")}`} />
              <div className={`text-[10px] ${t.textDim} tracking-wider`}>
                {statusLabel}
              </div>
            </>
          )}
        </div>
        {children && <div className="flex items-center gap-1">{children}</div>}
      </div>
    </header>
  );
};

export interface ModeToggleProps {
  mode: string;
  modes: Array<{ id: string; label: string }>;
  onModeChange: (mode: string) => void;
  tokens: ThemeTokens;
  accent: { bg: string };
  className?: string;
}

export const ModeToggle: React.FC<ModeToggleProps> = ({
  mode,
  modes,
  onModeChange,
  tokens: t,
  accent,
  className = "",
}) => {
  return (
    <div className={`flex border ${t.border} ${className}`}>
      {modes.map((m) => (
        <button
          key={m.id}
          onClick={() => onModeChange(m.id)}
          className={`px-3 py-1.5 text-[10px] tracking-wider transition-colors ${
            mode === m.id ? `${accent.bg} text-black` : `${t.surfaceHover}`
          }`}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
};

export interface ZoomControlsProps {
  scale: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  tokens: ThemeTokens;
  className?: string;
}

export const ZoomControls: React.FC<ZoomControlsProps> = ({
  scale,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  tokens: t,
  className = "",
}) => {
  return (
    <div className={`flex ${className}`}>
      <button
        onClick={onZoomOut}
        className={`px-2 py-1.5 text-[10px] tracking-wider border ${t.border} ${t.borderHover} ${t.surfaceHover} transition-colors`}
        title="Zoom out"
      >
        −
      </button>
      <button
        onClick={onZoomReset}
        className={`px-2 py-1.5 text-[10px] tracking-wider border-y ${t.border} transition-colors ${PDF_ZOOM_PERCENT_BUTTON_CLASS}`}
        title="Reset zoom"
      >
        {Math.round(scale * 100)}%
      </button>
      <button
        onClick={onZoomIn}
        className={`px-2 py-1.5 text-[10px] tracking-wider border ${t.border} ${t.borderHover} ${t.surfaceHover} transition-colors`}
        title="Zoom in"
      >
        +
      </button>
    </div>
  );
};
