# Anonify Final Demo Checklist

**Date:** 2026-05-02
**Event key:** HUSKY-42F7 | **Event ID after seed:** 1
**Prepared by:** Claude Code (test-runner agent)

---

## Pre-flight Commands

Run each block in a **separate terminal**. All paths are from the repo root `C:\Personal\VSCode\huskyHacks26`.

### Terminal 1 — Flask backend (port 5000)

```powershell
# From repo root
python -m flask --app backend.app run --host 127.0.0.1 --port 5000
```

If the above fails with "No module named backend.app", try the package form:

```powershell
python -m backend.app
```

### Terminal 2 — AI redaction helper (port 8001)

```powershell
# From repo root
python -m uvicorn ai_redaction.server:app --host 127.0.0.1 --port 8001 --reload
```

Note: the helper is FastAPI / uvicorn, NOT Flask. It runs on **8001**, not 5001.

### Terminal 3 — Next.js frontend (port 3000)

```powershell
cd clerkApp
npm run dev
```

### Reset and reseed the database

Delete the existing SQLite file and trigger a fresh seed via the API:

```powershell
# Stop the Flask backend first (Ctrl+C in Terminal 1), then:
Remove-Item -Force backend\anonify.db -ErrorAction SilentlyContinue

# Restart the Flask backend (Terminal 1), then seed:
Invoke-RestMethod -Method POST -Uri http://127.0.0.1:5000/seed | ConvertTo-Json
```

Expected seed response:

```json
{
  "message": "Demo data seeded successfully",
  "seeded": true,
  "event_key": "HUSKY-42F7",
  "attendees_created": 6,
  "photos_created": 4,
  "detections_created": 5
}
```

If the response says `"seeded": false`, the demo event already exists. Delete `backend\anonify.db` and retry.

---

## Test Cases

---

### TC-01 — Backend health check

**Label:** SAFE

**Command:**

```powershell
Invoke-RestMethod -Uri http://127.0.0.1:5000/health | ConvertTo-Json
```

**Expected result (pass):**

```json
{
  "status": "ok",
  "backend": "anonify",
  "mode": "flask-sqlite"
}
```

HTTP status must be `200`. All three fields must be present with those exact string values.

**Failure looks like:** connection refused (`Unable to connect to the remote server`), or any non-200 response, or missing fields.

---

### TC-02 — AI helper health check

**Label:** SAFE

**Command:**

```powershell
Invoke-RestMethod -Uri http://127.0.0.1:8001/health | ConvertTo-Json
```

**Expected result (pass):**

```json
{
  "status": "ok",
  "service": "anonify-redaction-helper",
  "pillowAvailable": true,
  "blurReady": true,
  "recognitionAvailable": true
}
```

`pillowAvailable` and `blurReady` must both be `true` for redaction to work. `recognitionAvailable` will be `false` if the ONNX model files are absent from `ai_redaction/models/` — the UI still works but real face matching is unavailable.

**Failure looks like:** connection refused (uvicorn is not running), or `recognitionAvailable: false` (model files missing).

---

### TC-03 — Backend seed and attendee list

**Label:** SAFE

**Step A — Seed (only if not already seeded):**

```powershell
Invoke-RestMethod -Method POST -Uri http://127.0.0.1:5000/seed | ConvertTo-Json
```

Expected: `"seeded": true` (see Pre-flight section for full shape).

**Step B — Verify event exists by key:**

```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:5000/events/key/HUSKY-42F7" | ConvertTo-Json
```

Expected: a JSON object with `"id": 1`, `"event_key": "HUSKY-42F7"`, `"name": "HuskyHack Demo"`.

**Step C — Verify opted-out attendees:**

```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:5000/events/1/attendees?opted_out=true" | ConvertTo-Json
```

Expected: a JSON array with exactly 4 records: Maya Chen, Jordan Lee, Alex Rivera, Sam Park. Each must have `"opted_out": true` and `"consent_status": "opted_out"`.

