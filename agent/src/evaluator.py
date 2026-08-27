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

SCORE_KEYS = (
    "clarity",
    "pacing",
    "fillerWords",
    "confidence",
    "slideCoverage",
    "answerQuality",
    "argumentStrength",
    "audienceFit",
    "technicalKnowledge",
)

EVALUATOR_SYSTEM_PROMPT = """\
You are an expert presentation coach (the AI Evaluator). Analyze a practice presentation and Q&A.
Return ONLY valid JSON matching this schema:
{
  "summary": string,
  "scores": {
    "clarity": { "value": 1-10, "rationale": string },
    "pacing": { "value": 1-10, "rationale": string },
    "fillerWords": { "value": 1-10, "rationale": string },
    "confidence": { "value": 1-10, "rationale": string },
    "slideCoverage": { "value": 1-10, "rationale": string },
    "answerQuality": { "value": 1-10, "rationale": string },
    "argumentStrength": { "value": 1-10, "rationale": string },
    "audienceFit": { "value": 1-10, "rationale": string },
    "technicalKnowledge": { "value": 1-10, "rationale": string }
  },
  "moments": [
    {
      "timestampSec": number,
      "label": string,
      "observation": string,
      "question": string | null,
      "answer": string | null,
      "betterApproach": string
    }
  ]
}

Rules:
- Higher scores are better. For fillerWords, 10 means few fillers.
- Every score MUST include a short rationale citing transcript evidence (what they said or did).
- moments must reference real transcript content with approximate timestamps from the timed transcript.
- Include 3-6 moments covering both presentation delivery and Q&A answer quality when possible.
- For Q&A moments: set question to the interviewer's question and answer to the presenter's reply (quote or close paraphrase from the timed transcript). For delivery-only moments (e.g. fillers, pacing), set question and answer to null.
- betterApproach must be actionable and specific to that question/answer or delivery issue.
- audienceFit must reflect how well the presenter adapted to the listed audience panel personas (cite each when multiple).
- Be specific. Prefer concrete coaching over generic praise.
- Do not wrap the JSON in markdown.
"""


@dataclass
class SpeechMetrics:
    words_per_minute: float
    filler_count: int
    talk_time_sec: float
    word_count: int


def _score(value: int, rationale: str) -> dict[str, Any]:
    return {"value": max(1, min(10, int(value))), "rationale": rationale}


def _prior_assistant_question(
    transcript: list[dict[str, Any]], answer_row: dict[str, Any]
) -> str | None:
    answer_ts = float(answer_row.get("timestampSec") or 0)
    prior: str | None = None
    for row in transcript:
        if float(row.get("timestampSec") or 0) >= answer_ts:
            break
        if row.get("role") == "assistant":
            text = str(row.get("content") or "").strip()
            if text:
                prior = text
    return prior


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


def _normalize_scores(raw_scores: Any) -> dict[str, Any]:
    if not isinstance(raw_scores, dict):
        raw_scores = {}
    normalized: dict[str, Any] = {}
    for key in SCORE_KEYS:
        entry = raw_scores.get(key, 6)
        if isinstance(entry, dict):
            value = entry.get("value", 6)
            rationale = (
                str(entry.get("rationale") or "").strip() or "No rationale provided."
            )
            try:
                value_int = round(float(value))
            except (TypeError, ValueError):
                value_int = 6
            normalized[key] = _score(value_int, rationale)
        else:
            try:
                value_int = round(float(entry))
            except (TypeError, ValueError):
                value_int = 6
            normalized[key] = _score(
                value_int, "Score recorded without a detailed rationale."
            )
    return normalized


def _normalize_moments(raw_moments: Any) -> list[dict[str, Any]]:
    if not isinstance(raw_moments, list):
        return []
    moments: list[dict[str, Any]] = []
    for item in raw_moments:
        if not isinstance(item, dict):
            continue
        try:
            ts = float(item.get("timestampSec") or 0)
        except (TypeError, ValueError):
            ts = 0.0
        question = item.get("question")
        answer = item.get("answer")
        moments.append(
            {
                "timestampSec": ts,
                "label": str(item.get("label") or "Moment"),
                "observation": str(item.get("observation") or ""),
                "question": str(question).strip() if question else None,
                "answer": str(answer).strip() if answer else None,
                "betterApproach": str(item.get("betterApproach") or ""),
            }
        )
    return moments


