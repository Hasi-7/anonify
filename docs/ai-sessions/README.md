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

- Goal: Pre-hackathon repo setup for anonify.
- Files changed: Setup docs, dependency manifest, gitignore, and worktree scripts.
- Commands run: Repository/file inspection, git state checks, and script syntax/guard checks only; no install commands.
- Decisions made: No product features, scaffolding, or dependency installation before hacking starts.
- Tests run: Not available yet because no app exists.
- Open issues: Worktrees require a git repository and committed setup files before creation.
- Next actions: Commit setup, then run the worktree creation script when the team is ready to open parallel work areas.
- What should be saved to the second brain: anonify started as pre-hackathon setup; implementation starts with mocked organizer event-key demo flow and mock photo review confidence data.

## Implementation Mode Session

- Goal: Switch project guidance from setup-only to demo implementation.
- Files changed: `AGENTS.md`, `README.md`, `context/current-task.md`, `requirements.txt`, `docs/decisions/decisions.md`, and this session log.
- Commands run: File reads, `git status --short`, `git diff`, and `rg` checks.
- Decisions made: Hacking has started; build demo-first with mocks before real integrations.
- Tests run: Not run; documentation-only update.
- Open issues: Main app directory still needs to be adopted or scaffolded.
- Next actions: Build the mocked organizer event-key flow, dashboard tabs, public attendee form, and mocked photo review.
- What should be saved to the second brain: anonify has moved into implementation mode, with mock-first demo flow as the current task.

## Current Architecture Snapshot

- Goal: Lock in the auth/API integration architecture and build guardrails for the Next.js app.
- Files changed: `clerkApp/app/api/**`, `clerkApp/server/**`, `clerkApp/scripts/**`, `clerkApp/package.json`, `clerkApp/next.config.ts`, `.githooks/pre-commit`, `.github/workflows/clerkapp-ci.yml`, `docs/integrations/auth-api-integrations.md`, `docs/decisions/decisions.md`, `context/current-task.md`, and README/agent docs.
- Commands run: `npm.cmd run validate:api`, `npm.cmd run lint`, `npm.cmd run build:safe`, `npm.cmd run build`, `npx.cmd next build`, `./node_modules/.bin/next.cmd build`, `npm.cmd run prepare`, and `git hook run pre-commit`.
- Decisions made: Middleware remains UI-only. API auth is enforced by route wrappers. `apiAccess` declares the API contract. `validate-api-contracts.mjs` enforces wrapper/metadata consistency. `build:safe`, CI, and pre-commit hooks are the supported workflow gates. `next.config.ts` is a defensive direct-build backstop, not a security boundary.
- Tests run: Next app validation, lint, safe build, delegated build, direct Next build backstop checks, and pre-commit hook validation.
- Open issues: The app still shows the Next 16 middleware-to-proxy deprecation warning. No app test command exists yet.
- Next actions: Continue the mocked demo flow: organizer dashboard tabs, photo review UI, confidence display, and AI pipeline connection to the Next/API layer.
- What should be saved to the second brain: anonify’s current API security model is dual-lock: wrapper for runtime auth, `apiAccess` for contract declaration, validator for consistency, supported by workflow gates rather than extra middleware logic.

## Documentation Alignment Session

- Goal: Align documentation with the current repo structure.
- Files changed: Root docs, task context, backend docs, and Python dependency notes.
- Commands run: Repository/file inspection only; no install commands.
- Decisions made: `clerkApp/` is the canonical Next.js frontend, `backend/` is the canonical Flask + SQLite backend, and `ai_redaction/` is the optional Python region blur helper.
- Tests run: Not applicable for documentation-only changes.
- Open issues: None for documentation alignment.
- Next actions: Keep future feature work inside the canonical app/service directories.
- What should be saved to the second brain: AI/redaction frontend imports resolve inside `clerkApp` through `@/` aliases; real region blur remains separate in `ai_redaction/` on `localhost:8001`.
