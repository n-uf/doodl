import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Prints the next calendar version (YY.M.R) for a release, see
 * _agent/versioning-policy.md. Same rule as packages/*\/scripts/
 * calendar-version-bump.mjs (first release of a month is R=0, then +1), but
 * it also looks at what is already published to the registry, so two
 * releases from different refs in the same month never collide.
 *
 *   node scripts/next-calendar-version.mjs [--registry=https://npm.pkg.github.com]
 *
 * Uses the UTC date. Registry auth comes from the ambient npm config.
 */
const registry =
  process.argv.find((a) => a.startsWith("--registry="))?.slice("--registry=".length) ??
  "https://npm.pkg.github.com";

const pkgsDir = join(import.meta.dirname, "..", "packages");
const names = [];
const known = [];
for (const dir of readdirSync(pkgsDir)) {
  const pkg = JSON.parse(readFileSync(join(pkgsDir, dir, "package.json"), "utf8"));
  if (pkg.private) continue;
  names.push(pkg.name);
  known.push(pkg.version);
}

for (const name of names) {
  try {
    const out = execFileSync("npm", ["view", name, "versions", "--json", `--registry=${registry}`], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    const parsed = JSON.parse(out || "[]");
    known.push(...(Array.isArray(parsed) ? parsed : [parsed]));
  } catch (err) {
    const text = `${err.stdout ?? ""}${err.stderr ?? ""}`;
    if (!/E404|404 Not Found/.test(text)) throw err; // first publish: nothing there yet
  }
}

const now = new Date();
const year = now.getUTCFullYear() % 100;
const month = now.getUTCMonth() + 1;

let next = 0;
for (const v of known) {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(v));
  if (m && Number(m[1]) === year && Number(m[2]) === month) next = Math.max(next, Number(m[3]) + 1);
}
console.log(`${year}.${month}.${next}`);
