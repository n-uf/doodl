# @n-uf/doodl

Vanilla-first canvas drawing and annotation library.

> [!CAUTION]
> ## Not yet stable
>
> **@n-uf/doodl is young and still changing. Its API and the saved-drawing JSON (the `DrawingState` document and its
> `version` field) are not final.**
>
> Version numbers are dates (YY.M.R), not semantic versions, so any release may break things, including
> saved drawings that need converting. Pin an exact version and read the
> [CHANGELOG](https://github.com/n-uf/doodl/blob/main/packages/doodl/CHANGELOG.md) before you upgrade. If you need a
> stable drawing canvas, use [Excalidraw](https://github.com/excalidraw/excalidraw).

## Install

```bash
pnpm add @n-uf/doodl
```

## Quick start

```ts
import { createDoodl } from "@n-uf/doodl";

const doodl = createDoodl({ canvas: canvasElement });
```

See the [repository README](../../README.md) for package graph and docs links.
