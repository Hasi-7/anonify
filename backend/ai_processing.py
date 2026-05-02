"""Bridge the Flask backend to the optional local AI redaction helper."""

from __future__ import annotations

import base64
import json
import os
import re
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import requests

from .models import Attendee, Photo

DEFAULT_REDACTION_API_URL = "http://127.0.0.1:8001"
PROCESSING_DIR = Path(__file__).resolve().parent / "runtime" / "processing"

DATA_URL_RE = re.compile(r"^data:(?P<mime>[-\w.+/]+);base64,(?P<data>.+)$", re.DOTALL)


class ProcessingError(RuntimeError):
    pass


def _helper_url() -> str:
    return os.environ.get("REDACTION_API_URL", DEFAULT_REDACTION_API_URL).rstrip("/")


def _is_local_helper(url: str) -> bool:
    try:
        parsed = urlparse(url)
    except ValueError:
        return False
    return parsed.hostname in {"localhost", "127.0.0.1"}


def _safe_name(value: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9_.-]+", "-", value).strip(".-")
    return cleaned or "image.jpg"


def _extension_for_mime(mime: str) -> str:
    return {
        "image/jpeg": ".jpg",
        "image/jpg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
    }.get(mime.lower(), ".jpg")


def _write_data_url(data_url: str, target_dir: Path, stem: str) -> str:
    match = DATA_URL_RE.match(data_url)
    if not match:
        raise ProcessingError("Invalid image data URL")

    target_dir.mkdir(parents=True, exist_ok=True)
    suffix = _extension_for_mime(match.group("mime"))
    target = target_dir / f"{_safe_name(stem)}{suffix}"
    try:
        target.write_bytes(base64.b64decode(match.group("data"), validate=True))
    except Exception as exc:  # noqa: BLE001
        raise ProcessingError(f"Could not decode image data URL: {exc}") from exc
    return str(target)


def resolve_image_path(
    *,
    event_id: int,
    photo: Photo,
    image_data_url: str | None = None,
    image_path: str | None = None,
) -> str:
    if image_data_url:
        return _write_data_url(
            image_data_url,
            PROCESSING_DIR / f"event_{event_id}" / f"photo_{photo.id}",
            Path(photo.filename).stem,
        )

    if image_path and Path(image_path).is_file():
        return image_path

    raise ProcessingError("No readable event photo was provided")


_BACKEND_DIR = Path(__file__).resolve().parent


def _resolve_upload_path(url_path: str) -> str | None:
    """Resolve a /uploads/... URL path to an absolute filesystem path."""
    # url_path looks like /uploads/attendees/uuid.jpg or /uploads/photos/uuid.jpg
    if url_path.startswith("/uploads/"):
        candidate = _BACKEND_DIR / url_path.lstrip("/")
        if candidate.is_file():
            return str(candidate)
    return None


def attendee_payloads(event_id: int, attendees: list[Attendee]) -> list[dict[str, str]]:
    payloads: list[dict[str, str]] = []
    base_dir = PROCESSING_DIR / f"event_{event_id}" / "references"

    for attendee in attendees:
        reference_path = None
        reference_url = attendee.reference_photo_url

        if reference_url:
            if reference_url.startswith("data:image/"):
                reference_path = _write_data_url(
                    reference_url,
                    base_dir,
                    f"attendee_{attendee.id}",
                )
            elif reference_url.startswith("/uploads/"):
                reference_path = _resolve_upload_path(reference_url)
            elif Path(reference_url).is_file():
                reference_path = reference_url

        payload: dict[str, str] = {
            "attendeeId": str(attendee.id),
            "attendeeName": attendee.name,
        }
        if reference_path:
            payload["referenceImagePath"] = reference_path
        if reference_url:
            payload["referenceImageUrl"] = reference_url
        payloads.append(payload)

    return payloads


