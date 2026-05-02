/**
 * privacy-summary.ts — metadata-only privacy review summary adapter.
 *
 * METADATA POLICY: This function never receives, sends, or stores raw photos,
 * reference images, face embeddings, or biometric data. It operates on
 * aggregate counts and detection metadata (names, confidence scores, statuses)
 * that were already produced by the AI/redaction pipeline.
 *
 * Provider selection (runtime, server-side only):
 *   1. BACKBOARD_API_KEY + BACKBOARD_PROJECT_ID + BACKBOARD_API_URL → Backboard
 *      (real implementation lives in server/integrations/backboard.ts)
 *   2. GEMINI_API_KEY → Gemini
 *      (TODO seam — not yet implemented)
 *   3. Neither → mock summary (default, always safe)
 *
 * The function always returns a valid PrivacyReviewSummary. It never throws.
 */

import type { PrivacyReviewSummaryInput } from "@/types/integrations"
import type { PrivacyReviewSummary } from "./types"

// ---------------------------------------------------------------------------
// Risk level
// ---------------------------------------------------------------------------

function getRiskLevel(
  photosNeedingReview: number,
): PrivacyReviewSummary["riskLevel"] {
  if (photosNeedingReview >= 3) return "high"
  if (photosNeedingReview >= 1) return "medium"
  return "low"
}

// ---------------------------------------------------------------------------
// Recommended actions
// ---------------------------------------------------------------------------

function getRecommendedActions(
  input: PrivacyReviewSummaryInput,
): string[] {
  if (input.photosNeedingReview === 0) {
    return [
      "Confirm the redacted preview looks correct before publishing.",
      "Keep attendee opt-out records scoped to this event only.",
    ]
  }

  const actions = [
    "Do not publish the album until all manual-review photos are approved or rejected.",
    "Review every detection marked manual_review before sharing externally.",
  ]

  if (input.photosNeedingReview >= 3) {
    actions.push(
      "High number of photos need review — consider delaying publication until the review is complete.",
    )
  }

  return actions
}

// ---------------------------------------------------------------------------
// Mock implementation
// ---------------------------------------------------------------------------

export function generateMockPrivacyReviewSummary(
  input: PrivacyReviewSummaryInput,
): PrivacyReviewSummary {
  const riskLevel = getRiskLevel(input.photosNeedingReview)

  const reviewItems = input.detections
    .filter((d) => d.status === "manual_review")
    .map((d) => ({
      photoId: d.photoId,
      fileName: d.fileName,
      reason: `${d.attendeeName} detected at ${d.confidence}% confidence — requires manual approval.`,
    }))

  const summaryLines = [
    `Privacy Review Summary: ${input.photosProcessed} photo${input.photosProcessed !== 1 ? "s" : ""} processed.`,
    `${input.matchesFound} restricted-attendee detection${input.matchesFound !== 1 ? "s" : ""} found across ${input.optOutAttendees} opted-out attendee${input.optOutAttendees !== 1 ? "s" : ""}.`,
  ]

  if (input.photosNeedingReview === 0) {
    summaryLines.push("No photos require manual review.")
  } else {
    summaryLines.push(
      `${input.photosNeedingReview} photo${input.photosNeedingReview !== 1 ? "s" : ""} require manual review before publishing.`,
    )
  }

  return {
    eventId: input.eventId,
    generatedAt: new Date().toISOString(),
    summary: summaryLines.join(" "),
    riskLevel,
    recommendedActions: getRecommendedActions(input),
    photosToReview: reviewItems,
    usedMock: true,
    provider: "mock",
  }
}

// ---------------------------------------------------------------------------
// Provider config detection (server-side env vars only)
// ---------------------------------------------------------------------------

function hasBackboardConfig(): boolean {
  return Boolean(
    process.env.BACKBOARD_API_KEY &&
      process.env.BACKBOARD_PROJECT_ID &&
      process.env.BACKBOARD_API_URL,
  )
}

function hasGeminiConfig(): boolean {
  return Boolean(process.env.GEMINI_API_KEY)
}

// ---------------------------------------------------------------------------
// Backboard provider
// Mirrors the metadata-only payload logic from server/integrations/backboard.ts.
// Raw images, embeddings, and biometric data are never included.
// ---------------------------------------------------------------------------

async function generateViaBackboard(
  input: PrivacyReviewSummaryInput,
): Promise<PrivacyReviewSummary> {
  const apiUrl = process.env.BACKBOARD_API_URL!
  const apiKey = process.env.BACKBOARD_API_KEY!
  const projectId = process.env.BACKBOARD_PROJECT_ID!

  // Metadata-only payload — no photos, no embeddings, no biometric data.
  const payload = {
    eventId: input.eventId,
    eventName: input.eventName,
    eventKey: input.eventKey,
    photosProcessed: input.photosProcessed,
    optOutAttendees: input.optOutAttendees,
    matchesFound: input.matchesFound,
    photosNeedingReview: input.photosNeedingReview,
    detections: input.detections.map((d) => ({
      photoId: d.photoId,
      fileName: d.fileName,
      attendeeName: d.attendeeName,
      confidence: d.confidence,
      status: d.status,
    })),
  }

  const response = await fetch(`${apiUrl}/privacy-review-summary`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "X-Backboard-Project-Id": projectId,
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error(`Backboard responded with status ${response.status}`)
  }

  const data = (await response.json()) as Partial<PrivacyReviewSummary>

  return {
    ...generateMockPrivacyReviewSummary(input),
    ...data,
    eventId: input.eventId,
    generatedAt: data.generatedAt ?? new Date().toISOString(),
    usedMock: false,
    provider: "backboard",
  }
}

// ---------------------------------------------------------------------------
// Gemini provider — TODO seam
// Wire this when a Gemini integration pattern is established.
// Only metadata (counts, names, statuses) should be sent — never image bytes.
// ---------------------------------------------------------------------------

async function generateViaGemini(
  _: PrivacyReviewSummaryInput,
): Promise<PrivacyReviewSummary> {
  // TODO: implement Gemini prompt-based summary generation.
  // The prompt should include only metadata: counts, file names, confidence
  // scores, and statuses. No image data, base64, or embeddings.
  //
  // Suggested prompt structure:
  //   "You are a privacy review assistant. Summarize the following event photo
  //    processing results and identify any risk areas: [metadata JSON]"
  //
  // Install: npm install @google/generative-ai
  // Env var: GEMINI_API_KEY
  throw new Error("Gemini provider is not yet implemented.")
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export async function generatePrivacyReviewSummary(
  input: PrivacyReviewSummaryInput,
): Promise<PrivacyReviewSummary> {
  if (hasBackboardConfig()) {
    try {
      return await generateViaBackboard(input)
    } catch (error) {
      return {
        ...generateMockPrivacyReviewSummary(input),
        usedMock: true,
        provider: "mock",
        error:
          error instanceof Error
            ? error.message
            : "Backboard request failed. Fell back to mock summary.",
      }
    }
  }

  if (hasGeminiConfig()) {
    try {
      return await generateViaGemini(input)
    } catch (error) {
      return {
        ...generateMockPrivacyReviewSummary(input),
        usedMock: true,
        provider: "mock",
        error:
          error instanceof Error
            ? error.message
            : "Gemini request failed. Fell back to mock summary.",
      }
    }
  }

  return generateMockPrivacyReviewSummary(input)
}
