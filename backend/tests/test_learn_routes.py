"""
Unit tests for routes/learn.py

Tests pure helper functions directly (no HTTP layer needed).
Route-level tests use FastAPI's TestClient with Gemini and DB mocked.
"""
import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient

from routes.learn import format_history_for_prompt, _resolve_course
from main import app

client = TestClient(app)


# ── format_history_for_prompt ─────────────────────────────────────────────────

class TestFormatHistoryForPrompt:
    def test_empty_history_returns_empty_string(self):
        assert format_history_for_prompt([]) == ""

    def test_user_message_labeled_student(self):
        history = [{"role": "user", "content": "What is a loop?"}]
        result = format_history_for_prompt(history)
        assert "Student: What is a loop?" in result

    def test_assistant_message_labeled_sapling(self):
        history = [{"role": "assistant", "content": "A loop repeats code."}]
        result = format_history_for_prompt(history)
        assert "Sapling: A loop repeats code." in result

    def test_multi_turn_preserves_order(self):
        history = [
            {"role": "user",      "content": "What is recursion?"},
            {"role": "assistant", "content": "A function calling itself."},
            {"role": "user",      "content": "Give me an example."},
        ]
        result = format_history_for_prompt(history)
        assert result.index("What is recursion?") < result.index("A function calling itself.")
        assert result.index("A function calling itself.") < result.index("Give me an example.")

    def test_parts_are_double_newline_separated(self):
        history = [
            {"role": "user",      "content": "First"},
            {"role": "assistant", "content": "Second"},
        ]
        result = format_history_for_prompt(history)
        assert "\n\n" in result


# ── _resolve_course ───────────────────────────────────────────────────────────

class TestResolveCourse:
    def test_empty_topic_returns_empty(self):
        with patch("routes.learn.table"):
            assert _resolve_course("", "u1") == ""

    def test_topic_matches_subject_name(self):
        def factory(name):
            mock = MagicMock()
            mock.select.return_value = [{"subject": "Math"}]
            return mock

        with patch("routes.learn.table", side_effect=factory):
            assert _resolve_course("Math", "u1") == "Math"

    def test_topic_matches_concept_name(self):
        call_count = {"n": 0}

        def factory(name):
            mock = MagicMock()
            call_count["n"] += 1
            # First call: subject lookup → no match
            # Second call: concept lookup → match with subject
            mock.select.return_value = [] if call_count["n"] == 1 else [{"subject": "CS101"}]
            return mock

        with patch("routes.learn.table", side_effect=factory):
            assert _resolve_course("Recursion", "u1") == "CS101"

    def test_unknown_topic_returns_empty(self):
        mock = MagicMock()
        mock.select.return_value = []
        with patch("routes.learn.table", return_value=mock):
            assert _resolve_course("UnknownXyzzy", "u1") == ""


# ── GET /api/learn/sessions/{user_id} ────────────────────────────────────────

class TestListSessions:
    def test_returns_sessions_with_message_count(self):
        sessions = [
            {"id": "s1", "topic": "Loops", "mode": "socratic", "started_at": "2026-01-01T10:00:00", "ended_at": None},
        ]

        def factory(name):
            mock = MagicMock()
            if name == "sessions":
                mock.select.return_value = sessions
            elif name == "messages":
                mock.select.return_value = [{"id": "m1"}, {"id": "m2"}]
            else:
                mock.select.return_value = []
            return mock

        with patch("routes.learn.table", side_effect=factory):
            r = client.get("/api/learn/sessions/user_andres")

        assert r.status_code == 200
        data = r.json()["sessions"]
        assert len(data) == 1
        assert data[0]["topic"] == "Loops"
        assert data[0]["message_count"] == 2
        assert data[0]["is_active"] is True

    def test_ended_session_is_not_active(self):
        sessions = [{"id": "s1", "topic": "X", "mode": "socratic", "started_at": "2026-01-01T00:00:00", "ended_at": "2026-01-01T01:00:00"}]

        def factory(name):
            mock = MagicMock()
            mock.select.return_value = sessions if name == "sessions" else []
            return mock

        with patch("routes.learn.table", side_effect=factory):
            r = client.get("/api/learn/sessions/user_andres")

        assert r.json()["sessions"][0]["is_active"] is False

    def test_empty_sessions(self):
        with patch("routes.learn.table") as t:
            t.return_value.select.return_value = []
            r = client.get("/api/learn/sessions/user_andres")
        assert r.status_code == 200
        assert r.json()["sessions"] == []


# ── GET /api/learn/sessions/{session_id}/resume ───────────────────────────────

class TestResumeSession:
    def test_returns_404_when_session_not_found(self):
        with patch("routes.learn.table") as t:
            t.return_value.select.return_value = []
            r = client.get("/api/learn/sessions/nonexistent-id/resume")
        assert r.status_code == 404

    def test_returns_session_and_messages(self):
        session_data = [{"id": "s1", "user_id": "u1", "topic": "Loops", "mode": "socratic", "started_at": "2026-01-01T00:00:00", "ended_at": None}]
        messages = [{"id": "m1", "role": "assistant", "content": "Hello!", "created_at": "2026-01-01T00:00:01"}]

        call_count = {"n": 0}

        def factory(name):
            mock = MagicMock()
            call_count["n"] += 1
            if name == "sessions":
                mock.select.return_value = session_data
            else:
                mock.select.return_value = messages
            return mock

        with patch("routes.learn.table", side_effect=factory):
            r = client.get("/api/learn/sessions/s1/resume")

        assert r.status_code == 200
        assert r.json()["session"]["topic"] == "Loops"
        assert len(r.json()["messages"]) == 1
