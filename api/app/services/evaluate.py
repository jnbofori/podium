from __future__ import annotations

from typing import Any


def _score_numeric(entry: Any) -> float | None:
    if isinstance(entry, (int, float)):
        return float(entry)
    if isinstance(entry, dict) and isinstance(entry.get("value"), (int, float)):
        return float(entry["value"])
    return None


def average_score(feedback: dict[str, Any] | None) -> float | None:
    if not feedback:
        return None
    scores = feedback.get("scores") or {}
    values = [
        v for v in (_score_numeric(entry) for entry in scores.values()) if v is not None
    ]
    if not values:
        return None
    return round(sum(values) / len(values), 1)
