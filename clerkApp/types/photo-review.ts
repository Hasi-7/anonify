import type { DetectionStatus, PhotoProcessingStatus } from "./ai-redaction"

// UI-friendly types for the photo review screen.
// Derived from AI/redaction types — do not duplicate detection logic here.

export type PhotoReviewParticipant = {
  attendeeId: string
  attendeeName: string
  referenceImageUrl?: string
  confidencePercent: number   // 0–100 integer, ready for display (e.g. "91%")
  confidenceRaw: number       // 0.0–1.0 decimal, for threshold logic
  status: DetectionStatus
  statusLabel: string         // human-readable: "Auto-blurred", "Needs review", etc.
  reviewRequired: boolean
}

export type PhotoReviewRegion = {
  x: number                   // pixel coordinates — placeholder from mock; real CV supplies actual coords
  y: number
  width: number
  height: number
  reason: "opt_out_match" | "manual_review"
  confidencePercent: number
  attendeeId?: string
  attendeeName?: string
}

export type PhotoReviewModel = {
  photoId: string
  eventId: string
  fileName: string
  originalImageUrl: string
  redactedImageUrl?: string
  status: PhotoProcessingStatus
  statusLabel: string
  participants: PhotoReviewParticipant[]
  regions: PhotoReviewRegion[]
  highestConfidencePercent?: number
  needsManualReview: boolean
  confidenceWarning: string
}
