from fastapi import FastAPI
from app.api.chat import router as chat_router
from app.api.cv import router as cv_router
from app.api.sessions import router as sessions_router
from app.api.speech import router as speech_router
from app.api.report import router as report_router

app = FastAPI()

app.include_router(chat_router)
app.include_router(cv_router)
app.include_router(sessions_router)
app.include_router(speech_router)
app.include_router(report_router)

@app.get("/")
def root():
    return {"status": "AI server running"}