**Failure looks like:** event not found (404), empty attendee array, or attendees with `"opted_out": false`.

---

### TC-04 — Frontend startup

**Label:** SAFE

**URL:** `http://localhost:3000`

**Expected result (pass):** The Anonify landing or home page loads within 5 seconds. The Anonify brand logo is visible. There are no blank screens, React error overlays, or "Module not found" build errors in the browser console.

**Failure looks like:** a white screen with a stack trace, a Next.js compilation error banner at the bottom of the page, or `ERR_CONNECTION_REFUSED`.

---

### TC-05 — Clerk sign-in (organizer flow)

**Label:** SAFE

**URL:** `http://localhost:3000/sign-in`

**Steps:**
1. Navigate to `http://localhost:3000/sign-in`.
2. Sign in with a Clerk-registered organizer account (use your development Clerk credentials).
3. Confirm redirect to the dashboard or home page after sign-in.

**Expected result (pass):** The Clerk sign-in widget renders. After submitting valid credentials the browser redirects away from `/sign-in`. The navigation bar shows a user avatar or `UserButton` component. No Clerk API errors appear in the console.

**Failure looks like:** Clerk widget shows a "Publishable key not found" error, or the widget renders but sign-in fails with an auth error, or the redirect loops back to `/sign-in`.

---

### TC-06 — Public attendee opt-out flow

**Label:** SAFE

**URL:** `http://localhost:3000/attend?eventKey=HUSKY-42F7`

**Steps:**
1. Open the URL in an incognito window (no Clerk session required).
2. Confirm the event name "HuskyHack Demo" appears on screen.
3. Enter your name in the name field (e.g., "Demo Tester").
4. Select "Opt Out" / privacy preference.
5. When prompted for a reference photo, either grant camera access and capture a photo, or use the file upload fallback.
6. Submit the form.

**Expected result (pass):**
- The page resolves the event from the key without requiring sign-in.
- The name field accepts input.
- Camera capture shows a live preview; a countdown or "Capture" button takes the photo.
- On submit, a success confirmation is shown (e.g., "You've been registered" or similar).
- No JavaScript errors in the browser console during any step.

**Failure looks like:** "Event not found" shown on page load, camera permission dialog never appears, form submit triggers a 400/404 from the backend, or the confirmation screen never appears.

---

### TC-07 — Verify new attendee in backend

**Label:** SAFE

**Command (run after TC-06 submit):**

```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:5000/events/1/attendees?opted_out=true" | ConvertTo-Json -Depth 5
```

**Expected result (pass):** The response array now contains 5 records (the 4 seeded + "Demo Tester"). The new record must include:

```json
{
  "name": "Demo Tester",
  "consent_status": "opted_out",
  "opted_out": true,
  "reference_photo_url": "/uploads/attendees/<uuid>.<ext>"
}
```

**Critical check:** `reference_photo_url` must begin with `/uploads/attendees/` and NOT begin with `data:image/`. A `data:` URL in the database means the backend image-save path is broken.

**Failure looks like:** "Demo Tester" does not appear, or `reference_photo_url` is `null`, or `reference_photo_url` starts with `data:image/`.

---

### TC-08 — Reference photo is served as a file

**Label:** SAFE

**Step A — Get the URL from TC-07.** Copy the `reference_photo_url` value, e.g. `/uploads/attendees/abc123.jpg`.

**Step B — Fetch the file:**

```powershell
$url = "http://127.0.0.1:5000/uploads/attendees/<filename-from-tc07>"
Invoke-WebRequest -Uri $url -OutFile "$env:TEMP\anonify-ref-check.jpg"
Get-Item "$env:TEMP\anonify-ref-check.jpg" | Select-Object Length
```

**Expected result (pass):** File downloads successfully (HTTP 200) and its `Length` is greater than 1000 bytes (i.e., it is a real image, not an empty file).

