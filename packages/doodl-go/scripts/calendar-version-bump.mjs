import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const packageJsonPath = join(scriptDir, "..", "package.json");
const packageJsonRaw = readFileSync(packageJsonPath, "utf8");
const packageJson = JSON.parse(packageJsonRaw);

const versionPattern = /^(\d+)\.(\d+)\.(\d+)$/;
const currentVersion = String(packageJson.version ?? "");
const versionMatch = currentVersion.match(versionPattern);

if (!versionMatch) {
  console.error(
    `Current version \"${currentVersion}\" is not a valid three-segment numeric semver.`
  );
  process.exit(1);
}

const currentYear = Number(versionMatch[1]);
const currentMonth = Number(versionMatch[2]);
const currentPatch = Number(versionMatch[3]);

const now = new Date();
const targetYear = now.getFullYear() % 100;
const targetMonth = now.getMonth() + 1;

const nextPatch =
  currentYear === targetYear && currentMonth === targetMonth
    ? currentPatch + 1
    : 0;
const nextVersion = `${targetYear}.${targetMonth}.${nextPatch}`;

if (process.argv.includes("--dry-run")) {
  console.log(nextVersion);
  process.exit(0);
}

if (!process.argv.includes("--apply")) {
  console.error("Expected --apply or --dry-run");
  process.exit(1);
}

execSync(`npm version ${nextVersion} --no-git-tag-version`, {
  stdio: "inherit",
});
