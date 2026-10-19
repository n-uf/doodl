"use client";

import type { DrawTool } from "../../../index";
import React from "react";
import type { ThemeTokens } from "../tokens/themes";
import type { ToolDef } from "../tokens/tools";

export interface ToolSidebarProps {
  tools: ToolDef[];
  activeTool: DrawTool;
  onToolChange: (tool: DrawTool) => void;
  tokens: ThemeTokens;
  accent: { bg: string; border: string };
  className?: string;
  children?: React.ReactNode;
}

/**
 * Tool icon component - renders SVG path
 */
const ToolIcon: React.FC<{
  path: string;
  isActive: boolean;
  className?: string;
}> = ({ path, isActive, className = "" }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={`w-7 h-7 ${className}`}
  >
    <path
      d={path}
      fill={isActive ? "currentColor" : "none"}
      fillOpacity={isActive ? 0.2 : 0}
    />
  </svg>
);

export const ToolSidebar: React.FC<ToolSidebarProps> = ({
  tools,
  activeTool,
  onToolChange,
  tokens: t,
  accent,
  className = "",
  children,
}) => {
  return (
    <aside
      className={`w-24 border-r ${t.border} ${t.surfaceAlt} flex flex-col ${className}`}
    >
      <div className={`p-3 border-b ${t.border}`}>
        <div
          className={`text-[9px] ${t.textDimmer} tracking-[0.2em] text-center font-medium`}
        >
          TOOLS
        </div>
      </div>
      <div className="flex-1 p-2 space-y-1.5">
        {tools.map((tool) => {
          const isActive = tool.id === activeTool;
          return (
            <button
              key={tool.id}
              onClick={() => onToolChange(tool.id)}
              className={`
                w-full aspect-square flex flex-col items-center justify-center gap-1.5
                border outline-none transition-all duration-100 rounded-sm
                ${
                  isActive
                    ? `${accent.bg} ${accent.border} text-black`
                    : `${t.border} ${t.borderHover} ${t.surfaceHover}`
                }
              `}
              title={`${tool.label} (${tool.key})`}
            >
              <ToolIcon
                path={tool.icon}
                isActive={isActive}
                className={isActive ? "text-black" : t.textMuted}
              />
              <span
                className={`text-sm font-bold tracking-wide ${isActive ? "text-black/80" : t.textDimmer}`}
              >
                {tool.key}
              </span>
            </button>
          );
        })}
      </div>
      {children && (
        <div className={`p-2 border-t ${t.border} space-y-1.5`}>{children}</div>
      )}
    </aside>
  );
};

export interface ToolSidebarToggleProps {
  label: string;
  active: boolean;
  onClick: () => void;
  tokens: ThemeTokens;
}

export const ToolSidebarToggle: React.FC<ToolSidebarToggleProps> = ({
  label,
  active,
  onClick,
  tokens: t,
}) => (
  <button
    onClick={onClick}
    className={`w-full py-2 text-[8px] tracking-wider border transition-colors ${
      active ? `${t.surfaceActive} ${t.border}` : `${t.border} ${t.borderHover}`
    }`}
  >
    {label}
  </button>
);
