# @n-uf/doodl

Vanilla-first canvas drawing and annotation library with shape modules,
hit-testing, and JSON serialization. One package, several subpath imports:

| Import path | What it is | Needs |
| --- | --- | --- |
| `@n-uf/doodl` | Framework-agnostic core | nothing |
| `@n-uf/doodl/react` | React bindings: canvas component, page annotation layer, document annotation helpers | `react`, `react-dom` |
| `@n-uf/doodl/react/styles/text-layer.css` | Text-layer stylesheet for the page annotation layer | `react` parts |
| `@n-uf/doodl/react-pdf` | PDF annotation hooks and types (SSR-safe) | `react`, `react-dom`, `react-pdf`, `pdfjs-dist` |
| `@n-uf/doodl/react-pdf/components` | PDF viewer and page components (browser only) | same as above |
| `@n-uf/doodl/react-pdf/hooks` | PDF annotation hooks | same as above |
| `@n-uf/doodl/react-pdf/types` | PDF annotation types | same as above |
| `@n-uf/doodl/go` | Ready-to-use drawing UI shell | same as above |

`react`, `react-dom`, `react-pdf` and `pdfjs-dist` are optional peer
dependencies: vanilla users install none of them, and each part only needs the
peers it imports.

## Install

```bash
pnpm add @n-uf/doodl
# React parts
pnpm add react react-dom
# PDF parts and the UI shell
pnpm add react react-dom react-pdf pdfjs-dist
```

## `@n-uf/doodl` (core)

```ts
import { createDoodl } from "@n-uf/doodl";

const doodl = createDoodl({ canvas: canvasElement });
```

## `@n-uf/doodl/react`

React bindings for the core: the `Doodl` canvas component, `useDoodl`, the page
annotation layer and controller, and multi-page document annotation helpers.

```tsx
import { Doodl } from "@n-uf/doodl/react";
import "@n-uf/doodl/react/styles/text-layer.css"; // when using the page annotation layer
```

## `@n-uf/doodl/react-pdf`

PDF annotation components and hooks for React.

```bash
pnpm add react react-dom react-pdf pdfjs-dist
```

Import browser-only components (`@n-uf/doodl/react-pdf/components`) via dynamic
import to avoid SSR issues. The main `@n-uf/doodl/react-pdf` entry only exports
hooks and types, which are safe on the server.

### PDF.js worker (CDN)

`react-pdf` needs `pdfjs.GlobalWorkerOptions.workerSrc` set to a worker whose
version matches `pdfjs-dist`. Bundler `?url` worker imports are brittle, so use
the shared helper (version-pinned jsDelivr CDN) instead of hand-rolling the URL:

```ts
import { configureDefaultPdfWorker } from "@n-uf/doodl/react-pdf/components";

configureDefaultPdfWorker(); // idempotent; call once before rendering a PDF
```

It only sets `workerSrc` when unset or still on react-pdf/pdf.js placeholders
like `pdf.worker.mjs` (pass `{ force: true }` to override a real URL, or
`{ version }` to pin a specific build). `pdfWorkerCdnUrl(version?)` returns the
URL without mutating global state.

### Tailwind v4: `@source` class tokens

Exported chrome tokens (`PDF_ZOOM_PERCENT_BUTTON_CLASS`, `PDF_ZOOM_STEP_BUTTON_CLASS`,
`PDF_FIT_CYCLE_BUTTON_CLASS`, `FIND_BAR_*`) are string constants. Tailwind only
emits utilities it sees in scanned files — **importing a constant does not
prevent purge**.

In the host app CSS:

```css
@import "tailwindcss";
@source "../node_modules/@n-uf/doodl/src/**/*.{ts,tsx}";
/* or, for published installs that ship only dist: */
@source "../node_modules/@n-uf/doodl/dist/**/*.{js,mjs,cjs}";
```

Without `@source`, fixed widths (`w-[7ch]`, `size-6`, …) never apply and
toolbar controls stay content-sized.

**Prefer the purge-proof `style` tokens** when hosting under a foreign Tailwind
app: `PDF_ZOOM_PERCENT_BUTTON_STYLE`, `PDF_ZOOM_STEP_BUTTON_STYLE`,
`PDF_FIT_CYCLE_BUTTON_STYLE`, `FIND_BAR_MATCH_COUNT_STYLE`. These set
`width` / `fontVariantNumeric: "tabular-nums"` / monospace inline so ##% vs
###% cannot jump even if utilities are purged.

## `@n-uf/doodl/go`

Ready-to-use UI shell for doodl canvas drawing and PDF annotation.

```tsx
import { DoodleGo } from "@n-uf/doodl/go";
```

Requires `react`, `react-dom`, `react-pdf` and `pdfjs-dist`.

See the [repository README](../../README.md) for the workspace layout and docs links.
