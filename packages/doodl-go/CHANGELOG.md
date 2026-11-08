# @n-uf/doodl-go

## 26.11.0 — 2026-11-07

- No changes of its own. The first release published from CI: npmjs through trusted publishing, with provenance, and GitHub Packages. All four doodl packages share the version.

## 26.10.3 — 2026-10-19

- Fix `useKeyboardShortcuts`: Ctrl/Cmd/Alt combinations (for example Cmd+R, Cmd+P, Cmd+T) no longer switch tools; key auto-repeat, IME composition, already-handled events and typing in input, textarea, select or contentEditable elements are ignored; `preventDefault` is called only when a key selects a tool.
- Add `resolveToolShortcut(event, keymap?)`, the pure check behind the hook, and `isEditableKeyEvent(event)`.
- Fix PDF page navigation keys (arrows, Page Up/Down, Home/End) being captured while typing in a select or contentEditable element (also inside shadow roots).

## 26.7.0

- Initial extract from `pdf-n-uf` workspace (`@n-uf/doodl-go`) into standalone `@n-uf/doodl-go`.
