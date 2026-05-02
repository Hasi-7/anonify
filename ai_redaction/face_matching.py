"""Experimental local face-crop matching for controlled demo images.

This module is a hackathon spike, not production facial recognition. It keeps
all work local, stores no embeddings, and sends no images to external services.

Detection/recognition path priority:
  1. YuNet (DNN) + SFace embeddings — requires model files in ai_redaction/models/
  2. Haar cascade pixel-similarity fallback — always available with OpenCV
  3. Safe no_match — when dependencies are missing
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
    from PIL import Image, ImageOps as _PilImageOps

    PILLOW_AVAILABLE = True
except ImportError:  # pragma: no cover - exercised only in under-provisioned envs
    Image = None  # type: ignore[assignment]
    _PilImageOps = None  # type: ignore[assignment]
    PILLOW_AVAILABLE = False

try:
    import cv2

    OPENCV_AVAILABLE = True
except ImportError:  # pragma: no cover - exercised only in under-provisioned envs
    cv2 = None  # type: ignore[assignment]
    OPENCV_AVAILABLE = False

try:
    from .face_detection import detect_faces as agent_detect_faces
    from .face_detection import is_valid_face_box as _is_valid_face_box
except ImportError:  # pragma: no cover - current repo state
    agent_detect_faces = None
    _is_valid_face_box = None  # type: ignore[assignment]

# ---------------------------------------------------------------------------
# YuNet / SFace model paths (relative to this file)
# ---------------------------------------------------------------------------

_MODELS_DIR = Path(__file__).parent / "models"
_YUNET_MODEL_PATH = _MODELS_DIR / "face_detection_yunet_2023mar.onnx"
_SFACE_MODEL_PATH = _MODELS_DIR / "face_recognition_sface_2021dec.onnx"

YUNET_MODEL_AVAILABLE = _YUNET_MODEL_PATH.exists()
SFACE_MODEL_AVAILABLE = _SFACE_MODEL_PATH.exists()
YUNET_SFACE_AVAILABLE = OPENCV_AVAILABLE and YUNET_MODEL_AVAILABLE and SFACE_MODEL_AVAILABLE

# Lazy-loaded SFace recognizer shared across one process lifetime (model only, no user data).
_sface_recognizer_instance: Optional[Any] = None
_sface_recognizer_attempted: bool = False


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


# ---------------------------------------------------------------------------
# YuNet / SFace internals
# ---------------------------------------------------------------------------


def _get_sface_recognizer() -> Optional[Any]:
    """Return the module-level SFace recognizer, loading it on first call."""
    global _sface_recognizer_instance, _sface_recognizer_attempted
    if _sface_recognizer_attempted:
        return _sface_recognizer_instance
    _sface_recognizer_attempted = True
    if not OPENCV_AVAILABLE or not _SFACE_MODEL_PATH.exists():
        return None
    try:
        _sface_recognizer_instance = cv2.FaceRecognizerSF_create(str(_SFACE_MODEL_PATH), "")
    except Exception:  # noqa: BLE001
        _sface_recognizer_instance = None
    return _sface_recognizer_instance


def _make_yunet_detector_for(
    image_width: int,
    image_height: int,
    score_threshold: float = 0.5,
) -> Optional[Any]:
    """Create a FaceDetectorYN sized for the given image dimensions, or None.

    score_threshold tuning:
    - 0.5  for reference photos (portrait faces can score as low as 0.60; be lenient)
    - 0.85 for event photos (many faces in scene; stricter avoids false positives)
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


def _load_bgr_exif(image_path: str):
    """Load an image via PIL (EXIF-corrected) and return a cv2 BGR ndarray."""
    if not PILLOW_AVAILABLE or not NUMPY_AVAILABLE or not OPENCV_AVAILABLE:
        return None
    try:
        pil = Image.open(image_path)
        pil = _PilImageOps.exif_transpose(pil)
        rgb = np.array(pil.convert("RGB"))
        return cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
    except Exception:  # noqa: BLE001
        return None


