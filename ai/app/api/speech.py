"""POST /speech-to-text — transcribe an audio blob using faster-whisper."""

from fastapi import APIRouter, UploadFile, File, Form, HTTPException

from app.services import speech_service

router = APIRouter()

# Default language — change to "en" if your interviews are in English
DEFAULT_LANGUAGE = "vi"


@router.post("/speech-to-text")
async def speech_to_text(
    file: UploadFile = File(...),
    language: str | None = Form(default=None),
):
    """
    Accept an audio file (typically audio/webm from MediaRecorder) and
    return the transcribed text.

    Form fields:
      - file   — audio blob (required)
      - language — BCP-47 tag e.g. "vi", "en" (optional, default: "vi")
    """
    if not file.filename and not file.content_type:
        raise HTTPException(status_code=400, detail="No audio file provided.")

    try:
        audio_bytes = await file.read()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Cannot read audio: {e}") from e

    if len(audio_bytes) == 0:
        raise HTTPException(status_code=400, detail="Audio file is empty.")

    # sanity upper bound — 60 seconds of audio at 128 kbps ≈ 960 KiB
    MAX_BYTES = 10 * 1024 * 1024  # 10 MiB
    if len(audio_bytes) > MAX_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"Audio too large ({len(audio_bytes) // 1024} KiB). Max {MAX_BYTES // 1024} KiB.",
        )

    lang = language or DEFAULT_LANGUAGE

    try:
        result = speech_service.transcribe_blob(audio_bytes, language=lang)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Transcription failed: {e}",
        ) from e

    return {
        "text": result.text,
        "language": result.language,
        "duration": result.duration,
    }
