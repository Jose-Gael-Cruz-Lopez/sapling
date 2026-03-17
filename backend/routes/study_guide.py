"""
backend/routes/study_guide.py

AI-generated study guides: per-user, per-course, per-exam.
Guides are cached in the study_guides table and regenerated when new
course material is uploaded.
"""

import json
import logging
import threading
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, HTTPException, Query

from db.connection import table
from models import RegenerateStudyGuideBody
from services.gemini_service import call_gemini_json

logger = logging.getLogger(__name__)

router = APIRouter()

# Keywords that classify an assignment as an exam
_EXAM_KEYWORDS = {"exam", "midterm", "final", "test", "quiz"}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _is_exam(assignment: dict) -> bool:
    """Return True if the assignment looks like an exam."""
    if assignment.get("assignment_type") == "exam":
        return True
    title = (assignment.get("title") or "").lower()
    return any(kw in title for kw in _EXAM_KEYWORDS)


def _generate_guide(user_id: str, course: str, exam: dict) -> dict:
    """
    Call Gemini to produce a study guide for the given exam.
    Returns the parsed JSON guide dict.
    """
    exam_id = exam["id"]
    exam_title = exam["title"]
    due_date = exam.get("due_date", "")

    # ── Gather context ────────────────────────────────────────────────────────

    # All assignments for this user+course, ordered by due date
    all_assignments = table("assignments").select(
        "title,due_date,assignment_type",
        filters={"user_id": f"eq.{user_id}", "course_name": f"eq.{course}"},
        order="due_date.asc",
    )

    # Knowledge graph nodes for this user+course (concept labels only)
    graph_nodes = table("graph_nodes").select(
        "concept_name,mastery_tier",
        filters={"user_id": f"eq.{user_id}", "subject": f"eq.{course}"},
    )
    concept_names = [
        n["concept_name"] for n in graph_nodes
        if n.get("mastery_tier") not in ("subject_root", None)
        and n.get("concept_name")
    ]

    # Document summaries for this course (best-effort via courses → documents join)
    doc_summaries: list[str] = []
    try:
        course_rows = table("courses").select(
            "id",
            filters={"user_id": f"eq.{user_id}", "course_name": f"eq.{course}"},
            limit=1,
        )
        if course_rows:
            course_id = course_rows[0]["id"]
            docs = table("documents").select(
                "summary,category",
                filters={"user_id": f"eq.{user_id}", "course_id": f"eq.{course_id}"},
            )
            doc_summaries = [
                d["summary"] for d in docs
                if d.get("summary") and d.get("category") in ("syllabus", "lecture_notes", "slides", "reading", "study_guide")
            ]
    except Exception:
        logger.debug("Could not fetch document summaries for course '%s'", course)

    # ── Compute days until exam ───────────────────────────────────────────────
    try:
        exam_dt = datetime.strptime(due_date, "%Y-%m-%d")
        today_dt = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        days_left = max(1, (exam_dt - today_dt).days)
    except (ValueError, TypeError):
        days_left = 7

    study_days = min(days_left, 7)

    # ── Build prompt ──────────────────────────────────────────────────────────
    assignments_text = "\n".join(
        f"- {a['title']} (due {a.get('due_date', 'TBD')}, type: {a.get('assignment_type', 'other')})"
        for a in all_assignments
    ) or "No assignments listed."

    concepts_text = "\n".join(f"- {c}" for c in concept_names) or "No concepts in knowledge graph yet."

    docs_text = "\n\n".join(doc_summaries[:5]) or "No document summaries available."

    prompt = (
        f"You are a study coach generating a personalized exam study guide.\n\n"
        f"EXAM: {exam_title}\n"
        f"COURSE: {course}\n"
        f"DUE DATE: {due_date}\n"
        f"DAYS UNTIL EXAM: {days_left} (generate exactly {study_days} study day entries)\n\n"
        f"COURSE ASSIGNMENTS:\n{assignments_text}\n\n"
        f"KNOWLEDGE GRAPH CONCEPTS (topics the student has studied):\n{concepts_text}\n\n"
        f"DOCUMENT SUMMARIES:\n{docs_text}\n\n"
        "Based on the knowledge graph concepts, assignments, and document context above, "
        f"generate a {study_days}-day study plan leading up to the exam. "
        "Distribute all key topics evenly across the days. "
        "Each day should have 2-4 specific concept bullets to review.\n\n"
        "Return ONLY a JSON object with this exact schema (no markdown, no backticks):\n"
        "{\n"
        '  "exam": "<exam title>",\n'
        '  "due_date": "<YYYY-MM-DD>",\n'
        '  "summary": "<2-sentence overview of what this exam covers>",\n'
        '  "days": [\n'
        "    {\n"
        '      "date": "<YYYY-MM-DD>",\n'
        '      "day_label": "<e.g. Day 1 - March 18>",\n'
        '      "focus": "<one sentence describing the day\'s focus>",\n'
        '      "concepts": ["<concept>", "<concept>"]\n'
        "    }\n"
        "  ]\n"
        "}"
    )

    return call_gemini_json(prompt)


