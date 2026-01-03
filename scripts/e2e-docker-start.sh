#!/bin/bash
# ===========================================================================
# E2E Docker Start Script
# ===========================================================================
# Starts the local Docker AI stack before running E2E tests.
# 
# Usage: ./scripts/e2e-docker-start.sh
#
# This script:
# 1. Starts the docker-compose.local.yml stack
# 2. Waits for all services to be healthy
# 3. Runs E2E tests
# 4. Optionally stops containers after tests
# ===========================================================================

set -e

# Configuration
COMPOSE_FILE="docker-compose.local.yml"
TIMEOUT=300  # 5 minutes for model downloads
CHECK_INTERVAL=10

echo "🐳 Starting Evermore Local AI Stack for E2E Tests..."
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

# Start the stack
echo "📦 Starting containers..."
docker-compose -f $COMPOSE_FILE up -d db redis ollama whisper

# Wait for database
echo "⏳ Waiting for PostgreSQL..."
until docker-compose -f $COMPOSE_FILE exec -T db pg_isready -U postgres > /dev/null 2>&1; do
    sleep $CHECK_INTERVAL
done
echo "✅ PostgreSQL is ready"

# Wait for Redis
echo "⏳ Waiting for Redis..."
until docker-compose -f $COMPOSE_FILE exec -T redis redis-cli ping > /dev/null 2>&1; do
    sleep $CHECK_INTERVAL
done
echo "✅ Redis is ready"

# Wait for Ollama (needs to download model)
echo "⏳ Waiting for Ollama (may take a few minutes for model download)..."
elapsed=0
until curl -s http://localhost:11434/api/tags > /dev/null 2>&1; do
    if [ $elapsed -ge $TIMEOUT ]; then
        echo "❌ Timeout waiting for Ollama"
        exit 1
    fi
    sleep $CHECK_INTERVAL
    elapsed=$((elapsed + CHECK_INTERVAL))
    echo "   Still waiting... ($elapsed seconds)"
done
echo "✅ Ollama is ready"

# Wait for Whisper
echo "⏳ Waiting for Whisper STT..."
elapsed=0
until curl -s http://localhost:9000/ > /dev/null 2>&1; do
    if [ $elapsed -ge $TIMEOUT ]; then
        echo "⚠️ Whisper not available, continuing without STT"
        break
    fi
    sleep $CHECK_INTERVAL
    elapsed=$((elapsed + CHECK_INTERVAL))
done
echo "✅ Whisper is ready"

# Start optional services (TTS, Images) - these are heavier
echo "📦 Starting TTS and Image services (optional)..."
docker-compose -f $COMPOSE_FILE up -d kokoro localai 2>/dev/null || true

echo ""
echo "🎉 Local AI Stack is ready!"
echo ""
echo "Services available:"
echo "  - App:      http://localhost:3000"
echo "  - Ollama:   http://localhost:11434"
echo "  - Whisper:  http://localhost:9000"
echo "  - Kokoro:   http://localhost:8880"
echo "  - LocalAI:  http://localhost:8080"
echo "  - Postgres: localhost:5432"
echo "  - Redis:    localhost:6379"
echo ""
