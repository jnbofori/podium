from __future__ import annotations

import re
from typing import Any

FILLER_PATTERNS = [
    re.compile(r"\bum\b", re.I),
    re.compile(r"\buh\b", re.I),
    re.compile(r"\ber\b", re.I),
    re.compile(r"\blike\b", re.I),
    re.compile(r"\byou know\b", re.I),
]


def _clamp(value: float) -> int:
    return max(1, min(10, round(value)))


def _word_count(text: str) -> int:
    return len([w for w in text.strip().split() if w])


def _count_fillers(text: str) -> int:
    return sum(len(p.findall(text)) for p in FILLER_PATTERNS)


def build_heuristic_report(
    *,
    persona: str,
    transcript: list[dict[str, Any]],
    phase_boundary_sec: float | None,
) -> dict[str, Any]:
    present_turns = [
        item
        for item in transcript
        if item.get("role") == "user"
        and (
            phase_boundary_sec is None
            or (item.get("timestampSec") or item.get("timestamp_sec") or 0)
            < phase_boundary_sec
        )
    ]
    qa_turns = [
        item
        for item in transcript
        if item.get("role") == "user"
        and phase_boundary_sec is not None
        and (item.get("timestampSec") or item.get("timestamp_sec") or 0)
        >= phase_boundary_sec
    ]

    present_text = " ".join(str(item.get("content") or "") for item in present_turns)
    words = _word_count(present_text)
    fillers = _count_fillers(present_text)
    first_ts = float(
        (
            present_turns[0].get("timestampSec")
            or present_turns[0].get("timestamp_sec")
            or 0
        )
        if present_turns
        else 0
    )
    last_ts = float(
        (
            present_turns[-1].get("timestampSec")
            or present_turns[-1].get("timestamp_sec")
            or present_turns.__len__() * 20
        )
        if present_turns
        else 0
    )
    span = last_ts - first_ts
    talk_time = max(1.0, span if span > 0 else max(words / 2.2, 30))
    wpm = (words / talk_time) * 60
    filler_rate = fillers / words if words else 0

    pacing = _clamp(5 if wpm < 90 or wpm > 170 else 8 - abs(130 - wpm) / 20)
    filler_words = _clamp(10 - filler_rate * 80)
    clarity = _clamp(7 + (1 if len(present_text) > 200 else -1))
    confidence = _clamp(6 + (2 if fillers < 5 else 0))
    slide_coverage = _clamp(7 if len(present_text) > 400 else 5)
    answer_quality = _clamp(7 if len(qa_turns) >= 3 else 5 if qa_turns else 4)
    argument_strength = _clamp(answer_quality - 0.5)
    audience_fit = 6
    technical_knowledge = answer_quality if persona == "technical_lead" else 6

    moments: list[dict[str, Any]] = []
    if fillers > 3 and present_turns:
        moments.append(
            {
                "timestampSec": float(
                    present_turns[0].get("timestampSec")
                    or present_turns[0].get("timestamp_sec")
                    or 0
                ),
                "label": "Filler words",
                "observation": (
                    f"You used about {fillers} filler words during the presentation, "
                    "which can weaken perceived confidence."
                ),
                "betterApproach": "Pause briefly instead of filling silence with um, uh, or like.",
            }
        )

    short = next(
        (t for t in qa_turns if _word_count(str(t.get("content") or "")) < 20), None
    )
    if short:
        moments.append(
            {
                "timestampSec": float(
                    short.get("timestampSec")
                    or short.get("timestamp_sec")
                    or phase_boundary_sec
                    or 0
                ),
                "label": "Thin answer",
                "observation": (
                    "This answer was brief and did not connect back to a concrete claim "
                    "from your deck."
                ),
                "betterApproach": (
                    "Restate the question, cite a slide claim, then explain the why "
                    "in one sentence."
                ),
            }
        )

    if not moments and present_turns:
        moments.append(
            {
                "timestampSec": float(
                    present_turns[0].get("timestampSec")
                    or present_turns[0].get("timestamp_sec")
                    or 0
                ),
                "label": "Solid start",
                "observation": (
                    "You covered the core narrative with enough material for the audience "
                    "to follow."
                ),
                "betterApproach": (
                    "Add one explicit takeaway per major section so Q&A answers stay grounded."
                ),
            }
        )

    return {
        "summary": (
            "Heuristic fallback feedback based on transcript pacing, filler words, "
            "and answer length. Re-run with the live evaluator for richer, "
            "slide-grounded notes."
        ),
        "scores": {
            "clarity": clarity,
            "pacing": pacing,
            "fillerWords": filler_words,
            "confidence": confidence,
            "slideCoverage": slide_coverage,
            "answerQuality": answer_quality,
            "argumentStrength": argument_strength,
            "audienceFit": audience_fit,
            "technicalKnowledge": technical_knowledge,
        },
        "moments": moments,
        "speechMetrics": {
            "wordsPerMinute": round(wpm),
            "fillerCount": fillers,
            "talkTimeSec": round(talk_time),
            "wordCount": words,
        },
        "persona": persona,
    }


def average_score(feedback: dict[str, Any] | None) -> float | None:
    if not feedback:
        return None
    scores = feedback.get("scores") or {}
    values = [float(v) for v in scores.values() if isinstance(v, (int, float))]
    if not values:
        return None
    return round(sum(values) / len(values), 1)
