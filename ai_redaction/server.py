"""
server.py — FastAPI helper service for Anonify region-based redaction.

Exposes the apply_redaction_plan() function from apply_redaction.py over HTTP
so the TypeScript app can call it without running Python in-process.

The optional /match-photo endpoint is an experimental local face matching spike
for controlled demo images only. It is not production-grade face recognition.

Run (after pip install -r requirements.txt):
    uvicorn ai_redaction.server:app --reload --port 8001

Then set in .env:
    REDACTION_API_URL=http://localhost:8001

Endpoints:
    GET  /health       — liveness check; reports Pillow and recognition readiness
    POST /redact       — apply a RedactionPlan to an image, return RedactionApplyResult
    POST /match-photo  — optional local face matching spike, return PhotoProcessingResult
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Callable, Literal, Optional

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .apply_redaction import (
    BLUR_PASSES,
    BLUR_RADIUS,
    PILLOW_AVAILABLE,
    RedactionMode,
    apply_redaction_plan,
    plan_from_dict,
)

try:
    from .face_matching import match_photo_to_references
except Exception:  # noqa: BLE001
    match_photo_to_references = None

MATCH_PHOTO_AVAILABLE = callable(match_photo_to_references)

app = FastAPI(
    title="Anonify Redaction Helper",
    description="Region-based image redaction for the Anonify AI/Redaction workstream.",
    version="0.1.0",
    docs_url="/docs",
)

# Allow the Next.js dev server (and any localhost origin) to call this helper.
# Tighten origins before any public deployment.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


# ---------------------------------------------------------------------------
# Pydantic models — camelCase keys match the TypeScript RedactionPlan shape
# ---------------------------------------------------------------------------

class RedactionBoxIn(BaseModel):
    x: int
    y: int
    width: int
    height: int
    reason: Literal["opt_out_match", "manual_review"]
    confidence: float = Field(..., ge=0.0, le=1.0)
    attendeeId: Optional[str] = None
    attendeeName: Optional[str] = None


class RedactionPlanIn(BaseModel):
    photoId: str
    eventId: str
    originalImageUrl: str
    boxes: list[RedactionBoxIn] = Field(default_factory=list)
    needsManualReview: bool = False


class RedactRequest(BaseModel):
    imagePath: str
    plan: RedactionPlanIn
    outputPath: Optional[str] = None
    blurRadius: int = Field(default=BLUR_RADIUS, ge=1, le=150)
    blurPasses: int = Field(default=BLUR_PASSES, ge=1, le=10)
    redactionMode: RedactionMode = "blur"
    debugDrawBoxes: bool = False


class RedactResponse(BaseModel):
    photoId: str
    eventId: str
    originalImagePath: str
    outputImagePath: Optional[str] = None
    boxesApplied: int
    boxesSkipped: int
    needsManualReview: bool
    success: bool
    error: Optional[str] = None


class MatchAttendeeIn(BaseModel):
    attendeeId: str
    attendeeName: str
    referenceImagePath: Optional[str] = None
    referenceImageUrl: Optional[str] = None


class MatchPhotoRequest(BaseModel):
    eventId: str
    photoId: str
    photoImagePath: str
    originalImageUrl: str
    optedOutAttendees: list[MatchAttendeeIn] = Field(default_factory=list)


class BoundingBoxOut(BaseModel):
    x: int
    y: int
    width: int
    height: int


class DetectionOut(BaseModel):
    id: str
    photoId: str
    attendeeId: str
    attendeeName: str
    referenceImageUrl: Optional[str] = None
    confidence: float = Field(..., ge=0.0, le=1.0)
    status: Literal["auto_blurred", "manual_review", "approved", "rejected"]
    boundingBox: Optional[BoundingBoxOut] = None


class MatchPhotoResponse(BaseModel):
    photoId: str
    eventId: str
    fileName: str
    originalImageUrl: str
    redactedImageUrl: Optional[str] = None
    status: Literal["not_processed", "processing", "match_found", "no_match", "manual_review", "processed"]
    detections: list[DetectionOut] = Field(default_factory=list)
    highestConfidence: Optional[float] = None
    needsManualReview: bool
    success: bool = True
    error: Optional[str] = None


def _safe_no_match_response(request: MatchPhotoRequest, error: Optional[str] = None) -> MatchPhotoResponse:
    return MatchPhotoResponse(
        photoId=request.photoId,
        eventId=request.eventId,
        fileName=Path(request.photoImagePath).name or request.photoId,
        originalImageUrl=request.originalImageUrl,
        status="no_match",
        detections=[],
        highestConfidence=None,
        needsManualReview=False,
        success=error is None,
        error=error,
    )


def _coerce_match_response(request: MatchPhotoRequest, raw_result: Any) -> MatchPhotoResponse:
    if isinstance(raw_result, MatchPhotoResponse):
        return raw_result


    if isinstance(raw_result, dict):
        merged = {
            "photoId": request.photoId,
            "eventId": request.eventId,
            "fileName": Path(request.photoImagePath).name or request.photoId,
            "originalImageUrl": request.originalImageUrl,
            "status": "no_match",
            "detections": [],
            "needsManualReview": False,
            **raw_result,
        }
        return MatchPhotoResponse(**merged)

    if isinstance(raw_result, list):
        detections = [DetectionOut(**item) for item in raw_result if isinstance(item, dict)]
        highest_confidence = max((detection.confidence for detection in detections), default=None)
        needs_manual_review = any(detection.status == "manual_review" for detection in detections)
        return MatchPhotoResponse(
            photoId=request.photoId,
            eventId=request.eventId,
            fileName=Path(request.photoImagePath).name or request.photoId,
            originalImageUrl=request.originalImageUrl,
            status="manual_review" if needs_manual_review else "match_found" if detections else "no_match",
            detections=detections,
            highestConfidence=highest_confidence,
            needsManualReview=needs_manual_review,
        )

    return _safe_no_match_response(request, "recognition_unavailable")


def _call_matcher(matcher: Callable[..., Any], request: MatchPhotoRequest) -> Any:
    attendees = [attendee.model_dump() for attendee in request.optedOutAttendees]

    call_variants = [
        lambda: matcher(
            event_id=request.eventId,
            photo_id=request.photoId,
            photo_image_path=request.photoImagePath,
            original_image_url=request.originalImageUrl,
            opted_out_attendees=attendees,
        ),
        lambda: matcher(
            event_id=request.eventId,
            photo_id=request.photoId,
            photo_path=request.photoImagePath,
            attendees=attendees,
        ),
        lambda: matcher(
            request.photoImagePath,
            attendees,
            event_id=request.eventId,
            photo_id=request.photoId,
        ),
    ]

    last_type_error: Optional[TypeError] = None
    for call_variant in call_variants:
        try:
            return call_variant()
        except TypeError as exc:
            last_type_error = exc

    raise last_type_error or TypeError("Unsupported recognition matcher signature")


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/health")
def health() -> dict:
    """Liveness check. Reports helper readiness without requiring recognition."""
    return {
        "status": "ok",
        "service": "anonify-redaction-helper",
        "pillowAvailable": PILLOW_AVAILABLE,
        "blurReady": PILLOW_AVAILABLE,
        "recognitionAvailable": MATCH_PHOTO_AVAILABLE,
    }


@app.post("/redact", response_model=RedactResponse)
def redact(request: RedactRequest) -> RedactResponse:
    """
    Apply a RedactionPlan to an image.

    Accepts the same payload shape that lib/processing/apply-redaction.ts sends.
    Returns a RedactionApplyResult matching the TypeScript type.

    Never raises — all failure modes return success=false with an error message.
    """
    try:
        plan = plan_from_dict(request.plan.model_dump())
        result = apply_redaction_plan(
            image_path=request.imagePath,
            plan=plan,
            output_path=request.outputPath,
            blur_radius=request.blurRadius,
            blur_passes=request.blurPasses,
            redaction_mode=request.redactionMode,
            debug_draw_boxes=request.debugDrawBoxes,
        )
        return RedactResponse(**result.to_dict())
    except Exception as exc:  # noqa: BLE001
        # apply_redaction_plan() catches its own exceptions, but guard the
        # plan_from_dict() conversion step as well.
        return RedactResponse(
            photoId=request.plan.photoId,
            eventId=request.plan.eventId,
            originalImagePath=request.imagePath,
            outputImagePath=None,
            boxesApplied=0,
            boxesSkipped=len(request.plan.boxes),
            needsManualReview=request.plan.needsManualReview,
            success=False,
            error=f"Unexpected server error: {exc}",
        )


@app.post("/match-photo", response_model=MatchPhotoResponse)
def match_photo(request: MatchPhotoRequest) -> MatchPhotoResponse:
    """
    Experimental local face matching for controlled demo images only.

    No persistent embeddings, external API calls, or third-party image upload.
    Business failures return HTTP 200 with a safe no_match-compatible response.
    """
    try:
        if not MATCH_PHOTO_AVAILABLE or match_photo_to_references is None:
            return _safe_no_match_response(request, "recognition_unavailable")

        if not request.optedOutAttendees:
            return _safe_no_match_response(request)

        if not Path(request.photoImagePath).is_file():
            return _safe_no_match_response(request, "photo_file_missing")

        for attendee in request.optedOutAttendees:
            reference_path = attendee.referenceImagePath or attendee.referenceImageUrl
            if not reference_path or not Path(reference_path).is_file():
                return _safe_no_match_response(request, "reference_file_missing")

        return _coerce_match_response(request, _call_matcher(match_photo_to_references, request))
    except Exception as exc:  # noqa: BLE001
        return _safe_no_match_response(request, f"recognition_error: {exc}")
