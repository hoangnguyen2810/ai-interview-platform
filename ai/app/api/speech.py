"""POST /speech-to-text — transcribe an audio blob using faster-whisper."""

import logging
import time

from fastapi import APIRouter, UploadFile, File, Form, HTTPException

from app.services import speech_service

router = APIRouter()
logger = logging.getLogger("speech_api")

DEFAULT_LANGUAGE = "vi"


@router.post("/speech-to-text")
async def speech_to_text(
    file: UploadFile = File(...),
    language: str | None = Form(default=None),
    initial_prompt: str | None = Form(default=None),
):
    """Accept an audio file and return the transcribed text."""
    t0 = time.perf_counter()
    if not file.filename and not file.content_type:
        raise HTTPException(status_code=400, detail="No audio file provided.")

    try:
        audio_bytes = await file.read()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Cannot read audio: {e}") from e

    if len(audio_bytes) == 0:
        raise HTTPException(status_code=400, detail="Audio file is empty.")

    MAX_BYTES = 10 * 1024 * 1024
    if len(audio_bytes) > MAX_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"Audio too large ({len(audio_bytes) // 1024} KiB). Max {MAX_BYTES // 1024} KiB.",
        )

    lang = language or DEFAULT_LANGUAGE

    logger.info(
        "[speech-to-text] audio_bytes=%d lang=%s prompt_chars=%d",
        len(audio_bytes),
        lang,
        len(initial_prompt) if initial_prompt else 0,
    )

    try:
        result = speech_service.transcribe_blob(
            audio_bytes,
            language=lang,
            initial_prompt=initial_prompt,
        )
    except Exception as e:
        logger.exception("[speech-to-text] transcription error")
        raise HTTPException(
            status_code=500,
            detail=f"Transcription failed: {e}",
        ) from e

    elapsed_ms = (time.perf_counter() - t0) * 1000
    logger.info(
        "[speech-to-text] OK elapsed=%.1fms text_chars=%d",
        elapsed_ms,
        len(result.text),
    )

    return {
        "text": result.text,
        "language": result.language,
        "duration": result.duration,
    }