def _get_or_generate(user_id: str, course: str, exam_id: str) -> dict:
    """Return cached guide or generate, cache, and return a new one."""
    rows = table("study_guides").select(
        "*",
        filters={
            "user_id": f"eq.{user_id}",
            "course": f"eq.{course}",
            "exam_id": f"eq.{exam_id}",
        },
        limit=1,
    )
    if rows:
        return {"guide": json.loads(rows[0]["content"]), "generated_at": rows[0]["generated_at"]}

    # Cache miss — look up exam and generate
    exam_rows = table("assignments").select(
        "id,title,due_date",
        filters={"id": f"eq.{exam_id}", "user_id": f"eq.{user_id}"},
        limit=1,
    )
    if not exam_rows:
        raise HTTPException(status_code=404, detail="Exam not found.")

    guide = _generate_guide(user_id, course, exam_rows[0])
    now = datetime.now(timezone.utc).isoformat()
    content_str = json.dumps(guide)

    try:
        table("study_guides").upsert(
            {
                "user_id": user_id,
                "course": course,
                "exam_id": exam_id,
                "generated_at": now,
                "content": content_str,
            },
            on_conflict="user_id,course,exam_id",
        )
    except Exception:
        logger.exception("Failed to cache study guide for user=%s course=%s exam=%s", user_id, course, exam_id)

    return {"guide": guide, "generated_at": now}


def _regenerate_in_background(user_id: str, course: str, exam_id: str) -> None:
    """Called from a daemon thread — regenerate and overwrite cached guide."""
    try:
        exam_rows = table("assignments").select(
            "id,title,due_date",
            filters={"id": f"eq.{exam_id}", "user_id": f"eq.{user_id}"},
            limit=1,
        )
        if not exam_rows:
            return

        guide = _generate_guide(user_id, course, exam_rows[0])
        now = datetime.now(timezone.utc).isoformat()
        table("study_guides").upsert(
            {
                "user_id": user_id,
                "course": course,
                "exam_id": exam_id,
                "generated_at": now,
                "content": json.dumps(guide),
            },
            on_conflict="user_id,course,exam_id",
        )
        logger.info("Regenerated study guide: user=%s course=%s exam=%s", user_id, course, exam_id)
    except Exception:
        logger.exception("Background study guide regen failed: user=%s course=%s exam=%s", user_id, course, exam_id)


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/{user_id}/courses")
def list_courses(user_id: str):
    """Return distinct courses the user has assignments or graph nodes for."""
    courses: set[str] = set()

    # Courses from assignments
    assignment_rows = table("assignments").select(
        "course_name", filters={"user_id": f"eq.{user_id}"}
    )
    for row in assignment_rows:
        name = row.get("course_name")
        if name:
            courses.add(name)

    # Courses from graph nodes (subject column)
    node_rows = table("graph_nodes").select(
        "subject", filters={"user_id": f"eq.{user_id}"}
    )
    for row in node_rows:
        subj = row.get("subject")
        if subj:
            courses.add(subj)

    return {"courses": sorted(courses)}


@router.get("/{user_id}/exams")
def list_exams(user_id: str, course: str = Query(...)):
    """Return exam-like assignments for this user+course."""
    rows = table("assignments").select(
        "id,title,due_date",
        filters={"user_id": f"eq.{user_id}", "course_name": f"eq.{course}"},
        order="due_date.asc",
    )
    exams = [{"id": r["id"], "title": r["title"], "due_date": r.get("due_date")} for r in rows if _is_exam(r)]
    return {"exams": exams}


@router.get("/{user_id}/guide")
def get_guide(
    user_id: str,
    course: str = Query(...),
    exam_id: str = Query(...),
):
    """Return cached study guide or generate one on-demand."""
    return _get_or_generate(user_id, course, exam_id)


@router.post("/regenerate")
def regenerate_guide(body: RegenerateStudyGuideBody):
    """Overwrite the cached guide for this user+course+exam combo."""
    exam_rows = table("assignments").select(
        "id,title,due_date",
        filters={"id": f"eq.{body.exam_id}", "user_id": f"eq.{body.user_id}"},
        limit=1,
    )
    if not exam_rows:
        raise HTTPException(status_code=404, detail="Exam not found.")

    guide = _generate_guide(body.user_id, body.course, exam_rows[0])
    now = datetime.now(timezone.utc).isoformat()
    table("study_guides").upsert(
        {
            "user_id": body.user_id,
            "course": body.course,
            "exam_id": body.exam_id,
            "generated_at": now,
            "content": json.dumps(guide),
        },
        on_conflict="user_id,course,exam_id",
    )
    return {"success": True, "generated_at": now, "guide": guide}


def trigger_regen_for_course(user_id: str, course_name: str) -> None:
    """
    Fire-and-forget: regenerate study guides for all exams in a course.
    Runs in a daemon thread so it never blocks the caller's response.
    """
    def _run():
        try:
            rows = table("assignments").select(
                "id,title,due_date,assignment_type",
                filters={"user_id": f"eq.{user_id}", "course_name": f"eq.{course_name}"},
                order="due_date.asc",
            )
            exam_rows = [r for r in rows if _is_exam(r)]
            for exam in exam_rows:
                _regenerate_in_background(user_id, course_name, exam["id"])
        except Exception:
            logger.exception("trigger_regen_for_course failed: user=%s course=%s", user_id, course_name)

    threading.Thread(target=_run, daemon=True).start()
