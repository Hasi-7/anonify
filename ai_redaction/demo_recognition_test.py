"""Manual test harness for the experimental local recognition spike.

This script is for controlled local demo images only. It is not production-grade
facial recognition. It stores no embeddings, makes no external API calls, and
does not require committing any real photos.

Example:
    python ai_redaction/demo_recognition_test.py --photo tmp/group.jpg --reference tmp/person.jpg --attendee-name "Maya Chen"

Optional local blur check, with the FastAPI helper already running on localhost:
    python ai_redaction/demo_recognition_test.py --photo tmp/group.jpg --reference tmp/person.jpg --redact
"""

from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))


try:
    from ai_redaction import face_matching
except Exception as exc:  # noqa: BLE001 - harness must report, not crash
    face_matching = None  # type: ignore[assignment]
    FACE_MATCHING_IMPORT_ERROR = str(exc)
else:
    FACE_MATCHING_IMPORT_ERROR = None

try:
    from ai_redaction.face_detection import detect_faces_yunet as _yunet_detect
    from ai_redaction.face_detection import detect_faces as _haar_detect
except Exception:  # noqa: BLE001
    _yunet_detect = None  # type: ignore[assignment]
    _haar_detect = None  # type: ignore[assignment]


def _path_arg(value: str) -> str:
    return str(Path(value))


def _exists(path: str) -> bool:
    return bool(path) and Path(path).exists()


def _detect_faces(path: str, lenient: bool = False) -> dict[str, Any]:
    """Detect faces in an image for display in the harness report.

    Prefers detect_faces_yunet when YuNet model is available. Falls back to Haar.
    Reports which detector was used so the report is self-describing.

    lenient=True  — use score_threshold=0.5 (for reference/portrait photos where
                    the face may score 0.60–0.70; same threshold as matching path).
    lenient=False — use default display threshold 0.85 (event photos, clean boxes).
    """
    if not _exists(path):
        return {"path": path, "exists": False, "faces": [], "error": None, "detector": None}

    yunet_avail = bool(face_matching and getattr(face_matching, "YUNET_SFACE_AVAILABLE", False))

    if yunet_avail and callable(_yunet_detect):
        try:
            thresh = 0.5 if lenient else None  # None → default display threshold (0.85)
            faces = _yunet_detect(path, score_threshold=thresh)
            return {"path": path, "exists": True, "faces": faces, "error": None, "detector": "yunet"}
        except Exception:  # noqa: BLE001
            pass  # Fall through to Haar

    if callable(_haar_detect):
        try:
            faces = _haar_detect(path)
            return {"path": path, "exists": True, "faces": faces, "error": None, "detector": "haar"}
        except Exception as exc:  # noqa: BLE001
            return {"path": path, "exists": True, "faces": [], "error": str(exc), "detector": "haar"}

    if face_matching is None:
        return {
            "path": path, "exists": True, "faces": [],
            "error": FACE_MATCHING_IMPORT_ERROR or "face_matching_unavailable",
            "detector": None,
        }

    detector_fn = getattr(face_matching, "_detect_faces_local", None)
    if not callable(detector_fn):
        return {"path": path, "exists": True, "faces": [], "error": "detector_unavailable", "detector": None}

    try:
        return {"path": path, "exists": True, "faces": detector_fn(path), "error": None, "detector": "haar_local"}
    except Exception as exc:  # noqa: BLE001
        return {"path": path, "exists": True, "faces": [], "error": str(exc), "detector": None}


def _empty_photo_result(args: argparse.Namespace) -> dict[str, Any]:
    return {
        "photoId": args.photo_id,
        "eventId": args.event_id,
        "fileName": Path(args.photo).name,
        "originalImageUrl": args.photo,
        "redactedImageUrl": None,
        "status": "no_match",
        "detections": [],
        "highestConfidence": 0.0,
        "needsManualReview": False,
    }


def _run_match(args: argparse.Namespace, attendees: list[dict[str, str]]) -> dict[str, Any]:
    if face_matching is None:
        result = _empty_photo_result(args)
        result["error"] = FACE_MATCHING_IMPORT_ERROR or "face_matching_unavailable"
        return result

    matcher = getattr(face_matching, "match_photo_to_references", None)
    if not callable(matcher):
        result = _empty_photo_result(args)
        result["error"] = "match_photo_to_references_unavailable"
        return result

    try:
        return matcher(
            photo_path=args.photo,
            attendees=attendees,
            event_id=args.event_id,
            photo_id=args.photo_id,
        )
    except Exception as exc:  # noqa: BLE001 - keep manual harness non-crashing
        result = _empty_photo_result(args)
        result["error"] = str(exc)
        return result


