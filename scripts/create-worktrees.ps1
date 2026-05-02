$ErrorActionPreference = "Stop"

$areas = @(
  @{ Name = "frontend"; Branch = "agent/frontend" },
  @{ Name = "backend"; Branch = "agent/backend" },
  @{ Name = "integrations"; Branch = "agent/integrations" },
  @{ Name = "ai-redaction"; Branch = "agent/ai-redaction" }
)

$setupFiles = @(
  "AGENTS.md",
  "README.md",
  "requirements.txt",
  ".gitignore",
  "context/current-task.md",
  "docs/decisions/decisions.md",
  "docs/ai-sessions/README.md",
  "scripts/create-worktrees.sh",
  "scripts/create-worktrees.ps1",
  "scripts/cleanup-worktrees.sh",
  "scripts/cleanup-worktrees.ps1"
)

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
Set-Location $gitRoot

$status = (& git status --porcelain)
if (-not [string]::IsNullOrWhiteSpace(($status -join "`n"))) {
  Write-Host "Uncommitted changes detected. Commit setup first so worktrees are based on the current setup."
  Write-Host ""
  Write-Host "Run:"
  Write-Host "  git status"
  Write-Host "  git add $($setupFiles -join ' ')"
  Write-Host '  git commit -m "Prepare anonify hackathon setup"'
  Write-Host ""
  Write-Host "Then run:"
  Write-Host "  .\scripts\create-worktrees.ps1"
  exit 1
}

$repoName = Split-Path $gitRoot -Leaf
$repoParent = Split-Path $gitRoot -Parent
$worktreeRoot = Join-Path $repoParent "$repoName-worktrees"

New-Item -ItemType Directory -Force -Path $worktreeRoot | Out-Null

Write-Host "Creating anonify worktrees under: $worktreeRoot"

foreach ($area in $areas) {
  $dir = Join-Path $worktreeRoot $area.Name

  if (Test-Path $dir) {
    Write-Host "Skipping $($area.Name): $dir already exists."
    continue
  }

  & git show-ref --verify --quiet "refs/heads/$($area.Branch)"
  $branchExists = $LASTEXITCODE -eq 0

  if ($branchExists) {
    Write-Host "Using existing branch $($area.Branch) for $($area.Name)."
    & git worktree add $dir $area.Branch
  } else {
    Write-Host "Creating branch $($area.Branch) for $($area.Name)."
    & git worktree add -b $area.Branch $dir
  }

  if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to create worktree for $($area.Name)."
    exit $LASTEXITCODE
  }
}

Write-Host ""
Write-Host "Next commands:"
foreach ($area in $areas) {
  $dir = Join-Path $worktreeRoot $area.Name
  Write-Host "  cd `"$dir`""
  Write-Host "  git status"
}
