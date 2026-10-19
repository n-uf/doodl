"use client";

import React from "react";
import type { ThemeTokens } from "../tokens/themes";

export interface StatusBarItem {
  label: string;
  value: string | number;
}

export interface StatusBarProps {
  items: StatusBarItem[];
  tokens: ThemeTokens;
  isDark: boolean;
  status?: "ready" | "busy" | "error";
  className?: string;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  items,
  tokens: t,
  isDark,
  status = "ready",
  className = "",
}) => {
  const statusColor = {
    ready: isDark ? "text-amber-500/60" : "text-orange-500/60",
    busy: isDark ? "text-blue-500/60" : "text-blue-500/60",
    error: isDark ? "text-red-500/60" : "text-red-500/60",
  }[status];

  const statusLabel = {
    ready: "READY",
    busy: "PROCESSING",
    error: "ERROR",
  }[status];

  return (
    <footer
      className={`fixed bottom-0 left-0 right-0 border-t ${t.border} ${t.bg}/95 backdrop-blur-sm ${className}`}
    >
      <div
        className={`flex items-center justify-between px-6 py-2 text-[9px] ${t.textDimmer}`}
      >
        <div className="flex items-center gap-4">
          {items.map((item, i) => (
            <React.Fragment key={item.label}>
              <span>
                {item.label}: <span className={t.textMuted}>{item.value}</span>
              </span>
              {i < items.length - 1 && <span>│</span>}
            </React.Fragment>
          ))}
        </div>
        <div className="flex items-center gap-4">
          <span className={statusColor}>■</span>
          <span>{statusLabel}</span>
        </div>
      </div>
    </footer>
  );
};
