# Podium

Practice presentations with an AI audience. Upload a PowerPoint, present with camera and mic, take persona-based Q&A, then get scored feedback.

```
podium/
  client/   # Next.js UI
  agent/    # LiveKit voice agent (Interviewer + Evaluator)
```

## Prerequisites

- Node.js 24.x and [pnpm](https://pnpm.io)
- Python 3.10–3.14 and [uv](https://docs.astral.sh/uv/)
- A [LiveKit Cloud](https://cloud.livekit.io) project

## Setup

Copy env files and fill in LiveKit credentials (same project for both):

```bash
cp client/.env.example client/.env.local
# Edit client/.env.local — set LIVEKIT_* and AGENT_NAME=agent

cp agent/.env.example agent/.env.local
# Edit agent/.env.local — set LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET
```

`AGENT_NAME` in the client must match the agent dispatch name (`agent` in `agent/src/agent.py`).

## Run locally

Terminal 1 — voice agent:

```bash
cd agent
uv sync
uv run python src/agent.py dev
```

Terminal 2 — web UI:

```bash
cd client
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploy

| Piece | Root directory / context |
|-------|--------------------------|
| Frontend (Vercel, etc.) | `client` |
| LiveKit agent | `agent` — run `lk agent deploy` from `agent/`, or `docker build -f agent/Dockerfile agent` |

## CI

GitHub Actions at the repo root:

- `.github/workflows/client.yml` — lint and build the Next app
- `.github/workflows/agent.yml` — ruff and pytest for the Python agent

Workflows use path filters so unrelated changes skip the other package.
