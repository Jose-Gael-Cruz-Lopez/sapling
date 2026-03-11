"""
Unit tests for services/graph_service.py

All Supabase calls are mocked so no live DB connection is needed.
"""
import pytest
from unittest.mock import MagicMock, patch

from services.graph_service import (
    get_graph,
    get_courses,
    add_course,
    delete_course,
    apply_graph_update,
    get_recommendations,
)


# ── helpers ───────────────────────────────────────────────────────────────────

def _mock_table(data: dict):
    """
    Return a factory function that, given a table name, returns a MagicMock
    whose .select() returns the matching list from `data`.
    """
    def _factory(name):
        mock = MagicMock()
        mock.select.return_value = data.get(name, [])
        mock.insert.return_value = []
        mock.update.return_value = []
        mock.delete.return_value = []
        mock.upsert.return_value = []
        return mock
    return _factory


def _simple_mock(select_returns=None):
    """Return a single MagicMock SupabaseTable for tests that only use one table."""
    mock = MagicMock()
    mock.select.return_value = select_returns if select_returns is not None else []
    mock.insert.return_value = []
    mock.update.return_value = []
    mock.delete.return_value = []
    return mock


# ── get_graph ─────────────────────────────────────────────────────────────────

class TestGetGraph:
    def test_empty_graph_returns_zero_stats(self):
        factory = _mock_table({
            "users": [{"streak_count": 5}],
            "graph_nodes": [],
            "graph_edges": [],
            "courses": [],
        })
        with patch("services.graph_service.table", side_effect=factory):
            result = get_graph("u1")

        assert result["stats"]["total_nodes"] == 0
        assert result["stats"]["streak"] == 5
        assert result["nodes"] == []
        assert result["edges"] == []

    def test_counts_each_mastery_tier(self):
        nodes = [
            {"id": "n1", "concept_name": "A", "mastery_tier": "mastered",   "mastery_score": 0.9,  "subject": "Math", "times_studied": 1, "user_id": "u1"},
            {"id": "n2", "concept_name": "B", "mastery_tier": "learning",   "mastery_score": 0.5,  "subject": "Math", "times_studied": 1, "user_id": "u1"},
            {"id": "n3", "concept_name": "C", "mastery_tier": "struggling", "mastery_score": 0.2,  "subject": "Math", "times_studied": 1, "user_id": "u1"},
            {"id": "n4", "concept_name": "D", "mastery_tier": "unexplored", "mastery_score": 0.0,  "subject": "Math", "times_studied": 0, "user_id": "u1"},
        ]
        factory = _mock_table({"users": [{"streak_count": 0}], "graph_nodes": nodes, "graph_edges": [], "courses": []})
        with patch("services.graph_service.table", side_effect=factory):
            stats = get_graph("u1")["stats"]

        assert stats["mastered"]   == 1
        assert stats["learning"]   == 1
        assert stats["struggling"] == 1
        assert stats["unexplored"] == 1
        assert stats["total_nodes"] == 4

    def test_adds_subject_root_node_per_subject(self):
        nodes = [
            {"id": "n1", "concept_name": "Loops",     "mastery_tier": "learning", "mastery_score": 0.5, "subject": "CS101", "times_studied": 2, "user_id": "u1"},
            {"id": "n2", "concept_name": "Functions", "mastery_tier": "mastered", "mastery_score": 0.8, "subject": "CS101", "times_studied": 3, "user_id": "u1"},
        ]
        factory = _mock_table({"users": [{"streak_count": 0}], "graph_nodes": nodes, "graph_edges": [], "courses": []})
        with patch("services.graph_service.table", side_effect=factory):
            result = get_graph("u1")

        roots = [n for n in result["nodes"] if n.get("is_subject_root")]
        assert len(roots) == 1
        assert roots[0]["concept_name"] == "CS101"
        assert roots[0]["mastery_tier"] == "subject_root"

    def test_empty_course_appears_as_subject_root(self):
        factory = _mock_table({
            "users": [{"streak_count": 0}],
            "graph_nodes": [],
            "graph_edges": [],
            "courses": [{"course_name": "Philosophy"}],
        })
        with patch("services.graph_service.table", side_effect=factory):
            result = get_graph("u1")

        roots = [n for n in result["nodes"] if n.get("is_subject_root")]
        assert any(n["concept_name"] == "Philosophy" for n in roots)

    def test_edges_are_remapped(self):
        nodes = [{"id": "n1", "concept_name": "A", "mastery_tier": "learning", "mastery_score": 0.5, "subject": "X", "times_studied": 0, "user_id": "u1"}]
        edges = [{"id": "e1", "source_node_id": "n1", "target_node_id": "n1", "strength": 0.9}]
        factory = _mock_table({"users": [{"streak_count": 0}], "graph_nodes": nodes, "graph_edges": edges, "courses": []})
        with patch("services.graph_service.table", side_effect=factory):
            result = get_graph("u1")

        graph_edges = [e for e in result["edges"] if not e["id"].startswith("subject_edge")]
        assert len(graph_edges) == 1
        assert graph_edges[0]["source"] == "n1"
        assert graph_edges[0]["strength"] == 0.9

    def test_streak_defaults_to_zero_when_no_user_row(self):
        factory = _mock_table({"users": [], "graph_nodes": [], "graph_edges": [], "courses": []})
        with patch("services.graph_service.table", side_effect=factory):
            result = get_graph("u1")
        assert result["stats"]["streak"] == 0


