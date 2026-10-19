# @n-uf/doodl-react

## Unreleased

- Add `toToolItems(defs?, { only, shortcuts, icons })`, `isDrawTool(id)` and the `ToolItemLike` type: an adapter from doodl's annotation tool definitions to generic toolbar items (structurally compatible with `ToolItem` from `@n-uf/angiospermae`, which doodl does not depend on).
- Add `DRAW_TOOL_ICONS`: default 24×24 stroke icons (`currentColor`, render prop with `{ active, size }`) for every `DrawTool`; the highlighter fills in while active.
- Item tooltips are `"<description> (<KEY>)"` (just the description when the shortcut is overridden away); without a description `tooltip` stays unset so the toolbar's default "Label (K)" applies.
- Add the subpath export `@n-uf/doodl-react/tool-items` (also exported from the root). It is a client module (`"use client"`): call it in client components.
- Change the freehand shortcut in `ANNOTATION_TOOL_DEFINITIONS` from `P` to `F`, matching `TOOL_CONFIGS` in `@n-uf/doodl` (`P` stays polygon).
- Deprecate `useAnnotationShortcuts` and `getToolTooltip` in favor of the generic toolbar's `useToolShortcuts` and `formatToolTooltip`; both keep working unchanged. Note that `useAnnotationShortcuts` only ignores Ctrl/Cmd/Alt combos and typing in input/textarea; it does not skip select or contentEditable targets, IME composition, key repeat or `defaultPrevented` events.

## 26.7.0

- Initial extract from `pdf-n-uf` workspace (`@n-uf/doodl-react`) into standalone `@n-uf/doodl-react`.
