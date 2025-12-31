# Evermore (formerly Recall)

**Evermore** is a voice-first, AI-agentic application designed to preserve family stories. It allows "Seniors" (Storytellers) to record memories via natural conversation with an empathetic AI, and "Family Members" to curate and cherish these stories.

## Core Features

### For Storytellers (Seniors)
*   **Voice-First Interface**: Natural conversation with an AI host that listens, understands, and asks follow-up questions.
*   **Story Immersion**: Listen to your recorded stories with generated audio, view transcripts, and relive memories.
*   **Favorites**: Mark your most cherished stories for easy access.
*   **Delete**: Remove stories you no longer wish to keep.
*   **Profile**: Manage your personal details and "Voiceprint".

### For Family Members
*   **Family Portal**: View recent updates from your loved ones.
*   **Storybook Creation**: Select stories to export as a beautifully formatted PDF storybook.

## Technology Stack

*   **Frontend**: Next.js 14 (App Router), Tailwind CSS, Framer Motion.
*   **Backend**: Next.js API Routes, Drizzle ORM, PostgreSQL.
*   **AI/Agentic**: Custom "Evermore" Agent (built on Google Gemini/Vertex AI), Deepgram (STT), ElevenLabs (TTS).
*   **Vector DB**: Pinecone (for memory recall and context).

## Getting Started

1.  **Install Dependencies**:
    ```bash
    npm install
    ```

2.  **Environment Setup**:
    Copy `docs/env-template.txt` to `.env.local` and fill in the required API keys.

3.  **Run Development Server**:
    ```bash
    npm run dev
    ```

4.  **Open Application**:
    Navigate to [http://localhost:3000](http://localhost:3000).

## Documentation

*   See `docs/PRODUCT` for product requirements and user stories.
*   See `docs/ARCHITECTURE` for system design and agentic flow.
