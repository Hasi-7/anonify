# Current Task

Active hackathon implementation for anonify.

## Status

Hacking has started. AI/Redaction mock pipeline is complete.

## Completed

- AI/Redaction mock processing pipeline (`lib/processing/`, `types/`, `mocks/`)
- `processEventPhotos()` is ready for backend and frontend to consume.
- See `docs/ai-sessions/01-mock-processing-pipeline.md` for integration guide.
- Redaction plan abstraction (`lib/processing/redaction-plan.ts`, `mocks/redaction-plan-fixtures.ts`)
- `createRedactionPlan()` / `createRedactionPlans()` bridge detection output to blur instructions.
- See `docs/ai-sessions/02-redaction-plan-region-blur.md` for integration guide.
- Region-based redaction (`ai_redaction/apply_redaction.py`, `lib/processing/apply-redaction.ts`)
- Python helper applies real Gaussian blur once Pillow is installed; TypeScript adapter degrades to mock when helper is unavailable.
- See `docs/ai-sessions/03-region-based-redaction.md` for integration guide.
- FastAPI redaction helper (`ai_redaction/server.py`)
- `GET /health` and `POST /redact` endpoints; run on port 8001 after `pip install -r requirements.txt`.
- Set `REDACTION_API_URL=http://localhost:8001` in `.env` to enable real blur from TypeScript.
- See `docs/ai-sessions/04-redaction-fastapi-helper.md` for integration guide.

## In Progress / Next

- Backend: scaffold Next.js app, add event/attendee/photo models, mock storage.
- Frontend: organizer dashboard tabs, photo review UI, confidence display.
- Integrations: Clerk setup, protected routes, Google Drive mock adapter.
- AI/Redaction: integrate `processEventPhotos()` into backend API route once app is scaffolded.

## Integration Note for Other Teams

```typescript
import { processEventPhotos } from "@/lib/processing/mock-processor"
```

Returns `ProcessingSummary` with per-photo detections, confidence scores, and manual review flags.
Full usage in `docs/ai-sessions/01-mock-processing-pipeline.md`.
