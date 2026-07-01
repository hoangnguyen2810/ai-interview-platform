from fastapi import APIRouter, HTTPException

from app.core import sessions

router = APIRouter()


@router.post("/sessions")
def create_session():
    """Create a new interview session and return session_id."""
    sid = sessions.create_session()
    return {"session_id": sid}


@router.get("/sessions/{session_id}")
def get_session(session_id: str):
    """Inspect a session (debug). Returns 404 if not found."""
    if not sessions.has_session(session_id):
        raise HTTPException(status_code=404, detail="session not found")
    sess = sessions.get_session(session_id)
    return {
        "session_id": session_id,
        "cv_filename": sess.get("cv_filename", ""),
        "cv_chars": len(sess.get("cv", "")),
        "analysis_chars": len(sess.get("analysis", "")),
        "history_len": len(sess.get("history", [])),
    }


@router.delete("/sessions/{session_id}")
def delete_session(session_id: str):
    """Delete a session (start over)."""
    if not sessions.delete_session(session_id):
        raise HTTPException(status_code=404, detail="session not found")
    return {"success": True, "session_id": session_id}
