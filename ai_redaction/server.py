"""
server.py — FastAPI helper service for Anonify region-based redaction.

Exposes the apply_redaction_plan() function from apply_redaction.py over HTTP
so the TypeScript app can call it without running Python in-process.

This is NOT a face recognition service. It only blurs regions at known coordinates.

Run (after pip install -r requirements.txt):
    uvicorn ai_redaction.server:app --reload --port 8001

Then set in .env:
    REDACTION_API_URL=http://localhost:8001

Endpoints:
    GET  /health   — liveness check; reports Pillow availability
    POST /redact   — apply a RedactionPlan to an image, return RedactionApplyResult
"""

from __future__ import annotations

from typing import Literal, Optional

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .apply_redaction import (
    BLUR_RADIUS,
    PILLOW_AVAILABLE,
    apply_redaction_plan,
    plan_from_dict,
)

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
    blurRadius: int = Field(default=BLUR_RADIUS, ge=1, le=100)


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


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/health")
def health() -> dict:
    """Liveness check. Reports whether Pillow is available for real blur."""
    return {
        "status": "ok",
        "service": "anonify-redaction-helper",
        "pillowAvailable": PILLOW_AVAILABLE,
        "blurReady": PILLOW_AVAILABLE,
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