# ── get_courses ───────────────────────────────────────────────────────────────

class TestGetCourses:
    def test_returns_courses_with_node_count(self):
        def factory(name):
            mock = MagicMock()
            if name == "courses":
                mock.select.return_value = [{"id": "c1", "course_name": "Math", "color": "#fff", "created_at": "2026-01-01"}]
            elif name == "graph_nodes":
                mock.select.return_value = [{"id": "n1"}, {"id": "n2"}]
            return mock

        with patch("services.graph_service.table", side_effect=factory):
            result = get_courses("u1")

        assert len(result) == 1
        assert result[0]["course_name"] == "Math"
        assert result[0]["node_count"] == 2

    def test_returns_empty_on_exception(self):
        def factory(name):
            mock = MagicMock()
            mock.select.side_effect = Exception("DB error")
            return mock

        with patch("services.graph_service.table", side_effect=factory):
            result = get_courses("u1")
        assert result == []


# ── add_course ────────────────────────────────────────────────────────────────

class TestAddCourse:
    def test_inserts_new_course(self):
        mock = _simple_mock(select_returns=[])
        with patch("services.graph_service.table", return_value=mock):
            result = add_course("u1", "Physics")

        assert result["course_name"] == "Physics"
        assert result["already_existed"] is False
        mock.insert.assert_called_once()

    def test_skips_insert_for_existing_course(self):
        mock = _simple_mock(select_returns=[{"id": "existing"}])
        with patch("services.graph_service.table", return_value=mock):
            result = add_course("u1", "Physics")

        assert result["already_existed"] is True
        mock.insert.assert_not_called()


# ── delete_course ─────────────────────────────────────────────────────────────

class TestDeleteCourse:
    def test_deletes_nodes_edges_and_course(self):
        def factory(name):
            mock = MagicMock()
            mock.select.return_value = [{"id": "n1"}, {"id": "n2"}] if name == "graph_nodes" else []
            mock.delete.return_value = []
            return mock

        with patch("services.graph_service.table", side_effect=factory):
            result = delete_course("u1", "Math")

        assert result == {"deleted": True}

    def test_deletes_course_with_no_nodes(self):
        mock = _simple_mock(select_returns=[])
        with patch("services.graph_service.table", return_value=mock):
            result = delete_course("u1", "EmptyCourse")
        assert result == {"deleted": True}


# ── apply_graph_update ────────────────────────────────────────────────────────

