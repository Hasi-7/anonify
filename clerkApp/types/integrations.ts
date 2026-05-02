export type IntegrationSource = "mock" | "google_drive" | "backboard"

export type EventPhotoLike = {
  photoId: string
  eventId: string
  fileName: string
  mimeType: string
  source: "google_drive" | "upload" | "mock"
  status: "pending" | "processing" | "processed" | "manual_review"
  driveFileId?: string
  thumbnailUrl?: string
  webViewLink?: string
  uploadedAt?: string
  usedMock: boolean
}

export type PrivacyReviewDetection = {
  photoId: string
  fileName: string
  attendeeName: string
  confidence: number
  status: "auto_blurred" | "manual_review" | "approved" | "rejected"
}

export type PrivacyReviewSummaryInput = {
  eventId: string
  eventName: string
  eventKey: string
  photosProcessed: number
  optOutAttendees: number
  matchesFound: number
  photosNeedingReview: number
  detections: PrivacyReviewDetection[]
}

export type PrivacyReviewSummary = {
  eventId: string
  generatedAt: string
  summary: string
  riskLevel: "low" | "medium" | "high"
  recommendedActions: string[]
  photosToReview: {
    photoId: string
    fileName: string
    reason: string
  }[]
  usedMock: boolean
  error?: string
}
