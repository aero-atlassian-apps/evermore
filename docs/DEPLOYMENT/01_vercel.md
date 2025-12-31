# Vercel Deployment Guide

Deploy Evermore to production using Vercel (Serverless).

## Quick Start
1. **Push code** to GitHub/GitLab.
2. **Import project** in Vercel.
3. **Add Environment Variables** (see below).
4. **Deploy!**

---

## 1. `vercel.json` Configuration
We use a minimal configuration. Environment variables are managed in the Dashboard, not the file.

```json
{
    "$schema": "https://openapi.vercel.sh/vercel.json",
    "crons": [
        {
            "path": "/api/cron/process-jobs",
            "schedule": "*/5 * * * *"
        }
    ],
    "framework": "nextjs",
    "buildCommand": "npm run vercel-build",
    "outputDirectory": ".next"
}
```

---

## 2. Environment Variables (Dashboard)
Go to **Settings > Environment Variables** and add:

### Application
- `NODE_ENV`: `production`
- `NEXTAUTH_URL`: `https://your-app.vercel.app`
- `NEXTAUTH_SECRET`: `c66556304802e767a7e8ad2963296bb8d4b`
- `JWT_SECRET`: `c66556304802e767a7e8ad2963296bb8d4b`
- `CRON_SECRET`: `e81c084dc7dced`

### Database
- `DATABASE_URL`: `postgresql://user:pass@host:port/db?sslmode=require`

### Services
- `GOOGLE_CLOUD_PROJECT`: (Your GCP Project ID)
- `GOOGLE_CLOUD_LOCATION`: `us-central1`
- `GOOGLE_APPLICATION_CREDENTIALS_BASE64`: (Base64 service account key)
- `ELEVENLABS_API_KEY`: (Your Key)
- `PINECONE_API_KEY`: (Your Key)
- `REDIS_URL`: `rediss://default:pass@host:port` (Upstash)

### Feature Flags
- `USE_MOCKS`: `false`
- `LOG_LEVEL`: `info`

---

## 3. Database Migration
Vercel builds do **not** run migrations automatically. You must run them from your local machine or a CI/CD pipeline.

**Local Migration Command:**
```bash
# Point to PROD database
export DATABASE_URL="postgresql://prod-db-url..."
npm run db:push
```

---

## 4. Verification
After deployment:
1. Check **Function Logs** to ensure `[DI]` container initializes correctly.
2. Verify **Cron Jobs** tab shows the job scheduled.
3. Test **Login** and **Voice Chat**.
