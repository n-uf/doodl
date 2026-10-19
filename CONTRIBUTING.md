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
gh workflow run release.yml --repo n-uf/doodl --ref <branch-or-tag>            # next calendar version
gh workflow run release.yml --repo n-uf/doodl --ref <ref> -f dry_run=true      # build + test + publish --dry-run
gh workflow run release.yml --repo n-uf/doodl --ref <ref> -f version=26.10.1   # explicit version
```

Pull requests that touch the release workflow or package manifests run it as a dry run.

The workflow (`.github/workflows/release.yml`) has two jobs. `verify` (read-only token)
builds, typechecks, tests, resolves one version for all four packages and runs
`pnpm publish --dry-run`. `publish` (only for tag pushes and non-dry dispatches, the only
job with `packages: write`) refuses to run unless the commit is on `develop` or `main`,
then runs `pnpm publish` (which rewrites `workspace:*` dependencies to the concrete
version) with the built-in `GITHUB_TOKEN`.
Consumers need an `@n-uf:registry=https://npm.pkg.github.com` line and a token with
`read:packages` in their `.npmrc`.

## Live source for consumers (HMR)

Every `exports` entry has an `@n-uf/source` condition (a custom name, so generic `source` handling in other tools never picks it up) pointing at the TypeScript source
(`packages/*/index.ts`, `src/...`). Bundlers and Node ignore it (and the targets are not in the tarball), so published builds
resolve to `dist/` as before. A consuming app can opt in to editing doodl live:
pdf-n-uf's `scripts/local-lib-links.mjs` (`LOCAL_LIB_REPOS=/path/to/doodl`)
aliases each package to the `@n-uf/source` file. Keep `@n-uf/source` in sync when adding an entry.

## License

PolyForm Perimeter 1.0.1 — see `LICENSE`.
