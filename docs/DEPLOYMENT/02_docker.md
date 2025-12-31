# Docker Staging Guide

Run a mirror of production locally using Docker Compose.

## 1. Prerequisites
- Docker Desktop installed and running.
- `.env.staging` file populated with **REAL** credentials (not mocks).

## 2. Configuration (`.env.staging`)
Ensure `USE_MOCKS=false` and `DB_PROVIDER=postgres` (or cockroachdb).

```env
NODE_ENV=production
DATABASE_URL=postgresql://...
REDIS_URL=rediss://...
# ... other real keys
```

## 3. Commands

### Build & Start
```bash
docker compose -f docker-compose.staging.yml up --build -d
```

### View Logs
```bash
docker logs -f Evermore_staging
```

### Stop
```bash
docker compose -f docker-compose.staging.yml down
```

## 4. Architecture
The Docker Staging setup mimics Vercel:

- **App Container**: Runs `npm run start` (Next.js production build).
- **Worker**: Runs in-process background worker (simulating Vercel Cron).
- **Network**: Connects to the host internet to reach Vertex AI / ElevenLabs.

## 5. Troubleshooting
- **"Connection Refused" to DB**: Ensure `DATABASE_URL` allows connections from the docker IP (or use Cloud DB).
- **Build Fails**: Run `docker system prune -af` to clear cache.
