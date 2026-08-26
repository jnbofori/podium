from __future__ import annotations

import json
import uuid
from datetime import timedelta

from livekit.api import AccessToken, VideoGrants
from livekit.protocol.agent_dispatch import RoomAgentDispatch
from livekit.protocol.room import RoomConfiguration

from app.config import get_settings
from app.models import Deck, PracticeSession


def mint_livekit_token(
    *,
    user_id: uuid.UUID,
    user_email: str,
    display_name: str | None,
    session: PracticeSession,
    deck: Deck,
) -> dict:
    settings = get_settings()
    if (
        not settings.livekit_url
        or not settings.livekit_api_key
        or not settings.livekit_api_secret
    ):
        raise RuntimeError("LiveKit credentials are not configured")

    room_name = session.room_name or f"podium_{session.id.hex[:12]}"
    display = (display_name or "").strip() or user_email.split("@")[0] or "presenter"
    metadata = {
        "persona": session.persona,
        "deckPlainText": deck.plain_text,
        "slideCount": deck.slide_count,
        "fileName": deck.file_name,
        "sessionId": str(session.id),
        "presenterName": display,
    }
    token = (
        AccessToken(settings.livekit_api_key, settings.livekit_api_secret)
        .with_identity(str(user_id))
        .with_name(display)
        .with_grants(
            VideoGrants(
                room_join=True,
                room=room_name,
                can_publish=True,
                can_subscribe=True,
                can_publish_data=True,
            )
        )
        .with_ttl(timedelta(minutes=15))
        .with_room_config(
            RoomConfiguration(
                agents=[
                    RoomAgentDispatch(
                        agent_name=settings.agent_name,
                        metadata=json.dumps(metadata),
                    )
                ]
            )
        )
    )

    return {
        "server_url": settings.livekit_url,
        "room_name": room_name,
        "participant_name": display,
        "participant_token": token.to_jwt(),
        "session_id": session.id,
    }
