"use client";

import React from "react";

export interface ToolbarProps {
  children: React.ReactNode;
  className?: string;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  children,
  className = "",
}) => {
  return (
    <div className={`flex items-center gap-1 ${className}`}>{children}</div>
  );
};

export interface ToolbarButtonProps {
  onClick?: () => void;
  disabled?: boolean;
  active?: boolean;
  variant?: "default" | "danger" | "success";
  className?: string;
  title?: string;
  children: React.ReactNode;
  tokens: {
    border: string;
    borderHover: string;
    surfaceHover: string;
  };
  isDark?: boolean;
}

export const ToolbarButton: React.FC<ToolbarButtonProps> = ({
  onClick,
  disabled = false,
  active = false,
  variant = "default",
  className = "",
  title,
  children,
  tokens: t,
  isDark = true,
}) => {
  let variantClasses = `${t.border} ${t.borderHover} ${t.surfaceHover}`;

  if (variant === "danger") {
    variantClasses = isDark
      ? "border-red-900/50 text-red-500 hover:bg-red-950 hover:border-red-800"
      : "border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400";
  } else if (variant === "success") {
    variantClasses = isDark
      ? "border-emerald-900/50 text-emerald-500 hover:bg-emerald-950 hover:border-emerald-800"
      : "border-emerald-300 text-emerald-600 hover:bg-emerald-50 hover:border-emerald-400";
  }

  const disabledClasses = isDark
    ? "border-zinc-900 text-zinc-700 cursor-not-allowed"
    : "border-stone-200 text-stone-300 cursor-not-allowed";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-pressed={active || undefined}
      className={`px-3 py-1.5 text-[10px] tracking-wider border outline-none transition-colors ${
        disabled ? disabledClasses : variantClasses
      } ${active ? "bg-zinc-800" : ""} ${className}`}
    >
      {children}
    </button>
  );
};

export interface ToolbarDividerProps {
  tokens: { border: string };
}

export const ToolbarDivider: React.FC<ToolbarDividerProps> = ({ tokens }) => (
  <div className={`w-px h-4 ${tokens.border.replace("border", "bg")} mx-2`} />
);
