import type {
  OptedOutAttendee,
  EventPhoto,
  ProcessingInput,
} from "../types/ai-redaction"

// Deterministic sample data scoped to a single demo event.
// Replace with real event/attendee records once the backend models exist.

export const DEMO_EVENT_ID = "event_demo_001"

export const MOCK_OPTED_OUT_ATTENDEES: OptedOutAttendee[] = [
  {
    attendeeId: "attendee_001",
    attendeeName: "Alex Rivera",
    referenceImageUrl: "/mocks/images/ref_alex_rivera.jpg",
  },
  {
    attendeeId: "attendee_002",
    attendeeName: "Morgan Lee",
    referenceImageUrl: "/mocks/images/ref_morgan_lee.jpg",
  },
  {
    attendeeId: "attendee_003",
    attendeeName: "Jordan Kim",
    // no reference image — processor should still flag if found
  },
]

export const MOCK_EVENT_PHOTOS: EventPhoto[] = [
  {
    photoId: "photo_001",
    fileName: "event-stage-01.jpg",
    originalImageUrl: "/mocks/images/event-stage-01.jpg",
  },
  {
    photoId: "photo_002",
    fileName: "networking-01.jpg",
    originalImageUrl: "/mocks/images/networking-01.jpg",
  },
  {
    photoId: "photo_003",
    fileName: "workshop-group.jpg",
    originalImageUrl: "/mocks/images/workshop-group.jpg",
  },
  {
    photoId: "photo_004",
    fileName: "closing-ceremony.jpg",
    originalImageUrl: "/mocks/images/closing-ceremony.jpg",
  },
]

export const MOCK_PROCESSING_INPUT: ProcessingInput = {
  eventId: DEMO_EVENT_ID,
  photos: MOCK_EVENT_PHOTOS,
  optedOutAttendees: MOCK_OPTED_OUT_ATTENDEES,
}

// Pre-seeded confidence values used by the mock processor.
// Keyed by photoId → attendeeId → confidence score.
// This makes mock output fully deterministic and reproducible.
export const MOCK_CONFIDENCE_MAP: Record<
  string,
  Record<string, number>
> = {
  // photo_001: high-confidence match for Alex Rivera
  photo_001: {
    attendee_001: 0.91,
  },
  // photo_002: medium-confidence match for Morgan Lee
  photo_002: {
    attendee_002: 0.78,
  },
  // photo_003: low-confidence match for Jordan Kim (no reference image)
  photo_003: {
    attendee_003: 0.63,
  },
  // photo_004: no matches — clean photo
  photo_004: {},
}
