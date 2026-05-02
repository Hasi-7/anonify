import type { DetectionStatus } from "../../types/ai-redaction"

export const CONFIDENCE_THRESHOLDS = {
  HIGH: 0.9,   // >= 0.90 → auto_blurred
  MEDIUM: 0.7, // >= 0.70 → manual_review (blur but flag)
  // < 0.70 → manual_review (uncertain)
} as const

export type ConfidenceLevel = "high" | "medium" | "low"

export function getConfidenceLevel(confidence: number): ConfidenceLevel {
  if (confidence >= CONFIDENCE_THRESHOLDS.HIGH) return "high"
  if (confidence >= CONFIDENCE_THRESHOLDS.MEDIUM) return "medium"
  return "low"
}

export function getStatusFromConfidence(confidence: number): DetectionStatus {
  if (confidence >= CONFIDENCE_THRESHOLDS.HIGH) return "auto_blurred"
  // Both medium and low land in manual_review — medium is blurred + reviewed,
  // low is unblurred pending human confirmation. The reviewer UI distinguishes them
  // via the raw confidence value.
  return "manual_review"
}

export function requiresManualReview(confidence: number): boolean {
  return confidence < CONFIDENCE_THRESHOLDS.HIGH
}
