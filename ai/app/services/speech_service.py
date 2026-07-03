"""Speech-to-Text service powered by faster-whisper.

Loads the model lazily on first call to avoid startup overhead.
"""

from __future__ import annotations

import logging
import os
import tempfile
import time
from dataclasses import dataclass

# faster-whisper is an optional dependency — fail fast with a clear message
try:
    from faster_whisper import WhisperModel
except ImportError as _exc:  # pragma: no cover
    raise ImportError(
        "faster-whisper is required for speech-to-text. "
        "Install it with: pip install faster-whisper"
    ) from _exc

logger = logging.getLogger("speech_service")


# ─── Transcription result ────────────────────────────────────────────────────────

@dataclass
class TranscriptionResult:
    text: str
    language: str | None
    duration: float | None


# ─── Model singleton ────────────────────────────────────────────────────────────

_MODEL: WhisperModel | None = None
_MODEL_PATH: str | None = None
_COMPUTE_TYPE: str | None = None


def _default_compute_type() -> str:
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
    return "medium"  # tiny|base|small|medium|large — medium+ for decent Vietnamese accuracy


def get_model(
    model: str | None = None,
    compute_type: str | None = None,
) -> WhisperModel:
    """Return a cached WhisperModel, initialising it on first call."""
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
        logger.info(
            "Loading Whisper model: path=%s compute_type=%s",
            resolved_model,
            resolved_compute,
        )
        _MODEL = WhisperModel(
            resolved_model,
            compute_type=resolved_compute,
            device="cuda" if resolved_compute == "float16" else "cpu",
        )
        logger.info("Whisper model loaded successfully")

    return _MODEL


def transcribe(
    audio_path: str,
    model: str | None = None,
    language: str | None = "vi",
    task: str = "transcribe",
    initial_prompt: str | None = None,
    condition_on_previous_text: bool = True,
) -> TranscriptionResult:
    """Run Whisper inference on an audio file.

    Key accuracy parameters:
      - beam_size=5: beam search with 5 candidates — better than greedy
      - vad_filter=True + min_silence=700ms: skip silent pauses cleanly
      - condition_on_previous_text=True: use prior chunk to maintain coherence
      - initial_prompt: domain context (CV terms, JD terms, etc.)
      - word_timestamps=True: enables better sentence boundary detection
    """
    t0 = time.perf_counter()
    whisper = get_model(model=model)

    segments, info = whisper.transcribe(
        audio=audio_path,
        language=language if language else None,
        task=task,
        beam_size=5,
        best_of=5,
        patience=1.0,
        length_penalty=1.0,
        temperature=(
            0.0, 0.2, 0.4, 0.6, 0.8, 1.0
        ),  # multi-sample with fallback
        condition_on_previous_text=condition_on_previous_text,
        initial_prompt=initial_prompt if initial_prompt else None,
        vad_filter=True,
        vad_parameters=dict(min_silence_duration_ms=700),
        word_timestamps=False,
    )

    text_parts: list[str] = []
    for segment in segments:
        text_parts.append(segment.text)

    elapsed_ms = (time.perf_counter() - t0) * 1000
    detected_lang = info.language if hasattr(info, "language") else None
    detected_prob = info.language_probability if hasattr(info, "language_probability") else None
    audio_dur = info.duration if hasattr(info, "duration") else None

    full_text = "".join(text_parts).strip()

    logger.info(
        "[transcribe] lang=%s lang_prob=%.3f audio_dur=%.2fs "
        "rtf=%.3f text=%r",
        detected_lang,
        detected_prob,
        audio_dur,
        (audio_dur or 1) / (elapsed_ms / 1000),
        full_text[:100],
    )

    return TranscriptionResult(
        text=full_text,
        language=detected_lang,
        duration=audio_dur,
    )


def transcribe_blob(
    audio_bytes: bytes,
    language: str | None = "vi",
    initial_prompt: str | None = None,
    condition_on_previous_text: bool = True,
) -> TranscriptionResult:
    """Transcribe from raw bytes by writing a temp file."""
    fd, tmp_path = tempfile.mkstemp(suffix=".webm")
    try:
        with os.fdopen(fd, "wb") as f:
            f.write(audio_bytes)
        return transcribe(
            tmp_path,
            language=language,
            initial_prompt=initial_prompt,
            condition_on_previous_text=condition_on_previous_text,
        )
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
