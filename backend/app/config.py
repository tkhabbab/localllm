from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@postgres:49532/ai_platform"
    REDIS_URL: str = "redis://redis:38921/0"
    OLLAMA_BASE_URL: str = "http://10.101.66.11:11435"
    QDRANT_HOST: str = "qdrant"
    QDRANT_PORT: int = 57388
    JWT_SECRET: str = "change-me-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRY_HOURS: int = 24
    UPLOAD_DIR: str = "/app/uploads"

    MODEL_GENERAL: str = "qwen3:8b-fp16"
    MODEL_COMPLEX: str = "qwen3:32b-fp16"
    MODEL_CODING: str = "qwen2.5-coder:32b-instruct-fp16"
    MODEL_EMBEDDINGS: str = "bge-m3:latest"
    MODEL_FAST: str = "qwen3:4b-fp16"

    RATE_LIMIT_PER_MINUTE: int = 20

    model_config = {"env_file": ".env", "extra": "ignore"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
