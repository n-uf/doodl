<h1 align="center">
  doodl
</h1>
<p align="center">Canvas drawing and annotation for the web</p>

`@n-uf/doodl` is a vanilla-first canvas drawing and annotation library with shape
modules, hit-testing, and JSON serialization. React, PDF annotation and a
ready-made UI shell ship in the same package as subpath imports.

Repository: `n-uf/doodl` (renamed from `pdf-doodl`). It publishes one package,
`@n-uf/doodl` (from `packages/doodl`). The root import is framework-agnostic;
React support lives in `@n-uf/doodl/react`, PDF annotation in
`@n-uf/doodl/react-pdf`, and the ready-to-use UI shell in `@n-uf/doodl/go`.

## Quick links

- Documentation homepage: <https://doodl.n-uf.com/> *(pending hosting)*
- Repository: <https://github.com/n-uf/doodl>
- Package README: [`packages/doodl`](packages/doodl/README.md)
- GitHub issues: <https://github.com/n-uf/doodl/issues>

## Package and subpath imports

One package, `@n-uf/doodl`: a vanilla-first canvas drawing and annotation library
with shape modules, hit-testing, and JSON serialization.

| Import path | Description |
|---|---|
| `@n-uf/doodl` | Core library (framework-agnostic) |
| `@n-uf/doodl/react` | React bindings and page annotation layer |
| `@n-uf/doodl/react/styles/text-layer.css` | Text-layer stylesheet for the page annotation layer |
| `@n-uf/doodl/react-pdf` | PDF annotation hooks and types (SSR-safe) |
| `@n-uf/doodl/react-pdf/components` | PDF viewer/page components (browser only) |
| `@n-uf/doodl/react-pdf/hooks` | PDF annotation hooks |
| `@n-uf/doodl/react-pdf/types` | PDF annotation types |
| `@n-uf/doodl/go` | Ready-to-use drawing UI shell |

## Install

```bash
pnpm add @n-uf/doodl
```

React parts:

```bash
pnpm add react react-dom
```

PDF parts and the UI shell:

```bash
pnpm add react react-dom react-pdf pdfjs-dist
```

`react`, `react-dom` (`^19`), `react-pdf` (`^10`) and `pdfjs-dist` (`^5`) are optional
peer dependencies: vanilla users install none of them.

## Repository layout

```
packages/doodl/            The published package (@n-uf/doodl)
  index.ts, src/           Core (vanilla)
  src/react/               @n-uf/doodl/react
  src/react-pdf/           @n-uf/doodl/react-pdf
  src/go/                  @n-uf/doodl/go
apps/web/                  Showcase / docs site (Next.js)
_agent/                    Contributor notes (per-part architecture notes: packages/doodl/_agent/<part>/)
```

## Dev / test / build

Turborepo orchestrates workspace tasks (`turbo.json`). Package-level scripts stay the source of truth; root scripts call `turbo run …`.

```bash
pnpm install
pnpm dev              # apps/web showcase
pnpm typecheck
pnpm test
pnpm check            # typecheck + test (via turbo)
pnpm build:packages   # tsup build for the publishable package
pnpm build            # packages + web
```

## Versioning

Calendar versioning `YY.M.R` — see [`_agent/versioning-policy.md`](_agent/versioning-policy.md).

## License

[PolyForm Perimeter 1.0.1](LICENSE)
