# @n-uf/doodl

## 26.11.1 — 2026-11-13

Behaviour changes first. The API changes are additive only.

- **Area marks extract whole words.** Rect, ellipse, polygon and freehand marks no longer cut text mid-word at their edge ("FTWARE DEVELOPMENT" is now "SOFTWARE DEVELOPMENT").
  - A word is taken whole when at least half its width lies inside the mark; otherwise it is left out.
  - A mark that takes no word that way takes the words it touches on the one line it covers. It needs at least half the line height, or its centre on the line, so a mark that only grazes a line takes nothing.
  - Leading and trailing spaces and `: ; , . ! ?`, dashes, bullets and "…" are trimmed. A single leading `-`, `−` or `.` before a digit or letter stays ("−1,250.00", ".NET").
  - Rotated and slanted text reads in text order.
  - Text highlights and regions keep character-precise extraction.
  - New: `extractTextFromBounds(layer, bounds, scale, offset, { snap: "word" })`. The default stays `"char"`. New types `ExtractTextOptions` and `TextSnapMode`.
- **Text search (`findTextInTextLayer`) finds more real occurrences and no duplicates.**
  - The layer text and the query are normalised alike: NFKC (ligatures), NFC/NFD, NBSP and runs of whitespace (including a newline in the query), soft hyphens, zero-width joiners, and Greek final sigma. Match `text`, `startIndex`, `endIndex` and rects still refer to the original layer text.
  - Overlapping occurrences now come back as one match covering the whole run ("aa" in "aaaa" is one match, 0..4), so every character is covered and none is reported twice. Repeated patterns therefore return fewer matches than before.
  - Word mode uses Unicode letters, numbers and marks, so "Whit" no longer matches inside "Whitéman" and "Иван" no longer matches inside "Иванов". Characters of scripts written without spaces (Han, kana, Hangul, Thai and others) count as boundaries. "_" is now a word character, so "std" no longer matches inside "std_".
  - Zero-width space and BOM are word breaks. A soft hyphen at a line wrap joins the word.
  - Spans are joined by a gap relative to the font height, not a fixed 2px, so matches no longer depend on zoom.
  - The default match mode (`"substring"`) and `maxMatches` (50) are unchanged.
  - New: `findTextInTextLayerDetailed(...)` returns `{ matches, truncated }`, where `truncated` says whether `maxMatches` cut the list short. New type `FindTextResult`.

## 26.11.0 — 2026-11-07

- Text highlight works on plain HTML text, not only on PDF text layers; the selection debug logs are gone. (On GitHub Packages since 26.10.4; this is its first npmjs release.)
  - New `SelectionDriverOptions.validateAgainstSpans` (`true | false | "auto"`, default `"auto"`): span validation runs only for PDF.js-style text layers, detected per gesture. PDF behaviour is unchanged.
  - `DragBoundsTracker.setLogging` is deprecated and does nothing (the logs it switched are gone).
- The first release published from CI: npmjs through trusted publishing, with provenance, and GitHub Packages. All four doodl packages share the version.

## 26.7.0

- Initial extract from `pdf-n-uf` workspace (`@n-uf/doodl`) into standalone `@n-uf/doodl`.
