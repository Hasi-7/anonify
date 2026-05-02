import type {
  PhotoProcessingResult,
  ProcessingSummary,
  RedactionBox,
  RedactionPlan,
} from "../../types/ai-redaction"

function detectionReasonToRedactionReason(
  status: PhotoProcessingResult["detections"][number]["status"]
): RedactionBox["reason"] {
  // auto_blurred = high confidence confirmed opt-out match
  // anything else that surfaces a box is flagged for manual review
  return status === "auto_blurred" ? "opt_out_match" : "manual_review"
}

/**
 * Derive a RedactionPlan from one PhotoProcessingResult.
 *
 * Only detections that carry a boundingBox contribute a RedactionBox.
 * Detections without a box are still visible in the processing result
 * but cannot be spatially acted on until real CV provides coordinates.
 */
export function createRedactionPlan(
  result: PhotoProcessingResult
): RedactionPlan {
  const boxes: RedactionBox[] = []

  for (const detection of result.detections) {
    if (!detection.boundingBox) continue

    boxes.push({
      x: detection.boundingBox.x,
      y: detection.boundingBox.y,
      width: detection.boundingBox.width,
      height: detection.boundingBox.height,
      reason: detectionReasonToRedactionReason(detection.status),
      confidence: detection.confidence,
      attendeeId: detection.attendeeId,
      attendeeName: detection.attendeeName,
    })
  }

  return {
    photoId: result.photoId,
    eventId: result.eventId,
    originalImageUrl: result.originalImageUrl,
    boxes,
    needsManualReview: result.needsManualReview,
  }
}

/**
 * Derive RedactionPlans for all photos in a ProcessingSummary.
 * Photos with no detections produce a plan with an empty boxes array.
 */
export function createRedactionPlans(
  summary: ProcessingSummary
): RedactionPlan[] {
  return summary.results.map(createRedactionPlan)
}
