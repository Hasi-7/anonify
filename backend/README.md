# anonify Backend

This backend workspace is for the `person 2` role: internal data models, storage, and app APIs for anonify.

## Goal

Build a reliable event-scoped backend that supports:

- event creation and event key generation
- event lookup by public event key
- attendee opt-out submissions scoped to an event
- event photo registration and listing
- mock detection/results for photo review
- event-scoped access and data isolation

## Phase 1: Backend plan

1. Define backend API contract and data model design.
2. Scaffold a Flask app and core health check route.
3. Implement `Event` creation and event key management.
4. Implement attendee submission and event-scoped attendee listing.
5. Implement event photo registration and listing.
6. Add photo review/detail endpoint with mocked detections.
7. Implement a mock storage layer with event-scoped isolation.
8. Add unit tests for event-scoped rules and API contract.

## Shared import note

- Frontend and backend agents should use:
  `import { processEventPhotos } from "@/lib/processing/mock-processor"`

## Data models (high-level)

- Event
  - id
  - name
  - event_key
  - organizer_id
  - created_at

- Attendee
  - id
  - event_id
  - name
  - consent_status
  - opted_out
  - reference_photo_url
  - submitted_at

- EventPhoto
  - id
  - event_id
  - filename
  - source
  - status
  - uploaded_at
  - processed_at

- Detection
  - id
  - photo_id
  - attendee_id
  - attendee_name
  - confidence
  - redaction_status
  - manual_review_required
  - reference_photo_url

## API contract (initial)

- `POST /events` — create an event
- `GET /events/{event_id}` — get event details
- `GET /events/key/{event_key}` — lookup event by public key
- `POST /events/{event_id}/attendees` — add attendee opt-out submission
- `GET /events/{event_id}/attendees` — list event attendees
- `POST /events/{event_id}/photos` — register an event photo
- `GET /events/{event_id}/photos` — list event photos
- `GET /events/{event_id}/photos/{photo_id}` — photo review details

## Next action

- Create the first backend files and add the FastAPI app scaffold in `backend/`.
