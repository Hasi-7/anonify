export type DetectionStatus =
  | "auto_blurred"
  | "manual_review"
  | "approved"
  | "rejected"

export type PhotoProcessingStatus =
  | "not_processed"
  | "processing"
  | "match_found"
  | "no_match"
  | "manual_review"
  | "processed"

export type BoundingBox = {
  x: number
  y: number
  width: number
  height: number
}

export type Detection = {
  id: string
  photoId: string
  attendeeId: string
  attendeeName: string
  referenceImageUrl?: string
  confidence: number
  status: DetectionStatus
  boundingBox?: BoundingBox
}

export type PhotoProcessingResult = {
  photoId: string
  eventId: string
  fileName: string
  originalImageUrl: string
  redactedImageUrl?: string
  status: PhotoProcessingStatus
  detections: Detection[]
  highestConfidence?: number
  needsManualReview: boolean
}

export type ProcessingSummary = {
  eventId: string
  photosProcessed: number
  matchesFound: number
  photosNeedingReview: number
  results: PhotoProcessingResult[]
}

// Input shapes for the processor

export type OptedOutAttendee = {
  attendeeId: string
  attendeeName: string
  referenceImageUrl?: string
}

export type EventPhoto = {
  photoId: string
  fileName: string
  originalImageUrl: string
}

export type ProcessingInput = {
  eventId: string
  photos: EventPhoto[]
  optedOutAttendees: OptedOutAttendee[]
}

// Redaction plan types — derived from processing results.
// These describe *what to blur and why*, not how detections were found.

export type RedactionReason = "opt_out_match" | "manual_review"

export type RedactionBox = {
  x: number
  y: number
  width: number
  height: number
  reason: RedactionReason
  confidence: number
  attendeeId?: string
  attendeeName?: string
}

export type RedactionPlan = {
  photoId: string
  eventId: string
  originalImageUrl: string
  boxes: RedactionBox[]
  needsManualReview: boolean
}

// Result returned after attempting to apply a RedactionPlan to an image.

export type RedactionApplyResult = {
  photoId: string
  eventId: string
  originalImagePath: string
  outputImagePath: string | null
  boxesApplied: number
  boxesSkipped: number
  needsManualReview: boolean
  success: boolean
  error?: string
}
