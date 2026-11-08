# Contributing to doodl

This guide is for **contributors** working on the `@n-uf/doodl*` packages.

## Repository layout

```
packages/doodl/            Canvas drawing and annotation library
packages/doodl-react/      React bindings
packages/doodl-react-pdf/  PDF annotation components
packages/doodl-go/         Ready-to-use UI shell
apps/web/                  Showcase / docs site
_agent/                    Contributor architecture notes
```

## Dev / test / build

Root scripts use [Turborepo](https://turbo.build) (`turbo run …`). Package `package.json` scripts remain the tasks turbo invokes.

```bash
pnpm install
pnpm dev
pnpm typecheck
pnpm test
pnpm check
pnpm build:packages
pnpm build
```

## Tool definitions, shortcuts and toolbars

- `TOOL_CONFIGS` in `packages/doodl/src/tools.ts` is the canonical shortcut table.
  `ANNOTATION_TOOL_DEFINITIONS` (doodl-react) and `TOOL_DEFINITIONS` / `TOOL_KEYMAP`
  (doodl-go) must use the same keys; tests in both packages check this.
- Generic toolbars (for example `ToolToolbar` from `@n-uf/harbuz`) render
  `toToolItems()` from `@n-uf/doodl-react/tool-items`:

  ```tsx
  <ToolToolbar items={toToolItems()} activeId={tool} onChange={(id) => isDrawTool(id) && setTool(id)} />
  ```

  doodl does not depend on `@n-uf/angiospermae`, `@n-uf/harbuz` or `@n-uf/kavun`, and
  they do not depend on doodl: `ToolItemLike` is a local structural twin of their
  `ToolItem`. Do not add an import in either direction.
- The adapter and its icons (`DRAW_TOOL_ICONS`) live in doodl-react. Keep
  `@n-uf/doodl` minimal: no UI code or new dependencies there.

## Versioning

Use calendar versioning `YY.M.R` (see `_agent/versioning-policy.md`). The four
packages always share one version, kept in their `package.json` files.

- `pnpm release:next-version` prints the next version; `pnpm version:bump` writes it
  to all four `packages/*/package.json` (`scripts/calendar-version-bump.mjs`). Prefer
  them over a hand-typed version: `M` is always the release month, never "the last
  month + 1".
- Never reuse a version that was published and then removed; record it in
  `BURNED_VERSIONS` in `scripts/calendar-version-bump.mjs`.

## Releasing

Releases run in CI (`.github/workflows/release.yml`), not from a laptop. A release PR
bumps the version (`pnpm version:bump`) and adds the CHANGELOG entries; merging it to
`main` (usually as part of the develop → main promotion) publishes that version of all
four packages to **npmjs** (public, with provenance) and to **GitHub Packages**, and
tags it `v<version>`. Merges without a bump publish nothing. A release that failed
part-way: "Run workflow" on `main` (Actions → Release) publishes the version wherever
it is still missing.

npmjs uses trusted publishing (no stored token): each package's Trusted Publisher on
npmjs.com names this repo and `release.yml`. Pull requests that touch the release
workflow, the bump script or a package manifest get a dry run (check, build and pack;
nothing published).

The workflow has two jobs. `build` (read-only token, no secrets) installs, builds,
typechecks, tests and packs the four packages with `pnpm pack` (which writes the
version over `workspace:*` dependencies). `publish` (main only, the one job with
`id-token`, `packages` and `contents` write) runs no install or build: it checks the
tarballs against `build`'s checksum and publishes them, npmjs first, then GitHub
Packages, each where the version is missing and not older than that registry's
`latest`.

Consumers install from npmjs with no setup. GitHub Packages consumers need an
`@n-uf:registry=https://npm.pkg.github.com` line and a token with `read:packages` in
their `.npmrc`.

## Live source for consumers (HMR)

Every `exports` entry has an `@n-uf/source` condition (a custom name, so generic `source` handling in other tools never picks it up) pointing at the TypeScript source
(`packages/*/index.ts`, `src/...`). Bundlers and Node ignore it (and the targets are not in the tarball), so published builds
resolve to `dist/` as before. A consuming app can opt in to editing doodl live:
pdf-n-uf's `scripts/local-lib-links.mjs` (`LOCAL_LIB_REPOS=/path/to/doodl`)
aliases each package to the `@n-uf/source` file. Keep `@n-uf/source` in sync when adding an entry.

## License

PolyForm Perimeter 1.0.1 — see `LICENSE`.
