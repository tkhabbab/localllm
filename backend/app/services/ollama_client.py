import httpx
from typing import AsyncGenerator
from app.config import get_settings


class OllamaClient:
    def __init__(self):
        settings = get_settings()
        self.base_url = settings.OLLAMA_BASE_URL.rstrip("/")
        self._client = httpx.AsyncClient(base_url=self.base_url, timeout=300.0)

    async def chat_stream(
        self, model: str, messages: list[dict], temperature: float = 0.7
    ) -> AsyncGenerator[str, None]:
        payload = {
            "model": model,
            "messages": messages,
            "stream": True,
            "keep_alive": -1,
            "options": {
                "temperature": temperature,
                "num_ctx": 8192,
            },
        }
        async with self._client.stream("POST", "/api/chat", json=payload) as resp:
            resp.raise_for_status()
            async for line in resp.aiter_lines():
                if not line:
                    continue
                import json
                chunk = json.loads(line)
                if content := chunk.get("message", {}).get("content", ""):
                    yield content
                if chunk.get("done"):
                    return

    async def chat(
        self, model: str, messages: list[dict], temperature: float = 0.7
    ) -> str:
        payload = {
            "model": model,
            "messages": messages,
            "stream": False,
            "keep_alive": -1,
            "options": {
                "temperature": temperature,
                "num_ctx": 8192,
            },
        }
        resp = await self._client.post("/api/chat", json=payload)
        resp.raise_for_status()
        data = resp.json()
        return data["message"]["content"]

    async def embed(self, text: str | list[str]) -> list[list[float]]:
        if isinstance(text, str):
            text = [text]
        settings = get_settings()
        results = []
        for t in text:
            resp = await self._client.post(
                "/api/embeddings",
                json={"model": settings.MODEL_EMBEDDINGS, "prompt": t},
            )
            resp.raise_for_status()
            results.append(resp.json()["embedding"])
        return results

    async def close(self):
        await self._client.aclose()


ollama_client = OllamaClient()
