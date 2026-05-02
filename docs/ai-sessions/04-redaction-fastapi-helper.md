# AI Session 04 — Redaction FastAPI Helper

**Date:** 2026-05-02
**Workstream:** AI / Redaction

## Goal

Expose the existing `apply_redaction_plan()` Python function over HTTP so the
TypeScript adapter (`lib/processing/apply-redaction.ts`) can call it without
needing Python in-process.

## Files Created / Changed

| File | Change |
|------|--------|
| `ai_redaction/server.py` | Created — FastAPI server with `GET /health` and `POST /redact` |

No other files changed. The mock fallback in `apply-redaction.ts` is untouched.

## How to Run (after dependencies are installed)

```bash
# 1. Install dependencies (one-time):
pip install -r requirements.txt

# 2. Start the helper from the repo root:
uvicorn ai_redaction.server:app --reload --port 8001

# 3. Verify it is running:
curl http://localhost:8001/health
# → { "status": "ok", "pillowAvailable": true, "blurReady": true, ... }
```

Interactive API docs are available at `http://localhost:8001/docs` while the server is running.

## How REDACTION_API_URL Should Be Set

Add to your `.env` (or `.env.local` for Next.js):

```
REDACTION_API_URL=http://localhost:8001
```

The TypeScript adapter reads `process.env.REDACTION_API_URL`. When set, it calls the
Python helper. When unset or when the helper is unreachable, it falls back to
`applyRedactionPlanMock()` automatically.

## Example POST /redact Payload

```json
{
  "imagePath": "/absolute/path/to/event-stage-01.jpg",
  "plan": {
    "photoId": "photo_001",
    "eventId": "event_demo_001",
    "originalImageUrl": "/mocks/images/event-stage-01.jpg",
    "boxes": [
      {
        "x": 120,
        "y": 80,
        "width": 64,
        "height": 80,
        "reason": "opt_out_match",
        "confidence": 0.91,
        "attendeeId": "attendee_001",
        "attendeeName": "Alex Rivera"
      }
    ],
    "needsManualReview": false
  }
}
```

Optional fields:
- `"outputPath"` — absolute path for the redacted image. Defaults to `<stem>_redacted.<ext>` alongside the input.
- `"blurRadius"` — integer 1–100. Defaults to 20.

## Example Response

```json
{
  "photoId": "photo_001",
  "eventId": "event_demo_001",
  "originalImagePath": "/absolute/path/to/event-stage-01.jpg",
  "outputImagePath": "/absolute/path/to/event-stage-01_redacted.jpg",
  "boxesApplied": 1,
  "boxesSkipped": 0,
  "needsManualReview": false,
  "success": true,
  "error": null
}
```

On failure (e.g. Pillow not installed, file not found):

```json
{
  "success": false,
  "outputImagePath": null,
  "boxesApplied": 0,
  "boxesSkipped": 1,
  "error": "Pillow is not installed. Run: pip install 'pillow>=10.4.0'"
}
```

## Error Behavior Reference

| Condition | HTTP status | `success` |
|-----------|------------|-----------|
| Valid request, blur applied | 200 | `true` |
| Valid request, no boxes (no-op) | 200 | `true` |
| Pillow not installed | 200 | `false` + `error` |
| Image file not found | 200 | `false` + `error` |
| Box outside image bounds | 200 | `true`, `boxesSkipped++` |
| Invalid field type/value | 422 | FastAPI validation error |
| Unexpected server exception | 200 | `false` + `error` |

Business-logic failures always return HTTP 200 with `success: false` — the TypeScript
adapter treats any non-2xx as a network failure, so keeping 200 means the error detail
reaches the caller cleanly.

## What Remains for Real Face Detection / Matching

1. Implement `processPhotoReal()` in `lib/processing/mock-processor.ts` — a real CV detector
   that supplies actual bounding boxes from face detection.
2. Set `USE_REAL_AI = true` in `mock-processor.ts`.
3. The redaction chain then becomes fully real end-to-end:
   ```
   processPhotoReal()        ← real face detector (OpenCV, MediaPipe, etc.)
     → createRedactionPlan() ← redaction-plan.ts (no changes needed)
     → applyRedactionPlan()  ← apply-redaction.ts (calls POST /redact)
     → POST /redact          ← server.py
     → apply_redaction_plan()← apply_redaction.py (Pillow blur)
   ```
4. The `ai_redaction/server.py` file does not need to change when face detection is added.
   Only the upstream coordinate source changes.

## Commands Run

None. No installs, no server started.
