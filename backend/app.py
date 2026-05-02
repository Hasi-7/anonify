import base64
import re
import uuid
from pathlib import Path

from flask import Flask, request, jsonify, abort, send_from_directory
from flask_cors import CORS

from .db import get_db, close_db
from .models import (
    create_schema,
    insert_event, get_event_by_key, get_event_by_id, get_events_by_organizer,
    insert_attendee, get_attendees_by_event,
    insert_photo, get_photos_by_event, get_photo_by_id,
    get_detections_by_photo,
    delete_detections_by_photo,
    get_event_overview,
    update_photo_status,
)

_UPLOADS_DIR = Path(__file__).resolve().parent / "uploads" / "attendees"
_PHOTO_UPLOADS_DIR = Path(__file__).resolve().parent / "uploads" / "photos"
_DATA_URL_RE = re.compile(r"^data:image/([a-zA-Z+\-]+);base64,(.+)$", re.DOTALL)


def _extract_data_url(payload: dict) -> str | None:
    """Return the first data URL found across accepted field name aliases."""
    # Dedicated data-URL fields — accepted unconditionally.
    for key in ("reference_image_data_url", "referenceImageDataUrl"):
        val = payload.get(key)
        if val and isinstance(val, str):
            return val.strip()
    # Legacy / response-echo fields — only when they actually contain a data URL,
    # not a /uploads/... path that was already written.
    for key in ("reference_photo_url", "referencePhotoUrl"):
        val = payload.get(key)
        if val and isinstance(val, str) and val.strip().startswith("data:image/"):
            return val.strip()
    return None


def _save_event_photo(data_url: str, original_filename: str) -> tuple[str, str] | None:
    """Decode a data URL and persist it under uploads/photos/.

    Returns (local_filesystem_path, url_path) on success, None on failure.
    url_path is the value stored in the DB, e.g. /uploads/photos/uuid_event.jpg.
    """
    match = _DATA_URL_RE.match(data_url.strip())
    if not match:
        return None
    ext = match.group(1).lower()
    ext = "jpg" if ext in ("jpeg", "jpg") else ext
    if ext not in ("jpg", "png", "webp", "gif"):
        ext = "jpg"
    # Build a safe filename: uuid prefix avoids collisions even with duplicate names.
    safe_stem = re.sub(r"[^A-Za-z0-9_.-]+", "-", Path(original_filename).stem).strip(".-") or "photo"
    filename = f"{uuid.uuid4()}_{safe_stem}.{ext}"
    try:
        raw = base64.b64decode(match.group(2))
    except Exception:
        return None
    try:
        _PHOTO_UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
        local_path = _PHOTO_UPLOADS_DIR / filename
        local_path.write_bytes(raw)
        return str(local_path), f"/uploads/photos/{filename}"
    except Exception:
        return None


