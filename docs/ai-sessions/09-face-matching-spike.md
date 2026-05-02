# Face Matching Spike

## Goal

Add an experimental local face-crop matcher for controlled anonify demo images.

This is not production-grade facial recognition. It is a local-only hackathon spike with no persistent embeddings, no external API calls, and no third-party image transfer.

## Files Changed

- `ai_redaction/face_detection.py` — added `detect_faces_yunet()`, `YUNET_AVAILABLE`
- `ai_redaction/face_matching.py` — added YuNet/SFace pipeline, `match_photo_to_references_yunet_sface()`
- `ai_redaction/models/README.md` — documents required model files and download instructions
- `ai_redaction/demo_recognition_test.py` — YuNet/SFace status in dependency report, updated debug output
- `docs/ai-sessions/09-face-matching-spike.md`

## Detection / Recognition Paths

### Preferred: YuNet + SFace (DNN)

Requires two ONNX model files in `ai_redaction/models/`:

| File | Purpose |
|------|---------|
| `face_detection_yunet_2023mar.onnx` | YuNet face detector (`cv2.FaceDetectorYN`) |
| `face_recognition_sface_2021dec.onnx` | SFace 128-d embeddings (`cv2.FaceRecognizerSF`) |

Download commands:

```bash
curl -L -o ai_redaction/models/face_detection_yunet_2023mar.onnx \
  "https://github.com/opencv/opencv_zoo/raw/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx"

curl -L -o ai_redaction/models/face_recognition_sface_2021dec.onnx \
  "https://github.com/opencv/opencv_zoo/raw/main/models/face_recognition_sface/face_recognition_sface_2021dec.onnx"
```

Both files are gitignored. The pipeline degrades safely when they are absent.

**OpenCV version requirement:** `opencv-python-headless >= 4.5` (already in `requirements.txt`).
`cv2.FaceDetectorYN` and `cv2.FaceRecognizerSF` were confirmed available at OpenCV 4.13.0.

### Fallback: Haar cascade + pixel cosine similarity

Used automatically when model files are absent. Less accurate — susceptible to false
positives on group photos (bottles, chairs, textures). The Haar path remains available
but is no longer the preferred default.

### Safe no_match

Returned when all detection paths fail or required inputs are missing.

## YuNet/SFace Pipeline

```
detect_faces_yunet(image_path)
  └─ _load_cv2_image_exif()    # EXIF-corrected BGR ndarray
  └─ FaceDetectorYN.detect()   # raw rows (N × 15): x,y,w,h, 5 landmarks, score
  └─ filter: score < 0.5, size < 40px, area < 1600 px²
  └─ → list[FaceBox] with source="opencv_yunet", confidence per box

match_photo_to_references_yunet_sface(photo_path, attendees, ...)
  └─ _load_bgr_exif()          # event photo, EXIF-corrected
  └─ _detect_yunet_raw()       # raw rows (landmarks needed by alignCrop)
  └─ per reference attendee:
  │    _detect_yunet_raw()     # reference photo
  │    largest face if multiple (warning recorded)
  │    extract_sface_embedding() → alignCrop + feature() → 128-d float32
  └─ per event-photo face:
       extract_sface_embedding()
       compare_sface_embeddings() → cosine via FaceRecognizerSF.match()
         score ∈ [-1, 1] → normalized (score+1)/2 ∈ [0, 1]
         SFace same-person threshold ≈ 0.363 raw ≈ 0.68 normalised
```

## Confidence Thresholds

| Normalised score | Status |
|-----------------|--------|
| >= 0.90 | `auto_blurred` |
| 0.70 – 0.89 | `manual_review` |
| < 0.70 | omitted (`no_match`) |

The SFace "same person" boundary (~0.68 normalised) sits just below the
`manual_review` threshold — deliberately conservative so uncertain matches
surface for human review rather than being auto-blurred.

## Exported Functions