**Failure looks like:** HTTP 404 (file was not written to disk), HTTP 500, or the downloaded file is 0 bytes.

---

### TC-09 — Dashboard loads and shows opted-out attendees

**Label:** SAFE

**Prerequisite:** Signed in as organizer (TC-05 complete).

**URL:** `http://localhost:3000/dashboard`

**Steps:**
1. Navigate to the dashboard.
2. Confirm the "HuskyHack Demo" event is listed (either auto-loaded or selectable).
3. Locate the attendee/privacy section.
4. Confirm the 4 seeded opted-out attendees appear: Maya Chen, Jordan Lee, Alex Rivera, Sam Park.

**Expected result (pass):** Each opted-out attendee is listed. Seeded attendees have no reference photo in the database, so an avatar placeholder (initials or icon) should render in place of a photo. No blank names or missing rows.

**Failure looks like:** Dashboard shows "No attendees", the page crashes with an unhandled error, or only consented attendees appear.

---

### TC-10 — Event photo list loads from backend

**Label:** SAFE

**URL:** `http://localhost:3000/dashboard` (same session as TC-09)

**Steps:**
1. In the dashboard, navigate to the photos section.
2. Confirm the 4 seeded photos appear: `group_photo_1.jpg`, `panel_discussion.jpg`, `hackathon_floor.jpg`, `awards_ceremony.jpg`.
3. Confirm status badges are shown: `processed` (photos 1–2), `processing` (photo 3), `pending` (photo 4).

**Command to cross-check:**

```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:5000/events/1/photos" | ConvertTo-Json -Depth 3
```

**Expected result (pass):** 4 photos returned with the correct filenames and statuses.

**Failure looks like:** Empty photo list, wrong statuses, or photos section does not render.

---

### TC-11 — Photo review panel — detections and confidence scores

**Label:** SAFE

**URL:** `http://localhost:3000/dashboard` (photo review view)

**Steps:**
1. Select `group_photo_1.jpg` (status: `processed`).
2. Open the photo review / detail view.
3. Confirm detections are displayed for this photo.

**Expected result (pass):** The review panel shows 3 detections:

| Attendee | Confidence | Status |
|---|---|---|
| Maya Chen | 91% | auto_blurred |
| Jordan Lee | 63% | pending_review |
| Sam Park | 45% | pending_review |

Jordan Lee and Sam Park must have a "manual review required" indicator. Maya Chen must show as auto-blurred.

**Command to verify backend data directly:**

```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:5000/events/1/photos/1" | ConvertTo-Json -Depth 5
```

**Failure looks like:** "No detections found" panel, wrong confidence values, wrong attendee names, or the review panel never opens.

Note: the `reviewModel` displayed in the UI currently comes from `getMockPhotoReviewModel()` (mock fixtures), not live backend detections. The backend detections returned by `adaptPhotoDetail()` are the canonical data. Expect the UI figures/participants panel to show fixture-based data that may not match the names above exactly — see TC-13 for details.

---

### TC-12 — Event photo upload from dashboard

**Label:** CAUTION

**Steps:**
1. In the dashboard photos section, use the upload control to upload any JPEG or PNG file from your machine.
2. Confirm the upload is accepted and a new photo entry appears in the list.
3. The new photo should appear with status `pending` initially.

**Expected result (pass):** A POST to `/events/1/photos` is triggered with `"source": "upload"`. The new photo row appears in the UI. The backend responds with HTTP 201.

**Command to verify:**

```powershell
$body = '{"filename":"test-upload.jpg","source":"upload"}'
Invoke-RestMethod -Method POST -Uri "http://127.0.0.1:5000/events/1/photos" `
  -ContentType "application/json" -Body $body | ConvertTo-Json
