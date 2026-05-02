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
