from fastapi import APIRouter, UploadFile, File, Form, HTTPException
import os
import shutil
import ollama
import pymupdf4llm

from app.core.prompts import CV_PROMPT
from app.core.text_utils import clean_response
from app.core import sessions as session_store

router = APIRouter()

UPLOAD_FOLDER = "uploads"
MAX_MARKDOWN_LENGTH = 10000

os.makedirs(UPLOAD_FOLDER, exist_ok=True)


@router.post("/cv/upload")
async def upload_cv(
    file: UploadFile = File(...),
    session_id: str = Form(...),
):

    if not file.filename:
        raise HTTPException(status_code=400, detail="Không tìm thấy file.")

    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Chỉ hỗ trợ file PDF.")

    if not session_store.has_session(session_id):
        raise HTTPException(status_code=404, detail="session not found")

    save_path = os.path.join(UPLOAD_FOLDER, file.filename)

    try:
        with open(save_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        markdown = pymupdf4llm.to_markdown(save_path)
        markdown = markdown[:MAX_MARKDOWN_LENGTH]

        response = ollama.chat(
            model="qwen2.5:3b-instruct",
            messages=[
                {"role": "system", "content": CV_PROMPT},
                {"role": "user", "content": markdown},
            ],
            options={
                "temperature": 0.4,       # tăng nhẹ để tránh vòng lặp xác suất cao nhất
                "top_p": 0.9,
                "repeat_penalty": 1.3,    # phạt việc lặp lại token/cụm đã sinh
                "repeat_last_n": 128,     # xét 128 token gần nhất khi tính repeat penalty
                "num_ctx": 4096,
                "num_predict": 350,       # giảm để hạn chế thiệt hại nếu model lặp
            },
            keep_alive="30m",
        )

        raw_analysis = response["message"]["content"]
        analysis_text = clean_response(raw_analysis)

        session_store.set_cv(
            session_id=session_id,
            filename=file.filename,
            markdown=markdown,
            analysis=analysis_text,
        )

        return {
            "success": True,
            "session_id": session_id,
            "filename": file.filename,
            "analysis": analysis_text,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    finally:
        if os.path.exists(save_path):
            os.remove(save_path)