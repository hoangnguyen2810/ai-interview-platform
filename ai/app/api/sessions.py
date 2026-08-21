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


@router.get("/sessions/{session_id}/cv-context")
def get_cv_context(session_id: str):
    """Return a prompt-friendly string with key CV/JD terms for Whisper initial_prompt.

    Extracts skills, technologies, and relevant keywords from the session CV
    to help the speech model recognise domain-specific terminology.
    """
    if not sessions.has_session(session_id):
        raise HTTPException(status_code=404, detail="session not found")

    cv_text = sessions.get_session(session_id).get("cv", "")

    if not cv_text:
        return {"prompt": ""}

    # Lightweight extraction: collect lines containing technical keywords.
    # Dừng sớm khi đủ MAX_KEYWORDS, bỏ qua dòng rỗng và dòng quá dài/ngắn.
    MAX_KEYWORDS = 25
    keywords: list[str] = []
    for line in cv_text.splitlines():
        if len(keywords) >= MAX_KEYWORDS:
            break
        stripped = line.strip()
        if not stripped:
            continue
        if 3 <= len(stripped) <= 300:
            keywords.append(stripped)

    combined = " | ".join(keywords)
    if len(combined) > 2000:
        combined = combined[:2000]

    return {"prompt": combined}