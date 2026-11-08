# @n-uf/doodl

## 26.11.0 — 2026-11-07

- Text highlight works on plain HTML text, not only on PDF text layers; the selection debug logs are gone. (On GitHub Packages since 26.10.4; this is its first npmjs release.)
  - New `SelectionDriverOptions.validateAgainstSpans` (`true | false | "auto"`, default `"auto"`): span validation runs only for PDF.js-style text layers, detected per gesture. PDF behaviour is unchanged.
  - `DragBoundsTracker.setLogging` is deprecated and does nothing (the logs it switched are gone).
- The first release published from CI: npmjs through trusted publishing, with provenance, and GitHub Packages. All four doodl packages share the version.

## 26.7.0

- Initial extract from `pdf-n-uf` workspace (`@n-uf/doodl`) into standalone `@n-uf/doodl`.
