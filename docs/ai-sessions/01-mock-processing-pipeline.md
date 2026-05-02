# AI Session 01 — Mock Processing Pipeline

**Date:** 2026-05-02
**Workstream:** AI / Redaction

## Goal

Build a mock-first AI/redaction processing layer that the backend and frontend can integrate with immediately — before any real face recognition is wired in.

## Files Created

| File | Purpose |
|------|---------|
| `types/ai-redaction.ts` | Core types: Detection, PhotoProcessingResult, ProcessingSummary, ProcessingInput, OptedOutAttendee, EventPhoto |
| `lib/processing/confidence.ts` | Confidence threshold constants (HIGH=0.90, MEDIUM=0.70) and status/review logic |
| `lib/processing/mock-processor.ts` | Main entry point: `processEventPhotos()` — event-scoped, mock mode by default |
| `mocks/processing-fixtures.ts` | Deterministic sample attendees, photos, and confidence map for demo event `event_demo_001` |

## How Other Teams Should Call the Mock Processor

```typescript
import { processEventPhotos } from "@/lib/processing/mock-processor"
import { MOCK_PROCESSING_INPUT } from "@/mocks/processing-fixtures"

// Using the built-in demo fixtures:
const summary = await processEventPhotos(MOCK_PROCESSING_INPUT)

// Or pass real event data from the backend:
const summary = await processEventPhotos({
  eventId: "event_abc123",
  photos: [
    { photoId: "p1", fileName: "photo.jpg", originalImageUrl: "/uploads/p1.jpg" },
  ],
  optedOutAttendees: [
    { attendeeId: "a1", attendeeName: "Alex Rivera", referenceImageUrl: "/refs/a1.jpg" },
  ],
})

console.log(summary.photosProcessed)   // total photos
console.log(summary.matchesFound)      // photos with at least one detection
console.log(summary.photosNeedingReview) // photos flagged for human review
console.log(summary.results)           // PhotoProcessingResult[] — one per photo
```

## Mock Confidence Behavior

| Confidence | Level | Status assigned |
|-----------|-------|----------------|
| >= 0.90 | High | `auto_blurred` |
| 0.70–0.89 | Medium | `manual_review` |
| < 0.70 | Low | `manual_review` |

The demo fixtures include:
- **photo_001** → Alex Rivera at 0.91 → `auto_blurred` (high confidence)
- **photo_002** → Morgan Lee at 0.78 → `manual_review` (medium confidence)
- **photo_003** → Jordan Kim at 0.63 → `manual_review` (low confidence, no reference image)
- **photo_004** → no matches → `no_match`

## Decisions Made

- TypeScript-first, no Python dependency required for mock mode.
- `USE_REAL_AI = false` flag in `mock-processor.ts` is the single switch to enable real CV.
- All results are event-scoped — `eventId` is present on every `PhotoProcessingResult`.
- `processPhotoReal()` stub exists and throws clearly so the swap path is obvious.
- Bounding boxes are placeholder values; real CV will supply actual coordinates.
- `redactedImageUrl` is a path placeholder; real pipeline writes a blurred image there.

## What Remains for Real AI/CV

1. Set `USE_REAL_AI = true` in `mock-processor.ts`.
2. Implement `processPhotoReal()` — wire in face detection (e.g. OpenCV + a face embedding model).
3. Replace placeholder `boundingBox` values with real coordinates from the detector.
4. Replace placeholder `redactedImageUrl` with actual blurred image output.
5. Add a Python FastAPI helper if the CV work is Python-based; call it from `processPhotoReal()` via `fetch`.
6. No type changes needed — the output shape is fixed.

## Open Issues

- No `package.json` or Next.js app exists yet; these files are ready to integrate once the app is scaffolded.
- Import paths use `@/` alias — add `paths` to `tsconfig.json` when the app is set up.
- Mock images in `/mocks/images/` are path references only; no actual image files exist yet.

## Commands Run

None — no install commands, no build commands. Files created only.
