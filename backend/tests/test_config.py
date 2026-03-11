"""
Unit tests for config.py — get_mastery_tier()
"""
from config import get_mastery_tier


class TestGetMasteryTier:
    # ── unexplored ────────────────────────────────────────────────────────────

    def test_zero_is_unexplored(self):
        assert get_mastery_tier(0.0) == "unexplored"

    def test_just_below_struggling_threshold_is_unexplored(self):
        assert get_mastery_tier(0.09) == "unexplored"

    def test_negative_is_unexplored(self):
        # Clamping happens upstream; function should still classify it
        assert get_mastery_tier(-1.0) == "unexplored"

    # ── struggling ────────────────────────────────────────────────────────────

    def test_at_struggling_threshold(self):
        assert get_mastery_tier(0.1) == "struggling"

    def test_mid_struggling(self):
        assert get_mastery_tier(0.25) == "struggling"

    def test_just_below_learning_is_struggling(self):
        assert get_mastery_tier(0.44) == "struggling"

    # ── learning ──────────────────────────────────────────────────────────────

    def test_at_learning_threshold(self):
        assert get_mastery_tier(0.45) == "learning"

    def test_mid_learning(self):
        assert get_mastery_tier(0.6) == "learning"

    def test_just_below_mastered_is_learning(self):
        assert get_mastery_tier(0.74) == "learning"

    # ── mastered ──────────────────────────────────────────────────────────────

    def test_at_mastered_threshold(self):
        assert get_mastery_tier(0.75) == "mastered"

    def test_mid_mastered(self):
        assert get_mastery_tier(0.9) == "mastered"

    def test_perfect_score_is_mastered(self):
        assert get_mastery_tier(1.0) == "mastered"
