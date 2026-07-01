from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import ollama

from app.core.prompts import CHAT_PROMPT
from app.core import sessions as session_store

router = APIRouter()


class ChatRequest(BaseModel):
    session_id: str
    message: str


@router.post("/chat")
def chat(req: ChatRequest):
    if not session_store.has_session(req.session_id):
        raise HTTPException(status_code=404, detail="session not found")

    sess = session_store.get_session(req.session_id)

    # Build CV context block
    cv_block_parts: list[str] = []
    if sess.get("cv_filename"):
        cv_block_parts.append(f"Tên file CV: {sess['cv_filename']}")
    if sess.get("analysis"):
        cv_block_parts.append(f"Phân tích CV trước đó:\n{sess['analysis']}")

    cv_block = "\n\n".join(cv_block_parts)

    system_content = CHAT_PROMPT
    if cv_block:
        system_content = (
            f"{CHAT_PROMPT}\n\n---\n\n"
            f"THÔNG TIN ỨNG VIÊN (từ CV đã upload):\n\n{cv_block}\n\n"
            f"Hãy sử dụng thông tin này để trả lời khi ứng viên hỏi về bản thân, "
            f"kỹ năng, hoặc các câu hỏi liên quan đến CV."
        )

    # Build message list: recent history (last 10) + current user message
    history = session_store.get_recent_history(req.session_id)
    ollama_messages = [
        {"role": "system", "content": system_content},
        *history,
        {"role": "user", "content": req.message},
    ]

    res = ollama.chat(
        model="qwen2.5:3b-instruct",
        messages=ollama_messages,
    )

    reply = res["message"]["content"]

    # Persist this turn into session history
    session_store.append_history(req.session_id, "user", req.message)
    session_store.append_history(req.session_id, "ai", reply)

    return {
        "reply": reply,
        "session_id": req.session_id,
        "history_len": len(sess["history"]),
    }
