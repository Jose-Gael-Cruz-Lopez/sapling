import uuid
import json
import os
from datetime import datetime

from fastapi import APIRouter, HTTPException

from db.connection import table
from models import StartSessionBody, ChatBody, EndSessionBody, ActionBody, ModeSwitchBody
from services.gemini_service import call_gemini, extract_graph_update
from services.graph_service import get_graph, apply_graph_update

router = APIRouter()

PROMPTS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "prompts")


def _load_prompt(name: str) -> str:
    with open(os.path.join(PROMPTS_DIR, name)) as f:
        return f.read()


PREAMBLE_TEMPLATE = _load_prompt("preamble.txt")
SHARED_CONTEXT_TEMPLATE = _load_prompt("shared_context.txt")
MODE_PROMPTS = {
    "socratic": _load_prompt("socratic.txt"),
    "expository": _load_prompt("expository.txt"),
    "teachback": _load_prompt("teachback.txt"),
}


def _resolve_course(topic: str, user_id: str) -> str:
    """Return the subject/course the topic belongs to, or '' if unknown."""
    if not topic:
        return ""
    # Is the topic itself a subject name?
    subject_match = table("graph_nodes").select(
        "subject", filters={"user_id": f"eq.{user_id}", "subject": f"eq.{topic}"}, limit=1
    )
    if subject_match:
        return topic
    # Is the topic a concept name? Get its subject.
    concept_match = table("graph_nodes").select(
        "subject", filters={"user_id": f"eq.{user_id}", "concept_name": f"eq.{topic}"}, limit=1
    )
    if concept_match:
        return concept_match[0].get("subject") or ""
    # Is the topic itself a registered course name (even if it has no nodes yet)?
    course_match = table("courses").select(
        "course_name", filters={"user_id": f"eq.{user_id}", "course_name": f"eq.{topic}"}, limit=1
    )
    if course_match:
        return topic
    return ""


def _get_session_topic(session_id: str) -> str:
    rows = table("sessions").select("topic", filters={"id": f"eq.{session_id}"}, limit=1)
    return rows[0]["topic"] if rows else ""


def build_system_prompt(
    mode: str,
    student_name: str,
    graph_json: str,
    last_summary: str = "",
    course_name: str = "",
    use_shared_context: bool = True,
) -> str:
    from services.course_context_service import get_course_context

    preamble = PREAMBLE_TEMPLATE.replace("{student_name}", student_name)
    preamble = preamble.replace("{graph_json}", graph_json)
    preamble = preamble.replace("{last_session_summary}", last_summary or "None")

    parts = [preamble]

    if use_shared_context and course_name:
        ctx = get_course_context(course_name)
        if ctx:
            shared_block = (
                SHARED_CONTEXT_TEMPLATE
                .replace("{course_name}", course_name)
                .replace("{shared_context_json}", json.dumps(ctx, indent=2))
            )
            parts.append(shared_block)

    parts.append(MODE_PROMPTS.get(mode, MODE_PROMPTS["socratic"]))
    return "\n\n".join(parts)


def get_conversation_history(session_id: str) -> list:
    rows = table("messages").select(
        "role,content",
        filters={"session_id": f"eq.{session_id}"},
        order="created_at.asc",
    )
    return [{"role": r["role"], "content": r["content"]} for r in rows]


def format_history_for_prompt(history: list) -> str:
    parts = []
    for msg in history:
        role = "Student" if msg["role"] == "user" else "Sapling"
        parts.append(f"{role}: {msg['content']}")
    return "\n\n".join(parts)


def save_message(session_id: str, role: str, content: str, graph_update: dict = None):
    table("messages").insert({
        "id": str(uuid.uuid4()),
        "session_id": session_id,
        "role": role,
        "content": content,
        "graph_update_json": graph_update if graph_update else None,
        "created_at": datetime.utcnow().isoformat(),
    })


def get_user_name(user_id: str) -> str:
    rows = table("users").select("name", filters={"id": f"eq.{user_id}"})
    return rows[0]["name"] if rows else "Student"


@router.post("/start-session")
def start_session(body: StartSessionBody):
    session_id = str(uuid.uuid4())
    table("sessions").insert({
        "id": session_id,
        "user_id": body.user_id,
        "mode": body.mode,
        "topic": body.topic,
    })

    student_name = get_user_name(body.user_id)
    graph_data = get_graph(body.user_id)
    course_name = _resolve_course(body.topic, body.user_id)
    system_prompt = build_system_prompt(
        body.mode, student_name, json.dumps(graph_data, indent=2),
        course_name=course_name, use_shared_context=body.use_shared_context,
    )
    full_prompt = (
        f"{system_prompt}\n\n"
        f"Student wants to learn about: {body.topic}\n\n"
        "Begin the session with a warm greeting and your first question or explanation."
    )

    try:
        raw = call_gemini(full_prompt)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Gemini error: {e}")

    reply, graph_update = extract_graph_update(raw)
    save_message(session_id, "assistant", reply, graph_update)
    apply_graph_update(body.user_id, graph_update)

    return {
        "session_id": session_id,
        "initial_message": reply,
        "graph_state": get_graph(body.user_id),
    }


