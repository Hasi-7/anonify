$ErrorActionPreference = "Stop"

$areas = @("frontend", "backend", "integrations", "ai-redaction")

$gitRoot = $null
$gitExitCode = 1
try {
  $gitRoot = (& git rev-parse --show-toplevel 2>$null)
  $gitExitCode = $LASTEXITCODE
} catch {
  $gitRoot = $null
  $gitExitCode = 1
}

if ($gitExitCode -ne 0 -or [string]::IsNullOrWhiteSpace($gitRoot)) {
  Write-Host "Error: run this script from inside a git repository."
  exit 1
}

$gitRoot = $gitRoot.Trim()
$repoName = Split-Path $gitRoot -Leaf
$repoParent = Split-Path $gitRoot -Parent
$worktreeRoot = Join-Path $repoParent "$repoName-worktrees"

if (-not (Test-Path $worktreeRoot)) {
  Write-Host "No worktree directory found at: $worktreeRoot"
  exit 0
}

Write-Host "This will remove Anonify worktree directories under:"
Write-Host "  $worktreeRoot"
Write-Host ""
$confirmation = Read-Host "Type DELETE to continue"

if ($confirmation -ne "DELETE") {
  Write-Host "Cleanup cancelled."
  exit 0
}

foreach ($area in $areas) {
  $dir = Join-Path $worktreeRoot $area

  if (-not (Test-Path $dir)) {
    Write-Host "Skipping ${area}: $dir does not exist."
    continue
  }

  Write-Host "Removing worktree: $dir"
  & git worktree remove $dir

  if ($LASTEXITCODE -ne 0) {
    Write-Host "Could not remove $dir automatically. Inspect it manually, then run:"
    Write-Host "  git worktree remove --force `"$dir`""
  }
}

& git worktree prune
Write-Host "Cleanup complete."
