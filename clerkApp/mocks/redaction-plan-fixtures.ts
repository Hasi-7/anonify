import type { RedactionPlan } from "../types/ai-redaction"
import { DEMO_EVENT_ID } from "./processing-fixtures"

/**
 * Pre-computed example RedactionPlans for the four demo photos.
 *
 * These are derived from the mock processing results and can be used
 * directly by the frontend for the Original/Redacted toggle without
 * calling the processor at all.
 *
 * In production, generate these via:
 *   import { createRedactionPlans } from "@/lib/processing/redaction-plan"
 *   const plans = createRedactionPlans(summary)
 */
export const MOCK_REDACTION_PLANS: RedactionPlan[] = [
  {
    // photo_001 — Alex Rivera, 0.91 confidence, auto-blurred
    photoId: "photo_001",
    eventId: DEMO_EVENT_ID,
    originalImageUrl: "/mocks/images/event-stage-01.jpg",
    boxes: [
      {
        x: 120,
        y: 80,
        width: 64,
        height: 80,
        reason: "opt_out_match",
        confidence: 0.91,
        attendeeId: "attendee_001",
        attendeeName: "Alex Rivera",
      },
    ],
    needsManualReview: false,
  },
  {
    // photo_002 — Morgan Lee, 0.78 confidence, manual review
    photoId: "photo_002",
    eventId: DEMO_EVENT_ID,
    originalImageUrl: "/mocks/images/networking-01.jpg",
    boxes: [
      {
        x: 120,
        y: 80,
        width: 64,
        height: 80,
        reason: "manual_review",
        confidence: 0.78,
        attendeeId: "attendee_002",
        attendeeName: "Morgan Lee",
      },
    ],
    needsManualReview: true,
  },
  {
    // photo_003 — Jordan Kim, 0.63 confidence, manual review, no reference image
    photoId: "photo_003",
    eventId: DEMO_EVENT_ID,
    originalImageUrl: "/mocks/images/workshop-group.jpg",
    boxes: [
      {
        x: 120,
        y: 80,
        width: 64,
        height: 80,
        reason: "manual_review",
        confidence: 0.63,
        attendeeId: "attendee_003",
        attendeeName: "Jordan Kim",
      },
    ],
    needsManualReview: true,
  },
  {
    // photo_004 — no opted-out attendees found
    photoId: "photo_004",
    eventId: DEMO_EVENT_ID,
    originalImageUrl: "/mocks/images/closing-ceremony.jpg",
    boxes: [],
    needsManualReview: false,
  },
]

/**
 * Look up a single plan by photoId.
 * Returns undefined if the photo is not in the demo fixture set.
 */
export function getMockRedactionPlan(
  photoId: string
): RedactionPlan | undefined {
  return MOCK_REDACTION_PLANS.find((p) => p.photoId === photoId)
}
