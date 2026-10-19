# @n-uf/doodl-react

React bindings for `@n-uf/doodl`.

## Install

```bash
pnpm add @n-uf/doodl-react @n-uf/doodl react react-dom
```

## Toolbar items

`toToolItems()` maps doodl's annotation tool definitions to generic toolbar items
(`ToolItemLike`, a structural twin of the `ToolItem` used by generic toolbar kits),
with a default stroke icon for each tool (`DRAW_TOOL_ICONS`). `isDrawTool()`
narrows a toolbar id back to a doodl `DrawTool`.

```tsx
import { ToolToolbar } from "@n-uf/harbuz";
import { isDrawTool, toToolItems } from "@n-uf/doodl-react/tool-items";

<ToolToolbar items={toToolItems()} activeId={tool} onChange={(id) => isDrawTool(id) && setTool(id)} />
```

`ToolToolbar` comes from `@n-uf/harbuz`; doodl does not depend on it (or on any
toolbar kit), the item shapes simply match. Any toolbar that renders
`{ id, label, icon, tooltip, shortcut, group }` items works.

Options: `toToolItems(defs?, { only, shortcuts, icons })`. `defs` defaults to
`ANNOTATION_TOOL_DEFINITIONS`; `only` keeps a subset (definition order);
`shortcuts` and `icons` override per tool; `icons: false` drops icons. Icons are
render props `({ active, size }) => ReactNode` on a 24×24 viewBox drawn with
`currentColor`; the highlighter icon fills in while active.

The adapter is also exported from the package root. `useAnnotationShortcuts` and
`getToolTooltip` are deprecated in favor of the generic toolbar's
`useToolShortcuts` and `formatToolTooltip` (from `@n-uf/angiospermae`).

## Shortcuts

Shortcut keys follow `TOOL_CONFIGS` in `@n-uf/doodl`: V select, R rectangle,
O ellipse, P polygon, F freehand, H highlight, T text, M text highlight,
U text unhighlight.
