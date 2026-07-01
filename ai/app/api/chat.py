from fastapi import APIRouter
from pydantic import BaseModel
import ollama

from app.core.prompts import CHAT_PROMPT

router = APIRouter()

class ChatRequest(BaseModel):
    message: str


@router.post("/chat")
def chat(req: ChatRequest):
    res = ollama.chat(
        model="qwen2.5:3b-instruct",
        messages=[
            {
                "role": "system",
                "content": CHAT_PROMPT
            },
            {
                "role": "user",
                "content": req.message
            }
        ]
    )

    return {
        "reply": res["message"]["content"]
    }