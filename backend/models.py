import secrets
import string
from dataclasses import dataclass
from datetime import datetime, timezone
from sqlite3 import Connection

EVENT_KEY_PREFIX = "HUSKY"


# ---------------------------------------------------------------------------
# Dataclasses
# ---------------------------------------------------------------------------

@dataclass
class Event:
    id: int
    name: str
    event_key: str
    organizer_id: str | None
    created_at: str


@dataclass
class Attendee:
    id: int
    event_id: int
    name: str
    consent_status: str            # "opted_out" | "consented"
    opted_out: bool
    reference_photo_url: str | None  # base64 data URL from live camera capture
    submitted_at: str


@dataclass
class Photo:
    id: int
    event_id: int
    filename: str
    source: str       # "upload" | "google_drive"
    status: str       # "pending" | "processing" | "processed" | "failed"
    uploaded_at: str
    processed_at: str | None


@dataclass
class Detection:
    id: int
    photo_id: int
    attendee_id: int
    attendee_name: str
    confidence: int                 # 0-100
    redaction_status: str           # "auto_blurred" | "pending_review" | "approved" | "rejected"
    manual_review_required: bool
    reference_photo_url: str | None
    bounding_box: str | None = None


# ---------------------------------------------------------------------------
# Schema
# ---------------------------------------------------------------------------

schema_sql = """
CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    event_key TEXT NOT NULL UNIQUE,
    organizer_id TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS attendees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    consent_status TEXT NOT NULL,
    opted_out INTEGER NOT NULL,
    reference_photo_url TEXT,
    submitted_at TEXT NOT NULL,
    FOREIGN KEY(event_id) REFERENCES events(id)
);

CREATE TABLE IF NOT EXISTS photos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL,
    filename TEXT NOT NULL,
    source TEXT NOT NULL,
    status TEXT NOT NULL,
    uploaded_at TEXT NOT NULL,
    processed_at TEXT,
    FOREIGN KEY(event_id) REFERENCES events(id)
);

CREATE TABLE IF NOT EXISTS detections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    photo_id INTEGER NOT NULL,
    attendee_id INTEGER NOT NULL,
    attendee_name TEXT NOT NULL,
    confidence INTEGER NOT NULL,
    redaction_status TEXT NOT NULL,
    manual_review_required INTEGER NOT NULL,
    reference_photo_url TEXT,
    bounding_box TEXT,
    FOREIGN KEY(photo_id) REFERENCES photos(id),
    FOREIGN KEY(attendee_id) REFERENCES attendees(id)
);
"""


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _random_segment(length: int = 4) -> str:
    alphabet = string.ascii_uppercase + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def create_schema(db: Connection) -> None:
    db.executescript(schema_sql)
    db.commit()


# ---------------------------------------------------------------------------
# Event key generation
# ---------------------------------------------------------------------------

def generate_event_key(db: Connection) -> str:
    """Generate a unique event key like HUSKY-A3X9-B2K7."""
    for _ in range(10):
        candidate = f"{EVENT_KEY_PREFIX}-{_random_segment()}-{_random_segment()}"
        row = db.execute(
            "SELECT id FROM events WHERE event_key = ?", (candidate,)
        ).fetchone()
        if row is None:
            return candidate
    raise RuntimeError("Unable to generate unique event key")


# ---------------------------------------------------------------------------
# Event CRUD
# ---------------------------------------------------------------------------

def insert_event(db: Connection, name: str, organizer_id: str | None) -> Event:
    created_at = _now_iso()
    event_key = generate_event_key(db)
    cursor = db.execute(
        "INSERT INTO events (name, event_key, organizer_id, created_at) VALUES (?, ?, ?, ?)",
        (name, event_key, organizer_id, created_at),
    )
    db.commit()
    return Event(
        id=cursor.lastrowid, name=name, event_key=event_key,
        organizer_id=organizer_id, created_at=created_at,
    )


def get_event_by_key(db: Connection, event_key: str) -> Event | None:
    row = db.execute("SELECT * FROM events WHERE event_key = ?", (event_key,)).fetchone()
    return Event(**row) if row else None