def _save_reference_photo(data_url: str) -> str | None:
    match = _DATA_URL_RE.match(data_url.strip())
    if not match:
        return None
    ext = match.group(1).lower()
    ext = "jpg" if ext in ("jpeg", "jpg") else ext
    if ext not in ("jpg", "png", "webp", "gif"):
        ext = "jpg"
    try:
        raw = base64.b64decode(match.group(2))
    except Exception:
        return None
    try:
        _UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
        filename = f"{uuid.uuid4()}.{ext}"
        (_UPLOADS_DIR / filename).write_bytes(raw)
        return f"/uploads/attendees/{filename}"
    except Exception:
        return None


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

        if not name or not isinstance(name, str):
            abort(400, description="Missing or invalid attendee name")
        if consent_status not in ("opted_out", "consented"):
            abort(400, description="consent_status must be 'opted_out' or 'consented'")

        raw_photo = _extract_data_url(payload)
        reference_photo_url = _save_reference_photo(raw_photo) if raw_photo else None

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

    @app.route("/events/<int:event_id>/photos/upload", methods=["POST"])
    def upload_event_photo(event_id: int):
        db = get_db()
        event = get_event_by_id(db, event_id)
        if not event:
            abort(404, description="Event not found")

        payload = request.get_json(silent=True) or {}
        file_name = payload.get("file_name") or payload.get("filename") or "event-photo.jpg"
        image_data_url = payload.get("image_data_url")

        if not image_data_url or not isinstance(image_data_url, str):
            abort(400, description="image_data_url is required")

        saved = _save_event_photo(image_data_url, str(file_name))
        if saved is None:
            abort(400, description="Could not decode image_data_url")

        _local_path, url_path = saved
        # Store the URL path in the filename column so _photo_dict can serve it.
        photo = insert_photo(db, event_id=event_id, filename=url_path, source="upload")
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

    @app.route("/events/<int:event_id>/photos/<int:photo_id>/process", methods=["POST"])
    def process_photo(event_id: int, photo_id: int):
        from .ai_processing import (
            ProcessingError,
            attendee_payloads,
            call_match_and_redact,
            persist_detections,
            resolve_image_path,
        )

        db = get_db()
        event = get_event_by_id(db, event_id)
        if not event:
            abort(404, description="Event not found")

        photo = get_photo_by_id(db, photo_id)
        if not photo or photo.event_id != event_id:
            abort(404, description="Photo not found in this event")

        payload = request.get_json(silent=True) or {}

        # Determine original_image_url for the result record.
        if photo.filename.startswith("/uploads/photos/"):
            original_image_url = payload.get("original_image_url") or photo.filename
        else:
            original_image_url = payload.get("original_image_url") or f"/mock-photos/{photo.filename}"

        # When no data URL was supplied, try to resolve the stored file on disk.
        stored_local_path: str | None = None
        if not payload.get("image_data_url") and photo.filename.startswith("/uploads/photos/"):
            relative = photo.filename[len("/uploads/photos/"):]
            candidate = Path(__file__).resolve().parent / "uploads" / "photos" / relative
            if candidate.is_file():
                stored_local_path = str(candidate)

        update_photo_status(db, photo_id, "processing")

        try:
            image_path = resolve_image_path(
                event_id=event_id,
                photo=photo,
                image_data_url=payload.get("image_data_url"),
                image_path=payload.get("image_path") or stored_local_path,
            )
            opted_out = get_attendees_by_event(db, event_id, opted_out_only=True)
            processing = call_match_and_redact(
                event_id=event_id,
                photo=photo,
                image_path=image_path,
                original_image_url=original_image_url,
                opted_out_attendees=attendee_payloads(event_id, opted_out),
            )
            match_result = processing.get("match") or {}
            detections = match_result.get("detections") or []

            delete_detections_by_photo(db, photo_id)
            inserted_count = persist_detections(db, photo_id, detections if isinstance(detections, list) else [])

            redaction = processing.get("redaction")
            redaction_failed = bool(redaction) and not redaction.get("success")
            match_failed = match_result.get("success") is False
            update_photo_status(db, photo_id, "failed" if match_failed or redaction_failed else "processed")

            refreshed_photo = get_photo_by_id(db, photo_id)
            result = _photo_dict(refreshed_photo)
            result["detections"] = [_detection_dict(d) for d in get_detections_by_photo(db, photo_id)]
            if match_result.get("redactedImageUrl"):
                result["redacted_image_url"] = match_result["redactedImageUrl"]
            result["processing"] = {
                "match": match_result,
                "redaction": redaction,
                "detections_inserted": inserted_count,
            }
            return jsonify(result), 200
        except ProcessingError as exc:
            update_photo_status(db, photo_id, "failed")
            return jsonify({"error": str(exc)}), 400
        except Exception as exc:  # noqa: BLE001
            update_photo_status(db, photo_id, "failed")
            return jsonify({"error": f"AI helper unavailable: {exc}"}), 502

    # ------------------------------------------------------------------
    # Seed (dev only)
    # ------------------------------------------------------------------

    @app.route("/uploads/attendees/<string:filename>", methods=["GET"])
    def serve_attendee_photo(filename: str):
        uploads_dir = Path(__file__).resolve().parent / "uploads" / "attendees"
        return send_from_directory(str(uploads_dir), filename)

    @app.route("/uploads/photos/<string:filename>", methods=["GET"])
    def serve_event_photo(filename: str):
        uploads_dir = Path(__file__).resolve().parent / "uploads" / "photos"
        return send_from_directory(str(uploads_dir), filename)

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
    if p.filename.startswith("/uploads/photos/"):
        original_image_url = p.filename
        redacted_image_url = None  # real redaction path comes from the AI helper result
    else:
        original_image_url = f"/mock-photos/{p.filename}"
        redacted_image_url = f"/mock-photos/redacted_{p.filename}" if p.status == "processed" else None
    return {
        "id": p.id, "event_id": p.event_id, "filename": p.filename,
        "source": p.source, "status": p.status,
        "uploaded_at": p.uploaded_at, "processed_at": p.processed_at,
        "original_image_url": original_image_url,
        "redacted_image_url": redacted_image_url,
    }


def _detection_dict(d) -> dict:
    import json
    try:
        box = json.loads(d.bounding_box) if getattr(d, "bounding_box", None) else [150, 100, 200, 200]
    except Exception:
        box = [150, 100, 200, 200]

    return {
        "id": d.id, "photo_id": d.photo_id, "attendee_id": d.attendee_id,
        "attendee_name": d.attendee_name, "confidence": d.confidence,
        "redaction_status": d.redaction_status,
        "manual_review_required": d.manual_review_required,
        "reference_photo_url": d.reference_photo_url,
        "bounding_box": box,
    }


app = create_app()
