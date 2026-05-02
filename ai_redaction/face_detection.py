"""
face_detection.py — local face detection for anonify's AI/redaction pipeline.

EXPERIMENTAL: hackathon spike only. Not production-grade facial recognition.
All processing is local. No embeddings are persisted. No images sent externally.

Provides:
    detect_faces(image_path)            -> list[FaceBox]   (Haar cascade)
    detect_faces_yunet(image_path)      -> list[FaceBox]   (YuNet DNN, preferred)
    is_valid_face_box(x, y, w, h, W, H) -> bool
    load_image_safely(image_path)       -> PIL.Image | None
    clamp_box_to_image(box, w, h)       -> FaceBox
    crop_face(image_path, box)          -> PIL.Image | None

Dependencies: opencv-python-headless, pillow, numpy (all in requirements.txt).
YuNet requires ai_redaction/models/face_detection_yunet_2023mar.onnx (see models/README.md).
The module degrades safely if any are missing — functions return [] or None.

CLI usage:
    python -m ai_redaction.face_detection tmp/sample.jpg
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Optional, TypedDict

# ---------------------------------------------------------------------------
# Model paths (relative to this file — never hardcoded absolute paths)
# ---------------------------------------------------------------------------

_MODELS_DIR = Path(__file__).parent / "models"
_YUNET_MODEL_PATH = _MODELS_DIR / "face_detection_yunet_2023mar.onnx"

try:
    import cv2
    OPENCV_AVAILABLE = True
except ImportError:  # pragma: no cover
    cv2 = None  # type: ignore[assignment]
    OPENCV_AVAILABLE = False

try:
    from PIL import Image, ImageOps
    PILLOW_AVAILABLE = True
except ImportError:  # pragma: no cover
    Image = None  # type: ignore[assignment]
    ImageOps = None  # type: ignore[assignment]
    PILLOW_AVAILABLE = False

try:
    import numpy as np
    NUMPY_AVAILABLE = True
except ImportError:  # pragma: no cover
    np = None  # type: ignore[assignment]
    NUMPY_AVAILABLE = False

# YuNet requires OpenCV DNN module (included in opencv-python-headless >= 4.5).
# Model file must be present at the path above.
YUNET_AVAILABLE = OPENCV_AVAILABLE and _YUNET_MODEL_PATH.exists()


# ---------------------------------------------------------------------------
# Types
# ---------------------------------------------------------------------------


class FaceBox(TypedDict, total=False):
    x: int
    y: int
    width: int
    height: int
    confidence: Optional[float]
    source: str


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# A face box must meet these minimums to be considered real
_MIN_FACE_DIM = 40
_MIN_FACE_AREA = 1600

# YuNet score threshold for the public detect_faces_yunet() API.
# A stricter threshold (0.85) is used here so displayed boxes represent real faces.
# The matching pipeline in face_matching.py uses a separate, lower threshold for
# reference photos where the portrait face may have a lower YuNet confidence.
_YUNET_DISPLAY_SCORE_THRESHOLD = 0.85

# Face aspect ratio guard: reject boxes whose w/h ratio is outside this range.
# Human faces are roughly square-ish; extreme values indicate non-face detections.
_MIN_FACE_ASPECT = 0.4   # w/h; reject very tall narrow boxes
_MAX_FACE_ASPECT = 2.0   # w/h; reject very wide flat boxes

# Multiple parameter sweeps improve recall on group/event photos
_DETECT_PARAMS = [
    {"scaleFactor": 1.05, "minNeighbors": 4, "minSize": (40, 40)},
    {"scaleFactor": 1.1,  "minNeighbors": 5, "minSize": (32, 32)},
    {"scaleFactor": 1.2,  "minNeighbors": 3, "minSize": (48, 48)},
]


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _load_cv2_image(image_path: str):
    """Return a cv2 BGR ndarray via cv2.imread, or None."""
    if not OPENCV_AVAILABLE:
        return None
    try:
        img = cv2.imread(str(image_path))
        return img
    except Exception:  # noqa: BLE001
        return None


def _load_cv2_image_exif(image_path: str):
    """Load via PIL (applying EXIF rotation), convert to cv2 BGR ndarray.

    Falls back to _load_cv2_image when PIL or numpy is unavailable.
    Skipping EXIF correction is the most common cause of corner false positives:
    a rotated portrait fed to a landscape-tuned cascade produces detections at (0,0).
    """
    if not PILLOW_AVAILABLE or not NUMPY_AVAILABLE or not OPENCV_AVAILABLE:
        return _load_cv2_image(image_path)
    try:
        pil_img = Image.open(image_path)
        pil_img = ImageOps.exif_transpose(pil_img)
        rgb_array = np.array(pil_img.convert("RGB"))
        return cv2.cvtColor(rgb_array, cv2.COLOR_RGB2BGR)
    except Exception:  # noqa: BLE001
        return _load_cv2_image(image_path)


def _haar_cascade():
    """Return a loaded frontal-face CascadeClassifier or None."""
    if not OPENCV_AVAILABLE:
        return None
    try:
        cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
        detector = cv2.CascadeClassifier(cascade_path)
        return None if detector.empty() else detector
    except Exception:  # noqa: BLE001
        return None


def _iou(a: tuple[int, int, int, int], b: tuple[int, int, int, int]) -> float:
    """Intersection-over-union for two (x, y, w, h) tuples."""
    ax, ay, aw, ah = a
    bx, by, bw, bh = b
    ix = max(ax, bx)
    iy = max(ay, by)
    iw = min(ax + aw, bx + bw) - ix
    ih = min(ay + ah, by + bh) - iy
    if iw <= 0 or ih <= 0:
        return 0.0
    intersection = iw * ih
    union = aw * ah + bw * bh - intersection
    return intersection / union if union > 0 else 0.0


def _deduplicate(
    boxes: list[tuple[int, int, int, int]],
    iou_threshold: float = 0.4,
) -> list[tuple[int, int, int, int]]:
    """Remove overlapping detections, keeping the larger box when IoU >= threshold."""
    sorted_boxes = sorted(boxes, key=lambda b: b[2] * b[3], reverse=True)
    kept: list[tuple[int, int, int, int]] = []
    for box in sorted_boxes:
        if all(_iou(box, k) < iou_threshold for k in kept):
            kept.append(box)
    return kept


# ---------------------------------------------------------------------------
# Public validation
# ---------------------------------------------------------------------------


def is_valid_face_box(
    x: int, y: int, w: int, h: int, image_width: int, image_height: int,
    *,
    check_aspect: bool = True,
) -> bool:
    """Return True only if the box describes a plausible face region.

    Rejects boxes that are:
    - too small (w or h < 40, area < 1600)
    - out of image bounds
    - at the top-left corner (x <= 5 and y <= 5) — a Haar cascade false-positive
      signature seen when images have uncorrected EXIF rotation
    - aspect ratio w/h outside [_MIN_FACE_ASPECT, _MAX_FACE_ASPECT] when check_aspect=True
    """
    if w < _MIN_FACE_DIM or h < _MIN_FACE_DIM:
        return False
    if w * h < _MIN_FACE_AREA:
        return False
    if x < 0 or y < 0:
        return False
    if x + w > image_width or y + h > image_height:
        return False
    if x <= 5 and y <= 5:
        return False
    if check_aspect:
        aspect = w / h
        if aspect < _MIN_FACE_ASPECT or aspect > _MAX_FACE_ASPECT:
            return False
    return True


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def load_image_safely(image_path: str) -> Optional["Image.Image"]:
    """Open an image file and return a PIL Image, or None on any failure."""
    if not PILLOW_AVAILABLE:
        return None
    try:
        return Image.open(image_path).convert("RGB")
    except Exception:  # noqa: BLE001
        return None


def clamp_box_to_image(box: FaceBox, image_width: int, image_height: int) -> FaceBox:
    """Return a new FaceBox whose coordinates are clamped to the image bounds."""
    x = max(0, box["x"])
    y = max(0, box["y"])
    right = min(image_width, x + box["width"])
    bottom = min(image_height, y + box["height"])
    clamped: FaceBox = {
        "x": x,
        "y": y,
        "width": max(0, right - x),
        "height": max(0, bottom - y),
        "confidence": box.get("confidence"),
        "source": box.get("source", "opencv_haar"),
    }
    return clamped


def detect_faces(image_path: str) -> list[FaceBox]:
    """Detect frontal faces in a local image using OpenCV Haar cascade.

    Improvements over a single detectMultiScale call:
    - EXIF-corrects the image via PIL before passing to OpenCV (fixes rotated images
      that produce false-positive detections at the image corner)
    - Applies histogram equalization to improve contrast on dim/flat images
    - Sweeps multiple scaleFactor / minNeighbors / minSize combinations
    - Deduplicates overlapping candidates by IoU
    - Validates each box with is_valid_face_box before returning

    Returns [] on any failure: missing OpenCV, unreadable image, no valid faces.
    """
    if not OPENCV_AVAILABLE:
        return []

    detector = _haar_cascade()
    if detector is None:
        return []

    img = _load_cv2_image_exif(image_path)
    if img is None:
        return []

    image_height, image_width = img.shape[:2]

    try:
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        gray = cv2.equalizeHist(gray)
    except Exception:  # noqa: BLE001
        return []

    raw_boxes: list[tuple[int, int, int, int]] = []
    for params in _DETECT_PARAMS:
        try:
            faces = detector.detectMultiScale(gray, **params)
            if not hasattr(faces, "__len__") or len(faces) == 0:
                continue
            for x, y, w, h in faces:
                xi, yi, wi, hi = int(x), int(y), int(w), int(h)
                if is_valid_face_box(xi, yi, wi, hi, image_width, image_height):
                    raw_boxes.append((xi, yi, wi, hi))
        except Exception:  # noqa: BLE001
            continue

    boxes: list[FaceBox] = []
    for x, y, w, h in _deduplicate(raw_boxes):
        boxes.append({
            "x": x,
            "y": y,
            "width": w,
            "height": h,
            "confidence": None,
            "source": "opencv_haar",
        })

    return boxes


def _make_yunet_detector(
    image_width: int,
    image_height: int,
    score_threshold: float = _YUNET_DISPLAY_SCORE_THRESHOLD,
) -> Optional[Any]:
    """Return a configured FaceDetectorYN, or None if model file is missing.

    score_threshold — minimum YuNet detection confidence to keep.
      Public API (detect_faces_yunet) defaults to _YUNET_DISPLAY_SCORE_THRESHOLD (0.85).
      Matching internals in face_matching.py use their own detector with lower threshold.
    """
    if not OPENCV_AVAILABLE or not _YUNET_MODEL_PATH.exists():
        return None
    try:
        return cv2.FaceDetectorYN_create(
            str(_YUNET_MODEL_PATH),
            "",
            (image_width, image_height),
            score_threshold=score_threshold,
            nms_threshold=0.3,
            top_k=5000,
        )
    except Exception:  # noqa: BLE001
        return None


def detect_faces_yunet(
    image_path: str,
    score_threshold: Optional[float] = None,
) -> list[FaceBox]:
    """Detect faces using the OpenCV YuNet DNN detector.

    Preferred over the Haar cascade path — lower false-positive rate on group
    photos, per-detection confidence scores, and EXIF-aware loading.

    Requires ai_redaction/models/face_detection_yunet_2023mar.onnx.

    score_threshold — YuNet minimum detection confidence.
      None (default) → _YUNET_DISPLAY_SCORE_THRESHOLD (0.85) — clean boxes for event photos.
      0.5            — lenient mode for reference portraits that may score 0.60–0.70.

    Returns [] if the model file is missing, OpenCV is unavailable, or the
    image cannot be read. All boxes are in original image coordinates (after
    EXIF correction). Boxes are validated by is_valid_face_box (size, bounds,
    aspect ratio).
    """
    if not OPENCV_AVAILABLE:
        return []

    img = _load_cv2_image_exif(image_path)
    if img is None:
        return []

    image_height, image_width = img.shape[:2]
    threshold = score_threshold if score_threshold is not None else _YUNET_DISPLAY_SCORE_THRESHOLD
    detector = _make_yunet_detector(image_width, image_height, threshold)
    if detector is None:
        return []

    try:
        _, faces = detector.detect(img)
    except Exception:  # noqa: BLE001
        return []

    if faces is None:
        return []

    boxes: list[FaceBox] = []
    for face in faces:
        x = int(face[0])
        y = int(face[1])
        w = int(face[2])
        h = int(face[3])
        conf = float(face[14]) if len(face) > 14 else None
        if not is_valid_face_box(x, y, w, h, image_width, image_height):
            continue
        boxes.append({
            "x": x,
            "y": y,
            "width": w,
            "height": h,
            "confidence": round(conf, 4) if conf is not None else None,
            "source": "opencv_yunet",
        })

    return boxes


def crop_face(
    image_path: str,
    box: FaceBox,
    output_size: tuple[int, int] = (96, 96),
) -> Optional["Image.Image"]:
    """Crop a face region from an image and resize it to output_size.

    Returns a PIL Image (RGB) at the requested size, or None if:
    - Pillow is not installed
    - image_path cannot be opened
    - the clamped box has zero area
    """
    img = load_image_safely(image_path)
    if img is None:
        return None

    clamped = clamp_box_to_image(box, img.width, img.height)
    left = clamped["x"]
    top = clamped["y"]
    right = left + clamped["width"]
    bottom = top + clamped["height"]

    if right <= left or bottom <= top:
        return None

    try:
        cropped = img.crop((left, top, right, bottom))
        return cropped.resize(output_size, Image.LANCZOS)
    except Exception:  # noqa: BLE001
        return None


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------


def _cli() -> None:
    """
    Usage:
        python -m ai_redaction.face_detection <image_path>

    Detects faces in the image and prints the results as a JSON array.
    Prints an error object if the image cannot be read or OpenCV is unavailable.
    """
    if len(sys.argv) < 2:
        print(_cli.__doc__)
        sys.exit(1)

    image_path = sys.argv[1]

    if not Path(image_path).exists():
        print(json.dumps({"error": f"File not found: {image_path}", "faces": []}, indent=2))
        sys.exit(0)

    if not OPENCV_AVAILABLE:
        print(json.dumps({
            "error": "opencv-python-headless is not installed. Run: pip install -r requirements.txt",
            "faces": [],
        }, indent=2))
        sys.exit(0)

    faces = detect_faces(image_path)
    print(json.dumps({"imagePath": image_path, "facesFound": len(faces), "faces": faces}, indent=2))


if __name__ == "__main__":
    _cli()
