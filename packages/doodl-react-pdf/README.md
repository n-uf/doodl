# @n-uf/doodl-react-pdf

PDF annotation components and hooks for React.

> [!CAUTION]
> ## Not yet stable
>
> **@n-uf/doodl-react-pdf is young and still changing. Its API and the saved-annotation JSON (the per-page
> `SerializedPageAnnotations` from `usePdfAnnotations`) are not final.**
>
> Version numbers are dates (YY.M.R), not semantic versions, so any release may break things, including
> saved annotations that need converting. Pin an exact version and read the
> [CHANGELOG](https://github.com/n-uf/doodl/blob/main/packages/doodl-react-pdf/CHANGELOG.md) before you upgrade.

## Install

```bash
pnpm add @n-uf/doodl-react-pdf @n-uf/doodl @n-uf/doodl-react react react-dom react-pdf pdfjs-dist
```

Import browser-only components via dynamic import to avoid SSR issues.

## PDF.js worker (CDN)

`react-pdf` needs `pdfjs.GlobalWorkerOptions.workerSrc` set to a worker whose
version matches `pdfjs-dist`. Bundler `?url` worker imports are brittle, so use
the shared helper (version-pinned jsDelivr CDN) instead of hand-rolling the URL:

```ts
import { configureDefaultPdfWorker } from "@n-uf/doodl-react-pdf/components";

configureDefaultPdfWorker(); // idempotent; call once before rendering a PDF
```

It only sets `workerSrc` when unset or still on react-pdf/pdf.js placeholders
like `pdf.worker.mjs` (pass `{ force: true }` to override a real URL, or
`{ version }` to pin a specific build). `pdfWorkerCdnUrl(version?)` returns the
URL without mutating global state.

## Tailwind v4: `@source` class tokens

Exported chrome tokens (`PDF_ZOOM_PERCENT_BUTTON_CLASS`, `PDF_ZOOM_STEP_BUTTON_CLASS`,
`PDF_FIT_CYCLE_BUTTON_CLASS`, `FIND_BAR_*`) are string constants. Tailwind only
emits utilities it sees in scanned files — **importing a constant does not
prevent purge**.

In the host app CSS:

```css
@import "tailwindcss";
@source "../node_modules/@n-uf/doodl-react-pdf/src/**/*.{ts,tsx}";
/* or, for published installs that ship only dist: */
@source "../node_modules/@n-uf/doodl-react-pdf/dist/**/*.{js,mjs,cjs}";
```

Without `@source`, fixed widths (`w-[7ch]`, `size-6`, …) never apply and
toolbar controls stay content-sized.

**Prefer the purge-proof `style` tokens** when hosting under a foreign Tailwind
app: `PDF_ZOOM_PERCENT_BUTTON_STYLE`, `PDF_ZOOM_STEP_BUTTON_STYLE`,
`PDF_FIT_CYCLE_BUTTON_STYLE`, `FIND_BAR_MATCH_COUNT_STYLE`. These set
`width` / `fontVariantNumeric: "tabular-nums"` / monospace inline so ##% vs
###% cannot jump even if utilities are purged.
