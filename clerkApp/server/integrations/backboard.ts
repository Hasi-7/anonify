import "server-only"
import type {
  PrivacyReviewDetection,
  PrivacyReviewSummary,
  PrivacyReviewSummaryInput,
} from "./types"

type BackboardConfig = {
  apiKey?: string
  projectId?: string
  apiUrl?: string
}

type BackboardMetadataPayload = Omit<
  PrivacyReviewSummaryInput,
  "detections"
> & {
  detections: PrivacyReviewDetection[]
}

function getBackboardConfig(): BackboardConfig {
  return {
    apiKey: process.env.BACKBOARD_API_KEY,
    projectId: process.env.BACKBOARD_PROJECT_ID,
    apiUrl: process.env.BACKBOARD_API_URL,
  }
}

function hasBackboardConfig(config: BackboardConfig): boolean {
  return Boolean(config.apiKey && config.projectId && config.apiUrl)
}

function createMetadataOnlyPayload(
  input: PrivacyReviewSummaryInput,
): BackboardMetadataPayload {
  return {
    eventId: input.eventId,
    eventName: input.eventName,
    eventKey: input.eventKey,
    photosProcessed: input.photosProcessed,
    optOutAttendees: input.optOutAttendees,
    matchesFound: input.matchesFound,
    photosNeedingReview: input.photosNeedingReview,
    detections: input.detections.map((detection) => ({
      photoId: detection.photoId,
      fileName: detection.fileName,
      attendeeName: detection.attendeeName,
      confidence: detection.confidence,
      status: detection.status,
    })),
  }
}

function getRiskLevel(
  input: PrivacyReviewSummaryInput,
): PrivacyReviewSummary["riskLevel"] {
  if (input.photosNeedingReview >= 4 || input.matchesFound >= 7) {
    return "high"
  }

  if (input.photosNeedingReview > 0 || input.matchesFound > 0) {
    return "medium"
  }

  return "low"
}

function getHighestRiskDetection(
  detections: PrivacyReviewDetection[],
): PrivacyReviewDetection | undefined {
  const reviewDetections = detections.filter(
    (detection) => detection.status === "manual_review",
  )
  const candidates = reviewDetections.length > 0 ? reviewDetections : detections

  return [...candidates].sort((a, b) => b.confidence - a.confidence)[0]
}

function createRecommendedActions(
  input: PrivacyReviewSummaryInput,
): string[] {
  if (input.photosNeedingReview === 0) {
    return [
      "Confirm the redacted preview looks correct before publishing.",
      "Keep attendee opt-out records scoped to this event.",
    ]
  }

  return [
    "Do not publish the album until all manual-review photos are approved.",
    "Review every detection marked manual_review before sharing externally.",
    "Keep raw photos and attendee reference photos out of Backboard.",
  ]
}

export function generateMockPrivacyReviewSummary(
  input: PrivacyReviewSummaryInput,
): PrivacyReviewSummary {
  const highestRisk = getHighestRiskDetection(input.detections)
  const riskLevel = getRiskLevel(input)
  const highestRiskText = highestRisk
    ? ` Highest-risk photo: ${highestRisk.fileName}, ${highestRisk.attendeeName}, ${highestRisk.confidence}% confidence.`
    : " No restricted-attendee detections were found."

  return {
    eventId: input.eventId,
    generatedAt: new Date().toISOString(),
    summary:
      `Privacy Review Summary: ${input.photosProcessed} photos processed. ` +
      `${input.matchesFound} restricted-attendee detections found. ` +
      `${input.photosNeedingReview} photos require manual review.` +
      highestRiskText,
    riskLevel,
    recommendedActions: createRecommendedActions(input),
    photosToReview: input.detections
      .filter((detection) => detection.status === "manual_review")
      .map((detection) => ({
        photoId: detection.photoId,
        fileName: detection.fileName,
        reason:
          `${detection.attendeeName} needs manual review at ` +
          `${detection.confidence}% confidence.`,
      })),
    usedMock: true,
  }
}

export async function generatePrivacyReviewSummary(
  input: PrivacyReviewSummaryInput,
): Promise<PrivacyReviewSummary> {
  const config = getBackboardConfig()

  if (!hasBackboardConfig(config)) {
    return generateMockPrivacyReviewSummary(input)
  }

  try {
    const response = await fetch(`${config.apiUrl}/privacy-review-summary`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        "X-Backboard-Project-Id": config.projectId ?? "",
      },
      body: JSON.stringify(createMetadataOnlyPayload(input)),
    })

    if (!response.ok) {
      throw new Error(`Backboard request failed with status ${response.status}`)
    }

    const data = (await response.json()) as Partial<PrivacyReviewSummary>

    return {
      ...generateMockPrivacyReviewSummary(input),
      ...data,
      eventId: input.eventId,
      generatedAt: data.generatedAt ?? new Date().toISOString(),
      usedMock: false,
    }
  } catch (error) {
    return {
      ...generateMockPrivacyReviewSummary(input),
      usedMock: true,
      error: error instanceof Error ? error.message : "Backboard request failed",
    }
  }
}
