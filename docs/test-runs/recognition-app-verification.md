# Recognition App Verification — Test Run

**Date:** 2026-05-02  
**Runner:** Claude Code (test-runner agent)  
**Working directory:** `C:\Personal\VSCode\huskyHacks26`

---

## Step 1: UI Wiring Inspection

### Finding: Real recognition is NOT wired into the UI. The UI uses mock/backend data.

Evidence from `clerkApp/components/anonify-experience.tsx`:

- **Import**: `getMockPhotoReviewModel` from `@/lib/processing/photo-review-adapter` is imported. `recognition-client.ts` is **not imported** at all.
- **No call** to `matchPhotoWithReferences()` anywhere in the component.
- **Photo review logic** (line 229): `getMockPhotoReviewModel(toReviewFixtureId(selectedPhoto.id))` — this calls the mock adapter, not the real recognition client.
- **Detections display**: When backend data loads (`loadBackendDemoEvent()`), detections come from `getEventPhotoDetail()` (Flask/Backboard), not from `/match-photo`. `reviewModel` is always the mock fixture model.
- **Upload path**: Newly uploaded photos get `demoFigures` (hardcoded static figures) assigned; recognition is not triggered.

### Summary of data sources in the review UI:

| Scenario | Source of detections |
|---|---|
| Backend event loaded (HUSKY-42F7) | Flask backend `adaptPhotoDetail()` detections |
| Photo review model (figures/participants) | `getMockPhotoReviewModel()` — mock fixtures |
| User-uploaded photo | `demoFigures` hardcoded array |
| Real `/match-photo` recognition | **Not used anywhere in the UI** |

---

## Step 2: Python Recognition Helper Status

**Helper:** `ai_redaction.server:app` via uvicorn on `http://127.0.0.1:8001`

**Start command used:**
```
python -m uvicorn ai_redaction.server:app --host 127.0.0.1 --port 8001
```

**Health check response:**
```json
{
  "status": "ok",
  "service": "anonify-redaction-helper",
  "pillowAvailable": true,
  "blurReady": true,
  "recognitionAvailable": true
}
```

All three readiness flags confirmed true. Pillow, numpy, and OpenCV (Haar cascade) are available.

---

## Step 3: /match-photo Safe Failure Cases

All four tests returned HTTP 200 with no exception traces.

| Test | Input | Result |
|---|---|---|
| Empty `optedOutAttendees` | `[]` | `status: no_match`, `success: true`, `error: null` |
| Missing event photo path | nonexistent path | `status: no_match`, `success: false`, `error: "photo_file_missing"` |
| Missing reference image path | nonexistent reference | `status: no_match`, `success: false`, `error: "reference_file_missing"` |
| No-face solid image | 100x100 grey PNG | `status: no_match`, `success: true`, `error: null`, `highestConfidence: 0.0` |

All cases returned safe structured responses with no server crashes.

---

## Step 4: Real Local Sample Image Test

**Images used:**
- Event photo: `tmp/recognition-event-photo.jpg`
- Reference: `tmp/recognition-reference-person.jpg`

**Command:**
```bash
curl -s -X POST http://127.0.0.1:8001/match-photo \
  -H "Content-Type: application/json" \
  -d '{"eventId":"event_real_test","photoId":"photo_real_test_001",
       "photoImagePath":"tmp/recognition-event-photo.jpg",
       "originalImageUrl":"tmp/recognition-event-photo.jpg",
       "optedOutAttendees":[{"attendeeId":"attendee_real_001",
         "attendeeName":"Test Person",
         "referenceImagePath":"tmp/recognition-reference-person.jpg",
         "referenceImageUrl":"tmp/recognition-reference-person.jpg"}]}'
```

**Response:**
```json
{
  "photoId": "photo_real_test_001",
  "eventId": "event_real_test",
  "fileName": "recognition-event-photo.jpg",
  "originalImageUrl": "tmp/recognition-event-photo.jpg",
  "redactedImageUrl": null,
  "status": "manual_review",
  "detections": [
    {
      "id": "photo_real_test_001-face-0-attendee_real_001",
      "photoId": "photo_real_test_001",
      "attendeeId": "attendee_real_001",
      "attendeeName": "Test Person",
      "referenceImageUrl": "tmp/recognition-reference-person.jpg",
      "confidence": 0.7017,
      "status": "manual_review",
      "boundingBox": { "x": 1964, "y": 1700, "width": 61, "height": 61 }
    }
  ],
  "highestConfidence": 0.7017,
  "needsManualReview": true,
  "success": true,
  "error": null
}
```

**Result:** Face detected. Confidence 70.17% — above the 0.70 `MANUAL_REVIEW_THRESHOLD`, below the 0.90 `AUTO_BLUR_THRESHOLD`. Status correctly set to `manual_review`.

