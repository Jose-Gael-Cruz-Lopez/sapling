"""
backend/routes/documents.py

Document upload, AI processing, and library storage.
"""

import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Body, File, Form, HTTPException, UploadFile

from db.connection import table
from services.extraction_service import extract_text_from_file
from services.gemini_service import call_gemini_json
from services.calendar_service import extract_assignments_from_file, save_assignments_to_db
from routes.study_guide import trigger_regen_for_course

logger = logging.getLogger(__name__)

router = APIRouter()

MAX_FILE_SIZE = 15 * 1024 * 1024  # 15 MB

ALLOWED_EXTENSIONS = {".pdf", ".docx", ".pptx"}
ALLOWED_CONTENT_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
}

VALID_CATEGORIES = {
    "syllabus", "lecture_notes", "slides", "reading",
    "assignment", "study_guide", "other",
}


def _validate_user(user_id: str) -> None:
    """Verify that the user_id corresponds to an existing user."""
    rows = table("users").select("id", filters={"id": f"eq.{user_id}"}, limit=1)
    if not rows:
        raise HTTPException(status_code=403, detail="Invalid user.")


def _classify_and_summarize(filename: str, extracted_text: str) -> dict:
    prompt = (
        f"You are processing a student document titled '{filename}'.\n"
        f"Content: {extracted_text[:12000]}\n"
        "Return ONLY valid JSON with no markdown or backticks:\n"
        "{\n"
        '  "category": one of ["syllabus","lecture_notes","slides","reading","assignment","study_guide","other"],\n'
        '  "summary": "2-3 sentence overview of the document",\n'
        '  "key_takeaways": ["...", "..."],\n'
        '  "flashcards": [{"question": "...", "answer": "..."}]\n'
        "}"
    )
    result = call_gemini_json(prompt)
    # Sanitize category in case Gemini returns something unexpected
    if result.get("category") not in VALID_CATEGORIES:
        result["category"] = "other"
    return result


@router.get("/user/{user_id}")
def list_documents(user_id: str):
    _validate_user(user_id)
    docs = table("documents").select("*", filters={"user_id": f"eq.{user_id}"}, order="created_at.desc")
    return {"documents": docs}


@router.delete("/doc/{document_id}")
def delete_document(document_id: str, user_id: str | None = None):
    if user_id:
        _validate_user(user_id)
        # Ensure the document belongs to the requesting user
        docs = table("documents").select("id", filters={"id": f"eq.{document_id}", "user_id": f"eq.{user_id}"}, limit=1)
        if not docs:
            raise HTTPException(status_code=404, detail="Document not found.")
    table("documents").delete(filters={"id": f"eq.{document_id}"})
    return {"deleted": True}


@router.patch("/doc/{document_id}")
def update_document(document_id: str, body: dict = Body(...)):
    """Update mutable fields on a document (currently only category)."""
    user_id = body.get("user_id")
    if user_id:
        _validate_user(user_id)
        docs = table("documents").select("id", filters={"id": f"eq.{document_id}", "user_id": f"eq.{user_id}"}, limit=1)
        if not docs:
            raise HTTPException(status_code=404, detail="Document not found.")
    category = body.get("category")
    if category and category not in VALID_CATEGORIES:
        raise HTTPException(status_code=400, detail=f"Invalid category '{category}'.")
    updates = {}
    if category:
        updates["category"] = category
    if not updates:
        raise HTTPException(status_code=400, detail="No valid fields to update.")
    updated = table("documents").update(updates, filters={"id": f"eq.{document_id}"})
    return updated[0] if updated else {"id": document_id, **updates}


@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    course_id: str = Form(...),
    user_id: str = Form(...),
):
    _validate_user(user_id)

    # ── Validation ────────────────────────────────────────────────────────────
    filename = file.filename or ""
    ext = "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

    if ext not in ALLOWED_EXTENSIONS and file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{ext or file.content_type}'. Only PDF, DOCX, and PPTX are accepted.",
        )

    file_bytes = await file.read()

    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail="File exceeds the 15 MB limit. Please upload a smaller file.",
        )

    # ── Text extraction ───────────────────────────────────────────────────────
    extracted_text = extract_text_from_file(file_bytes, filename, file.content_type or "")

    # ── AI classification + summarization ─────────────────────────────────────
    ai = _classify_and_summarize(filename, extracted_text)

    # ── If syllabus: also run assignment extraction ───────────────────────────
    if ai.get("category") == "syllabus":
        try:
            result = extract_assignments_from_file(file_bytes, filename, file.content_type or "")
            assignments = result.get("assignments") or []
            if assignments:
                save_assignments_to_db(user_id, assignments)
        except Exception:
            logger.exception("Assignment extraction failed for '%s' (best-effort)", filename)

    # ── Trigger study guide regeneration for this course (non-blocking) ──────
    try:
        course_rows = table("courses").select(
            "course_name", filters={"id": f"eq.{course_id}"}, limit=1
        )
        if course_rows:
            trigger_regen_for_course(user_id, course_rows[0]["course_name"])
    except Exception:
        logger.debug("Could not trigger study guide regen for course_id=%s", course_id)

    # ── Persist to documents table ────────────────────────────────────────────
    now = datetime.now(timezone.utc).isoformat()
    row = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "course_id": course_id,
        "file_name": filename,
        "category": ai.get("category", "other"),
        "summary": ai.get("summary"),
        "key_takeaways": ai.get("key_takeaways"),
        "flashcards": ai.get("flashcards"),
        "created_at": now,
        "processed_at": now,
    }
    inserted = table("documents").insert(row)
    return inserted[0] if inserted else row
