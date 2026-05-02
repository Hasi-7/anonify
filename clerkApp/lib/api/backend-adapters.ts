import type {
  BackendAttendee,
  BackendDetection,
  BackendEvent,
  BackendEventOverview,
  BackendPhoto,
  BackendPhotoDetail,
  FrontendAttendee,
  FrontendDetection,
  FrontendEvent,
  FrontendEventOverview,
  FrontendPhoto,
  FrontendPhotoDetail,
} from "./backend-types"

export function adaptEvent(event: BackendEvent): FrontendEvent {
  return {
    id: String(event.id),
    name: event.name,
    key: event.event_key,
    organizerId: event.organizer_id,
    createdAt: event.created_at,
  }
}

export function adaptEventOverview(
  overview: BackendEventOverview,
  eventId?: string | number
): FrontendEventOverview {
  return {
    id: eventId === undefined ? undefined : String(eventId),
    name: overview.event_name,
    key: overview.event_key,
    attendeeLink: overview.attendee_link,
    attendees: overview.total_attendees,
    optOuts: overview.opted_out_count,
    photos: overview.photo_count,
    processed: overview.processed_count,
    needsReview: overview.needs_review_count,
  }
}

export function adaptAttendee(attendee: BackendAttendee): FrontendAttendee {
  return {
    id: String(attendee.id),
    eventId: String(attendee.event_id),
    name: attendee.name,
    consentStatus: attendee.consent_status,
    optedOut: attendee.opted_out,
    referencePhotoUrl: attendee.reference_photo_url,
    submittedAt: attendee.submitted_at,
  }
}

export function adaptPhoto(photo: BackendPhoto): FrontendPhoto {
  return {
    id: String(photo.id),
    eventId: String(photo.event_id),
    filename: photo.filename,
    source: photo.source,
    status: photo.status,
    uploadedAt: photo.uploaded_at,
    processedAt: photo.processed_at,
    originalImageUrl: photo.original_image_url,
    redactedImageUrl: photo.redacted_image_url,
    detectionCount: photo.detection_count,
    maxConfidencePercent: photo.max_confidence,
  }
}

export function adaptDetection(detection: BackendDetection): FrontendDetection {
  const [x, y, width, height] = detection.bounding_box ?? []

  return {
    id: String(detection.id),
    photoId: String(detection.photo_id),
    attendeeId: String(detection.attendee_id),
    attendeeName: detection.attendee_name,
    confidencePercent: detection.confidence,
    confidenceRaw: detection.confidence / 100,
    redactionStatus: detection.redaction_status,
    manualReviewRequired: detection.manual_review_required,
    referencePhotoUrl: detection.reference_photo_url,
    boundingBox:
      x === undefined || y === undefined || width === undefined || height === undefined
        ? undefined
        : { x, y, width, height },
  }
}

export function adaptPhotoDetail(photo: BackendPhotoDetail): FrontendPhotoDetail {
  return {
    ...adaptPhoto(photo),
    detections: photo.detections.map(adaptDetection),
  }
}
