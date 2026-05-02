# anonify Backend

`backend/` is the canonical Flask + SQLite backend for anonify.

## Responsibilities

- Flask HTTP API routes.
- SQLite persistence.
- Event, attendee, consent, photo, detection, and processing-result data.
- Event key generation and validation.
- Event-scoped access rules.
- Mock storage while the demo flow is still evolving.

## Goal

Build a reliable event-scoped backend that supports:

- event creation and event key generation
- event lookup by public event key
- attendee opt-out submissions scoped to an event
- event photo registration and listing
- mock detection/results for photo review
- event-scoped access and data isolation

## Completed Backend Work

- Flask app with CORS.
- Event, Attendee, Photo, and Detection dataclasses.
- Full CRUD functions with event-scoped isolation.
- API routes per contract.
- Mock seed data with demo event, attendees, photos, and detections.
- Pytest coverage for API and model behavior.

## Shared Import Note

Frontend and backend agents should use:

```ts
import { processEventPhotos } from "@/lib/processing/mock-processor"
```

## Data Models

- Event: id, name, event_key, organizer_id, created_at.
- Attendee: id, event_id, name, consent_status, opted_out, reference_photo_url, submitted_at.
- EventPhoto: id, event_id, filename, source, status, uploaded_at, processed_at.
- Detection: id, photo_id, attendee_id, attendee_name, confidence, redaction_status, manual_review_required, reference_photo_url.

## API Contract

- `POST /events` - create an event
- `GET /events/{event_id}` - get event details
- `GET /events/key/{event_key}` - lookup event by public event key
- `POST /events/{event_id}/attendees` - add attendee opt-out submission
- `GET /events/{event_id}/attendees` - list event attendees
- `POST /events/{event_id}/photos` - register an event photo
- `GET /events/{event_id}/photos` - list event photos
- `GET /events/{event_id}/photos/{photo_id}` - photo review details

## Local Development

Use this directory for backend work:

```sh
cd backend
```

Install Python dependencies from the project manifest when working on the backend or helper:

```sh
python -m pip install -r ../requirements.txt
```

Run the Flask app:

```sh
flask --app app run --debug
```

SQLite uses Python's standard library. Keep database files and generated local state out of git.

## Framework Note

The backend is Flask, not FastAPI. FastAPI or Uvicorn dependencies, if present in the shared Python manifest, are for the separate redaction helper/server and should not be treated as the canonical backend framework.
