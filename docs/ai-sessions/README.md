# AI Session Summaries

Use this directory to keep concise summaries of significant AI-assisted work.

## Summary Template

- Goal:
- Files changed:
- Commands run:
- Decisions made:
- Tests run:
- Open issues:
- Next actions:
- What should be saved to the second brain:

## Previous Sessions

- Goal: Pre-hackathon repo setup for Anonify.
- Files changed: Setup docs, dependency manifest, gitignore, and worktree scripts.
- Commands run: Repository/file inspection, git state checks, and script syntax/guard checks only; no install commands.
- Decisions made: No product features, scaffolding, or dependency installation before hacking starts.
- Tests run: Not available yet because no app exists.
- Open issues: Worktrees require a git repository and committed setup files before creation.
- Next actions: Commit setup, then run the worktree creation script when the team is ready to open parallel work areas.
- What should be saved to the second brain: Anonify started as pre-hackathon setup; implementation starts with mocked organizer event-key demo flow and mock photo review confidence data.

## Implementation Mode Session

- Goal: Switch project guidance from setup-only to demo implementation.
- Files changed: `AGENTS.md`, `README.md`, `context/current-task.md`, `requirements.txt`, `docs/decisions/decisions.md`, and this session log.
- Commands run: File reads, `git status --short`, `git diff`, and `rg` checks.
- Decisions made: Hacking has started; build demo-first with mocks before real integrations.
- Tests run: Not run; documentation-only update.
- Open issues: Main app directory still needs to be adopted or scaffolded.
- Next actions: Build the mocked organizer event-key flow, dashboard tabs, public attendee form, and mocked photo review.
- What should be saved to the second brain: Anonify has moved into implementation mode, with mock-first demo flow as the current task.

## Documentation Alignment Session

- Goal: Align documentation with the current repo structure.
- Files changed: Root docs, task context, backend docs, and Python dependency notes.
- Commands run: Repository/file inspection only; no install commands.
- Decisions made: `clerkApp/` is the canonical Next.js frontend, `backend/` is the canonical Flask + SQLite backend, and `ai_redaction/` is the optional Python region blur helper.
- Tests run: Not applicable for documentation-only changes.
- Open issues: None for documentation alignment.
- Next actions: Keep future feature work inside the canonical app/service directories.
- What should be saved to the second brain: AI/redaction frontend imports resolve inside `clerkApp` through `@/` aliases; real region blur remains separate in `ai_redaction/` on `localhost:8001`.