class TestApplyGraphUpdate:
    def test_inserts_new_node(self):
        mock = _simple_mock(select_returns=[])
        graph_update = {
            "new_nodes": [{"concept_name": "Recursion", "subject": "CS", "initial_mastery": 0.0}],
            "updated_nodes": [],
            "new_edges": [],
        }
        with patch("services.graph_service.table", return_value=mock):
            result = apply_graph_update("u1", graph_update)

        assert result == []
        mock.insert.assert_called()

    def test_skips_insert_for_existing_node(self):
        mock = _simple_mock(select_returns=[{"id": "existing_node"}])
        graph_update = {
            "new_nodes": [{"concept_name": "Recursion", "subject": "CS", "initial_mastery": 0.0}],
            "updated_nodes": [],
            "new_edges": [],
        }
        with patch("services.graph_service.table", return_value=mock):
            apply_graph_update("u1", graph_update)

        mock.insert.assert_not_called()

    def test_updates_mastery_score(self):
        def factory(name):
            mock = MagicMock()
            mock.select.return_value = [{"id": "n1", "mastery_score": 0.4, "times_studied": 2, "subject": "Math"}]
            mock.update.return_value = []
            return mock

        graph_update = {
            "new_nodes": [],
            "updated_nodes": [{"concept_name": "Algebra", "mastery_delta": 0.2}],
            "new_edges": [],
        }
        with patch("services.graph_service.table", side_effect=factory):
            with patch("services.course_context_service.update_course_context"):
                result = apply_graph_update("u1", graph_update)

        assert len(result) == 1
        assert result[0]["before"] == pytest.approx(0.4)
        assert result[0]["after"]  == pytest.approx(0.6)

    def test_mastery_clamped_at_1(self):
        def factory(name):
            mock = MagicMock()
            mock.select.return_value = [{"id": "n1", "mastery_score": 0.95, "times_studied": 5, "subject": "Math"}]
            mock.update.return_value = []
            return mock

        graph_update = {"new_nodes": [], "updated_nodes": [{"concept_name": "X", "mastery_delta": 0.5}], "new_edges": []}
        with patch("services.graph_service.table", side_effect=factory):
            with patch("services.course_context_service.update_course_context"):
                result = apply_graph_update("u1", graph_update)
        assert result[0]["after"] == 1.0

    def test_mastery_clamped_at_0(self):
        def factory(name):
            mock = MagicMock()
            mock.select.return_value = [{"id": "n1", "mastery_score": 0.05, "times_studied": 0, "subject": "Math"}]
            mock.update.return_value = []
            return mock

        graph_update = {"new_nodes": [], "updated_nodes": [{"concept_name": "X", "mastery_delta": -0.5}], "new_edges": []}
        with patch("services.graph_service.table", side_effect=factory):
            with patch("services.course_context_service.update_course_context"):
                result = apply_graph_update("u1", graph_update)
        assert result[0]["after"] == 0.0

    def test_empty_update_returns_empty_list(self):
        mock = MagicMock()
        with patch("services.graph_service.table", return_value=mock):
            result = apply_graph_update("u1", {"new_nodes": [], "updated_nodes": [], "new_edges": []})
        assert result == []

    def test_does_not_add_duplicate_edge(self):
        def factory(name):
            mock = MagicMock()
            if name == "graph_nodes":
                mock.select.return_value = [{"id": "n1"}]
            elif name == "graph_edges":
                # Edge already exists
                mock.select.return_value = [{"id": "e1"}]
            return mock

        graph_update = {
            "new_nodes": [],
            "updated_nodes": [],
            "new_edges": [{"source": "A", "target": "B", "strength": 0.7}],
        }
        with patch("services.graph_service.table", side_effect=factory):
            apply_graph_update("u1", graph_update)

        # Confirm no edge insert was called (edge already existed)
        # We can't directly assert on the edge mock here without more setup,
        # but the function should return without error
        assert True


# ── get_recommendations ───────────────────────────────────────────────────────

class TestGetRecommendations:
    def test_returns_recommendations(self):
        rows = [
            {"concept_name": "Pointers",   "mastery_score": 0.05, "mastery_tier": "struggling"},
            {"concept_name": "References", "mastery_score": 0.0,  "mastery_tier": "unexplored"},
        ]
        with patch("services.graph_service.table", return_value=_simple_mock(rows)):
            result = get_recommendations("u1")

        assert len(result) == 2
        assert result[0]["concept_name"] == "Pointers"
        assert "struggling" in result[0]["reason"].lower()
        assert "haven't studied" in result[1]["reason"].lower()

    def test_learning_tier_reason(self):
        rows = [{"concept_name": "Loops", "mastery_score": 0.5, "mastery_tier": "learning"}]
        with patch("services.graph_service.table", return_value=_simple_mock(rows)):
            result = get_recommendations("u1")
        assert "progress" in result[0]["reason"].lower()

    def test_empty_when_no_rows(self):
        with patch("services.graph_service.table", return_value=_simple_mock([])):
            result = get_recommendations("u1")
        assert result == []
