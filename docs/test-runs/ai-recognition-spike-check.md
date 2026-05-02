# AI Recognition Spike Manual Check

Date: 2026-05-02

Goal: provide a reproducible local-only manual test for the experimental face matching spike using controlled demo images.

This is not production-grade facial recognition. The spike does not persist embeddings, does not call external APIs, and should only be tested with local images under `tmp/`. Do not commit real people photos. Root `.gitignore` already ignores `tmp/`.

## Files

- Harness: `ai_redaction/demo_recognition_test.py`
- JSON report output: `tmp/ai_recognition_result.json`
- Derived redaction plan output: `tmp/ai_recognition_redaction_plan.json`
- Optional redacted image output: `tmp/group_redacted.jpg`

## Setup

Install local Python dependencies if needed:

```powershell
python -m pip install -r requirements.txt
```

Place controlled local sample images here:

```text
tmp/group.jpg
tmp/person.jpg
```

Use `tmp/group.jpg` for the event photo and `tmp/person.jpg` for the opted-out attendee reference photo. These files are ignored by git and should not be committed.

## Commands

Default controlled-image run:

```powershell
python ai_redaction/demo_recognition_test.py --photo tmp/group.jpg --reference tmp/person.jpg --attendee-name "Maya Chen"
```

Missing event photo path:

```powershell
python ai_redaction/demo_recognition_test.py --photo tmp/missing-group.jpg --reference tmp/person.jpg
```

Empty attendee list:

```powershell
python ai_redaction/demo_recognition_test.py --photo tmp/group.jpg --no-attendee
```

Missing reference path:

```powershell
python ai_redaction/demo_recognition_test.py --photo tmp/group.jpg --reference tmp/missing-person.jpg
```

No face detected:

```powershell
python ai_redaction/demo_recognition_test.py --photo tmp/no-face.jpg --reference tmp/person.jpg
```

Optional local `/redact` blur output after starting the FastAPI helper:

```powershell
uvicorn ai_redaction.server:app --reload --port 8001
```

Then, in another terminal:

```powershell
python ai_redaction/demo_recognition_test.py --photo tmp/group.jpg --reference tmp/person.jpg --attendee-name "Maya Chen" --redact
```

The harness only allows `/redact` URLs on `localhost`, `127.0.0.1`, or `::1`.

## What The Harness Checks

- Detection: reports whether OpenCV/Pillow/Numpy are available and how many faces were detected in the event photo and reference photo.
- Matching: calls `ai_redaction.face_matching.match_photo_to_references()` and writes the `PhotoProcessingResult`-compatible output in `tmp/ai_recognition_result.json`.
- Redaction plan compatibility: mirrors the frontend `createRedactionPlan()` behavior and writes `tmp/ai_recognition_redaction_plan.json` with `boxes` derived from detection bounding boxes.
- Blur: optionally posts the derived plan to the existing local FastAPI `/redact` endpoint and writes the blurred output path if boxes are present.

Detection, matching, and blur are separate checks. A detected face does not guarantee a match. A match with no bounding box cannot produce a blur box. Blur requires the local FastAPI helper and Pillow.

## Test Cases

| Case | Expected Result |
| --- | --- |
| Missing event photo path | Script exits successfully, reports `photo exists: False`, matching returns `no_match`, and writes JSON outputs. |
| Empty attendee list | Script exits successfully, skips reference detection, matching returns `no_match`, and redaction plan has zero boxes. |
| Missing reference path | Script exits successfully, reports reference missing, matching returns `no_match`, and redaction plan has zero boxes. |
| No face detected | Script exits successfully, reports zero event-photo faces or zero reference faces, matching returns `no_match`. |
| Successful controlled-image match | Pending user-provided local images. With suitable controlled images, matching should return one or more detections with confidence, status, and bounding boxes. |
| Output feeds redaction plan / blur | Redaction-plan JSON is generated every run. Optional `/redact` applies blur when the plan contains boxes and the helper is running. |

## Current Status

Controlled real-image matching is pending user-provided local images in `tmp/`. No real photos were committed.

The harness has been designed to avoid crashing on missing inputs and to keep the existing mock AI pipeline, redaction plan pipeline, FastAPI `/health` and `/redact` endpoints, and frontend photo review adapter untouched.

## Validation Run

Commands run during harness creation:

```powershell
python -m py_compile ai_redaction/demo_recognition_test.py
python ai_redaction/demo_recognition_test.py --photo tmp/missing-group.jpg --reference tmp/missing-person.jpg
python ai_redaction/demo_recognition_test.py --photo tmp/missing-group.jpg --no-attendee --output-json tmp/ai_recognition_empty_attendee_result.json --plan-json tmp/ai_recognition_empty_attendee_plan.json
python ai_redaction/demo_recognition_test.py --photo tmp/missing-group.jpg --reference tmp/missing-person.jpg --redact --output-json tmp/ai_recognition_redact_missing_result.json --plan-json tmp/ai_recognition_redact_missing_plan.json
```

Observed result: the script completed without crashing for missing event photo, missing reference photo, empty attendee list, and optional local `/redact` invocation. Successful recognition matching remains pending controlled sample images supplied locally under `tmp/`.