def _create_redaction_plan(result: dict[str, Any]) -> dict[str, Any]:
    boxes: list[dict[str, Any]] = []
    for detection in result.get("detections", []):
        bounding_box = detection.get("boundingBox")
        if not bounding_box:
            continue

        boxes.append(
            {
                "x": bounding_box["x"],
                "y": bounding_box["y"],
                "width": bounding_box["width"],
                "height": bounding_box["height"],
                "reason": "opt_out_match"
                if detection.get("status") == "auto_blurred"
                else "manual_review",
                "confidence": detection.get("confidence", 0.0),
                "attendeeId": detection.get("attendeeId"),
                "attendeeName": detection.get("attendeeName"),
            }
        )

    return {
        "photoId": result["photoId"],
        "eventId": result["eventId"],
        "originalImageUrl": result["originalImageUrl"],
        "boxes": boxes,
        "needsManualReview": result.get("needsManualReview", False),
    }


def _is_localhost_url(url: str) -> bool:
    parsed = urllib.parse.urlparse(url)
    return parsed.scheme in {"http", "https"} and parsed.hostname in {"localhost", "127.0.0.1", "::1"}


def _post_redact(args: argparse.Namespace, plan: dict[str, Any]) -> dict[str, Any]:
    if not _is_localhost_url(args.redact_url):
        return {"attempted": False, "success": False, "error": "Only localhost /redact URLs are allowed."}

    payload = {
        "imagePath": args.photo,
        "plan": plan,
        "outputPath": args.redacted_output,
        "blurRadius": args.blur_radius,
    }
    request = urllib.request.Request(
        args.redact_url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=args.redact_timeout) as response:  # noqa: S310 - localhost guarded above
            body = response.read().decode("utf-8")
            return {"attempted": True, "success": True, "response": json.loads(body)}
    except urllib.error.URLError as exc:
        return {"attempted": True, "success": False, "error": str(exc)}
    except Exception as exc:  # noqa: BLE001
        return {"attempted": True, "success": False, "error": str(exc)}


