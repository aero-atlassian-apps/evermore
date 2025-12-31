# Vercel Deployment Guide

Complete step-by-step guide for deploying Evermore to Vercel.

---

## Step 1: vercel.json Configuration

Your `vercel.json` should contain only:

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
    "buildCommand": "npm run build",
    "outputDirectory": ".next"
}
```

---

## Step 2: Vercel Dashboard Environment Variables

Go to **Vercel Dashboard → Your Project → Settings → Environment Variables**

Add each variable below. For each, select environments: ✅ Production, ✅ Preview, ✅ Development

### Core Authentication
| Variable | Example Value |
|----------|---------------|
| `NODE_ENV` | `production` |
| `NEXTAUTH_SECRET` | Generate with `openssl rand -base64 32` |
| `JWT_SECRET` | Generate with `openssl rand -base64 32` |
| `CRON_SECRET` | Generate with `openssl rand -hex 16` |
| `NEXTAUTH_URL` | `https://your-app.vercel.app` |
| `NEXT_PUBLIC_APP_URL` | `https://your-app.vercel.app` |

### Database (CockroachDB)
| Variable | Example Value |
|----------|---------------|
| `DATABASE_URL` | `postgresql://user:pass@cluster.cockroachlabs.cloud:26257/defaultdb?sslmode=require` |

### Redis (Upstash)
| Variable | Example Value |
|----------|---------------|
| `REDIS_URL` | `rediss://default:password@host.upstash.io:6379` |

### LLM Provider (Google Vertex AI)
| Variable | Example Value |
|----------|---------------|
| `LLM_PROVIDER` | `vertex` |
| `GOOGLE_CLOUD_PROJECT` | `your-gcp-project-id` |
| `GOOGLE_CLOUD_LOCATION` | `us-central1` |
| `GOOGLE_APPLICATION_CREDENTIALS_BASE64` | Base64-encoded service account JSON |

### Speech (ElevenLabs)
| Variable | Example Value |
|----------|---------------|
| `SPEECH_PROVIDER` | `elevenlabs` |
| `ELEVENLABS_API_KEY` | `sk_your_api_key` |
| `ELEVENLABS_VOICE_ID` | `pNInz6obpgDQGcFmaJgB` |
| `ELEVENLABS_AGENT_ID` | `agent_your_agent_id` |
| `NEXT_PUBLIC_ELEVENLABS_AGENT_ID` | Same as above |

### Vector Store (Pinecone)
| Variable | Example Value |
|----------|---------------|
| `PINECONE_API_KEY` | `pcsk_your_pinecone_key` |

### Email Service (Mailtrap)
| Variable | Example Value | Notes |
|----------|---------------|-------|
| `MAILTRAP_API_TOKEN` | `your-mailtrap-api-token` | Get from [mailtrap.io](https://mailtrap.io) |
| `MAILTRAP_INBOX_ID` | `4281111` | From sandbox API URL |
| `MAILTRAP_FROM_EMAIL` | `evermore@demomailtrap.co` | Verified sender |
| `MAILTRAP_FROM_NAME` | `Evermore` | Display name |

> **Note**: For production, switch to Resend or SendGrid. Mailtrap sandbox is for testing only.

### Image Generation (Google Imagen)
| Variable | Example Value | Notes |
|----------|---------------|-------|
| `GOOGLE_CLOUD_PROJECT` | `your-gcp-project-id` | Same as LLM - must have Imagen API enabled |

> **Note**: Story card images are generated using Imagen 2. This requires the Vertex AI Imagen API to be enabled in your GCP project.

### Feature Flags
| Variable | Value |
|----------|-------|
| `USE_MOCKS` | `false` |
| `NEXT_PUBLIC_USE_MOCKS` | `false` |
| `LOG_LEVEL` | `info` |

---

## Step 3: Database Setup (One-Time)

Before first deploy, create database tables locally:

```bash
# Set your production DATABASE_URL
export DATABASE_URL="postgresql://user:pass@cluster.cockroachlabs.cloud:26257/defaultdb?sslmode=require"

# Create tables (safe - won't delete existing data)
npm run db:push
```

> ⚠️ **Important**: Run this ONCE before first Vercel deploy. This creates tables in your cloud CockroachDB.

**New columns added in recent updates:**
- `chapters.cover_image_data` - AI-generated card thumbnails (base64)
- `chapters.banner_image_data` - AI-generated chapter banners (base64)

---

## Step 4: Connect Repository

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your Git repository
3. Vercel auto-detects Next.js
4. Click **Deploy**

---

## Step 5: Verify Deployment

After deployment:

1. **Check logs**: Vercel Dashboard → Deployments → View Logs
2. **Verify services connected**:
   - `[DI] Using GoogleVertexAdapter` ✅
   - `[DI] Using PineconeStore` ✅
   - `[DI] Using MailtrapEmailService` ✅ (or ResendEmailService)
   - `[DI] Using GoogleImagenAdapter` ✅
   - `[RedisService] Connected` ✅
3. **Test cron**: Check Functions tab for `/api/cron/process-jobs` executions

---

## Cron Job

The cron runs every 5 minutes (`*/5 * * * *`) and processes pending chapter generation jobs.

- **Endpoint**: `/api/cron/process-jobs`
- **Authentication**: Uses `CRON_SECRET` header
- **View logs**: Vercel Dashboard → Logs → Filter by `/api/cron`

---

## Feature: AI-Generated Story Images

When a chapter is created, the system:
1. Uses LLM to craft context-aware image prompts from story content
2. Generates 2 images via Google Imagen (card + banner)
3. Stores as base64 in database
4. Displays on story cards and chapter detail pages

**Requirements:**
- Vertex AI Imagen API enabled in GCP
- Service account has `aiplatform.user` role

---

## Feature: Email Notifications

Emails are sent for:
- **New chapter created** → User notified with link to story
- **Safety alerts** → Emergency contacts notified
- **Family invitations** → Invite links sent

**Provider priority:**
1. Mailtrap (if `MAILTRAP_API_TOKEN` set) - Development/Testing
2. Resend (fallback) - Production recommended
3. Mock (if `USE_MOCKS=true`) - No emails sent

---

## Staging vs Production

| Aspect | Docker Staging | Vercel Production |
|--------|----------------|-------------------|
| Database | Seeded with demo data | Empty (users create accounts) |
| Seed script | Runs on container start | **Never runs** |
| Cron | BackgroundWorker (10s poll) | Vercel Cron (5 min) |
| Email | Mailtrap sandbox | Resend/SendGrid |
| Images | MockImageGenerator or Imagen | GoogleImagenAdapter |

---

## Troubleshooting

### Build Fails
- Check all environment variables are set
- Verify `GOOGLE_APPLICATION_CREDENTIALS_BASE64` is valid base64

### Cron Not Running
- Verify `CRON_SECRET` is set
- Check Vercel Dashboard → Crons tab

### Database Connection Failed
- Verify `DATABASE_URL` includes `?sslmode=require`
- Run `npm run db:push` to create tables

### Emails Not Sending
- Check `MAILTRAP_API_TOKEN` is set correctly
- Verify logs for `[MailtrapEmailService]` entries
- Check Mailtrap inbox for received emails

### Story Images Not Generating
- Verify `GOOGLE_CLOUD_PROJECT` is set
- Ensure Imagen API is enabled in GCP Console
- Check logs for `[AgenticChapterImageGenerator]` errors

---

## Quick Reference

```bash
# One-time database setup
npm run db:push

# Deploy via Git
git push origin main

# Deploy via CLI
vercel --prod

# Check deployment logs
vercel logs
```

