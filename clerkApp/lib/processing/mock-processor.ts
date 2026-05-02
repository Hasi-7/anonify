import type {
  Detection,
  PhotoProcessingResult,
  ProcessingSummary,
  ProcessingInput,
  EventPhoto,
  OptedOutAttendee,
} from "../../types/ai-redaction"
import {
  getStatusFromConfidence,
  requiresManualReview,
} from "./confidence"
import { MOCK_CONFIDENCE_MAP } from "../../mocks/processing-fixtures"

// Swap this flag to true when real CV/AI is wired in.
// All callers go through processEventPhotos() so the switch is one line.
const USE_REAL_AI = false

function generateId(prefix: string, ...parts: string[]): string {
  return `${prefix}_${parts.join("_")}`
}

function processPhotoMock(
  photo: EventPhoto,
  eventId: string,
  optedOutAttendees: OptedOutAttendee[]
): PhotoProcessingResult {
  let confidenceMap = MOCK_CONFIDENCE_MAP[photo.photoId]
  if (!confidenceMap) {
    confidenceMap = {}
    if (optedOutAttendees.length > 0) {
      // Provide a default high-confidence match for newly uploaded photos
      confidenceMap[optedOutAttendees[0].attendeeId] = 0.91
    }
  }
  const detections: Detection[] = []

  for (const attendee of optedOutAttendees) {
    const confidence = confidenceMap[attendee.attendeeId]
    if (confidence === undefined) continue

    const detection: Detection = {
      id: generateId("det", photo.photoId, attendee.attendeeId),
      photoId: photo.photoId,
      attendeeId: attendee.attendeeId,
      attendeeName: attendee.attendeeName,
      referenceImageUrl: attendee.referenceImageUrl,
      confidence,
      status: getStatusFromConfidence(confidence),
      // Placeholder bounding box — real CV will supply real coordinates.
      boundingBox: { x: 120, y: 80, width: 64, height: 80 },
    }
    detections.push(detection)
  }

  const highestConfidence =
    detections.length > 0
      ? Math.max(...detections.map((d) => d.confidence))
      : undefined

  const needsManualReview = detections.some((d) =>
    requiresManualReview(d.confidence)
  )

  const hasMatches = detections.length > 0

  return {
    photoId: photo.photoId,
    eventId,
    fileName: photo.fileName,
    originalImageUrl: photo.originalImageUrl,
    // Placeholder redacted URL — real pipeline writes a blurred image here.
    redactedImageUrl: hasMatches
      ? `/redacted/${eventId}/${photo.photoId}.jpg`
      : undefined,
    status: hasMatches
      ? needsManualReview
        ? "manual_review"
        : "match_found"
      : "no_match",
    detections,
    highestConfidence,
    needsManualReview,
  }
}

// Real AI stub — wire in actual CV pipeline here when ready.
// Must return the same PhotoProcessingResult shape.
async function processPhotoReal(
  _photo: EventPhoto,
  _eventId: string,
  _optedOutAttendees: OptedOutAttendee[]
): Promise<PhotoProcessingResult> {
  throw new Error(
    "Real AI/CV processing is not implemented yet. Set USE_REAL_AI = false to use mock mode."
  )
}

/**
 * Primary entry point for the AI/Redaction layer.
 *
 * Usage:
 *   import { processEventPhotos } from "@/lib/processing/mock-processor"
 *   const summary = await processEventPhotos(input)
 *
 * In mock mode the function is synchronous internally but returns a Promise
 * so callers are forward-compatible with the real async CV pipeline.
 */
export async function processEventPhotos(
  input: ProcessingInput
): Promise<ProcessingSummary> {
  const { eventId, photos, optedOutAttendees } = input

  const results: PhotoProcessingResult[] = await Promise.all(
    photos.map((photo) =>
      USE_REAL_AI
        ? processPhotoReal(photo, eventId, optedOutAttendees)
        : Promise.resolve(processPhotoMock(photo, eventId, optedOutAttendees))
    )
  )

  const matchesFound = results.filter((r) => r.detections.length > 0).length
  const photosNeedingReview = results.filter((r) => r.needsManualReview).length

  return {
    eventId,
    photosProcessed: results.length,
    matchesFound,
    photosNeedingReview,
    results,
  }
}