```

**Failure looks like:** The upload button does nothing, a 400 from the backend ("Missing or invalid filename"), or the new photo does not appear in the list.

---

### TC-13 — Local detection / Anonymize button

**Label:** CAUTION

**Steps:**
1. Select a photo in the dashboard (use `group_photo_1.jpg` for best results — it has seeded detections).
2. Click the "Anonymize" or "Process" button.
3. Observe the result.

**Expected result (pass — with AI helper running):** A POST is sent to `/events/1/photos/1/process`. The Flask backend calls the AI helper at `http://127.0.0.1:8001/match-photo` and `/redact`. The photo status updates to `processed` or `failed`. The UI shows the updated status.

**Expected result (pass — without AI helper):** The backend returns HTTP 502 with `"error": "AI helper unavailable: ..."`. The UI should display a graceful error state (not a blank screen or crash). Photo status is set to `failed`.

**Critical limitation (known):** The organizer review panel currently calls `getMockPhotoReviewModel()` to populate the figures/participants view regardless of what the AI helper returns. Real detection results from `/match-photo` are persisted to the backend database but NOT reflected in the live UI review model. The mock fixture figures will show instead. This is a known gap documented in `docs/test-runs/recognition-app-verification.md`.

**Failure looks like:** Browser console shows an unhandled exception, the Anonymize button appears frozen with no feedback, or the photo status does not change after processing.

---

### TC-14 — /redact endpoint (direct API test)

**Label:** SAFE

**Command:**

```powershell
$plan = @{
  photoId = "1"
  eventId = "1"
  originalImageUrl = "/mock-photos/group_photo_1.jpg"
  boxes = @(
    @{
      x = 100; y = 100; width = 250; height = 250
      reason = "opt_out_match"
      confidence = 0.91
      attendeeId = "1"
      attendeeName = "Maya Chen"
    }
  )
  needsManualReview = $false
}

$body = @{
  imagePath = "backend/runtime/processing/event_1/photo_1/group_photo_1.jpg"
  plan = $plan
  redactionMode = "blur"
} | ConvertTo-Json -Depth 5

Invoke-RestMethod -Method POST -Uri "http://127.0.0.1:8001/redact" `
  -ContentType "application/json" -Body $body | ConvertTo-Json
