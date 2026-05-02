"""Experimental local face-crop matching for controlled demo images.

This module is a hackathon spike, not production facial recognition. It keeps
all work local, stores no embeddings, and sends no images to external services.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Iterable, Optional, TypedDict

try:
    import numpy as np

    NUMPY_AVAILABLE = True
except ImportError:  # pragma: no cover - exercised only in under-provisioned envs
    np = None  # type: ignore[assignment]
    NUMPY_AVAILABLE = False

try:
    from PIL import Image

    PILLOW_AVAILABLE = True
except ImportError:  # pragma: no cover - exercised only in under-provisioned envs
    Image = None  # type: ignore[assignment]
    PILLOW_AVAILABLE = False

try:
    import cv2

    OPENCV_AVAILABLE = True
except ImportError:  # pragma: no cover - exercised only in under-provisioned envs
    cv2 = None  # type: ignore[assignment]
    OPENCV_AVAILABLE = False

try:  # Agent A may provide this later. Keep optional so this spike stands alone.
    from .face_detection import detect_faces as agent_detect_faces
except ImportError:  # pragma: no cover - current repo state
    agent_detect_faces = None


FACE_SIZE = 96
AUTO_BLUR_THRESHOLD = 0.90
MANUAL_REVIEW_THRESHOLD = 0.70


class AttendeeInput(TypedDict, total=False):
    attendeeId: str
    attendeeName: str
    referenceImagePath: str
    referenceImageUrl: str


class FaceBox(TypedDict):
    x: int
    y: int
    width: int
    height: int


def _empty_result(
    photo_path: str,
    event_id: str,
    photo_id: str,
    status: str = "no_match",
) -> dict[str, Any]:
    return {
        "photoId": str(photo_id),
        "eventId": str(event_id),
        "fileName": Path(photo_path).name,
        "originalImageUrl": photo_path,
        "redactedImageUrl": None,
        "status": status,
        "detections": [],
        "highestConfidence": 0.0,
        "needsManualReview": False,
    }


def _coerce_box(raw_box: Any) -> Optional[FaceBox]:
    if isinstance(raw_box, dict):
        x = raw_box.get("x")
        y = raw_box.get("y")
        width = raw_box.get("width", raw_box.get("w"))
        height = raw_box.get("height", raw_box.get("h"))
    elif isinstance(raw_box, (list, tuple)) and len(raw_box) >= 4:
        x, y, width, height = raw_box[:4]
    else:
        return None

    try:
        box = {
            "x": max(0, int(round(float(x)))),
            "y": max(0, int(round(float(y)))),
            "width": max(0, int(round(float(width)))),
            "height": max(0, int(round(float(height)))),
        }
    except (TypeError, ValueError):
        return None

    return box if box["width"] > 0 and box["height"] > 0 else None


def _detect_faces_local(image_path: str) -> list[FaceBox]:
    if agent_detect_faces is not None:
        try:
            return [box for box in (_coerce_box(item) for item in agent_detect_faces(image_path)) if box]
        except Exception:  # noqa: BLE001 - detection failure should degrade safely
            return []

    if not OPENCV_AVAILABLE:
        return []

    image = cv2.imread(image_path)
    if image is None:
        return []

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
    detector = cv2.CascadeClassifier(cascade_path)
    if detector.empty():
        return []

    faces = detector.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(32, 32))
    return [
        {"x": int(x), "y": int(y), "width": int(width), "height": int(height)}
        for x, y, width, height in faces
    ]


def _crop_face(image: Any, box: FaceBox) -> Any:
    left = max(0, box["x"])
    top = max(0, box["y"])
    right = min(image.width, left + box["width"])
    bottom = min(image.height, top + box["height"])
    if right <= left or bottom <= top:
        return None
    return image.crop((left, top, right, bottom))


def normalize_face_crop(image_crop: Any) -> Any:
    """Resize a face crop to 96x96 grayscale float pixels in the 0..1 range."""
    if not PILLOW_AVAILABLE or not NUMPY_AVAILABLE or image_crop is None:
        return np.array([], dtype="float32") if NUMPY_AVAILABLE else []

    if not hasattr(image_crop, "convert"):
        image_crop = Image.fromarray(image_crop)

    resized = image_crop.convert("L").resize((FACE_SIZE, FACE_SIZE))
    return np.asarray(resized, dtype="float32") / 255.0


def compare_face_crops(reference_crop: Any, candidate_crop: Any) -> float:
    """Compare two normalized crops with cosine similarity plus MSE agreement."""
    if not NUMPY_AVAILABLE:
        return 0.0

    reference = np.asarray(reference_crop, dtype="float32").reshape(-1)
    candidate = np.asarray(candidate_crop, dtype="float32").reshape(-1)
    if reference.size == 0 or candidate.size == 0 or reference.size != candidate.size:
        return 0.0

    reference = reference - float(reference.mean())
    candidate = candidate - float(candidate.mean())
    denominator = float(np.linalg.norm(reference) * np.linalg.norm(candidate))
    if denominator <= 1e-8:
        return 0.0

    cosine = (float(np.dot(reference, candidate)) / denominator + 1.0) / 2.0
    mse = float(np.mean((reference - candidate) ** 2))
    mse_similarity = max(0.0, 1.0 - mse)
    return max(0.0, min(1.0, (cosine * 0.75) + (mse_similarity * 0.25)))


def confidence_from_similarity(similarity: float) -> float:
    """Map raw similarity to a bounded 0.0..1.0 demo confidence."""
    return round(max(0.0, min(1.0, float(similarity))), 4)


def status_from_confidence(confidence: float) -> str:
    """Return the redaction status for a matched crop confidence."""
    return "auto_blurred" if confidence >= AUTO_BLUR_THRESHOLD else "manual_review"


def _reference_crops(attendees: Iterable[AttendeeInput]) -> list[tuple[AttendeeInput, Any]]:
    references: list[tuple[AttendeeInput, Any]] = []
    for attendee in attendees:
        reference_path = attendee.get("referenceImagePath")
        if not reference_path or not Path(reference_path).exists():
            continue

        boxes = _detect_faces_local(reference_path)
        if not boxes:
            continue

        try:
            with Image.open(reference_path) as image:
                crop = _crop_face(image.convert("RGB"), boxes[0])
                normalized = normalize_face_crop(crop)
                if NUMPY_AVAILABLE and np.asarray(normalized).size > 0:
                    references.append((attendee, normalized))
        except Exception:  # noqa: BLE001 - skip unusable references safely
            continue

    return references


def match_photo_to_references(
    photo_path: str,
    attendees: Iterable[AttendeeInput],
    event_id: str,
    photo_id: str,
) -> dict[str, Any]:
    """Match detected event-photo faces against opted-out attendee references.

    Returns a PhotoProcessingResult-compatible dict. Weak matches below 0.70 are
    omitted; matches from 0.70 to 0.89 require manual review; matches at 0.90+
    are marked auto_blurred for downstream redaction planning.
    """
    attendee_list = list(attendees)
    if not attendee_list or not Path(photo_path).exists() or not PILLOW_AVAILABLE or not NUMPY_AVAILABLE:
        return _empty_result(photo_path, event_id, photo_id)

    references = _reference_crops(attendee_list)
    if not references:
        return _empty_result(photo_path, event_id, photo_id)

    face_boxes = _detect_faces_local(photo_path)
    if not face_boxes:
        return _empty_result(photo_path, event_id, photo_id)

    detections: list[dict[str, Any]] = []
    try:
        with Image.open(photo_path) as image:
            rgb_image = image.convert("RGB")
            for face_index, face_box in enumerate(face_boxes):
                candidate_crop = normalize_face_crop(_crop_face(rgb_image, face_box))
                if np.asarray(candidate_crop).size == 0:
                    continue

                best_attendee: Optional[AttendeeInput] = None
                best_confidence = 0.0
                for attendee, reference_crop in references:
                    similarity = compare_face_crops(reference_crop, candidate_crop)
                    confidence = confidence_from_similarity(similarity)
                    if confidence > best_confidence:
                        best_attendee = attendee
                        best_confidence = confidence

                if best_attendee is None or best_confidence < MANUAL_REVIEW_THRESHOLD:
                    continue

                detections.append(
                    {
                        "id": f"{photo_id}-face-{face_index}-{best_attendee.get('attendeeId', 'unknown')}",
                        "photoId": str(photo_id),
                        "attendeeId": best_attendee.get("attendeeId", ""),
                        "attendeeName": best_attendee.get("attendeeName", "Unknown attendee"),
                        "referenceImageUrl": best_attendee.get(
                            "referenceImageUrl",
                            best_attendee.get("referenceImagePath", ""),
                        ),
                        "confidence": best_confidence,
                        "status": status_from_confidence(best_confidence),
                        "boundingBox": face_box,
                    }
                )
    except Exception:  # noqa: BLE001 - safe no-match result for unreadable images
        return _empty_result(photo_path, event_id, photo_id)

    highest_confidence = max((detection["confidence"] for detection in detections), default=0.0)
    needs_manual_review = any(detection["status"] == "manual_review" for detection in detections)
    status = "no_match"
    if detections:
        status = "manual_review" if needs_manual_review else "match_found"

    return {
        "photoId": str(photo_id),
        "eventId": str(event_id),
        "fileName": Path(photo_path).name,
        "originalImageUrl": photo_path,
        "redactedImageUrl": None,
        "status": status,
        "detections": detections,
        "highestConfidence": round(highest_confidence, 4),
        "needsManualReview": needs_manual_review,
    }


__all__ = [
    "normalize_face_crop",
    "compare_face_crops",
    "confidence_from_similarity",
    "status_from_confidence",
    "match_photo_to_references",
]
