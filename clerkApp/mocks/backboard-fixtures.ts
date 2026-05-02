import type { PrivacyReviewSummaryInput } from "@/types/integrations"

export const MOCK_PRIVACY_REVIEW_SUMMARY_INPUT: PrivacyReviewSummaryInput = {
  eventId: "event_demo_001",
  eventName: "HuskyHack Demo",
  eventKey: "HUSKY-42F7",
  photosProcessed: 24,
  optOutAttendees: 7,
  matchesFound: 7,
  photosNeedingReview: 4,
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
      photoId: "photo_001",
      fileName: "group_photo_1.jpg",
      attendeeName: "Sam Park",
      confidence: 45,
      status: "manual_review",
    },
    {
      photoId: "photo_002",
      fileName: "panel_discussion.jpg",
      attendeeName: "Alex Rivera",
      confidence: 78,
      status: "manual_review",
    },
  ],
}
