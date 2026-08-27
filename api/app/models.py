from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    email: Mapped[str] = mapped_column(
        String(320), unique=True, nullable=False, index=True
    )
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    display_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    decks: Mapped[list[Deck]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    sessions: Mapped[list[PracticeSession]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )


class Deck(Base):
    __tablename__ = "decks"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    file_name: Mapped[str] = mapped_column(String(512), nullable=False)
    storage_path: Mapped[str] = mapped_column(Text, nullable=False)
    plain_text: Mapped[str] = mapped_column(Text, nullable=False, default="")
    slide_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    user: Mapped[User] = relationship(back_populates="decks")
    sessions: Mapped[list[PracticeSession]] = relationship(back_populates="deck")
    slides: Mapped[list[DeckSlide]] = relationship(
        back_populates="deck",
        cascade="all, delete-orphan",
        order_by="DeckSlide.slide_index",
    )


class DeckSlide(Base):
    __tablename__ = "deck_slides"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    deck_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("decks.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    slide_index: Mapped[int] = mapped_column(Integer, nullable=False)
    storage_path: Mapped[str] = mapped_column(Text, nullable=False)

    deck: Mapped[Deck] = relationship(back_populates="slides")


class PracticeSession(Base):
    __tablename__ = "practice_sessions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    deck_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("decks.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    persona: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[str] = mapped_column(
        String(32), nullable=False, default="in_progress"
    )
    room_name: Mapped[str | None] = mapped_column(String(128), nullable=True)
    feedback: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    overall_score: Mapped[float | None] = mapped_column(Numeric(4, 1), nullable=True)
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    user: Mapped[User] = relationship(back_populates="sessions")
    deck: Mapped[Deck] = relationship(back_populates="sessions")
    session_personas: Mapped[list[PracticeSessionPersona]] = relationship(
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="PracticeSessionPersona.sort_order",
    )


class PracticeSessionPersona(Base):
    __tablename__ = "practice_session_personas"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("practice_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    persona: Mapped[str] = mapped_column(String(64), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False)

    session: Mapped[PracticeSession] = relationship(back_populates="session_personas")
