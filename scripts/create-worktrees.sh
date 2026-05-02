#!/usr/bin/env bash
set -euo pipefail

areas=("frontend" "backend" "integrations" "ai-redaction")
branches=("agent/frontend" "agent/backend" "agent/integrations" "agent/ai-redaction")
setup_files=(
  "AGENTS.md"
  "README.md"
  "requirements.txt"
  ".gitignore"
  "context/current-task.md"
  "docs/decisions/decisions.md"
  "docs/ai-sessions/README.md"
  "scripts/create-worktrees.sh"
  "scripts/create-worktrees.ps1"
  "scripts/cleanup-worktrees.sh"
  "scripts/cleanup-worktrees.ps1"
)

if ! git_root="$(git rev-parse --show-toplevel 2>/dev/null)"; then
  echo "Error: run this script from inside a git repository."
  exit 1
fi

cd "$git_root"

if [ -n "$(git status --porcelain)" ]; then
  echo "Uncommitted changes detected. Commit setup first so worktrees are based on the current setup."
  echo ""
  echo "Run:"
  echo "  git status"
  printf "  git add"
  for file in "${setup_files[@]}"; do
    printf " %q" "$file"
  done
  echo ""
  echo "  git commit -m \"Prepare anonify hackathon setup\""
  echo ""
  echo "Then run:"
  echo "  ./scripts/create-worktrees.sh"
  exit 1
fi

repo_name="$(basename "$git_root")"
repo_parent="$(dirname "$git_root")"
worktree_root="$repo_parent/${repo_name}-worktrees"

mkdir -p "$worktree_root"

echo "Creating anonify worktrees under: $worktree_root"

for i in "${!areas[@]}"; do
  area="${areas[$i]}"
  branch="${branches[$i]}"
  dir="$worktree_root/$area"

  if [ -e "$dir" ]; then
    echo "Skipping $area: $dir already exists."
    continue
  fi

  if git show-ref --verify --quiet "refs/heads/$branch"; then
    echo "Using existing branch $branch for $area."
    git worktree add "$dir" "$branch"
  else
    echo "Creating branch $branch for $area."
    git worktree add -b "$branch" "$dir"
  fi
done

echo ""
echo "Next commands:"
for area in "${areas[@]}"; do
  echo "  cd \"$worktree_root/$area\""
  echo "  git status"
done