def _detect_yunet_raw(
    img_bgr,
    image_width: int,
    image_height: int,
    score_threshold: float = 0.5,
):
    """Run YuNet detection on a pre-loaded BGR ndarray.

    Returns a numpy array of shape (N, 15) — each row is
    [x, y, w, h, lm0x, lm0y, ..., lm4x, lm4y, score] — or None.
    The landmark columns are required by SFace alignCrop().

    Use score_threshold=0.5 for reference photos (portrait faces may score ~0.60).
    Use score_threshold=0.85 for event photos (stricter, fewer false positives).
    """
    detector = _make_yunet_detector_for(image_width, image_height, score_threshold)
    if detector is None:
        return None
    try:
        _, faces = detector.detect(img_bgr)
        return faces  # None or ndarray(N, 15)
    except Exception:  # noqa: BLE001
        return None


def extract_sface_embedding(img_bgr, face_row) -> Optional[Any]:
    """Extract a 128-d SFace feature vector for one face.

    img_bgr  — cv2 BGR ndarray of the full image.
    face_row — one row (shape 15,) from a YuNet detect() result, including
               five landmark pairs used by SFace alignCrop().

    Returns a 1-D float32 ndarray of length 128, or None on any failure.
    """
    recognizer = _get_sface_recognizer()
    if recognizer is None or img_bgr is None or face_row is None:
        return None
    try:
        row_2d = np.array(face_row, dtype="float32").reshape(1, -1)
        aligned = recognizer.alignCrop(img_bgr, row_2d)
        feature = recognizer.feature(aligned)
        return feature.flatten()
    except Exception:  # noqa: BLE001
        return None


def compare_sface_embeddings(ref_embedding: Any, cand_embedding: Any) -> float:
    """Compare two SFace 128-d embeddings; return a similarity score in [0.0, 1.0].

    Uses cv2.FaceRecognizerSF.match() with cosine distance when the recognizer
    is available, falling back to pure-numpy cosine similarity otherwise.

    The raw cosine score ∈ [-1, 1] is mapped to [0, 1] via (score + 1) / 2.
    SFace "same person" threshold ≈ 0.363 cosine ≈ 0.68 normalised, which sits
    just below the 0.70 manual_review threshold — working as expected.
    """
    if ref_embedding is None or cand_embedding is None or not NUMPY_AVAILABLE:
        return 0.0

    recognizer = _get_sface_recognizer()
    if recognizer is not None:
        try:
            r = np.array(ref_embedding, dtype="float32").reshape(1, -1)
            c = np.array(cand_embedding, dtype="float32").reshape(1, -1)
            # FR_COSINE (0) returns cosine similarity in [-1, 1]; higher = more similar
            raw = float(recognizer.match(r, c, 0))
            return max(0.0, min(1.0, (raw + 1.0) / 2.0))
        except Exception:  # noqa: BLE001
            pass

    # Numpy-only fallback (no SFace alignment — less accurate but safe)
    r = np.asarray(ref_embedding, dtype="float32").flatten()
    c = np.asarray(cand_embedding, dtype="float32").flatten()
    if r.size == 0 or c.size == 0 or r.size != c.size:
        return 0.0
    denom = float(np.linalg.norm(r) * np.linalg.norm(c))
    if denom <= 1e-8:
        return 0.0
    return max(0.0, min(1.0, (float(np.dot(r, c)) / denom + 1.0) / 2.0))


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

    # Reject obviously-too-small boxes — upstream detect_faces already filters, but
    # guard here too in case _coerce_box is fed raw cascade output from the fallback path.
    if box["width"] < 40 or box["height"] < 40:
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

    image_height, image_width = image.shape[:2]
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    gray = cv2.equalizeHist(gray)
    cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
    detector = cv2.CascadeClassifier(cascade_path)
    if detector.empty():
        return []

    faces = detector.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(40, 40))
    result = []
    for x, y, width, height in faces:
        xi, yi, wi, hi = int(x), int(y), int(width), int(height)
        # Apply the same validation as the primary path to avoid corner false positives
        valid = (
            _is_valid_face_box(xi, yi, wi, hi, image_width, image_height)
            if callable(_is_valid_face_box)
            else (wi >= 40 and hi >= 40 and not (xi <= 5 and yi <= 5))
        )
        if valid:
            result.append({"x": xi, "y": yi, "width": wi, "height": hi})
    return result


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


