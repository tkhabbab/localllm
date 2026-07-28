#!/usr/bin/env bash
set -euo pipefail

COMPOSE="docker compose"

# Check if docker compose v2 is available, fall back to v1
if ! docker compose version &>/dev/null 2>&1; then
  COMPOSE="docker-compose"
fi

case "${1:-help}" in
  build)
    echo "Building all images..."
    $COMPOSE build
    echo "Build complete."
    ;;
  up)
    echo "Starting services..."
    $COMPOSE up -d
    echo ""
    echo "Services started. Checking status..."
    sleep 3
    $COMPOSE ps
    echo ""
    echo "Frontend: http://$(hostname -I 2>/dev/null | awk '{print $1}' || echo 'localhost'):${FRONTEND_PORT:-19853}"
    echo "Backend:  http://$(hostname -I 2>/dev/null | awk '{print $1}' || echo 'localhost'):${BACKEND_PORT:-27492}/api/health"
    ;;
  down)
    echo "Stopping services..."
    $COMPOSE down
    echo "Services stopped."
    ;;
  logs)
    $COMPOSE logs -f --tail=100 "${@:2}"
    ;;
  restart)
    echo "Restarting services..."
    $COMPOSE restart "${@:2}"
    ;;
  status)
    $COMPOSE ps
    ;;
  rebuild)
    echo "Rebuilding and restarting..."
    $COMPOSE down
    $COMPOSE build --no-cache
    $COMPOSE up -d
    echo "Rebuild complete."
    ;;
  help|*)
    echo "AI Deploy Script"
    echo ""
    echo "Usage: ./deploy.sh <command>"
    echo ""
    echo "Commands:"
    echo "  build    Build all Docker images"
    echo "  up       Start all services (detached)"
    echo "  down     Stop all services"
    echo "  logs     Tail logs (optionally specify service: ./deploy.sh logs backend)"
    echo "  restart  Restart services"
    echo "  status   Show service status"
    echo "  rebuild  Full rebuild (down + build --no-cache + up)"
    echo "  help     Show this help"
    ;;
esac
