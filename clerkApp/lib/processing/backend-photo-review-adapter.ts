import type { DetectionStatus, PhotoProcessingStatus } from "../../types/ai-redaction"
import type {
  PhotoReviewModel,
  PhotoReviewParticipant,
  PhotoReviewRegion,
} from "../../types/photo-review"
import type { BackendPhotoDetail, BackendDetection } from "../api/backend-types"

const CONFIDENCE_WARNING =
  "Confidence scores are estimates. Review all results before publishing."

const DETECTION_STATUS_LABELS: Record<DetectionStatus, string> = {
  auto_blurred: "Auto-blurred",
  manual_review: "Manual review",
  approved: "Approved",
  rejected: "Rejected",
}

const PHOTO_STATUS_LABELS: Record<string, string> = {
  not_processed: "Not processed",
  processing: "Processing",
  match_found: "Match found",
  no_match: "No match",
  manual_review: "Manual review",
  processed: "Processed",
}

const KNOWN_DETECTION_STATUSES = new Set<string>([
  "auto_blurred",
  "manual_review",
  "approved",
  "rejected",
])

const KNOWN_PHOTO_STATUSES = new Set<string>([
  "not_processed",
  "processing",
  "match_found",
  "no_match",
  "manual_review",
  "processed",
])

// Backend stores confidence as integer percent (91) or occasionally decimal (0.91).
// Normalize to { percent: 0–100 integer, raw: 0.0–1.0 decimal }.
function normalizeConfidence(confidence: number): { percent: number; raw: number } {
  if (confidence > 1) {
    return { percent: Math.round(confidence), raw: confidence / 100 }
  }
  return { percent: Math.round(confidence * 100), raw: confidence }
}

function toDetectionStatus(redactionStatus: string): DetectionStatus {
  return KNOWN_DETECTION_STATUSES.has(redactionStatus)
    ? (redactionStatus as DetectionStatus)
    : "manual_review"
}

function toPhotoStatus(status: string): PhotoProcessingStatus {
  return KNOWN_PHOTO_STATUSES.has(status)
    ? (status as PhotoProcessingStatus)
    : "processed"
}

function detectionToParticipant(det: BackendDetection): PhotoReviewParticipant {
  const { percent, raw } = normalizeConfidence(det.confidence ?? 0)
  const status = toDetectionStatus(det.redaction_status ?? "")
  return {
    attendeeId: String(det.attendee_id),
    attendeeName: det.attendee_name ?? "Unknown",
    referenceImageUrl: det.reference_photo_url ?? undefined,
    confidencePercent: percent,
    confidenceRaw: raw,
    status,
    statusLabel: DETECTION_STATUS_LABELS[status],
    reviewRequired: det.manual_review_required ?? false,
  }
}

function detectionToRegion(det: BackendDetection): PhotoReviewRegion | null {
  const bb = det.bounding_box
  if (!Array.isArray(bb) || bb.length < 4) return null
  const [x, y, width, height] = bb
  if (x === undefined || y === undefined || width === undefined || height === undefined) {
    return null
  }
  const { percent } = normalizeConfidence(det.confidence ?? 0)
  const status = toDetectionStatus(det.redaction_status ?? "")
  return {
    x,
    y,
    width,
    height,
    reason: status === "auto_blurred" ? "opt_out_match" : "manual_review",
    confidencePercent: percent,
    attendeeId: String(det.attendee_id),
    attendeeName: det.attendee_name ?? "Unknown",
  }
}

/**
 * Returns true when photoDetail has enough fields to produce a meaningful PhotoReviewModel.
 * The caller can use this to decide whether to fall back to mock data.
 */
export function canBuildPhotoReviewFromBackend(
  photoDetail: BackendPhotoDetail | null | undefined
): boolean {
  return (
    photoDetail != null &&
    typeof photoDetail.id === "number" &&
    typeof photoDetail.event_id === "number" &&
    typeof photoDetail.filename === "string" &&
    Array.isArray(photoDetail.detections)
  )
}

/**
 * Convert one BackendPhotoDetail into a UI-ready PhotoReviewModel.
 * Never throws — missing optional fields are filled with safe defaults.
 */
export function backendPhotoDetailToPhotoReviewModel(
  photoDetail: BackendPhotoDetail
): PhotoReviewModel {
  const detections = Array.isArray(photoDetail.detections) ? photoDetail.detections : []

  const participants = detections.map(detectionToParticipant)
  const regions = detections
    .map(detectionToRegion)
    .filter((r): r is PhotoReviewRegion => r !== null)

  const needsManualReview = detections.some((d) => d.manual_review_required === true)

  const confidenceValues = detections.map((d) =>
    normalizeConfidence(d.confidence ?? 0)
  )
  const highestConfidencePercent =
    confidenceValues.length > 0
      ? Math.max(...confidenceValues.map((c) => c.percent))
      : undefined

  const photoStatus = toPhotoStatus(photoDetail.status ?? "")

  return {
    photoId: String(photoDetail.id),
    eventId: String(photoDetail.event_id),
    fileName: photoDetail.filename ?? "",
    originalImageUrl: photoDetail.original_image_url ?? "",
    redactedImageUrl: photoDetail.redacted_image_url ?? undefined,
    status: photoStatus,
    statusLabel: PHOTO_STATUS_LABELS[photoStatus] ?? photoDetail.status ?? "",
    participants,
    regions,
    highestConfidencePercent,
    needsManualReview,
    confidenceWarning: CONFIDENCE_WARNING,
  }
}

/**
 * Convert an array of BackendPhotoDetail into PhotoReviewModels.
 * Skips entries that fail canBuildPhotoReviewFromBackend.
 */
export function backendPhotoDetailsToPhotoReviewModels(
  photoDetails: BackendPhotoDetail[]
): PhotoReviewModel[] {
  return photoDetails
    .filter(canBuildPhotoReviewFromBackend)
    .map(backendPhotoDetailToPhotoReviewModel)
}
