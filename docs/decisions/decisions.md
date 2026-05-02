# Decision Log

## 2026-05-02 Initial Pre-Hackathon Decisions

- Project name is anonify.
- Hacking has not started.
- Only setup/docs/worktree/dependency manifest work is allowed now.
- Clerk is for organizer auth only.
- Attendees do not need accounts.
- Each event has a unique event key.
- Event keys route attendee submissions to the correct event.
- Admin UI includes Overview, Opt-Out Attendees, Event Photos, Photo Review / Review Queue, and Processing Log.
- Each detection includes confidence.
- Google Drive and Backboard.io are mock-first.
- AI/redaction is mock-first.
- Four work areas are frontend, backend, integrations, and ai-redaction.

## 2026-05-02 AI/Redaction Implementation Decisions

- AI/Redaction mock pipeline is TypeScript-first, no Python dependency required for mock mode.
- `processEventPhotos()` is the single entry point; `USE_REAL_AI` flag swaps mock for real CV.
- Redaction plan layer (`RedactionPlan`, `RedactionBox`) sits above raw detections.
- Plans are derived from `PhotoProcessingResult` — not from raw detector output — so the redaction layer is decoupled from the CV method.
- Detections without a `boundingBox` are excluded from redaction plans; they remain in the processing result for review.
- `reason: "opt_out_match"` maps to `auto_blurred` detections; `reason: "manual_review"` maps to everything else.
- Pre-computed fixture plans (`mocks/redaction-plan-fixtures.ts`) allow frontend zero-compute development.
- Region-based blur uses Python/Pillow (`ai_redaction/apply_redaction.py`); Pillow is already in requirements.txt.
- TypeScript adapter (`lib/processing/apply-redaction.ts`) calls Python helper via HTTP; degrades to mock when helper is unavailable.
- `applyRedactionPlan()` never raises — all failure modes return a structured error result.
- FastAPI helper runs on port 8001 (not 8000) to avoid conflicts with other local services.
- Business-logic failures from `POST /redact` return HTTP 200 with `success: false` — the TypeScript adapter treats non-2xx as network failures, so 200 ensures error details reach the caller.
- CORS is restricted to `localhost:3000` and `localhost:3001` (Next.js dev ports); tighten before any public deployment.
- `server.py` does not need changes when face detection is added — only the upstream coordinate source changes.

## 2026-05-02 Hacking Started

- Hacking has started.
- Product implementation, app scaffolding, dependencies, UI, API routes, models, adapters, and backend logic are allowed.
- The first implementation target is the mocked organizer event-key demo flow with dashboard tabs and mocked photo-review confidence data.
- Real Clerk, Google Drive, Backboard.io, and AI/redaction integrations remain mock-first until the end-to-end demo works.

## 2026-05-02 Auth + API Integration Decisions

- Clerk remains organizer-auth only; attendee routes stay public and event-key scoped.
- Google Drive integration is mock-first and returns photo metadata without requiring OAuth.
- Backboard.io is an optional privacy review assistant, not a face recognition, image storage, biometric matching, or redaction service.
- Backboard receives metadata only and must not receive raw photos, reference selfies, face embeddings, biometric data, secrets, or private `.env` values.
- Missing Google Drive or Backboard configuration must return mock data instead of crashing the app.

## 2026-05-02 Final API Security Architecture

- Middleware is UI-only. It skips all `/api` paths and only protects organizer UI routes via Clerk. No API classification, routing, or security logic lives in middleware.
- API runtime auth has one authority: route wrappers. Public API handlers use `publicApiRoute(handler)`. Organizer API handlers use `organizerApiRoute(handler)`, which calls `requireOrganizerAuth()` and passes `userId` to the handler only after Clerk auth succeeds.
- API contract correctness uses a dual lock: `apiAccess = "public" | "organizer"` declares the contract, and the wrapper defines runtime behavior. Both must agree.
- A build-time validator (`scripts/validate-api-contracts.mjs`) scans all API routes and fails the build if any route is missing `apiAccess`, has an invalid value, exports an unwrapped HTTP handler, or uses a wrapper that does not match the declared access. Mismatch errors report the route path, declared access, expected wrapper, and actual wrapper.
- API contract validation is a mandatory workflow gate for supported paths. `npm run build:safe` is the canonical production build path, `npm run build` delegates to it, `.githooks/pre-commit` blocks commits when validation fails, and GitHub Actions runs `npm run validate:api` before lint plus `npm run build:safe`.
- `next.config.ts` defensively validates normal direct Next build entrypoints and prints an unsafe-entrypoint warning, but it is not a security boundary. Custom build systems or lower-level compiler invocations must explicitly run `npm run validate:api` before producing deployable output.
- There is no `/api/internal/*` layer. Internal logic (Drive, Backboard) lives in `clerkApp/server/integrations/` as server-only TypeScript modules, never exposed as HTTP routes.
- Integration files use `import "server-only"` and live in `clerkApp/server/integrations/`, structurally separated from client code.
- ESLint forbids importing `@/server/integrations` outside `clerkApp/app/api/**` and `clerkApp/server/**`, making the server-only boundary structural instead of purely conventional.
- `requireOrganizerAuth()` in `clerkApp/server/require-organizer.ts` is the underlying Clerk auth helper used only by the organizer route wrapper, returning userId or 401.
