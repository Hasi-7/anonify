# Auth + API Integrations Session

## Goal

Add mock-first integration contracts for Clerk route boundaries, Google Drive photo metadata, and Backboard privacy review summaries.

## Files Changed

- `clerkApp/lib/integrations/types.ts`
- `clerkApp/lib/integrations/google-drive.ts`
- `clerkApp/lib/integrations/backboard.ts`
- `clerkApp/lib/integrations/index.ts`
- `clerkApp/mocks/google-drive-fixtures.ts`
- `clerkApp/mocks/backboard-fixtures.ts`
- `docs/integrations-auth-api.md`
- `docs/ai-sessions/06-auth-api-integrations.md`
- `docs/decisions/decisions.md`

## Backboard Role

Backboard.io is an optional organizer-facing privacy review assistant. It summarizes event review metadata to help organizers understand what still needs manual review.

Backboard should consume metadata only:

- event name
- event key
- photos processed
- opt-out attendee count
- matches found
- photos needing manual review
- detection confidence values
- detection statuses
- photo filenames
- review states

Backboard must not receive raw attendee reference photos, raw event photos, full-resolution images, face embeddings, biometric data, private `.env` values, or any identity data beyond demo attendee display names already shown in the app.

## How To Call The Mock Summary

```ts
import {
  generatePrivacyReviewSummary,
} from "@/lib/integrations"
import { MOCK_PRIVACY_REVIEW_SUMMARY_INPUT } from "@/mocks/backboard-fixtures"

const summary = await generatePrivacyReviewSummary(
  MOCK_PRIVACY_REVIEW_SUMMARY_INPUT,
)
```

If `BACKBOARD_API_KEY`, `BACKBOARD_PROJECT_ID`, or `BACKBOARD_API_URL` is missing, the adapter returns a mock summary with `usedMock: true`.

## Google Drive Call

```ts
import { listEventPhotosFromDrive } from "@/lib/integrations"

const photos = await listEventPhotosFromDrive("event_demo_001")
```

If Google Drive config is missing, the adapter returns mock photo metadata.

## Decisions Made

- Backboard is metadata-only and never receives raw images or biometric artifacts.
- Google Drive and Backboard are optional for the demo.
- Missing external API keys must not crash the app.
- Real Google OAuth and real Backboard API mapping are deferred until the core demo is stable.

## Tests Run

- `npm install`
- `npm run lint`
- `npm run build`

## Open Issues

- `/attend` is marked public by middleware, but no attendee page exists yet.
- Real Backboard API endpoint/response mapping is intentionally a placeholder until the team confirms the API.
- Real Google Drive OAuth/listing is intentionally deferred.

## Next Actions

- Frontend can wire a dashboard button to `generatePrivacyReviewSummary`.
- Frontend can wire photo metadata display to `listEventPhotosFromDrive`.
- Backend/frontend should agree on mapping backend detection statuses into `PrivacyReviewDetection.status`.