```

**Expected result (pass):** Response includes `"success": true`, `"boxesApplied": 1`, `"boxesSkipped": 0`. If `imagePath` does not exist on disk, the response will include `"success": false` with an error describing the missing file — this is still a pass for the endpoint itself (it handles it gracefully without crashing).

**Failure looks like:** HTTP 422 (invalid request shape), HTTP 500, or the helper crashes.

---

### TC-15 — Fallback behavior when AI helper is unavailable

**Label:** SAFE

**Setup:** Stop uvicorn (Ctrl+C in Terminal 2). Confirm TC-02 now fails with connection refused.

**Steps:**
1. In the dashboard, click "Anonymize" on any photo.
2. Observe the response.

**Expected result (pass):** The Flask backend catches the `requests.ConnectionError` in `call_match_and_redact()` and returns HTTP 502 with JSON:

```json
{
  "error": "AI helper unavailable: ..."
}
```

The UI must show an error state — not an infinite spinner, not a blank screen, not an unhandled exception. The photo status must be updated to `"failed"` in the backend (confirmed via `GET /events/1/photos`).

**Verification command:**

```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:5000/events/1/photos/1" | Select-Object -ExpandProperty status
```

Expected: `"failed"`.

**Failure looks like:** The frontend shows a blank page or unhandled React error boundary, the backend returns 500 instead of 502, or the photo status remains `"processing"` (stuck).

---

## What Is Safe to Demo Live

- Backend health check (TC-01) — instant, deterministic
- AI helper health check (TC-02) — instant, confirms Pillow + recognition flags
- Seed + attendee list (TC-03) — reliable, idempotent after DB reset
- Frontend startup (TC-04) — stable Next.js dev build
- Public opt-out flow on `/attend?eventKey=HUSKY-42F7` (TC-06) — works without sign-in; camera and file upload both function
- Verifying `reference_photo_url` is a `/uploads/...` path, not a data URL (TC-07, TC-08)
- Dashboard attendee list and seeded photo list (TC-09, TC-10)
- Photo review panel with seeded detections and mock confidence tiers (TC-11)
- `/redact` endpoint called directly with a hand-crafted bounding box (TC-14)
- AI helper unavailability graceful degradation (TC-15) — safe to show the 502 + failed status

---

## What Should NOT Be Demoed Live

- **Real face matching during a live upload (TC-13 with recognition)** — the recognition pipeline (`recognition-client.ts` → `/match-photo`) is disconnected from the organizer UI. Real match results never reach the review panel. Demoing "upload photo → see matches" will produce mock figures, not real AI output. The audience will see misleading behavior.

- **Claiming the review panel shows real AI detections** — the `PhotoReviewModel` displayed in the review panel always comes from `getMockPhotoReviewModel()` (mock fixture data), regardless of what the backend or AI helper return. This is a known wiring gap (see `docs/test-runs/recognition-app-verification.md`, Summary table).

- **Attempting YuNet/SFace recognition without confirming model files are present** — if `ai_redaction/models/face_detection_yunet_2023mar.onnx` or `ai_redaction/models/face_recognition_sface_2021dec.onnx` are missing, `recognitionAvailable` will be `false` and `/match-photo` returns `"recognition_unavailable"`. Run TC-02 first and confirm both flags are `true` before claiming recognition works.

- **Uploading real attendee faces as reference photos in the demo** — the reference photo capture on `/attend` stores a base64-encoded webcam snapshot. Webcam quality and face angles are unpredictable. Use only controlled test images (see `docs/test-runs/ai-recognition-spike-check.md`).

- **Demoing Google Drive photo source** — the seed inserts `awards_ceremony.jpg` with `source: "google_drive"` but no actual Drive integration is connected. The photo will show `pending` status and fail to process.

---

## Readiness Criteria

### 🟢 Green — fully demo-ready

- Flask backend (`/health`, `/seed`, `/attendees`, `/photos`) — stable and reliable
- Public opt-out flow at `/attend?eventKey=HUSKY-42F7` — functional end-to-end
- Reference photo save + serve at `/uploads/attendees/` — working
- AI helper `/health` and `/redact` endpoints — working when uvicorn is running
- Graceful degradation when AI helper is offline — working (502 returned, status set to `failed`)
- Seeded mock detections with confidence tiers (91%, 63%, 45%) in photo review panel — working
- Clerk sign-in and organizer dashboard rendering — working

### 🟡 Yellow — demo possible with caveats

- **AI detection via Anonymize button:** works at the API level (Flask → `/match-photo` → `/redact`) but results do not surface in the UI review panel. Demo the API call chain in a terminal or browser devtools network tab, not through the UI figures view.
- **YuNet/SFace recognition:** only available if ONNX model files are manually downloaded to `ai_redaction/models/`. Confirm with TC-02 before claiming recognition is live.
- **Photo upload flow (TC-12):** registers the filename in the backend but the actual image bytes are not stored server-side in the current implementation. Processing (`/process`) requires the file to exist on disk at a resolvable path.

### 🔴 Red — demo-blocking issues

- **Review panel review model is hardcoded to mock fixtures.** The organizer UI's `PhotoReviewModel` (figures, participants, confidence bands) always comes from `getMockPhotoReviewModel()`. Real detections persisted via `/process` are NOT reflected in the UI. Any live demo claiming "the AI found these faces" while pointing at the review panel is showing mock data. This must be clearly disclosed or fixed before a honest technical demo.
- **Recognition pipeline is disconnected from the UI.** `recognition-client.ts` exists and calls `/match-photo`, but it is never invoked by `anonify-experience.tsx`. A live attendee upload flow cannot produce real AI detection results in the UI without wiring `matchPhotoWithReferences()` into the upload handler.
