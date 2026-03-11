# Sapling Backend — Test Suite

All backend tests live here. Tests use **pytest** and mock out Supabase and
Gemini so no live credentials are required (except for the integration tests
marked below).

---

## Quick start

```bash
# From the backend/ directory
cd backend
source venv/bin/activate      # or: fish -c "source venv/bin/activate.fish"

# Run all unit tests (no API key or DB needed)
pytest tests/ -v

# Run a single file
pytest tests/test_graph_service.py -v

# Run a single test
pytest tests/test_quiz_routes.py::TestSubmitQuiz::test_all_correct_returns_full_score -v
```

---

## Test files

| File | What it covers |
|---|---|
| `test_config.py` | `get_mastery_tier()` — all tier boundary values |
| `test_gemini_service.py` | JSON extraction utilities, `extract_graph_update`, `call_gemini` / `call_gemini_json` with mocked client |
| `test_graph_service.py` | `get_graph`, `add_course`, `delete_course`, `apply_graph_update`, `get_recommendations` — all with mocked DB |
| `test_calendar_routes.py` | Calendar route endpoints (`/save`, `/upcoming`, `/suggest-study-blocks`, `/status`, `/disconnect`), OAuth state encoding |
| `test_learn_routes.py` | `format_history_for_prompt`, `_resolve_course`, `/sessions` list and resume endpoints |
| `test_quiz_routes.py` | Mastery scoring formula, `/quiz/submit` grading logic and result shape |
| `test_shared_course_context.py` | Course context service, system prompt building, quiz prompt augmentation |
| `test_ocr_pipeline.py` | **Integration** — calls live Gemini API and writes to Supabase. Requires `.env` |
| `test_supabase.py` | **Connectivity script** — verifies env vars and table access. Run manually: `python tests/test_supabase.py` |

---

## Integration tests

`test_ocr_pipeline.py` makes real Gemini API calls and writes to the DB.
Skip it during CI or when offline:

```bash
pytest tests/ -v --ignore=tests/test_ocr_pipeline.py
```

---

## Adding new tests

- Unit tests (no external deps) → add to the relevant `test_*.py` file, mock
  `db.connection.table` at the module where it's used (e.g.
  `patch("routes.calendar.table")`).
- Integration tests → go in `test_ocr_pipeline.py` or a new
  `test_*_integration.py` file.