async def evaluate_session(
    evaluator_llm: llm.LLM,
    *,
    personas: list[str],
    deck_plain_text: str,
    transcript: list[dict[str, Any]],
    speech_metrics: SpeechMetrics,
    phase_boundary_sec: float | None,
) -> dict[str, Any]:
    persona_list = personas or ["executive"]
    user_payload = {
        "personas": persona_list,
        "persona": persona_list[0],
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

    print("user_payload!", user_payload)

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
        print("response!", response)
        raw = (response.text or "").strip()
        if raw.startswith("```"):
            raw = re.sub(r"^```(?:json)?\s*", "", raw)
            raw = re.sub(r"\s*```$", "", raw)
        report = json.loads(raw)
        print("report!", report)
    except Exception:
        logger.exception("Evaluator LLM failed; using heuristic report")
        report = _heuristic_report(
            persona_list, transcript, speech_metrics, phase_boundary_sec
        )

    if not isinstance(report, dict):
        report = {}
    report["summary"] = str(
        report.get("summary") or "Feedback generated for this practice session."
    )
    report["scores"] = _normalize_scores(report.get("scores"))
    report["moments"] = _normalize_moments(report.get("moments"))
    report["speechMetrics"] = {
        "wordsPerMinute": speech_metrics.words_per_minute,
        "fillerCount": speech_metrics.filler_count,
        "talkTimeSec": speech_metrics.talk_time_sec,
        "wordCount": speech_metrics.word_count,
    }
    report["personas"] = persona_list
    report["persona"] = persona_list[0]
    return report


def _heuristic_report(
    personas: list[str] | str,
    transcript: list[dict[str, Any]],
    speech_metrics: SpeechMetrics,
    phase_boundary_sec: float | None,
) -> dict[str, Any]:
    if isinstance(personas, str):
        persona_list = [personas]
    else:
        persona_list = personas or ["executive"]
    persona_label = ", ".join(p.replace("_", " ") for p in persona_list)
    filler_score = max(1, min(10, round(10 - speech_metrics.filler_count * 0.4)))
    pacing_score = 8
    pacing_rationale = f"Speaking rate was about {speech_metrics.words_per_minute} WPM, within a clear range."
    if speech_metrics.words_per_minute < 90 or speech_metrics.words_per_minute > 170:
        pacing_score = 5
        pacing_rationale = (
            f"Speaking rate was about {speech_metrics.words_per_minute} WPM, "
            "outside the comfortable 90-170 range."
        )
    qa_answers = [
        row
        for row in transcript
        if row["role"] == "user"
        and phase_boundary_sec is not None
        and row["timestampSec"] >= phase_boundary_sec
    ]
    answer_score = 7 if len(qa_answers) >= 3 else 5 if qa_answers else 4
    answer_rationale = (
        f"Captured {len(qa_answers)} Q&A answer(s); depth and grounding vary."
        if qa_answers
        else "Little or no Q&A answer content was captured."
    )
    moments: list[dict[str, Any]] = []
    if speech_metrics.filler_count > 3 and transcript:
        moments.append(
            {
                "timestampSec": transcript[0]["timestampSec"],
                "label": "Filler words",
                "observation": (
                    f"Detected about {speech_metrics.filler_count} filler words during the talk."
                ),
                "question": None,
                "answer": None,
                "betterApproach": "Replace fillers with a short pause before the next point.",
            }
        )
    if qa_answers:
        short = next(
            (row for row in qa_answers if len(row["content"].split()) < 20), None
        )
        if short:
            moments.append(
                {
                    "timestampSec": short["timestampSec"],
                    "label": "Weak answer",
                    "observation": (
                        "This answer was short and did not connect back to a deck claim."
                    ),
                    "question": _prior_assistant_question(transcript, short),
                    "answer": short["content"],
                    "betterApproach": (
                        "Tie the answer to a specific requirement or slide, "
                        "then explain why it matters."
                    ),
                }
            )
    if not moments and transcript:
        moments.append(
            {
                "timestampSec": transcript[0]["timestampSec"],
                "label": "Delivery baseline",
                "observation": "Enough material was captured to coach pacing and answer structure.",
                "question": None,
                "answer": None,
                "betterApproach": "State one crisp takeaway before inviting questions.",
            }
        )
    return {
        "summary": (
            f"Heuristic evaluation for a {persona_label} audience. "
            "Use this as directional coaching while LLM evaluation is unavailable."
        ),
        "scores": {
            "clarity": _score(
                6, "Baseline clarity score from heuristic delivery signals."
            ),
            "pacing": _score(pacing_score, pacing_rationale),
            "fillerWords": _score(
                filler_score,
                f"Counted about {speech_metrics.filler_count} filler words in the talk.",
            ),
            "confidence": _score(
                6, "Heuristic confidence estimate from delivery patterns."
            ),
            "slideCoverage": _score(
                6, "Slide coverage estimated without full LLM review."
            ),
            "answerQuality": _score(answer_score, answer_rationale),
            "argumentStrength": _score(
                max(1, answer_score - 1),
                "Argument strength tracked with answer depth in this heuristic pass.",
            ),
            "audienceFit": _score(
                6,
                f"Audience fit scored neutrally for panel: {persona_label}.",
            ),
            "technicalKnowledge": _score(
                6, "Technical depth not fully assessed in the heuristic fallback."
            ),
        },
        "moments": moments,
        "personas": persona_list,
        "persona": persona_list[0],
    }
