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


def _path_arg(value: str) -> str:
    return str(Path(value))


def _exists(path: str) -> bool:
    return bool(path) and Path(path).exists()


def _detect_faces(path: str) -> dict[str, Any]:
    if not _exists(path):
        return {"path": path, "exists": False, "faces": [], "error": None}

    if face_matching is None:
        return {
            "path": path,
            "exists": True,
            "faces": [],
            "error": FACE_MATCHING_IMPORT_ERROR or "face_matching_unavailable",
        }

    detector = getattr(face_matching, "_detect_faces_local", None)
    if not callable(detector):
        return {"path": path, "exists": True, "faces": [], "error": "detector_unavailable"}

    try:
        return {"path": path, "exists": True, "faces": detector(path), "error": None}
    except Exception as exc:  # noqa: BLE001 - bad images should be reportable
        return {"path": path, "exists": True, "faces": [], "error": str(exc)}


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
    args = parser.parse_args()

    attendees = _build_attendees(args)
    photo_detection = _detect_faces(args.photo)
    reference_detection = _detect_faces(args.reference) if attendees else None
    result = _run_match(args, attendees)
    plan = _create_redaction_plan(result)
    blur_result = _post_redact(args, plan) if args.redact else {"attempted": False}

    dependency_status = {
        "faceMatchingImportError": FACE_MATCHING_IMPORT_ERROR,
        "pillowAvailable": bool(getattr(face_matching, "PILLOW_AVAILABLE", False)) if face_matching else False,
        "numpyAvailable": bool(getattr(face_matching, "NUMPY_AVAILABLE", False)) if face_matching else False,
        "opencvAvailable": bool(getattr(face_matching, "OPENCV_AVAILABLE", False)) if face_matching else False,
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
    }

    _write_json(args.output_json, report)
    _write_json(args.plan_json, plan)

    print("AI recognition spike manual test")
    print(f"photo exists: {_exists(args.photo)}; faces detected: {len(photo_detection['faces'])}")
    if reference_detection is None:
        print("reference detection: skipped because attendee list is empty")
    else:
        print(f"reference exists: {_exists(args.reference)}; faces detected: {len(reference_detection['faces'])}")
    print(f"matching status: {result.get('status')}; detections: {len(result.get('detections', []))}")
    print(f"redaction boxes: {len(plan['boxes'])}; needs manual review: {plan['needsManualReview']}")
    if args.redact:
        print(f"blur attempted: {blur_result.get('attempted')}; success: {blur_result.get('success')}")
    print(f"wrote report: {args.output_json}")
    print(f"wrote redaction plan: {args.plan_json}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
