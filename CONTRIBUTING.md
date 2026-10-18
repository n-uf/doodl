# Contributing to doodl

This guide is for **contributors** working on the `@n-uf/pdf-doodl*` packages.

## Repository layout

```
packages/pdf-doodl/            Core canvas engine
packages/pdf-doodl-react/      React bindings
packages/pdf-doodl-pdf-react/  PDF annotation components
packages/pdf-doodl-go/         Ready-to-use UI shell
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

## Versioning

Use calendar versioning `YY.M.R` (see `_agent/versioning-policy.md`).
Each publishable package has `scripts/calendar-version-bump.mjs` and a `release` script.

## Releasing

All `@n-uf/*` packages are published to **GitHub Packages**
(`https://npm.pkg.github.com`, set via `publishConfig.registry`), because one npm
scope maps to one registry. Releases run in CI, not from a laptop:

```bash
# From any ref: tag the commit, the tag is the version
git tag v26.10.1 <commit> && git push origin v26.10.1

# Or dispatch it (GitHub lists dispatchable workflows only once they are on main)
gh workflow run release.yml --repo n-uf/pdf-doodl --ref <branch-or-tag>            # next calendar version
gh workflow run release.yml --repo n-uf/pdf-doodl --ref <ref> -f dry_run=true      # build + test + publish --dry-run
gh workflow run release.yml --repo n-uf/pdf-doodl --ref <ref> -f version=26.10.1   # explicit version
```

Pull requests that touch the release workflow or package manifests run it as a dry run.

The workflow (`.github/workflows/release.yml`) builds, typechecks and tests, sets one
version on all four packages, and runs `pnpm publish` (which rewrites `workspace:*`
dependencies to the concrete version) with the built-in `GITHUB_TOKEN`.
Consumers need an `@n-uf:registry=https://npm.pkg.github.com` line and a token with
`read:packages` in their `.npmrc`.

## Live source for consumers (HMR)

Every `exports` entry has a `source` condition pointing at the TypeScript source
(`packages/*/index.ts`, `src/...`). Bundlers and Node ignore it, so published builds
resolve to `dist/` as before. A consuming app can opt in to editing doodl live:
pdf-n-uf's `scripts/local-lib-links.mjs` (`LOCAL_LIB_REPOS=/path/to/pdf-doodl`)
aliases each package to the `source` file. Keep `source` in sync when adding an entry.

## License

PolyForm Perimeter 1.0.1 — see `LICENSE`.
