<h1 align="center">
  doodl
</h1>
<p align="center">Canvas drawing and annotation for the web</p>

`@n-uf/doodl` is a vanilla-first canvas drawing and annotation library with React,
PDF, and ready-made UI bindings. Shape-centric modules cover rendering,
hit-testing, transforms, and JSON serialization.

Repository: `n-uf/doodl` (renamed from `pdf-doodl`). Each `packages/<name>` folder
publishes `@n-uf/<name>`. `@n-uf/doodl` is framework-agnostic; React support lives in
`@n-uf/doodl-react`, PDF annotation in `@n-uf/doodl-react-pdf`, and the ready-to-use UI
shell in `@n-uf/doodl-go`.

## Quick links

- Documentation homepage: <https://doodl.n-uf.com/> *(pending hosting)*
- Repository: <https://github.com/n-uf/doodl>
- Package READMEs:
  - [`packages/doodl`](packages/doodl/README.md)
  - [`packages/doodl-react`](packages/doodl-react/README.md)
  - [`packages/doodl-react-pdf`](packages/doodl-react-pdf/README.md)
  - [`packages/doodl-go`](packages/doodl-go/README.md)
- GitHub issues: <https://github.com/n-uf/doodl/issues>

## Packages

| Package | Description |
|---|---|
| `@n-uf/doodl` | Vanilla-first canvas drawing and annotation library (framework-agnostic) |
| `@n-uf/doodl-react` | React bindings and page annotation layer |
| `@n-uf/doodl-react-pdf` | PDF annotation viewer/page components |
| `@n-uf/doodl-go` | Ready-to-use drawing UI shell |

## Install

```bash
pnpm add @n-uf/doodl @n-uf/doodl-react react react-dom
```

Optional PDF / UI shells:

```bash
pnpm add @n-uf/doodl-react-pdf @n-uf/doodl-go react-pdf pdfjs-dist
```

`react` and `react-dom` are peer dependencies (version `^19`).

## Repository layout

```
packages/doodl/            Core published package
packages/doodl-react/      React bindings
packages/doodl-react-pdf/  PDF + React bindings
packages/doodl-go/         UI shell
apps/web/                  Showcase / docs site (Next.js)
_agent/                    Contributor architecture notes
```

## Dev / test / build

Turborepo orchestrates workspace tasks (`turbo.json`). Package-level scripts stay the source of truth; root scripts call `turbo run …`.

```bash
pnpm install
pnpm dev              # apps/web showcase
pnpm typecheck
pnpm test
pnpm check            # typecheck + test (via turbo)
pnpm build:packages   # tsup build for all publishable packages
pnpm build            # packages + web
```

## Versioning

Calendar versioning `YY.M.R` — see [`_agent/versioning-policy.md`](_agent/versioning-policy.md).

## License

[PolyForm Perimeter 1.0.1](LICENSE)
