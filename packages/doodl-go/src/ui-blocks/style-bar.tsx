"use client";

import type { ShapeStyle } from "@n-uf/doodl";
import React from "react";
import type { ThemeTokens } from "../tokens/themes";

export interface StyleBarProps {
  style: ShapeStyle;
  onStyleChange: (updates: Partial<ShapeStyle>) => void;
  tokens: ThemeTokens;
  isDark: boolean;
  className?: string;
}

export const StyleBar: React.FC<StyleBarProps> = ({
  style,
  onStyleChange,
  tokens: t,
  isDark,
  className = "",
}) => {
  const sliderThumb = isDark
    ? "[&::-webkit-slider-thumb]:bg-amber-400"
    : "[&::-webkit-slider-thumb]:bg-orange-500";

  const sliderTrack = isDark ? "bg-zinc-800" : "bg-stone-300";

  return (
    <div
      className={`flex items-center gap-6 py-3 px-4 border ${t.border} ${t.surface}/50 ${className}`}
    >
      <div className={`text-[8px] ${t.textDimmer} tracking-[0.2em]`}>STYLE</div>
      <div className={`h-4 w-px ${t.border.replace("border", "bg")}`} />

      {/* Fill */}
      <label className="flex items-center gap-2 cursor-pointer group">
        <span className={`text-[10px] ${t.textDim}`}>FILL</span>
        <div
          className={`relative w-6 h-6 border ${t.border} group-hover:border-current transition-colors`}
        >
          <div
            className="absolute inset-0.5"
            style={{ backgroundColor: style.fill ?? "#3B82F6" }}
          />
          <input
            type="color"
            value={style.fill ?? "#3B82F6"}
            onChange={(e) => onStyleChange({ fill: e.target.value })}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
        </div>
      </label>

      {/* Fill opacity */}
      <label className="flex items-center gap-2">
        <span className={`text-[10px] ${t.textDim}`}>OPACITY</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={style.fillOpacity ?? 1}
          onChange={(e) =>
            onStyleChange({ fillOpacity: parseFloat(e.target.value) })
          }
          className={`w-16 h-1 ${sliderTrack} appearance-none cursor-pointer
            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:h-4
            ${sliderThumb} [&::-webkit-slider-thumb]:cursor-pointer`}
        />
        <span className={`text-[10px] ${t.textDimmer} tabular-nums w-6`}>
          {((style.fillOpacity ?? 1) * 100).toFixed(0)}%
        </span>
      </label>

      <div className={`h-4 w-px ${t.border.replace("border", "bg")}`} />

      {/* Stroke */}
      <label className="flex items-center gap-2 cursor-pointer group">
        <span className={`text-[10px] ${t.textDim}`}>STROKE</span>
        <div
          className={`relative w-6 h-6 border ${t.border} group-hover:border-current transition-colors`}
        >
          <div
            className="absolute inset-0.5"
            style={{ backgroundColor: style.stroke ?? "#3B82F6" }}
          />
          <input
            type="color"
            value={style.stroke ?? "#3B82F6"}
            onChange={(e) => onStyleChange({ stroke: e.target.value })}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
        </div>
      </label>

      {/* Stroke width */}
      <label className="flex items-center gap-2">
        <span className={`text-[10px] ${t.textDim}`}>WIDTH</span>
        <input
          type="range"
          min="1"
          max="10"
          step="1"
          value={style.strokeWidth ?? 2}
          onChange={(e) =>
            onStyleChange({ strokeWidth: parseFloat(e.target.value) })
          }
          className={`w-16 h-1 ${sliderTrack} appearance-none cursor-pointer
            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:h-4
            ${sliderThumb} [&::-webkit-slider-thumb]:cursor-pointer`}
        />
        <span className={`text-[10px] ${t.textDimmer} tabular-nums w-6`}>
          {style.strokeWidth ?? 2}px
        </span>
      </label>
    </div>
  );
};