@router.post("/chat")
def chat(body: ChatBody):
    save_message(body.session_id, "user", body.message)

    student_name = get_user_name(body.user_id)
    graph_data = get_graph(body.user_id)
    history = get_conversation_history(body.session_id)
    history_text = format_history_for_prompt(history[:-1])
    topic = _get_session_topic(body.session_id)
    course_name = _resolve_course(topic, body.user_id)
    system_prompt = build_system_prompt(
        body.mode, student_name, json.dumps(graph_data, indent=2),
        course_name=course_name, use_shared_context=body.use_shared_context,
    )

    full_prompt = (
        f"{system_prompt}\n\n"
        f"CONVERSATION SO FAR:\n{history_text}\n\n"
        f"Student: {body.message}\n\nSapling:"
    )

    try:
        raw = call_gemini(full_prompt)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Gemini error: {e}")

    reply, graph_update = extract_graph_update(raw)
    save_message(body.session_id, "assistant", reply, graph_update)
    mastery_changes = apply_graph_update(body.user_id, graph_update)

    return {"reply": reply, "graph_update": graph_update, "mastery_changes": mastery_changes}


@router.post("/end-session")
def end_session(body: EndSessionBody):
    session_rows = table("sessions").select(
        "user_id,started_at",
        filters={"id": f"eq.{body.session_id}"},
    )
    if not session_rows:
        raise HTTPException(status_code=404, detail="Session not found")
    session = session_rows[0]

    table("sessions").update(
        {"ended_at": datetime.utcnow().isoformat()},
        filters={"id": f"eq.{body.session_id}"},
    )

    msgs = table("messages").select(
        "graph_update_json",
        filters={"session_id": f"eq.{body.session_id}"},
    )

    try:
        elapsed_minutes = int(
            (datetime.utcnow() - datetime.fromisoformat(session["started_at"])).total_seconds() / 60
        )
    except Exception:
        elapsed_minutes = 0

    concepts_covered = set()
    for msg in msgs:
        if msg["graph_update_json"]:
            try:
                gu = msg["graph_update_json"]
                if isinstance(gu, str):
                    gu = json.loads(gu)
                for upd in gu.get("updated_nodes", []):
                    concepts_covered.add(upd["concept_name"])
                for nn in gu.get("new_nodes", []):
                    concepts_covered.add(nn["concept_name"])
            except Exception:
                pass

    summary = {
        "concepts_covered": list(concepts_covered),
        "mastery_changes": [],
        "new_connections": [],
        "time_spent_minutes": elapsed_minutes,
        "recommended_next": [],
    }

    table("sessions").update(
        {"summary_json": summary},
        filters={"id": f"eq.{body.session_id}"},
    )
    return {"summary": summary}


@router.get("/sessions/{user_id}")
def list_sessions(user_id: str, limit: int = 10):
    sessions = table("sessions").select(
        "*",
        filters={"user_id": f"eq.{user_id}"},
        order="started_at.desc",
        limit=limit,
    )
    result = []
    for s in sessions:
        msgs = table("messages").select("id", filters={"session_id": f"eq.{s['id']}"})
        result.append({
            "id": s["id"],
            "topic": s["topic"],
            "mode": s["mode"],
            "started_at": s["started_at"],
            "ended_at": s.get("ended_at"),
            "message_count": len(msgs),
            "is_active": s.get("ended_at") is None,
        })
    return {"sessions": result}


@router.get("/sessions/{session_id}/resume")
def resume_session(session_id: str):
    session_rows = table("sessions").select(
        "id,user_id,topic,mode,started_at,ended_at",
        filters={"id": f"eq.{session_id}"},
    )
    if not session_rows:
        raise HTTPException(status_code=404, detail="Session not found")

    msgs = table("messages").select(
        "id,role,content,created_at",
        filters={"session_id": f"eq.{session_id}"},
        order="created_at.asc",
    )
    return {
        "session": session_rows[0],
        "messages": msgs,
    }


MODE_DISPLAY_NAMES = {
    "socratic": "Socratic (question-based)",
    "expository": "Expository (direct explanation)",
    "teachback": "Teach-back (you explain to me)",
}


@router.post("/mode-switch")
def mode_switch(body: ModeSwitchBody):
    student_name = get_user_name(body.user_id).split()[0]
    topic = _get_session_topic(body.session_id)
    mode_label = MODE_DISPLAY_NAMES.get(body.new_mode, body.new_mode)

    reply = (
        f"Got it, {student_name}! Switching to {mode_label} mode. "
        f"We'll continue with {topic}, let's keep going!"
    )
    save_message(body.session_id, "assistant", reply)
    return {"reply": reply}


@router.post("/action")
def action(body: ActionBody):
    action_prompts = {
        "hint": "The student asked for a hint. Give a small scaffold or clue without giving away the answer.",
        "confused": "The student said they are confused. Identify the likely point of confusion and re-explain with a different analogy.",
        "skip": "The student wants to skip this concept. Acknowledge and transition to the next recommended concept.",
    }

    student_name = get_user_name(body.user_id)
    graph_data = get_graph(body.user_id)
    history = get_conversation_history(body.session_id)
    history_text = format_history_for_prompt(history)
    topic = _get_session_topic(body.session_id)
    course_name = _resolve_course(topic, body.user_id)
    system_prompt = build_system_prompt(
        body.mode, student_name, json.dumps(graph_data, indent=2),
        course_name=course_name, use_shared_context=body.use_shared_context,
    )

    full_prompt = (
        f"{system_prompt}\n\n"
        f"CONVERSATION SO FAR:\n{history_text}\n\n"
        f"[ACTION: {action_prompts.get(body.action_type, '')}]\n\nSapling:"
    )

    try:
        raw = call_gemini(full_prompt)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Gemini error: {e}")

    reply, graph_update = extract_graph_update(raw)
    save_message(body.session_id, "assistant", reply, graph_update)
    apply_graph_update(body.user_id, graph_update)
    return {"reply": reply, "graph_update": graph_update}
