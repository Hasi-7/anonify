"""
face_detection.py — local face detection for anonify's AI/redaction pipeline.

EXPERIMENTAL: hackathon spike only. Not production-grade facial recognition.
All processing is local. No embeddings are persisted. No images sent externally.

Provides:
    detect_faces(image_path)       -> list[FaceBox]
    load_image_safely(image_path)  -> PIL.Image | None
    clamp_box_to_image(box, w, h)  -> FaceBox
    crop_face(image_path, box)     -> PIL.Image | None

Dependencies: opencv-python-headless, pillow, numpy (all in requirements.txt).
The module degrades safely if any are missing — functions return [] or None.

CLI usage:
    python -m ai_redaction.face_detection tmp/sample.jpg
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Optional, TypedDict

try:
    import cv2

    OPENCV_AVAILABLE = True
except ImportError:  # pragma: no cover
    cv2 = None  # type: ignore[assignment]
    OPENCV_AVAILABLE = False

try:
    from PIL import Image

    PILLOW_AVAILABLE = True
except ImportError:  # pragma: no cover
    Image = None  # type: ignore[assignment]
    PILLOW_AVAILABLE = False


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
# Internal helpers
# ---------------------------------------------------------------------------


def _load_cv2_image(image_path: str):
    """Return a cv2 BGR ndarray or None if the path is unreadable."""
    if not OPENCV_AVAILABLE:
        return None
    try:
        img = cv2.imread(str(image_path))
        return img  # None when cv2 cannot decode the file
    except Exception:  # noqa: BLE001
        return None


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


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def load_image_safely(image_path: str) -> Optional["Image.Image"]:
    """Open an image file and return a PIL Image, or None on any failure.

    Tries Pillow directly. Does not raise on bad paths or corrupt files.
    """
    if not PILLOW_AVAILABLE:
        return None
    try:
        return Image.open(image_path).convert("RGB")
    except Exception:  # noqa: BLE001
        return None


def clamp_box_to_image(box: FaceBox, image_width: int, image_height: int) -> FaceBox:
    """Return a new FaceBox whose coordinates are clamped to the image bounds.

    Width/height are adjusted so right = x + width and bottom = y + height
    never exceed the image dimensions.
    """
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

    Returns a list of FaceBox dicts. Returns [] on any failure:
        - OpenCV not installed
        - image path does not exist or cannot be decoded
        - no faces found
        - cascade file missing

    Boxes are clamped to image bounds before being returned.
    Confidence is None (Haar cascade does not expose per-detection scores).
    Source is always "opencv_haar".
    """
    if not OPENCV_AVAILABLE:
        return []

    detector = _haar_cascade()
    if detector is None:
        return []

    img = _load_cv2_image(image_path)
    if img is None:
        return []

    image_height, image_width = img.shape[:2]

    try:
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        faces = detector.detectMultiScale(
            gray,
            scaleFactor=1.1,
            minNeighbors=5,
            minSize=(32, 32),
        )
    except Exception:  # noqa: BLE001
        return []

    if not hasattr(faces, "__len__") or len(faces) == 0:
        return []

    boxes: list[FaceBox] = []
    for x, y, w, h in faces:
        raw: FaceBox = {
            "x": int(x),
            "y": int(y),
            "width": int(w),
            "height": int(h),
            "confidence": None,
            "source": "opencv_haar",
        }
        boxes.append(clamp_box_to_image(raw, image_width, image_height))

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

    Does not modify the source image.
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
        print(
            json.dumps(
                {"error": f"File not found: {image_path}", "faces": []}, indent=2
            )
        )
        sys.exit(0)

    if not OPENCV_AVAILABLE:
        print(
            json.dumps(
                {
                    "error": "opencv-python-headless is not installed. Run: pip install -r requirements.txt",
                    "faces": [],
                },
                indent=2,
            )
        )
        sys.exit(0)

    faces = detect_faces(image_path)
    print(json.dumps({"imagePath": image_path, "facesFound": len(faces), "faces": faces}, indent=2))


if __name__ == "__main__":
    _cli()
