"use client";

import React from "react";

/**
 * Scoped chrome stylesheet: kill browser-native focus outlines on doodl-go
 * buttons/tabs. Host themes already express state via border/fill; divider/
 * ring utilities use box-shadow. React 19 hoists+dedupes `<style href>`.
 */
const DOODL_GO_CHROME_STYLE_HREF: string = "doodl-go-chrome-focus";

const DOODL_GO_CHROME_CSS: string = `
.doodl-go :is(button, [role="tab"], a, summary):focus,
.doodl-go :is(button, [role="tab"], a, summary):focus-visible {
  outline: none;
}
.doodl-go :is(button, [role="tab"], a, summary) {
  -webkit-tap-highlight-color: transparent;
}
`;

export function DoodlGoChromeStyles(): React.ReactElement {
  return (
    <style href={DOODL_GO_CHROME_STYLE_HREF} precedence="default">
      {DOODL_GO_CHROME_CSS}
    </style>
  );
}
