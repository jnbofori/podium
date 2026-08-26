from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db import get_db
from app.models import Deck, DeckSlide, PracticeSession, User
from app.schemas import (
    DeckOut,
    DeckSlideOut,
    LiveKitTokenRequest,
    LiveKitTokenResponse,
    SessionCreate,
    SessionOut,
    SessionUpdate,
)
from app.security import get_current_user
from app.services.evaluate import average_score
from app.services.livekit_tokens import mint_livekit_token
from app.services.pptx import parse_pptx
from app.services.slide_render import SlideRenderError, render_pptx_to_pngs
from app.services.storage import (
    create_signed_url,
    delete_storage_paths,
    download_deck_file,
    slide_storage_path,
    upload_deck_file,
)

router = APIRouter(tags=["business"])

PERSONAS = {
    "professor",
    "executive",
    "technical_lead",
    "investor",
    "skeptical_stakeholder",
    "interview_panel",
}


def _persist_slide_pngs(
    *,
    user_id: uuid.UUID,
    deck_id: uuid.UUID,
    pngs: list[bytes],
) -> list[DeckSlide]:
    slides: list[DeckSlide] = []
    for index, png in enumerate(pngs, start=1):
        path = slide_storage_path(str(user_id), str(deck_id), index)
        upload_deck_file(path, png, content_type="image/png")
        slides.append(
            DeckSlide(deck_id=deck_id, slide_index=index, storage_path=path)
        )
    return slides


def _slide_outs(slides: list[DeckSlide]) -> list[DeckSlideOut]:
    return [
        DeckSlideOut(index=slide.slide_index, url=create_signed_url(slide.storage_path))
        for slide in sorted(slides, key=lambda s: s.slide_index)
    ]


def _session_out(session: PracticeSession) -> SessionOut:
    return SessionOut(
        id=session.id,
        deck_id=session.deck_id,
        persona=session.persona,
        status=session.status,
        room_name=session.room_name,
        feedback=session.feedback,
        overall_score=float(session.overall_score)
        if session.overall_score is not None
        else None,
        started_at=session.started_at,
        completed_at=session.completed_at,
        deck_file_name=session.deck.file_name if session.deck else None,
    )


@router.post("/decks", response_model=DeckOut)
async def create_deck(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    data = await file.read()
    file_name = file.filename or "deck.pptx"
    try:
        parsed = parse_pptx(data, file_name)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        ) from exc

    try:
        pngs = render_pptx_to_pngs(data, file_name)
    except SlideRenderError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc

    deck_id = uuid.uuid4()
    storage_path = f"{user.id}/{deck_id}.pptx"
    slide_paths: list[str] = []
    try:
        upload_deck_file(storage_path, data)
        slide_rows = _persist_slide_pngs(
            user_id=user.id, deck_id=deck_id, pngs=pngs
        )
        slide_paths = [row.storage_path for row in slide_rows]
    except Exception as exc:
        delete_storage_paths([storage_path, *slide_paths])
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to upload deck to storage: {exc}",
        ) from exc

    deck = Deck(
        id=deck_id,
        user_id=user.id,
        file_name=parsed["fileName"],
        storage_path=storage_path,
        plain_text=parsed["plainText"],
        slide_count=parsed["slideCount"],
        slides=slide_rows,
    )
    db.add(deck)
    await db.commit()
    await db.refresh(deck)
    return DeckOut.model_validate(deck)


@router.get("/decks", response_model=list[DeckOut])
async def list_decks(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Deck).where(Deck.user_id == user.id).order_by(Deck.created_at.desc())
    )
    return [DeckOut.model_validate(d) for d in result.scalars().all()]


@router.get("/decks/{deck_id}", response_model=DeckOut)
async def get_deck(
    deck_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Deck).where(Deck.id == deck_id, Deck.user_id == user.id)
    )
    deck = result.scalar_one_or_none()
    if deck is None:
        raise HTTPException(status_code=404, detail="Deck not found")
    return DeckOut.model_validate(deck)


@router.get("/decks/{deck_id}/slides", response_model=list[DeckSlideOut])
async def get_deck_slides(
    deck_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Deck)
        .options(selectinload(Deck.slides))
        .where(Deck.id == deck_id, Deck.user_id == user.id)
    )
    deck = result.scalar_one_or_none()
    if deck is None:
        raise HTTPException(status_code=404, detail="Deck not found")

    if deck.slides:
        return _slide_outs(list(deck.slides))

    # Lazy render for decks uploaded before slide images existed
    try:
        pptx_bytes = download_deck_file(deck.storage_path)
        pngs = render_pptx_to_pngs(pptx_bytes, deck.file_name)
        slide_rows = _persist_slide_pngs(
            user_id=user.id, deck_id=deck.id, pngs=pngs
        )
    except SlideRenderError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to render slides: {exc}",
        ) from exc

    for row in slide_rows:
        db.add(row)
    await db.commit()
    result = await db.execute(
        select(DeckSlide)
        .where(DeckSlide.deck_id == deck.id)
        .order_by(DeckSlide.slide_index)
    )
    return _slide_outs(list(result.scalars().all()))


