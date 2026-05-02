from flask import Flask, request, jsonify, abort
from flask_cors import CORS

from .db import get_db, close_db
from .models import (
    create_schema,
    insert_event, get_event_by_key, get_event_by_id, get_events_by_organizer,
    insert_attendee, get_attendees_by_event,
    insert_photo, get_photos_by_event, get_photo_by_id,
    get_detections_by_photo,
    get_event_overview,
)


def create_app() -> Flask:
    app = Flask(__name__)
    CORS(app)
    app.teardown_appcontext(close_db)

    # Ensure schema exists on every connection (no-op for file DB after first call,
    # required for in-memory test DBs which get a fresh connection per request).
    @app.before_request
    def _ensure_schema():
        create_schema(get_db())

    # ------------------------------------------------------------------
    # Health
    # ------------------------------------------------------------------

    @app.route("/health", methods=["GET"])
    def health_check():
        return {"status": "ok", "backend": "anonify", "mode": "flask-sqlite"}, 200

    # ------------------------------------------------------------------
    # Events
    # ------------------------------------------------------------------

    @app.route("/events", methods=["GET"])
    def list_events():
        organizer_id = request.args.get("organizer_id")
        if not organizer_id:
            abort(400, description="organizer_id query parameter is required")
        db = get_db()
        events = get_events_by_organizer(db, organizer_id)
        return jsonify([_event_dict(e) for e in events]), 200

    @app.route("/events", methods=["POST"])
    def create_event_route():
        payload = request.get_json(silent=True) or {}
        name = payload.get("name")
        organizer_id = payload.get("organizer_id")

        if not name or not isinstance(name, str):
            abort(400, description="Missing or invalid event name")

        db = get_db()
        event = insert_event(db, name=name.strip(), organizer_id=organizer_id)
        return jsonify(_event_dict(event)), 201

    @app.route("/events/key/<string:event_key>", methods=["GET"])
    def lookup_event_by_key(event_key: str):
        db = get_db()
        event = get_event_by_key(db, event_key)
        if not event:
            abort(404, description="Event not found")
        return jsonify(_event_dict(event)), 200

    @app.route("/events/<int:event_id>", methods=["GET"])
    def get_event_route(event_id: int):
        db = get_db()
        event = get_event_by_id(db, event_id)
        if not event:
            abort(404, description="Event not found")
        return jsonify(_event_dict(event)), 200

    @app.route("/events/<int:event_id>/overview", methods=["GET"])
    def event_overview(event_id: int):
        db = get_db()
        overview = get_event_overview(db, event_id)
        if not overview:
            abort(404, description="Event not found")
        return jsonify(overview), 200

    # ------------------------------------------------------------------
    # Attendees
    # ------------------------------------------------------------------

    @app.route("/events/<int:event_id>/attendees", methods=["POST"])
    def submit_attendee(event_id: int):
        db = get_db()
        event = get_event_by_id(db, event_id)
        if not event:
            abort(404, description="Event not found")

        payload = request.get_json(silent=True) or {}
        name = payload.get("name")
        consent_status = payload.get("consent_status")
        opted_out = payload.get("opted_out", False)
        reference_photo_url = payload.get("reference_photo_url")

        if not name or not isinstance(name, str):
            abort(400, description="Missing or invalid attendee name")
        if consent_status not in ("opted_out", "consented"):
            abort(400, description="consent_status must be 'opted_out' or 'consented'")

        attendee = insert_attendee(
            db, event_id=event_id, name=name.strip(),
            consent_status=consent_status, opted_out=bool(opted_out),
            reference_photo_url=reference_photo_url,
        )
        return jsonify(_attendee_dict(attendee)), 201

    @app.route("/events/<int:event_id>/attendees", methods=["GET"])
    def list_attendees(event_id: int):
        db = get_db()
        event = get_event_by_id(db, event_id)
        if not event:
            abort(404, description="Event not found")

        opted_out_only = request.args.get("opted_out", "").lower() == "true"
        attendees = get_attendees_by_event(db, event_id, opted_out_only=opted_out_only)
        return jsonify([_attendee_dict(a) for a in attendees]), 200

    # ------------------------------------------------------------------
    # Photos
    # ------------------------------------------------------------------

    @app.route("/events/<int:event_id>/photos", methods=["POST"])
    def register_photo(event_id: int):
        db = get_db()
        event = get_event_by_id(db, event_id)
        if not event:
            abort(404, description="Event not found")

        payload = request.get_json(silent=True) or {}
        filename = payload.get("filename")
        source = payload.get("source", "upload")

        if not filename or not isinstance(filename, str):
            abort(400, description="Missing or invalid filename")
        if source not in ("upload", "google_drive"):
            abort(400, description="source must be 'upload' or 'google_drive'")

        photo = insert_photo(db, event_id=event_id, filename=filename.strip(), source=source)
        return jsonify(_photo_dict(photo)), 201

    @app.route("/events/<int:event_id>/photos", methods=["GET"])
    def list_photos(event_id: int):
        db = get_db()
        event = get_event_by_id(db, event_id)
        if not event:
            abort(404, description="Event not found")

        photos = get_photos_by_event(db, event_id)
        return jsonify(photos), 200

    @app.route("/events/<int:event_id>/photos/<int:photo_id>", methods=["GET"])
    def photo_review_detail(event_id: int, photo_id: int):
        db = get_db()
        event = get_event_by_id(db, event_id)
        if not event:
            abort(404, description="Event not found")

        photo = get_photo_by_id(db, photo_id)
        if not photo or photo.event_id != event_id:
            abort(404, description="Photo not found in this event")

        detections = get_detections_by_photo(db, photo_id)
        result = _photo_dict(photo)
        result["detections"] = [_detection_dict(d) for d in detections]
        return jsonify(result), 200

    # ------------------------------------------------------------------
    # Seed (dev only)
    # ------------------------------------------------------------------

    @app.route("/seed", methods=["POST"])
    def seed_data():
        from .seed import seed_database
        db = get_db()
        result = seed_database(db)
        return jsonify(result), 201

    return app


# ---------------------------------------------------------------------------
# Serialization helpers
# ---------------------------------------------------------------------------

def _event_dict(e) -> dict:
    return {
        "id": e.id, "name": e.name, "event_key": e.event_key,
        "organizer_id": e.organizer_id, "created_at": e.created_at,
    }


def _attendee_dict(a) -> dict:
    return {
        "id": a.id, "event_id": a.event_id, "name": a.name,
        "consent_status": a.consent_status, "opted_out": a.opted_out,
        "reference_photo_url": a.reference_photo_url, "submitted_at": a.submitted_at,
    }


def _photo_dict(p) -> dict:
    return {
        "id": p.id, "event_id": p.event_id, "filename": p.filename,
        "source": p.source, "status": p.status,
        "uploaded_at": p.uploaded_at, "processed_at": p.processed_at,
    }


def _detection_dict(d) -> dict:
    return {
        "id": d.id, "photo_id": d.photo_id, "attendee_id": d.attendee_id,
        "attendee_name": d.attendee_name, "confidence": d.confidence,
        "redaction_status": d.redaction_status,
        "manual_review_required": d.manual_review_required,
        "reference_photo_url": d.reference_photo_url,
    }


app = create_app()
