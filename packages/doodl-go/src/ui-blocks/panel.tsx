"use client";

import React from "react";
import type { ThemeTokens } from "../tokens/themes";

export interface PanelProps {
  title: string;
  tokens: ThemeTokens;
  children: React.ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export const Panel: React.FC<PanelProps> = ({
  title,
  tokens: t,
  children,
  action,
  className = "",
}) => {
  return (
    <div className={`border-b ${t.border} ${className}`}>
      <div
        className={`flex items-center justify-between p-3 border-b ${t.border}/50`}
      >
        <span className={`text-[10px] ${t.textMuted} tracking-wider`}>
          {title}
        </span>
        {action && (
          <button
            onClick={action.onClick}
            className={`text-[8px] ${t.textDimmer} hover:${t.textMuted} tracking-wider`}
          >
            {action.label}
          </button>
        )}
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
};

export interface ShortcutsListProps {
  shortcuts: Array<[string, string]>;
  tokens: ThemeTokens;
}

export const ShortcutsList: React.FC<ShortcutsListProps> = ({
  shortcuts,
  tokens: t,
}) => {
  return (
    <div className="p-3">
      <div className={`text-[8px] ${t.textDimmer} tracking-[0.2em] mb-3`}>
        SHORTCUTS
      </div>
      <div className="space-y-1.5 text-[10px]">
        {shortcuts.map(([key, desc]) => (
          <div key={key} className="flex items-center gap-2">
            <span className={`${t.textDim} font-bold min-w-[32px]`}>{key}</span>
            <span className={t.textDimmer}>{desc}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
