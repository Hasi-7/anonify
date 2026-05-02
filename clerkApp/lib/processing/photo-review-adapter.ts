import type {
  Detection,
  DetectionStatus,
  PhotoProcessingResult,
  ProcessingSummary,
  EventPhoto,
  OptedOutAttendee,
} from "../../types/ai-redaction"
import type {
  PhotoReviewModel,
  PhotoReviewParticipant,
  PhotoReviewRegion,
} from "../../types/photo-review"
import { getStatusFromConfidence, requiresManualReview } from "./confidence"
import {
  DEMO_EVENT_ID,
  MOCK_CONFIDENCE_MAP,
  MOCK_EVENT_PHOTOS,
  MOCK_OPTED_OUT_ATTENDEES,
} from "../../mocks/processing-fixtures"

const CONFIDENCE_WARNING =
  "Confidence scores are estimates. Review all results before publishing."

const DETECTION_STATUS_LABELS: Record<DetectionStatus, string> = {
  auto_blurred: "Auto-blurred",
  manual_review: "Needs review",
  approved: "Approved",
  rejected: "Rejected",
}

const PHOTO_STATUS_LABELS: Record<string, string> = {
  not_processed: "Not processed",
  processing: "Processing",
  match_found: "Match found",
  no_match: "No match",
  manual_review: "Needs review",
  processed: "Processed",
}

function toPercent(raw: number): number {
  return Math.round(raw * 100)
}

function toParticipant(detection: Detection): PhotoReviewParticipant {
  return {
    attendeeId: detection.attendeeId,
    attendeeName: detection.attendeeName,
    referenceImageUrl: detection.referenceImageUrl,
    confidencePercent: toPercent(detection.confidence),
    confidenceRaw: detection.confidence,
    status: detection.status,
    statusLabel: DETECTION_STATUS_LABELS[detection.status],
    reviewRequired: requiresManualReview(detection.confidence),
  }
}

function toRegion(detection: Detection): PhotoReviewRegion | null {
  if (!detection.boundingBox) return null
  return {
    x: detection.boundingBox.x,
    y: detection.boundingBox.y,
    width: detection.boundingBox.width,
    height: detection.boundingBox.height,
    reason: detection.status === "auto_blurred" ? "opt_out_match" : "manual_review",
    confidencePercent: toPercent(detection.confidence),
    attendeeId: detection.attendeeId,
    attendeeName: detection.attendeeName,
  }
}

// ---------------------------------------------------------------------------
// Public conversion functions — call these with real backend data
// ---------------------------------------------------------------------------

/**
 * Convert one PhotoProcessingResult into a UI-ready PhotoReviewModel.
 * Use this when backend photo detail data arrives.
 */
export function toPhotoReviewModel(result: PhotoProcessingResult): PhotoReviewModel {
  const participants = result.detections.map(toParticipant)
  const regions = result.detections
    .map(toRegion)
    .filter((r): r is PhotoReviewRegion => r !== null)

  return {
    photoId: result.photoId,
    eventId: result.eventId,
    fileName: result.fileName,
    originalImageUrl: result.originalImageUrl,
    redactedImageUrl: result.redactedImageUrl,
    status: result.status,
    statusLabel: PHOTO_STATUS_LABELS[result.status] ?? result.status,
    participants,
    regions,
    highestConfidencePercent:
      result.highestConfidence !== undefined
        ? toPercent(result.highestConfidence)
        : undefined,
    needsManualReview: result.needsManualReview,
    confidenceWarning: CONFIDENCE_WARNING,
  }
}

/**
 * Convert all results in a ProcessingSummary into PhotoReviewModels.
 * Use this after processEventPhotos() returns.
 */
export function toPhotoReviewModels(summary: ProcessingSummary): PhotoReviewModel[] {
  return summary.results.map(toPhotoReviewModel)
}

// ---------------------------------------------------------------------------
// Synchronous mock helpers — no async, no backend, no Python helper required
// ---------------------------------------------------------------------------

// Mirrors the internal logic of processPhotoMock() to keep getMockPhotoReviewModels()
// synchronous. When real backend data is available, use toPhotoReviewModel() instead.
function buildMockResult(
  photo: EventPhoto,
  eventId: string,
  optedOutAttendees: OptedOutAttendee[]
): PhotoProcessingResult {
  const confidenceMap = MOCK_CONFIDENCE_MAP[photo.photoId] ?? {}
  const detections: Detection[] = []

  for (const attendee of optedOutAttendees) {
    const confidence = confidenceMap[attendee.attendeeId]
    if (confidence === undefined) continue

    detections.push({
      id: `det_${photo.photoId}_${attendee.attendeeId}`,
      photoId: photo.photoId,
      attendeeId: attendee.attendeeId,
      attendeeName: attendee.attendeeName,
      referenceImageUrl: attendee.referenceImageUrl,
      confidence,
      status: getStatusFromConfidence(confidence),
      // Placeholder pixel coordinates — real CV detector supplies actual values.
      boundingBox: { x: 120, y: 80, width: 64, height: 80 },
    })
  }

  const highestConfidence =
    detections.length > 0
      ? Math.max(...detections.map((d) => d.confidence))
      : undefined

  const needsManualReview = detections.some((d) => requiresManualReview(d.confidence))
  const hasMatches = detections.length > 0

  return {
    photoId: photo.photoId,
    eventId,
    fileName: photo.fileName,
    originalImageUrl: photo.originalImageUrl,
    redactedImageUrl: hasMatches
      ? `/redacted/${eventId}/${photo.photoId}.jpg`
      : undefined,
    status: hasMatches ? (needsManualReview ? "manual_review" : "match_found") : "no_match",
    detections,
    highestConfidence,
    needsManualReview,
  }
}

// Lazily computed on first call; stable across re-renders.
let _cachedMockModels: PhotoReviewModel[] | null = null

function computeMockModels(): PhotoReviewModel[] {
  return MOCK_EVENT_PHOTOS.map((photo) =>
    toPhotoReviewModel(
      buildMockResult(photo, DEMO_EVENT_ID, MOCK_OPTED_OUT_ATTENDEES)
    )
  )
}

/**
 * Return all mock PhotoReviewModels for the demo event.
 * Synchronous — safe to call in server components, server actions, or test setup.
 *
 * Covers all four confidence tiers:
 *   photo_001 → Alex Rivera, 91% → auto-blurred, no review required
 *   photo_002 → Morgan Lee, 78% → manual review
 *   photo_003 → Jordan Kim, 63% → manual review, no reference image
 *   photo_004 → no detections, empty participants and regions
 *
 * Pass eventId to restrict to a specific event.
 * Returns [] for unknown eventIds (future: fetch from backend).
 */
export function getMockPhotoReviewModels(eventId?: string): PhotoReviewModel[] {
  if (eventId !== undefined && eventId !== DEMO_EVENT_ID) return []
  if (!_cachedMockModels) _cachedMockModels = computeMockModels()
  return _cachedMockModels
}

/**
 * Return a single mock PhotoReviewModel by photoId.
 * Returns undefined if photoId is not in the demo fixture set.
 */
export function getMockPhotoReviewModel(photoId: string): PhotoReviewModel | undefined {
  return getMockPhotoReviewModels().find((m) => m.photoId === photoId)
}
