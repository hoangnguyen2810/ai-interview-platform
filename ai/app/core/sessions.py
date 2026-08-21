"""In-memory session store for chat + CV context.

Stores per-session data in a plain Python dict. No database, no Redis.
Each session is identified by a string session_id (UUID recommended).
"""

import uuid
from typing import TypedDict


MAX_HISTORY = 30  # keep last 20 messages per session


class SessionData(TypedDict, total=False):
    cv: str                # markdown content of uploaded CV
    cv_filename: str       # original filename
    analysis: str          # AI analysis of CV
    history: list[dict]    # list of {"role": "user" | "ai", "content": str}


sessions: dict[str, SessionData] = {}


def create_session() -> str:
    sid = str(uuid.uuid4())
    sessions[sid] = SessionData(
        cv="",
        cv_filename="",
        analysis="",
        history=[],
    )
    return sid


def get_session(session_id: str) -> SessionData | None:
    return sessions.get(session_id)


def has_session(session_id: str) -> bool:
    return session_id in sessions


def delete_session(session_id: str) -> bool:
    return sessions.pop(session_id, None) is not None


def set_cv(session_id: str, filename: str, markdown: str, analysis: str) -> None:
    if session_id not in sessions:
        sessions[session_id] = SessionData(cv="", cv_filename="", analysis="", history=[])
    sess = sessions[session_id]
    sess["cv"] = markdown
    sess["cv_filename"] = filename
    sess["analysis"] = analysis


def append_history(session_id: str, role: str, content: str) -> None:
    sess = sessions[session_id]
    sess["history"].append({"role": role, "content": content})
    # Keep only the last MAX_HISTORY messages
    if len(sess["history"]) > MAX_HISTORY:
        sess["history"] = sess["history"][-MAX_HISTORY:]


def get_recent_history(session_id: str) -> list[dict]:
    sess = sessions[session_id]
    return list(sess["history"][-MAX_HISTORY:])
