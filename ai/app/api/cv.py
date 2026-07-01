from fastapi import APIRouter, UploadFile, File, HTTPException
import os
import shutil
import ollama
import pymupdf4llm

from app.core.prompts import CV_PROMPT

router = APIRouter()

UPLOAD_FOLDER = "uploads"
MAX_MARKDOWN_LENGTH = 10000

os.makedirs(UPLOAD_FOLDER, exist_ok=True)


@router.post("/cv/upload")
async def upload_cv(file: UploadFile = File(...)):

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

        return {
            "success": True,
            "filename": file.filename,
            "analysis": response["message"]["content"]
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

    finally:
        # Xóa file sau khi xử lý
        if os.path.exists(save_path):
            os.remove(save_path)