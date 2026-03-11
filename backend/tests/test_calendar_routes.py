"""
Unit tests for routes/calendar.py

Helper functions are tested directly; route endpoints are tested via
FastAPI's TestClient with the DB layer mocked out.
"""
import base64
import json
import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


# ── _encode_state / _decode_state ─────────────────────────────────────────────

class TestStateEncoding:
    def test_roundtrip(self):
        from routes.calendar import _encode_state, _decode_state
        assert _decode_state(_encode_state("user_andres")) == "user_andres"

    def test_decode_invalid_base64_returns_empty(self):
        from routes.calendar import _decode_state
        assert _decode_state("!!!not_base64!!!") == ""

    def test_decode_valid_base64_missing_user_id_returns_empty(self):
        from routes.calendar import _decode_state
        payload = base64.urlsafe_b64encode(json.dumps({"other": "key"}).encode()).decode()
        assert _decode_state(payload) == ""

    def test_encode_produces_url_safe_string(self):
        from routes.calendar import _encode_state
        encoded = _encode_state("user_test")
        # Should not contain characters unsafe for URLs
        assert "+" not in encoded
        assert "/" not in encoded


# ── GET /api/calendar/status/{user_id} ───────────────────────────────────────

class TestCalendarStatus:
    def test_not_connected_when_no_token_row(self):
        with patch("routes.calendar.table") as t:
            t.return_value.select.return_value = []
            r = client.get("/api/calendar/status/user_andres")
        assert r.status_code == 200
        assert r.json() == {"connected": False}

    def test_not_connected_when_access_token_is_empty(self):
        with patch("routes.calendar.table") as t:
            t.return_value.select.return_value = [{"access_token": "", "expires_at": ""}]
            r = client.get("/api/calendar/status/user_andres")
        assert r.status_code == 200
        assert r.json()["connected"] is False

    def test_connected_when_valid_token_exists(self):
        with patch("routes.calendar.table") as t:
            t.return_value.select.return_value = [
                {"access_token": "valid_token_xyz", "expires_at": "2030-01-01T00:00:00"}
            ]
            r = client.get("/api/calendar/status/user_andres")
        assert r.status_code == 200
        assert r.json()["connected"] is True
        assert r.json()["expires_at"] == "2030-01-01T00:00:00"


# ── POST /api/calendar/save ───────────────────────────────────────────────────

class TestSaveAssignments:
    def test_saves_multiple_assignments(self):
        with patch("routes.calendar.table") as t:
            t.return_value.insert.return_value = []
            body = {
                "user_id": "user_andres",
                "assignments": [
                    {"title": "HW1",    "due_date": "2026-03-01", "assignment_type": "homework"},
                    {"title": "Quiz 1", "due_date": "2026-03-10", "assignment_type": "quiz"},
                ],
            }
            r = client.post("/api/calendar/save", json=body)

        assert r.status_code == 200
        assert r.json()["saved_count"] == 2

    def test_save_empty_list_returns_zero(self):
        with patch("routes.calendar.table"):
            r = client.post("/api/calendar/save", json={"user_id": "user_andres", "assignments": []})
        assert r.status_code == 200
        assert r.json()["saved_count"] == 0

    def test_save_with_optional_fields_omitted(self):
        with patch("routes.calendar.table") as t:
            t.return_value.insert.return_value = []
            body = {
                "user_id": "user_andres",
                "assignments": [{"title": "Midterm", "due_date": "2026-04-01"}],
            }
            r = client.post("/api/calendar/save", json=body)
        assert r.status_code == 200
        assert r.json()["saved_count"] == 1


# ── GET /api/calendar/upcoming/{user_id} ─────────────────────────────────────

class TestGetUpcoming:
    def test_returns_assignments_from_db(self):
        mock_rows = [
            {"id": "a1", "title": "HW1",  "due_date": "2026-03-01"},
            {"id": "a2", "title": "Quiz", "due_date": "2026-03-10"},
        ]
        with patch("routes.calendar.table") as t:
            t.return_value.select.return_value = mock_rows
            r = client.get("/api/calendar/upcoming/user_andres")

        assert r.status_code == 200
        assert len(r.json()["assignments"]) == 2
        assert r.json()["assignments"][0]["title"] == "HW1"

    def test_returns_empty_list_when_none(self):
        with patch("routes.calendar.table") as t:
            t.return_value.select.return_value = []
            r = client.get("/api/calendar/upcoming/user_andres")
        assert r.status_code == 200
        assert r.json()["assignments"] == []


# ── POST /api/calendar/suggest-study-blocks ───────────────────────────────────

class TestSuggestStudyBlocks:
    def test_returns_at_most_5_blocks(self):
        many_assignments = [
            {"id": f"a{i}", "title": f"Task {i}", "due_date": f"2026-03-{i:02d}", "course_name": "CS"}
            for i in range(1, 9)
        ]
        with patch("routes.calendar.table") as t:
            t.return_value.select.return_value = many_assignments
            r = client.post("/api/calendar/suggest-study-blocks", json={"user_id": "user_andres"})

        assert r.status_code == 200
        assert len(r.json()["study_blocks"]) <= 5

    def test_block_shape_is_correct(self):
        assignments = [{"id": "a1", "title": "HW1", "due_date": "2026-03-01", "course_name": "Math"}]
        with patch("routes.calendar.table") as t:
            t.return_value.select.return_value = assignments
            r = client.post("/api/calendar/suggest-study-blocks", json={"user_id": "user_andres"})

        block = r.json()["study_blocks"][0]
        assert "topic" in block
        assert "suggested_date" in block
        assert "duration_minutes" in block
        assert block["duration_minutes"] == 60

    def test_empty_assignments_returns_empty_blocks(self):
        with patch("routes.calendar.table") as t:
            t.return_value.select.return_value = []
            r = client.post("/api/calendar/suggest-study-blocks", json={"user_id": "user_andres"})
        assert r.json()["study_blocks"] == []


# ── DELETE /api/calendar/disconnect/{user_id} ─────────────────────────────────

class TestDisconnect:
    def test_deletes_oauth_token_and_returns_disconnected(self):
        with patch("routes.calendar.table") as t:
            t.return_value.delete.return_value = []
            r = client.delete("/api/calendar/disconnect/user_andres")
        assert r.status_code == 200
        assert r.json() == {"disconnected": True}
