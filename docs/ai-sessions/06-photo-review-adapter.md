# AI Session 06 — Photo Review Adapter

**Date:** 2026-05-02
**Workstream:** AI / Redaction

## What Was Created

| File | Purpose |
|------|---------|
| `clerkApp/types/photo-review.ts` | UI-friendly types: `PhotoReviewParticipant`, `PhotoReviewRegion`, `PhotoReviewModel` |
| `clerkApp/lib/processing/photo-review-adapter.ts` | `toPhotoReviewModel`, `toPhotoReviewModels`, `getMockPhotoReviewModels`, `getMockPhotoReviewModel` |

No existing files were modified.

## Import Path for Frontend

```typescript
import {
  toPhotoReviewModel,
  toPhotoReviewModels,
  getMockPhotoReviewModels,
  getMockPhotoReviewModel,
} from "@/lib/processing/photo-review-adapter"

import type {
  PhotoReviewModel,
  PhotoReviewParticipant,
  PhotoReviewRegion,
} from "@/types/photo-review"
```

## Example Usage

### Instant mock data (zero compute, no async)

```typescript
// All 4 demo photos — safe in server components and test setup
const models = getMockPhotoReviewModels()

// Single photo lookup
const model = getMockPhotoReviewModel("photo_001")
if (model) {
  console.log(model.fileName)                // "event-stage-01.jpg"
  console.log(model.statusLabel)             // "Match found"
  console.log(model.highestConfidencePercent) // 91
  console.log(model.needsManualReview)       // false
  console.log(model.participants[0].attendeeName)    // "Alex Rivera"
  console.log(model.participants[0].confidencePercent) // 91
  console.log(model.participants[0].statusLabel)       // "Auto-blurred"
  console.log(model.participants[0].reviewRequired)    // false
  console.log(model.regions[0].x)            // 120 (placeholder; real CV gives actual coords)
  console.log(model.confidenceWarning)       // "Confidence scores are estimates..."
}
```

### From a live processing run (async)

```typescript
import { processEventPhotos } from "@/lib/processing/mock-processor"
import { toPhotoReviewModels } from "@/lib/processing/photo-review-adapter"
import { MOCK_PROCESSING_INPUT } from "@/mocks/processing-fixtures"

const summary = await processEventPhotos(MOCK_PROCESSING_INPUT)
const models = toPhotoReviewModels(summary)
```

### From backend photo detail (when backend returns detection data)

```typescript
import { toPhotoReviewModel } from "@/lib/processing/photo-review-adapter"
import type { PhotoProcessingResult } from "@/types/ai-redaction"

// Assume backendResult is a PhotoProcessingResult deserialized from the Flask API
const model = toPhotoReviewModel(backendResult)
```

## What the Mock Data Covers

| Photo | Attendee | Confidence | Status | Review required |
|-------|---------|-----------|--------|----------------|
| photo_001 | Alex Rivera | 91% | Auto-blurred | No |
| photo_002 | Morgan Lee | 78% | Needs review | Yes |
| photo_003 | Jordan Kim | 63% | Needs review | Yes (no reference image) |
| photo_004 | — | — | No match | No |

## PhotoReviewModel Shape

```typescript
{
  photoId: "photo_001",
  eventId: "event_demo_001",
  fileName: "event-stage-01.jpg",
  originalImageUrl: "/mocks/images/event-stage-01.jpg",
  redactedImageUrl: "/redacted/event_demo_001/photo_001.jpg",
  status: "match_found",
  statusLabel: "Match found",
  highestConfidencePercent: 91,
  needsManualReview: false,
  confidenceWarning: "Confidence scores are estimates. Review all results before publishing.",
  participants: [
    {
      attendeeId: "attendee_001",
      attendeeName: "Alex Rivera",
      referenceImageUrl: "/mocks/images/ref_alex_rivera.jpg",
      confidencePercent: 91,
      confidenceRaw: 0.91,
      status: "auto_blurred",
      statusLabel: "Auto-blurred",
      reviewRequired: false
    }
  ],
  regions: [
    {
      x: 120, y: 80, width: 64, height: 80,   // placeholder pixels; real CV supplies actual
      reason: "opt_out_match",
      confidencePercent: 91,
      attendeeId: "attendee_001",
      attendeeName: "Alex Rivera"
    }
  ]
}
```

Detections without a `boundingBox` appear in `participants` but produce no entry in `regions`.

## How This Relates to Backend Photo Detail Later

The Flask backend currently returns mock detection data from its seed.
When it returns `PhotoProcessingResult`-shaped JSON, the frontend can call:

```typescript
const result = await fetch(`/api/events/${eventId}/photos/${photoId}`).then(r => r.json())
const model = toPhotoReviewModel(result as PhotoProcessingResult)
```

The adapter function signature does not change when that happens.

The remaining integration gap is the shape alignment:
- Flask uses snake_case (`attendee_id`, `photo_id`) — the frontend will need to camelCase keys from the backend response before passing to `toPhotoReviewModel()`, or the backend should return camelCase.
- Flask `Detection` model may not include `boundingBox` yet — regions will be empty until the backend adds box coordinates.

## What Remains for Real Face Detection / Matching

1. Real CV detector supplies actual `boundingBox` pixel coordinates — regions become real overlay data.
2. Backend `GET /events/{event_id}/photos/{photo_id}` returns `PhotoProcessingResult`-shaped JSON.
3. Frontend calls `toPhotoReviewModel(result)` — no adapter changes needed.
4. The `confidenceWarning` string should always be shown in the UI regardless of data source.

## Commands Run

None. No installs, no builds.
