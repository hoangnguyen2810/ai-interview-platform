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
        raise HTTPException(
            status_code=400,
            detail="Không tìm thấy file."
        )

    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=400,
            detail="Chỉ hỗ trợ file PDF."
        )

    if not session_store.has_session(session_id):
        raise HTTPException(
            status_code=404,
            detail="session not found"
        )

    save_path = os.path.join(
        UPLOAD_FOLDER,
        file.filename
    )

    try:

        # Lưu file
        with open(save_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # PDF -> Markdown
        markdown = pymupdf4llm.to_markdown(save_path)

        # Giới hạn độ dài để AI xử lý nhanh hơn
        markdown = markdown[:MAX_MARKDOWN_LENGTH]

        # Gọi Ollama
        response = ollama.chat(
            model="qwen2.5:3b-instruct",
            messages=[
                {
                    "role": "system",
                    "content": CV_PROMPT
                },
                {
                    "role": "user",
                    "content": markdown
                }
            ],
            options={
                "temperature": 0.2,
                "top_p": 0.9,
                "num_ctx": 4096,
                "num_predict": 500
            },
            keep_alive="30m"
        )

        raw_analysis = response["message"]["content"]
        analysis_text = clean_response(raw_analysis)  # chuẩn hóa định dạng trước khi lưu

        # Store CV + analysis in session memory
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
            "analysis": analysis_text
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

    finally:
        # Xóa file sau khi xử lý
        if os.path.exists(save_path):
            os.remove(save_path)