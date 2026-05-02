# Current Task

Active hackathon implementation for Anonify.

## Status

The project now has canonical app/service boundaries:

- `clerkApp/` for the Next.js frontend.
- `backend/` for the Flask + SQLite backend.
- `ai_redaction/` for the optional Python region blur helper.
- Root docs and scripts for coordination.

Hacking has started. AI/Redaction mock pipeline is complete. Backend API routes, data models, seed data, and tests are implemented.

## Completed

- **Backend (Person 2)**
  - Flask app with CORS.
  - Event, Attendee, Photo, Detection dataclasses.
  - Full CRUD functions with event-scoped isolation.
  - All API routes per contract.
  - Mock seed data with demo event, attendees, photos, and detections.
  - 38 pytest tests all passing.

- **AI/Redaction (Person 4)**
  - AI/Redaction mock processing pipeline (`lib/processing/`, `types/`, `mocks/`).
  - `processEventPhotos()` is ready for backend and frontend to consume.
  - See `docs/ai-sessions/01-mock-processing-pipeline.md` for integration guide.
  - Redaction plan abstraction (`lib/processing/redaction-plan.ts`, `mocks/redaction-plan-fixtures.ts`).
  - `createRedactionPlan()` / `createRedactionPlans()` bridge detection output to blur instructions.
  - See `docs/ai-sessions/02-redaction-plan-region-blur.md` for integration guide.
  - Region-based redaction (`ai_redaction/apply_redaction.py`, `lib/processing/apply-redaction.ts`).
  - Python helper applies real Gaussian blur once Pillow is installed; TypeScript adapter degrades to mock when helper is unavailable.
  - See `docs/ai-sessions/03-region-based-redaction.md` for integration guide.
  - FastAPI redaction helper (`ai_redaction/server.py`).
  - `GET /health` and `POST /redact` endpoints; run on port 8001 after `pip install -r requirements.txt`.
  - Set `REDACTION_API_URL=http://localhost:8001` in `.env` to enable real blur from TypeScript.
  - See `docs/ai-sessions/04-redaction-fastapi-helper.md` for integration guide.

## In Progress / Next

- Frontend: organizer dashboard tabs, photo review UI, confidence display.
- Connect AI pipeline to Backend:
  - Integrate `processEventPhotos()` into backend API route or Next.js API layer.
  - Coordinate with frontend (Person 1) on API contract.

## Completed (Integrations — Person 3)

- Clerk middleware: UI-only auth. Skips all `/api` paths. Protects organizer UI routes.
- API route contract system: every `route.ts` exports `apiAccess = "public" | "organizer"` and exports handlers through the matching runtime route helper.
- Route wrappers are the runtime API auth authority: `publicApiRoute(handler)` for public routes and `organizerApiRoute(handler)` for Clerk-protected organizer routes.
- `apiAccess` is the declared contract; the build-time validator enforces that metadata and wrapper behavior match.
- Build-time validator (`scripts/validate-api-contracts.mjs`) blocks build if any route is missing `apiAccess`, exports an unwrapped HTTP handler, or uses the wrong wrapper for its declared access.
- Mandatory gates: `build:safe` runs API validation before production builds, `npm run build` delegates to `build:safe`, `.githooks/pre-commit` blocks commits on validation failure, and GitHub Actions runs validation before lint/build.
- Defensive backstop: normal direct Next build entrypoints trigger validation from `next.config.ts`, but this is not a security boundary. Unsupported custom build systems must run `npm run validate:api` explicitly.
- ESLint import boundary blocks `@/server/integrations` outside API route handlers and server-only modules.
- Google Drive mock adapter at `clerkApp/server/integrations/google-drive.ts` (server-only).
- Backboard mock adapter at `clerkApp/server/integrations/backboard.ts` (server-only).
- Example API routes: `/api/public/health`, `/api/attend/[eventKey]`, `/api/organizer/events`.
- Docs: `docs/integrations/auth-api-integrations.md`, `docs/decisions/decisions.md` updated.

## Integration Note for Other Teams

AI/redaction frontend imports are now available inside `clerkApp` using `@/` paths. Use the `clerkApp`-local AI files, not root-level copies.

The Python real blur helper remains at the root `ai_redaction/` directory and runs separately on `localhost:8001`.

```ts
// Inside clerkApp
import { processEventPhotos } from "@/lib/processing/mock-processor"
```

Returns `ProcessingSummary` with per-photo detections, confidence scores, and manual review flags. Full usage in `docs/ai-sessions/01-mock-processing-pipeline.md`.

**Integration adapters** (Drive, Backboard) live in `clerkApp/server/integrations/` and are server-only. Import them only from API route handlers or server-only modules:

```typescript
// Inside an API route handler or server-only module ONLY
import { listEventPhotosFromDrive, generatePrivacyReviewSummary } from "@/server/integrations"
```
