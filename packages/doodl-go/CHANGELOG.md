# @n-uf/doodl-go

## Unreleased

- Fix `useKeyboardShortcuts`: Ctrl/Cmd/Alt combinations (for example Cmd+R, Cmd+P, Cmd+T) no longer switch tools; key auto-repeat, IME composition, already-handled events and typing in input, textarea, select or contentEditable elements are ignored; `preventDefault` is called only when a key selects a tool.
- Add `resolveToolShortcut(event, keymap?)`, the pure check behind the hook, and `isEditableKeyEvent(event)`.
- Fix PDF page navigation keys (arrows, Page Up/Down, Home/End) being captured while typing in a select or contentEditable element (also inside shadow roots).

## 26.7.0

- Initial extract from `pdf-n-uf` workspace (`@n-uf/doodl-go`) into standalone `@n-uf/doodl-go`.
