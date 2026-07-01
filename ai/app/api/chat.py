from fastapi import APIRouter
from pydantic import BaseModel
import ollama

from app.core.prompts import CHAT_PROMPT

router = APIRouter()

class ChatRequest(BaseModel):
    messages: list[dict]
    system: str | None = None


@router.post("/chat")
def chat(req: ChatRequest):
    system_content = CHAT_PROMPT
    if req.system:
        system_content = f"{CHAT_PROMPT}\n\n---\n\n{req.system}"

    res = ollama.chat(
        model="qwen2.5:3b-instruct",
        messages=[
            {
                "role": "system",
                "content": system_content
            },
            *req.messages
        ]
    )

    return {
        "reply": res["message"]["content"]
    }