---

## Step 5: Blur Chain Verification

**Command:**
```bash
curl -s -X POST http://127.0.0.1:8001/redact \
  -H "Content-Type: application/json" \
  -d '{"imagePath":"tmp/recognition-event-photo.jpg",
       "outputPath":"tmp/recognition-redacted-output.jpg",
       "plan":{...boxes:[{x:1964,y:1700,width:61,height:61,reason:"manual_review",confidence:0.7017}]}}'
```

**Redact response:**
```json
{
  "photoId": "photo_real_test_001",
  "eventId": "event_real_test",
  "originalImagePath": "tmp/recognition-event-photo.jpg",
  "outputImagePath": "tmp/recognition-redacted-output.jpg",
  "boxesApplied": 1,
  "boxesSkipped": 0,
  "needsManualReview": true,
  "success": true,
  "error": null
}
```

**Output file:** `tmp/recognition-redacted-output.jpg` — 1,105,212 bytes, 4000x3000 px RGB  
**Blur verification (pixel analysis):**

| Metric | Value |
|---|---|
| Mean pixel difference in blurred region | 47.38 |
| Source region std dev (texture) | 67.35 |
| Output region std dev (texture) | 27.15 |

The output region std dev dropped from 67 to 27, confirming the blur filter was applied to the detected face region. The redacted output file is in `tmp/` and was NOT committed.

---

## Step 6: Next.js / ClerkApp Client Compatibility

### recognition-client.ts review:

File: `clerkApp/lib/processing/recognition-client.ts`

- `matchPhotoWithReferences()` calls `/match-photo` on `REDACTION_API_URL` (default: `http://127.0.0.1:8001`)
- `isLocalRecognitionUrl()` enforces localhost/127.0.0.1 only — returns `{ ok: false, error }` for any remote URL
- All fetch errors are caught and returned as `{ ok: false, error: "Recognition helper unavailable (...)" }`
- No data is sent to remote URLs

### Lint results:
```
7 problems (0 errors, 7 warnings)
```
All 7 are warnings only (`no-img-element`, `no-unused-vars` in mock stubs). No errors.

### Build results:
```
API Contract Validation: 0 violations
TypeScript: no errors
Build: compiled successfully
Static pages: 9/9 generated
```

---

## Summary

| Check | Result |
|---|---|
| `/health` works | PASS — blurReady: true, recognitionAvailable: true |
| `/match-photo` safe cases work | PASS — all 4 cases, no crashes |
| Real image test run | PASS — match found |
| Confidence result | 70.17% — `manual_review` |
| boundingBox returned | `{x:1964, y:1700, width:61, height:61}` |
| Blur output created | PASS — `tmp/recognition-redacted-output.jpg` |
| Blur confirmed by pixel analysis | PASS — std dev dropped from 67 to 27 |
| Real photos committed | NO |
| UI uses real recognition | NO — UI uses mock adapter + backend detections |
| lint errors | 0 errors, 7 warnings |
| build errors | 0 |

---

## Limitations

1. The OpenCV Haar cascade face detector is used for matching. It is not a deep-learning model and will miss faces at unusual angles, low resolution, or poor lighting.
2. The similarity metric is cosine + MSE on 96x96 grayscale crops — a research-grade spike, not production biometric matching.
3. Confidence of 70.17% is above the manual review floor but well below the auto-blur threshold (90%). For the demo sample pair, the detector found the face and correctly escalated to manual review rather than auto-blurring.
4. The real recognition pipeline (`recognition-client.ts` → `/match-photo`) is entirely disconnected from the organizer UI. Any match result from the Python helper never reaches the review panel.

---

## Recommendation for Demo

**Option A — Use real recognition with controlled samples (preferred for technical demo):**
- Start the helper with `python -m uvicorn ai_redaction.server:app --host 127.0.0.1 --port 8001`
- Use `tmp/recognition-event-photo.jpg` and `tmp/recognition-reference-person.jpg` as controlled inputs
- Call `/match-photo` → `/redact` directly to show the full pipeline working
- The UI currently does not call these endpoints, so demo the API layer directly (curl/Postman) or wire recognition-client.ts into the upload handler

**Option B — Use mock adapter + real region blur (safe fallback):**
- The UI already uses `getMockPhotoReviewModel()` with fixture confidence tiers (91%, 78%, 63%, no-match)
- The `/redact` endpoint works end-to-end with any supplied bounding box
- This demonstrates the blur chain without face matching uncertainty

**For a full end-to-end live demo, the missing wire is:** calling `matchPhotoWithReferences()` from `recognition-client.ts` after a photo upload and passing its result through `toPhotoReviewModel()` to replace the mock fixture model in the organizer review panel.
