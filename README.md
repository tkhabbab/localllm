# Enterprise AI

A self-hosted, ChatGPT-style AI platform that runs entirely on a private Linux GPU server. Deploys with a single `docker compose up` command.

## Architecture

```
Browser (User over VPN)
   │
   ▼
Next.js 14 (App Router) — Frontend, chat UI, streaming responses (:19853)
   │
   ▼
FastAPI — Backend API, Python 3.11+ (:27492)
   │
   ▼
AI Router (intent classifier)
   ├── "general"     → qwen3:8b-fp16
   ├── "complex"     → qwen3:32b-fp16
   ├── "coding"      → qwen2.5-coder:32b-instruct-fp16
   └── "document_qa" → RAG pipeline → qwen3:32b-fp16
         │
         ├── PaddleOCR (extract text from scanned PDFs/images)
         ├── BGE-M3 (embeddings via Ollama)
         └── Qdrant (vector search)

Supporting Infrastructure (all in Docker Compose):
   ├── PostgreSQL 16  — users, sessions, messages, document metadata
   ├── Redis 7        — caching, rate limiting
   └── Qdrant         — vector database for RAG

Ollama runs directly on the host server (not in Docker).
```

## Features

- **Smart Model Routing**: Automatically selects the best model based on message intent (general chat, complex reasoning, coding, document Q&A)
- **Streaming Responses**: Token-by-token streaming via Server-Sent Events
- **RAG Pipeline**: Upload PDFs/images → OCR → chunking → embeddings → vector search → contextual answers
- **ChatGPT-style UI**: Dark theme, sidebar with session management, markdown rendering, syntax-highlighted code blocks
- **Model Override**: Power users can manually select a specific model instead of auto-routing
- **Auth**: JWT-based authentication with httpOnly cookies

## Project Structure

```
/
├── frontend/                  Next.js 14 (App Router, TypeScript, Tailwind)
│   ├── src/
│   │   ├── app/               Pages (login, register, chat)
│   │   ├── components/        React components (ChatLayout, Sidebar, ChatMessage)
│   │   ├── lib/               API client, utilities
│   │   └── types/             TypeScript types
│   └── Dockerfile
├── backend/
│   ├── app/
│   │   ├── api/               FastAPI routers (auth, chats, documents)
│   │   ├── services/          Business logic
│   │   │   ├── router.py      Intent classifier (heuristic + LLM fallback)
│   │   │   ├── ollama_client.py  Centralized Ollama API wrapper
│   │   │   ├── rag.py         RAG pipeline (ingest, retrieve)
│   │   │   ├── ocr.py         PaddleOCR wrapper
│   │   │   └── auth.py        JWT auth utilities
│   │   ├── models/            SQLAlchemy models + database setup
│   │   ├── schemas/           Pydantic schemas
│   │   └── main.py            FastAPI application entry point
│   ├── Dockerfile
│   └── requirements.txt
├── docker-compose.yml
├── .env.example
├── deploy.sh
├── DEPLOY.md
└── README.md
```

## Local Development

### Backend

```bash
cd backend

# Create a virtual environment
python -m venv venv
source venv/bin/activate  # Linux/Mac
# or: venv\Scripts\activate  # Windows

# Install dependencies
pip install -r requirements.txt

# Set environment variables (or create a .env in backend/)
export DATABASE_URL="postgresql+asyncpg://postgres:postgres@localhost:49532/ai_platform"
export REDIS_URL="redis://localhost:38921/0"
export OLLAMA_BASE_URL="http://10.101.66.11:11434"
export QDRANT_HOST="localhost"
export JWT_SECRET="dev-secret-key"

# Run the dev server
uvicorn app.main:app --reload --host 0.0.0.0 --port 27492
```

### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Set API URL for development proxy
# The next.config.js rewrites /api/* to the backend

# Run the dev server
npm run dev
```

Open http://localhost:19853 in your browser.

### Infrastructure (for local dev)

Run Postgres, Redis, and Qdrant locally with Docker:

```bash
docker run -d --name postgres -p 49532:49532 postgres:16-alpine -p 49532
docker run -d --name redis -p 38921:38921 redis:7-alpine --port 38921
docker run -d --name qdrant -p 57388:57388 -e QDRANT__SERVICE__HTTP_PORT=57388 qdrant/qdrant:latest
```

## Deployment

See [DEPLOY.md](DEPLOY.md) for full deployment instructions.

Quick version:
```bash
cp .env.example .env
# Edit .env with your values
chmod +x deploy.sh
./deploy.sh build
./deploy.sh up
```

## Configuration

All configuration is via environment variables (see `.env.example`):

| Variable | Default | Description |
|---|---|---|
| `OLLAMA_BASE_URL` | `http://host.docker.internal:11434` | Ollama server URL |
| `MODEL_GENERAL` | `qwen3:8b-fp16` | Model for general chat |
| `MODEL_COMPLEX` | `qwen3:32b-fp16` | Model for complex reasoning |
| `MODEL_CODING` | `qwen2.5-coder:32b-instruct-fp16` | Model for coding tasks |
| `MODEL_EMBEDDINGS` | `bge-m3:latest` | Embedding model for RAG |
| `MODEL_FAST` | `qwen3:4b-fp16` | Fast model for classification |
| `JWT_SECRET` | (must set) | Secret key for JWT tokens |
| `POSTGRES_PASSWORD` | `postgres` | Database password |

To swap a model (e.g., upgrade qwen3:32b to a newer version), just update the env var — no code changes needed.
