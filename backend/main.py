from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import FRONTEND_URL, PORT
from routes import graph, learn, quiz, calendar, social, extract, auth

app = FastAPI(title="Sapling API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL, "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(graph.router,    prefix="/api/graph")
app.include_router(learn.router,    prefix="/api/learn")
app.include_router(quiz.router,     prefix="/api/quiz")
app.include_router(calendar.router, prefix="/api/calendar")
app.include_router(social.router,   prefix="/api/social")
app.include_router(extract.router,  prefix="/api/extract")
app.include_router(auth.router,     prefix="/api/auth")


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "sapling-backend"}


@app.get("/api/users")
def list_users():
    from db.connection import table
    rows = table("users").select("id,name,room_id", order="name.asc")
    return {"users": [{"id": r["id"], "name": r["name"], "room_id": r.get("room_id")} for r in rows]}


@app.get("/api/gemini-test")
def gemini_test():
    """Test Gemini connectivity. Shows clear error if API key is missing/wrong."""
    from services.gemini_service import call_gemini
    try:
        reply = call_gemini('Reply with exactly the text: Gemini OK', retries=0)
        return {"ok": True, "reply": reply.strip()}
    except Exception as e:
        return {"ok": False, "error": str(e)}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=PORT, reload=True)
