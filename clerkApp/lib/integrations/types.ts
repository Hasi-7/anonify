export type {
  PrivacyReviewDetection,
  PrivacyReviewSummaryInput,
} from "@/types/integrations"

/**
 * Extends the base PrivacyReviewSummary with a `provider` field that
 * identifies which back-end produced the summary.
 *
 * Using a local definition here (rather than mutating @/types/integrations)
 * keeps the server/integrations/backboard.ts return type stable.
 */
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
  provider: "mock" | "gemini" | "backboard"
  error?: string
}
