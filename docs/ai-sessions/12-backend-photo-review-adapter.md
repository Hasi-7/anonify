# Session 12 — Backend Photo Review Adapter

## What was created

`clerkApp/lib/processing/backend-photo-review-adapter.ts`

An isolated, pure-mapping adapter that converts `BackendPhotoDetail` (from the Flask API)
into the `PhotoReviewModel` shape consumed by the dashboard photo review UI.
No network calls, no AI helpers, no imports from recognition-client.

## Exports

| Function | Purpose |
|---|---|
| `backendPhotoDetailToPhotoReviewModel(photoDetail)` | Map one `BackendPhotoDetail` → `PhotoReviewModel` |
| `backendPhotoDetailsToPhotoReviewModels(photoDetails)` | Map an array, skipping invalid entries |
| `canBuildPhotoReviewFromBackend(photoDetail)` | Guard: returns `true` when the detail has enough fields to build a meaningful model |

## Expected input shape

`BackendPhotoDetail` (defined in `clerkApp/lib/api/backend-types.ts`):

```ts
type BackendPhotoDetail = BackendPhoto & {
  detections: BackendDetection[]
}

// Key detection fields used:
//   detection.confidence          — integer percent (91) or decimal (0.91)
//   detection.redaction_status    — "auto_blurred" | "manual_review" | "approved" | "rejected"
//   detection.manual_review_required — boolean
//   detection.bounding_box        — [x, y, width, height] tuple or undefined
//   detection.attendee_id / attendee_name / reference_photo_url
```

## Output shape

`PhotoReviewModel` (defined in `clerkApp/types/photo-review.ts`):

```ts
{
  photoId: string            // String(BackendPhoto.id)
  eventId: string            // String(BackendPhoto.event_id)
  fileName: string
  originalImageUrl: string
  redactedImageUrl?: string
  status: PhotoProcessingStatus
  statusLabel: string        // human-readable
  participants: PhotoReviewParticipant[]
  regions: PhotoReviewRegion[]
  highestConfidencePercent?: number
  needsManualReview: boolean // true if any detection.manual_review_required
  confidenceWarning: string  // standard disclaimer
}
```

## Confidence normalization

Backend stores confidence as integer percent (91 = 91%).
Some paths may store as decimal (0.91). The adapter handles both:

- `confidence > 1` → already a percent; `raw = confidence / 100`
- `confidence <= 1` → already decimal; `percent = round(confidence * 100)`

## Status label mapping

| Backend value | statusLabel |
|---|---|
| `auto_blurred` | Auto-blurred |
| `manual_review` | Manual review |
| `approved` | Approved |
| `rejected` | Rejected |

Unknown statuses fall back to `"manual_review"` for detections, `"processed"` for photos.

## How the dashboard can use this later

```ts
import { backendPhotoDetailToPhotoReviewModel } from "@/lib/processing/backend-photo-review-adapter"
import { canBuildPhotoReviewFromBackend } from "@/lib/processing/backend-photo-review-adapter"

// In a server component or server action:
const detail = await fetchPhotoDetail(photoId)   // returns BackendPhotoDetail
const model = canBuildPhotoReviewFromBackend(detail)
  ? backendPhotoDetailToPhotoReviewModel(detail)
  : getMockPhotoReviewModel(photoId)             // graceful fallback
```

## What still remains to wire in

- `clerkApp/components/anonify-experience.tsx` — swap `getMockPhotoReviewModel()` calls
  for real backend fetches + `backendPhotoDetailToPhotoReviewModel()`.
- Fetch helper: an API route or server action that calls the Flask backend for
  `/events/{eventKey}/photos/{photoId}` and returns `BackendPhotoDetail`.
- Error/loading states in the photo review panel.
- Remove `getMockPhotoReviewModels()` usage once real data is confirmed working.
