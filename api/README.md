# Podium API

FastAPI backend for auth (email/password JWT), decks (Supabase Storage), practice sessions, and LiveKit token minting.

## Setup

```bash
cp .env.example .env.local
# Fill DATABASE_URL, SUPABASE_*, JWT_SECRET, LIVEKIT_*, AGENT_NAME, CORS_ORIGINS
uv sync
uv run uvicorn app.main:app --reload --port 8000
```

### Slide rendering (LibreOffice)

Uploading a deck converts each slide to a PNG for the practice viewer. The API needs **LibreOffice** installed so `soffice` is available:

- macOS: [LibreOffice](https://www.libreoffice.org/download/) (uses `/Applications/LibreOffice.app/Contents/MacOS/soffice`)
- Linux: `sudo apt install libreoffice` (or equivalent)
- Deploy: install LibreOffice in the API image/runtime

Python uses **PyMuPDF** (`pymupdf`) to rasterize the LibreOffice PDF output.

Practice sessions require **exactly two audience personas**. Fish Audio TTS voice IDs per persona live in `agent/src/personas.py`.

Docs: http://localhost:8000/docs

See [root README](../README.md) and [supabase/README.md](../supabase/README.md).
