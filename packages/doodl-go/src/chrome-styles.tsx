"use client";

import React from "react";

/**
 * Scoped chrome stylesheet: kill browser-native focus outlines on doodl-go
 * buttons/tabs. Host themes already express state via border/fill; divider/
 * ring utilities use box-shadow. React 19 hoists+dedupes `<style href>`.
 */
const DOODL_GO_CHROME_STYLE_HREF: string = "doodl-go-chrome-focus";

/**
 * Phones only (max-width: 640px), so the desktop look is unchanged for every host: text under 14 px is raised to 14 px, form
 * fields are 16 px (iOS Safari zooms the page on focus below that), buttons, links and selects get 44 px tap targets, range
 * sliders a 44 px hit area around the same thin track, and the header's toolbar wraps instead of running off the screen.
 * The Tailwind size utilities the blocks use are matched by their class names. Absolutely placed labels (the canvas rulers)
 * keep their size. The rules are unlayered, so they win over the host's Tailwind layers.
 */
const PHONE_SMALL_TEXT_SELECTOR: string = [
  "text-[8px]",
  "text-[9px]",
  "text-[10px]",
  "text-[11px]",
  "text-[12px]",
  "text-[13px]",
]
  .map((c) => `[class*="${c}"]`)
  .concat('[class~="text-xs"]')
  .map((s) => `.doodl-go ${s}:not(.absolute)`)
  .join(",\n  ");

const DOODL_GO_PHONE_CSS: string = `
@media (max-width: 640px) {
  ${PHONE_SMALL_TEXT_SELECTOR} {
    font-size: 14px;
    line-height: 1.35;
  }
  .doodl-go :is(input:not([type="range"], [type="checkbox"], [type="radio"], [type="color"], [type="file"]), textarea, select) {
    font-size: 16px !important;
  }
  .doodl-go .doodl-go-toolbar > .w-px {
    display: none;
  }
  .doodl-go :is(button, [role="tab"], a, summary, select) {
    min-width: 44px;
    min-height: 44px;
  }
  .doodl-go input[type="range"] {
    box-sizing: content-box;
    width: 96px;
    height: 4px;
    padding: 20px 0;
    background-clip: content-box;
  }
  .doodl-go input[type="range"]::-webkit-slider-thumb {
    width: 20px;
    height: 28px;
  }
  .doodl-go .doodl-go-header-row {
    flex-wrap: wrap;
    gap: 8px 12px;
    padding: 12px 16px;
  }
  .doodl-go :is(.doodl-go-header-tools, .doodl-go-toolbar) {
    flex-wrap: wrap;
    row-gap: 4px;
  }
  .doodl-go .doodl-go-header-tools {
    width: 100%;
  }
}
`;

const DOODL_GO_CHROME_CSS: string = `
.doodl-go :is(button, [role="tab"], a, summary):focus,
.doodl-go :is(button, [role="tab"], a, summary):focus-visible {
  outline: none;
}
.doodl-go :is(button, [role="tab"], a, summary) {
  -webkit-tap-highlight-color: transparent;
}
${DOODL_GO_PHONE_CSS}`;

export function DoodlGoChromeStyles(): React.ReactElement {
  return (
    <style href={DOODL_GO_CHROME_STYLE_HREF} precedence="default">
      {DOODL_GO_CHROME_CSS}
    </style>
  );
}