def get_event_by_id(db: Connection, event_id: int) -> Event | None:
    row = db.execute("SELECT * FROM events WHERE id = ?", (event_id,)).fetchone()
    return Event(**row) if row else None


def get_events_by_organizer(db: Connection, organizer_id: str) -> list[Event]:
    rows = db.execute(
        "SELECT * FROM events WHERE organizer_id = ? ORDER BY created_at DESC",
        (organizer_id,),
    ).fetchall()
    return [Event(**r) for r in rows]


# ---------------------------------------------------------------------------
# Attendee CRUD
# ---------------------------------------------------------------------------

def insert_attendee(
    db: Connection,
    event_id: int,
    name: str,
    consent_status: str,
    opted_out: bool,
    reference_photo_url: str | None = None,
) -> Attendee:
    submitted_at = _now_iso()
    cursor = db.execute(
        "INSERT INTO attendees (event_id, name, consent_status, opted_out, reference_photo_url, submitted_at) "
        "VALUES (?, ?, ?, ?, ?, ?)",
        (event_id, name, consent_status, int(opted_out), reference_photo_url, submitted_at),
    )
    db.commit()
    return Attendee(
        id=cursor.lastrowid, event_id=event_id, name=name,
        consent_status=consent_status, opted_out=opted_out,
        reference_photo_url=reference_photo_url, submitted_at=submitted_at,
    )


def get_attendees_by_event(
    db: Connection, event_id: int, opted_out_only: bool = False,
) -> list[Attendee]:
    if opted_out_only:
        rows = db.execute(
            "SELECT * FROM attendees WHERE event_id = ? AND opted_out = 1 ORDER BY submitted_at DESC",
            (event_id,),
        ).fetchall()
    else:
        rows = db.execute(
            "SELECT * FROM attendees WHERE event_id = ? ORDER BY submitted_at DESC",
            (event_id,),
        ).fetchall()
    return [
        Attendee(
            id=r["id"], event_id=r["event_id"], name=r["name"],
            consent_status=r["consent_status"], opted_out=bool(r["opted_out"]),
            reference_photo_url=r["reference_photo_url"], submitted_at=r["submitted_at"],
        )
        for r in rows
    ]


# ---------------------------------------------------------------------------
# Photo CRUD
# ---------------------------------------------------------------------------

def insert_photo(
    db: Connection, event_id: int, filename: str, source: str = "upload",
) -> Photo:
    uploaded_at = _now_iso()
    cursor = db.execute(
        "INSERT INTO photos (event_id, filename, source, status, uploaded_at) VALUES (?, ?, ?, ?, ?)",
        (event_id, filename, source, "pending", uploaded_at),
    )
    db.commit()
    return Photo(
        id=cursor.lastrowid, event_id=event_id, filename=filename,
        source=source, status="pending", uploaded_at=uploaded_at, processed_at=None,
    )


def get_photos_by_event(db: Connection, event_id: int) -> list[dict]:
    """Return photos with detection summary (count + max confidence)."""
    rows = db.execute(
        """
        SELECT p.*,
               COUNT(d.id) AS detection_count,
               COALESCE(MAX(d.confidence), 0) AS max_confidence
        FROM photos p
        LEFT JOIN detections d ON d.photo_id = p.id
        WHERE p.event_id = ?
        GROUP BY p.id
        ORDER BY p.uploaded_at DESC
        """,
        (event_id,),
    ).fetchall()
    return [
        {
            "id": r["id"], "event_id": r["event_id"], "filename": r["filename"],
            "source": r["source"], "status": r["status"],
            "uploaded_at": r["uploaded_at"], "processed_at": r["processed_at"],
            "detection_count": r["detection_count"], "max_confidence": r["max_confidence"],
        }
        for r in rows
    ]


