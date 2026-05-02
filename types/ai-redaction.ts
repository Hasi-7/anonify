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
