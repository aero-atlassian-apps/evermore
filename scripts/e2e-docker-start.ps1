# PowerShell E2E Docker Start Script
# ===========================================================================
# Starts the local Docker AI stack before running E2E tests.
# 
# Usage: .\scripts\e2e-docker-start.ps1
# ===========================================================================

$ErrorActionPreference = "Stop"

# Configuration
$COMPOSE_FILE = "docker-compose.local.yml"
$TIMEOUT = 300  # 5 minutes
$CHECK_INTERVAL = 10

Write-Host "🐳 Starting Evermore Local AI Stack for E2E Tests..." -ForegroundColor Cyan
Write-Host ""

# Check if Docker is running
try {
    docker info | Out-Null
} catch {
    Write-Host "❌ Docker is not running. Please start Docker and try again." -ForegroundColor Red
    exit 1
}

# Start the core stack
Write-Host "📦 Starting containers..." -ForegroundColor Yellow
docker-compose -f $COMPOSE_FILE up -d db redis ollama whisper

# Wait for database
Write-Host "⏳ Waiting for PostgreSQL..." -ForegroundColor Yellow
$elapsed = 0
do {
    Start-Sleep -Seconds $CHECK_INTERVAL
    $elapsed += $CHECK_INTERVAL
    $ready = docker-compose -f $COMPOSE_FILE exec -T db pg_isready -U postgres 2>$null
} while ($LASTEXITCODE -ne 0 -and $elapsed -lt $TIMEOUT)
Write-Host "✅ PostgreSQL is ready" -ForegroundColor Green

# Wait for Redis
Write-Host "⏳ Waiting for Redis..." -ForegroundColor Yellow
$elapsed = 0
do {
    Start-Sleep -Seconds $CHECK_INTERVAL
    $elapsed += $CHECK_INTERVAL
    $ready = docker-compose -f $COMPOSE_FILE exec -T redis redis-cli ping 2>$null
} while ($LASTEXITCODE -ne 0 -and $elapsed -lt $TIMEOUT)
Write-Host "✅ Redis is ready" -ForegroundColor Green

# Wait for Ollama
Write-Host "⏳ Waiting for Ollama (may take a few minutes for model download)..." -ForegroundColor Yellow
$elapsed = 0
do {
    Start-Sleep -Seconds $CHECK_INTERVAL
    $elapsed += $CHECK_INTERVAL
    Write-Host "   Still waiting... ($elapsed seconds)" -ForegroundColor Gray
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:11434/api/tags" -TimeoutSec 5 -ErrorAction SilentlyContinue
        if ($response.StatusCode -eq 200) { break }
    } catch { }
} while ($elapsed -lt $TIMEOUT)
Write-Host "✅ Ollama is ready" -ForegroundColor Green

# Wait for Whisper
Write-Host "⏳ Waiting for Whisper STT..." -ForegroundColor Yellow
$elapsed = 0
do {
    Start-Sleep -Seconds $CHECK_INTERVAL
    $elapsed += $CHECK_INTERVAL
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:9000/" -TimeoutSec 5 -ErrorAction SilentlyContinue
        if ($response.StatusCode -eq 200) { break }
    } catch { }
} while ($elapsed -lt $TIMEOUT)
Write-Host "✅ Whisper is ready" -ForegroundColor Green

# Start optional services
Write-Host "📦 Starting TTS and Image services (optional)..." -ForegroundColor Yellow
docker-compose -f $COMPOSE_FILE up -d kokoro localai 2>$null

Write-Host ""
Write-Host "🎉 Local AI Stack is ready!" -ForegroundColor Green
Write-Host ""
Write-Host "Services available:" -ForegroundColor Cyan
Write-Host "  - App:      http://localhost:3000"
Write-Host "  - Ollama:   http://localhost:11434"
Write-Host "  - Whisper:  http://localhost:9000"
Write-Host "  - Kokoro:   http://localhost:8880"
Write-Host "  - LocalAI:  http://localhost:8080"
Write-Host "  - Postgres: localhost:5432"
Write-Host "  - Redis:    localhost:6379"
Write-Host ""
