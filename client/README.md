# Podium client

Next.js UI for Podium. Auth, decks, sessions, PPTX parse, evaluate fallback, and LiveKit tokens are served by the FastAPI app in [`../api`](../api).

## Setup

```bash
cp .env.example .env.local
# NEXT_PUBLIC_API_URL=http://localhost:8000
# AGENT_NAME=agent
pnpm install
pnpm dev
```

See the [root README](../README.md) for running API + agent + client together.
