"""
apply_redaction.py — region-based image redaction from a RedactionPlan.

Applies Gaussian blur to bounding-box regions defined in a RedactionPlan.
This is NOT face recognition. Coordinates must already be known.

Dependencies: Pillow (requirements.txt: pillow>=10.4.0)
Install:       pip install "pillow>=10.4.0"

CLI usage:
    python -m ai_redaction.apply_redaction <image_path> <plan.json> [output_path]

FastAPI usage (future):
    POST /api/redact  { imagePath, plan }  → RedactionResult JSON
"""

from __future__ import annotations

import json
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

# Guard: Pillow is a planned dependency (requirements.txt) but may not be installed yet.
# All public functions check PILLOW_AVAILABLE and return a clean error result instead of raising.
try:
    from PIL import Image, ImageFilter  # type: ignore[import]
    PILLOW_AVAILABLE = True
except ImportError:
    PILLOW_AVAILABLE = False

BLUR_RADIUS = 20  # Gaussian blur radius in pixels — strong enough to obscure a face region


# ---------------------------------------------------------------------------
# Data classes — mirror the TypeScript RedactionBox / RedactionPlan / RedactionApplyResult types
# ---------------------------------------------------------------------------

@dataclass
class RedactionBox:
    x: int
    y: int
    width: int
    height: int
    reason: str  # "opt_out_match" | "manual_review"
    confidence: float
    attendee_id: Optional[str] = None
    attendee_name: Optional[str] = None


@dataclass
class RedactionPlan:
    photo_id: str
    event_id: str
    original_image_url: str
    boxes: list[RedactionBox] = field(default_factory=list)
    needs_manual_review: bool = False


@dataclass
class RedactionApplyResult:
    photo_id: str
    event_id: str
    original_image_path: str
    output_image_path: Optional[str]
    boxes_applied: int
    boxes_skipped: int
    needs_manual_review: bool
    success: bool
    error: Optional[str] = None

    def to_dict(self) -> dict:
        return {
            "photoId": self.photo_id,
            "eventId": self.event_id,
            "originalImagePath": self.original_image_path,
            "outputImagePath": self.output_image_path,
            "boxesApplied": self.boxes_applied,
            "boxesSkipped": self.boxes_skipped,
            "needsManualReview": self.needs_manual_review,
            "success": self.success,
            "error": self.error,
        }


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _clamp_box(
    box: RedactionBox, image_width: int, image_height: int
) -> tuple[int, int, int, int]:
    """Return (left, top, right, bottom) clamped to image bounds."""
    left = max(0, box.x)
    top = max(0, box.y)
    right = min(image_width, box.x + box.width)
    bottom = min(image_height, box.y + box.height)
    return left, top, right, bottom


def _box_has_area(left: int, top: int, right: int, bottom: int) -> bool:
    return right > left and bottom > top


def _default_output_path(input_path: str) -> str:
    p = Path(input_path)
    return str(p.parent / f"{p.stem}_redacted{p.suffix}")


def _error_result(
    plan: RedactionPlan,
    image_path: str,
    error: str,
) -> RedactionApplyResult:
    return RedactionApplyResult(
        photo_id=plan.photo_id,
        event_id=plan.event_id,
        original_image_path=image_path,
        output_image_path=None,
        boxes_applied=0,
        boxes_skipped=len(plan.boxes),
        needs_manual_review=plan.needs_manual_review,
        success=False,
        error=error,
    )


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def apply_redaction_plan(
    image_path: str,
    plan: RedactionPlan,
    output_path: Optional[str] = None,
    blur_radius: int = BLUR_RADIUS,
) -> RedactionApplyResult:
    """
    Blur all regions in plan.boxes within the image at image_path.

    - Empty plans (no boxes) return success immediately with the original path.
    - Boxes that fall entirely outside the image are counted as skipped, not errors.
    - Boxes are clamped to image bounds before cropping.
    - If Pillow is not installed, returns a clean error result without raising.
    - All other exceptions are caught and returned as error results.
    """
    if not PILLOW_AVAILABLE:
        return _error_result(
            plan,
            image_path,
            "Pillow is not installed. Run: pip install 'pillow>=10.4.0'",
        )

    if not plan.boxes:
        return RedactionApplyResult(
            photo_id=plan.photo_id,
            event_id=plan.event_id,
            original_image_path=image_path,
            output_image_path=image_path,  # no-op — return original unchanged
            boxes_applied=0,
            boxes_skipped=0,
            needs_manual_review=plan.needs_manual_review,
            success=True,
        )

    try:
        img = Image.open(image_path).convert("RGB")
        img_width, img_height = img.size
        applied = 0
        skipped = 0

        for box in plan.boxes:
            left, top, right, bottom = _clamp_box(box, img_width, img_height)

            if not _box_has_area(left, top, right, bottom):
                skipped += 1
                continue

            region = img.crop((left, top, right, bottom))
            blurred = region.filter(ImageFilter.GaussianBlur(radius=blur_radius))
            img.paste(blurred, (left, top, right, bottom))
            applied += 1

        resolved_output = output_path or _default_output_path(image_path)
        img.save(resolved_output)

        return RedactionApplyResult(
            photo_id=plan.photo_id,
            event_id=plan.event_id,
            original_image_path=image_path,
            output_image_path=resolved_output,
            boxes_applied=applied,
            boxes_skipped=skipped,
            needs_manual_review=plan.needs_manual_review,
            success=True,
        )

    except FileNotFoundError:
        return _error_result(plan, image_path, f"Image not found: {image_path}")
    except Exception as exc:  # noqa: BLE001
        return _error_result(plan, image_path, str(exc))


# ---------------------------------------------------------------------------
# JSON deserialization — matches TypeScript RedactionPlan camelCase keys
# ---------------------------------------------------------------------------

def plan_from_dict(data: dict) -> RedactionPlan:
    """Parse a RedactionPlan from a camelCase dict (e.g. from JSON or API body)."""
    boxes = [
        RedactionBox(
            x=int(b["x"]),
            y=int(b["y"]),
            width=int(b["width"]),
            height=int(b["height"]),
            reason=b["reason"],
            confidence=float(b["confidence"]),
            attendee_id=b.get("attendeeId"),
            attendee_name=b.get("attendeeName"),
        )
        for b in data.get("boxes", [])
    ]
    return RedactionPlan(
        photo_id=data["photoId"],
        event_id=data["eventId"],
        original_image_url=data["originalImageUrl"],
        boxes=boxes,
        needs_manual_review=bool(data.get("needsManualReview", False)),
    )


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

def _cli() -> None:
    """
    Usage:
        python -m ai_redaction.apply_redaction <image_path> <plan.json> [output_path]

    plan.json must be a serialized RedactionPlan in camelCase JSON format:
        {
          "photoId": "photo_001",
          "eventId": "event_demo_001",
          "originalImageUrl": "/mocks/images/event-stage-01.jpg",
          "boxes": [{ "x": 120, "y": 80, "width": 64, "height": 80,
                      "reason": "opt_out_match", "confidence": 0.91 }],
          "needsManualReview": false
        }
    """
    if len(sys.argv) < 3:
        print(_cli.__doc__)
        sys.exit(1)

    image_path = sys.argv[1]
    plan_path = sys.argv[2]
    output_path = sys.argv[3] if len(sys.argv) > 3 else None

    with open(plan_path, encoding="utf-8") as f:
        plan_data = json.load(f)

    plan = plan_from_dict(plan_data)
    result = apply_redaction_plan(image_path, plan, output_path)
    print(json.dumps(result.to_dict(), indent=2))


if __name__ == "__main__":
    _cli()