def get_photo_by_id(db: Connection, photo_id: int) -> Photo | None:
    row = db.execute("SELECT * FROM photos WHERE id = ?", (photo_id,)).fetchone()
    if not row:
        return None
    return Photo(
        id=row["id"], event_id=row["event_id"], filename=row["filename"],
        source=row["source"], status=row["status"],
        uploaded_at=row["uploaded_at"], processed_at=row["processed_at"],
    )


def update_photo_status(db: Connection, photo_id: int, status: str) -> None:
    processed_at = _now_iso() if status == "processed" else None
    if processed_at:
        db.execute(
            "UPDATE photos SET status = ?, processed_at = ? WHERE id = ?",
            (status, processed_at, photo_id),
        )
    else:
        db.execute("UPDATE photos SET status = ? WHERE id = ?", (status, photo_id))
    db.commit()


# ---------------------------------------------------------------------------
# Detection CRUD
# ---------------------------------------------------------------------------

def insert_detection(
    db: Connection,
    photo_id: int,
    attendee_id: int,
    attendee_name: str,
    confidence: int,
    redaction_status: str,
    manual_review_required: bool,
    reference_photo_url: str | None = None,
    bounding_box: str | None = None,
) -> Detection:
    cursor = db.execute(
        "INSERT INTO detections "
        "(photo_id, attendee_id, attendee_name, confidence, redaction_status, manual_review_required, reference_photo_url, bounding_box) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        (photo_id, attendee_id, attendee_name, confidence, redaction_status,
         int(manual_review_required), reference_photo_url, bounding_box),
    )
    db.commit()
    return Detection(
        id=cursor.lastrowid, photo_id=photo_id, attendee_id=attendee_id,
        attendee_name=attendee_name, confidence=confidence,
        redaction_status=redaction_status, manual_review_required=manual_review_required,
        reference_photo_url=reference_photo_url, bounding_box=bounding_box,
    )


def get_detections_by_photo(db: Connection, photo_id: int) -> list[Detection]:
    rows = db.execute(
        "SELECT * FROM detections WHERE photo_id = ? ORDER BY confidence DESC",
        (photo_id,),
    ).fetchall()
    return [
        Detection(
            id=r["id"], photo_id=r["photo_id"], attendee_id=r["attendee_id"],
            attendee_name=r["attendee_name"], confidence=r["confidence"],
            redaction_status=r["redaction_status"],
            manual_review_required=bool(r["manual_review_required"]),
            reference_photo_url=r["reference_photo_url"],
            bounding_box=r["bounding_box"],
        )
        for r in rows
    ]


# ---------------------------------------------------------------------------
# Event overview (dashboard stats)
# ---------------------------------------------------------------------------

def get_event_overview(db: Connection, event_id: int) -> dict | None:
    """Aggregate dashboard stats for an event."""
    event = get_event_by_id(db, event_id)
    if not event:
        return None

    total_attendees = db.execute(
        "SELECT COUNT(*) FROM attendees WHERE event_id = ?", (event_id,)
    ).fetchone()[0]

    opted_out_count = db.execute(
        "SELECT COUNT(*) FROM attendees WHERE event_id = ? AND opted_out = 1", (event_id,)
    ).fetchone()[0]

    photo_count = db.execute(
        "SELECT COUNT(*) FROM photos WHERE event_id = ?", (event_id,)
    ).fetchone()[0]

    processed_count = db.execute(
        "SELECT COUNT(*) FROM photos WHERE event_id = ? AND status = 'processed'", (event_id,)
    ).fetchone()[0]

    needs_review_count = db.execute(
        """
        SELECT COUNT(DISTINCT p.id) FROM photos p
        JOIN detections d ON d.photo_id = p.id
        WHERE p.event_id = ? AND d.manual_review_required = 1
        """,
        (event_id,),
    ).fetchone()[0]

    return {
        "event_name": event.name,
        "event_key": event.event_key,
        "attendee_link": f"/attend?eventKey={event.event_key}",
        "total_attendees": total_attendees,
        "opted_out_count": opted_out_count,
        "photo_count": photo_count,
        "processed_count": processed_count,
        "needs_review_count": needs_review_count,
    }
