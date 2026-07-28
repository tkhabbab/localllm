# Enterprise AI - Deployment Guide

## Prerequisites

- Linux server with Docker and Docker Compose installed
- NVIDIA GPU with drivers installed
- Ollama running on the server with the required models pulled
- Network access to the server over VPN

## Quick Start

### 1. Copy the project to the server

```bash
# Option A: git clone
git clone <your-repo-url> /data/ai-platform
cd /data/ai-platform

# Option B: scp / rsync
scp -r ./Ai_Linux user@10.101.66.11:/data/ai-platform
ssh user@10.101.66.11
cd /data/ai-platform
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and set:
- `POSTGRES_PASSWORD` - a strong database password
- `JWT_SECRET` - a random string (at least 32 characters). Generate one with: `openssl rand -hex 32`
- `OLLAMA_BASE_URL` - should be `http://host.docker.internal:11434` if Ollama runs on the same host

### 3. Make deploy script executable

```bash
chmod +x deploy.sh
```

### 4. Build and start

```bash
./deploy.sh build
./deploy.sh up
```

### 5. Verify services are healthy

```bash
./deploy.sh status
# or
docker compose ps
```

Expected output - all services should show "Up" and "(healthy)":
```
NAME                STATUS
ai-platform-backend     Up (healthy)
ai-platform-frontend    Up
ai-platform-postgres    Up (healthy)
ai-platform-redis       Up (healthy)
ai-platform-qdrant      Up (healthy)
```

### 6. Access the platform

Open in your browser (over VPN):
```
http://10.101.66.11:19853
```

1. Register a new account on the registration page
2. Log in and start chatting

### 7. Test the API directly

```bash
# Health check
curl http://10.101.66.11:27492/api/health

# Check Ollama connectivity (from the server)
curl http://localhost:11434/api/tags
```

## Troubleshooting

### View logs

```bash
# All services
./deploy.sh logs

# Specific service
./deploy.sh logs backend
./deploy.sh logs frontend
./deploy.sh logs postgres
```

### Backend can't reach Ollama

The `extra_hosts` directive in docker-compose.yml maps `host.docker.internal` to the host.
If this doesn't work on your Linux setup, change `OLLAMA_BASE_URL` in `.env` to the server's
LAN IP directly:

```env
OLLAMA_BASE_URL=http://10.101.66.11:11434
```

Then restart:
```bash
./deploy.sh restart backend
```

### Database issues

```bash
# Reset everything (WARNING: deletes all data)
docker compose down -v
./deploy.sh up
```

### Full rebuild

```bash
./deploy.sh rebuild
```

## Updating

```bash
git pull
./deploy.sh rebuild
```

## Verify Ollama models

Ensure these models are pulled on the server:

```bash
ollama list
```

Expected:
```
qwen3:8b-fp16
qwen3:32b-fp16
qwen2.5-coder:32b-instruct-fp16
bge-m3:latest
qwen3:4b-fp16
```

If any are missing:
```bash
ollama pull qwen3:8b-fp16
ollama pull qwen3:32b-fp16
ollama pull qwen2.5-coder:32b-instruct-fp16
ollama pull bge-m3:latest
ollama pull qwen3:4b-fp16
```
