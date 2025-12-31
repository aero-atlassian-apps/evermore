# Local Development Setup

Get Evermore running on your machine in 5 minutes.

## Prerequisites
- Node.js 18+
- Docker Desktop (for Database/Redis)
- Git

## 1. Clone & Install
```bash
git clone https://github.com/your-org/Evermore.git
cd Evermore-mvp
npm install
```

## 2. Environment Setup
1. Copy the example env file:
   ```bash
   cp .env.example .env.local
   ```
2. Fill in the keys (See [External Services Guide](../TECHNICAL/EXTERNAL_SERVICES.md)).
   - *Tip*: set `USE_MOCKS=true` to skip setting up keys initially.

## 3. Start Infrastructure (Docker)
We use Docker for the local database and redis.
```bash
docker compose up -d
```
*This starts a PostgreSQL container on port 5432 and Redis on 6379.*

## 4. Run Migrations
Push the schema to your local DB.
```bash
npm run db:push
```

## 5. Start App
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000).

---

## Troubleshooting
- **Port Conflicts**: Ensure nothing else is on port 3000 or 5432.
- **Database Connection**: If `npm run db:push` fails, ensure Docker is running.
- **Microphone**: Allow browser permissions for the Voice Chat.
