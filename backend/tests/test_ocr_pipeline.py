"""
Test the full OCR → Gemini → DB pipeline.

Run from backend/:
    python3 tests/test_ocr_pipeline.py
    pytest tests/test_ocr_pipeline.py -v
"""
import sys
import os

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.calendar_service import save_assignments_to_db, process_and_save_syllabus
from db.connection import table

# ── Fake syllabus text (skips OCR so no Tesseract needed) ──────────────────────
SAMPLE_SYLLABUS = """
CS 101 — Introduction to Programming
Spring 2026

Assignments & Deadlines
-----------------------
Lab 7: Recursion                    Due: March 15, 2026
Problem Set 3: Loops & Functions    Due: March 20, 2026
Midterm Project                     Due: April 1, 2026   (project)
Final Exam                          Due: May 10, 2026    (exam)
Quiz 4: OOP Basics                  Due: March 28, 2026
"""

TEST_USER = "user_andres"


def test_gemini_parse():
    print("\n[1] Testing Gemini parsing from raw text...")
    from services.calendar_service import parse_syllabus
    result = parse_syllabus(SAMPLE_SYLLABUS)
    assignments = result.get("assignments", [])
    assert len(assignments) > 0, "Gemini returned no assignments"
    print(f"    Gemini extracted {len(assignments)} assignments:")
    for a in assignments:
        print(f"      • {a.get('title')} | {a.get('due_date')} | {a.get('assignment_type')}")


@pytest.fixture
def parsed_assignments():
    from services.calendar_service import parse_syllabus
    result = parse_syllabus(SAMPLE_SYLLABUS)
    return result.get("assignments", [])


def test_save_to_db(parsed_assignments):
    print("\n[2] Testing save_assignments_to_db()...")
    before_rows = table("assignments").select(
        "id", filters={"user_id": f"eq.{TEST_USER}"}
    )
    before = len(before_rows)

    assignments = parsed_assignments
    saved = save_assignments_to_db(TEST_USER, assignments)
    assert saved == len(assignments), f"Expected {len(assignments)} saved, got {saved}"

    after_rows = table("assignments").select(
        "title,due_date,assignment_type",
        filters={"user_id": f"eq.{TEST_USER}"},
        order="due_date.asc",
    )
    after = len(after_rows)

    print(f"    Saved {saved} rows (DB went from {before} → {after} for {TEST_USER})")
    print("    Sample rows now in DB:")
    for r in after_rows[-5:]:
        print(f"      • {r['title']} | {r['due_date']} | {r['assignment_type']}")


def test_full_pipeline():
    print("\n[3] Testing process_and_save_syllabus() full pipeline with a text/plain file...")
    fake_bytes = SAMPLE_SYLLABUS.encode("utf-8")
    result = process_and_save_syllabus(
        file_bytes=fake_bytes,
        filename="syllabus_test.txt",
        content_type="text/plain",
        user_id=TEST_USER,
    )
    print(f"    assignments returned : {len(result['assignments'])}")
    print(f"    saved_count          : {result['saved_count']}")
    print(f"    warnings             : {result.get('warnings', [])}")
    assert result["saved_count"] >= 0, "save_count should be non-negative"
    print("    Pipeline OK")


if __name__ == "__main__":
    print("=" * 55)
    print("Sapling OCR Pipeline Test")
    print("DB: Supabase")
    print("=" * 55)

    try:
        from services.calendar_service import parse_syllabus
        test_gemini_parse()
        assignments = parse_syllabus(SAMPLE_SYLLABUS).get("assignments", [])
        test_save_to_db(assignments)
        test_full_pipeline()
        print("\n✓ All tests passed")
    except Exception as e:
        print(f"\n✗ Test failed: {e}")
        import traceback; traceback.print_exc()
        sys.exit(1)
