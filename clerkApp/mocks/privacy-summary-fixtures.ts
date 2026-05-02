import type { PrivacyReviewSummaryInput } from "@/types/integrations"
import type { PrivacyReviewSummary } from "@/lib/integrations/types"

export const MOCK_PRIVACY_SUMMARY_INPUT: PrivacyReviewSummaryInput = {
  eventId: "event_demo_001",
  eventName: "HuskyHack Demo",
  eventKey: "HUSKY-42F7",
  photosProcessed: 24,
  optOutAttendees: 7,
  matchesFound: 7,
  photosNeedingReview: 3,
  detections: [
    {
      photoId: "photo_001",
      fileName: "group_photo_1.jpg",
      attendeeName: "Maya Chen",
      confidence: 91,
      status: "auto_blurred",
    },
    {
      photoId: "photo_001",
      fileName: "group_photo_1.jpg",
      attendeeName: "Jordan Lee",
      confidence: 63,
      status: "manual_review",
    },
    {
      photoId: "photo_002",
      fileName: "panel_discussion.jpg",
      attendeeName: "Alex Rivera",
      confidence: 78,
      status: "manual_review",
    },
    {
      photoId: "photo_003",
      fileName: "booth_visit.jpg",
      attendeeName: "Sam Park",
      confidence: 72,
      status: "manual_review",
    },
  ],
}

export const MOCK_PRIVACY_SUMMARY_INPUT_LOW_RISK: PrivacyReviewSummaryInput = {
  eventId: "event_demo_002",
  eventName: "Small Workshop",
  eventKey: "WORK-8A1C",
  photosProcessed: 5,
  optOutAttendees: 1,
  matchesFound: 1,
  photosNeedingReview: 0,
  detections: [
    {
      photoId: "photo_010",
      fileName: "welcome_slide.jpg",
      attendeeName: "Riley Kim",
      confidence: 93,
      status: "auto_blurred",
    },
  ],
}

/** Pre-computed mock output for snapshot tests and Storybook. */
export const MOCK_PRIVACY_SUMMARY_RESULT: PrivacyReviewSummary = {
  eventId: "event_demo_001",
  generatedAt: "2026-05-02T12:00:00.000Z",
  summary:
    "Privacy Review Summary: 24 photos processed. 7 restricted-attendee detections found across 7 opted-out attendees. 3 photos require manual review before publishing.",
  riskLevel: "high",
  recommendedActions: [
    "Do not publish the album until all manual-review photos are approved or rejected.",
    "Review every detection marked manual_review before sharing externally.",
    "High number of photos need review — consider delaying publication until the review is complete.",
  ],
  photosToReview: [
    {
      photoId: "photo_001",
      fileName: "group_photo_1.jpg",
      reason:
        "Jordan Lee detected at 63% confidence — requires manual approval.",
    },
    {
      photoId: "photo_002",
      fileName: "panel_discussion.jpg",
      reason:
        "Alex Rivera detected at 78% confidence — requires manual approval.",
    },
    {
      photoId: "photo_003",
      fileName: "booth_visit.jpg",
      reason: "Sam Park detected at 72% confidence — requires manual approval.",
    },
  ],
  usedMock: true,
  provider: "mock",
}