def match_photo_to_references_yunet_sface(
    photo_path: str,
    attendees: Iterable[AttendeeInput],
    event_id: str,
    photo_id: str,
) -> dict[str, Any]:
    """YuNet detection + SFace embedding matching pipeline.

    Detects faces in the event photo with YuNet, extracts SFace 128-d embeddings,
    and compares against per-attendee reference embeddings using cosine similarity.

    Reference photos:
    - Zero detected faces → attendee skipped (reference_face_not_detected).
    - Multiple detected faces → largest face used, warning recorded.

    Event photo:
    - EXIF-corrected before detection.
    - Boxes with detection confidence < 0.5 or area < 1600 px² are discarded.

    Returns a PhotoProcessingResult-compatible dict.
    If model files are missing or any step fails, returns safe no_match.
    """
    attendee_list = list(attendees)

    if not YUNET_SFACE_AVAILABLE:
        return _empty_result(photo_path, event_id, photo_id)

    if not attendee_list or not Path(photo_path).exists():
        return _empty_result(photo_path, event_id, photo_id)

    # Load and EXIF-correct the event photo
    img_bgr = _load_bgr_exif(photo_path)
    if img_bgr is None:
        return _empty_result(photo_path, event_id, photo_id)

    img_h, img_w = img_bgr.shape[:2]

    # Detect faces in event photo with a strict threshold to avoid false positives
    raw_faces = _detect_yunet_raw(img_bgr, img_w, img_h, score_threshold=0.85)
    if raw_faces is None or len(raw_faces) == 0:
        return _empty_result(photo_path, event_id, photo_id)

    # Filter by size and aspect ratio (uses is_valid_face_box if available)
    valid_is_vfb = callable(_is_valid_face_box)
    valid_faces = []
    for face in raw_faces:
        x, y, w, h = int(face[0]), int(face[1]), int(face[2]), int(face[3])
        if valid_is_vfb:
            if not _is_valid_face_box(x, y, w, h, img_w, img_h):
                continue
        else:
            if w < 40 or h < 40 or (x <= 5 and y <= 5):
                continue
            if h > 0 and not (0.4 <= w / h <= 2.0):
                continue
        valid_faces.append(face)

    if not valid_faces:
        return _empty_result(photo_path, event_id, photo_id)

    # Build reference embeddings per attendee.
    # Reference detection uses a lenient threshold (0.5) because portrait faces
    # can have YuNet scores as low as ~0.60, and we must not miss the primary face.
    reference_embeddings: list[tuple[AttendeeInput, Any, Optional[str]]] = []
    for attendee in attendee_list:
        ref_path = attendee.get("referenceImagePath")
        if not ref_path or not Path(ref_path).exists():
            continue

        ref_bgr = _load_bgr_exif(ref_path)
        if ref_bgr is None:
            continue

        ref_h, ref_w = ref_bgr.shape[:2]
        ref_faces_raw = _detect_yunet_raw(ref_bgr, ref_w, ref_h, score_threshold=0.5)

        if ref_faces_raw is None or len(ref_faces_raw) == 0:
            continue  # reference_face_not_detected — skip attendee

        # Filter invalid reference faces (size / aspect / bounds)
        valid_ref_faces = []
        for face in ref_faces_raw:
            rx, ry, rw, rh = int(face[0]), int(face[1]), int(face[2]), int(face[3])
            if valid_is_vfb:
                if not _is_valid_face_box(rx, ry, rw, rh, ref_w, ref_h):
                    continue
            else:
                if rw < 40 or rh < 40 or (rx <= 5 and ry <= 5):
                    continue
                if rh > 0 and not (0.4 <= rw / rh <= 2.0):
                    continue
            valid_ref_faces.append(face)

        if not valid_ref_faces:
            continue

        warning: Optional[str] = None
        if len(valid_ref_faces) > 1:
            # Multiple faces in reference: pick the one closest to image centre
            # (portrait photos: the subject is usually centred).
            cx, cy = ref_w / 2.0, ref_h / 2.0
            def _centrality(f) -> float:
                fx = float(f[0]) + float(f[2]) / 2.0
                fy = float(f[1]) + float(f[3]) / 2.0
                return (fx - cx) ** 2 + (fy - cy) ** 2
            valid_ref_faces = sorted(valid_ref_faces, key=_centrality)
            warning = "multiple_faces_in_reference"

        embedding = extract_sface_embedding(ref_bgr, valid_ref_faces[0])
        if embedding is None:
            continue

        reference_embeddings.append((attendee, embedding, warning))

    if not reference_embeddings:
        return _empty_result(photo_path, event_id, photo_id)

    # Match each event-photo face against reference embeddings
    detections: list[dict[str, Any]] = []
    for face_index, face_row in enumerate(valid_faces):
        x = int(face_row[0])
        y = int(face_row[1])
        w = int(face_row[2])
        h = int(face_row[3])
        det_conf = round(float(face_row[14]), 4) if len(face_row) > 14 else None

        cand_embedding = extract_sface_embedding(img_bgr, face_row)
        if cand_embedding is None:
            continue

        best_attendee: Optional[AttendeeInput] = None
        best_confidence = 0.0
        best_warning: Optional[str] = None

        for attendee, ref_embedding, ref_warning in reference_embeddings:
            raw_score = compare_sface_embeddings(ref_embedding, cand_embedding)
            confidence = confidence_from_similarity(raw_score)
            if confidence > best_confidence:
                best_attendee = attendee
                best_confidence = confidence
                best_warning = ref_warning

        if best_attendee is None or best_confidence < MANUAL_REVIEW_THRESHOLD:
            continue

        detection: dict[str, Any] = {
            "id": f"{photo_id}-face-{face_index}-{best_attendee.get('attendeeId', 'unknown')}",
            "photoId": str(photo_id),
            "attendeeId": best_attendee.get("attendeeId", ""),
            "attendeeName": best_attendee.get("attendeeName", "Unknown attendee"),
            "referenceImageUrl": best_attendee.get(
                "referenceImageUrl", best_attendee.get("referenceImagePath", "")
            ),
            "confidence": best_confidence,
            "status": status_from_confidence(best_confidence),
            "boundingBox": {"x": x, "y": y, "width": w, "height": h},
            "detectionConfidence": det_conf,
        }
        if best_warning:
            detection["warning"] = best_warning
        detections.append(detection)

    highest_confidence = max((d["confidence"] for d in detections), default=0.0)
    needs_manual_review = any(d["status"] == "manual_review" for d in detections)
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


def match_photo_to_references(
    photo_path: str,
    attendees: Iterable[AttendeeInput],
    event_id: str,
    photo_id: str,
) -> dict[str, Any]:
    """Match detected event-photo faces against opted-out attendee references.

    Prefers the YuNet/SFace path when model files are available in
    ai_redaction/models/. Falls back to the Haar pixel-similarity path when
    models are missing. Returns safe no_match if all detection paths fail.

    Returns a PhotoProcessingResult-compatible dict:
    - >= 0.90 confidence → auto_blurred
    - 0.70–0.89          → manual_review
    - < 0.70             → omitted (no_match)
    """
    # Preferred path: YuNet detection + SFace embeddings
    if YUNET_SFACE_AVAILABLE:
        return match_photo_to_references_yunet_sface(
            photo_path, attendees, event_id, photo_id
        )

    # Fallback: Haar cascade + pixel-crop cosine similarity
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
    "extract_sface_embedding",
    "compare_sface_embeddings",
    "match_photo_to_references",
    "match_photo_to_references_yunet_sface",
    "YUNET_SFACE_AVAILABLE",
    "YUNET_MODEL_AVAILABLE",
    "SFACE_MODEL_AVAILABLE",
]
