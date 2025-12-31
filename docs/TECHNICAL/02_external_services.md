# External Services Setup

Evermore integrates Best-in-Class AI services. This guide details how to set up each one.

## 🧠 Brain: Google Vertex AI (Required)

We use Google's Gemini 1.5 Pro/Flash models via Vertex AI for reasoning and generation.

### 1. Google Cloud Project
1. Go to [Google Cloud Console](https://console.cloud.google.com).
2. Create a new project (e.g., `Evermore-ai`).
3. Enable **Vertex AI API**.
4. Enable **Generative AI API**.

### 2. Authentication (Service Account)
For Local/Docker & Vercel:
1. Go to **IAM & Admin** > **Service Accounts**.
2. Create new Service Account (e.g., `Evermore-app`).
3. Grant Role: **Vertex AI User**.
4. Create Key: JSON format. Download it.
5. Base64 encode the JSON key:
   - *Mac/Linux*: `cat key.json | base64`
   - *Windows (PowerShell)*: `[Convert]::ToBase64String([IO.File]::ReadAllBytes("key.json"))`

### 3. Environment Variables
```env
GOOGLE_CLOUD_PROJECT=your-project-id
GOOGLE_CLOUD_LOCATION=us-central1
GOOGLE_APPLICATION_CREDENTIALS_BASE64=your-base64-string...
```

---

## 🎙️ Voice: ElevenLabs (Recommended)

Evermore uses ElevenLabs for the most natural, empathetic voice interface.

### 1. Setup
1. Sign up at [elevenlabs.io](https://elevenlabs.io).
2. Get API Key from Profile.
3. (Optional) Create a specific "Agent" in the Conversational AI tab for low-latency streaming.

### 2. Environment Variables
```env
SPEECH_PROVIDER=elevenlabs
ELEVENLABS_API_KEY=sk_...
ELEVENLABS_VOICE_ID=pNInz6obpgDQGcFmaJgB  # 'Adam' or your custom voice
ELEVENLABS_AGENT_ID=agent_...             # If using conversational agent
```

---

## 🧬 Memory: Pinecone (Recommended)

Stores semantic memories (vectors) to give the AI long-term Evermore.

### 1. Setup
1. Sign up at [pinecone.io](https://pinecone.io).
2. Create Index:
   - Name: `Evermore-memories`
   - Dimensions: `768` (standard for Google embeddings)
   - Metric: `cosine`
   - Cloud: AWS / Starter (Free)

### 2. Environment Variables
```env
PINECONE_API_KEY=pcsk_...
PINECONE_INDEX_NAME=Evermore-memories
```

---

## 🎨 Image: Vertex Imagen 2 (Included)

Included with Vertex AI setup.
- **Model**: `imagegeneration@005`
- **Permissions**: Ensure your Service Account has access.
- **Fallbacks**: System automatically uses SVG placeholders if credentials fail.

---

## ⚡ Cache: Upstash Redis (Production)

Running Redis in the cloud for Vercel deployments.

1. Go to [console.upstash.com](https://console.upstash.com).
2. Create Global Database.
3. Copy `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.
4. Copy Connection String for `REDIS_URL` (ensure you use the password, not just the token if different).

```env
REDIS_URL=rediss://default:PASSWORD@...
```
