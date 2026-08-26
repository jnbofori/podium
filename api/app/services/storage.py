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


def download_deck_file(storage_path: str) -> bytes:
    settings = get_settings()
    client = get_supabase()
    return client.storage.from_(settings.decks_bucket).download(storage_path)


def create_signed_url(storage_path: str, expires_in: int = 3600) -> str:
    settings = get_settings()
    client = get_supabase()
    result = client.storage.from_(settings.decks_bucket).create_signed_url(
        storage_path, expires_in
    )
    url = None
    if isinstance(result, dict):
        url = result.get("signedURL") or result.get("signedUrl")
    if not url:
        raise RuntimeError(f"Unexpected signed URL response: {result!r}")
    return str(url)


def delete_deck_file(storage_path: str) -> None:
    settings = get_settings()
    client = get_supabase()
    try:
        client.storage.from_(settings.decks_bucket).remove([storage_path])
    except Exception:
        # Best-effort cleanup; DB row deletion still proceeds.
        pass


def delete_storage_paths(paths: list[str]) -> None:
    if not paths:
        return
    settings = get_settings()
    client = get_supabase()
    try:
        client.storage.from_(settings.decks_bucket).remove(paths)
    except Exception:
        pass


def slide_storage_path(user_id: str, deck_id: str, slide_index: int) -> str:
    return f"{user_id}/{deck_id}/slides/{slide_index}.png"
