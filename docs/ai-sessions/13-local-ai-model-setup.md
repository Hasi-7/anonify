# Local AI Model Setup and Demo-Safe Limitations

## Goal

Document where the YuNet/SFace ONNX models live, how to download them, how to
verify the active recognition path, and how to use the manual test harness
safely. Also clarifies what the stable demo path is and what must not be
committed to git.

---

## Model Files

The YuNet face detector and SFace embedding recognizer are stored locally as
ONNX files. They are **not part of the repository** and must be downloaded once
per machine.

| File | Purpose | Approx. size |
|------|---------|-------------|
| `ai_redaction/models/face_detection_yunet_2023mar.onnx` | YuNet face detector (`cv2.FaceDetectorYN`) | ~232 KB |
| `ai_redaction/models/face_recognition_sface_2021dec.onnx` | SFace 128-d embeddings (`cv2.FaceRecognizerSF`) | ~38 MB |

Both files come from the [opencv_zoo](https://github.com/opencv/opencv_zoo)
repository. They contain pre-trained weights only — no user data, no image
embeddings, no recognition history.

---

## Downloading the Models (PowerShell)

Run from the repository root with your virtual environment active:

```powershell
# YuNet face detector (~232 KB)
Invoke-WebRequest `
  -Uri "https://github.com/opencv/opencv_zoo/raw/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx" `
  -OutFile "ai_redaction\models\face_detection_yunet_2023mar.onnx"

# SFace embedding recognizer (~38 MB — may take a moment)
Invoke-WebRequest `
  -Uri "https://github.com/opencv/opencv_zoo/raw/main/models/face_recognition_sface/face_recognition_sface_2021dec.onnx" `
  -OutFile "ai_redaction\models\face_recognition_sface_2021dec.onnx"
```

Verify the files landed in the right place:

```powershell
Get-ChildItem ai_redaction\models\*.onnx | Select-Object Name, Length
```

Expected output:

```
face_detection_yunet_2023mar.onnx     237568
face_recognition_sface_2021dec.onnx  40632320
```

OpenCV version `>= 4.5` is required. The installed version can be checked with:

```powershell
python -c "import cv2; print(cv2.__version__)"
```

---

## Verifying the Active Recognition Path

After running `demo_recognition_test.py` (see below), the JSON report at
`tmp/ai_recognition_result.json` contains a `dependencies` block:

```json
{
  "dependencies": {
    "activePath": "yunet_sface",
    "yunetModelAvailable": true,
    "sfaceModelAvailable": true,
    "yunetSfaceAvailable": true,
    "opencvAvailable": true
  }
}
```

`activePath` will be one of:

| Value | Meaning |
|-------|---------|
| `"yunet_sface"` | Both ONNX files found; DNN pipeline is active. |
| `"haar_fallback"` | One or both ONNX files missing; Haar cascade is used instead. |

If `activePath` is `"haar_fallback"` after you placed the files, check that
the filenames match exactly (no extra suffix or version number).

---

## Running the Manual Test Harness

`demo_recognition_test.py` is a controlled local harness for testing face
recognition against demo images. It does not run as part of the normal server
stack and makes no external calls.

**Basic run (recognition only):**

```powershell
python ai_redaction/demo_recognition_test.py `
  --photo tmp\recognition-event-photo.jpg `
  --reference tmp\recognition-reference-person.jpg `
  --attendee-name "Maya Chen" `
  --debug
```

**With local blur check (requires FastAPI helper on `localhost:8001`):**

```powershell
python ai_redaction/demo_recognition_test.py `
  --photo tmp\recognition-event-photo.jpg `
  --reference tmp\recognition-reference-person.jpg `
  --attendee-name "Maya Chen" `
  --redact
```

**Output files written to `tmp/`:**

| File | Contents |
|------|---------|
| `tmp/ai_recognition_result.json` | Full recognition report including `dependencies.activePath` |
| `tmp/ai_recognition_redaction_plan.json` | Redaction plan derived from matched detections |
| `tmp/recognition-debug-yunet-boxes.jpg` | Debug image with face boxes (green = accepted, red = rejected with score label) |

`tmp/` is gitignored. Do not move these files into tracked directories.

---

## What `no_match` Means

A result with `"status": "no_match"` means the pipeline found no face in the
event photo that cleared the confidence threshold for any opt-out attendee.
It is not an error — it is the correct safe outcome when:

- No faces were detected in the event photo.
- Faces were detected but none matched a reference above the `manual_review`
  threshold (normalised score < 0.70).
- The attendee list was empty.
- The reference image had no detectable face.
- Both ONNX files were missing and Haar also found nothing.

`no_match` is always safe: it means no one will be incorrectly auto-blurred.

**Confidence thresholds for context:**

| Normalised score | Status |
|-----------------|--------|
| >= 0.90 | `auto_blurred` |
| 0.70 – 0.89 | `manual_review` |
| < 0.70 | omitted → `no_match` |

---

## Why Live Recognition Is Experimental

The YuNet/SFace pipeline is a hackathon spike, not a production-grade identity
verification system. Specific limitations:

- **Pose sensitivity.** SFace embeddings are 128-d and degrade significantly
  across large pose or lighting changes between the reference selfie and the
  event photo.
- **Group photos.** YuNet performs better than Haar on wide-angle shots but
  still misses partially occluded or strongly side-on faces.
- **Confidence values are demo similarity scores**, not calibrated biometric
  probabilities. The SFace "same person" boundary (~0.68 normalised) sits just
  below the `manual_review` threshold — deliberately conservative.
- **No persistence.** Embeddings are computed in-process and discarded.
  Re-running the same photo produces the same result, but nothing is cached.
- The pipeline requires controlled demo images (clear reference selfie, decent
  lighting) to produce reliable matches at the hackathon.

For these reasons, live recognition is opt-in via model installation and the
`--debug` harness. It is not the default path for a stable demo.

---

## The Stable Demo Path

For a reliable demo presentation, use **seeded review detections with real
redaction blur** rather than live recognition:

1. Seed the backend with demo event `HUSKY-42F7`:
   ```powershell
   Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:5000/seed"
   ```
2. Start all three servers (Next.js on 3000, Flask on 5000, FastAPI on 8001).
3. Open the organizer dashboard and navigate to **Photo Review**.
4. The seeded detections provide realistic confidence values and manual-review
   states without depending on ONNX model availability or reference photo quality.
5. Real blur is applied by the FastAPI helper at `localhost:8001` when the
   organizer approves a detection — this path works independently of face
   recognition.

The seeded-detection + real-blur path is what to demo if the ONNX models are
not installed, the reference photos are not available, or live recognition
produces poor matches on the day.

---

## Git Safety Warnings

### Do not commit ONNX model files

The ONNX model files (`*.onnx` in `ai_redaction/models/`) must not be committed
to the repository unless explicitly approved by the team lead. Each file is
up to 38 MB and is sourced from a public third-party repository (opencv_zoo).
Committing them inflates git history permanently and is unnecessary since any
developer can download them in seconds with the commands above.

The root `.gitignore` does not currently exclude `*.onnx` files. Until that is
updated, verify `git status` before staging and do not `git add` the models
directory. The models README documents the same restriction.

### Do not commit `tmp/` photos or `uploads/`

`tmp/` and `uploads/` are gitignored at the root. Any photos placed there for
recognition testing (event photos, reference selfies, debug images) must stay
there. Do not copy real faces or attendee reference images into tracked
directories.

---

## Related Sessions

- `08-face-detection-spike.md` — YuNet detection layer, `YUNET_AVAILABLE` flag
- `09-face-matching-spike.md` — YuNet/SFace pipeline, thresholds, output shape
- `12-recognition-client-stub.md` — Backend adapter for recognition results
