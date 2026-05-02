import type { RedactionPlan, RedactionApplyResult } from "../../types/ai-redaction"

/**
 * apply-redaction.ts — TypeScript adapter for the redaction application layer.
 *
 * Two implementations exist:
 *
 * 1. applyRedactionPlanMock()
 *    Always available. Returns a no-op RedactionApplyResult. Used when the
 *    Python helper is not running or during frontend/backend development.
 *
 * 2. applyRedactionPlan()
 *    Calls the Python FastAPI helper at REDACTION_API_URL.
 *    Requires: Python helper running (`uvicorn ai_redaction.server:app`)
 *    Falls back to the mock result if the helper is unreachable.
 *
 * To enable the real implementation:
 *   Set REDACTION_API_URL (e.g. http://localhost:8000) in your .env file.
 *   The Python helper must be running and Pillow must be installed.
 */

const REDACTION_API_URL =
  typeof process !== "undefined"
    ? process.env.REDACTION_API_URL ?? ""
    : ""

// ---------------------------------------------------------------------------
// Mock implementation — always safe, no dependencies
// ---------------------------------------------------------------------------

export function applyRedactionPlanMock(
  plan: RedactionPlan,
  imagePath: string
): RedactionApplyResult {
  if (plan.boxes.length === 0) {
    return {
      photoId: plan.photoId,
      eventId: plan.eventId,
      originalImagePath: imagePath,
      outputImagePath: imagePath,
      boxesApplied: 0,
      boxesSkipped: 0,
      needsManualReview: plan.needsManualReview,
      success: true,
    }
  }

  // Mock: pretend every box was applied. No actual image is modified.
  return {
    photoId: plan.photoId,
    eventId: plan.eventId,
    originalImagePath: imagePath,
    // Placeholder path — matches the convention used by the Python helper.
    outputImagePath: imagePath.replace(/(\.\w+)$/, "_redacted$1"),
    boxesApplied: plan.boxes.length,
    boxesSkipped: 0,
    needsManualReview: plan.needsManualReview,
    success: true,
  }
}

// ---------------------------------------------------------------------------
// Real implementation — calls Python FastAPI helper
// TODO: implement ai_redaction/server.py (FastAPI) to expose POST /redact
//       then set REDACTION_API_URL=http://localhost:8000 in .env
// ---------------------------------------------------------------------------

export async function applyRedactionPlan(
  plan: RedactionPlan,
  imagePath: string
): Promise<RedactionApplyResult> {
  if (!REDACTION_API_URL) {
    // Python helper not configured — use mock so callers are never blocked.
    return applyRedactionPlanMock(plan, imagePath)
  }

  try {
    const response = await fetch(`${REDACTION_API_URL}/redact`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imagePath, plan }),
    })

    if (!response.ok) {
      throw new Error(`Python helper returned ${response.status}`)
    }

    return (await response.json()) as RedactionApplyResult
  } catch (err) {
    // Helper is unreachable or errored — degrade gracefully to mock.
    const message = err instanceof Error ? err.message : String(err)
    return {
      ...applyRedactionPlanMock(plan, imagePath),
      success: false,
      error: `Python helper unavailable (${message}). Using mock result.`,
    }
  }
}
