# Face Matching Spike

## Goal

Add an experimental local face-crop matcher for controlled anonify demo images.

This is not production-grade facial recognition. It is a local-only hackathon spike with no persistent embeddings, no external API calls, and no third-party image transfer.

## Files Changed

- `ai_redaction/face_matching.py`
- `docs/ai-sessions/09-face-matching-spike.md`

## Exported Functions

- `normalize_face_crop(image_crop)`
- `compare_face_crops(reference_crop, candidate_crop)`
- `confidence_from_similarity(similarity)`
- `status_from_confidence(confidence)`
- `match_photo_to_references(photo_path, attendees, event_id, photo_id)`

## Matching Method

- Detect faces in each opted-out attendee reference image.
- Detect faces in the event photo.
- Crop each face and normalize to `96x96` grayscale pixels.
- Compare normalized crops with a simple cosine-similarity score blended with mean-squared-difference agreement.
- Convert the similarity to a decimal confidence in the `0.0` to `1.0` range.
- Include detections at `>= 0.70` confidence.
- Mark detections `auto_blurred` at `>= 0.90` confidence.
- Mark detections `manual_review` from `0.70` to `0.89` confidence.
- Omit weak candidates below `0.70`.

If `ai_redaction/face_detection.py` is added later, the matcher will use its `detect_faces()` function. Until then, it uses a small OpenCV Haar-cascade fallback when OpenCV is installed. If detection dependencies are unavailable or detection fails, it returns a safe `no_match` result.

## Manual Test

Run from the repo root after installing the existing project requirements:

```bash
python - <<'PY'
from ai_redaction.face_matching import match_photo_to_references

result = match_photo_to_references(
    photo_path="tmp/event-photo.jpg",
    attendees=[
        {
            "attendeeId": "attendee_001",
            "attendeeName": "Maya Chen",
            "referenceImagePath": "tmp/maya-reference.jpg",
            "referenceImageUrl": "tmp/maya-reference.jpg",
        }
    ],
    event_id="event_demo",
    photo_id="photo_demo",
)

print(result)
PY
```

Expected output shape is compatible with the existing `PhotoProcessingResult` flow:

```json
{
  "photoId": "photo_demo",
  "eventId": "event_demo",
  "fileName": "event-photo.jpg",
  "originalImageUrl": "tmp/event-photo.jpg",
  "redactedImageUrl": null,
  "status": "match_found",
  "detections": [],
  "highestConfidence": 0.0,
  "needsManualReview": false
}
```

Actual detections depend on local image quality, pose, lighting, and whether the detector finds a face.

## Safety Behavior

- Empty attendee list returns `no_match`.
- Missing event photo path returns `no_match`.
- Missing reference image skips that attendee.
- No face detected returns `no_match`.
- Unreadable images return `no_match`.
- No embeddings are persisted.
- No image data leaves the local machine.

## Limitations

- This is a controlled-demo heuristic, not reliable identity verification.
- Haar-cascade detection is sensitive to pose, lighting, occlusion, and image resolution.
- Similar-looking faces can score high; the output should be reviewed by a human for uncertain cases.
- Confidence is a demo similarity score, not a calibrated biometric probability.
- The module does not alter the existing FastAPI `/health` or `/redact` endpoints.
