import { chmodSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = resolve(import.meta.dirname, "..", "..");
const hooksDir = join(repoRoot, ".githooks");
const preCommitHook = join(hooksDir, "pre-commit");

if (!existsSync(join(repoRoot, ".git"))) {
  console.log("[hooks] Skipping git hook setup: .git directory not found.");
  process.exit(0);
}

if (!existsSync(hooksDir)) {
  console.log("[hooks] Skipping git hook setup: .githooks directory not found.");
  process.exit(0);
}

if (existsSync(preCommitHook)) {
  chmodSync(preCommitHook, 0o755);
}

const currentHooksPath = spawnSync("git", ["config", "--get", "core.hooksPath"], {
  cwd: repoRoot,
  encoding: "utf-8",
});

if ((currentHooksPath.stdout ?? "").toString().trim() === ".githooks") {
  console.log("[hooks] Repo git hooks already installed.");
  process.exit(0);
}

const result = spawnSync("git", ["config", "core.hooksPath", ".githooks"], {
  cwd: repoRoot,
  stdio: "inherit",
});

if (result.status !== 0) {
  console.error("[hooks] Failed to configure core.hooksPath=.githooks");
  process.exit(result.status ?? 1);
}

console.log("[hooks] Installed repo git hooks from .githooks.");
