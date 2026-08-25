from __future__ import annotations

from functools import lru_cache

from supabase import Client, create_client

from app.config import get_settings


@lru_cache
def get_supabase() -> Client:
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_service_role_key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required")
    return create_client(settings.supabase_url, settings.supabase_service_role_key)


def upload_deck_file(
    storage_path: str,
    data: bytes,
    content_type: str = "application/vnd.openxmlformats-officedocument.presentationml.presentation",
) -> None:
    settings = get_settings()
    client = get_supabase()
    client.storage.from_(settings.decks_bucket).upload(
        path=storage_path,
        file=data,
        file_options={"content-type": content_type, "upsert": "true"},
    )


def delete_deck_file(storage_path: str) -> None:
    settings = get_settings()
    client = get_supabase()
    try:
        client.storage.from_(settings.decks_bucket).remove([storage_path])
    except Exception:
        # Best-effort cleanup; DB row deletion still proceeds.
        pass
