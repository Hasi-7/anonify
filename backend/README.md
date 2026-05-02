# anonify Backend

`backend/` is the canonical Flask + SQLite backend for anonify.

## Responsibilities

- Flask HTTP API routes.
- SQLite persistence.
- Event, attendee, consent, photo, detection, and processing-result data.
- Event key generation and validation.
- Event-scoped access rules.
- Mock storage while the demo flow is still evolving.

## API Contract for Frontend

**Base URL:** `http://localhost:5000`
**Demo Event Key:** `HUSKY-42F7` (Available after running seed script)

### Field Naming Conventions
- All fields use `snake_case`.
- **Confidence Format:** `confidence` is represented as an **integer percentage** (e.g., `91`, `78`, `63`). You can display this directly as `91%`.
- **Bounding Box Format:** `bounding_box` is represented as an array of four integers `[x, y, width, height]`.

### Endpoints

#### 1. Events

**`GET /events`**
List all events for an organizer. Requires `?organizer_id=...` parameter.

**`GET /events/key/<event_key>`**
Lookup an event by its public key (used by attendees).
*Response Example:*
```json
{
  "id": 1,
  "name": "HuskyHack Demo",
  "event_key": "HUSKY-42F7",
  "organizer_id": "demo_organizer_001",
  "created_at": "2026-05-02T12:00:00Z"
}
```

**`GET /events/<event_id>/overview`**
Get dashboard statistics for a specific event.
*Response Example:*
```json
{
  "event_name": "HuskyHack Demo",
  "event_key": "HUSKY-42F7",
  "attendee_link": "/attend?eventKey=HUSKY-42F7",
  "total_attendees": 6,
  "opted_out_count": 4,
  "photo_count": 4,
  "processed_count": 2,
  "needs_review_count": 1
}
```

#### 2. Attendees

**`GET /events/<event_id>/attendees`**
List all attendees for an event.
*Filter:* Add `?opted_out=true` to only return attendees who have opted out.
*Response Example:*
```json
[
  {
    "id": 1,
    "event_id": 1,
    "name": "Maya Chen",
    "consent_status": "opted_out",
    "opted_out": true,
    "reference_photo_url": "data:image/png;base64,MOCK_MAYA",
    "submitted_at": "2026-05-02T12:05:00Z"
  }
]
```

#### 3. Photos

**`GET /events/<event_id>/photos`**
List all registered photos for an event, including detection summaries.
*Response Example:*
```json
[
  {
    "id": 1,
    "event_id": 1,
    "filename": "group_photo_1.jpg",
    "source": "upload",
    "status": "processed",
    "uploaded_at": "2026-05-02T12:10:00Z",
    "processed_at": "2026-05-02T12:15:00Z",
    "detection_count": 3,
    "max_confidence": 91
  }
]
```

**`GET /events/<event_id>/photos/<photo_id>`**
Detailed photo view for the Review UI, including full detection and bounding box data.
*Response Example:*
```json
{
  "id": 1,
  "event_id": 1,
  "filename": "group_photo_1.jpg",
  "source": "upload",
  "status": "processed",
  "uploaded_at": "2026-05-02T12:10:00Z",
  "processed_at": "2026-05-02T12:15:00Z",
  "original_image_url": "/mock-photos/group_photo_1.jpg",
  "redacted_image_url": "/mock-photos/redacted_group_photo_1.jpg",
  "detections": [
    {
      "id": 1,
      "photo_id": 1,
      "attendee_id": 1,
      "attendee_name": "Maya Chen",
      "confidence": 91,
      "redaction_status": "auto_blurred",
      "manual_review_required": false,
      "reference_photo_url": "data:image/png;base64,MOCK_MAYA",
      "bounding_box": [100, 100, 250, 250]
    }
  ]
}
```

## Local Development

Use this directory for backend work:
```sh
cd backend
```

**1. Install Dependencies**
```sh
python -m pip install -r ../requirements.txt
```

**2. Run the Server**
The backend is powered by **Flask**. Start the dev server on port 5000:
```sh
flask --app app run --debug
```

**3. Seed Demo Data**
With the server running, populate the database with the `HUSKY-42F7` demo event:
```sh
curl -X POST http://localhost:5000/seed
```

**4. Run Tests**
We use `pytest` for unit and API tests. They run against an isolated, in-memory SQLite database.
```sh
pytest tests/ -v
```

## Framework Note
The backend is **Flask**, not FastAPI. FastAPI or Uvicorn dependencies, if present in the shared Python manifest, are for the separate AI redaction helper/server and should not be treated as the canonical backend framework.