### face_detection.py
- `detect_faces(image_path)` → `list[FaceBox]` (Haar cascade)
- `detect_faces_yunet(image_path)` → `list[FaceBox]` (YuNet, preferred)
- `is_valid_face_box(x, y, w, h, W, H)` → `bool`
- `load_image_safely(image_path)` → `PIL.Image | None`
- `clamp_box_to_image(box, w, h)` → `FaceBox`
- `crop_face(image_path, box)` → `PIL.Image | None`
- `YUNET_AVAILABLE` → `bool`

### face_matching.py
- `match_photo_to_references(photo_path, attendees, event_id, photo_id)` → `dict`
- `match_photo_to_references_yunet_sface(...)` → `dict`
- `extract_sface_embedding(img_bgr, face_row)` → `ndarray | None`
- `compare_sface_embeddings(ref, cand)` → `float`
- `normalize_face_crop(crop)`, `compare_face_crops(ref, cand)` (Haar path)
- `confidence_from_similarity(sim)`, `status_from_confidence(conf)`
- `YUNET_SFACE_AVAILABLE`, `YUNET_MODEL_AVAILABLE`, `SFACE_MODEL_AVAILABLE` → `bool`

## Manual Test

```bash
python ai_redaction/demo_recognition_test.py \
  --photo tmp/recognition-event-photo.jpg \
  --reference tmp/recognition-reference-person.jpg \
  --attendee-name "Test Person" \
  --debug
```

The `dependencies.activePath` field in the JSON report (`tmp/ai_recognition_result.json`)
shows which path is active: `"yunet_sface"` or `"haar_fallback"`.

The debug image is written to `tmp/recognition-debug-yunet-boxes.jpg`. Green boxes are
accepted face detections, labelled with their YuNet detection confidence score.

## Reference Photo Handling

- **Zero faces detected** → attendee skipped silently.
- **Multiple faces detected** → largest face (by bounding-box area) is used; a
  `"warning": "multiple_faces_in_reference"` field is added to the detection record.
- **Single clear face** → used directly.

## Output Shape

All paths return a `PhotoProcessingResult`-compatible dict:

```json
{
  "photoId": "...",
  "eventId": "...",
  "fileName": "...",
  "originalImageUrl": "...",
  "redactedImageUrl": null,
  "status": "match_found | manual_review | no_match",
  "detections": [
    {
      "id": "...",
      "photoId": "...",
      "attendeeId": "...",
      "attendeeName": "...",
      "referenceImageUrl": "...",
      "confidence": 0.83,
      "status": "manual_review",
      "boundingBox": {"x": 120, "y": 45, "width": 98, "height": 112},
      "detectionConfidence": 0.9741
    }
  ],
  "highestConfidence": 0.83,
  "needsManualReview": true
}
```

## Safety Behaviour

- Empty attendee list → `no_match`.
- Missing photo path → `no_match`.
- Missing reference image → attendee skipped.
- No face detected → `no_match`.
- Model files absent → Haar fallback (then `no_match` if Haar also unavailable).
- No embeddings are persisted.
- No image data leaves the local machine.
- `/redact` endpoint is unaffected by any recognition path.

## Limitations

- This is a controlled-demo heuristic, not reliable identity verification.
- YuNet performs better than Haar on group/wide-angle photos but still misses
  partially occluded or strongly side-on faces.
- SFace embeddings are 128-d and are sensitive to large pose/lighting changes
  between the reference and event photos.
- Confidence values are demo similarity scores, not calibrated biometric probabilities.
- **Mock detections remain the default for stable demo.** The recognition spike is
  opt-in via model file installation and the `--debug` harness.

## Local-Only Privacy Policy

All processing runs in-process on the local machine. No embeddings, face crops,
or recognition scores are written to disk, sent over the network, or stored in
any database. Model files contain pre-trained weights only — no user data.
`tmp/` images used for testing are gitignored.
