from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass
from typing import Any

from livekit.agents import llm
from livekit.agents.llm import ChatContext

logger = logging.getLogger("podium.evaluator")

FILLER_RE = re.compile(r"\b(um|uh|er|like|you know)\b", re.IGNORECASE)

EVALUATOR_SYSTEM_PROMPT = """\
You are an expert presentation coach (the AI Evaluator). Analyze a practice presentation and Q&A.
Return ONLY valid JSON matching this schema:
{
  "summary": string,
  "scores": {
    "clarity": 1-10,
    "pacing": 1-10,
    "fillerWords": 1-10,
    "confidence": 1-10,
    "slideCoverage": 1-10,
    "answerQuality": 1-10,
    "argumentStrength": 1-10,
    "audienceFit": 1-10,
    "technicalKnowledge": 1-10
  },
  "moments": [
    {
      "timestampSec": number,
      "label": string,
      "observation": string,
      "betterApproach": string
    }
  ]
}

Rules:
- Higher scores are better. For fillerWords, 10 means few fillers.
- moments must reference real transcript content with approximate timestamps from the timed transcript.
- Include 3-6 moments covering both presentation delivery and Q&A answer quality when possible.
- Be specific. Prefer concrete coaching over generic praise.
- Do not wrap the JSON in markdown.
"""


@dataclass
class SpeechMetrics:
    words_per_minute: float
    filler_count: int
    talk_time_sec: float
    word_count: int


def _item_text(item: Any) -> str:
    text = getattr(item, "text_content", None)
    if isinstance(text, str) and text.strip():
        return text.strip()
    content = getattr(item, "content", None)
    if isinstance(content, str):
        return content.strip()
    if isinstance(content, list):
        parts: list[str] = []
        for part in content:
            if isinstance(part, str):
                parts.append(part)
            elif isinstance(part, dict) and part.get("type") == "text":
                parts.append(str(part.get("text", "")))
        return " ".join(parts).strip()
    return ""


def _item_timestamps(item: Any) -> tuple[float | None, float | None]:
    metrics = getattr(item, "metrics", None) or {}
    if not isinstance(metrics, dict):
        metrics = getattr(metrics, "__dict__", {}) or {}
    started = metrics.get("started_speaking_at")
    stopped = metrics.get("stopped_speaking_at")
    return (
        float(started) if started is not None else None,
        float(stopped) if stopped is not None else None,
    )


def build_timed_transcript(
    history: ChatContext,
    session_started_at: float | None = None,
) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    fallback_cursor = 0.0
    for item in history.items:
        item_type = getattr(item, "type", "message")
        if item_type != "message":
            continue
        role = getattr(item, "role", None)
        if role not in ("user", "assistant"):
            continue
        text = _item_text(item)
        if not text:
            continue
        started, stopped = _item_timestamps(item)
        if started is not None and session_started_at is not None:
            timestamp_sec = max(0.0, started - session_started_at)
        elif started is not None:
            # Absolute timestamps without a known session start — use relative fallback.
            timestamp_sec = fallback_cursor
        else:
            timestamp_sec = fallback_cursor
        if started is not None and stopped is not None and stopped >= started:
            duration = stopped - started
        else:
            duration = max(len(text.split()) / 2.5, 2.0)
        fallback_cursor = timestamp_sec + duration
        rows.append(
            {
                "role": role,
                "content": text,
                "timestampSec": round(timestamp_sec, 1),
                "durationSec": round(duration, 1),
            }
        )
    return rows


def compute_speech_metrics(
    transcript: list[dict[str, Any]],
    phase_boundary_sec: float | None = None,
) -> SpeechMetrics:
    present_rows = [
        row
        for row in transcript
        if row["role"] == "user"
        and (phase_boundary_sec is None or row["timestampSec"] < phase_boundary_sec)
    ]
    text = " ".join(row["content"] for row in present_rows)
    words = list(re.findall(r"[A-Za-z']+", text))
    word_count = len(words)
    filler_count = len(FILLER_RE.findall(text))
    if present_rows:
        talk_time = sum(float(row.get("durationSec") or 0) for row in present_rows)
        if talk_time <= 0 and len(present_rows) >= 2:
            talk_time = max(
                present_rows[-1]["timestampSec"] - present_rows[0]["timestampSec"],
                1.0,
            )
        talk_time = max(talk_time, 1.0)
    else:
        talk_time = 1.0
    wpm = (word_count / talk_time) * 60.0
    return SpeechMetrics(
        words_per_minute=round(wpm, 1),
        filler_count=filler_count,
        talk_time_sec=round(talk_time, 1),
        word_count=word_count,
    )


