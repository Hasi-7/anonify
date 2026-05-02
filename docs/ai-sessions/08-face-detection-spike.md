# Face Detection Spike

## Goal

Create a standalone local face-detection utility (`ai_redaction/face_detection.py`) that the face-matching pipeline can use as its detection back-end. This is the "Agent A" deliverable referenced in `09-face-matching-spike.md`.

**EXPERIMENTAL — hackathon spike only.** Not production-grade facial recognition. All processing is local. No embeddings are persisted. No images are sent to external services.

---

## Files Changed

| File | Action |
|------|--------|
| `ai_redaction/face_detection.py` | Created |
| `docs/ai-sessions/08-face-detection-spike.md` | Created (this file) |

Files **not touched**: `ai_redaction/server.py`, `ai_redaction/apply_redaction.py`, `ai_redaction/face_matching.py`, frontend, backend, auth.

---

## Dependencies (already in `requirements.txt`)

| Package | Version pin | Purpose |
|---------|-------------|---------|
| `opencv-python-headless` | `>=4.10.0.84` | Haar cascade detection |
| `pillow` | `>=10.4.0` | Image open / crop / resize |
| `numpy` | `>=1.26.0` | Used downstream in face_matching |

No new packages were added. The module fails gracefully if any are not installed.

---

## Exported Functions

### `detect_faces(image_path: str) -> list[FaceBox]`

Detect frontal faces using the OpenCV Haar cascade (`haarcascade_frontalface_default.xml`).

Returns a list of `FaceBox` dicts. Returns `[]` on any failure (OpenCV missing, bad path, no faces found, cascade file missing). Boxes are clamped to image bounds before being returned.

```python
from ai_redaction.face_detection import detect_faces

faces = detect_faces("tmp/event-photo.jpg")
# [{"x": 120, "y": 80, "width": 64, "height": 80, "confidence": None, "source": "opencv_haar"}]
```

### `load_image_safely(image_path: str) -> PIL.Image | None`

Open an image file and return a PIL Image (`RGB` mode), or `None` on any failure. Does not raise.

### `clamp_box_to_image(box: FaceBox, image_width: int, image_height: int) -> FaceBox`

Return a new `FaceBox` whose `x`, `y`, `width`, and `height` are adjusted so the box fits entirely within the image bounds.

### `crop_face(image_path: str, box: FaceBox, output_size=(96, 96)) -> PIL.Image | None`

Open the image, clamp the box, crop the face region, and resize it to `output_size` (default `96×96`). Returns a PIL Image or `None` if the image cannot be opened or the clamped box has zero area.

---

## FaceBox Shape

```python
class FaceBox(TypedDict, total=False):
    x: int
    y: int
    width: int
    height: int
    confidence: float | None   # None for Haar cascade (no per-detection score)
    source: str                 # always "opencv_haar" for this module
```

The `confidence` and `source` fields are optional extras. `face_matching._coerce_box()` handles them via `.get()` and drops them cleanly when building its own `FaceBox`.

---

## Integration with `face_matching.py`

`face_matching.py` imports at module load time:

```python
try:
    from .face_detection import detect_faces as agent_detect_faces
except ImportError:
    agent_detect_faces = None
```

When `agent_detect_faces` is available (i.e., this file exists), `_detect_faces_local()` delegates to it. If not, it falls back to its own inline Haar-cascade implementation. With this file in place, the fallback is no longer reached.

No changes to `face_matching.py` are required.

---

## Manual CLI Test

Run from the repo root after `pip install -r requirements.txt`:

```bash
python -m ai_redaction.face_detection tmp/sample.jpg
```

**Expected output — faces found:**
```json
{
  "imagePath": "tmp/sample.jpg",
  "facesFound": 1,
  "faces": [
    {
      "x": 120,
      "y": 80,
      "width": 64,
      "height": 80,
      "confidence": null,
      "source": "opencv_haar"
    }
  ]
}
```

**Expected output — file not found:**
```json
{
  "error": "File not found: tmp/sample.jpg",
  "faces": []
}
```

**Expected output — OpenCV not installed:**
```json
{
  "error": "opencv-python-headless is not installed. Run: pip install -r requirements.txt",
  "faces": []
}
```

**Expected output — no faces detected:**
```json
{
  "imagePath": "tmp/no-face.jpg",
  "facesFound": 0,
  "faces": []
}
```

---

## Acceptance Criteria

| Criterion | Met |
|-----------|-----|
| Missing image path → safe error JSON, no exception | Yes |
| No-face image → `[]` | Yes |
| Detected faces → bounding box list | Yes |
| No new packages installed | Yes |
| `/redact` and `/health` FastAPI endpoints untouched | Yes |
| Existing mock pipeline untouched | Yes |

---

## Limitations

- Haar cascade is sensitive to face angle (frontal only), occlusion, lighting, and image resolution. Profile faces and partially obscured faces will be missed.
- `confidence` is always `null` — the Haar cascade does not expose per-detection scores. Only the presence/absence of a box is meaningful.
- Very small faces (below `32×32` pixels) are skipped by `minSize`.
- This module does not replace robust face detection (MTCNN, RetinaFace, etc.). It is sufficient for controlled demo images with well-lit frontal faces.
- Output is non-deterministic across OpenCV versions if the cascade file changes.
