#!/usr/bin/env bash
set -euo pipefail

areas=("frontend" "backend" "integrations" "ai-redaction")

if ! git_root="$(git rev-parse --show-toplevel 2>/dev/null)"; then
  echo "Error: run this script from inside a git repository."
  exit 1
fi

repo_name="$(basename "$git_root")"
repo_parent="$(dirname "$git_root")"
worktree_root="$repo_parent/${repo_name}-worktrees"

if [ ! -d "$worktree_root" ]; then
  echo "No worktree directory found at: $worktree_root"
  exit 0
fi

echo "This will remove anonify worktree directories under:"
echo "  $worktree_root"
echo ""
read -r -p "Type DELETE to continue: " confirmation

if [ "$confirmation" != "DELETE" ]; then
  echo "Cleanup cancelled."
  exit 0
fi

for area in "${areas[@]}"; do
  dir="$worktree_root/$area"

  if [ ! -d "$dir" ]; then
    echo "Skipping $area: $dir does not exist."
    continue
  fi

  echo "Removing worktree: $dir"
  if ! git worktree remove "$dir"; then
    echo "Could not remove $dir automatically. Inspect it manually, then run:"
    echo "  git worktree remove --force \"$dir\""
  fi
done

git worktree prune
echo "Cleanup complete."
