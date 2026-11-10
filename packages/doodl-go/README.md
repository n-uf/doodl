# @n-uf/doodl-go

Ready-to-use UI shell for doodl canvas drawing and PDF annotation.

> [!CAUTION]
> ## Not yet stable
>
> **@n-uf/doodl-go is young and still changing. Its components, props and styling are not final.**
>
> Version numbers are dates (YY.M.R), not semantic versions, so any release may break things, including
> props and styles that need changes in your code. It has no file format of its own, but the drawings it shows use the
> JSON of `@n-uf/doodl` and `@n-uf/doodl-react-pdf`, which may change too. Pin an exact version and read the
> [CHANGELOG](https://github.com/n-uf/doodl/blob/main/packages/doodl-go/CHANGELOG.md) before you upgrade.

## Install

```bash
pnpm add @n-uf/doodl-go @n-uf/doodl @n-uf/doodl-react @n-uf/doodl-react-pdf react react-dom
```

## Keyboard shortcuts

`useKeyboardShortcuts` switches tools with single keys (V, R, O, P, F, T, M, U,
matching `TOOL_CONFIGS` in `@n-uf/doodl`). It ignores Ctrl/Cmd/Alt combinations
(so Cmd+R, Cmd+P and Cmd+T keep their browser meaning), key auto-repeat, IME
composition, events already handled (`defaultPrevented`) and typing in inputs,
textareas, selects or contentEditable elements, and calls `preventDefault` only
when a key selects a tool. `resolveToolShortcut(event)` exposes the same check.

For a generic toolbar instead of the built-in shell, see `toToolItems()` in
`@n-uf/doodl-react/tool-items`.
