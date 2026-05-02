# Match Photo Endpoint

## Goal

Expose the optional local recognition spike through the existing FastAPI redaction helper without changing frontend, backend, auth, or integration code.

## Endpoint

`POST /match-photo` returns PhotoProcessingResult-compatible JSON.

Example request:

```json
{
  "eventId": "event_demo_001",
  "photoId": "photo_001",
  "photoImagePath": "tmp/group-photo.jpg",
  "originalImageUrl": "tmp/group-photo.jpg",
  "optedOutAttendees": [
    {
      "attendeeId": "attendee_001",
      "attendeeName": "Maya Chen",
      "referenceImagePath": "tmp/maya-reference.jpg",
      "referenceImageUrl": "tmp/maya-reference.jpg"
    }
  ]
}
```

Safe unavailable response:

```json
{
  "photoId": "photo_001",
  "eventId": "event_demo_001",
  "fileName": "group-photo.jpg",
  "originalImageUrl": "tmp/group-photo.jpg",
  "redactedImageUrl": null,
  "status": "no_match",
  "detections": [],
  "highestConfidence": null,
  "needsManualReview": false,
  "success": false,
  "error": "recognition_unavailable"
}
```

## Health

`GET /health` keeps the existing fields and adds recognition readiness:

```json
{
  "status": "ok",
  "service": "anonify-redaction-helper",
  "pillowAvailable": true,
  "blurReady": true,
  "recognitionAvailable": false
}
```

## Safety

- Uses `ai_redaction.face_matching.match_photo_to_references` only when importable.
- If the recognition module or local dependencies are missing, `/match-photo` returns `no_match` with `error: "recognition_unavailable"`.
- Missing photo files and missing reference files return safe `no_match` responses.
- Empty attendees return `no_match` without an error.
- No persistent embeddings are created here.
- No external API calls are made here.
- This is an experimental local matching spike for controlled demo images only, not production-grade facial recognition.

## Future Replacement

When the local matcher stabilizes, keep `/match-photo` returning the same PhotoProcessingResult-compatible shape so the existing mock AI and frontend photo-review adapter can be swapped to this data source without UI changes.
