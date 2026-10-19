# @n-uf/doodl-go

Ready-to-use UI shell for doodl canvas drawing and PDF annotation.

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