def _write_json(path: str, data: dict[str, Any]) -> None:
    output_path = Path(path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")


def _save_debug_image(
    image_path: str,
    accepted_boxes: list[dict[str, Any]],
    rejected_boxes: list[dict[str, Any]],
    output_path: str = "tmp/recognition-debug-yunet-boxes.jpg",
) -> str | None:
    """Draw accepted (green) and rejected (red) face boxes on a copy of the image.

    Each accepted box is labelled with its detection confidence (if present).
    Returns the output path on success, or None if PIL is unavailable or the
    image cannot be opened. The output is for local verification only — do not commit it.
    """
    try:
        from PIL import Image, ImageDraw  # local import — PIL optional
    except ImportError:
        return None

    try:
        img = Image.open(image_path).convert("RGB")
    except Exception:  # noqa: BLE001
        return None

    draw = ImageDraw.Draw(img)

    for box in rejected_boxes:
        x, y, w, h = box.get("x", 0), box.get("y", 0), box.get("width", 0), box.get("height", 0)
        draw.rectangle([(x, y), (x + w, y + h)], outline=(220, 50, 50), width=3)

    for box in accepted_boxes:
        x, y, w, h = box.get("x", 0), box.get("y", 0), box.get("width", 0), box.get("height", 0)
        draw.rectangle([(x, y), (x + w, y + h)], outline=(50, 220, 50), width=3)
        conf = box.get("confidence")
        if conf is not None:
            label = f"{float(conf):.2f}"
            label_y = max(0, y - 14)
            draw.rectangle([(x, label_y), (x + len(label) * 7 + 4, label_y + 13)], fill=(50, 220, 50))
            draw.text((x + 2, label_y + 1), label, fill=(0, 0, 0))

    out = Path(output_path)
    out.parent.mkdir(parents=True, exist_ok=True)
    img.save(str(out))
    return str(out)


def _build_attendees(args: argparse.Namespace) -> list[dict[str, str]]:
    if args.no_attendee:
        return []

    return [
        {
            "attendeeId": args.attendee_id,
            "attendeeName": args.attendee_name,
            "referenceImagePath": args.reference,
            "referenceImageUrl": args.reference,
        }
    ]


def main() -> int:
    parser = argparse.ArgumentParser(description="Manual local recognition spike test harness.")
    parser.add_argument("--photo", default="tmp/group.jpg", type=_path_arg)
    parser.add_argument("--reference", default="tmp/person.jpg", type=_path_arg)
    parser.add_argument("--attendee-name", default="Maya Chen")
    parser.add_argument("--attendee-id", default="attendee-demo-1")
    parser.add_argument("--event-id", default="event-recognition-spike")
    parser.add_argument("--photo-id", default="photo-demo-1")
    parser.add_argument("--no-attendee", action="store_true", help="Run the empty attendee-list case.")
    parser.add_argument("--output-json", default="tmp/ai_recognition_result.json", type=_path_arg)
    parser.add_argument("--plan-json", default="tmp/ai_recognition_redaction_plan.json", type=_path_arg)
    parser.add_argument("--redact", action="store_true", help="POST the derived plan to local FastAPI /redact.")
    parser.add_argument("--redact-url", default="http://localhost:8001/redact")
    parser.add_argument("--redacted-output", default="tmp/group_redacted.jpg", type=_path_arg)
    parser.add_argument("--blur-radius", default=20, type=int)
    parser.add_argument("--redact-timeout", default=10, type=float)
    parser.add_argument(
        "--debug",
        action="store_true",
        help="Save a debug image with detected face boxes drawn on it (green=accepted).",
    )
    parser.add_argument(
        "--show-rejected",
        action="store_true",
        help="In the debug image, also draw rejected boxes in red (requires --debug).",
    )
    parser.add_argument("--debug-output", default="tmp/recognition-debug-yunet-boxes.jpg", type=_path_arg)
    args = parser.parse_args()

    attendees = _build_attendees(args)
    photo_detection = _detect_faces(args.photo, lenient=False)
    reference_detection = _detect_faces(args.reference, lenient=True) if attendees else None
    result = _run_match(args, attendees)
    plan = _create_redaction_plan(result)
    blur_result = _post_redact(args, plan) if args.redact else {"attempted": False}

    # Debug image: green = accepted boxes from the active detector (YuNet preferred).
    # Red rejected boxes are only drawn when --show-rejected is passed.
    debug_image_path = None
    if args.debug and _exists(args.photo):
        accepted = photo_detection.get("faces", [])
        debug_image_path = _save_debug_image(
            args.photo,
            accepted_boxes=accepted,
            rejected_boxes=[],  # rejected tracking requires raw pre-filter output; omitted
            output_path=args.debug_output,
        )

    dependency_status = {
        "faceMatchingImportError": FACE_MATCHING_IMPORT_ERROR,
        "pillowAvailable": bool(getattr(face_matching, "PILLOW_AVAILABLE", False)) if face_matching else False,
        "numpyAvailable": bool(getattr(face_matching, "NUMPY_AVAILABLE", False)) if face_matching else False,
        "opencvAvailable": bool(getattr(face_matching, "OPENCV_AVAILABLE", False)) if face_matching else False,
        "yunetModelAvailable": bool(getattr(face_matching, "YUNET_MODEL_AVAILABLE", False)) if face_matching else False,
        "sfaceModelAvailable": bool(getattr(face_matching, "SFACE_MODEL_AVAILABLE", False)) if face_matching else False,
        "yunetSfaceAvailable": bool(getattr(face_matching, "YUNET_SFACE_AVAILABLE", False)) if face_matching else False,
        "activePath": "yunet_sface" if (face_matching and getattr(face_matching, "YUNET_SFACE_AVAILABLE", False)) else "haar_fallback",
    }

    report = {
        "scope": "experimental local controlled-image recognition spike",
        "privacyNotes": [
            "No persistent embeddings are written.",
            "No external API calls are made.",
            "Use tmp/ for local manual images; tmp/ is gitignored.",
        ],
        "inputs": {
            "photo": args.photo,
            "reference": args.reference if attendees else None,
            "attendees": attendees,
        },
        "dependencies": dependency_status,
        "detection": {
            "eventPhoto": photo_detection,
            "referencePhoto": reference_detection,
        },
        "matching": result,
        "redactionPlan": plan,
        "blur": blur_result,
        "debugImage": debug_image_path,
    }

    _write_json(args.output_json, report)
    _write_json(args.plan_json, plan)

    det_label = photo_detection.get("detector") or "unknown"
    print("AI recognition spike manual test")
    print(f"detector: {det_label}  active_path: {dependency_status['activePath']}")
    print(f"photo exists: {_exists(args.photo)}; faces detected: {len(photo_detection['faces'])}")
    if reference_detection is None:
        print("reference detection: skipped because attendee list is empty")
    else:
        ref_det_label = reference_detection.get("detector") or "unknown"
        print(f"reference exists: {_exists(args.reference)}; faces detected: {len(reference_detection['faces'])}  (detector: {ref_det_label})")
    print(f"matching status: {result.get('status')}; detections: {len(result.get('detections', []))}")
    print(f"redaction boxes: {len(plan['boxes'])}; needs manual review: {plan['needsManualReview']}")
    if args.redact:
        print(f"blur attempted: {blur_result.get('attempted')}; success: {blur_result.get('success')}")
    if debug_image_path:
        print(f"debug image saved: {debug_image_path}")
    elif args.debug:
        print("debug image: could not save (PIL unavailable or image unreadable)")
    print(f"wrote report: {args.output_json}")
    print(f"wrote redaction plan: {args.plan_json}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
