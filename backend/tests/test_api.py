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

    # Minimal 1×1 PNG — valid base64 so _save_reference_photo writes a real file.
    _TINY_PNG_B64 = (
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwADhQGAWjR9"
        "awAAAABJRU5ErkJggg=="
    )

    def test_submit_attendee(self, client):
        eid = self._create_event(client)
        resp = client.post(f"/events/{eid}/attendees", json={
            "name": "Maya Chen",
            "consent_status": "opted_out",
            "opted_out": True,
            "reference_photo_url": f"data:image/png;base64,{self._TINY_PNG_B64}",
        })
        assert resp.status_code == 201
        data = resp.get_json()
        assert data["name"] == "Maya Chen"
        assert data["opted_out"] is True
        assert isinstance(data["reference_photo_url"], str)
        assert data["reference_photo_url"].startswith("/uploads/attendees/")

        serve_resp = client.get(data["reference_photo_url"])
        assert serve_resp.status_code == 200

    def test_submit_attendee_via_reference_image_data_url(self, client):
        eid = self._create_event(client)
        resp = client.post(f"/events/{eid}/attendees", json={
            "name": "Soo Park",
            "consent_status": "opted_out",
            "opted_out": True,
            "reference_image_data_url": f"data:image/png;base64,{self._TINY_PNG_B64}",
        })
        assert resp.status_code == 201
        data = resp.get_json()
        assert data["reference_photo_url"].startswith("/uploads/attendees/")
        assert client.get(data["reference_photo_url"]).status_code == 200

    def test_submit_attendee_via_camelcase_alias(self, client):
        eid = self._create_event(client)
        resp = client.post(f"/events/{eid}/attendees", json={
            "name": "Lin Wei",
            "consent_status": "opted_out",
            "opted_out": True,
            "referenceImageDataUrl": f"data:image/png;base64,{self._TINY_PNG_B64}",
        })
        assert resp.status_code == 201
        data = resp.get_json()
        assert data["reference_photo_url"].startswith("/uploads/attendees/")

    def test_reference_photo_url_not_stored_as_base64(self, client):
        eid = self._create_event(client)
        resp = client.post(f"/events/{eid}/attendees", json={
            "name": "Test User",
            "consent_status": "opted_out",
            "opted_out": True,
            "reference_image_data_url": f"data:image/png;base64,{self._TINY_PNG_B64}",
        })
        assert resp.status_code == 201
        url = resp.get_json()["reference_photo_url"]
        assert url is not None
        assert not url.startswith("data:")

    def test_list_opted_out_shows_photo_path(self, client):
        eid = self._create_event(client)
        client.post(f"/events/{eid}/attendees", json={
            "name": "Amy",
            "consent_status": "opted_out",
            "opted_out": True,
            "reference_image_data_url": f"data:image/png;base64,{self._TINY_PNG_B64}",
        })
        data = client.get(f"/events/{eid}/attendees?opted_out=true").get_json()
        assert len(data) == 1
        assert data[0]["reference_photo_url"].startswith("/uploads/attendees/")

    def test_submit_attendee_invalid_photo_stored_as_null(self, client):
        eid = self._create_event(client)
        resp = client.post(f"/events/{eid}/attendees", json={
            "name": "Jae Kim",
            "consent_status": "opted_out",
            "opted_out": True,
            "reference_photo_url": "not-a-data-url",
        })
        assert resp.status_code == 201
        assert resp.get_json()["reference_photo_url"] is None

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


