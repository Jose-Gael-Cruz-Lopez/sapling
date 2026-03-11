"""
Unit tests for routes/quiz.py

Covers:
- Mastery score update formula (scoring math)
- POST /api/quiz/submit — answer grading and result shape
- POST /api/quiz/submit — 404 when quiz not found
"""
import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


# ── Scoring formula (pure logic, no HTTP) ────────────────────────────────────

class TestMasteryScoreFormula:
    """
    The formula in submit_quiz:
        mastery_after = clamp(mastery_before + (correct * 0.03) - (wrong * 0.02), 0.0, 1.0)
    """

    def _calc(self, before: float, correct: int, total: int) -> float:
        wrong = total - correct
        return max(0.0, min(1.0, before + (correct * 0.03) - (wrong * 0.02)))

    def test_perfect_score_increases_mastery(self):
        assert self._calc(0.5, 5, 5) == pytest.approx(0.5 + 0.15)

    def test_zero_score_decreases_mastery(self):
        assert self._calc(0.5, 0, 5) == pytest.approx(0.5 - 0.10)

    def test_partial_score(self):
        # 3 correct (+0.09), 2 wrong (-0.04)
        assert self._calc(0.5, 3, 5) == pytest.approx(0.55)

    def test_mastery_clamped_at_1(self):
        assert self._calc(0.95, 5, 5) == 1.0

    def test_mastery_clamped_at_0(self):
        assert self._calc(0.05, 0, 5) == 0.0

    def test_mastery_unchanged_when_score_balances_out(self):
        # e.g. 2 correct (+0.06) vs 3 wrong (-0.06) ≈ no change
        assert self._calc(0.5, 2, 5) == pytest.approx(0.5)


# ── POST /api/quiz/submit ────────────────────────────────────────────────────

SAMPLE_QUESTIONS = [
    {
        "id": 1,
        "text": "What does a for-loop do?",
        "options": [
            {"label": "A", "correct": True},
            {"label": "B", "correct": False},
        ],
        "explanation": "A is correct.",
    },
    {
        "id": 2,
        "text": "What is a function?",
        "options": [
            {"label": "C", "correct": False},
            {"label": "D", "correct": True},
        ],
        "explanation": "D is correct.",
    },
]


def _make_table(questions=None):
    """Return a table factory with sane defaults for quiz submission tests."""
    q = questions or SAMPLE_QUESTIONS

    def factory(name):
        mock = MagicMock()
        if name == "quiz_attempts":
            mock.select.return_value = [{
                "id": "quiz1",
                "user_id": "user_andres",
                "concept_node_id": "node1",
                "difficulty": "medium",
                "questions_json": q,
            }]
        elif name == "graph_nodes":
            mock.select.return_value = [{"mastery_score": 0.5, "times_studied": 2, "concept_name": "Loops"}]
        elif name == "users":
            mock.select.return_value = [{"name": "Andres"}]
        else:
            mock.select.return_value = []
        mock.update.return_value = []
        return mock

    return factory


