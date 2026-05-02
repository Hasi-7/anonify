# AI Session 03 — Region-Based Redaction

**Date:** 2026-05-02
**Workstream:** AI / Redaction

## Goal

Bridge from a `RedactionPlan` (known bounding boxes) to an actual blurred output image, without face recognition and without installing new dependencies.

## What Was Added

| File | Purpose |
|------|---------|
| `types/ai-redaction.ts` | Appended `RedactionApplyResult` type |
| `ai_redaction/__init__.py` | Python package marker for the optional helper |
| `ai_redaction/apply_redaction.py` | Pillow-based region blur + JSON deserialization + CLI entry point |
| `lib/processing/apply-redaction.ts` | TypeScript adapter: mock result + HTTP stub for Python helper |

No dependencies were installed. No existing files were broken.

## Is This Real Blur or Mock-Only?

**Python helper (`apply_redaction.py`) — real blur, contingent on Pillow being installed.**
Once `pip install "pillow>=10.4.0"` is run, `apply_redaction_plan()` applies genuine
`ImageFilter.GaussianBlur` to each bounding-box region and writes a real output image.

**TypeScript adapter (`apply-redaction.ts`) — mock only until the Python helper is running.**
`applyRedactionPlan()` calls `POST /redact` on the Python FastAPI helper if
`REDACTION_API_URL` is set. If it is not set or the helper is unreachable, it degrades
gracefully to `applyRedactionPlanMock()`, which returns a placeholder result without
touching any image.

## How to Call It

### From TypeScript (frontend or backend API route)

```typescript
import { applyRedactionPlan, applyRedactionPlanMock } from "@/lib/processing/apply-redaction"
import { getMockRedactionPlan } from "@/mocks/redaction-plan-fixtures"

const plan = getMockRedactionPlan("photo_001")!

// Mock (always works, no Python needed):
const mockResult = applyRedactionPlanMock(plan, "/uploads/photo_001.jpg")
// mockResult.outputImagePath === "/uploads/photo_001_redacted.jpg" (placeholder)
// mockResult.boxesApplied === 1

// Real (requires REDACTION_API_URL + Python helper running):
const result = await applyRedactionPlan(plan, "/uploads/photo_001.jpg")
// result.success === true
// result.outputImagePath === "/uploads/photo_001_redacted.jpg" (actual blurred file)
```

### From Python CLI (once Pillow is installed)

```bash
# Install Pillow first:
pip install "pillow>=10.4.0"

# Run against a real image and a plan JSON file:
python -m ai_redaction.apply_redaction photo_001.jpg plan.json output.jpg
```

Plan JSON format (matches `RedactionPlan` camelCase shape):
```json
{
  "photoId": "photo_001",
  "eventId": "event_demo_001",
  "originalImageUrl": "/mocks/images/event-stage-01.jpg",
  "boxes": [
    { "x": 120, "y": 80, "width": 64, "height": 80,
      "reason": "opt_out_match", "confidence": 0.91,
      "attendeeId": "attendee_001", "attendeeName": "Alex Rivera" }
  ],
  "needsManualReview": false
}
```

### RedactionApplyResult shape

```typescript
{
  photoId: string
  eventId: string
  originalImagePath: string
  outputImagePath: string | null  // null on failure
  boxesApplied: number
  boxesSkipped: number            // boxes clamped to zero area (bad coords)
  needsManualReview: boolean
  success: boolean
  error?: string                  // present only on failure
}
```

## What Remains for Actual Image Blurring (full pipeline)

1. Install Pillow: `pip install "pillow>=10.4.0"` — already in `requirements.txt`.
2. Run `ai_redaction/server.py` — FastAPI route `POST /redact` that calls `apply_redaction_plan()`.
3. Set `REDACTION_API_URL=http://localhost:8001` in `.env`.
4. Replace placeholder `redactedImageUrl` in `PhotoProcessingResult` with the real output path
   returned by `RedactionApplyResult.outputImagePath`.

## What Remains for Real Face Matching

1. Set `USE_REAL_AI = true` in `lib/processing/mock-processor.ts`.
2. Implement `processPhotoReal()` — face detector supplies real `boundingBox` coordinates.
3. Once real coordinates flow into `PhotoProcessingResult.detections`, `createRedactionPlan()`
   and `apply_redaction_plan()` require no changes — they consume whatever boxes they receive.
4. The end-to-end chain then becomes:
   `processPhotoReal()` → `createRedactionPlan()` → `apply_redaction_plan()` → blurred image.

## Box Safety Behavior

| Condition | Behavior |
|-----------|---------|
| Empty plan (no boxes) | Returns original path, success=true, no image written |
| Box partially outside image | Clamped to image bounds, applied if any area remains |
| Box entirely outside image | Counted as skipped, not an error |
| Pillow not installed | Returns error result, success=false, no exception raised |
| Image file not found | Returns error result, success=false |
| Any other exception | Caught, returned as error result |

## Commands Run

None. No installs, no builds.