class TestPhotoUploadAPI:
    _TINY_PNG_B64 = (
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwADhQGAWjR9"
        "awAAAABJRU5ErkJggg=="
    )

    def _create_event(self, client):
        return client.post("/events", json={"name": "Ev", "organizer_id": "org"}).get_json()["id"]

    def test_upload_saves_file_and_returns_url(self, client):
        eid = self._create_event(client)
        resp = client.post(f"/events/{eid}/photos/upload", json={
            "file_name": "group.jpg",
            "image_data_url": f"data:image/png;base64,{self._TINY_PNG_B64}",
        })
        assert resp.status_code == 201
        data = resp.get_json()
        assert data["status"] == "pending"
        # filename stores the URL path; original_image_url echoes it back
        assert data["filename"].startswith("/uploads/photos/")
        assert data["original_image_url"].startswith("/uploads/photos/")
        # Serve route works
        assert client.get(data["original_image_url"]).status_code == 200

    def test_upload_missing_data_url_rejected(self, client):
        eid = self._create_event(client)
        resp = client.post(f"/events/{eid}/photos/upload", json={"file_name": "x.jpg"})
        assert resp.status_code == 400

    def test_upload_invalid_data_url_rejected(self, client):
        eid = self._create_event(client)
        resp = client.post(f"/events/{eid}/photos/upload", json={
            "file_name": "x.jpg",
            "image_data_url": "not-a-data-url",
        })
        assert resp.status_code == 400

    def test_upload_to_nonexistent_event(self, client):
        resp = client.post("/events/9999/photos/upload", json={
            "file_name": "x.jpg",
            "image_data_url": f"data:image/png;base64,{self._TINY_PNG_B64}",
        })
        assert resp.status_code == 404


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

    def test_process_photo_without_opt_outs_marks_processed(self, client):
        eid = self._create_event(client)
        photo = client.post(f"/events/{eid}/photos", json={
            "filename": "group.png",
        }).get_json()

        resp = client.post(f"/events/{eid}/photos/{photo['id']}/process", json={
            "image_data_url": "data:image/png;base64,UE5HREFUQQ==",
            "original_image_url": "data:image/png;base64,UE5HREFUQQ==",
        })

        assert resp.status_code == 200
        data = resp.get_json()
        assert data["status"] == "processed"
        assert data["detections"] == []
        assert data["processing"]["match"]["status"] == "no_match"

    def test_process_photo_persists_helper_detections(self, client, monkeypatch):
        eid = self._create_event(client)
        attendee = client.post(f"/events/{eid}/attendees", json={
            "name": "Maya",
            "consent_status": "opted_out",
            "opted_out": True,
            "reference_photo_url": "data:image/png;base64,UkVG",
        }).get_json()
        photo = client.post(f"/events/{eid}/photos", json={
            "filename": "group.png",
        }).get_json()

        class FakeResponse:
            def __init__(self, payload):
                self.payload = payload

            def raise_for_status(self):
                return None

            def json(self):
                return self.payload

        calls = []

        def fake_post(url, json, timeout):
            calls.append((url, json, timeout))
            if url.endswith("/match-photo"):
                return FakeResponse({
                    "photoId": str(photo["id"]),
                    "eventId": str(eid),
                    "fileName": "group.png",
                    "originalImageUrl": json["originalImageUrl"],
                    "redactedImageUrl": None,
                    "status": "match_found",
                    "detections": [{
                        "id": "det-1",
                        "photoId": str(photo["id"]),
                        "attendeeId": str(attendee["id"]),
                        "attendeeName": "Maya",
                        "referenceImageUrl": "data:image/png;base64,UkVG",
                        "confidence": 0.91,
                        "status": "auto_blurred",
                        "boundingBox": {"x": 10, "y": 20, "width": 30, "height": 40},
                    }],
                    "highestConfidence": 0.91,
                    "needsManualReview": False,
                    "success": True,
                    "error": None,
                })
            return FakeResponse({
                "photoId": str(photo["id"]),
                "eventId": str(eid),
                "originalImagePath": json["imagePath"],
                "outputImagePath": "tmp/group_redacted.png",
                "boxesApplied": 1,
                "boxesSkipped": 0,
                "needsManualReview": False,
                "success": True,
                "error": None,
            })

        monkeypatch.setattr("backend.ai_processing.requests.post", fake_post)

        resp = client.post(f"/events/{eid}/photos/{photo['id']}/process", json={
            "image_data_url": "data:image/png;base64,UE5HREFUQQ==",
            "original_image_url": "data:image/png;base64,UE5HREFUQQ==",
        })

        assert resp.status_code == 200
        data = resp.get_json()
        assert data["status"] == "processed"
        assert data["redacted_image_url"] == "tmp/group_redacted.png"
        assert len(data["detections"]) == 1
        assert data["detections"][0]["confidence"] == 91
        assert data["detections"][0]["redaction_status"] == "auto_blurred"
        assert data["detections"][0]["bounding_box"] == [10, 20, 30, 40]
        assert [call[0].rsplit("/", 1)[-1] for call in calls] == ["match-photo", "redact"]

    def test_process_photo_rejects_missing_image(self, client):
        eid = self._create_event(client)
        photo = client.post(f"/events/{eid}/photos", json={
            "filename": "group.png",
        }).get_json()

        resp = client.post(f"/events/{eid}/photos/{photo['id']}/process", json={})

        assert resp.status_code == 400
        assert "No readable event photo" in resp.get_json()["error"]

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


class TestAttendeePhotoAliases:
    """Backend accepts multiple field name conventions for the reference photo."""

    _TINY_PNG_B64 = (
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwADhQGAWjR9"
        "awAAAABJRU5ErkJggg=="
    )

    def _create_event(self, client):
        return client.post("/events", json={"name": "Ev", "organizer_id": "org"}).get_json()["id"]

    def test_reference_image_data_url_alias(self, client):
        eid = self._create_event(client)
        resp = client.post(f"/events/{eid}/attendees", json={
            "name": "Alias Test",
            "consent_status": "opted_out",
            "opted_out": True,
            "reference_image_data_url": f"data:image/png;base64,{self._TINY_PNG_B64}",
        })
        assert resp.status_code == 201
        data = resp.get_json()
        assert data["reference_photo_url"] is not None
        assert data["reference_photo_url"].startswith("/uploads/attendees/")

    def test_non_data_url_stored_as_null(self, client):
        """A served path passed as reference_photo_url should not be re-saved."""
        eid = self._create_event(client)
        resp = client.post(f"/events/{eid}/attendees", json={
            "name": "Path Test",
            "consent_status": "opted_out",
            "opted_out": True,
            "reference_photo_url": "/uploads/attendees/existing.png",
        })
        assert resp.status_code == 201
        assert resp.get_json()["reference_photo_url"] is None


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

    def test_seed_no_mock_base64_strings(self, client):
        """Seeded attendees must not store fake MOCK_* data URLs in the DB."""
        client.post("/seed")

        from backend.db import get_db
        with client.application.app_context():
            db = get_db()
            rows = db.execute("SELECT name, reference_photo_url FROM attendees").fetchall()
            for row in rows:
                url = row["reference_photo_url"]
                assert url is None or url.startswith("/uploads/"), (
                    f"Attendee {row['name']!r} has invalid reference_photo_url: {url!r}"
                )
            det_rows = db.execute("SELECT attendee_name, reference_photo_url FROM detections").fetchall()
            for row in det_rows:
                url = row["reference_photo_url"]
                assert url is None or url.startswith("/uploads/"), (
                    f"Detection for {row['attendee_name']!r} has invalid reference_photo_url: {url!r}"
                )

    def test_seed_adds_demo_event_when_other_events_exist(self, client):
        client.post("/events", json={"name": "Other", "organizer_id": "org"})

        resp = client.post("/seed")
        data = resp.get_json()

        assert data["seeded"] is True
        assert data["event_key"] == "HUSKY-42F7"
        assert client.get("/events/key/HUSKY-42F7").status_code == 200