async def evaluate_session(
    evaluator_llm: llm.LLM,
    *,
    persona: str,
    deck_plain_text: str,
    transcript: list[dict[str, Any]],
    speech_metrics: SpeechMetrics,
    phase_boundary_sec: float | None,
) -> dict[str, Any]:
    user_payload = {
        "persona": persona,
        "deckExcerpt": deck_plain_text[:8000],
        "phaseBoundarySec": phase_boundary_sec,
        "speechMetrics": {
            "wordsPerMinute": speech_metrics.words_per_minute,
            "fillerCount": speech_metrics.filler_count,
            "talkTimeSec": speech_metrics.talk_time_sec,
            "wordCount": speech_metrics.word_count,
        },
        "timedTranscript": transcript,
    }

    chat_ctx = ChatContext()
    chat_ctx.add_message(role="system", content=EVALUATOR_SYSTEM_PROMPT)
    chat_ctx.add_message(
        role="user",
        content=(
            "Evaluate this practice session and return JSON only.\n\n"
            + json.dumps(user_payload, ensure_ascii=True)
        ),
    )

    try:
        response = await evaluator_llm.chat(chat_ctx=chat_ctx).collect()
        raw = (response.text or "").strip()
        if raw.startswith("```"):
            raw = re.sub(r"^```(?:json)?\s*", "", raw)
            raw = re.sub(r"\s*```$", "", raw)
        report = json.loads(raw)
    except Exception:
        logger.exception("Evaluator LLM failed; using heuristic report")
        report = _heuristic_report(persona, transcript, speech_metrics, phase_boundary_sec)

    report.setdefault("summary", "Feedback generated for this practice session.")
    report.setdefault(
        "scores",
        {
            "clarity": 6,
            "pacing": 6,
            "fillerWords": 6,
            "confidence": 6,
            "slideCoverage": 6,
            "answerQuality": 6,
            "argumentStrength": 6,
            "audienceFit": 6,
            "technicalKnowledge": 6,
        },
    )
    report.setdefault("moments", [])
    report["speechMetrics"] = {
        "wordsPerMinute": speech_metrics.words_per_minute,
        "fillerCount": speech_metrics.filler_count,
        "talkTimeSec": speech_metrics.talk_time_sec,
        "wordCount": speech_metrics.word_count,
    }
    report["persona"] = persona
    return report


def _heuristic_report(
    persona: str,
    transcript: list[dict[str, Any]],
    speech_metrics: SpeechMetrics,
    phase_boundary_sec: float | None,
) -> dict[str, Any]:
    filler_score = max(1, min(10, round(10 - speech_metrics.filler_count * 0.4)))
    pacing_score = 8
    if speech_metrics.words_per_minute < 90 or speech_metrics.words_per_minute > 170:
        pacing_score = 5
    qa_answers = [
        row
        for row in transcript
        if row["role"] == "user"
        and phase_boundary_sec is not None
        and row["timestampSec"] >= phase_boundary_sec
    ]
    answer_score = 7 if len(qa_answers) >= 3 else 5 if qa_answers else 4
    moments = []
    if speech_metrics.filler_count > 3 and transcript:
        moments.append(
            {
                "timestampSec": transcript[0]["timestampSec"],
                "label": "Filler words",
                "observation": (
                    f"Detected about {speech_metrics.filler_count} filler words during the talk."
                ),
                "betterApproach": "Replace fillers with a short pause before the next point.",
            }
        )
    if qa_answers:
        short = next((row for row in qa_answers if len(row["content"].split()) < 20), None)
        if short:
            moments.append(
                {
                    "timestampSec": short["timestampSec"],
                    "label": "Weak answer",
                    "observation": "This answer was short and did not connect back to a deck claim.",
                    "betterApproach": "Tie the answer to a specific requirement or slide, then explain why it matters.",
                }
            )
    if not moments and transcript:
        moments.append(
            {
                "timestampSec": transcript[0]["timestampSec"],
                "label": "Delivery baseline",
                "observation": "Enough material was captured to coach pacing and answer structure.",
                "betterApproach": "State one crisp takeaway before inviting questions.",
            }
        )
    return {
        "summary": (
            f"Heuristic evaluation for a {persona.replace('_', ' ')} audience. "
            "Use this as directional coaching while LLM evaluation is unavailable."
        ),
        "scores": {
            "clarity": 6,
            "pacing": pacing_score,
            "fillerWords": filler_score,
            "confidence": 6,
            "slideCoverage": 6,
            "answerQuality": answer_score,
            "argumentStrength": max(1, answer_score - 1),
            "audienceFit": 6,
            "technicalKnowledge": 6,
        },
        "moments": moments,
    }
