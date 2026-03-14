from typing import Optional, Union
from pydantic import BaseModel


# ── Learn ─────────────────────────────────────────────────────────────────────

class StartSessionBody(BaseModel):
    user_id: str = "user_andres"
    topic: str = ""
    mode: str = "socratic"
    use_shared_context: bool = True


class ChatBody(BaseModel):
    session_id: str
    user_id: str = "user_andres"
    message: str
    mode: str = "socratic"
    use_shared_context: bool = True


class EndSessionBody(BaseModel):
    session_id: str


class ActionBody(BaseModel):
    session_id: str
    user_id: str = "user_andres"
    action_type: str = "hint"
    mode: str = "socratic"
    use_shared_context: bool = True


class ModeSwitchBody(BaseModel):
    session_id: str
    user_id: str = "user_andres"
    new_mode: str


# ── Quiz ──────────────────────────────────────────────────────────────────────

class GenerateQuizBody(BaseModel):
    user_id: str = "user_andres"
    concept_node_id: str
    num_questions: int = 5
    difficulty: str = "medium"
    use_shared_context: bool = True


class AnswerItem(BaseModel):
    question_id: Union[int, str]
    selected_label: str


class SubmitQuizBody(BaseModel):
    quiz_id: str
    answers: list[AnswerItem]


# ── Calendar ──────────────────────────────────────────────────────────────────

class AssignmentItem(BaseModel):
    title: str
    course_name: str = ""
    due_date: str
    assignment_type: str = "other"
    notes: Optional[str] = None


class SaveAssignmentsBody(BaseModel):
    user_id: str = "user_andres"
    assignments: list[AssignmentItem]


class StudyBlockBody(BaseModel):
    user_id: str = "user_andres"


class SyncBody(BaseModel):
    user_id: str = "user_andres"


class ImportSaveBody(BaseModel):
    """
    Used when the user selects Google Calendar events they want saved
    as Sapling assignments. The frontend maps Google event fields to
    AssignmentItem shape before posting here.
    """
    assignments: list[AssignmentItem]


# ── Social ────────────────────────────────────────────────────────────────────

class CreateRoomBody(BaseModel):
    user_id: str = "user_andres"
    room_name: str = "Study Room"


class JoinRoomBody(BaseModel):
    user_id: str = "user_andres"
    invite_code: str


class MatchBody(BaseModel):
    user_id: str = "user_andres"


class ExportBody(BaseModel):
    # No default — caller must always supply the real user_id.
    # Prevents accidental exports under the wrong account.
    user_id: str
    assignment_ids: list[str]