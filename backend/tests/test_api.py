"""Tests for backend API endpoints."""

import json


class TestHealthCheck:
    def test_health(self, client):
        resp = client.get("/health")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["status"] == "ok"


class TestEventAPI:
    def test_create_event(self, client):
        resp = client.post("/events", json={"name": "TestHack", "organizer_id": "org_1"})
        assert resp.status_code == 201
        data = resp.get_json()
        assert data["name"] == "TestHack"
        assert data["event_key"].startswith("HUSKY-")

    def test_create_event_missing_name(self, client):
        resp = client.post("/events", json={"organizer_id": "org_1"})
        assert resp.status_code == 400

    def test_get_event_by_id(self, client):
        create = client.post("/events", json={"name": "Ev", "organizer_id": "org"})
        eid = create.get_json()["id"]
        resp = client.get(f"/events/{eid}")
        assert resp.status_code == 200
        assert resp.get_json()["id"] == eid

    def test_get_event_not_found(self, client):
        resp = client.get("/events/9999")
        assert resp.status_code == 404

    def test_lookup_by_key(self, client):
        create = client.post("/events", json={"name": "Ev", "organizer_id": "org"})
        key = create.get_json()["event_key"]
        resp = client.get(f"/events/key/{key}")
        assert resp.status_code == 200

    def test_list_events_by_organizer(self, client):
        client.post("/events", json={"name": "A", "organizer_id": "org_X"})
        client.post("/events", json={"name": "B", "organizer_id": "org_X"})
        client.post("/events", json={"name": "C", "organizer_id": "org_Y"})

        resp = client.get("/events?organizer_id=org_X")
        assert resp.status_code == 200
        data = resp.get_json()
        assert len(data) == 2

    def test_list_events_missing_organizer(self, client):
        resp = client.get("/events")
        assert resp.status_code == 400


class TestAttendeeAPI:
    def _create_event(self, client):
        resp = client.post("/events", json={"name": "Ev", "organizer_id": "org"})
        return resp.get_json()["id"]

    def test_submit_attendee(self, client):
        eid = self._create_event(client)
        resp = client.post(f"/events/{eid}/attendees", json={
            "name": "Maya Chen",
            "consent_status": "opted_out",
            "opted_out": True,
            "reference_photo_url": "data:image/png;base64,MOCK",
        })
        assert resp.status_code == 201
        data = resp.get_json()
        assert data["name"] == "Maya Chen"
        assert data["opted_out"] is True

    def test_submit_to_nonexistent_event(self, client):
        resp = client.post("/events/9999/attendees", json={
            "name": "X", "consent_status": "consented",
        })
        assert resp.status_code == 404

    def test_submit_invalid_consent(self, client):
        eid = self._create_event(client)
        resp = client.post(f"/events/{eid}/attendees", json={
            "name": "X", "consent_status": "invalid_value",
        })
        assert resp.status_code == 400

    def test_list_attendees(self, client):
        eid = self._create_event(client)
        client.post(f"/events/{eid}/attendees", json={
            "name": "A", "consent_status": "opted_out", "opted_out": True,
        })
        client.post(f"/events/{eid}/attendees", json={
            "name": "B", "consent_status": "consented", "opted_out": False,
        })

        resp = client.get(f"/events/{eid}/attendees")
        assert resp.status_code == 200
        assert len(resp.get_json()) == 2

    def test_list_opted_out_only(self, client):
        eid = self._create_event(client)
        client.post(f"/events/{eid}/attendees", json={
            "name": "A", "consent_status": "opted_out", "opted_out": True,
        })
        client.post(f"/events/{eid}/attendees", json={
            "name": "B", "consent_status": "consented", "opted_out": False,
        })

        resp = client.get(f"/events/{eid}/attendees?opted_out=true")
        data = resp.get_json()
        assert len(data) == 1
        assert data[0]["name"] == "A"


class TestPhotoAPI:
    def _create_event(self, client):
        resp = client.post("/events", json={"name": "Ev", "organizer_id": "org"})
        return resp.get_json()["id"]

    def test_register_photo(self, client):
        eid = self._create_event(client)
        resp = client.post(f"/events/{eid}/photos", json={
            "filename": "group.jpg", "source": "upload",
        })
        assert resp.status_code == 201
        assert resp.get_json()["status"] == "pending"

    def test_register_photo_invalid_source(self, client):
        eid = self._create_event(client)
        resp = client.post(f"/events/{eid}/photos", json={
            "filename": "x.jpg", "source": "dropbox",
        })
        assert resp.status_code == 400

    def test_list_photos(self, client):
        eid = self._create_event(client)
        client.post(f"/events/{eid}/photos", json={"filename": "a.jpg"})
        client.post(f"/events/{eid}/photos", json={"filename": "b.jpg"})

        resp = client.get(f"/events/{eid}/photos")
        assert resp.status_code == 200
        assert len(resp.get_json()) == 2

    def test_photo_review_detail(self, app, client):
        eid = self._create_event(client)
        # Create attendee + photo
        att = client.post(f"/events/{eid}/attendees", json={
            "name": "Maya", "consent_status": "opted_out", "opted_out": True,
        }).get_json()
        photo = client.post(f"/events/{eid}/photos", json={
            "filename": "group.jpg",
        }).get_json()

        from backend.models import insert_detection
        from backend.db import get_db
        with app.app_context():
            db = get_db()
            insert_detection(
                db, photo["id"], att["id"], "Maya", 91, "auto_blurred", False,
                bounding_box="[10, 20, 30, 40]"
            )

        resp = client.get(f"/events/{eid}/photos/{photo['id']}")
        assert resp.status_code == 200
        data = resp.get_json()
        assert "detections" in data
        assert data["filename"] == "group.jpg"
        assert data["original_image_url"] == "/mock-photos/group.jpg"
        assert data["redacted_image_url"] is None
        
        assert len(data["detections"]) == 1
        det = data["detections"][0]
        assert det["confidence"] == 91
        assert det["bounding_box"] == [10, 20, 30, 40]

    def test_photo_not_in_event(self, client):
        eid1 = self._create_event(client)
        eid2 = self._create_event(client)
        photo = client.post(f"/events/{eid1}/photos", json={
            "filename": "x.jpg",
        }).get_json()

        # Try to access eid1's photo via eid2
        resp = client.get(f"/events/{eid2}/photos/{photo['id']}")
        assert resp.status_code == 404


class TestOverviewAPI:
    def test_overview(self, client):
        eid = client.post("/events", json={
            "name": "Demo", "organizer_id": "org",
        }).get_json()["id"]

        client.post(f"/events/{eid}/attendees", json={
            "name": "A", "consent_status": "opted_out", "opted_out": True,
        })
        client.post(f"/events/{eid}/attendees", json={
            "name": "B", "consent_status": "consented", "opted_out": False,
        })

        resp = client.get(f"/events/{eid}/overview")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["total_attendees"] == 2
        assert data["opted_out_count"] == 1
        assert data["event_name"] == "Demo"

    def test_overview_not_found(self, client):
        resp = client.get("/events/9999/overview")
        assert resp.status_code == 404


class TestSeedAPI:
    def test_seed(self, client):
        resp = client.post("/seed")
        assert resp.status_code == 201
        data = resp.get_json()
        assert data["seeded"] is True

    def test_seed_idempotent(self, client):
        client.post("/seed")
        resp = client.post("/seed")
        data = resp.get_json()
        assert data["seeded"] is False
