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

## Backend AI Processing Bridge Session

- Goal: Connect the working frontend upload/review flow to the Flask backend and local AI redaction helper.
- Files changed: `backend/app.py`, `backend/ai_processing.py`, `backend/models.py`, `backend/tests/test_api.py`, `clerkApp/components/anonify-experience.tsx`, `clerkApp/lib/api/backend-client.ts`, `clerkApp/lib/api/backend-types.ts`, `.gitignore`, `docs/decisions/decisions.md`, and `context/current-task.md`.
- Commands run: `npm.cmd run validate:api`, `npm.cmd run lint`, `npm.cmd run build:safe`, `py -m pip install -r requirements.txt`, and `py -m pytest backend/tests`.
- Decisions made: Flask now has a demo processing endpoint that calls only local AI helper URLs, persists detections, and keeps generated upload/runtime files ignored.
- Tests run: Backend pytest suite passed with 42 tests. Next API validation passed. Lint passed with existing warnings. `build:safe` passed.
- Open issues: Real recognition still needs the FastAPI helper running separately on `localhost:8001`; quality depends on local model/helper readiness and attendee reference images.
- Next actions: Start the Flask backend and AI helper together for a live demo, then submit real opt-out reference photos before uploading event photos.
- What should be saved to the second brain: The frontend/backend/AI path is now `registerEventPhoto()` -> Flask `/process` -> local `/match-photo` -> local `/redact` -> persisted backend detections -> dashboard review model.

## Push to Main & Conflict Resolution Session

- **Goal**: Resolve merge conflicts and push the completed integration and AI processing changes to `main`.
- **Files changed**: `backend/tests/test_api.py`, `clerkApp/components/anonify-experience.tsx`, `docs/ai-sessions/13-push-to-main-summary.md`, `docs/ai-sessions/README.md`.
- **Commands run**: `git status`, `git add .`, `git rebase --continue`, `npm run build:safe`, `git push origin main`.
- **Decisions made**: Resolved conflicts by keeping both sets of tests in the backend and merging imports in the frontend. Verified with a safe build before pushing.
- **Tests run**: `build:safe` passed (API validation, TypeScript, and Next.js build).
- **Open issues**: None for this push.
- **Next actions**: Live demo walkthrough.
- **What should be saved to the second brain**: The integration architecture and AI processing flow are now merged into `main` and verified with a build-time validation gate.
