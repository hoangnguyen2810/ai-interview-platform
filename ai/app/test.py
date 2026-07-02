from faster_whisper import WhisperModel

print("Loading model...")

model = WhisperModel(
    "base",
    device="cuda",
    compute_type="int8"
)

print("Model loaded successfully!")