"""Tests for backend data models and CRUD functions."""

from backend.models import (
    insert_event, get_event_by_key, get_event_by_id, get_events_by_organizer,
    insert_attendee, get_attendees_by_event,
    insert_photo, get_photos_by_event, get_photo_by_id, update_photo_status,
    insert_detection, get_detections_by_photo,
    get_event_overview, generate_event_key,
)


class TestEventKey:
    def test_format(self, db):
        key = generate_event_key(db)
        parts = key.split("-")
        assert parts[0] == "HUSKY"
        assert len(parts) == 3
        assert len(parts[1]) == 4
        assert len(parts[2]) == 4

    def test_uniqueness(self, db):
        keys = {generate_event_key(db) for _ in range(20)}
        assert len(keys) == 20


class TestEventCRUD:
    def test_create_and_retrieve(self, db):
        event = insert_event(db, "Test Event", "org_1")
        assert event.name == "Test Event"
        assert event.organizer_id == "org_1"
        assert event.event_key.startswith("HUSKY-")

        fetched = get_event_by_id(db, event.id)
        assert fetched is not None
        assert fetched.name == "Test Event"

    def test_lookup_by_key(self, db):
        event = insert_event(db, "KeyTest", "org_1")
        fetched = get_event_by_key(db, event.event_key)
        assert fetched is not None
        assert fetched.id == event.id

    def test_missing_event_returns_none(self, db):
        assert get_event_by_id(db, 9999) is None
        assert get_event_by_key(db, "FAKE-KEY") is None

    def test_list_by_organizer(self, db):
        insert_event(db, "Ev1", "org_A")
        insert_event(db, "Ev2", "org_A")
        insert_event(db, "Ev3", "org_B")

        a_events = get_events_by_organizer(db, "org_A")
        b_events = get_events_by_organizer(db, "org_B")
        assert len(a_events) == 2
        assert len(b_events) == 1


class TestAttendeeCRUD:
    def test_insert_and_list(self, db):
        event = insert_event(db, "Ev", "org")
        insert_attendee(db, event.id, "Maya", "opted_out", True, "data:mock")
        insert_attendee(db, event.id, "Chris", "consented", False)

        all_att = get_attendees_by_event(db, event.id)
        assert len(all_att) == 2

    def test_opted_out_filter(self, db):
        event = insert_event(db, "Ev", "org")
        insert_attendee(db, event.id, "Maya", "opted_out", True)
        insert_attendee(db, event.id, "Chris", "consented", False)

        opted = get_attendees_by_event(db, event.id, opted_out_only=True)
        assert len(opted) == 1
        assert opted[0].name == "Maya"

    def test_event_scoped_isolation(self, db):
        e1 = insert_event(db, "Ev1", "org")
        e2 = insert_event(db, "Ev2", "org")
        insert_attendee(db, e1.id, "Alice", "opted_out", True)
        insert_attendee(db, e2.id, "Bob", "consented", False)

        e1_att = get_attendees_by_event(db, e1.id)
        e2_att = get_attendees_by_event(db, e2.id)
        assert len(e1_att) == 1
        assert e1_att[0].name == "Alice"
        assert len(e2_att) == 1
        assert e2_att[0].name == "Bob"


class TestPhotoCRUD:
    def test_insert_and_list(self, db):
        event = insert_event(db, "Ev", "org")
        insert_photo(db, event.id, "photo1.jpg", "upload")
        insert_photo(db, event.id, "photo2.jpg", "google_drive")

        photos = get_photos_by_event(db, event.id)
        assert len(photos) == 2

    def test_status_update(self, db):
        event = insert_event(db, "Ev", "org")
        photo = insert_photo(db, event.id, "p.jpg", "upload")
        assert photo.status == "pending"

        update_photo_status(db, photo.id, "processed")
        updated = get_photo_by_id(db, photo.id)
        assert updated.status == "processed"
        assert updated.processed_at is not None

    def test_photos_include_detection_summary(self, db):
        event = insert_event(db, "Ev", "org")
        att = insert_attendee(db, event.id, "Maya", "opted_out", True)
        photo = insert_photo(db, event.id, "p.jpg", "upload")
        insert_detection(db, photo.id, att.id, "Maya", 91, "auto_blurred", False)

        photos = get_photos_by_event(db, event.id)
        assert photos[0]["detection_count"] == 1
        assert photos[0]["max_confidence"] == 91


class TestDetectionCRUD:
    def test_insert_and_list(self, db):
        event = insert_event(db, "Ev", "org")
        att = insert_attendee(db, event.id, "Maya", "opted_out", True)
        photo = insert_photo(db, event.id, "p.jpg", "upload")

        insert_detection(db, photo.id, att.id, "Maya", 91, "auto_blurred", False)
        insert_detection(db, photo.id, att.id, "Maya", 63, "pending_review", True)

        dets = get_detections_by_photo(db, photo.id)
        assert len(dets) == 2
        # Ordered by confidence DESC
        assert dets[0].confidence >= dets[1].confidence

    def test_manual_review_flag(self, db):
        event = insert_event(db, "Ev", "org")
        att = insert_attendee(db, event.id, "Jordan", "opted_out", True)
        photo = insert_photo(db, event.id, "p.jpg", "upload")
        det = insert_detection(db, photo.id, att.id, "Jordan", 63, "pending_review", True)
        assert det.manual_review_required is True


class TestEventOverview:
    def test_overview_counts(self, db):
        event = insert_event(db, "Demo", "org")
        insert_attendee(db, event.id, "A", "opted_out", True)
        insert_attendee(db, event.id, "B", "opted_out", True)
        insert_attendee(db, event.id, "C", "consented", False)

        p1 = insert_photo(db, event.id, "p1.jpg", "upload")
        p2 = insert_photo(db, event.id, "p2.jpg", "upload")
        update_photo_status(db, p1.id, "processed")

        att_a = get_attendees_by_event(db, event.id, opted_out_only=True)[0]
        insert_detection(db, p1.id, att_a.id, "A", 80, "auto_blurred", True)

        overview = get_event_overview(db, event.id)
        assert overview["total_attendees"] == 3
        assert overview["opted_out_count"] == 2
        assert overview["photo_count"] == 2
        assert overview["processed_count"] == 1
        assert overview["needs_review_count"] == 1
        assert overview["event_key"] == event.event_key

    def test_missing_event(self, db):
        assert get_event_overview(db, 9999) is None
