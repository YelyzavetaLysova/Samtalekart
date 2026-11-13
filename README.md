# Samtalekart

Samtalekart is a research prototype for AI-supported small-group speaking practice among adult learners of Norwegian. Each learner opens the web application on their own phone. The group receives a shared conversation map, while detailed speaking help and feedback remain private.

This repository contains the first runnable application skeleton. It can run without paid API keys in mock mode.

## What already works

1. A teacher creates an activity with a topic, language level and grouping mode.
2. The application generates a join code and QR link.
3. Learners join a common lobby using a nickname.
4. The teacher creates automatic or manual groups.
5. Learners see the names in their group and confirm that they are together.
6. The teacher starts and ends all conversations.
7. Learners complete a microphone permission check.
8. Each group receives a shared conversation map.
9. Learners can open private graduated speaking and understanding support.
10. The map can receive a scripted contextual update.
11. Private feedback becomes available after the activity ends.
12. A participant can leave a conversation.

## Current boundaries

The first version uses an in-memory repository. PostgreSQL is included in Docker Compose but is not connected yet. Restarting the backend removes activities.

Mock mode does not send audio to LiveKit, Azure Speech or OpenAI. It is intended to validate the complete interaction before external services are enabled.

## Local start

Requirements:

- Docker Desktop, or Docker Engine with Docker Compose
- A browser with microphone access

Run:

```bash
cp .env.example .env
docker compose up --build
```

Open `http://localhost`.

To test the group interaction, open the teacher view in one browser window and the join link in two or more private browser windows or phones on the same network.

## Development without Docker

Backend:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

## Planned implementation order

1. Validate the lobby, grouping, calibration and conversation flow.
2. Replace the in-memory repository with PostgreSQL.
3. Enable self-hosted LiveKit and verify multiple simultaneous phone microphones.
4. Add server-side VAD and per-utterance microphone selection.
5. Compare Norwegian transcription from Azure Speech and Deepgram.
6. Add structured conversation-map updates.
7. Add private context-sensitive help.
8. Generate post-session feedback.
9. Deploy the tested containers to NREC.

## Production environment

Production uses `infra/Caddyfile.production`. Set:

```env
APP_DOMAIN=your-domain.example
CADDYFILE=Caddyfile.production
MOCK_SERVICES=false
LIVEKIT_URL=wss://livekit.your-domain.example
```

Change all development secrets before exposing the server to the internet.

