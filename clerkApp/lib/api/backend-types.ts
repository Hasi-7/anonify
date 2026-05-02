export type BackendApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number }

export type BackendHealthResponse = {
  status: string
  backend: string
  mode: string
}

export type BackendSeedResponse = {
  message: string
  seeded: boolean
  event_key?: string
  attendees_created?: number
  photos_created?: number
  detections_created?: number
}

export type BackendEvent = {
  id: number
  name: string
  event_key: string
  organizer_id: string | null
  created_at: string
}

export type BackendEventOverview = {
  event_name: string
  event_key: string
  attendee_link: string
  total_attendees: number
  opted_out_count: number
  photo_count: number
  processed_count: number
  needs_review_count: number
}

export type BackendAttendee = {
  id: number
  event_id: number
  name: string
  consent_status: "opted_out" | "consented"
  opted_out: boolean
  reference_photo_url: string | null
  submitted_at: string
}

export type BackendPhoto = {
  id: number
  event_id: number
  filename: string
  source: "upload" | "google_drive"
  status: string
  uploaded_at: string
  processed_at: string | null
  original_image_url?: string
  redacted_image_url?: string | null
  detection_count?: number
  max_confidence?: number
}

export type BackendDetection = {
  id: number
  photo_id: number
  attendee_id: number
  attendee_name: string
  // Flask stores confidence as an integer percent, e.g. 91 for 91%.
  confidence: number
  redaction_status: string
  manual_review_required: boolean
  reference_photo_url: string | null
  bounding_box?: [number, number, number, number]
}

export type BackendPhotoDetail = BackendPhoto & {
  detections: BackendDetection[]
  processing?: {
    match?: unknown
    redaction?: unknown
    detections_inserted?: number
  }
}

export type SubmitAttendeePayload = {
  name: string
  consent_status: "opted_out" | "consented"
  opted_out?: boolean
  reference_photo_url?: string | null
}

export type CreateEventPayload = {
  name: string
  organizer_id?: string | null
}

export type RegisterPhotoPayload = {
  filename: string
  source?: "upload" | "google_drive"
}

export type UploadPhotoPayload = {
  file_name: string
  image_data_url: string
}

export type ProcessPhotoPayload = {
  image_data_url?: string
  image_path?: string
  original_image_url?: string
}

export type FrontendEvent = {
  id: string
  name: string
  key: string
  organizerId: string | null
  createdAt: string
}

export type FrontendEventOverview = {
  id?: string
  name: string
  key: string
  attendeeLink: string
  attendees: number
  optOuts: number
  photos: number
  processed: number
  needsReview: number
}

export type FrontendAttendee = {
  id: string
  eventId: string
  name: string
  consentStatus: "opted_out" | "consented"
  optedOut: boolean
  referencePhotoUrl: string | null
  submittedAt: string
}

export type FrontendPhoto = {
  id: string
  eventId: string
  filename: string
  source: "upload" | "google_drive"
  status: string
  uploadedAt: string
  processedAt: string | null
  originalImageUrl?: string
  redactedImageUrl?: string | null
  detectionCount?: number
  maxConfidencePercent?: number
}

export type FrontendDetection = {
  id: string
  photoId: string
  attendeeId: string
  attendeeName: string
  confidencePercent: number
  confidenceRaw: number
  redactionStatus: string
  manualReviewRequired: boolean
  referencePhotoUrl: string | null
  boundingBox?: { x: number; y: number; width: number; height: number }
}

export type FrontendPhotoDetail = FrontendPhoto & {
  detections: FrontendDetection[]
}