class TestSubmitQuiz:
    def test_all_correct_returns_full_score(self):
        with patch("routes.quiz.table", side_effect=_make_table()):
            with patch("routes.quiz.get_graph", return_value={"nodes": [], "edges": [], "stats": {}}):
                with patch("routes.quiz.get_quiz_context", return_value={}):
                    with patch("routes.quiz.call_gemini_json", return_value={}):
                        r = client.post("/api/quiz/submit", json={
                            "quiz_id": "quiz1",
                            "answers": [
                                {"question_id": 1, "selected_label": "A"},
                                {"question_id": 2, "selected_label": "D"},
                            ],
                        })

        assert r.status_code == 200
        data = r.json()
        assert data["score"] == 2
        assert data["total"] == 2

    def test_all_wrong_returns_zero_score(self):
        with patch("routes.quiz.table", side_effect=_make_table()):
            with patch("routes.quiz.get_graph", return_value={"nodes": [], "edges": [], "stats": {}}):
                with patch("routes.quiz.get_quiz_context", return_value={}):
                    with patch("routes.quiz.call_gemini_json", return_value={}):
                        r = client.post("/api/quiz/submit", json={
                            "quiz_id": "quiz1",
                            "answers": [
                                {"question_id": 1, "selected_label": "B"},
                                {"question_id": 2, "selected_label": "C"},
                            ],
                        })

        assert r.status_code == 200
        assert r.json()["score"] == 0

    def test_result_shape_contains_required_fields(self):
        with patch("routes.quiz.table", side_effect=_make_table()):
            with patch("routes.quiz.get_graph", return_value={"nodes": [], "edges": [], "stats": {}}):
                with patch("routes.quiz.get_quiz_context", return_value={}):
                    with patch("routes.quiz.call_gemini_json", return_value={}):
                        r = client.post("/api/quiz/submit", json={
                            "quiz_id": "quiz1",
                            "answers": [{"question_id": 1, "selected_label": "A"}],
                        })

        data = r.json()
        assert "score" in data
        assert "total" in data
        assert "mastery_before" in data
        assert "mastery_after" in data
        assert "results" in data

    def test_each_result_has_correct_flag(self):
        with patch("routes.quiz.table", side_effect=_make_table()):
            with patch("routes.quiz.get_graph", return_value={"nodes": [], "edges": [], "stats": {}}):
                with patch("routes.quiz.get_quiz_context", return_value={}):
                    with patch("routes.quiz.call_gemini_json", return_value={}):
                        r = client.post("/api/quiz/submit", json={
                            "quiz_id": "quiz1",
                            "answers": [
                                {"question_id": 1, "selected_label": "A"},  # correct
                                {"question_id": 2, "selected_label": "C"},  # wrong
                            ],
                        })

        results = r.json()["results"]
        correct_flags = {str(res["question_id"]): res["correct"] for res in results}
        assert correct_flags["1"] is True
        assert correct_flags["2"] is False

    def test_mastery_after_is_higher_on_perfect_score(self):
        with patch("routes.quiz.table", side_effect=_make_table()):
            with patch("routes.quiz.get_graph", return_value={"nodes": [], "edges": [], "stats": {}}):
                with patch("routes.quiz.get_quiz_context", return_value={}):
                    with patch("routes.quiz.call_gemini_json", return_value={}):
                        r = client.post("/api/quiz/submit", json={
                            "quiz_id": "quiz1",
                            "answers": [
                                {"question_id": 1, "selected_label": "A"},
                                {"question_id": 2, "selected_label": "D"},
                            ],
                        })

        data = r.json()
        assert data["mastery_after"] > data["mastery_before"]

    def test_mastery_after_is_lower_on_zero_score(self):
        with patch("routes.quiz.table", side_effect=_make_table()):
            with patch("routes.quiz.get_graph", return_value={"nodes": [], "edges": [], "stats": {}}):
                with patch("routes.quiz.get_quiz_context", return_value={}):
                    with patch("routes.quiz.call_gemini_json", return_value={}):
                        r = client.post("/api/quiz/submit", json={
                            "quiz_id": "quiz1",
                            "answers": [
                                {"question_id": 1, "selected_label": "B"},
                                {"question_id": 2, "selected_label": "C"},
                            ],
                        })

        data = r.json()
        assert data["mastery_after"] < data["mastery_before"]

    def test_returns_404_for_nonexistent_quiz(self):
        with patch("routes.quiz.table") as t:
            t.return_value.select.return_value = []
            r = client.post("/api/quiz/submit", json={
                "quiz_id": "does-not-exist",
                "answers": [],
            })
        assert r.status_code == 404

    def test_questions_json_as_string_is_parsed(self):
        """quiz_attempts.questions_json can arrive as a JSON string from the DB."""
        import json as _json

        def factory(name):
            mock = MagicMock()
            if name == "quiz_attempts":
                mock.select.return_value = [{
                    "id": "quiz1",
                    "user_id": "user_andres",
                    "concept_node_id": "node1",
                    "difficulty": "medium",
                    "questions_json": _json.dumps(SAMPLE_QUESTIONS),  # serialised string
                }]
            elif name == "graph_nodes":
                mock.select.return_value = [{"mastery_score": 0.5, "times_studied": 0, "concept_name": "Loops"}]
            elif name == "users":
                mock.select.return_value = [{"name": "Andres"}]
            else:
                mock.select.return_value = []
            mock.update.return_value = []
            return mock

        with patch("routes.quiz.table", side_effect=factory):
            with patch("routes.quiz.get_graph", return_value={"nodes": [], "edges": [], "stats": {}}):
                with patch("routes.quiz.get_quiz_context", return_value={}):
                    with patch("routes.quiz.call_gemini_json", return_value={}):
                        r = client.post("/api/quiz/submit", json={
                            "quiz_id": "quiz1",
                            "answers": [
                                {"question_id": 1, "selected_label": "A"},
                                {"question_id": 2, "selected_label": "D"},
                            ],
                        })

        assert r.status_code == 200
        assert r.json()["score"] == 2
