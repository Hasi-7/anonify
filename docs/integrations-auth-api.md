# Auth + API Integrations

This note defines the current auth boundaries and mock-first external integration contracts for anonify.

## Clerk Route Boundaries

Clerk is configured for organizer authentication only.

- `clerkApp/app/layout.tsx` wraps the app in `ClerkProvider`.
- `clerkApp/middleware.ts` protects organizer routes by default.
- Public routes:
  - `/`
  - `/sign-in(.*)`
  - `/sign-up(.*)`
  - `/attend(.*)`
  - `/api(.*)`
- Organizer routes:
  - `/dashboard`
  - Future organizer dashboard/event/review routes unless explicitly added to the public matcher.

Attendees do not need accounts. Keep attendee submission routes public and event-key scoped.

## Google Drive Adapter

Google Drive is mock-first. Do not block the photo grid on real Drive OAuth.

Frontend/server code can call:

```ts
import { listEventPhotosFromDrive } from "@/lib/integrations"

const photos = await listEventPhotosFromDrive("event_demo_001")
```

Behavior:

- Missing Google config returns mock photo metadata.
- Present Google config still returns mock metadata for now; real OAuth/listing is intentionally deferred.
- Returned data is metadata only: IDs, filenames, mime type, status, thumbnails/links if available.
- No raw image bytes are returned by this adapter.

## Backboard.io Role

Backboard.io is an optional organizer-facing privacy review assistant. It summarizes review metadata so organizers can understand what still needs manual review.

Backboard may receive metadata such as:

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

Backboard must not receive:

- raw attendee reference photos
- raw event photos
- full-resolution images
- face embeddings
- biometric data
- private `.env` values
- anything needed to identify people beyond demo attendee display names already shown in the app

Frontend/server code can call:

```ts
import { generatePrivacyReviewSummary } from "@/lib/integrations"

const summary = await generatePrivacyReviewSummary({
  eventId: "event_demo_001",
  eventName: "HuskyHack Demo",
  eventKey: "HUSKY-42F7",
  photosProcessed: 24,
  optOutAttendees: 7,
  matchesFound: 7,
  photosNeedingReview: 4,
  detections: [
    {
      photoId: "photo_001",
      fileName: "group_photo_1.jpg",
      attendeeName: "Jordan Lee",
      confidence: 63,
      status: "manual_review",
    },
  ],
})
```

Behavior:

- Missing Backboard config returns a useful mock summary.
- Backboard request failure returns a mock summary with `usedMock: true` and `error` populated.
- Backboard unavailability never crashes the app.
- The request payload is metadata-only.

## Environment Variables

Do not commit `.env` files or real credentials.

Documented variables:

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_DRIVE_FOLDER_ID=

BACKBOARD_API_KEY=
BACKBOARD_PROJECT_ID=
BACKBOARD_API_URL=

REDACTION_API_URL=http://localhost:8001
```

Missing Google Drive and Backboard keys are safe. The adapters return mocks.

## Current Status

- Clerk provider exists.
- Clerk middleware exists.
- `/dashboard` is protected.
- `/attend` is public by matcher, but no attendee page exists yet in `clerkApp/app`.
- `/api/*` routes are public/unaffected by middleware.
- Google Drive adapter exists at `clerkApp/lib/integrations/google-drive.ts`.
- Backboard adapter exists at `clerkApp/lib/integrations/backboard.ts`.
- Shared integration types exist at `clerkApp/lib/integrations/types.ts`.
