"""Seed the database with realistic demo data for the hackathon demo.

Run via POST /seed endpoint or: python -m backend.seed
"""

from sqlite3 import Connection

from .models import (
    create_schema,
    insert_attendee,
    insert_photo,
    insert_detection,
    update_photo_status,
)


def seed_database(db: Connection) -> dict:
    """Populate the database with demo data. Safe to call multiple times."""

    # Guard: skip if data already exists
    count = db.execute("SELECT COUNT(*) FROM events").fetchone()[0]
    if count > 0:
        return {"message": "Database already has data — skipping seed", "seeded": False}

    # --- Demo Event ---
    event_key = "HUSKY-42F7"
    now = "2026-05-02T12:00:00Z"
    db.execute(
        "INSERT INTO events (name, event_key, organizer_id, created_at) VALUES (?, ?, ?, ?)",
        ("HuskyHack Demo", event_key, "demo_organizer_001", now),
    )
    db.commit()
    event_id = db.execute("SELECT id FROM events WHERE event_key = ?", (event_key,)).fetchone()[0]

    # --- Attendees ---
    attendees_data = [
        ("Maya Chen",    "opted_out",  True,  "data:image/png;base64,MOCK_MAYA"),
        ("Jordan Lee",   "opted_out",  True,  "data:image/png;base64,MOCK_JORDAN"),
        ("Alex Rivera",  "opted_out",  True,  "data:image/png;base64,MOCK_ALEX"),
        ("Sam Park",     "opted_out",  True,  "data:image/png;base64,MOCK_SAM"),
        ("Taylor Swift", "consented",  False, None),
        ("Chris Doe",    "consented",  False, None),
    ]
    attendee_ids = {}
    for name, status, opted, ref_url in attendees_data:
        a = insert_attendee(db, event_id, name, status, opted, ref_url)
        attendee_ids[name] = a.id

    # --- Photos ---
    photos_data = [
        ("group_photo_1.jpg", "upload"),
        ("panel_discussion.jpg", "upload"),
        ("hackathon_floor.jpg", "upload"),
        ("awards_ceremony.jpg", "google_drive"),
    ]
    photo_objs = []
    for fname, source in photos_data:
        p = insert_photo(db, event_id, fname, source)
        photo_objs.append(p)

    # Mark some photos as processed
    update_photo_status(db, photo_objs[0].id, "processed")
    update_photo_status(db, photo_objs[1].id, "processed")
    update_photo_status(db, photo_objs[2].id, "processing")
    # photo 4 stays "pending"

    # --- Detections ---
    # Photo 1: group_photo_1.jpg — 3 detections
    insert_detection(
        db, photo_objs[0].id, attendee_ids["Maya Chen"], "Maya Chen",
        confidence=91, redaction_status="auto_blurred", manual_review_required=False,
        reference_photo_url="data:image/png;base64,MOCK_MAYA",
    )
    insert_detection(
        db, photo_objs[0].id, attendee_ids["Jordan Lee"], "Jordan Lee",
        confidence=63, redaction_status="pending_review", manual_review_required=True,
        reference_photo_url="data:image/png;base64,MOCK_JORDAN",
    )
    insert_detection(
        db, photo_objs[0].id, attendee_ids["Sam Park"], "Sam Park",
        confidence=45, redaction_status="pending_review", manual_review_required=True,
        reference_photo_url="data:image/png;base64,MOCK_SAM",
    )

    # Photo 2: panel_discussion.jpg — 2 detections
    insert_detection(
        db, photo_objs[1].id, attendee_ids["Alex Rivera"], "Alex Rivera",
        confidence=78, redaction_status="auto_blurred", manual_review_required=True,
        reference_photo_url="data:image/png;base64,MOCK_ALEX",
    )
    insert_detection(
        db, photo_objs[1].id, attendee_ids["Maya Chen"], "Maya Chen",
        confidence=95, redaction_status="auto_blurred", manual_review_required=False,
        reference_photo_url="data:image/png;base64,MOCK_MAYA",
    )

    return {
        "message": "Demo data seeded successfully",
        "seeded": True,
        "event_key": event_key,
        "attendees_created": len(attendees_data),
        "photos_created": len(photos_data),
        "detections_created": 5,
    }


if __name__ == "__main__":
    import sqlite3
    from pathlib import Path
    from .models import create_schema

    db_path = Path(__file__).resolve().parent / "anonify.db"
    conn = sqlite3.connect(str(db_path), detect_types=sqlite3.PARSE_DECLTYPES)
    conn.row_factory = sqlite3.Row
    create_schema(conn)
    result = seed_database(conn)
    print(result)
    conn.close()
