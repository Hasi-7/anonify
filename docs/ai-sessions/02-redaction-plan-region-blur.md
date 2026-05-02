# AI Session 02 — Redaction Plan & Region Blur Bridge

**Date:** 2026-05-02
**Workstream:** AI / Redaction

## Goal

Add a redaction-plan abstraction that bridges mock detection output to actionable blur instructions — without touching face recognition or installing new dependencies.

## What Was Added

| File | Change |
|------|--------|
| `types/ai-redaction.ts` | Appended `RedactionReason`, `RedactionBox`, and `RedactionPlan` types |
| `lib/processing/redaction-plan.ts` | New — `createRedactionPlan()` and `createRedactionPlans()` |
| `mocks/redaction-plan-fixtures.ts` | New — pre-computed example plans for all 4 demo photos; `getMockRedactionPlan()` helper |

No existing files were modified beyond the type append. The mock processor is unchanged.

## How Frontend/Backend Should Use It

### Option A — derive plans from a live processing run

```typescript
import { processEventPhotos } from "@/lib/processing/mock-processor"
import { createRedactionPlans } from "@/lib/processing/redaction-plan"
import { MOCK_PROCESSING_INPUT } from "@/mocks/processing-fixtures"

const summary = await processEventPhotos(MOCK_PROCESSING_INPUT)
const plans = createRedactionPlans(summary)

// plans[0].boxes → array of RedactionBox with x/y/width/height + reason + confidence
// plans[0].needsManualReview → boolean — drives the review queue
```

### Option B — use pre-computed fixtures directly (zero compute)

```typescript
import { MOCK_REDACTION_PLANS, getMockRedactionPlan } from "@/mocks/redaction-plan-fixtures"

// All plans for the demo event:
const allPlans = MOCK_REDACTION_PLANS

// Single plan lookup:
const plan = getMockRedactionPlan("photo_001")
// plan.boxes[0].reason === "opt_out_match"
// plan.boxes[0].confidence === 0.91
```

### What a RedactionBox looks like

```typescript
{
  x: 120,          // top-left pixel x
  y: 80,           // top-left pixel y
  width: 64,       // box width
  height: 80,      // box height
  reason: "opt_out_match" | "manual_review",
  confidence: 0.91,
  attendeeId: "attendee_001",
  attendeeName: "Alex Rivera",
}
```

### Reason mapping

| Detection status | RedactionBox reason |
|-----------------|-------------------|
| `auto_blurred` | `opt_out_match` |
| `manual_review` | `manual_review` |
| `approved` / `rejected` | not included in boxes |

Detections without a `boundingBox` are excluded from the plan. They remain visible in the `ProcessingResult.detections` array but cannot be spatially acted on until real CV provides coordinates.

## What Remains for Actual Image Blurring

1. Wire a real blur step that reads `RedactionPlan.boxes` and writes a blurred output image.
   - TypeScript path: use the Canvas API (browser) or `sharp` (Node.js server-side) — no new package needed if `sharp` is already in the Next.js dep tree.
   - Python path: `redact_image(image_path, boxes)` using `Pillow` (`ImageFilter.GaussianBlur` on cropped regions) — `Pillow` is already in `requirements.txt`.
2. Replace the placeholder `redactedImageUrl` in `PhotoProcessingResult` with the real output path.
3. Replace placeholder `boundingBox` coordinates in `mock-processor.ts` with real values from the CV detector.

## What Remains for Real Face Matching

1. Implement `processPhotoReal()` in `mock-processor.ts` — set `USE_REAL_AI = true`.
2. Supply real bounding boxes from a face detector (OpenCV, MediaPipe, or a cloud API).
3. Compare detected faces against `OptedOutAttendee.referenceImageUrl` embeddings.
4. The `RedactionPlan` shape does not change — only the coordinates become real.

## Decisions Made

- `RedactionBox` and `RedactionPlan` added to `types/ai-redaction.ts` (single types file — no new type files).
- Plans are derived from `ProcessingResult`, not from raw detections, to keep the redaction layer one step above the raw AI output.
- `getMockRedactionPlan()` helper added so frontend can do zero-compute lookups during UI development.

## Commands Run

None. No installs, no builds.