@router.delete("/decks/{deck_id}")
async def delete_deck(
    deck_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Deck)
        .options(selectinload(Deck.slides))
        .where(Deck.id == deck_id, Deck.user_id == user.id)
    )
    deck = result.scalar_one_or_none()
    if deck is None:
        raise HTTPException(status_code=404, detail="Deck not found")
    slide_paths = [s.storage_path for s in deck.slides]
    delete_storage_paths([deck.storage_path, *slide_paths])
    await db.delete(deck)
    await db.commit()
    return {"ok": True}


@router.post("/sessions", response_model=SessionOut)
async def create_session(
    body: SessionCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if body.persona not in PERSONAS:
        raise HTTPException(status_code=400, detail="Invalid persona")
    deck_result = await db.execute(
        select(Deck).where(Deck.id == body.deck_id, Deck.user_id == user.id)
    )
    deck = deck_result.scalar_one_or_none()
    if deck is None:
        raise HTTPException(status_code=404, detail="Deck not found")

    session = PracticeSession(
        user_id=user.id,
        deck_id=deck.id,
        persona=body.persona,
        status="in_progress",
        room_name=f"podium_{uuid.uuid4().hex[:12]}",
    )
    db.add(session)
    await db.commit()
    result = await db.execute(
        select(PracticeSession)
        .options(selectinload(PracticeSession.deck))
        .where(PracticeSession.id == session.id)
    )
    session = result.scalar_one()
    return _session_out(session)


@router.get("/sessions", response_model=list[SessionOut])
async def list_sessions(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(PracticeSession)
        .options(selectinload(PracticeSession.deck))
        .where(PracticeSession.user_id == user.id)
        .order_by(PracticeSession.started_at.desc())
    )
    return [_session_out(s) for s in result.scalars().all()]


@router.get("/sessions/{session_id}", response_model=SessionOut)
async def get_session(
    session_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(PracticeSession)
        .options(selectinload(PracticeSession.deck))
        .where(PracticeSession.id == session_id, PracticeSession.user_id == user.id)
    )
    session = result.scalar_one_or_none()
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return _session_out(session)


@router.patch("/sessions/{session_id}", response_model=SessionOut)
async def update_session(
    session_id: uuid.UUID,
    body: SessionUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from datetime import UTC, datetime

    result = await db.execute(
        select(PracticeSession)
        .options(selectinload(PracticeSession.deck))
        .where(PracticeSession.id == session_id, PracticeSession.user_id == user.id)
    )
    session = result.scalar_one_or_none()
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    if body.room_name is not None:
        session.room_name = body.room_name
    if body.feedback is not None:
        session.feedback = body.feedback
        session.overall_score = average_score(body.feedback)
    if body.status is not None:
        if body.status not in {"in_progress", "completed", "abandoned"}:
            raise HTTPException(status_code=400, detail="Invalid status")
        session.status = body.status
        if body.status == "completed" and session.completed_at is None:
            session.completed_at = datetime.now(UTC)

    await db.commit()
    await db.refresh(session)
    return _session_out(session)


@router.post("/livekit/token", response_model=LiveKitTokenResponse)
async def livekit_token(
    body: LiveKitTokenRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(PracticeSession)
        .options(selectinload(PracticeSession.deck))
        .where(
            PracticeSession.id == body.session_id, PracticeSession.user_id == user.id
        )
    )
    session = result.scalar_one_or_none()
    if session is None or session.deck is None:
        raise HTTPException(status_code=404, detail="Session not found")

    try:
        payload = mint_livekit_token(
            user_id=user.id,
            user_email=user.email,
            display_name=user.display_name,
            session=session,
            deck=session.deck,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    if session.room_name != payload["room_name"]:
        session.room_name = payload["room_name"]
        await db.commit()

    return LiveKitTokenResponse(
        server_url=payload["server_url"],
        room_name=payload["room_name"],
        participant_name=payload["participant_name"],
        participant_token=payload["participant_token"],
        session_id=payload["session_id"],
    )
