"""Speech-to-Text service powered by faster-whisper.

Loads the model lazily on first call to avoid startup overhead.
"""

from __future__ import annotations

import os
import tempfile
from dataclasses import dataclass

# faster-whisper is an optional dependency — fail fast with a clear message
try:
    from faster_whisper import WhisperModel
except ImportError as _exc:  # pragma: no cover
    raise ImportError(
        "faster-whisper is required for speech-to-text. "
        "Install it with: pip install faster-whisper"
    ) from _exc


@dataclass
class TranscriptionResult:
    text: str
    language: str | None
    duration: float | None


# ─── Model singleton ──────────────────────────────────────────────────────────

_MODEL: WhisperModel | None = None
_MODEL_PATH: str | None = None
_COMPUTE_TYPE: str | None = None


def _default_compute_type() -> str:
    # Prefer CUDA if available
    try:
        import torch  # type: ignore[import-not-found]
        if torch.cuda.is_available():
            return "float16"
    except ImportError:
        pass
    return "int8"


def _default_model_path() -> str:
    env = os.environ.get("WHISPER_MODEL", "")
    if env:
        return env
    return "base"  # tiny|base|small|medium — change to suit your hardware


def get_model(
    model: str | None = None,
    compute_type: str | None = None,
) -> WhisperModel:
    """Return a cached WhisperModel, initialising it on first call.

    Args:
        model: HuggingFace model identifier or local path.
               Defaults to env var WHISPER_MODEL or "base".
        compute_type: "float16" | "int8" | "int8_float16" | "float32".
                      Defaults to "float16" if CUDA is available, else "int8".
    """
    global _MODEL, _MODEL_PATH, _COMPUTE_TYPE

    resolved_model = model or _MODEL_PATH or _default_model_path()
    resolved_compute = (
        compute_type
        or _COMPUTE_TYPE
        or _default_compute_type()
    )

    if _MODEL is None or _MODEL_PATH != resolved_model or _COMPUTE_TYPE != resolved_compute:
        _MODEL_PATH = resolved_model
        _COMPUTE_TYPE = resolved_compute
        _MODEL = WhisperModel(
            resolved_model,
            compute_type=resolved_compute,
            device="cuda" if resolved_compute == "float16" else "cpu",
        )

    return _MODEL


def transcribe(
    audio_path: str,
    model: str | None = None,
    language: str | None = "vi",
    task: str = "transcribe",
) -> TranscriptionResult:
    """Run Whisper inference on an audio file and return structured output.

    Args:
        audio_path: Absolute path to an audio file (wav, mp3, webm, ogg, …).
        model: Override the default Whisper model.
        language: BCP-47 language tag, e.g. "vi", "en". None = auto-detect.
        task: "transcribe" (default) or "translate".

    Returns:
        TranscriptionResult with text, detected language, and audio duration.
    """
    whisper = get_model(model=model)

    segments, info = whisper.transcribe(
        audio=audio_path,
        language=language if language else None,
        task=task,
        beam_size=5,
        vad_filter=True,      # voice activity detection — skip silence
        vad_parameters=dict(min_silence_duration_ms=500),
    )

    # Consume generator so info is populated
    text_parts: list[str] = []
    for segment in segments:
        text_parts.append(segment.text)

    return TranscriptionResult(
        text="".join(text_parts).strip(),
        language=info.language if hasattr(info, "language") else None,
        duration=info.duration if hasattr(info, "duration") else None,
    )


def transcribe_blob(audio_bytes: bytes, language: str | None = "vi") -> TranscriptionResult:
    """Transcribe from raw bytes by writing a temp file.

    The caller is responsible for ensuring the bytes are a valid audio format
    that faster-whisper can decode (wav, webm, mp3, ogg, flac, …).
    """
    fd, tmp_path = tempfile.mkstemp(suffix=".webm")
    try:
        with os.fdopen(fd, "wb") as f:
            f.write(audio_bytes)
        return transcribe(tmp_path, language=language)
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
