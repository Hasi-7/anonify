# Anonify Agent Guide

## Project Goal

Anonify is a privacy-first event photo redaction tool. Organizers sign in, create events, share event-specific attendee links or QR codes, collect opt-out submissions, and review event photos where opted-out attendees can be blurred or flagged for manual review.

## Current Structure

- `clerkApp/` is the canonical Next.js frontend app.
- `backend/` is the canonical Flask + SQLite backend.
- `ai_redaction/` is the optional Python redaction helper. It runs separately on `localhost:8001` when real region blur is needed.
- Root docs and scripts coordinate the project.

Do not use root-level frontend AI/redaction copies for new integration work. Frontend imports should use the `clerkApp`-local files and `@/` aliases.

Hacking has started. Product implementation is allowed.

Build the shortest path to a working demo first. Keep changes small, use mocks before real integrations, and avoid chasing production-grade AI or storage until the core flow works end to end.

## Build Rules

- Product features, app scaffolding, API routes, UI components, models, adapters, and backend logic are now allowed.
- Prefer mocked data, mock adapters, and simple in-repo state until the demo flow is clear.
- Configure real Clerk, Google Drive, Backboard.io, and AI integrations only after the mocked demo path works.
- Do not commit secrets, `.env` files, attendee images, or private consent data.
- Keep implementation focused on the current demo task in `context/current-task.md`.

## Future Stack

- Next.js + TypeScript for the main app.
- Clerk for organizer authentication only.
- Optional Python helper for AI/redaction work.
- Google Drive mock adapter first.
- Backboard.io mock adapter first.
- Real integrations only after the core demo works with mocks.

## Commands

- App directory: `clerkApp`.
- App dev command: `cd clerkApp && npm run dev`.
- App build command: `cd clerkApp && npm run build:safe`.
- App validation command: `cd clerkApp && npm run validate:api`.
- App lint command: `cd clerkApp && npm run lint`.
- App test command: not available yet.
- Python helper command: `python ai_redaction/server.py` after `pip install -r requirements.txt` when real blur helper work is needed.

Do not use raw `next build`, `npx next build`, or `node_modules/.bin/next build` as the normal build command. `build:safe` is the canonical production build path and runs API contract validation. Direct Next build entrypoints have a defensive validation backstop in `next.config.ts`, but that is not the primary workflow gate.

Backend commands from `backend/README.md`:

- `cd backend` enters the canonical backend service directory.
- `python -m pip install -r ../requirements.txt` installs shared Python dependencies for backend/helper work.
- `flask --app app run --debug` starts the Flask development server once the backend app module exists.

## Architecture Notes

- Clerk organizer user: authenticated event organizer.
- Event: organizer-owned event workspace.
- Event key: unique public key that routes attendee submissions to the correct event.
- Attendee: public, no-account participant record.
- Consent record: attendee consent or opt-out preference scoped to an event.
- Reference image: optional attendee-provided image for opt-out matching.
- Event photo: uploaded or imported photo associated with an event.
- Detection: region-based possible match/redaction target for an event photo.
- Processing result: original/redacted output state and detection results for a photo.
- Status/audit log: event-scoped record of processing and review activity.

Current auth/API boundaries:

- Middleware is UI-only and skips `/api`.
- API runtime auth is enforced by route wrappers: `publicApiRoute(handler)` and `organizerApiRoute(handler)`.
- API contract declaration is `apiAccess = "public" | "organizer"`.
- `scripts/validate-api-contracts.mjs` enforces that `apiAccess` and wrapper usage match.
- `build:safe`, CI, and `.githooks/pre-commit` are mandatory workflow gates for API contract validation.
- `next.config.ts` is only a defensive backstop for direct Next build commands, not a security boundary.
- Integration adapters live under `clerkApp/server/integrations/` and must only be imported from API routes or server-only modules.

## AI / Redaction Frontend Imports

Inside `clerkApp`, use these imports:

```ts
import { processEventPhotos } from "@/lib/processing/mock-processor"
import { createRedactionPlan } from "@/lib/processing/redaction-plan"
import { applyRedactionPlanMock } from "@/lib/processing/apply-redaction"
import type { RedactionPlan, Detection } from "@/types/ai-redaction"
import { MOCK_REDACTION_PLANS, getMockRedactionPlan } from "@/mocks/redaction-plan-fixtures"
```

The `@/*` alias resolves inside `clerkApp`. The mock path is ready for frontend integration today and does not require API keys or the Python helper.

Real blur is optional and separate: run the helper in `ai_redaction/` on `localhost:8001` when the app needs region-based blur output. This is region-based redaction, not face recognition.

## Demo-First Rule

Keep the shortest path to the core demo working:

- Organizer auth boundary.
- Event creation.
- Event key.
- Public attendee opt-out form.
- Organizer dashboard tabs.
- Mocked photo review with confidence values.
- Original/redacted toggle using placeholder or mock data.

Do not chase real integrations or advanced AI before the demo flow works end to end.

## No-Overengineering Rule

Prefer small, reviewable changes. Use mock adapters and simple data structures first. Add abstractions only when they remove clear duplication or unblock the demo.

## Context Rule

Read `context/current-task.md` before starting work. Keep it current when task boundaries change.

## OpenCode Agents

Use global OpenCode agents where useful:

- `@scout` for codebase exploration and entry points.
- `@review` for correctness, security, maintainability, and edge cases.
- `@test` for focused test planning, writing, running, and debugging.
- `@explain` for architecture or code explanations.

## Decision Log Rule

Record meaningful product, architecture, integration, and scope decisions in `docs/decisions/decisions.md`. Include date, decision, context, and consequence when useful.

## AI Session Summary Rule

After significant AI-assisted work, add a concise summary under `docs/ai-sessions/` or update `docs/ai-sessions/README.md` with:

- Goal.
- Files changed.
- Commands run.
- Decisions made.
- Tests run.
- Open issues.
- Next actions.
