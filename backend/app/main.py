import logging
import ssl
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Disable SSL verification globally for untrusted enterprise certificate proxies
ssl._create_default_https_context = ssl._create_unverified_context

from app.models.database import init_db
from app.services.ollama_client import ollama_client
from app.api.auth import router as auth_router
from app.api.chats import router as chats_router
from app.api.documents import router as documents_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    logging.getLogger(__name__).info("Database initialized")
    yield
    await ollama_client.close()


app = FastAPI(
    title="Enterprise AI API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(chats_router)
app.include_router(documents_router)


@app.get("/api/health")
async def health():
    return {"status": "ok"}


@app.get("/api/models")
async def list_models():
    from app.services.ollama_client import ollama_client
    from app.services.router import get_model_display_name
    try:
        resp = await ollama_client._client.get("/api/tags")
        resp.raise_for_status()
        data = resp.json()
        models = []
        for m in data.get("models", []):
            model_id = m.get("name")
            if "bge-m3" in model_id:
                continue
            models.append({
                "id": model_id,
                "name": get_model_display_name(model_id),
                "type": "custom"
            })
        return {"models": models}
    except Exception as e:
        from app.config import get_settings
        settings = get_settings()
        models = [
            {"id": settings.MODEL_GENERAL, "name": get_model_display_name(settings.MODEL_GENERAL), "type": "general"},
            {"id": settings.MODEL_COMPLEX, "name": get_model_display_name(settings.MODEL_COMPLEX), "type": "complex"},
            {"id": settings.MODEL_CODING, "name": get_model_display_name(settings.MODEL_CODING), "type": "coding"},
        ]
        return {"models": models}