def create_redaction_plan(
    *,
    event_id: int,
    photo: Photo,
    original_image_url: str,
    detections: list[dict[str, Any]],
    needs_manual_review: bool,
) -> dict[str, Any]:
    boxes = []
    for detection in detections:
        box = detection.get("boundingBox") or detection.get("bounding_box")
        if not isinstance(box, dict):
            continue

        status = str(detection.get("status") or "manual_review")
        boxes.append(
            {
                "x": int(box.get("x", 0)),
                "y": int(box.get("y", 0)),
                "width": int(box.get("width", 0)),
                "height": int(box.get("height", 0)),
                "reason": "opt_out_match" if status == "auto_blurred" else "manual_review",
                "confidence": float(detection.get("confidence") or 0),
                "attendeeId": str(detection.get("attendeeId") or ""),
                "attendeeName": str(detection.get("attendeeName") or "Unknown attendee"),
            }
        )

    return {
        "photoId": str(photo.id),
        "eventId": str(event_id),
        "originalImageUrl": original_image_url,
        "boxes": boxes,
        "needsManualReview": needs_manual_review,
    }


def call_match_and_redact(
    *,
    event_id: int,
    photo: Photo,
    image_path: str,
    original_image_url: str,
    opted_out_attendees: list[dict[str, str]],
) -> dict[str, Any]:
    helper_url = _helper_url()
    if not _is_local_helper(helper_url):
        raise ProcessingError("REDACTION_API_URL must point to localhost or 127.0.0.1")

    if not opted_out_attendees:
        return {
            "match": {
                "photoId": str(photo.id),
                "eventId": str(event_id),
                "fileName": photo.filename,
                "originalImageUrl": original_image_url,
                "redactedImageUrl": None,
                "status": "no_match",
                "detections": [],
                "highestConfidence": None,
                "needsManualReview": False,
                "success": True,
                "error": None,
            },
            "redaction": None,
        }

    match_response = requests.post(
        f"{helper_url}/match-photo",
        json={
            "eventId": str(event_id),
            "photoId": str(photo.id),
            "photoImagePath": image_path,
            "originalImageUrl": original_image_url,
            "optedOutAttendees": opted_out_attendees,
        },
        timeout=30,
    )
    match_response.raise_for_status()
    match_result = match_response.json()

    detections = match_result.get("detections") or []
    if not isinstance(detections, list) or not detections:
        return {"match": match_result, "redaction": None}

    plan = create_redaction_plan(
        event_id=event_id,
        photo=photo,
        original_image_url=original_image_url,
        detections=detections,
        needs_manual_review=bool(match_result.get("needsManualReview")),
    )
    output_path = str(Path(image_path).with_name(f"{Path(image_path).stem}_redacted{Path(image_path).suffix}"))
    redact_response = requests.post(
        f"{helper_url}/redact",
        json={"imagePath": image_path, "outputPath": output_path, "plan": plan},
        timeout=30,
    )
    redact_response.raise_for_status()
    redaction_result = redact_response.json()
    if redaction_result.get("success") and redaction_result.get("outputImagePath"):
        match_result["redactedImageUrl"] = redaction_result["outputImagePath"]

    return {"match": match_result, "redaction": redaction_result, "plan": plan}


def persist_detections(db, photo_id: int, detections: list[dict[str, Any]]) -> int:
    from .models import insert_detection

    inserted = 0
    for detection in detections:
        box = detection.get("boundingBox") or detection.get("bounding_box")
        attendee_id = detection.get("attendeeId") or detection.get("attendee_id")
        if attendee_id is None:
            continue

        try:
            confidence = float(detection.get("confidence") or 0)
            if confidence <= 1:
                confidence = confidence * 100
            insert_detection(
                db,
                photo_id=photo_id,
                attendee_id=int(attendee_id),
                attendee_name=str(detection.get("attendeeName") or detection.get("attendee_name") or "Unknown attendee"),
                confidence=max(0, min(100, round(confidence))),
                redaction_status=str(detection.get("status") or "manual_review"),
                manual_review_required=str(detection.get("status")) == "manual_review",
                reference_photo_url=detection.get("referenceImageUrl") or detection.get("reference_photo_url"),
                bounding_box=json.dumps([
                    int(box.get("x", 0)) if isinstance(box, dict) else 0,
                    int(box.get("y", 0)) if isinstance(box, dict) else 0,
                    int(box.get("width", 0)) if isinstance(box, dict) else 0,
                    int(box.get("height", 0)) if isinstance(box, dict) else 0,
                ]),
            )
            inserted += 1
        except Exception:
            continue

    return inserted
