# Recognition Client Stub

## Goal

Create a frontend-safe TypeScript helper for the optional local `/match-photo` recognition endpoint without wiring it into the UI or replacing the existing mock AI pipeline.

## Files Changed

- `clerkApp/lib/processing/recognition-client.ts`
- `docs/ai-sessions/11-recognition-client-stub.md`

## Exported Function

- `matchPhotoWithReferences(input): Promise<ApiResult<PhotoProcessingResult>>`

## Example Usage

```ts
import { matchPhotoWithReferences } from "@/lib/processing/recognition-client"

const result = await matchPhotoWithReferences({
  eventId: "event_demo_001",
  photoId: "photo_001",
  photoImagePath: "tmp/group-photo.jpg",
  originalImageUrl: "tmp/group-photo.jpg",
  optedOutAttendees: [
    {
      attendeeId: "attendee_001",
      attendeeName: "Maya Chen",
      referenceImagePath: "tmp/maya-reference.jpg",
      referenceImageUrl: "tmp/maya-reference.jpg",
    },
  ],
})

if (!result.ok) {
  // Helper is missing, unreachable, or returned a non-OK response.
  console.warn(result.error)
} else {
  console.log(result.data)
}
```

## Decisions Made

- `REDACTION_API_URL` defaults to `http://127.0.0.1:8001` for local helper usage.
- The helper refuses non-local recognition URLs before `fetch`; only `localhost` and `127.0.0.1` hosts are allowed for privacy.
- The helper returns `{ ok: false, error }` instead of throwing when the endpoint is unavailable.
- The helper does not call `apply-redaction.ts`, does not modify the mock pipeline, and is not imported by UI files.
- This remains experimental local face matching for controlled demo images only. It is not production-grade facial recognition, creates no persistent embeddings, makes no external API calls, and sends no images to third-party APIs.

## Local URL Guard

Manual URL expectations:

- Default `http://127.0.0.1:8001` passes.
- `http://127.0.0.1:8001` passes.
- `http://localhost:8001` passes.
- `https://example.com` fails before any request is sent with `Recognition helper URL must be localhost/127.0.0.1 for privacy.`

## Tests Run

- `npm run lint` passed with existing warnings in UI/mock files.
- `npm run build:safe` passed.

## Open Issues

- The helper is intentionally not wired into frontend UI or the default demo flow.

## Next Actions

- If the recognition spike becomes part of a demo path, add a separate opt-in adapter that preserves the existing mock flow as the default.

## What Should Be Saved To The Second Brain

- Anonify now has an isolated optional TypeScript client for the local `/match-photo` endpoint, but the canonical demo still uses the existing mock AI and redaction plan pipelines by default.
