from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: EmailStr
    display_name: str | None = None
    created_at: datetime


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    display_name: str | None = Field(default=None, max_length=120)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class DeckOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    file_name: str
    slide_count: int
    plain_text: str
    storage_path: str
    created_at: datetime
    updated_at: datetime


class SessionCreate(BaseModel):
    deck_id: uuid.UUID
    persona: str


class SessionUpdate(BaseModel):
    feedback: dict[str, Any] | None = None
    status: str | None = None
    room_name: str | None = None

    model_config = ConfigDict(extra="ignore")


class SessionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    deck_id: uuid.UUID
    persona: str
    status: str
    room_name: str | None
    feedback: dict[str, Any] | None
    overall_score: float | None
    started_at: datetime
    completed_at: datetime | None
    deck_file_name: str | None = None


class LiveKitTokenRequest(BaseModel):
    session_id: uuid.UUID


class LiveKitTokenResponse(BaseModel):
    server_url: str
    room_name: str
    participant_name: str
    participant_token: str
    session_id: uuid.UUID
